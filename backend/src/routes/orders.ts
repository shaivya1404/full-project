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

    // Get teamId from authenticated user, query, body, or header
    const teamId = (req as any).user?.teamId || req.body.teamId || (req.query.teamId as string) || req.headers['x-team-id'] as string;

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

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
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const { limit, offset } = getPaginationParams(req);
    const { customerId, status, campaignId } = req.query;
    const startDate = (req.query.startDate || req.query.dateFrom) as string | undefined;
    const endDate = (req.query.endDate || req.query.dateTo) as string | undefined;

    const teamId = (req as any).user?.teamId || (req.query.teamId as string) || req.headers['x-team-id'] as string;

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

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
router.get('/status/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const teamId = (req as any).user?.teamId || (req.query.teamId as string) || req.headers['x-team-id'] as string;

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

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
router.get('/status/completed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const teamId = (req as any).user?.teamId || (req.query.teamId as string) || req.headers['x-team-id'] as string;

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

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

// GET /api/orders/search - Search orders by query string
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orderService = getOrderService();
    const teamId = (req as any).user?.teamId || (req.query.teamId as string) || req.headers['x-team-id'] as string;
    const q = req.query.q as string;

    if (!teamId) {
      return res.status(400).json({
        message: 'Team ID is required',
        code: 'TEAM_REQUIRED',
      } as ErrorResponse);
    }

    if (!q) {
      return res.status(400).json({
        message: 'Search query is required',
        code: 'QUERY_REQUIRED',
      } as ErrorResponse);
    }

    const { orders } = await orderService.searchOrders({
      limit: 50,
      offset: 0,
      status: q,
    }, teamId);

    // Also search by order number / customer name via a broader search
    const { orders: ordersByOther } = await orderService.searchOrders({
      limit: 50,
      offset: 0,
    }, teamId);

    // Combine and deduplicate: filter the broader set to match the query
    const lowerQ = q.toLowerCase();
    const matchedOrders = ordersByOther.filter((order: any) =>
      (order.orderNumber && order.orderNumber.toLowerCase().includes(lowerQ)) ||
      (order.customerName && order.customerName.toLowerCase().includes(lowerQ)) ||
      (order.phone && order.phone.includes(q)) ||
      (order.email && order.email.toLowerCase().includes(lowerQ)) ||
      (order.status && order.status.toLowerCase().includes(lowerQ))
    );

    // Merge status-matched orders and text-matched orders, deduplicate by id
    const seen = new Set<string>();
    const combined: any[] = [];
    for (const order of [...orders, ...matchedOrders]) {
      if (!seen.has(order.id)) {
        seen.add(order.id);
        combined.push(order);
      }
    }

    res.status(200).json({
      data: combined,
    });
  } catch (error) {
    logger.error('Error searching orders', error);
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

// GET /api/orders/:id - Get order details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/:id/transcript', async (req: Request, res: Response, next: NextFunction) => {
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

// Shared handler for PATCH and PUT /api/orders/:id - Update order
const updateOrderHandler = async (req: Request, res: Response, next: NextFunction) => {
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
};

// PATCH /api/orders/:id - Update order
router.patch('/:id', updateOrderHandler);

// PUT /api/orders/:id - Update order (frontend uses PUT)
router.put('/:id', updateOrderHandler);

// POST /api/orders/:id/confirm - Mark as confirmed
router.post('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
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

// POST /api/orders/:id/status - Update order status
router.post('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!status) {
      return res.status(400).json({
        message: 'Status is required',
        code: 'STATUS_REQUIRED',
      } as ErrorResponse);
    }

    const orderService = getOrderService();
    const existingOrder = await orderService.getOrder(id);

    if (!existingOrder) {
      return res.status(404).json({
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      } as ErrorResponse);
    }

    let order;
    if (status === 'cancelled') {
      order = await orderService.cancelOrder(id, note || 'Status updated via API');
    } else {
      const statusMethods: Record<string, (id: string) => Promise<any>> = {
        confirmed: orderService.confirmOrder.bind(orderService),
        processing: orderService.processOrder.bind(orderService),
        ready: orderService.markOrderReady.bind(orderService),
        delivered: orderService.markOrderDelivered.bind(orderService),
      };

      if (statusMethods[status]) {
        order = await statusMethods[status](id);
      } else {
        order = await orderService.updateOrder(id, { status });
      }
    }

    logger.info(`Order ${id} status updated to ${status}${note ? ': ' + note : ''}`);

    res.status(200).json({
      data: order,
      message: `Order status updated to ${status}`,
    });
  } catch (error) {
    logger.error('Error updating order status', error);
    next(error);
  }
});

// POST /api/orders/:id/cancel - Cancel order
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
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
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
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

export default router;
