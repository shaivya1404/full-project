import { Router, Request, Response, NextFunction } from 'express';
import { CallRepository } from '../db/repositories/callRepository';
import { logger } from '../utils/logger';

const router = Router();

let callRepository: CallRepository;

const getRepository = () => {
  if (!callRepository) {
    callRepository = new CallRepository();
  }
  return callRepository;
};

interface ErrorResponse {
  message: string;
  error?: string;
  code?: string;
}

// GET /api/analytics - Get analytics aggregates and timeseries
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (req.query.startDate && typeof req.query.startDate === 'string') {
      const date = new Date(req.query.startDate);
      if (!isNaN(date.getTime())) {
        startDate = date;
      }
    }

    if (req.query.endDate && typeof req.query.endDate === 'string') {
      const date = new Date(req.query.endDate);
      if (!isNaN(date.getTime())) {
        endDate = date;
      }
    }

    const interval = (req.query.interval as 'hour' | 'day' | 'week') || 'day';
    if (!['hour', 'day', 'week'].includes(interval)) {
      return res.status(400).json({
        message: 'Invalid interval. Must be one of: hour, day, week',
        code: 'INVALID_INTERVAL',
      } as ErrorResponse);
    }

    const filters = { startDate, endDate };
    const repo = getRepository();

    const [aggregates, timeSeries] = await Promise.all([
      repo.getAnalyticsAggregate(filters),
      repo.getAnalyticsTimeSeries(interval, filters),
    ]);

    res.status(200).json({
      data: {
        aggregates,
        timeSeries,
      },
    });
  } catch (error) {
    logger.error('Error fetching analytics', error);
    next(error);
  }
});

export default router;
