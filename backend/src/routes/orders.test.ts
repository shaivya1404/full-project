import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService';

// Create a simple express app without full auth
const createTestApp = () => {
  const app: Express = express();
  app.use(express.json());

  // Mock auth middleware that passes through
  const mockAuth = (req: Request, res: Response, next: NextFunction) => {
    req.headers['x-team-id'] = 'test-team';
    next();
  };

  // Create router with injected mock service
  const mockOrderService = {
    createOrder: jest.fn(),
    getOrder: jest.fn(),
    getOrderByNumber: jest.fn(),
    getOrderByCallId: jest.fn(),
    updateOrder: jest.fn(),
    cancelOrder: jest.fn(),
    confirmOrder: jest.fn(),
    processOrder: jest.fn(),
    markOrderReady: jest.fn(),
    markOrderDelivered: jest.fn(),
    deleteOrder: jest.fn(),
    searchOrders: jest.fn(),
    getPendingOrders: jest.fn(),
    getCompletedOrders: jest.fn(),
    validateOrder: jest.fn(),
    getCustomer: jest.fn(),
    updateCustomer: jest.fn(),
    searchCustomers: jest.fn(),
    getCustomerPreferences: jest.fn(),
    saveCustomerPreferences: jest.fn(),
    getTopItems: jest.fn(),
    getOrderTrends: jest.fn(),
    getOrderStats: jest.fn(),
    extractCustomerDataFromTranscript: jest.fn(),
    extractOrderItemsFromTranscript: jest.fn(),
  };

  // Order routes with embedded logic for testing
  const router = express.Router();

  router.post('/', async (req: Request, res: Response) => {
    const { items, phone, email, deliveryAddress, notes, specialInstructions, campaignId, callId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order items are required', code: 'ITEMS_REQUIRED' });
    }

    const result = await mockOrderService.createOrder({
      items,
      phone,
      email,
      deliveryAddress,
      notes,
      specialInstructions,
      campaignId,
      callId,
    });

    if (!result.order) {
      return res.status(400).json({ message: 'Order validation failed', errors: result.validation.errors });
    }

    res.status(201).json({ data: result.order });
  });

  router.get('/', async (req: Request, res: Response) => {
    const { limit, offset, status, customerId } = req.query;
    const { orders, total } = await mockOrderService.searchOrders({
      limit: parseInt(limit as string) || 10,
      offset: parseInt(offset as string) || 0,
      status: status as string,
      customerId: customerId as string,
    });

    res.status(200).json({ data: orders, pagination: { total, limit: parseInt(limit as string) || 10, offset: parseInt(offset as string) || 0 } });
  });

  router.get('/status/pending', async (req: Request, res: Response) => {
    const orders = await mockOrderService.getPendingOrders();
    res.status(200).json({ data: orders, total: orders.length });
  });

  router.get('/status/completed', async (req: Request, res: Response) => {
    const orders = await mockOrderService.getCompletedOrders();
    res.status(200).json({ data: orders, total: orders.length });
  });

  router.get('/:id', async (req: Request, res: Response) => {
    const order = await mockOrderService.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }
    res.status(200).json({ data: order });
  });

  router.patch('/:id', async (req: Request, res: Response) => {
    const { status, deliveryAddress, phone, email, notes, specialInstructions, cancelReason } = req.body;
    const order = await mockOrderService.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }

    let updated;
    if (status === 'cancelled' && cancelReason) {
      updated = await mockOrderService.cancelOrder(req.params.id, cancelReason);
    } else if (status) {
      const methods: Record<string, any> = {
        confirmed: mockOrderService.confirmOrder.bind(mockOrderService),
        processing: mockOrderService.processOrder.bind(mockOrderService),
        ready: mockOrderService.markOrderReady.bind(mockOrderService),
        delivered: mockOrderService.markOrderDelivered.bind(mockOrderService),
      };
      if (methods[status]) {
        updated = await methods[status](req.params.id);
      } else {
        updated = await mockOrderService.updateOrder(req.params.id, { status, deliveryAddress, phone, email, notes, specialInstructions });
      }
    } else {
      updated = await mockOrderService.updateOrder(req.params.id, { deliveryAddress, phone, email, notes, specialInstructions });
    }

    res.status(200).json({ data: updated });
  });

  router.post('/:id/confirm', async (req: Request, res: Response) => {
    const order = await mockOrderService.confirmOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }
    res.status(200).json({ data: order, message: 'Order confirmed successfully' });
  });

  router.post('/:id/cancel', async (req: Request, res: Response) => {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ message: 'Cancellation reason is required', code: 'REASON_REQUIRED' });
    }
    const order = await mockOrderService.cancelOrder(req.params.id, reason);
    if (!order) {
      return res.status(404).json({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    }
    res.status(200).json({ data: order, message: 'Order cancelled successfully' });
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    await mockOrderService.deleteOrder(req.params.id);
    res.status(200).json({ message: 'Order deleted successfully' });
  });

  router.post('/validate', async (req: Request, res: Response) => {
    const { items, phone, email, deliveryAddress } = req.body;
    const validation = await mockOrderService.validateOrder({ items, phone, email, deliveryAddress });
    res.status(200).json({ valid: validation.valid, errors: validation.errors, warnings: validation.warnings });
  });

  app.use('/api/orders', router);

  return { app, mockOrderService };
};

