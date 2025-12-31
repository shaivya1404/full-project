import { Router, Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const getOrderService = () => new OrderService();

interface ErrorResponse {
  message: string;
  code?: string;
}

// GET /api/analytics/top-items - Most ordered items
router.get('/top-items', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    const topItems = await orderService.getTopItems(limit, teamId);

    res.status(200).json({
      data: topItems,
      total: topItems.length,
    });
  } catch (error) {
    logger.error('Error fetching top items', error);
    next(error);
  }
});

// GET /api/analytics/order-trends - Order trends by date
router.get('/order-trends', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const { startDate, endDate } = req.query;

    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    const start = startDate 
      ? new Date(startDate as string) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate 
      ? new Date(endDate as string) 
      : new Date();

    const trends = await orderService.getOrderTrends(start, end, teamId);

    res.status(200).json({
      data: trends,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching order trends', error);
    next(error);
  }
});

// GET /api/analytics/orders - Order statistics
router.get('/orders', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    
    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    const stats = await orderService.getOrderStats(teamId);

    res.status(200).json({
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching order stats', error);
    next(error);
  }
});

// GET /api/analytics/frequent-customers - Most frequent customers
router.get('/frequent-customers', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit as string) || 10, 1), 50);

    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    const orderService = getOrderService();
    const stats = await orderService.getOrderStats(teamId);

    res.status(200).json({
      data: stats.frequentCustomers.slice(0, limitNum),
    });
  } catch (error) {
    logger.error('Error fetching frequent customers', error);
    next(error);
  }
});

export default router;
