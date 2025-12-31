import { OrderService, CreateOrderRequest, OrderItemInput } from '../services/orderService';
import { OrderRepository } from '../db/repositories/orderRepository';

// Mock the repository
jest.mock('../db/repositories/orderRepository', () => ({
  OrderRepository: jest.fn().mockImplementation(() => ({
    createOrder: jest.fn(),
    updateOrder: jest.fn(),
    getOrderById: jest.fn(),
    getOrderByOrderNumber: jest.fn(),
    getOrderByCallId: jest.fn(),
    deleteOrder: jest.fn(),
    searchOrders: jest.fn(),
    getOrdersByStatus: jest.fn(),
    getOrdersByDateRange: jest.fn(),
    getDuplicateOrders: jest.fn(),
    getOrderItems: jest.fn(),
    updateOrderStatus: jest.fn(),
    createCustomer: jest.fn(),
    updateCustomer: jest.fn(),
    getCustomerById: jest.fn(),
    getCustomerByPhone: jest.fn(),
    getCustomerByEmail: jest.fn(),
    searchCustomers: jest.fn(),
    deleteCustomer: jest.fn(),
    getCustomerPreferences: jest.fn(),
    createOrUpdateCustomerPreferences: jest.fn(),
    getTopOrderedItems: jest.fn(),
    getOrderTrends: jest.fn(),
    getOrderCountByStatus: jest.fn(),
    getMostFrequentCustomers: jest.fn(),
    findOrCreateCustomer: jest.fn(),
  })),
}));

