import { Router, Request, Response, NextFunction } from 'express';
import {
  registerUser,
  authenticateUser,
  generateToken,
  validateToken,
  revokeToken,
  getCurrentUser,
  authMiddleware,
  AuthRequest,
} from '../middleware/auth';
import { logger } from '../utils/logger';

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

// POST /api/auth/register - Register a new user
router.post('/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email is required and must be a string',
        code: 'INVALID_EMAIL',
      } as ErrorResponse);
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Password is required and must be a string',
        code: 'INVALID_PASSWORD',
      } as ErrorResponse);
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
        code: 'PASSWORD_TOO_SHORT',
      } as ErrorResponse);
    }

    const user = registerUser(email, password);
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        token,
      },
      message: 'User registered successfully',
    } as SuccessResponse);
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists') {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        code: 'USER_EXISTS',
      } as ErrorResponse);
    }

    logger.error('Error registering user', error);
    next(error);
  }
});

// POST /api/auth/login - Login user
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email is required and must be a string',
        code: 'INVALID_EMAIL',
      } as ErrorResponse);
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Password is required and must be a string',
        code: 'INVALID_PASSWORD',
      } as ErrorResponse);
    }

    const user = authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      } as ErrorResponse);
    }

    const token = generateToken(user.id, user.email);

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        token,
      },
      message: 'Login successful',
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error logging in', error);
    next(error);
  }
});

// POST /api/auth/logout - Logout user
router.post('/logout', authMiddleware, (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token =
      req.headers.authorization?.replace('Bearer ', '') || (req.headers['x-api-token'] as string);

    if (token) {
      revokeToken(token);
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

// GET /api/auth/me - Get current user
router.get('/me', authMiddleware, (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token =
      req.headers.authorization?.replace('Bearer ', '') || (req.headers['x-api-token'] as string);
    const user = getCurrentUser(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      } as ErrorResponse);
    }

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
      },
    } as SuccessResponse);
  } catch (error) {
    logger.error('Error fetching current user', error);
    next(error);
  }
});

export default router;
