import { PaymentRepository } from './paymentRepository';

describe('PaymentRepository', () => {
  let repository: PaymentRepository;

  beforeEach(() => {
    repository = new PaymentRepository();
  });

  describe('createPayment', () => {
    it('should create a payment with all fields', async () => {
      const paymentData = {
        orderId: 'order-123',
        customerId: 'customer-123',
        teamId: 'team-123',
        amount: 100,
        currency: 'INR',
        method: 'card',
        gateway: 'razorpay',
        transactionId: 'txn-123',
        metadata: { key: 'value' },
      };

      // This test would require actual database connection
      // In production, use test database with mocking
      const result = await repository.createPayment(paymentData);

      expect(result).toBeDefined();
      expect(result.amount).toBe(100);
      expect(result.method).toBe('card');
    });

    it('should serialize metadata to JSON', async () => {
      const paymentData = {
        teamId: 'team-123',
        amount: 100,
        method: 'upi',
        metadata: { customField: 'value', anotherField: 123 },
      };

      const result = await repository.createPayment(paymentData);

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata).toBe('string');
    });
  });

  describe('getPaymentById', () => {
    it('should return payment with all relations', async () => {
      const paymentId = 'payment-123';

      const result = await repository.getPaymentById(paymentId);

      if (result) {
        expect(result.id).toBe(paymentId);
        expect(result.order).toBeDefined();
        expect(result.customer).toBeDefined();
        expect(result.team).toBeDefined();
        expect(result.logs).toBeDefined();
      }
    });

    it('should return null for non-existent payment', async () => {
      const result = await repository.getPaymentById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getPaymentByTransactionId', () => {
    it('should return payment by transaction ID', async () => {
      const transactionId = 'txn-123';

      const result = await repository.getPaymentByTransactionId(transactionId);

      if (result) {
        expect(result.transactionId).toBe(transactionId);
        expect(result).toHaveProperty('order');
        expect(result).toHaveProperty('customer');
      }
    });
  });

  describe('getPaymentsByOrderId', () => {
    it('should return all payments for an order', async () => {
      const orderId = 'order-123';

      const result = await repository.getPaymentsByOrderId(orderId);

      expect(Array.isArray(result)).toBe(true);
      result.forEach((payment) => {
        expect(payment.orderId).toBe(orderId);
      });
    });

    it('should return empty array for order with no payments', async () => {
      const result = await repository.getPaymentsByOrderId('order-without-payments');

      expect(result).toEqual([]);
    });
  });

  describe('getPaymentsByCustomerId', () => {
    it('should return payments for a customer', async () => {
      const customerId = 'customer-123';

      const result = await repository.getPaymentsByCustomerId(customerId, 10);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(10);
      result.forEach((payment) => {
        expect(payment.customerId).toBe(customerId);
      });
    });
  });

  describe('searchPayments', () => {
    it('should apply teamId filter', async () => {
      const filters = {
        teamId: 'team-123',
      };

      const result = await repository.searchPayments(10, 0, filters);

      expect(result.payments).toBeDefined();
      expect(result.total).toBeDefined();
      expect(result.payments.length).toBeLessThanOrEqual(10);
    });

    it('should apply status filter', async () => {
      const filters = {
        teamId: 'team-123',
        status: 'completed',
      };

      const result = await repository.searchPayments(20, 0, filters);

      result.payments.forEach((payment) => {
        expect(payment.status).toBe('completed');
      });
    });

    it('should apply method filter', async () => {
      const filters = {
        teamId: 'team-123',
        method: 'card',
      };

      const result = await repository.searchPayments(20, 0, filters);

      result.payments.forEach((payment) => {
        expect(payment.method).toBe('card');
      });
    });

    it('should apply date range filter', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const filters = {
        teamId: 'team-123',
        startDate,
        endDate,
      };

      const result = await repository.searchPayments(20, 0, filters);

      result.payments.forEach((payment) => {
        expect(payment.timestamp).toBeGreaterThanOrEqual(startDate);
        expect(payment.timestamp).toBeLessThanOrEqual(endDate);
      });
    });

    it('should paginate results correctly', async () => {
      const result1 = await repository.searchPayments(10, 0, {
        teamId: 'team-123',
      });
      const result2 = await repository.searchPayments(10, 10, {
        teamId: 'team-123',
      });

      expect(result1.payments).not.toEqual(result2.payments);
    });
  });

  describe('updatePayment', () => {
    it('should update payment status', async () => {
      const updateData = {
        status: 'completed',
        completedAt: new Date(),
      };

      const result = await repository.updatePayment('payment-123', updateData);

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
    });

    it('should update payment with refund details', async () => {
      const updateData = {
        refundAmount: 50,
        refundStatus: 'completed',
        refundId: 'refund-123',
      };

      const result = await repository.updatePayment('payment-123', updateData);

      expect(result.refundAmount).toBe(50);
      expect(result.refundStatus).toBe('completed');
      expect(result.refundId).toBe('refund-123');
    });

    it('should serialize metadata to JSON', async () => {
      const updateData = {
        metadata: { updatedField: 'newValue' },
      };

      const result = await repository.updatePayment('payment-123', updateData);

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata).toBe('string');
    });
  });

  describe('createPaymentLink', () => {
    it('should create a payment link', async () => {
      const linkData = {
        orderId: 'order-123',
        paymentId: 'payment-123',
        link: 'http://example.com/pay/payment-123',
        shortLink: 'http://example.com/p/abc123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      const result = await repository.createPaymentLink(linkData);

      expect(result).toBeDefined();
      expect(result.link).toBe(linkData.link);
      expect(result.paymentId).toBe('payment-123');
    });
  });

  describe('getPaymentLinkById', () => {
    it('should return payment link with relations', async () => {
      const result = await repository.getPaymentLinkById('link-123');

      if (result) {
        expect(result).toHaveProperty('payment');
        expect(result).toHaveProperty('order');
      }
    });
  });

  describe('updatePaymentLink', () => {
    it('should update payment link status', async () => {
      const result = await repository.updatePaymentLink('link-123', {
        status: 'clicked',
        clickedAt: new Date(),
      });

      expect(result.status).toBe('clicked');
      expect(result.clickedAt).toBeDefined();
    });

    it('should increment sent count', async () => {
      const result = await repository.updatePaymentLink('link-123', {
        sentCount: 5,
        sentAt: new Date(),
      });

      expect(result.sentCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('createPaymentLog', () => {
    it('should create a payment log', async () => {
      const logData = {
        paymentId: 'payment-123',
        action: 'initiated',
        status: 'success',
        metadata: { detail: 'Payment started' },
      };

      const result = await repository.createPaymentLog(logData);

      expect(result).toBeDefined();
      expect(result.action).toBe('initiated');
      expect(result.status).toBe('success');
    });

    it('should serialize metadata to JSON', async () => {
      const logData = {
        paymentId: 'payment-123',
        action: 'webhook_received',
        status: 'success',
        metadata: { webhookEvent: 'payment.captured' },
      };

      const result = await repository.createPaymentLog(logData);

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata).toBe('string');
    });
  });

  describe('getPaymentLogs', () => {
    it('should return logs for a payment', async () => {
      const result = await repository.getPaymentLogs('payment-123', 50);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(50);
      result.forEach((log) => {
        expect(log.paymentId).toBe('payment-123');
      });
    });

    it('should return logs in descending order by timestamp', async () => {
      const result = await repository.getPaymentLogs('payment-123', 50);

      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].timestamp.getTime()).toBeGreaterThanOrEqual(result[i + 1].timestamp.getTime());
      }
    });
  });

  describe('createInvoice', () => {
    it('should create an invoice', async () => {
      const invoiceData = {
        orderId: 'order-123',
        paymentId: 'payment-123',
        invoiceNumber: 'INV-2024-001',
        items: [
          { name: 'Product 1', quantity: 2, unitPrice: 50, total: 100 },
        ],
        taxAmount: 18,
        totalAmount: 118,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '+1234567890',
        billingAddress: '123 Main St',
      };

      const result = await repository.createInvoice(invoiceData);

      expect(result).toBeDefined();
      expect(result.invoiceNumber).toBe('INV-2024-001');
      expect(result.totalAmount).toBe(118);
    });

    it('should serialize items and taxDetails to JSON', async () => {
      const invoiceData = {
        paymentId: 'payment-123',
        invoiceNumber: 'INV-2024-002',
        items: [{ name: 'Item 1', quantity: 1, unitPrice: 100, total: 100 }],
        taxDetails: { gst: 18, cgst: 9, sgst: 9 },
        totalAmount: 118,
      };

      const result = await repository.createInvoice(invoiceData);

      expect(result.items).toBeDefined();
      expect(typeof result.items).toBe('string');
      expect(result.taxDetails).toBeDefined();
      expect(typeof result.taxDetails).toBe('string');
    });
  });

  describe('getInvoiceById', () => {
    it('should return invoice with parsed JSON fields', async () => {
      const result = await repository.getInvoiceById('invoice-123');

      if (result) {
        expect(result).toHaveProperty('items');
        expect(result).toHaveProperty('taxDetails');
        expect(Array.isArray(result.items)).toBe(true);
      }
    });
  });

  describe('getInvoiceByInvoiceNumber', () => {
    it('should return invoice by invoice number', async () => {
      const result = await repository.getInvoiceByInvoiceNumber('INV-2024-001');

      if (result) {
        expect(result.invoiceNumber).toBe('INV-2024-001');
        expect(Array.isArray(result.items)).toBe(true);
      }
    });
  });

  describe('updateInvoice', () => {
    it('should update invoice status', async () => {
      const result = await repository.updateInvoice('invoice-123', {
        status: 'sent',
        sentAt: new Date(),
        sentVia: 'email',
      });

      expect(result.status).toBe('sent');
      expect(result.sentAt).toBeDefined();
      expect(result.sentVia).toBe('email');
    });
  });

  describe('createOrUpdatePaymentAnalytics', () => {
    it('should create new analytics record', async () => {
      const analyticsData = {
        teamId: 'team-123',
        totalRevenue: 10000,
        successRate: 95,
        methodBreakdown: { card: 50, upi: 30, cod: 20 },
      };

      const result = await repository.createOrUpdatePaymentAnalytics('team-123', analyticsData);

      expect(result.teamId).toBe('team-123');
      expect(result.totalRevenue).toBe(10000);
    });

    it('should update existing analytics record', async () => {
      const analyticsData = {
        totalRevenue: 20000,
        successRate: 96,
      };

      const result = await repository.createOrUpdatePaymentAnalytics('team-123', analyticsData);

      expect(result.totalRevenue).toBe(20000);
      expect(result.lastUpdated).toBeDefined();
    });

    it('should serialize methodBreakdown to JSON', async () => {
      const analyticsData = {
        methodBreakdown: { card: 50, upi: 30, cod: 20 },
      };

      const result = await repository.createOrUpdatePaymentAnalytics('team-123', analyticsData);

      expect(result.methodBreakdown).toBeDefined();
      expect(typeof result.methodBreakdown).toBe('string');
    });
  });

  describe('getPaymentStatsByTeam', () => {
    it('should return payment statistics for a team', async () => {
      const result = await repository.getPaymentStatsByTeam('team-123');

      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalPayments');
      expect(result).toHaveProperty('successRate');
      expect(result).toHaveProperty('averageAmount');
      expect(typeof result.totalRevenue).toBe('number');
      expect(typeof result.totalPayments).toBe('number');
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const result = await repository.getPaymentStatsByTeam('team-123', startDate, endDate);

      expect(result).toBeDefined();
      expect(result.totalPayments).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getTopPaymentMethods', () => {
    it('should return top payment methods', async () => {
      const result = await repository.getTopPaymentMethods('team-123', 5);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
      result.forEach((method) => {
        expect(method).toHaveProperty('method');
        expect(method).toHaveProperty('count');
        expect(method).toHaveProperty('totalAmount');
      });
    });

    it('should sort by total amount', async () => {
      const result = await repository.getTopPaymentMethods('team-123', 5);

      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].totalAmount).toBeGreaterThanOrEqual(result[i + 1].totalAmount);
      }
    });
  });

  describe('getFailedPayments', () => {
    it('should return failed payments', async () => {
      const result = await repository.getFailedPayments('team-123', 20);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(20);
      result.forEach((payment) => {
        expect(payment.status).toBe('failed');
      });
    });

    it('should include failure reasons', async () => {
      const result = await repository.getFailedPayments('team-123', 20);

      result.forEach((payment) => {
        expect(payment).toHaveProperty('failureReason');
      });
    });
  });

  describe('getRefundablePayments', () => {
    it('should return refundable payments for an order', async () => {
      const result = await repository.getRefundablePayments('order-123');

      expect(Array.isArray(result)).toBe(true);
      result.forEach((payment) => {
        expect(payment.status).toBe('completed');
        expect(payment.refundStatus).toBeNull();
      });
    });
  });

  describe('getPaymentsByStatus', () => {
    it('should return payments by status', async () => {
      const result = await repository.getPaymentsByStatus('completed', 'team-123', 50);

      expect(Array.isArray(result)).toBe(true);
      result.forEach((payment) => {
        expect(payment.status).toBe('completed');
      });
    });

    it('should filter by team if provided', async () => {
      const result = await repository.getPaymentsByStatus('pending', 'team-123', 50);

      result.forEach((payment) => {
        expect(payment.status).toBe('pending');
        expect(payment.teamId).toBe('team-123');
      });
    });
  });
});
