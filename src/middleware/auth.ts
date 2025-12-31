import { Request, Response, NextFunction } from 'express';
import { getUserRepository } from '../db/repositories/userRepository';
import { logger } from '../utils/logger';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLoginAt?: Date | null;
}

export interface AuthenticatedSession {
  id: string;
  userId: string;
  accessToken: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  session?: AuthenticatedSession;
  teamId?: string;
  teamRole?: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

const getTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return (req.headers['x-api-token'] as string) || null;
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = getTokenFromHeader(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing authentication token',
      code: 'MISSING_TOKEN',
    } as ErrorResponse);
    return;
  }

  const userRepo = getUserRepository();
  const decoded = userRepo.decodeToken(token);

  if (!decoded) {
    res.status(401).json({
      success: false,
      error: 'Invalid token format',
      code: 'INVALID_TOKEN',
    } as ErrorResponse);
    return;
  }

  const session = await userRepo.getSessionByAccessToken(token);

  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Session not found or expired',
      code: 'SESSION_NOT_FOUND',
    } as ErrorResponse);
    return;
  }

  if (session.accessTokenExpiresAt < new Date()) {
    await userRepo.deleteSession(session.id);
    res.status(401).json({
      success: false,
      error: 'Access token expired',
      code: 'TOKEN_EXPIRED',
    } as ErrorResponse);
    return;
  }

  if (!session.user.isActive) {
    res.status(401).json({
      success: false,
      error: 'User account is deactivated',
      code: 'USER_INACTIVE',
    } as ErrorResponse);
    return;
  }

  req.user = {
    id: session.user.id,
    email: session.user.email,
    firstName: session.user.firstName || undefined,
    lastName: session.user.lastName || undefined,
    isActive: session.user.isActive,
    lastLoginAt: session.user.lastLoginAt,
  };

  req.session = {
    id: session.id,
    userId: session.user.id,
    accessToken: session.accessToken,
  };

  next();
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = getTokenFromHeader(req);

  if (!token) {
    return next();
  }

  try {
    const userRepo = getUserRepository();
    const decoded = userRepo.decodeToken(token);

    if (!decoded) {
      return next();
    }

    const session = await userRepo.getSessionByAccessToken(token);

    if (!session) {
      return next();
    }

    if (session.accessTokenExpiresAt < new Date()) {
      return next();
    }

    if (!session.user.isActive) {
      return next();
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName || undefined,
      lastName: session.user.lastName || undefined,
      isActive: session.user.isActive,
      lastLoginAt: session.user.lastLoginAt,
    };

    req.session = {
      id: session.id,
      userId: session.user.id,
      accessToken: session.accessToken,
    };
  } catch (error) {
    logger.error('Error in optional auth', error);
  }

  next();
};

export const authenticateApiKey = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'Missing API key',
      code: 'MISSING_API_KEY',
    } as ErrorResponse);
    return;
  }

  const userRepo = getUserRepository();
  const keyData = await userRepo.validateApiKey(apiKey);

  if (!keyData) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired API key',
      code: 'INVALID_API_KEY',
    } as ErrorResponse);
    return;
  }

  await userRepo.updateApiKeyLastUsed(keyData.id);

  req.user = {
    id: keyData.user.id,
    email: keyData.user.email,
    firstName: keyData.user.firstName || undefined,
    lastName: keyData.user.lastName || undefined,
    isActive: keyData.user.isActive,
    lastLoginAt: keyData.user.lastLoginAt,
  };

  if (keyData.teamId) {
    req.teamId = keyData.teamId;
  }

  next();
};

export const authenticateWithTokenOrKey = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;

  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  return authenticate(req, res, next);
};

// Export alias for authMiddleware compatibility
export const authMiddleware = authenticateWithTokenOrKey;
