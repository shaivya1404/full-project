import { PaymentRepository, CreatePaymentLinkInput } from '../db/repositories/paymentRepository';
import { PaymentService } from './paymentService';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface PaymentLinkRequest {
  orderId?: string;
  customerId?: string;
  teamId: string;
  amount: number;
  currency?: string;
  description?: string;
  expiresIn?: number;
}

export interface PaymentLinkCreation {
  paymentId: string;
  linkId: string;
  link: string;
  shortLink: string;
  expiresAt: Date;
  amount: number;
  currency: string;
}

export interface SendPaymentLinkRequest {
  linkId: string;
  phone: string;
  message?: string;
}

export class PaymentLinkService {
  private paymentRepository: PaymentRepository;
  private paymentService: PaymentService;

  constructor() {
    this.paymentRepository = new PaymentRepository();
    this.paymentService = new PaymentService();
  }

  // Generate a short link code
  private generateShortLink(length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Create payment link
  async createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLinkCreation> {
    try {
      // Validate amount
      if (!this.paymentService['validateAmount'](request.amount)) {
        throw new Error('Invalid payment amount');
      }

      // Initiate payment
      const initiationResult = await this.paymentService.initiatePayment({
        orderId: request.orderId,
        teamId: request.teamId,
        amount: request.amount,
        currency: request.currency,
        method: 'payment_link',
        metadata: {
          description: request.description,
        },
      });

      // Generate payment link URL
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const link = `${baseUrl}/pay/${initiationResult.paymentId}`;

      // Generate short link code
      const shortCode = this.generateShortLink();
      const shortLink = `${baseUrl}/p/${shortCode}`;

      // Calculate expiration
      const expiresIn = request.expiresIn || 24; // Default 24 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresIn);

      // Create payment link record
      const paymentLinkInput: CreatePaymentLinkInput = {
        orderId: request.orderId,
        paymentId: initiationResult.paymentId,
        link,
        shortLink,
        expiresAt,
      };

      const paymentLink = await this.paymentRepository.createPaymentLink(paymentLinkInput);

      logger.info(`Payment link created: ${paymentLink.id} for payment: ${initiationResult.paymentId}`);

      return {
        paymentId: initiationResult.paymentId,
        linkId: paymentLink.id,
        link,
        shortLink,
        expiresAt,
        amount: request.amount,
        currency: request.currency || 'INR',
      };
    } catch (error) {
      logger.error('Error creating payment link', error);
      throw error;
    }
  }

  // Get payment link details
  async getPaymentLink(linkId: string): Promise<any> {
    try {
      const paymentLink = await this.paymentRepository.getPaymentLinkById(linkId);

      if (!paymentLink) {
        throw new Error('Payment link not found');
      }

      // Check if link is expired
      if (paymentLink.expiresAt < new Date()) {
        // Update status to expired
        if (paymentLink.status !== 'expired' && paymentLink.status !== 'paid') {
          await this.paymentRepository.updatePaymentLink(linkId, { status: 'expired' });
        }
        throw new Error('Payment link has expired');
      }

      // Get payment details
      const payment = await this.paymentService.getPaymentDetails(paymentLink.paymentId);

      return {
        ...paymentLink,
        payment,
      };
    } catch (error) {
      logger.error('Error getting payment link', error);
      throw error;
    }
  }

  // Get payment link by short code
  async getPaymentLinkByShortCode(shortCode: string): Promise<any> {
    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const fullShortLink = `${baseUrl}/p/${shortCode}`;

      // Query payment link by short link
      const paymentLink = await prisma.paymentLink.findFirst({
        where: {
          OR: [
            { shortLink: fullShortLink },
            { shortLink: shortCode },
          ],
        },
        include: {
          payment: true,
          order: true,
        },
      });

      if (!paymentLink) {
        throw new Error(`Payment link not found for short code: ${shortCode}`);
      }

      return paymentLink;
    } catch (error) {
      logger.error('Error getting payment link by short code', error);
      throw error;
    }
  }

  // Track link click
  async trackLinkClick(linkId: string): Promise<void> {
    try {
      const paymentLink = await this.paymentRepository.getPaymentLinkById(linkId);

      if (!paymentLink) {
        throw new Error('Payment link not found');
      }

      if (paymentLink.status !== 'pending') {
        return; // Already clicked or paid
      }

      await this.paymentRepository.updatePaymentLink(linkId, {
        clickedAt: new Date(),
        status: 'clicked',
      });

      logger.info(`Payment link clicked: ${linkId}`);
    } catch (error) {
      logger.error('Error tracking link click', error);
      throw error;
    }
  }

  // Send payment link via SMS
  async sendPaymentLinkViaSMS(request: SendPaymentLinkRequest): Promise<{ sent: boolean; message: string }> {
    try {
      const paymentLink = await this.paymentRepository.getPaymentLinkById(request.linkId);

      if (!paymentLink) {
        throw new Error('Payment link not found');
      }

      if (paymentLink.status === 'expired') {
        throw new Error('Payment link has expired');
      }

      const payment = await this.paymentService.getPaymentDetails(paymentLink.paymentId);

      // Format phone number
      const phone = request.phone.replace(/[^0-9]/g, '');
      if (phone.length < 10) {
        throw new Error('Invalid phone number');
      }

      // Generate SMS message
      const amount = payment.amount.toFixed(2);
      const defaultMessage = `Pay ₹${amount} for your order via this secure payment link: ${paymentLink.link}. This link expires in 24 hours.`;

      const message = request.message || defaultMessage;

      // Here you would integrate with Twilio or another SMS service
      // For now, we'll simulate the sending
      // import { TwilioService } from '../services/twilioService';
      // await twilioService.sendSMS(phone, message);

      // Track that link was sent
      await this.paymentRepository.updatePaymentLink(request.linkId, {
        sentCount: paymentLink.sentCount + 1,
        sentAt: new Date(),
      });

      // Log the send
      logger.info(`Payment link sent via SMS to ${phone}: ${paymentLink.link}`);

      return {
        sent: true,
        message: 'Payment link sent successfully',
      };
    } catch (error) {
      logger.error('Error sending payment link via SMS', error);
      throw error;
    }
  }

