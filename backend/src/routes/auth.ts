import { Router, Response, NextFunction } from 'express';
import { getUserRepository } from '../db/repositories/userRepository';
import { getTeamRepository } from '../db/repositories/teamRepository';
import { authenticate } from '../middleware/auth';
import { authRateLimiter, strictRateLimiter } from '../middleware/rateLimiter';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { prisma } from '../db/client';
import { notificationService } from '../services/notificationService';
import { config } from '../config/env';
import crypto from 'crypto';
import { authenticator } from 'otplib';

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
    if (!validationResult.success) {
      const errorMessage = getZodErrorMessage(validationResult.error);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { email, password } = validationResult.data;

    const userRepo = getUserRepository();
    const user = await userRepo.getUserByEmail(email);

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

// ==================== PASSWORD RESET ====================

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  code: z.string().length(6, 'Code must be 6 digits').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/forgot-password', strictRateLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validationResult = forgotPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: getZodErrorMessage(validationResult.error),
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { email } = validationResult.data;
    const userRepo = getUserRepository();
    const user = await userRepo.getUserByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      } as SuccessResponse);
    }

    // Generate reset token and code
    const token = crypto.randomBytes(32).toString('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        code,
        expiresAt,
      },
    });

    // Send email
    await notificationService.sendNotification({
      type: 'password_reset',
      recipientEmail: user.email,
      recipientPhone: user.phone || undefined,
      data: {
        token,
        code,
        firstName: user.firstName || 'User',
      },
    });

    logger.info('Password reset requested', { email });

    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error in forgot password', error);
    next(error);
  }
});

router.post('/reset-password', strictRateLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: getZodErrorMessage(validationResult.error),
        code: 'VALIDATION_ERROR',
      } as ErrorResponse);
    }

    const { token, code, password } = validationResult.data;

    // Find valid reset token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      include: { user: true },
    });

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN',
      } as ErrorResponse);
    }

    // Verify code if provided
    if (code && resetToken.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reset code',
        code: 'INVALID_CODE',
      } as ErrorResponse);
    }

    // Update password
    const userRepo = getUserRepository();
    await userRepo.updatePassword(resetToken.userId, password);

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    // Invalidate all sessions
    await userRepo.deleteAllUserSessions(resetToken.userId);

    // Reset failed login attempts
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    logger.info('Password reset completed', { userId: resetToken.userId });

    res.status(200).json({
      success: true,
      message: 'Password has been reset. Please log in with your new password.',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error in reset password', error);
    next(error);
  }
});

// ==================== EMAIL VERIFICATION ====================

router.post('/send-verification', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      } as ErrorResponse);
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email already verified',
        code: 'ALREADY_VERIFIED',
      } as ErrorResponse);
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send verification email
    await notificationService.sendNotification({
      type: 'email_verification',
      recipientEmail: user.email,
      data: {
        token,
        firstName: user.firstName || 'User',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Verification email sent',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error sending verification email', error);
    next(error);
  }
});

router.post('/verify-email', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
        code: 'MISSING_TOKEN',
      } as ErrorResponse);
    }

    const verificationToken = await prisma.emailVerificationToken.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
        verifiedAt: null,
      },
    });

    if (!verificationToken) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN',
      } as ErrorResponse);
    }

    // Mark user as verified
    await prisma.user.update({
      where: { id: verificationToken.userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Mark token as used
    await prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { verifiedAt: new Date() },
    });

    logger.info('Email verified', { userId: verificationToken.userId });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error verifying email', error);
    next(error);
  }
});

// ==================== TWO-FACTOR AUTHENTICATION ====================

router.post('/2fa/setup', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { twoFactorAuth: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      } as ErrorResponse);
    }

    if (user.twoFactorAuth?.enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled',
        code: 'ALREADY_ENABLED',
      } as ErrorResponse);
    }

    // Generate secret
    const secret = authenticator.generateSecret();

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Store or update 2FA record
    await prisma.twoFactorAuth.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        secret,
        backupCodes: JSON.stringify(backupCodes),
        enabled: false,
      },
      update: {
        secret,
        backupCodes: JSON.stringify(backupCodes),
        enabled: false,
      },
    });

    // Generate QR code URL
    const otpauthUrl = authenticator.keyuri(user.email, config.COMPANY_NAME, secret);

    res.status(200).json({
      success: true,
      data: {
        secret,
        otpauthUrl,
        backupCodes,
      },
      message: 'Scan the QR code with your authenticator app, then verify with a code.',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error setting up 2FA', error);
    next(error);
  }
});

router.post('/2fa/verify', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is required',
        code: 'MISSING_CODE',
      } as ErrorResponse);
    }

    const twoFactorAuth = await prisma.twoFactorAuth.findUnique({
      where: { userId: req.user!.id },
    });

    if (!twoFactorAuth) {
      return res.status(400).json({
        success: false,
        error: '2FA not set up. Please run setup first.',
        code: 'NOT_SETUP',
      } as ErrorResponse);
    }

    // Verify the code
    const isValid = authenticator.verify({ token: code, secret: twoFactorAuth.secret });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code',
        code: 'INVALID_CODE',
      } as ErrorResponse);
    }

    // Enable 2FA
    await prisma.twoFactorAuth.update({
      where: { userId: req.user!.id },
      data: { enabled: true },
    });

    logger.info('2FA enabled', { userId: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error verifying 2FA', error);
    next(error);
  }
});

router.post('/2fa/disable', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required to disable 2FA',
        code: 'MISSING_PASSWORD',
      } as ErrorResponse);
    }

    const userRepo = getUserRepository();
    const user = await userRepo.getUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      } as ErrorResponse);
    }

    // Verify password
    const isValid = await userRepo.verifyPassword(user, password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
        code: 'INVALID_PASSWORD',
      } as ErrorResponse);
    }

    const twoFactorAuth = await prisma.twoFactorAuth.findUnique({
      where: { userId: req.user!.id },
    });

    if (!twoFactorAuth || !twoFactorAuth.enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled',
        code: 'NOT_ENABLED',
      } as ErrorResponse);
    }

    // Verify code if provided
    if (code) {
      const codeValid = authenticator.verify({ token: code, secret: twoFactorAuth.secret });
      if (!codeValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid verification code',
          code: 'INVALID_CODE',
        } as ErrorResponse);
      }
    }

    // Disable 2FA
    await prisma.twoFactorAuth.delete({
      where: { userId: req.user!.id },
    });

    logger.info('2FA disabled', { userId: req.user!.id });

    res.status(200).json({
      success: true,
      message: 'Two-factor authentication disabled',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error disabling 2FA', error);
    next(error);
  }
});

router.get('/2fa/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const twoFactorAuth = await prisma.twoFactorAuth.findUnique({
      where: { userId: req.user!.id },
    });

    res.status(200).json({
      success: true,
      data: {
        enabled: twoFactorAuth?.enabled || false,
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error getting 2FA status', error);
    next(error);
  }
});

export default router;
