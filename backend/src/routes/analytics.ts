import { Router, Request, Response, NextFunction } from 'express';
import { CallRepository } from '../db/repositories/callRepository';
import { AnalyticsService } from '../services/analyticsService';
import { CallAnalyticsService } from '../services/callAnalyticsService';
import { logger } from '../utils/logger';

const router = Router();

let callRepository: CallRepository;
let analyticsService: AnalyticsService;
let callAnalyticsService: CallAnalyticsService;

const getRepository = () => {
  if (!callRepository) {
    callRepository = new CallRepository();
  }
  return callRepository;
};

const getAnalyticsService = () => {
  if (!analyticsService) {
    analyticsService = new AnalyticsService();
  }
  return analyticsService;
};

const getCallAnalyticsService = () => {
  if (!callAnalyticsService) {
    callAnalyticsService = new CallAnalyticsService();
  }
  return callAnalyticsService;
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

// GET /api/analytics/calls - Get comprehensive call analytics
router.get('/calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters: { teamId?: string; startDate?: Date; endDate?: Date; campaignId?: string } = {};

    if (req.query.teamId && typeof req.query.teamId === 'string') {
      filters.teamId = req.query.teamId;
    }

    if (req.query.startDate && typeof req.query.startDate === 'string') {
      const date = new Date(req.query.startDate);
      if (!isNaN(date.getTime())) {
        filters.startDate = date;
      } else {
        return res.status(400).json({
          message: 'Invalid startDate format. Use YYYY-MM-DD',
          code: 'INVALID_DATE',
        } as ErrorResponse);
      }
    }

    if (req.query.endDate && typeof req.query.endDate === 'string') {
      const date = new Date(req.query.endDate);
      if (!isNaN(date.getTime())) {
        filters.endDate = date;
      } else {
        return res.status(400).json({
          message: 'Invalid endDate format. Use YYYY-MM-DD',
          code: 'INVALID_DATE',
        } as ErrorResponse);
      }
    }

    if (req.query.campaignId && typeof req.query.campaignId === 'string') {
      filters.campaignId = req.query.campaignId;
    }

    const service = getCallAnalyticsService();
    const analytics = await service.getCallAnalytics(filters);

    res.status(200).json({
      success: true,
      data: analytics,
      message: 'Call analytics retrieved successfully',
    });
  } catch (error) {
    logger.error('Error fetching call analytics', error);
    next(error);
  }
});

// GET /api/analytics/summary - Get summary analytics
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = getRepository();
    const service = getAnalyticsService();
    
    const [aggregates, newSummary] = await Promise.all([
      repo.getAnalyticsAggregate(),
      service.getAnalyticsSummary()
    ]);

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
        ...newSummary
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

// GET /api/analytics/faqs - List top FAQs
router.get('/faqs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAnalyticsService();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const faqs = await service.getTopFAQs(limit);
    res.status(200).json({ data: faqs });
  } catch (error) {
    logger.error('Error fetching FAQs', error);
    next(error);
  }
});

// GET /api/analytics/unanswered - Unanswered questions
router.get('/unanswered', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAnalyticsService();
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const unanswered = await service.getTopUnansweredQuestions(limit);
    res.status(200).json({ data: unanswered });
  } catch (error) {
    logger.error('Error fetching unanswered questions', error);
    next(error);
  }
});

// GET /api/analytics/topics - Topic breakdown
router.get('/topics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAnalyticsService();
    const topics = await service.getTopicBreakdown();
    res.status(200).json({ data: topics });
  } catch (error) {
    logger.error('Error fetching topic breakdown', error);
    next(error);
  }
});

// GET /api/analytics/campaigns/:id - Campaign performance
router.get('/campaigns/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAnalyticsService();
    const performance = await service.getCampaignPerformance(req.params.id);
    if (!performance) {
      return res.status(404).json({ message: 'Campaign analytics not found' });
    }
    res.status(200).json({ data: performance });
  } catch (error) {
    logger.error('Error fetching campaign performance', error);
    next(error);
  }
});

// POST /api/analytics/report - Generate report
router.post('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAnalyticsService();
    const format = req.body.format || 'csv';
    
    if (format === 'csv') {
      const csv = await service.generateCSVReport();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-report.csv');
      return res.status(200).send(csv);
    }
    
    res.status(400).json({ message: 'Unsupported format. Only csv is supported for now.' });
  } catch (error) {
    logger.error('Error generating report', error);
    next(error);
  }
});

// POST /api/analytics/process - Trigger transcript analysis
router.post('/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getAnalyticsService();
    await service.processAllTranscripts();
    res.status(200).json({ message: 'Analytics processing completed' });
  } catch (error) {
    logger.error('Error processing analytics', error);
    next(error);
  }
});

export default router;
