import morgan from 'morgan';
import { logger } from '../utils/logger';

const stream = {
  write: (message: string) => logger.http(message.trim()),
};

const skip = (req: any) => {
  // Always log in development. In production, skip noisy health checks
  // but keep all real API/webhook requests visible.
  if ((process.env.NODE_ENV || 'development') === 'development') return false;
  return req.url === '/health' || req.url.startsWith('/health/');
};

export const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream, skip },
);
