import request from 'supertest';
import express from 'express';
import paymentsRouter from '../routes/payments';

// Mock services
jest.mock('../services/paymentService');
jest.mock('../services/paymentLinkService');
jest.mock('../services/invoiceService');
jest.mock('../services/paymentAnalyticsService');
jest.mock('../services/fraudDetectionService');

describe('Payments Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/payments', paymentsRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/payments/initiate', () => {
    it('should initiate a payment successfully', async () => {
      const paymentData = {
        teamId: 'team-123',
        amount: 100,
        method: 'card',
        orderId: 'order-123',
      };

      const mockResponse = {
        paymentId: 'payment-123',
        order: { id: 'order_rzp_123', amount: 10000 },
        keyId: 'rzp_test_key',
      };

      const { PaymentService } = require('../services/paymentService');
      PaymentService.prototype.initiatePayment.mockResolvedValue(mockResponse);

      const response = await request(app).post('/api/payments/initiate').send(paymentData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentId).toBe('payment-123');
      expect(PaymentService.prototype.initiatePayment).toHaveBeenCalledWith(paymentData);
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        teamId: 'team-123',
        amount: -100, // Invalid amount
        method: 'invalid',
      };

      const response = await request(app).post('/api/payments/initiate').send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/:id', () => {
    it('should return payment details', async () => {
      const mockPayment = {
        id: 'payment-123',
        amount: 100,
        status: 'completed',
        method: 'card',
      };

      const { PaymentService } = require('../services/paymentService');
      PaymentService.prototype.getPaymentDetails.mockResolvedValue(mockPayment);

      const response = await request(app).get('/api/payments/payment-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('payment-123');
    });

    it('should return 404 for non-existent payment', async () => {
      const { PaymentService } = require('../services/paymentService');
      PaymentService.prototype.getPaymentDetails.mockRejectedValue(new Error('Payment not found'));

      const response = await request(app).get('/api/payments/invalid-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/order/:orderId', () => {
    it('should return all payments for an order', async () => {
      const mockPayments = [
        { id: 'payment-1', amount: 100, status: 'completed' },
        { id: 'payment-2', amount: 50, status: 'pending' },
      ];

      const { PaymentService } = require('../services/paymentService');
      PaymentService.prototype.getPaymentsByOrder.mockResolvedValue(mockPayments);

      const response = await request(app).get('/api/payments/order/order-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });
  });

  describe('POST /api/payments/refund', () => {
    it('should process a refund successfully', async () => {
      const refundData = {
        paymentId: 'payment-123',
        amount: 50,
        reason: 'Customer request',
      };

      const mockPayment = {
        id: 'payment-123',
        amount: 100,
        refundAmount: 50,
        refundStatus: 'completed',
      };

      const { PaymentService } = require('../services/paymentService');
      PaymentService.prototype.refundPayment.mockResolvedValue(mockPayment);

      const response = await request(app).post('/api/payments/refund').send(refundData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Refund processed successfully');
    });

    it('should return validation error for invalid refund data', async () => {
      const invalidData = {
        paymentId: 'payment-123',
        amount: -50, // Invalid amount
      };

      const response = await request(app).post('/api/payments/refund').send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/links', () => {
    it('should create a payment link', async () => {
      const linkData = {
        teamId: 'team-123',
        amount: 100,
        orderId: 'order-123',
      };

      const mockLink = {
        paymentId: 'payment-123',
        linkId: 'link-123',
        link: 'http://localhost:3000/pay/payment-123',
        shortLink: 'http://localhost:3000/p/abc123',
        expiresAt: new Date(),
      };

      const { PaymentLinkService } = require('../services/paymentLinkService');
      PaymentLinkService.prototype.createPaymentLink.mockResolvedValue(mockLink);

      const response = await request(app).post('/api/payments/links').send(linkData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.paymentId).toBe('payment-123');
    });
  });

  describe('GET /api/payments/links/:id', () => {
    it('should return payment link details', async () => {
      const mockLink = {
        id: 'link-123',
        link: 'http://localhost:3000/pay/payment-123',
        status: 'pending',
        expiresAt: new Date(),
      };

      const { PaymentLinkService } = require('../services/paymentLinkService');
      PaymentLinkService.prototype.getPaymentLink.mockResolvedValue(mockLink);

      const response = await request(app).get('/api/payments/links/link-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('link-123');
    });

    it('should return error for expired link', async () => {
      const { PaymentLinkService } = require('../services/paymentLinkService');
      PaymentLinkService.prototype.getPaymentLink.mockRejectedValue(
        new Error('Payment link has expired')
      );

      const response = await request(app).get('/api/payments/links/expired-link');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/invoices', () => {
    it('should create an invoice', async () => {
      const invoiceData = {
        orderId: 'order-123',
        paymentId: 'payment-123',
        customerDetails: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          billingAddress: '123 Main St',
        },
        items: [
          {
            name: 'Product 1',
            quantity: 2,
            unitPrice: 50,
            total: 100,
          },
        ],
      };

      const mockInvoice = {
        invoiceId: 'invoice-123',
        invoiceNumber: 'INV-202401-abc123',
        pdfUrl: 'http://localhost:3000/invoices/INV-202401-abc123.pdf',
      };

      const { InvoiceService } = require('../services/invoiceService');
      InvoiceService.prototype.createInvoice.mockResolvedValue(mockInvoice);

      const response = await request(app).post('/api/payments/invoices').send(invoiceData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.invoiceId).toBe('invoice-123');
    });
  });

  describe('GET /api/payments/analytics/metrics', () => {
    it('should return payment metrics', async () => {
      const mockMetrics = {
        totalRevenue: 10000,
        totalPayments: 100,
        completedPayments: 90,
        failedPayments: 10,
        successRate: 90,
        averageAmount: 100,
      };

      const { PaymentAnalyticsService } = require('../services/paymentAnalyticsService');
      PaymentAnalyticsService.prototype.getPaymentMetrics.mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/payments/analytics/metrics')
        .query({ teamId: 'team-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRevenue).toBe(10000);
    });

    it('should require teamId parameter', async () => {
      const response = await request(app).get('/api/payments/analytics/metrics');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/fraud-check', () => {
    it('should perform fraud check', async () => {
      const fraudData = {
        teamId: 'team-123',
        amount: 100,
        method: 'card',
        customerId: 'customer-123',
      };

      const mockResult = {
        isFraudulent: false,
        riskLevel: 'low',
        score: 0,
        reasons: [],
        actions: [],
      };

      const { FraudDetectionService } = require('../services/fraudDetectionService');
      FraudDetectionService.prototype.checkFraud.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/payments/fraud-check').send(fraudData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isFraudulent).toBe(false);
      expect(response.body.data.riskLevel).toBe('low');
    });

    it('should detect fraudulent payment', async () => {
      const fraudData = {
        teamId: 'team-123',
        amount: 100,
        method: 'card',
      };

      const mockResult = {
        isFraudulent: true,
        riskLevel: 'high',
        score: 75,
        reasons: ['Multiple failed payment attempts'],
        actions: ['block', 'manual_review'],
      };

      const { FraudDetectionService } = require('../services/fraudDetectionService');
      FraudDetectionService.prototype.checkFraud.mockResolvedValue(mockResult);

      const response = await request(app).post('/api/payments/fraud-check').send(fraudData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isFraudulent).toBe(true);
      expect(response.body.data.riskLevel).toBe('high');
      expect(response.body.data.actions).toContain('block');
    });
  });

  describe('GET /api/payments', () => {
    it('should return filtered payments', async () => {
      const mockPayments = [
        { id: 'payment-1', amount: 100, status: 'completed' },
        { id: 'payment-2', amount: 200, status: 'completed' },
      ];

      const { PaymentService } = require('../services/paymentService');
      PaymentService.prototype.searchPayments.mockResolvedValue({
        payments: mockPayments,
        total: 2,
      });

      const response = await request(app)
        .get('/api/payments')
        .query({ teamId: 'team-123', status: 'completed', limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });
  });

  describe('POST /api/payments/:id/report-fraud', () => {
    it('should report fraud for a payment', async () => {
      const { FraudDetectionService } = require('../services/fraudDetectionService');
      FraudDetectionService.prototype.reportFraud.mockResolvedValue();

      const response = await request(app)
        .post('/api/payments/payment-123/report-fraud')
        .send({ reason: 'Suspicious activity detected' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Fraud reported successfully');
    });

    it('should require reason for fraud report', async () => {
      const response = await request(app).post('/api/payments/payment-123/report-fraud').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
