import { Router, Response, NextFunction } from 'express';
import { getUserRepository } from '../db/repositories/userRepository';
import { getTeamRepository } from '../db/repositories/teamRepository';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

function getZodErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'errors' in error) {
    const zodError = error as { errors: Array<{ message?: string }> };
    return zodError.errors[0]?.message || 'Validation error';
  }
  return 'Validation error';
}

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  teamId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

router.get('/keys', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = getUserRepository();
    const apiKeys = await userRepo.getUserApiKeys(req.user!.id);

    res.status(200).json({
      success: true,
      data: {
        apiKeys: apiKeys.map((key) => ({
          id: key.id,
          name: key.name,
          teamId: key.teamId,
          lastUsedAt: key.lastUsedAt,
          expiresAt: key.expiresAt,
          createdAt: key.createdAt,
        })),
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error fetching API keys', error);
    next(error);
  }
});

router.post('/keys', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validationResult = createApiKeySchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { name, teamId, expiresAt } = validationResult.data;

    if (teamId) {
      const teamRepo = getTeamRepository();
      const team = await teamRepo.getTeamById(teamId);

      if (!team) {
        return res.status(404).json({
          success: false,
          error: 'Team not found',
          code: 'TEAM_NOT_FOUND',
        } as ErrorResponse);
      }

      const userRole = await teamRepo.getUserTeamRole(teamId, req.user!.id);

      if (!userRole) {
        return res.status(403).json({
          success: false,
          error: 'You are not a member of this team',
          code: 'NOT_TEAM_MEMBER',
        } as ErrorResponse);
      }
    }

    const userRepo = getUserRepository();
    const apiKey = await userRepo.generateApiKey(
      req.user!.id,
      name,
      teamId,
      expiresAt ? new Date(expiresAt) : undefined,
    );

    const fullKey = `sk_${Date.now()}_${Math.random().toString(36).substr(2, 24)}`;

    res.status(201).json({
      success: true,
      data: {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key: fullKey,
          teamId: apiKey.teamId,
          lastUsedAt: apiKey.lastUsedAt,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
      },
      message: 'API key created. Store this key securely - it will not be shown again.',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error creating API key', error);
    next(error);
  }
});

router.delete('/keys/:keyId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = getUserRepository();
    const apiKeys = await userRepo.getUserApiKeys(req.user!.id);

    const key = apiKeys.find((k) => k.id === req.params.keyId);

    if (!key) {
      return res.status(404).json({
        success: false,
        error: 'API key not found',
        code: 'API_KEY_NOT_FOUND',
      } as ErrorResponse);
    }

    await userRepo.deleteApiKey(req.params.keyId);

    res.status(200).json({
      success: true,
      data: {},
      message: 'API key deleted',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error deleting API key', error);
    next(error);
  }
});

export default router;