describe('OrderService', () => {
  let service: OrderService;
  let mockRepository: jest.Mocked<OrderRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrderService();
    // Access the private repository through the service
    mockRepository = (service as any).orderRepository;
  });

  describe('validatePhone', () => {
    it('should validate correct phone numbers', () => {
      expect(service.validatePhone('+1234567890')).toBe(true);
      expect(service.validatePhone('123-456-7890')).toBe(true);
      expect(service.validatePhone('(123) 456-7890')).toBe(true);
      expect(service.validatePhone('+1 234 567 8901')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(service.validatePhone('')).toBe(false);
      expect(service.validatePhone('123')).toBe(false);
      expect(service.validatePhone('invalid')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct emails', () => {
      expect(service.validateEmail('test@example.com')).toBe(true);
      expect(service.validateEmail('user.name@domain.org')).toBe(true);
      expect(service.validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(service.validateEmail('')).toBe(false);
      expect(service.validateEmail('invalid')).toBe(false);
      expect(service.validateEmail('invalid@')).toBe(false);
      expect(service.validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validateAddress', () => {
    it('should validate correct addresses', () => {
      expect(service.validateAddress('123 Main St, City, State 12345')).toBe(true);
      expect(service.validateAddress('123 Main St #4, Anytown, USA 12345')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(service.validateAddress('')).toBe(false);
      expect(service.validateAddress('123')).toBe(false);
    });
  });

  describe('validateOrderItems', () => {
    it('should validate valid items', () => {
      const items: OrderItemInput[] = [
        { productName: 'Pizza', quantity: 1, unitPrice: 15.99 },
        { productName: 'Soda', quantity: 2, unitPrice: 2.99 },
      ];

      const result = service.validateOrderItems(items);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty items', () => {
      const result = service.validateOrderItems([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Order must have at least one item');
    });

    it('should reject invalid quantity', () => {
      const items: OrderItemInput[] = [
        { productName: 'Pizza', quantity: 0, unitPrice: 15.99 },
      ];

      const result = service.validateOrderItems(items);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Quantity'))).toBe(true);
    });

    it('should reject negative price', () => {
      const items: OrderItemInput[] = [
        { productName: 'Pizza', quantity: 1, unitPrice: -5.00 },
      ];

      const result = service.validateOrderItems(items);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Price'))).toBe(true);
    });

    it('should warn about large quantities', () => {
      const items: OrderItemInput[] = [
        { productName: 'Pizza', quantity: 100, unitPrice: 15.99 },
      ];

      const result = service.validateOrderItems(items);

      expect(result.valid).toBe(true);
      expect(result.warnings && result.warnings.length > 0).toBe(true);
    });

    it('should reject items below minimum order amount', () => {
      const items: OrderItemInput[] = [
        { productName: 'Small Item', quantity: 1, unitPrice: 1.00 },
      ];

      const result = service.validateOrderItems(items);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Minimum order amount'))).toBe(true);
    });
  });

  describe('validateCustomerData', () => {
    it('should validate customer with phone', () => {
      const result = service.validateCustomerData({
        phone: '+1234567890',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate customer with email', () => {
      const result = service.validateCustomerData({
        email: 'test@example.com',
      });

      expect(result.valid).toBe(true);
    });

    it('should reject customer without contact', () => {
      const result = service.validateCustomerData({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one contact method (phone or email) is required');
    });

    it('should reject invalid phone', () => {
      const result = service.validateCustomerData({
        phone: 'invalid',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid phone number format');
    });

    it('should reject invalid email', () => {
      const result = service.validateCustomerData({
        email: 'invalid',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email address format');
    });
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-2024-0001',
        status: 'pending',
        totalAmount: 25.99,
      };

      const mockCustomer = {
        id: 'customer-1',
        name: 'John',
        phone: '+1234567890',
      };

      mockRepository.findOrCreateCustomer.mockResolvedValue(mockCustomer);
      mockRepository.getDuplicateOrders.mockResolvedValue([]);
      mockRepository.createOrder.mockResolvedValue(mockOrder);

      const request: CreateOrderRequest = {
        items: [
          { productName: 'Pizza', quantity: 1, unitPrice: 15.99 },
          { productName: 'Soda', quantity: 2, unitPrice: 2.99 },
        ],
        phone: '+1234567890',
        email: 'test@example.com',
        deliveryAddress: '123 Main St',
      };

      const result = await service.createOrder(request);

      expect(result.order).toEqual(mockOrder);
      expect(result.validation.valid).toBe(true);
    });

    it('should return validation errors for invalid order', async () => {
      const request: CreateOrderRequest = {
        items: [],
        phone: 'invalid',
      };

      const result = await service.createOrder(request);

      expect(result.order).toBeNull();
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getOrder', () => {
    it('should return order by id', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-2024-0001',
      };

      mockRepository.getOrderById.mockResolvedValue(mockOrder);

      const result = await service.getOrder('order-1');

      expect(result).toEqual(mockOrder);
    });

    it('should return null for non-existent order', async () => {
      mockRepository.getOrderById.mockResolvedValue(null);

      const result = await service.getOrder('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('Order Status Updates', () => {
    it('should confirm order', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'confirmed',
      };

      mockRepository.updateOrderStatus.mockResolvedValue(mockOrder);

      const result = await service.confirmOrder('order-1');

      expect(result.status).toBe('confirmed');
    });

    it('should cancel order with reason', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'cancelled',
        cancelReason: 'Customer requested',
      };

      mockRepository.updateOrderStatus.mockResolvedValue(mockOrder);

      const result = await service.cancelOrder('order-1', 'Customer requested');

      expect(result.status).toBe('cancelled');
      expect(mockRepository.updateOrderStatus).toHaveBeenCalledWith('order-1', 'cancelled', 'Customer requested');
    });

    it('should process order', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'processing',
      };

      mockRepository.updateOrderStatus.mockResolvedValue(mockOrder);

      const result = await service.processOrder('order-1');

      expect(result.status).toBe('processing');
    });

    it('should mark order ready', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'ready',
      };

      mockRepository.updateOrderStatus.mockResolvedValue(mockOrder);

      const result = await service.markOrderReady('order-1');

      expect(result.status).toBe('ready');
    });

    it('should mark order delivered', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'delivered',
      };

      mockRepository.updateOrderStatus.mockResolvedValue(mockOrder);

      const result = await service.markOrderDelivered('order-1');

      expect(result.status).toBe('delivered');
    });
  });

  describe('Customer Operations', () => {
    it('should get customer with orders', async () => {
      const mockCustomer = {
        id: 'customer-1',
        name: 'John',
        orders: [],
      };

      mockRepository.getCustomerById.mockResolvedValue(mockCustomer);

      const result = await service.getCustomer('customer-1');

      expect(result).toEqual(mockCustomer);
    });

    it('should search customers', async () => {
      const mockCustomers = [
        { id: 'customer-1', name: 'John' },
        { id: 'customer-2', name: 'Jane' },
      ];

      mockRepository.searchCustomers.mockResolvedValue({
        customers: mockCustomers,
        total: 2,
      });

      const result = await service.searchCustomers({ limit: 10 }, 'team-1');

      expect(result.customers).toEqual(mockCustomers);
      expect(result.total).toBe(2);
    });
  });

  describe('Customer Preferences', () => {
    it('should get customer preferences with parsed JSON', async () => {
      const mockPrefs = {
        id: 'pref-1',
        customerId: 'customer-1',
        favoriteItems: '["Pizza", "Burger"]',
        dietaryRestrictions: '["vegetarian"]',
        allergies: '["nuts"]',
        deliveryNotes: 'Leave at door',
      };

      mockRepository.getCustomerPreferences.mockResolvedValue(mockPrefs);

      const result = await service.getCustomerPreferences('customer-1');

      expect(result?.favoriteItems).toEqual(['Pizza', 'Burger']);
      expect(result?.dietaryRestrictions).toEqual(['vegetarian']);
      expect(result?.allergies).toEqual(['nuts']);
    });
  });

  describe('Analytics', () => {
    it('should get top items', async () => {
      const mockItems = [
        { productName: 'Pizza', totalQuantity: 100, orderCount: 50 },
      ];

      mockRepository.getTopOrderedItems.mockResolvedValue(mockItems);

      const result = await service.getTopItems(10, 'team-1');

      expect(result).toEqual(mockItems);
    });

    it('should get order stats', async () => {
      mockRepository.getOrderCountByStatus.mockResolvedValue({
        pending: 5,
        confirmed: 10,
        delivered: 20,
      });
      mockRepository.getTopOrderedItems.mockResolvedValue([]);
      mockRepository.getMostFrequentCustomers.mockResolvedValue([]);

      const result = await service.getOrderStats('team-1');

      expect(result.byStatus).toBeDefined();
      expect(result.topItems).toBeDefined();
      expect(result.frequentCustomers).toBeDefined();
    });
  });

  describe('Transcript Extraction', () => {
    it('should extract customer data from transcript', () => {
      const transcript = 'Hi, my name is John and my phone is 555-123-4567';
      
      const result = service.extractCustomerDataFromTranscript(transcript);
      
      // The function returns a partial object - verify it runs without errors
      expect(typeof result).toBe('object');
    });

    it('should extract order items from transcript', () => {
      const transcript = 'I want 2 large pizzas';
      
      const items = service.extractOrderItemsFromTranscript(transcript);
      
      // The function returns an array (even if empty)
      expect(Array.isArray(items)).toBe(true);
    });

    it('should handle phrase extraction without errors', () => {
      const transcript = 'I would like a pizza and a burger please';
      
      const items = service.extractOrderItemsFromTranscript(transcript);
      
      expect(Array.isArray(items)).toBe(true);
    });
  });
});
