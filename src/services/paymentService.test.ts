import { PaymentService, PaymentInitiationRequest, PaymentConfirmationRequest, RefundRequest } from '../services/paymentService';
import { PaymentRepository } from '../db/repositories/paymentRepository';

// Mock repository
jest.mock('../db/repositories/paymentRepository', () => ({
  PaymentRepository: jest.fn().mockImplementation(() => ({
    createPayment: jest.fn(),
    getPaymentById: jest.fn(),
    getPaymentByTransactionId: jest.fn(),
    getPaymentsByOrderId: jest.fn(),
    getPaymentsByCustomerId: jest.fn(),
    searchPayments: jest.fn(),
    updatePayment: jest.fn(),
    deletePayment: jest.fn(),
    createPaymentLog: jest.fn(),
    getPaymentLogs: jest.fn(),
    createPaymentLink: jest.fn(),
    getPaymentLinkById: jest.fn(),
    updatePaymentLink: jest.fn(),
    getPaymentAnalytics: jest.fn(),
    createOrUpdatePaymentAnalytics: jest.fn(),
    getPaymentStatsByTeam: jest.fn(),
    getPaymentsByStatus: jest.fn(),
    getTopPaymentMethods: jest.fn(),
    getFailedPayments: jest.fn(),
    getRefundablePayments: jest.fn(),
  })),
}));

// Mock Razorpay
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    key_id: 'rzp_test_key',
    orders: {
      create: jest.fn(),
    },
    payments: {
      fetch: jest.fn(),
      refund: jest.fn(),
    },
  }));
});

