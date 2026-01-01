import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PaymentService, PaymentInitiationRequest, PaymentConfirmationRequest, RefundRequest } from '../services/paymentService';
import { PaymentLinkService, SendPaymentLinkRequest } from '../services/paymentLinkService';
import { InvoiceService, GenerateInvoiceRequest, SendInvoiceRequest } from '../services/invoiceService';
import { PaymentAnalyticsService, PaymentAnalyticsFilters } from '../services/paymentAnalyticsService';
import { FraudDetectionService, FraudCheckRequest } from '../services/fraudDetectionService';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services
const paymentService = new PaymentService();
const paymentLinkService = new PaymentLinkService();
const invoiceService = new InvoiceService();
const paymentAnalyticsService = new PaymentAnalyticsService();
const fraudDetectionService = new FraudDetectionService();

// Validation schemas

const initiatePaymentSchema = z.object({
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  teamId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('INR').optional(),
  method: z.enum(['card', 'upi', 'netbanking', 'wallet', 'cod', 'payment_link']),
  customerDetails: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const confirmPaymentSchema = z.object({
  paymentId: z.string(),
  transactionId: z.string(),
  status: z.enum(['completed', 'failed']),
  failureReason: z.string().optional(),
  gatewayResponse: z.record(z.string(), z.any()).optional(),
});

const refundPaymentSchema = z.object({
  paymentId: z.string(),
  amount: z.number().positive().optional(),
  reason: z.string().optional(),
});

const createPaymentLinkSchema = z.object({
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  teamId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('INR').optional(),
  description: z.string().optional(),
  expiresIn: z.number().optional(), // hours
});

const sendPaymentLinkSchema = z.object({
  linkId: z.string(),
  phone: z.string(),
  message: z.string().optional(),
});

const createInvoiceSchema = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  customerDetails: z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    billingAddress: z.string(),
  }),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().positive(),
      taxRate: z.number().optional(),
      total: z.number().positive(),
    })
  ),
  taxDetails: z
    .object({
      gst: z.number().optional(),
      cgst: z.number().optional(),
      sgst: z.number().optional(),
      igst: z.number().optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

const sendInvoiceSchema = z.object({
  invoiceId: z.string(),
  sendVia: z.enum(['email', 'sms', 'both']),
});

const fraudCheckSchema = z.object({
  customerId: z.string().optional(),
  teamId: z.string(),
  amount: z.number().positive(),
  method: z.enum(['card', 'upi', 'netbanking', 'wallet', 'cod', 'payment_link']),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

// Payment Endpoints

/**
 * POST /api/payments/initiate
 * Initialize a new payment
 */
router.post('/initiate', async (req: Request, res: Response) => {
  try {
    const validatedData = initiatePaymentSchema.parse(req.body);

    const result = await paymentService.initiatePayment(validatedData);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error initiating payment', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to initiate payment' });
    }
  }
});

/**
 * POST /api/payments/:id/confirm
 * Confirm payment status
 */
router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const confirmPaymentSchemaWithId = confirmPaymentSchema.extend({
      paymentId: z.string().default(req.params.id),
    });

    const validatedData = confirmPaymentSchemaWithId.parse(req.body);

    const payment = await paymentService.confirmPayment(validatedData);

    res.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    logger.error('Error confirming payment', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to confirm payment' });
    }
  }
});

/**
 * GET /api/payments/:id
 * Get payment details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const payment = await paymentService.getPaymentDetails(req.params.id);

    res.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    logger.error('Error getting payment details', error);
    res.status(404).json({ success: false, error: error.message || 'Payment not found' });
  }
});

/**
 * GET /api/payments/order/:orderId
 * Get all payments for an order
 */