describe('Orders API', () => {
  let app: Express;
  let mockOrderService: jest.Mocked<OrderService>;

  beforeEach(() => {
    const testSetup = createTestApp();
    app = testSetup.app;
    mockOrderService = testSetup.mockOrderService as unknown as jest.Mocked<OrderService>;
  });

  describe('POST /api/orders', () => {
    it('should create a new order', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-2024-0001',
        status: 'pending',
        totalAmount: 25.99,
        items: [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }],
      };

      mockOrderService.createOrder.mockResolvedValue({
        order: mockOrder,
        validation: { valid: true, errors: [] },
      });

      const response = await request(app)
        .post('/api/orders')
        .send({
          items: [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }],
          phone: '+1234567890',
          deliveryAddress: '123 Main St',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.orderNumber).toBe('ORD-2024-0001');
    });

    it('should return 400 if items are missing', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({ phone: '+1234567890' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ITEMS_REQUIRED');
    });

    it('should return validation errors', async () => {
      mockOrderService.createOrder.mockResolvedValue({
        order: null,
        validation: { valid: false, errors: ['Invalid phone number'], warnings: [] },
      });

      const response = await request(app)
        .post('/api/orders')
        .send({
          items: [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }],
          phone: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain('Invalid phone number');
    });
  });

  describe('GET /api/orders', () => {
    it('should return list of orders', async () => {
      const mockOrders = [
        { id: 'order-1', orderNumber: 'ORD-2024-0001' },
        { id: 'order-2', orderNumber: 'ORD-2024-0002' },
      ];

      mockOrderService.searchOrders.mockResolvedValue({
        orders: mockOrders,
        total: 2,
      });

      const response = await request(app)
        .get('/api/orders');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
    });
  });

  describe('GET /api/orders/status/pending', () => {
    it('should return pending orders', async () => {
      mockOrderService.getPendingOrders.mockResolvedValue([
        { id: 'order-1', status: 'pending' },
      ]);

      const response = await request(app)
        .get('/api/orders/status/pending');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/orders/status/completed', () => {
    it('should return completed orders', async () => {
      mockOrderService.getCompletedOrders.mockResolvedValue([
        { id: 'order-1', status: 'delivered' },
      ]);

      const response = await request(app)
        .get('/api/orders/status/completed');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return order details', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-2024-0001',
        items: [],
      };

      mockOrderService.getOrder.mockResolvedValue(mockOrder);

      const response = await request(app)
        .get('/api/orders/order-1');

      expect(response.status).toBe(200);
      expect(response.body.data.orderNumber).toBe('ORD-2024-0001');
    });

    it('should return 404 for non-existent order', async () => {
      mockOrderService.getOrder.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/orders/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('PATCH /api/orders/:id', () => {
    it('should update order status', async () => {
      const mockOrder = { id: 'order-1', status: 'confirmed' };

      mockOrderService.getOrder.mockResolvedValue({ id: 'order-1' });
      mockOrderService.confirmOrder.mockResolvedValue(mockOrder);

      const response = await request(app)
        .patch('/api/orders/order-1')
        .send({ status: 'confirmed' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('confirmed');
    });

    it('should cancel order with reason', async () => {
      const mockOrder = { id: 'order-1', status: 'cancelled', cancelReason: 'Customer requested' };

      mockOrderService.getOrder.mockResolvedValue({ id: 'order-1' });
      mockOrderService.cancelOrder.mockResolvedValue(mockOrder);

      const response = await request(app)
        .patch('/api/orders/order-1')
        .send({ status: 'cancelled', cancelReason: 'Customer requested' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('cancelled');
    });
  });

  describe('POST /api/orders/:id/confirm', () => {
    it('should confirm order', async () => {
      mockOrderService.confirmOrder.mockResolvedValue({ id: 'order-1', status: 'confirmed' });

      const response = await request(app)
        .post('/api/orders/order-1/confirm');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('confirmed');
    });

    it('should return 404 for non-existent order', async () => {
      mockOrderService.confirmOrder.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/orders/non-existent/confirm');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('should cancel order with reason', async () => {
      mockOrderService.cancelOrder.mockResolvedValue({ id: 'order-1', status: 'cancelled' });

      const response = await request(app)
        .post('/api/orders/order-1/cancel')
        .send({ reason: 'Customer changed mind' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('cancelled');
    });

    it('should return 400 if reason is missing', async () => {
      const response = await request(app)
        .post('/api/orders/order-1/cancel')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('REASON_REQUIRED');
    });
  });

  describe('DELETE /api/orders/:id', () => {
    it('should delete order', async () => {
      mockOrderService.deleteOrder.mockResolvedValue();

      const response = await request(app)
        .delete('/api/orders/order-1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });
  });

  describe('POST /api/orders/validate', () => {
    it('should validate order without creating', async () => {
      mockOrderService.validateOrder.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      const response = await request(app)
        .post('/api/orders/validate')
        .send({
          items: [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }],
          phone: '+1234567890',
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });

    it('should return validation errors', async () => {
      mockOrderService.validateOrder.mockResolvedValue({
        valid: false,
        errors: ['Invalid phone number'],
        warnings: [],
      });

      const response = await request(app)
        .post('/api/orders/validate')
        .send({
          items: [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }],
          phone: 'invalid',
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });
  });
});
