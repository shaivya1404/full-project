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

// GET /api/analytics/summary - Get summary analytics
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const aggregates = await repo.getAnalyticsAggregate();

    const totalCalls = aggregates.totalCalls;
    const averageDuration = aggregates.averageDuration || 0;
    const completedCalls = aggregates.callsByStatus['completed'] || 0;
    const successRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;

    res.status(200).json({
      data: {
        totalCalls,
        averageDuration,
        completedCalls,
        failedCalls: aggregates.callsByStatus['failed'] || 0,
        activeCalls: aggregates.callsByStatus['active'] || 0,
        successRate: Math.round(successRate * 100) / 100,
      },
    });
  } catch (error) {
    logger.error('Error fetching analytics summary', error);
    next(error);
  }
});

// GET /api/analytics/daily - Get daily analytics
router.get('/daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const timeSeries = await repo.getAnalyticsTimeSeries('day');

    const dailyStats = timeSeries.map((ts) => ({
      date: ts.timestamp,
      callCount: ts.callCount,
      averageDuration: ts.averageDuration || 0,
    }));

    res.status(200).json({
      data: dailyStats,
    });
  } catch (error) {
    logger.error('Error fetching daily analytics', error);
    next(error);
  }
});

// GET /api/analytics/sentiment - Get sentiment analytics
router.get('/sentiment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const aggregates = await repo.getAnalyticsAggregate();

    res.status(200).json({
      data: aggregates.sentimentBreakdown,
    });
  } catch (error) {
    logger.error('Error fetching sentiment analytics', error);
    next(error);
  }
});

// GET /api/analytics/peak-hours - Get peak hours analytics
router.get('/peak-hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const timeSeries = await repo.getAnalyticsTimeSeries('hour');

    const peakHours = timeSeries
      .map((ts) => ({
        hour: ts.timestamp,
        callCount: ts.callCount,
      }))
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 10);

    res.status(200).json({
      data: peakHours,
    });
  } catch (error) {
    logger.error('Error fetching peak hours analytics', error);
    next(error);
  }
});

// GET /api/analytics/call-duration - Get call duration trends
router.get('/call-duration', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const timeSeries = await repo.getAnalyticsTimeSeries('day');

    const durationTrends = timeSeries.map((ts) => ({
      date: ts.timestamp,
      averageDuration: ts.averageDuration || 0,
    }));

    res.status(200).json({
      data: durationTrends,
    });
  } catch (error) {
    logger.error('Error fetching call duration trends', error);
    next(error);
  }
});

export default router;