  // Check payment link status
  async checkPaymentLinkStatus(linkId: string): Promise<{
    status: string;
    paymentStatus: string;
    expiresAt: Date;
    clicked: boolean;
  }> {
    try {
      const paymentLink = await this.paymentRepository.getPaymentLinkById(linkId);

      if (!paymentLink) {
        throw new Error('Payment link not found');
      }

      const payment = await this.paymentService.getPaymentDetails(paymentLink.paymentId);

      // Update status if payment is completed
      if (payment.status === 'completed' && paymentLink.status !== 'paid') {
        await this.paymentRepository.updatePaymentLink(linkId, { status: 'paid' });
        paymentLink.status = 'paid';
      }

      // Check if expired
      if (paymentLink.expiresAt < new Date() && paymentLink.status === 'pending') {
        await this.paymentRepository.updatePaymentLink(linkId, { status: 'expired' });
        paymentLink.status = 'expired';
      }

      return {
        status: paymentLink.status,
        paymentStatus: payment.status,
        expiresAt: paymentLink.expiresAt,
        clicked: paymentLink.clickedAt !== null,
      };
    } catch (error) {
      logger.error('Error checking payment link status', error);
      throw error;
    }
  }

  // Cancel payment link
  async cancelPaymentLink(linkId: string): Promise<void> {
    try {
      const paymentLink = await this.paymentRepository.getPaymentLinkById(linkId);

      if (!paymentLink) {
        throw new Error('Payment link not found');
      }

      if (paymentLink.status === 'paid') {
        throw new Error('Cannot cancel paid payment link');
      }

      if (paymentLink.status === 'expired') {
        throw new Error('Payment link already expired');
      }

      await this.paymentRepository.updatePaymentLink(linkId, { status: 'cancelled' });

      // Also cancel the payment
      const payment = await this.paymentRepository.getPaymentById(paymentLink.paymentId);
      if (payment && payment.status === 'pending') {
        await this.paymentRepository.updatePayment(payment.id, { status: 'cancelled' });
      }

      logger.info(`Payment link cancelled: ${linkId}`);
    } catch (error) {
      logger.error('Error cancelling payment link', error);
      throw error;
    }
  }

  // Resend payment link
  async resendPaymentLink(linkId: string, phone: string, message?: string): Promise<{ sent: boolean; message: string }> {
    try {
      const paymentLink = await this.paymentRepository.getPaymentLinkById(linkId);

      if (!paymentLink) {
        throw new Error('Payment link not found');
      }

      if (paymentLink.status === 'paid') {
        throw new Error('Cannot resend payment link for already paid order');
      }

      if (paymentLink.status === 'expired') {
        // Generate new link if expired
        const payment = await this.paymentService.getPaymentDetails(paymentLink.paymentId);
        const newLink = await this.createPaymentLink({
          orderId: payment.orderId,
          teamId: payment.teamId || '',
          amount: payment.amount,
          currency: payment.currency,
          description: 'Resend payment link',
          expiresIn: 24,
        });

        return await this.sendPaymentLinkViaSMS({
          linkId: newLink.linkId,
          phone,
          message,
        });
      }

      // Resend existing link
      return await this.sendPaymentLinkViaSMS({
        linkId,
        phone,
        message,
      });
    } catch (error) {
      logger.error('Error resending payment link', error);
      throw error;
    }
  }

  // Get payment link statistics
  async getPaymentLinkStats(teamId: string, startDate?: Date, endDate?: Date): Promise<{
    totalLinks: number;
    clickedLinks: number;
    paidLinks: number;
    expiredLinks: number;
    cancelledLinks: number;
    clickRate: number;
    conversionRate: number;
  }> {
    try {
      const where: any = {};
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      // Filter by team through the payment -> order -> team relation
      if (teamId) {
        where.payment = { teamId };
      }

      const links = await prisma.paymentLink.findMany({
        where,
        select: { status: true, clickedAt: true },
      });

      const totalLinks = links.length;
      const clickedLinks = links.filter((l: any) => l.clickedAt !== null).length;
      const paidLinks = links.filter((l: any) => l.status === 'paid').length;
      const expiredLinks = links.filter((l: any) => l.status === 'expired').length;
      const cancelledLinks = links.filter((l: any) => l.status === 'cancelled').length;

      const stats = {
        totalLinks,
        clickedLinks,
        paidLinks,
        expiredLinks,
        cancelledLinks,
        clickRate: totalLinks > 0 ? (clickedLinks / totalLinks) * 100 : 0,
        conversionRate: totalLinks > 0 ? (paidLinks / totalLinks) * 100 : 0,
      };

      return stats;
    } catch (error) {
      logger.error('Error getting payment link stats', error);
      throw error;
    }
  }
}
