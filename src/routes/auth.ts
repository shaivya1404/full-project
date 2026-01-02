import { Router, Response, NextFunction } from 'express';
import { getUserRepository } from '../db/repositories/userRepository';
import { getTeamRepository } from '../db/repositories/teamRepository';
import { authenticate } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
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

function getZodErrorMessage(error: any): string {
  if (error && typeof error === 'object') {
    const issues = error.issues || error.errors;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues[0]?.message || 'Validation error';
    }
  }
  return 'Validation error';
}

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

router.post('/register', authRateLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validationResult = registerSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { email, password, firstName, lastName } = validationResult.data;

    const userRepo = getUserRepository();
    const existingUser = await userRepo.getUserByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
      } as ErrorResponse);
    }

    const user = await userRepo.createUser({
      email,
      password,
      firstName,
      lastName,
    });

    const accessTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const accessToken = userRepo.generateAccessToken(user.id, user.email, 'registration');
    const refreshToken = userRepo.generateRefreshToken(user.id, 'registration');

    await userRepo.createSession(
      user.id,
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry,
      req.ip || undefined,
      req.headers['user-agent'] || undefined,
    );

    await userRepo.updateLastLogin(user.id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
        },
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
      message: 'Registration successful',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error registering user', error);
    next(error);
  }
});

router.post('/login', authRateLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    console.log(validationResult, "validationResult");
    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { email, password } = validationResult.data;
    console.log(email, password, "email, password");

    const userRepo = getUserRepository();
    const user = await userRepo.getUserByEmail(email);
    console.log(user, "user");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      } as ErrorResponse);
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
        code: 'ACCOUNT_INACTIVE',
      } as ErrorResponse);
    }

    const isValid = await userRepo.verifyPassword(user, password);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      } as ErrorResponse);
    }

    const accessTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const accessToken = userRepo.generateAccessToken(user.id, user.email, user.id);
    const refreshToken = userRepo.generateRefreshToken(user.id, user.id);

    await userRepo.createSession(
      user.id,
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry,
      req.ip || undefined,
      req.headers['user-agent'] || undefined,
    );

    await userRepo.updateLastLogin(user.id);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          lastLoginAt: user.lastLoginAt,
          avatarUrl: user.avatarUrl,
        },
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
      message: 'Login successful',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error logging in', error);
    next(error);
  }
});

router.post('/refresh', authRateLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validationResult = refreshSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { refreshToken } = validationResult.data;

    const userRepo = getUserRepository();
    const session = await userRepo.getSessionByRefreshToken(refreshToken);

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      } as ErrorResponse);
    }

    if (session.refreshTokenExpiresAt < new Date()) {
      await userRepo.deleteSession(session.id);
      return res.status(401).json({
        success: false,
        error: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED',
      } as ErrorResponse);
    }

    if (!session.user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated',
        code: 'ACCOUNT_INACTIVE',
      } as ErrorResponse);
    }

    const newAccessTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
    const newAccessToken = userRepo.generateAccessToken(
      session.user.id,
      session.user.email,
      session.id,
    );

    await userRepo.createSession(
      session.user.id,
      newAccessToken,
      session.refreshToken,
      newAccessTokenExpiry,
      session.refreshTokenExpiresAt,
      session.ipAddress || undefined,
      session.userAgent || undefined,
    );

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        expiresIn: 900,
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error refreshing token', error);
    next(error);
  }
});

router.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = getUserRepository();

    if (req.session) {
      await userRepo.deleteSession(req.session.id);
    }

    res.status(200).json({
      success: true,
      data: {},
      message: 'Logout successful',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error logging out', error);
    next(error);
  }
});

router.post('/logout-all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = getUserRepository();

    if (req.user) {
      await userRepo.deleteAllUserSessions(req.user.id);
    }

    res.status(200).json({
      success: true,
      data: {},
      message: 'Logged out from all devices',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error logging out from all devices', error);
    next(error);
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = getUserRepository();
    const user = await userRepo.getUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      } as ErrorResponse);
    }

    const teams = user.teamMemberships?.map((membership) => ({
      teamId: membership.team.id,
      teamName: membership.team.name,
      role: membership.role,
    })) || [];

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          avatarUrl: user.avatarUrl,
        },
        teams,
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error fetching current user', error);
    next(error);
  }
});

router.get('/sessions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = getUserRepository();
    const sessions = await userRepo.getUserSessions(req.user!.id);

    res.status(200).json({
      success: true,
      data: {
        sessions: sessions.map((session) => ({
          id: session.id,
          accessTokenExpiresAt: session.accessTokenExpiresAt,
          refreshTokenExpiresAt: session.refreshTokenExpiresAt,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          isCurrent: req.session ? session.id === req.session.id : false,
        })),
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error fetching sessions', error);
    next(error);
  }
});

router.delete('/sessions/:sessionId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userRepo = getUserRepository();

    if (req.session && req.params.sessionId === req.session.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete current session',
        code: 'CANNOT_DELETE_CURRENT_SESSION',
      } as ErrorResponse);
    }

    await userRepo.deleteSession(req.params.sessionId);

    res.status(200).json({
      success: true,
      data: {},
      message: 'Session deleted',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error deleting session', error);
    next(error);
  }
});

router.put('/password', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validationResult = changePasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { currentPassword, newPassword } = validationResult.data;

    const userRepo = getUserRepository();
    const user = await userRepo.getUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      } as ErrorResponse);
    }

    const isValid = await userRepo.verifyPassword(user, currentPassword);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
        code: 'INVALID_PASSWORD',
      } as ErrorResponse);
    }

    await userRepo.updatePassword(user.id, newPassword);
    await userRepo.deleteAllUserSessions(user.id);

    res.status(200).json({
      success: true,
      data: {},
      message: 'Password changed successfully. Please log in again.',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error changing password', error);
    next(error);
  }
});

export default router;