router.get('/order/:orderId', async (req: Request, res: Response) => {
  try {
    const payments = await paymentService.getPaymentsByOrder(req.params.orderId);

    res.json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error: any) {
    logger.error('Error getting order payments', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get order payments' });
  }
});

/**
 * POST /api/payments/refund
 * Process a refund
 */
router.post('/refund', async (req: Request, res: Response) => {
  try {
    const validatedData = refundPaymentSchema.parse(req.body);

    const payment = await paymentService.refundPayment(validatedData);

    res.json({
      success: true,
      data: payment,
      message: 'Refund processed successfully',
    });
  } catch (error: any) {
    logger.error('Error processing refund', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to process refund' });
    }
  }
});

/**
 * GET /api/payments/:id/status
 * Check real-time payment status
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const status = await paymentService.checkPaymentStatus(req.params.id);

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    logger.error('Error checking payment status', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to check payment status' });
  }
});

/**
 * GET /api/payments
 * Search/Filter payments
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const filters: any = {};
    if (req.query.teamId) filters.teamId = req.query.teamId as string;
    if (req.query.orderId) filters.orderId = req.query.orderId as string;
    if (req.query.customerId) filters.customerId = req.query.customerId as string;
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.method) filters.method = req.query.method as string;
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    if (req.query.transactionId) filters.transactionId = req.query.transactionId as string;

    const result = await paymentService.searchPayments(limit, offset, filters);

    res.json({
      success: true,
      data: result.payments,
      total: result.total,
      limit,
      offset,
    });
  } catch (error: any) {
    logger.error('Error searching payments', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to search payments' });
  }
});

/**
 * POST /api/payments/webhook
 * Process Razorpay webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      res.status(400).json({ success: false, error: 'Missing webhook signature' });
      return;
    }

    await paymentService.processWebhook(req.body, signature, webhookSecret);

    res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error: any) {
    logger.error('Error processing webhook', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to process webhook' });
  }
});

// Payment Link Endpoints

/**
 * POST /api/payment-links
 * Generate a new payment link
 */
router.post('/links', async (req: Request, res: Response) => {
  try {
    const validatedData = createPaymentLinkSchema.parse(req.body);

    const result = await paymentLinkService.createPaymentLink(validatedData);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error creating payment link', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to create payment link' });
    }
  }
});

/**
 * GET /api/payment-links/:id
 * Get payment link details
 */
router.get('/links/:id', async (req: Request, res: Response) => {
  try {
    const link = await paymentLinkService.getPaymentLink(req.params.id);

    res.json({
      success: true,
      data: link,
    });
  } catch (error: any) {
    logger.error('Error getting payment link', error);
    res.status(404).json({ success: false, error: error.message || 'Payment link not found' });
  }
});

/**
 * POST /api/payment-links/:id/send
 * Send payment link via SMS
 */
router.post('/links/:id/send', async (req: Request, res: Response) => {
  try {
    const sendPaymentLinkSchemaWithId = sendPaymentLinkSchema.extend({
      linkId: z.string().default(req.params.id),
    });

    const validatedData = sendPaymentLinkSchemaWithId.parse(req.body);

    const result = await paymentLinkService.sendPaymentLinkViaSMS(validatedData);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error sending payment link', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to send payment link' });
    }
  }
});

/**
 * GET /api/payment-links/:id/status
 * Check payment link status
 */
router.get('/links/:id/status', async (req: Request, res: Response) => {
  try {
    const status = await paymentLinkService.checkPaymentLinkStatus(req.params.id);

    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    logger.error('Error checking payment link status', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to check payment link status' });
  }
});

/**
 * POST /api/payment-links/:id/cancel
 * Cancel a payment link
 */
router.post('/links/:id/cancel', async (req: Request, res: Response) => {
  try {
    await paymentLinkService.cancelPaymentLink(req.params.id);

    res.json({
      success: true,
      message: 'Payment link cancelled successfully',
    });
  } catch (error: any) {
    logger.error('Error cancelling payment link', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to cancel payment link' });
  }
});

/**
 * POST /api/payment-links/:id/resend
 * Resend payment link
 */
router.post('/links/:id/resend', async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body;

    const result = await paymentLinkService.resendPaymentLink(req.params.id, phone, message);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error resending payment link', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to resend payment link' });
  }
});

// Invoice Endpoints

/**
 * POST /api/invoices
 * Create a new invoice
 */
router.post('/invoices', async (req: Request, res: Response) => {
  try {
    const validatedData = createInvoiceSchema.parse(req.body);

    const result = await invoiceService.createInvoice(validatedData);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error creating invoice', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to create invoice' });
    }
  }
});

/**
 * GET /api/invoices/:id
 * Get invoice details
 */
router.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await invoiceService.getInvoice(req.params.id);

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    logger.error('Error getting invoice', error);
    res.status(404).json({ success: false, error: error.message || 'Invoice not found' });
  }
});

/**
 * GET /api/invoices/number/:invoiceNumber
 * Get invoice by invoice number
 */
router.get('/invoices/number/:invoiceNumber', async (req: Request, res: Response) => {
  try {
    const invoice = await invoiceService.getInvoiceByNumber(req.params.invoiceNumber);

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    logger.error('Error getting invoice by number', error);
    res.status(404).json({ success: false, error: error.message || 'Invoice not found' });
  }
});

/**
 * POST /api/invoices/:id/send
 * Send invoice via email/SMS
 */
router.post('/invoices/:id/send', async (req: Request, res: Response) => {
  try {
    const sendInvoiceSchemaWithId = sendInvoiceSchema.extend({
      invoiceId: z.string().default(req.params.id),
    });

    const validatedData = sendInvoiceSchemaWithId.parse(req.body);

    const result = await invoiceService.sendInvoice(validatedData);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error sending invoice', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to send invoice' });
    }
  }
});

