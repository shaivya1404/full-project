import { PaymentRepository, CreatePaymentInput, UpdatePaymentInput, PaymentFilters } from '../db/repositories/paymentRepository';
import { Payment, PaymentLink, PaymentLog, Invoice, PaymentAnalytics } from '@prisma/client';
import { logger } from '../utils/logger';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import QRCode from 'qrcode';

export interface PaymentMethod {
  type: 'card' | 'upi' | 'netbanking' | 'wallet' | 'cod' | 'payment_link';
  name: string;
  enabled: boolean;
  icon?: string;
}

export interface CardPaymentDetails {
  number: string;
  expiry: string;
  cvv: string;
  name: string;
}

export interface UpiPaymentDetails {
  vpa: string; // Virtual Payment Address (UPI ID)
  name?: string;
}

export interface PaymentInitiationRequest {
  orderId?: string;
  customerId?: string;
  teamId: string;
  amount: number;
  currency?: string;
  method: string;
  customerDetails?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentConfirmationRequest {
  paymentId: string;
  transactionId: string;
  status: 'completed' | 'failed';
  failureReason?: string;
  gatewayResponse?: Record<string, any>;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number; // Partial refund if specified, otherwise full refund
  reason?: string;
}

export interface PaymentLinkRequest {
  orderId?: string;
  customerId?: string;
  teamId: string;
  amount: number;
  currency?: string;
  description?: string;
  expiresIn?: number; // hours
}

export interface InvoiceData {
  orderId: string;
  paymentId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  billingAddress: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    total: number;
  }>;
  taxDetails?: {
    gst?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
  };
  totalAmount: number;
  notes?: string;
}

export class PaymentService {
  private paymentRepository: PaymentRepository;
  private razorpay: Razorpay;

