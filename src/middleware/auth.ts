import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

const DEMO_TOKEN_SECRET = 'demo-secret-key';

interface StoredUser {
  id: string;
  email: string;
  password: string;
}

const users: Map<string, StoredUser> = new Map();
const tokens: Map<string, { userId: string; email: string; expiresAt: number }> = new Map();

export const registerUser = (email: string, password: string): StoredUser => {
  const existingUser = Array.from(users.values()).find((u) => u.email === email);
  if (existingUser) {
    throw new Error('User already exists');
  }

  const id = `user_${Date.now()}`;
  const user: StoredUser = { id, email, password };
  users.set(id, user);
  return user;
};

export const authenticateUser = (email: string, password: string): StoredUser | null => {
  const user = Array.from(users.values()).find((u) => u.email === email && u.password === password);
  return user || null;
};

export const generateToken = (userId: string, email: string): string => {
  const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  tokens.set(token, { userId, email, expiresAt });
  return token;
};

export const validateToken = (token: string): { userId: string; email: string } | null => {
  const tokenData = tokens.get(token);
  if (!tokenData) {
    return null;
  }

  if (tokenData.expiresAt < Date.now()) {
    tokens.delete(token);
    return null;
  }

  return { userId: tokenData.userId, email: tokenData.email };
};

export const revokeToken = (token: string): void => {
  tokens.delete(token);
};

export const getCurrentUser = (token: string): StoredUser | null => {
  const tokenData = validateToken(token);
  if (!tokenData) {
    return null;
  }

  return users.get(tokenData.userId) || null;
};

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token =
    req.headers.authorization?.replace('Bearer ', '') || (req.headers['x-api-token'] as string);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing authentication token',
    });
    return;
  }

  const tokenData = validateToken(token);
  if (!tokenData) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
    return;
  }

  const user = users.get(tokenData.userId);
  if (!user) {
    res.status(401).json({
      success: false,
      error: 'User not found',
    });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
  };

  next();
};