/**
 * POST /api/invoices/auto-generate
 * Auto-generate invoice for a completed payment
 */
router.post('/invoices/auto-generate', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      res.status(400).json({ success: false, error: 'Payment ID is required' });
      return;
    }

    const result = await invoiceService.autoGenerateInvoice(paymentId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error auto-generating invoice', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to auto-generate invoice' });
  }
});

/**
 * GET /api/invoices/:id/download
 * Download invoice PDF
 */
router.get('/invoices/:id/download', async (req: Request, res: Response) => {
  try {
    const pdfBuffer = await invoiceService.downloadInvoicePDF(req.params.id);

    const invoice = await invoiceService.getInvoice(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Error downloading invoice PDF', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to download invoice PDF' });
  }
});

// Payment Analytics Endpoints

/**
 * GET /api/payment-analytics/metrics
 * Get payment metrics
 */
router.get('/analytics/metrics', async (req: Request, res: Response) => {
  try {
    const filters: PaymentAnalyticsFilters = {
      teamId: req.query.teamId as string,
    };
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

    const metrics = await paymentAnalyticsService.getPaymentMetrics(filters);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    logger.error('Error getting payment metrics', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get payment metrics' });
  }
});

/**
 * GET /api/payment-analytics/methods
 * Get payment method breakdown
 */
router.get('/analytics/methods', async (req: Request, res: Response) => {
  try {
    const filters: PaymentAnalyticsFilters = {
      teamId: req.query.teamId as string,
    };
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    if (req.query.paymentMethod) filters.paymentMethod = req.query.paymentMethod as string;

    const breakdown = await paymentAnalyticsService.getMethodBreakdown(filters);

    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error: any) {
    logger.error('Error getting method breakdown', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get method breakdown' });
  }
});

/**
 * GET /api/payment-analytics/trends
 * Get daily payment trends
 */
router.get('/analytics/trends', async (req: Request, res: Response) => {
  try {
    const filters: PaymentAnalyticsFilters = {
      teamId: req.query.teamId as string,
    };
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

    const days = parseInt(req.query.days as string) || 30;

    const trends = await paymentAnalyticsService.getDailyTrends(filters, days);

    res.json({
      success: true,
      data: trends,
    });
  } catch (error: any) {
    logger.error('Error getting daily trends', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get daily trends' });
  }
});

/**
 * GET /api/payment-analytics/dashboard
 * Get comprehensive analytics dashboard
 */
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const filters: PaymentAnalyticsFilters = {
      teamId: req.query.teamId as string,
    };
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

    const dashboard = await paymentAnalyticsService.getAnalyticsDashboard(filters);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error: any) {
    logger.error('Error getting analytics dashboard', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get analytics dashboard' });
  }
});

/**
 * GET /api/payment-analytics/export
 * Export payments as CSV
 */
router.get('/analytics/export', async (req: Request, res: Response) => {
  try {
    const filters: PaymentAnalyticsFilters = {
      teamId: req.query.teamId as string,
    };
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
    if (req.query.paymentMethod) filters.paymentMethod = req.query.paymentMethod as string;

    const csv = await paymentAnalyticsService.exportPaymentsCSV(filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
    res.send(csv);
  } catch (error: any) {
    logger.error('Error exporting payments CSV', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to export payments CSV' });
  }
});

// Fraud Detection Endpoints

/**
 * POST /api/payments/fraud-check
 * Perform fraud check
 */
router.post('/fraud-check', async (req: Request, res: Response) => {
  try {
    const validatedData = fraudCheckSchema.parse(req.body);

    const result = await fraudDetectionService.checkFraud(validatedData);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Error performing fraud check', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Validation error', details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message || 'Failed to perform fraud check' });
    }
  }
});

/**
 * POST /api/payments/:id/report-fraud
 * Report fraud for a payment
 */
router.post('/:id/report-fraud', async (req: Request, res: Response) => {
  try {
    const { reason, reportedBy } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, error: 'Reason is required' });
      return;
    }

    await fraudDetectionService.reportFraud(req.params.id, reason, reportedBy);

    res.json({
      success: true,
      message: 'Fraud reported successfully',
    });
  } catch (error: any) {
    logger.error('Error reporting fraud', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to report fraud' });
  }
});

/**
 * GET /api/payments/fraud-statistics
 * Get fraud statistics
 */
router.get('/fraud-statistics', async (req: Request, res: Response) => {
  try {
    const teamId = req.query.teamId as string;

    if (!teamId) {
      res.status(400).json({ success: false, error: 'Team ID is required' });
      return;
    }

    const stats = await fraudDetectionService.getFraudStatistics(teamId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error getting fraud statistics', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get fraud statistics' });
  }
});

export default router;