  constructor() {
    this.paymentRepository = new PaymentRepository();

    // Initialize Razorpay
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder';

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  // Get available payment methods
  getAvailablePaymentMethods(): PaymentMethod[] {
    return [
      { type: 'card', name: 'Credit/Debit Card', enabled: true },
      { type: 'upi', name: 'UPI (Google Pay, PhonePe, Paytm)', enabled: true },
      { type: 'netbanking', name: 'Net Banking', enabled: true },
      { type: 'wallet', name: 'Digital Wallet', enabled: true },
      { type: 'payment_link', name: 'Pay via Link', enabled: true },
      { type: 'cod', name: 'Cash on Delivery', enabled: true },
    ];
  }

  // Validate payment amount
  validateAmount(amount: number): boolean {
    const minAmount = 1; // INR 1
    const maxAmount = 100000; // INR 1,00,000
    return amount >= minAmount && amount <= maxAmount;
  }

  // Validate payment method
  validatePaymentMethod(method: string): boolean {
    const validMethods = ['card', 'upi', 'netbanking', 'wallet', 'cod', 'payment_link'];
    return validMethods.includes(method);
  }

  // Initialize payment with Razorpay
  async initiatePayment(request: PaymentInitiationRequest): Promise<{ paymentId: string; order: any; keyId: string }> {
    try {
      // Validate request
      if (!this.validateAmount(request.amount)) {
        throw new Error('Invalid payment amount');
      }

      if (!this.validatePaymentMethod(request.method)) {
        throw new Error('Invalid payment method');
      }

      // Create Razorpay order
      const razorpayOrderOptions: any = {
        amount: request.amount * 100, // Razorpay expects amount in paise
        currency: request.currency || 'INR',
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1, // Auto capture
        notes: {
          orderId: request.orderId,
          customerId: request.customerId,
          teamId: request.teamId,
          ...request.metadata,
        },
      };

      if (request.customerDetails) {
        razorpayOrderOptions.customer = {
          name: request.customerDetails.name,
          email: request.customerDetails.email,
          contact: request.customerDetails.phone,
        };
      }

      const razorpayOrder = await this.razorpay.orders.create(razorpayOrderOptions);

      // Create payment record
      const paymentInput: CreatePaymentInput = {
        orderId: request.orderId,
        customerId: request.customerId,
        teamId: request.teamId,
        amount: request.amount,
        currency: request.currency || 'INR',
        method: request.method,
        gateway: 'razorpay',
        transactionId: razorpayOrder.id,
        metadata: {
          razorpayOrderId: razorpayOrder.id,
          ...request.metadata,
        },
      };

      // Set expiration for payment_link
      if (request.method === 'payment_link') {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        paymentInput.expiresAt = expiresAt;
      }

      const payment = await this.paymentRepository.createPayment(paymentInput);

      // Log initiation
      await this.paymentRepository.createPaymentLog({
        paymentId: payment.id,
        action: 'initiated',
        status: 'success',
        metadata: { razorpayOrderId: razorpayOrder.id },
      });

      return {
        paymentId: payment.id,
        order: razorpayOrder,
        keyId: (this.razorpay as any).key_id,
      };
    } catch (error) {
      logger.error('Error initiating payment', error);
      throw error;
    }
  }

  // Confirm payment (after successful Razorpay payment)
  async confirmPayment(request: PaymentConfirmationRequest): Promise<Payment> {
    try {
      const payment = await this.paymentRepository.getPaymentById(request.paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Update payment status
      const updateData: UpdatePaymentInput = {
        status: request.status,
      };

      if (request.status === 'completed') {
        updateData.completedAt = new Date();
        if (request.transactionId && !payment.transactionId) {
          updateData.transactionId = request.transactionId;
        }
      } else if (request.status === 'failed') {
        updateData.failureReason = request.failureReason || 'Payment failed';
      }

      if (request.gatewayResponse) {
        updateData.metadata = {
          ...JSON.parse(payment.metadata || '{}'),
          gatewayResponse: request.gatewayResponse,
        };
      }

      const updatedPayment = await this.paymentRepository.updatePayment(payment.id, updateData);

      // Log confirmation
      await this.paymentRepository.createPaymentLog({
        paymentId: payment.id,
        action: request.status === 'completed' ? 'completed' : 'failed',
        status: 'success',
        metadata: request.gatewayResponse,
      });

      // Update analytics
      if (request.status === 'completed' && payment.teamId) {
        await this.updatePaymentAnalytics(payment.teamId);
      }

      return updatedPayment;
    } catch (error) {
      logger.error('Error confirming payment', error);
      throw error;
    }
  }

  // Process Razorpay webhook
  async processWebhook(webhookData: any, signature: string, webhookSecret: string): Promise<void> {
    try {
      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(webhookData))
        .digest('hex');

      if (expectedSignature !== signature) {
        throw new Error('Invalid webhook signature');
      }

      const event = webhookData.event;
      const payload = webhookData.payload.payment.entity;

      // Find payment by Razorpay order ID
      const payments = await this.paymentRepository.searchPayments(1, 0, {
        transactionId: payload.order_id,
      });

      if (payments.payments.length === 0) {
        logger.warn(`Payment not found for Razorpay order ${payload.order_id}`);
        return;
      }

      const payment = payments.payments[0];

      if (event === 'payment.captured') {
        await this.confirmPayment({
          paymentId: payment.id,
          transactionId: payload.id,
          status: 'completed',
          gatewayResponse: payload,
        });
      } else if (event === 'payment.failed') {
        await this.confirmPayment({
          paymentId: payment.id,
          transactionId: payload.id,
          status: 'failed',
          failureReason: payload.error?.description || 'Payment failed',
          gatewayResponse: payload,
        });
      }

      // Log webhook received
      await this.paymentRepository.createPaymentLog({
        paymentId: payment.id,
        action: 'webhook_received',
        status: 'success',
        metadata: { event, payload },
      });
    } catch (error) {
      logger.error('Error processing webhook', error);
      throw error;
    }
  }

  // Generate UPI payment string and QR code
  async generateUpiPayment(upiDetails: UpiPaymentDetails, amount: number, description?: string): Promise<{ upiString: string; qrCode: string }> {
    try {
      // UPI payment link format
      const upiString = `upi://pay?pa=${upiDetails.vpa}&pn=${encodeURIComponent(upiDetails.name || '')}&am=${amount}&tn=${encodeURIComponent(description || '')}&cu=INR`;

      // Generate QR code
      const qrCode = await QRCode.toDataURL(upiString);

      return { upiString, qrCode };
    } catch (error) {
      logger.error('Error generating UPI payment', error);
      throw error;
    }
  }

  // Tokenize card payment (for returning customers)
  async tokenizeCard(cardDetails: CardPaymentDetails): Promise<{ token: string; last4: string; brand: string }> {
    try {
      // Note: In production, this would use Razorpay's card tokenization API
      // For security, we NEVER store full card numbers
      const last4 = cardDetails.number.slice(-4);

      // Detect card brand
      let brand = 'unknown';
      if (cardDetails.number.startsWith('4')) brand = 'visa';
      else if (cardDetails.number.startsWith('5')) brand = 'mastercard';
      else if (cardDetails.number.startsWith('6')) brand = 'rupay';

      // Generate a secure token (in production, this comes from Razorpay)
      const token = `card_token_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;

      // Log tokenization (security audit)
      logger.info(`Card tokenized: ${token} (last4: ${last4}, brand: ${brand})`);

      return { token, last4, brand };
    } catch (error) {
      logger.error('Error tokenizing card', error);
      throw error;
    }
  }

  // Refund payment
  async refundPayment(request: RefundRequest): Promise<Payment> {
    try {
      const payment = await this.paymentRepository.getPaymentById(request.paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new Error('Can only refund completed payments');
      }

      if (payment.refundStatus === 'completed') {
        throw new Error('Payment already refunded');
      }

      // Calculate refund amount
      const refundAmount = request.amount || payment.amount;

      if (refundAmount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      // Process refund via Razorpay
      let razorpayRefund;
      if (payment.transactionId) {
        try {
          const refundOptions: any = {
            amount: Math.round(refundAmount * 100), // Convert to paise
            notes: { reason: request.reason },
          };

          razorpayRefund = await this.razorpay.payments.refund(payment.transactionId, refundOptions);
        } catch (razorpayError: any) {
          logger.error('Razorpay refund error', razorpayError);
          throw new Error('Failed to process refund with payment gateway');
        }
      }

      // Update payment record
      const updatedPayment = await this.paymentRepository.updatePayment(payment.id, {
        refundAmount,
        refundStatus: 'completed',
        refundId: razorpayRefund?.id,
        metadata: {
          ...JSON.parse(payment.metadata || '{}'),
          refundReason: request.reason,
          razorpayRefundId: razorpayRefund?.id,
        },
      });

      // Log refund
      await this.paymentRepository.createPaymentLog({
        paymentId: payment.id,
        action: 'refunded',
        status: 'success',
        metadata: {
          refundAmount,
          reason: request.reason,
          razorpayRefundId: razorpayRefund?.id,
        },
      });

      // Update analytics
      if (payment.teamId) {
        await this.updatePaymentAnalytics(payment.teamId);
      }

      return updatedPayment;
    } catch (error) {
      logger.error('Error refunding payment', error);
      throw error;
    }
  }

  // Get payment details
  async getPaymentDetails(paymentId: string): Promise<any> {
    try {
      const payment = await this.paymentRepository.getPaymentById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Parse metadata
      const parsedPayment = {
        ...payment,
        metadata: payment.metadata ? JSON.parse(payment.metadata) : null,
      };

      return parsedPayment;
    } catch (error) {
      logger.error('Error getting payment details', error);
      throw error;
    }
  }

  // Search payments
  async searchPayments(limit: number, offset: number, filters: PaymentFilters): Promise<{ payments: any[]; total: number }> {
    try {
      const result = await this.paymentRepository.searchPayments(limit, offset, filters);

      // Parse metadata for each payment
      const payments = result.payments.map((payment) => ({
        ...payment,
        metadata: payment.metadata ? JSON.parse(payment.metadata) : null,
      }));

      return { payments, total: result.total };
    } catch (error) {
      logger.error('Error searching payments', error);
      throw error;
    }
  }

  // Update payment analytics
  private async updatePaymentAnalytics(teamId: string): Promise<void> {
    try {
      const stats = await this.paymentRepository.getPaymentStatsByTeam(teamId);

      const topMethods = await this.paymentRepository.getTopPaymentMethods(teamId, 5);
      const methodBreakdown: Record<string, number> = {};

      topMethods.forEach((method) => {
        methodBreakdown[method.method] = method.totalAmount;
      });

      const failedPayments = await this.paymentRepository.getFailedPayments(teamId, 10);

      // Find common failure reason
      const failureReasons: Record<string, number> = {};
      failedPayments.forEach((payment) => {
        if (payment.failureReason) {
          failureReasons[payment.failureReason] = (failureReasons[payment.failureReason] || 0) + 1;
        }
      });

      const commonFailReason = Object.entries(failureReasons).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Calculate refund rate
      const refundRate = stats.totalPayments > 0 ? (stats.refundedPayments / stats.totalPayments) * 100 : 0;

      await this.paymentRepository.createOrUpdatePaymentAnalytics(teamId, {
        totalRevenue: stats.totalRevenue,
        totalRefunds: stats.failedPayments,
        successRate: stats.successRate,
        refundRate,
        averageAmount: stats.averageAmount,
        methodBreakdown,
        topPaymentMethod: topMethods[0]?.method || null,
        failedPayments: stats.failedPayments,
        commonFailReason,
      });
    } catch (error) {
      logger.error('Error updating payment analytics', error);
      throw error;
    }
  }

  // Get payment analytics
  async getPaymentAnalytics(teamId: string): Promise<any> {
    try {
      const analytics = await this.paymentRepository.getPaymentAnalytics(teamId);

      if (!analytics) {
        // Initialize analytics if not exists
        await this.updatePaymentAnalytics(teamId);
        return await this.paymentRepository.getPaymentAnalytics(teamId);
      }

      return analytics;
    } catch (error) {
      logger.error('Error getting payment analytics', error);
      throw error;
    }
  }

  // Get payments by order
  async getPaymentsByOrder(orderId: string): Promise<any[]> {
    try {
      const payments = await this.paymentRepository.getPaymentsByOrderId(orderId);

      return payments.map((payment) => ({
        ...payment,
        metadata: payment.metadata ? JSON.parse(payment.metadata) : null,
      }));
    } catch (error) {
      logger.error('Error getting payments by order', error);
      throw error;
    }
  }

  // Check payment status in real-time
  async checkPaymentStatus(paymentId: string): Promise<{ status: string; gatewayStatus?: any }> {
    try {
      const payment = await this.paymentRepository.getPaymentById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Check with Razorpay if transaction ID exists
      if (payment.transactionId) {
        try {
          const razorpayPayment = await this.razorpay.payments.fetch(payment.transactionId);
          return {
            status: payment.status,
            gatewayStatus: {
              razorpay: razorpayPayment.status,
              amount: razorpayPayment.amount,
              currency: razorpayPayment.currency,
            },
          };
        } catch (error) {
          // Razorpay payment not found or API error
          logger.warn(`Razorpay payment not found: ${payment.transactionId}`);
        }
      }

      return { status: payment.status };
    } catch (error) {
      logger.error('Error checking payment status', error);
      throw error;
    }
  }

  // Validate fraud patterns
  async detectFraud(customerId?: string, teamId?: string): Promise<{ isFraudulent: boolean; reasons: string[] }> {
    try {
      const reasons: string[] = [];
      let isFraudulent = false;

      // Check for multiple failed payments in short time
      if (customerId) {
        const recentFailedPayments = await this.paymentRepository.getPaymentsByCustomerId(customerId, 10);
        const failedPayments = recentFailedPayments.filter((p) => p.status === 'failed');

        if (failedPayments.length >= 3) {
          // Check if failed payments are within last hour
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const recentFailures = failedPayments.filter((p) => p.timestamp > oneHourAgo);

          if (recentFailures.length >= 3) {
            reasons.push('Multiple failed payment attempts in short time');
            isFraudulent = true;
          }
        }
      }

      // Check for unusually large amounts
      if (teamId) {
        const stats = await this.paymentRepository.getPaymentStatsByTeam(teamId);
        const averageAmount = stats.averageAmount;

        const recentPayments = await this.paymentRepository.searchPayments(10, 0, { teamId });
        const highValuePayments = recentPayments.payments.filter((p) => p.amount > averageAmount * 10);

        if (highValuePayments.length > 0) {
          reasons.push('Unusually high payment amounts detected');
          isFraudulent = true;
        }
      }

      return { isFraudulent, reasons };
    } catch (error) {
      logger.error('Error detecting fraud', error);
      throw error;
    }
  }

  // Get refundable payments for an order
  async getRefundablePayments(orderId: string): Promise<any[]> {
    try {
      const payments = await this.paymentRepository.getRefundablePayments(orderId);

      return payments.map((payment) => ({
        ...payment,
        metadata: payment.metadata ? JSON.parse(payment.metadata) : null,
      }));
    } catch (error) {
      logger.error('Error getting refundable payments', error);
      throw error;
    }
  }
}
