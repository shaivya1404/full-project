import { Router, Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

const getOrderService = () => new OrderService();

interface PaginationParams {
  limit: number;
  offset: number;
}

const getPaginationParams = (req: Request): PaginationParams => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  return { limit, offset };
};

interface ErrorResponse {
  message: string;
  code?: string;
}

// POST /api/orders - Create new order
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    
    const { 
      items, 
      deliveryAddress, 
      phone, 
      email, 
      customerName, 
      notes, 
      specialInstructions,
      campaignId,
      callId,
      validateOnly 
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'Order items are required',
        code: 'ITEMS_REQUIRED',
      } as ErrorResponse);
    }

    // Get teamId from authenticated user or header
    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    const result = await orderService.createOrder({
      teamId,
      campaignId,
      callId,
      items,
      deliveryAddress,
      phone,
      email,
      customerName,
      notes,
      specialInstructions,
      validateOnly,
    });

    if (!result.order) {
      return res.status(400).json({
        message: 'Order validation failed',
        errors: result.validation.errors,
        warnings: result.validation.warnings,
        code: 'VALIDATION_FAILED',
      });
    }

    if (result.duplicateWarning) {
      return res.status(201).json({
        data: result.order,
        warning: result.duplicateWarning,
        message: 'Order created (potential duplicate)',
      });
    }

    logger.info(`Order created: ${result.order.orderNumber}`);

    res.status(201).json({
      data: result.order,
    });
  } catch (error) {
    logger.error('Error creating order', error);
    next(error);
  }
});

// GET /api/orders - List orders
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const { limit, offset } = getPaginationParams(req);
    const { customerId, status, campaignId, startDate, endDate } = req.query;

    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    const { orders, total } = await orderService.searchOrders({
      limit,
      offset,
      customerId: customerId as string,
      status: status as string,
      campaignId: campaignId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    }, teamId);

    res.status(200).json({
      data: orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching orders', error);
    next(error);
  }
});

// GET /api/orders/pending - Get pending orders
router.get('/status/pending', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    const orders = await orderService.getPendingOrders(teamId);

    res.status(200).json({
      data: orders,
      total: orders.length,
    });
  } catch (error) {
    logger.error('Error fetching pending orders', error);
    next(error);
  }
});

// GET /api/orders/completed - Get completed orders
router.get('/status/completed', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const authReq = req as AuthRequest;
    const teamId = authReq.teamId || req.headers['x-team-id'] as string;

    const orders = await orderService.getCompletedOrders(teamId);

    res.status(200).json({
      data: orders,
      total: orders.length,
    });
  } catch (error) {
    logger.error('Error fetching completed orders', error);
    next(error);
  }
});

// GET /api/orders/:id - Get order details
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const { id } = req.params;

    const order = await orderService.getOrder(id);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      } as ErrorResponse);
    }

    res.status(200).json({
      data: order,
    });
  } catch (error) {
    logger.error('Error fetching order', error);
    next(error);
  }
});

// GET /api/orders/:id/transcript - Get call transcript for order
router.get('/:id/transcript', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { CallRepository } = await import('../db/repositories/callRepository');
    const callRepo = new CallRepository();
    const orderService = getOrderService();

    const order = await orderService.getOrder(id);
    if (!order || !order.callId) {
      return res.status(404).json({
        message: 'Order or call transcript not found',
        code: 'NOT_FOUND',
      } as ErrorResponse);
    }

    const call = await callRepo.getCallWithDetails(order.callId);
    if (!call) {
      return res.status(404).json({
        message: 'Call not found',
        code: 'CALL_NOT_FOUND',
      } as ErrorResponse);
    }

    const transcripts = call.transcripts.map((t) => ({
      id: t.id,
      speaker: t.speaker,
      text: t.text,
      confidence: t.confidence,
      startTime: t.startTime,
      endTime: t.endTime,
      timestamp: t.createdAt,
    }));

    res.status(200).json({
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        callId: call.id,
        callStartTime: call.startTime,
        callEndTime: call.endTime,
        transcripts,
        totalSegments: transcripts.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching order transcript', error);
    next(error);
  }
});

// PATCH /api/orders/:id - Update order status
router.patch('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, deliveryAddress, phone, email, notes, specialInstructions, cancelReason } = req.body;

    const orderService = getOrderService();
    const existingOrder = await orderService.getOrder(id);

    if (!existingOrder) {
      return res.status(404).json({
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      } as ErrorResponse);
    }

    let order;
    if (status === 'cancelled' && cancelReason) {
      order = await orderService.cancelOrder(id, cancelReason);
    } else if (status) {
      const statusMethods: Record<string, (id: string) => Promise<any>> = {
        confirmed: orderService.confirmOrder.bind(orderService),
        processing: orderService.processOrder.bind(orderService),
        ready: orderService.markOrderReady.bind(orderService),
        delivered: orderService.markOrderDelivered.bind(orderService),
      };

      if (statusMethods[status]) {
        order = await statusMethods[status](id);
      } else {
        order = await orderService.updateOrder(id, { status, deliveryAddress, phone, email, notes, specialInstructions });
      }
    } else {
      order = await orderService.updateOrder(id, { deliveryAddress, phone, email, notes, specialInstructions });
    }

    logger.info(`Order ${id} updated`);

    res.status(200).json({
      data: order,
    });
  } catch (error) {
    logger.error('Error updating order', error);
    next(error);
  }
});

// POST /api/orders/:id/confirm - Mark as confirmed
router.post('/:id/confirm', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orderService = getOrderService();

    const order = await orderService.confirmOrder(id);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      } as ErrorResponse);
    }

    logger.info(`Order ${id} confirmed`);

    res.status(200).json({
      data: order,
      message: 'Order confirmed successfully',
    });
  } catch (error) {
    logger.error('Error confirming order', error);
    next(error);
  }
});

// POST /api/orders/:id/cancel - Cancel order
router.post('/:id/cancel', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        message: 'Cancellation reason is required',
        code: 'REASON_REQUIRED',
      } as ErrorResponse);
    }

    const orderService = getOrderService();
    const order = await orderService.cancelOrder(id, reason);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      } as ErrorResponse);
    }

    logger.info(`Order ${id} cancelled: ${reason}`);

    res.status(200).json({
      data: order,
      message: 'Order cancelled successfully',
    });
  } catch (error) {
    logger.error('Error cancelling order', error);
    next(error);
  }
});

// DELETE /api/orders/:id - Cancel order
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orderService = getOrderService();

    await orderService.deleteOrder(id);

    logger.info(`Order ${id} deleted`);

    res.status(200).json({
      message: 'Order deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting order', error);
    next(error);
  }
});

// POST /api/orders/validate - Validate order without creating
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const { items, phone, email, deliveryAddress } = req.body;

    const validation = await orderService.validateOrder({
      items,
      phone,
      email,
      deliveryAddress,
      validateOnly: true,
    });

    res.status(200).json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  } catch (error) {
    logger.error('Error validating order', error);
    next(error);
  }
});

export default router;
