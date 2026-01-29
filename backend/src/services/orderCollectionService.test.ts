import { OrderCollectionService } from '../services/orderCollectionService';
import { OrderService } from '../services/orderService';
import { CallRepository } from '../db/repositories/callRepository';

// Mock dependencies
jest.mock('../services/orderService', () => ({
  OrderService: jest.fn().mockImplementation(() => ({
    createOrder: jest.fn(),
    extractCustomerDataFromTranscript: jest.fn(),
    extractOrderItemsFromTranscript: jest.fn(),
  })),
}));

jest.mock('../db/repositories/callRepository', () => ({
  CallRepository: jest.fn().mockImplementation(() => ({
    getCallById: jest.fn(),
    getRecentTranscripts: jest.fn(),
  })),
}));

describe('OrderCollectionService', () => {
  let service: OrderCollectionService;
  let mockOrderService: jest.Mocked<OrderService>;
  let mockCallRepository: jest.Mocked<CallRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrderCollectionService();
    mockOrderService = (OrderService as unknown as jest.Mock).mock.results[0]?.value;
    mockCallRepository = (CallRepository as unknown as jest.Mock).mock.results[0]?.value;
  });

  describe('State Management', () => {
    it('should create new state for new streamSid', () => {
      const state = service.getOrCreateState('stream-1');

      expect(state.step).toBe('idle');
      expect(state.items).toEqual([]);
      expect(state.validationErrors).toEqual([]);
    });

    it('should return existing state for same streamSid', () => {
      const state1 = service.getOrCreateState('stream-1');
      state1.items = [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }];

      const state2 = service.getOrCreateState('stream-1');

      expect(state2.items).toHaveLength(1);
    });

    it('should update state', () => {
      service.updateState('stream-1', {
        step: 'collecting_items',
        customerName: 'John',
      });

      const state = service.getOrCreateState('stream-1');

      expect(state.step).toBe('collecting_items');
      expect(state.customerName).toBe('John');
    });

    it('should clear state', () => {
      service.updateState('stream-1', { customerName: 'John' });
      service.clearState('stream-1');

      const state = service.getState('stream-1');

      expect(state).toBeUndefined();
    });

    it('should get state', () => {
      service.updateState('stream-1', { customerName: 'John' });

      const state = service.getState('stream-1');

      expect(state?.customerName).toBe('John');
    });
  });

  describe('getNextPrompt', () => {
    it('should return initial prompt for idle state', () => {
      const prompt = service.getNextPrompt('stream-1');

      expect(prompt).not.toBeNull();
      expect(prompt?.field).toBe('items');
      expect(prompt?.prompt).toContain('help you place an order');
    });

    it('should return item collection prompt', () => {
      service.updateState('stream-1', { step: 'collecting_items' });

      const prompt = service.getNextPrompt('stream-1');

      expect(prompt?.field).toBe('items');
    });

    it('should return address prompt', () => {
      service.updateState('stream-1', { step: 'collecting_address' });

      const prompt = service.getNextPrompt('stream-1');

      expect(prompt?.field).toBe('address');
    });

    it('should return contact prompt', () => {
      service.updateState('stream-1', { step: 'collecting_contact' });

      const prompt = service.getNextPrompt('stream-1');

      expect(prompt?.field).toBe('contact');
    });

    it('should return null for complete state', () => {
      service.updateState('stream-1', { step: 'complete' });

      const prompt = service.getNextPrompt('stream-1');

      expect(prompt).toBeNull();
    });
  });

  describe('processInput', () => {
    it('should handle "yes" confirmation', async () => {
      service.updateState('stream-1', { 
        step: 'confirming_items',
        items: [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }],
      });

      const result = await service.processInput('stream-1', 'yes');

      expect(result.state.step).toBe('collecting_address');
      expect(result.response).toContain('delivery address');
    });

    it('should handle "no" rejection during item confirmation', async () => {
      service.updateState('stream-1', { 
        step: 'confirming_items',
        items: [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }],
      });

      const result = await service.processInput('stream-1', 'no');

      expect(result.state.step).toBe('collecting_items');
      expect(result.response).toContain('What else');
    });

    it('should handle "no" rejection during order confirmation', async () => {
      service.updateState('stream-1', { 
        step: 'confirming_order',
        items: [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }],
      });

      const result = await service.processInput('stream-1', 'no');

      expect(result.state.step).toBe('idle');
      expect(result.response).toContain('cancelled');
    });

    it('should handle "thats all" to proceed to address', async () => {
      service.updateState('stream-1', { 
        step: 'collecting_items',
        items: [{ productName: 'Pizza', quantity: 1, unitPrice: 15.99 }],
      });

      const result = await service.processInput('stream-1', "that's all");

      expect(result.state.step).toBe('collecting_address');
    });

    it('should extract items from input with quantity', async () => {
      const result = await service.processInput('stream-1', 'I want 2 large pizzas');

      expect(result.state.items.some(i => i.quantity === 2)).toBe(true);
    });

    it('should handle quantity in order', async () => {
      const result = await service.processInput('stream-1', 'I want 2 large pizzas');

      expect(result.state.items.some(i => i.quantity === 2)).toBe(true);
    });

    it('should validate address input', async () => {
      service.updateState('stream-1', { step: 'collecting_address' });

      const result = await service.processInput('stream-1', 'short');

      expect(result.response).toContain('short');
      expect(result.state.step).toBe('collecting_address');
    });

    it('should accept valid address', async () => {
      service.updateState('stream-1', { step: 'collecting_address' });

      const result = await service.processInput('stream-1', '123 Main Street, New York, NY 10001');

      expect(result.state.deliveryAddress).toBeDefined();
      expect(result.state.step).toBe('collecting_contact');
    });

    it('should extract phone from contact input', async () => {
      service.updateState('stream-1', { step: 'collecting_contact' });

      const result = await service.processInput('stream-1', 'My phone is 555-123-4567');

      expect(result.state.phone).toBeDefined();
      expect(result.state.step).toBe('confirming_order');
    });

    it('should extract email from contact input', async () => {
      service.updateState('stream-1', { step: 'collecting_contact' });

      const result = await service.processInput('stream-1', 'Email me at test@example.com');

      expect(result.state.email).toBeDefined();
      expect(result.state.step).toBe('confirming_order');
    });

    it('should show error for invalid phone', async () => {
      service.updateState('stream-1', { step: 'collecting_contact' });

      const result = await service.processInput('stream-1', 'just a random message');

      expect(result.response).toContain('phone number');
      expect(result.state.step).toBe('collecting_contact');
    });
  });

  describe('formatOrderSummary', () => {
    it('should format order summary correctly', () => {
      const state = service.getOrCreateState('stream-1');
      state.items = [
        { productName: 'Pizza', quantity: 2, unitPrice: 15.99 },
        { productName: 'Soda', quantity: 1, unitPrice: 2.99 },
      ];
      state.deliveryAddress = '123 Main St';
      state.phone = '555-1234';

      const summary = service.formatOrderSummary(state);

      expect(summary).toContain('2x Pizza');
      expect(summary).toContain('1x Soda');
      expect(summary).toContain('Total:');
      expect(summary).toContain('123 Main St');
      expect(summary).toContain('555-1234');
    });
  });

  describe('createOrderFromCall', () => {
    it('should create order from call', async () => {
      const mockCall = {
        id: 'call-1',
        caller: '+1234567890',
      };

      const mockTranscript = {
        id: 'trans-1',
        text: 'I would like a pizza please',
      };

      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-2024-0001',
      };

      mockCallRepository.getCallById.mockResolvedValue(mockCall);
      mockCallRepository.getRecentTranscripts.mockResolvedValue([mockTranscript]);
      mockOrderService.extractCustomerDataFromTranscript.mockReturnValue({
        name: 'John',
        phone: '+1234567890',
      });
      mockOrderService.extractOrderItemsFromTranscript.mockReturnValue([
        { productName: 'Pizza', quantity: 1, unitPrice: 15.99 },
      ]);
      mockOrderService.createOrder.mockResolvedValue({
        order: mockOrder,
        validation: { valid: true, errors: [] },
      });

      const result = await service.createOrderFromCall('stream-1', 'call-1', 'team-1');

      expect(result.success).toBe(true);
      expect(result.order).toEqual(mockOrder);
    });

    it('should return error if call not found', async () => {
      mockCallRepository.getCallById.mockResolvedValue(null);

      const result = await service.createOrderFromCall('stream-1', 'non-existent', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Call not found');
    });

    it('should return error if no items found', async () => {
      mockCallRepository.getCallById.mockResolvedValue({ id: 'call-1' });
      mockCallRepository.getRecentTranscripts.mockResolvedValue([]);
      mockOrderService.extractCustomerDataFromTranscript.mockReturnValue({});
      mockOrderService.extractOrderItemsFromTranscript.mockReturnValue([]);

      const result = await service.createOrderFromCall('stream-1', 'call-1', 'team-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No order items found');
    });
  });

  describe('cleanupSession', () => {
    it('should clear state on cleanup', () => {
      service.updateState('stream-1', { customerName: 'John' });
      
      service.cleanupSession('stream-1');

      expect(service.getState('stream-1')).toBeUndefined();
    });
  });
});
