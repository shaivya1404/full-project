import { OrderRepository, CreateOrderInput, CreateCustomerInput } from './orderRepository';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrisma = {
  order: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  orderItem: {
    findMany: jest.fn(),
  },
  customer: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  customerPreference: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Mock the getPrismaClient function
jest.mock('../client', () => ({
  getPrismaClient: () => mockPrisma,
}));

describe('OrderRepository', () => {
  let repository: OrderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new OrderRepository();
  });

  describe('createOrder', () => {
    it('should create an order with items', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-2024-0001',
        status: 'pending',
        totalAmount: 25.99,
        items: [
          { id: 'item-1', productName: 'Pizza', quantity: 1, unitPrice: 15.99 },
        ],
      };

      mockPrisma.order.create.mockResolvedValue(mockOrder);
      mockPrisma.customer.update.mockResolvedValue({ id: 'customer-1', previousOrders: 1 });

      const input: CreateOrderInput = {
        teamId: 'team-1',
        customerId: 'customer-1',
        items: [
          { productName: 'Pizza', quantity: 1, unitPrice: 15.99 },
        ],
        totalAmount: 25.99,
      };

      const result = await repository.createOrder(input);

      expect(result).toEqual(mockOrder);
      expect(mockPrisma.order.create).toHaveBeenCalled();
    });
  });

  describe('getOrderById', () => {
    it('should return order with items and customer', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-2024-0001',
        items: [],
        customer: { id: 'customer-1', name: 'John' },
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await repository.getOrderById('order-1');

      expect(result).toEqual(mockOrder);
      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: { items: true, customer: true },
      });
    });

    it('should return null for non-existent order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      const result = await repository.getOrderById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateOrder', () => {
    it('should update order status', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'confirmed',
        orderNumber: 'ORD-2024-0001',
      };

      mockPrisma.order.update.mockResolvedValue(mockOrder);

      const result = await repository.updateOrder('order-1', { status: 'confirmed' });

      expect(result).toEqual(mockOrder);
      expect(mockPrisma.order.update).toHaveBeenCalled();
      expect(mockPrisma.order.update.mock.calls[0][0].where.id).toBe('order-1');
      expect(mockPrisma.order.update.mock.calls[0][0].data.status).toBe('confirmed');
    });
  });

  describe('searchOrders', () => {
    it('should search orders with filters', async () => {
      const mockOrders = [
        { id: 'order-1', status: 'pending' },
        { id: 'order-2', status: 'pending' },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.order.count.mockResolvedValue(2);

      const result = await repository.searchOrders(10, 0, { status: 'pending' }, 'team-1');

      expect(result.orders).toEqual(mockOrders);
      expect(result.total).toBe(2);
    });
  });

  describe('getOrdersByStatus', () => {
    it('should return orders by status', async () => {
      const mockOrders = [
        { id: 'order-1', status: 'pending' },
        { id: 'order-2', status: 'pending' },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await repository.getOrdersByStatus('pending', 100, 'team-1');

      expect(result).toEqual(mockOrders);
    });
  });

  describe('getDuplicateOrders', () => {
    it('should return duplicate orders within time window', async () => {
      const mockOrders = [
        { id: 'order-1', items: [{ productName: 'Pizza' }] },
      ];

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await repository.getDuplicateOrders('customer-1', 5);

      expect(result).toEqual(mockOrders);
    });
  });

  describe('Customer Operations', () => {
    describe('createCustomer', () => {
      it('should create a customer', async () => {
        const mockCustomer = {
          id: 'customer-1',
          name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
        };

        mockPrisma.customer.create.mockResolvedValue(mockCustomer);

        const input: CreateCustomerInput = {
          teamId: 'team-1',
          name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
        };

        const result = await repository.createCustomer(input);

        expect(result).toEqual(mockCustomer);
        expect(mockPrisma.customer.create).toHaveBeenCalledWith({ data: input });
      });
    });

    describe('getCustomerByPhone', () => {
      it('should find customer by phone', async () => {
        const mockCustomer = {
          id: 'customer-1',
          phone: '+1234567890',
        };

        mockPrisma.customer.findFirst.mockResolvedValue(mockCustomer);

        const result = await repository.getCustomerByPhone('+1234567890');

        expect(result).toEqual(mockCustomer);
      });
    });

    describe('searchCustomers', () => {
      it('should search customers with pagination', async () => {
        const mockCustomers = [
          { id: 'customer-1', name: 'John' },
          { id: 'customer-2', name: 'Jane' },
        ];

        mockPrisma.customer.findMany.mockResolvedValue(mockCustomers);
        mockPrisma.customer.count.mockResolvedValue(2);

        const result = await repository.searchCustomers(10, 0, { teamId: 'team-1' });

        expect(result.customers).toEqual(mockCustomers);
        expect(result.total).toBe(2);
      });
    });
  });

  describe('Customer Preferences', () => {
    describe('getCustomerPreferences', () => {
      it('should return customer preferences', async () => {
        const mockPrefs = {
          id: 'pref-1',
          customerId: 'customer-1',
          favoriteItems: '["Pizza", "Burger"]',
        };

        mockPrisma.customerPreference.findUnique.mockResolvedValue(mockPrefs);

        const result = await repository.getCustomerPreferences('customer-1');

        expect(result).toEqual(mockPrefs);
      });
    });

    describe('createOrUpdateCustomerPreferences', () => {
      it('should create preferences if not exists', async () => {
        const mockPrefs = {
          id: 'pref-1',
          customerId: 'customer-1',
          favoriteItems: '["Pizza"]',
        };

        mockPrisma.customerPreference.findUnique.mockResolvedValue(null);
        mockPrisma.customerPreference.create.mockResolvedValue(mockPrefs);

        const result = await repository.createOrUpdateCustomerPreferences('customer-1', {
          favoriteItems: ['Pizza'],
        });

        expect(result).toEqual(mockPrefs);
      });

      it('should update preferences if exists', async () => {
        const mockPrefs = {
          id: 'pref-1',
          customerId: 'customer-1',
          favoriteItems: '["Pizza", "Burger"]',
        };

        mockPrisma.customerPreference.findUnique.mockResolvedValue(mockPrefs);
        mockPrisma.customerPreference.update.mockResolvedValue(mockPrefs);

        const result = await repository.createOrUpdateCustomerPreferences('customer-1', {
          favoriteItems: ['Pizza', 'Burger'],
        });

        expect(result).toEqual(mockPrefs);
      });
    });
  });

  describe('Analytics', () => {
    describe('getTopOrderedItems', () => {
      it('should return top ordered items', async () => {
        const mockItems = [
          { productName: 'Pizza', totalQuantity: 100, orderCount: 50 },
          { productName: 'Burger', totalQuantity: 80, orderCount: 40 },
        ];

        mockPrisma.orderItem.findMany.mockResolvedValue([
          { productName: 'Pizza', quantity: 2, orderId: 'order-1', order: { teamId: 'team-1' } },
          { productName: 'Pizza', quantity: 1, orderId: 'order-2', order: { teamId: 'team-1' } },
          { productName: 'Burger', quantity: 1, orderId: 'order-1', order: { teamId: 'team-1' } },
        ]);

        const result = await repository.getTopOrderedItems(10, 'team-1');

        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('getOrderTrends', () => {
      it('should return order trends by date', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');

        mockPrisma.order.findMany.mockResolvedValue([
          { orderTime: new Date('2024-01-15'), totalAmount: 25.99 },
          { orderTime: new Date('2024-01-16'), totalAmount: 30.00 },
        ]);

        const result = await repository.getOrderTrends(startDate, endDate, 'team-1');

        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});