describe('PaymentService', () => {
  let service: PaymentService;
  let mockRepository: jest.Mocked<PaymentRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentService();
    mockRepository = (service as any).paymentRepository;
  });

  describe('getAvailablePaymentMethods', () => {
    it('should return all available payment methods', () => {
      const methods = service.getAvailablePaymentMethods();

      expect(methods).toHaveLength(6);
      expect(methods[0].type).toBe('card');
      expect(methods[1].type).toBe('upi');
      expect(methods.some((m) => m.type === 'cod')).toBe(true);
    });

    it('should have all methods enabled', () => {
      const methods = service.getAvailablePaymentMethods();

      methods.forEach((method) => {
        expect(method.enabled).toBe(true);
      });
    });
  });

  describe('validateAmount', () => {
    it('should validate valid amounts', () => {
      expect(service['validateAmount'](10)).toBe(true);
      expect(service['validateAmount'](1000)).toBe(true);
      expect(service['validateAmount'](50000)).toBe(true);
    });

    it('should reject invalid amounts', () => {
      expect(service['validateAmount'](0)).toBe(false);
      expect(service['validateAmount'](-1)).toBe(false);
      expect(service['validateAmount'](100001)).toBe(false);
    });
  });

  describe('validatePaymentMethod', () => {
    it('should validate correct payment methods', () => {
      expect(service['validatePaymentMethod']('card')).toBe(true);
      expect(service['validatePaymentMethod']('upi')).toBe(true);
      expect(service['validatePaymentMethod']('netbanking')).toBe(true);
      expect(service['validatePaymentMethod']('wallet')).toBe(true);
      expect(service['validatePaymentMethod']('cod')).toBe(true);
      expect(service['validatePaymentMethod']('payment_link')).toBe(true);
    });

    it('should reject invalid payment methods', () => {
      expect(service['validatePaymentMethod']('invalid')).toBe(false);
      expect(service['validatePaymentMethod']('')).toBe(false);
    });
  });

  describe('initiatePayment', () => {
    it('should initiate a payment successfully', async () => {
      const request: PaymentInitiationRequest = {
        orderId: 'order-123',
        teamId: 'team-123',
        amount: 100,
        method: 'card',
      };

      const mockPayment = {
        id: 'payment-123',
        amount: 100,
        status: 'pending',
      };

      const mockRazorpayOrder = {
        id: 'order_rzp_123',
        amount: 10000,
        currency: 'INR',
      };

      mockRepository.createPayment.mockResolvedValue(mockPayment as any);
      mockRepository.createPaymentLog.mockResolvedValue({} as any);

      // Mock Razorpay order creation
      const razorpay = (service as any).razorpay;
      razorpay.orders.create.mockResolvedValue(mockRazorpayOrder);

      const result = await service.initiatePayment(request);

      expect(result.paymentId).toBe('payment-123');
      expect(mockRepository.createPayment).toHaveBeenCalled();
      expect(mockRepository.createPaymentLog).toHaveBeenCalled();
    });

    it('should throw error for invalid amount', async () => {
      const request: PaymentInitiationRequest = {
        teamId: 'team-123',
        amount: 0,
        method: 'card',
      };

      await expect(service.initiatePayment(request)).rejects.toThrow('Invalid payment amount');
    });

    it('should throw error for invalid payment method', async () => {
      const request: PaymentInitiationRequest = {
        teamId: 'team-123',
        amount: 100,
        method: 'invalid' as any,
      };

      await expect(service.initiatePayment(request)).rejects.toThrow('Invalid payment method');
    });
  });

  describe('confirmPayment', () => {
    it('should confirm a completed payment', async () => {
      const request: PaymentConfirmationRequest = {
        paymentId: 'payment-123',
        transactionId: 'txn-123',
        status: 'completed',
      };

      const mockPayment = {
        id: 'payment-123',
        status: 'pending',
        teamId: 'team-123',
        metadata: '{}',
      };

      const mockUpdatedPayment = {
        id: 'payment-123',
        status: 'completed',
        completedAt: new Date(),
      };

      mockRepository.getPaymentById.mockResolvedValue(mockPayment as any);
      mockRepository.updatePayment.mockResolvedValue(mockUpdatedPayment as any);
      mockRepository.createPaymentLog.mockResolvedValue({} as any);
      mockRepository.createOrUpdatePaymentAnalytics.mockResolvedValue({} as any);

      const result = await service.confirmPayment(request);

      expect(result.status).toBe('completed');
      expect(mockRepository.updatePayment).toHaveBeenCalled();
    });

    it('should handle failed payment confirmation', async () => {
      const request: PaymentConfirmationRequest = {
        paymentId: 'payment-123',
        transactionId: 'txn-123',
        status: 'failed',
        failureReason: 'Insufficient funds',
      };

      const mockPayment = {
        id: 'payment-123',
        status: 'pending',
        metadata: '{}',
      };

      mockRepository.getPaymentById.mockResolvedValue(mockPayment as any);
      mockRepository.updatePayment.mockResolvedValue({
        status: 'failed',
        failureReason: 'Insufficient funds',
      } as any);
      mockRepository.createPaymentLog.mockResolvedValue({} as any);

      const result = await service.confirmPayment(request);

      expect(result.status).toBe('failed');
      expect(result.failureReason).toBe('Insufficient funds');
    });
  });

  describe('refundPayment', () => {
    it('should refund a payment successfully', async () => {
      const request: RefundRequest = {
        paymentId: 'payment-123',
        amount: 50,
        reason: 'Customer request',
      };

      const mockPayment = {
        id: 'payment-123',
        status: 'completed',
        amount: 100,
        transactionId: 'txn-123',
        teamId: 'team-123',
        refundStatus: null,
        metadata: '{}',
      };

      const mockRefund = {
        id: 'refund-123',
        amount: 5000,
      };

      mockRepository.getPaymentById.mockResolvedValue(mockPayment as any);
      mockRepository.updatePayment.mockResolvedValue({
        ...mockPayment,
        refundAmount: 50,
        refundStatus: 'completed',
        refundId: 'refund-123',
      } as any);
      mockRepository.createPaymentLog.mockResolvedValue({} as any);
      mockRepository.createOrUpdatePaymentAnalytics.mockResolvedValue({} as any);

      // Mock Razorpay refund
      const razorpay = (service as any).razorpay;
      razorpay.payments.refund.mockResolvedValue(mockRefund);

      const result = await service.refundPayment(request);

      expect(result.refundAmount).toBe(50);
      expect(result.refundStatus).toBe('completed');
      expect(razorpay.payments.refund).toHaveBeenCalled();
    });

    it('should not refund already refunded payments', async () => {
      const request: RefundRequest = {
        paymentId: 'payment-123',
      };

      const mockPayment = {
        id: 'payment-123',
        status: 'completed',
        refundStatus: 'completed',
        metadata: '{}',
      };

      mockRepository.getPaymentById.mockResolvedValue(mockPayment as any);

      await expect(service.refundPayment(request)).rejects.toThrow('Payment already refunded');
    });
  });

  describe('getPaymentDetails', () => {
    it('should return payment details', async () => {
      const mockPayment = {
        id: 'payment-123',
        amount: 100,
        metadata: '{"key": "value"}',
      };

      mockRepository.getPaymentById.mockResolvedValue(mockPayment as any);

      const result = await service.getPaymentDetails('payment-123');

      expect(result.id).toBe('payment-123');
      expect(result.metadata).toEqual({ key: 'value' });
    });

    it('should throw error for non-existent payment', async () => {
      mockRepository.getPaymentById.mockResolvedValue(null);

      await expect(service.getPaymentDetails('invalid-id')).rejects.toThrow('Payment not found');
    });
  });

  describe('searchPayments', () => {
    it('should return filtered payments', async () => {
      const mockPayments = [
        { id: 'payment-1', amount: 100, status: 'completed', metadata: '{}' },
        { id: 'payment-2', amount: 200, status: 'pending', metadata: '{}' },
      ];

      mockRepository.searchPayments.mockResolvedValue({
        payments: mockPayments as any,
        total: 2,
      });

      const result = await service.searchPayments(10, 0, {
        status: 'completed',
      });

      expect(result.payments).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockRepository.searchPayments).toHaveBeenCalledWith(10, 0, { status: 'completed' });
    });
  });

  describe('detectFraud', () => {
    it('should detect multiple failed payments', async () => {
      const mockPayments = [
        { id: 'payment-1', status: 'failed', timestamp: new Date(Date.now() - 10 * 60 * 1000) },
        { id: 'payment-2', status: 'failed', timestamp: new Date(Date.now() - 5 * 60 * 1000) },
        { id: 'payment-3', status: 'failed', timestamp: new Date() },
      ];

      mockRepository.getPaymentsByCustomerId.mockResolvedValue(mockPayments as any);

      const result = await service['detectFraud']('customer-123', 'team-123');

      expect(result.isFraudulent).toBe(true);
      expect(result.reasons).toContain('Multiple failed payment attempts in short time');
    });

    it('should not flag legitimate customers', async () => {
      const mockPayments = [
        { id: 'payment-1', status: 'completed', timestamp: new Date() },
      ];

      mockRepository.getPaymentsByCustomerId.mockResolvedValue(mockPayments as any);
      mockRepository.searchPayments.mockResolvedValue({
        payments: [],
        total: 0,
      });

      const result = await service['detectFraud']('customer-123', 'team-123');

      expect(result.isFraudulent).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });
});
