import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getUserRepository } from '../db/repositories/userRepository';
import { getPrismaClient } from '../db/client';
import { logger } from '../utils/logger';

const router = Router();
const userRepository = getUserRepository();

// Configure multer for avatar uploads
const uploadsDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `avatar_${Date.now()}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const profileUpdateSchema = z.object({
  userId: z.string().uuid('Invalid user ID').optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  avatarUrl: z.string().min(1, 'avatarUrl must be provided when supplied').optional(),
});

const changePasswordSchema = z.object({
  userId: z.string().uuid('Invalid user ID').optional(),
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const avatarSchema = z.object({
  userId: z.string().uuid('Invalid user ID').optional(),
  avatarUrl: z.string().min(1, 'avatarUrl must be provided'),
});

const createUserApiKeySchema = z.object({
  userId: z.string().uuid('Invalid user ID').optional(),
  teamId: z.string().uuid('Invalid team ID').optional(),
  name: z.string().min(1, 'Key name is required').max(100),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

const getUserIdFromRequest = (req: Request): string | undefined => {
  if ((req as any).user?.id) {
    return (req as any).user.id;
  }
  if (typeof req.query.userId === 'string') {
    return req.query.userId;
  }
  if (req.body && typeof req.body.userId === 'string') {
    return req.body.userId;
  }
  return undefined;
};

const handleError = (error: unknown, res: Response, next: NextFunction) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      success: false,
      error: error.message,
      code: error.code,
    });
  }
  return next(error);
};

const formatUser = (user: any) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  avatarUrl: user.avatarUrl,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  teams:
    user.teamMemberships?.map((membership: any) => ({
      teamId: membership.team.id,
      teamName: membership.team.name,
      role: membership.role,
    })) || [],
});

// List all users (for admin/team views)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = getPrismaClient();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        phone: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    return next(error);
  }
});

router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw new HttpError(400, 'userId is required to fetch profile', 'USER_REQUIRED');
    }

    const user = await userRepository.getUserById(userId);
    if (!user) {
      throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: {
        user: formatUser(user),
      },
    });
  } catch (error) {
    logger.error('Error fetching user profile', error);
    handleError(error, res, next);
  }
});

router.put('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = profileUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      throw new HttpError(400, validation.error.issues[0]?.message || 'Invalid payload', 'VALIDATION_ERROR');
    }

    const userId = validation.data.userId || getUserIdFromRequest(req);
    if (!userId) {
      throw new HttpError(400, 'userId is required to update profile', 'USER_REQUIRED');
    }

    const updated = await userRepository.updateUser(userId, {
      firstName: validation.data.firstName,
      lastName: validation.data.lastName,
      avatarUrl: validation.data.avatarUrl,
    });

    const user = await userRepository.getUserById(updated.id);

    if (!user) {
      throw new HttpError(404, 'User not found after update', 'USER_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: {
        user: formatUser(user),
      },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    logger.error('Error updating profile', error);
    handleError(error, res, next);
  }
});

router.post('/change-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      throw new HttpError(400, validation.error.issues[0]?.message || 'Invalid payload', 'VALIDATION_ERROR');
    }

    const userId = validation.data.userId || getUserIdFromRequest(req);
    if (!userId) {
      throw new HttpError(400, 'userId is required to change password', 'USER_REQUIRED');
    }

    const user = await userRepository.getUserById(userId);
    if (!user) {
      throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const isValid = await userRepository.verifyPassword(user, validation.data.currentPassword);
    if (!isValid) {
      throw new HttpError(401, 'Current password is incorrect', 'INVALID_PASSWORD');
    }

    await userRepository.updatePassword(userId, validation.data.newPassword);

    res.status(200).json({
      success: true,
      data: {},
      message: 'Password updated successfully',
    });
  } catch (error) {
    logger.error('Error changing password', error);
    handleError(error, res, next);
  }
});

router.post('/avatar', avatarUpload.single('avatar'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw new HttpError(400, 'userId is required to update avatar', 'USER_REQUIRED');
    }

    let avatarUrl: string;

    if (req.file) {
      // Handle FormData file upload from frontend
      avatarUrl = `/uploads/avatars/${req.file.filename}`;
    } else if (req.body?.avatarUrl) {
      // Handle JSON body with avatarUrl string
      const validation = avatarSchema.safeParse(req.body);
      if (!validation.success) {
        throw new HttpError(400, validation.error.issues[0]?.message || 'Invalid payload', 'VALIDATION_ERROR');
      }
      avatarUrl = validation.data.avatarUrl;
    } else {
      throw new HttpError(400, 'Either a file upload or avatarUrl is required', 'VALIDATION_ERROR');
    }

    await userRepository.updateUser(userId, { avatarUrl });
    const user = await userRepository.getUserById(userId);

    if (!user) {
      throw new HttpError(404, 'User not found after avatar update', 'USER_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: {
        avatarUrl,
        user: formatUser(user),
      },
      message: 'Avatar updated successfully',
    });
  } catch (error) {
    logger.error('Error updating avatar', error);
    handleError(error, res, next);
  }
});

router.get('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw new HttpError(400, 'userId is required to list API keys', 'USER_REQUIRED');
    }

    const apiKeys = await userRepository.getUserApiKeys(userId);

    res.status(200).json({
      success: true,
      data: {
        apiKeys: apiKeys.map((key) => ({
          id: key.id,
          name: key.name,
          key: '',
          teamId: key.teamId,
          scopes: (key as any).scopes || [],
          lastUsed: key.lastUsedAt?.toISOString() || undefined,
          lastUsedAt: key.lastUsedAt,
          expiresAt: key.expiresAt,
          createdAt: key.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching user API keys', error);
    handleError(error, res, next);
  }
});

router.post('/api-keys', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = createUserApiKeySchema.safeParse(req.body);
    if (!validation.success) {
      throw new HttpError(400, validation.error.issues[0]?.message || 'Invalid payload', 'VALIDATION_ERROR');
    }

    const userId = validation.data.userId || getUserIdFromRequest(req);
    if (!userId) {
      throw new HttpError(400, 'userId is required to create API key', 'USER_REQUIRED');
    }

    const scopes = validation.data.scopes || [];

    const apiKey = await userRepository.generateApiKey(
      userId,
      validation.data.name,
      validation.data.teamId,
      validation.data.expiresAt ? new Date(validation.data.expiresAt) : undefined,
    );

    const fullKey = `sk_${Date.now()}_${Math.random().toString(36).substring(2, 24)}`;

    res.status(201).json({
      success: true,
      data: {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key: fullKey,
          teamId: apiKey.teamId,
          scopes,
          lastUsedAt: apiKey.lastUsedAt,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
      },
      message: 'API key created successfully',
    });
  } catch (error) {
    logger.error('Error creating user API key', error);
    handleError(error, res, next);
  }
});

router.delete('/api-keys/:keyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await userRepository.deleteApiKey(req.params.keyId);
    res.status(200).json({
      success: true,
      data: {},
      message: 'API key deleted',
    });
  } catch (error) {
    logger.error(`Error deleting API key ${req.params.keyId}`, error);
    handleError(error, res, next);
  }
});

router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw new HttpError(400, 'userId is required to list sessions', 'USER_REQUIRED');
    }

    const sessions = await userRepository.getUserSessions(userId);

    // Parse user agent into device/browser/os for frontend
    const parseUserAgent = (ua?: string | null) => {
      if (!ua) return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };
      const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)[\/\s]?([\d.]+)?/i)?.[1] || 'Unknown';
      const os = ua.match(/(Windows|Mac OS X|Linux|Android|iOS|iPhone)[\/\s]?([\d._]+)?/i)?.[1] || 'Unknown';
      const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop';
      return { device, browser, os };
    };

    // Determine current session from auth header
    const currentToken = req.headers.authorization?.replace('Bearer ', '') || '';

    res.status(200).json({
      success: true,
      data: {
        sessions: sessions.map((session) => {
          const parsed = parseUserAgent(session.userAgent);
          return {
            id: session.id,
            device: parsed.device,
            browser: parsed.browser,
            os: parsed.os,
            ipAddress: session.ipAddress || '',
            userAgent: session.userAgent,
            createdAt: session.createdAt,
            lastActive: session.accessTokenExpiresAt || session.createdAt,
            current: false,
          };
        }),
      },
    });
  } catch (error) {
    logger.error('Error fetching user sessions', error);
    handleError(error, res, next);
  }
});

router.delete('/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await userRepository.deleteSession(req.params.sessionId);
    res.status(200).json({
      success: true,
      data: {},
      message: 'Session revoked successfully',
    });
  } catch (error) {
    logger.error(`Error deleting session ${req.params.sessionId}`, error);
    handleError(error, res, next);
  }
});

router.post('/sessions/revoke-others', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      throw new HttpError(400, 'userId is required to revoke sessions', 'USER_REQUIRED');
    }

    const keepSessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined;
    const count = await userRepository.deleteOtherSessions(userId, keepSessionId);

    res.status(200).json({
      success: true,
      data: {
        revoked: count,
      },
      message: 'Other sessions revoked successfully',
    });
  } catch (error) {
    logger.error('Error revoking sessions', error);
    handleError(error, res, next);
  }
});

export default router;
