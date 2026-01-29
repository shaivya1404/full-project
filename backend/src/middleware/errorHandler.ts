import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ErrorResponse {
  message: string;
  error?: string;
  code?: string;
}

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message, err);

  const statusCode = (err as any).statusCode || 500;
  const errorResponse: ErrorResponse = {
    message: err.message || 'Internal Server Error',
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = err.message;
  }

  if ((err as any).code) {
    errorResponse.code = (err as any).code;
  }

  res.status(statusCode).json(errorResponse);
};
