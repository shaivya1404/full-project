import { PrismaClient, Payment, PaymentLink, PaymentLog, Invoice, PaymentAnalytics } from '@prisma/client';
import { getPrismaClient } from '../client';
import { logger } from '../../utils/logger';

export interface CreatePaymentInput {
  orderId?: string;
  customerId?: string;
  teamId?: string;
  amount: number;
  currency?: string;
  method: string;
  gateway?: string;
  token?: string;
  cardLast4?: string;
  cardBrand?: string;
  upiId?: string;
  metadata?: Record<string, any>;
  transactionId?: string;
  expiresAt?: Date;
}

export interface UpdatePaymentInput {
  status?: string;
  transactionId?: string;
  token?: string;
  failureReason?: string;
  refundAmount?: number;
  refundStatus?: string;
  refundId?: string;
  metadata?: Record<string, any>;
  completedAt?: Date;
}

export interface CreatePaymentLinkInput {
  orderId?: string;
  paymentId: string;
  link: string;
  shortLink?: string;
  expiresAt: Date;
}

export interface CreatePaymentLogInput {
  paymentId: string;
  action: string;
  status: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateInvoiceInput {
  orderId?: string;
  paymentId: string;
  invoiceNumber: string;
  items: any[];
  taxAmount?: number;
  taxDetails?: Record<string, any>;
  totalAmount: number;
  currency?: string;
  billingAddress?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  pdfUrl?: string;
  status?: string;
  sentAt?: Date;
  sentVia?: string;
}

export interface PaymentFilters {
  teamId?: string;
  orderId?: string;
  customerId?: string;
  status?: string;
  method?: string;
  paymentMethod?: string;
  startDate?: Date;
  endDate?: Date;
  transactionId?: string;
}

export interface UpdatePaymentAnalyticsInput {
  totalRevenue?: number;
  totalRefunds?: number;
  successRate?: number;
  refundRate?: number;
  averageAmount?: number;
  methodBreakdown?: Record<string, number>;
  topPaymentMethod?: string | null;
  failedPayments?: number;
  commonFailReason?: string | null;
}

export class PaymentRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  // Payment CRUD Operations

  async createPayment(data: CreatePaymentInput): Promise<Payment> {
    try {
      const payment = await this.prisma.payment.create({
        data: {
          ...data,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
        include: {
          order: true,
          customer: true,
          team: true,
        },
      });
      return payment;
    } catch (error) {
      logger.error('Error creating payment', error);
      throw error;
    }
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    try {
      return await this.prisma.payment.findUnique({
        where: { id },
        include: {
          order: true,
          customer: true,
          team: true,
          link: true,
          logs: true,
          invoice: true,
        },
      });
    } catch (error) {
      logger.error('Error fetching payment', error);
      throw error;
    }
  }

  async getPaymentByTransactionId(transactionId: string): Promise<Payment | null> {
    try {
      return await this.prisma.payment.findUnique({
        where: { transactionId },
        include: {
          order: true,
          customer: true,
          team: true,
          link: true,
          logs: true,
          invoice: true,
        },
      });
    } catch (error) {
      logger.error('Error fetching payment by transaction ID', error);
      throw error;
    }
  }

  async getPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    try {
      return await this.prisma.payment.findMany({
        where: { orderId },
        include: {
          order: true,
          customer: true,
          team: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error fetching payments by order', error);
      throw error;
    }
  }

  async getPaymentsByCustomerId(customerId: string, limit = 10): Promise<Payment[]> {
    try {
      return await this.prisma.payment.findMany({
        where: { customerId },
        include: {
          order: true,
          customer: true,
          team: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Error fetching payments by customer', error);
      throw error;
    }
  }

  async searchPayments(
    limit: number,
    offset: number,
    filters: PaymentFilters
  ): Promise<{ payments: Payment[]; total: number }> {
    try {
      const where: any = {};

      if (filters.teamId) where.teamId = filters.teamId;
      if (filters.orderId) where.orderId = filters.orderId;
      if (filters.customerId) where.customerId = filters.customerId;
      if (filters.status) where.status = filters.status;
      if (filters.method) where.method = filters.method;
      if (filters.transactionId) where.transactionId = filters.transactionId;
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }

      const [payments, total] = await Promise.all([
        this.prisma.payment.findMany({
          where,
          include: {
            order: true,
            customer: true,
            team: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.payment.count({ where }),
      ]);

      return { payments, total };
    } catch (error) {
      logger.error('Error searching payments', error);
      throw error;
    }
  }

  async updatePayment(id: string, data: UpdatePaymentInput): Promise<Payment> {
    try {
      const payment = await this.prisma.payment.update({
        where: { id },
        data: {
          ...data,
          metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        },
        include: {
          order: true,
          customer: true,
          team: true,
        },
      });
      return payment;
    } catch (error) {
      logger.error('Error updating payment', error);
      throw error;
    }
  }

  async deletePayment(id: string): Promise<Payment> {
    try {
      return await this.prisma.payment.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Error deleting payment', error);
      throw error;
    }
  }

  // Payment Link Operations

  async createPaymentLink(data: CreatePaymentLinkInput): Promise<PaymentLink> {
    try {
      return await this.prisma.paymentLink.create({
        data,
        include: {
          payment: true,
          order: true,
        },
      });
    } catch (error) {
      logger.error('Error creating payment link', error);
      throw error;
    }
  }

  async getPaymentLinkById(id: string): Promise<PaymentLink | null> {
    try {
      return await this.prisma.paymentLink.findUnique({
        where: { id },
        include: {
          payment: true,
          order: true,
        },
      });
    } catch (error) {
      logger.error('Error fetching payment link', error);
      throw error;
    }
  }

  async getPaymentLinkByPaymentId(paymentId: string): Promise<PaymentLink | null> {
    try {
      return await this.prisma.paymentLink.findUnique({
        where: { paymentId },
        include: {
          payment: true,
          order: true,
        },
      });
    } catch (error) {
      logger.error('Error fetching payment link by payment ID', error);
      throw error;
    }
  }

  async updatePaymentLink(id: string, data: Partial<CreatePaymentLinkInput> & { clickedAt?: Date; sentCount?: number; status?: string; sentAt?: Date }): Promise<PaymentLink> {
    try {
      return await this.prisma.paymentLink.update({
        where: { id },
        data,
        include: {
          payment: true,
          order: true,
        },
      });
    } catch (error) {
      logger.error('Error updating payment link', error);
      throw error;
    }
  }

  // Payment Log Operations

  async createPaymentLog(data: CreatePaymentLogInput): Promise<PaymentLog> {
    try {
      return await this.prisma.paymentLog.create({
        data: {
          ...data,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
      });
    } catch (error) {
      logger.error('Error creating payment log', error);
      throw error;
    }
  }

  async getPaymentLogs(paymentId: string, limit = 50): Promise<PaymentLog[]> {
    try {
      return await this.prisma.paymentLog.findMany({
        where: { paymentId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Error fetching payment logs', error);
      throw error;
    }
  }

  // Invoice Operations

  async createInvoice(data: CreateInvoiceInput): Promise<Invoice> {
    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          ...data,
          items: JSON.stringify(data.items),
          taxDetails: data.taxDetails ? JSON.stringify(data.taxDetails) : null,
        },
        include: {
          payment: true,
          order: true,
        },
      });
      return invoice;
    } catch (error) {
      logger.error('Error creating invoice', error);
      throw error;
    }
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id },
        include: {
          payment: true,
          order: true,
        },
      });

      if (invoice) {
        return {
          ...invoice,
          items: JSON.parse(invoice.items),
          taxDetails: invoice.taxDetails ? JSON.parse(invoice.taxDetails) : null,
        };
      }
      return null;
    } catch (error) {
      logger.error('Error fetching invoice', error);
      throw error;
    }
  }

  async getInvoiceByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { invoiceNumber },
        include: {
          payment: true,
          order: true,
        },
      });

      if (invoice) {
        return {
          ...invoice,
          items: JSON.parse(invoice.items),
          taxDetails: invoice.taxDetails ? JSON.parse(invoice.taxDetails) : null,
        };
      }
      return null;
    } catch (error) {
      logger.error('Error fetching invoice by number', error);
      throw error;
    }
  }

  async getInvoiceByPaymentId(paymentId: string): Promise<Invoice | null> {
    try {
      const invoice = await this.prisma.invoice.findUnique({
        where: { paymentId },
        include: {
          payment: true,
          order: true,
        },
      });

      if (invoice) {
        return {
          ...invoice,
          items: JSON.parse(invoice.items),
          taxDetails: invoice.taxDetails ? JSON.parse(invoice.taxDetails) : null,
        };
      }
      return null;
    } catch (error) {
      logger.error('Error fetching invoice by payment ID', error);
      throw error;
    }
  }

  async updateInvoice(id: string, data: Partial<CreateInvoiceInput> & { status?: string; pdfUrl?: string; sentAt?: Date; sentVia?: string }): Promise<Invoice> {
    try {
      const invoice = await this.prisma.invoice.update({
        where: { id },
        data: {
          ...data,
          items: data.items ? JSON.stringify(data.items) : undefined,
          taxDetails: data.taxDetails ? JSON.stringify(data.taxDetails) : undefined,
        },
        include: {
          payment: true,
          order: true,
        },
      });

      return {
        ...invoice,
        items: JSON.parse(invoice.items),
        taxDetails: invoice.taxDetails ? JSON.parse(invoice.taxDetails) : null,
      };
    } catch (error) {
      logger.error('Error updating invoice', error);
      throw error;
    }
  }

  async searchInvoices(
    limit: number,
    offset: number,
    filters: {
      teamId?: string;
      orderId?: string;
      paymentId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ invoices: any[]; total: number }> {
    try {
      const where: any = {};

      if (filters.teamId) {
        where.payment = {
          teamId: filters.teamId,
        };
      }

      if (filters.orderId) {
        where.orderId = filters.orderId;
      }

      if (filters.paymentId) {
        where.paymentId = filters.paymentId;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const [invoices, total] = await Promise.all([
        this.prisma.invoice.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
          include: {
            payment: true,
            order: true,
          },
        }),
        this.prisma.invoice.count({ where }),
      ]);

      return {
        invoices: invoices.map(invoice => ({
          ...invoice,
          items: JSON.parse(invoice.items),
          taxDetails: invoice.taxDetails ? JSON.parse(invoice.taxDetails) : null,
        })),
        total,
      };
    } catch (error) {
      logger.error('Error searching invoices', error);
      throw error;
    }
  }

  // Payment Analytics Operations

  async getPaymentAnalytics(teamId: string): Promise<PaymentAnalytics | null> {
    try {
      const analytics = await this.prisma.paymentAnalytics.findUnique({
        where: { teamId },
      });

      if (analytics) {
        return {
          ...analytics,
          methodBreakdown: analytics.methodBreakdown ? JSON.parse(analytics.methodBreakdown) : null,
        };
      }
      return null;
    } catch (error) {
      logger.error('Error fetching payment analytics', error);
      throw error;
    }
  }

  async createOrUpdatePaymentAnalytics(teamId: string, data: UpdatePaymentAnalyticsInput): Promise<PaymentAnalytics> {
    try {
      const analytics = await this.prisma.paymentAnalytics.upsert({
        where: { teamId },
        create: {
          teamId,
          ...data,
          methodBreakdown: data.methodBreakdown ? JSON.stringify(data.methodBreakdown) : null,
        },
        update: {
          ...data,
          methodBreakdown: data.methodBreakdown ? JSON.stringify(data.methodBreakdown) : undefined,
          lastUpdated: new Date(),
        },
      });

      return {
        ...analytics,
        methodBreakdown: analytics.methodBreakdown ? JSON.parse(analytics.methodBreakdown) : null,
      };
    } catch (error) {
      logger.error('Error creating/updating payment analytics', error);
      throw error;
    }
  }

  async getPaymentStatsByTeam(teamId: string, startDate?: Date, endDate?: Date): Promise<{
    totalRevenue: number;
    totalPayments: number;
    completedPayments: number;
    failedPayments: number;
    refundedPayments: number;
    averageAmount: number;
    successRate: number;
  }> {
    try {
      const where: any = { teamId };
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }

      const [payments, completed, failed, refunded] = await Promise.all([
        this.prisma.payment.findMany({ where }),
        this.prisma.payment.count({ where: { ...where, status: 'completed' } }),
        this.prisma.payment.count({ where: { ...where, status: 'failed' } }),
        this.prisma.payment.count({ where: { ...where, refundStatus: 'completed' } }),
      ]);

      const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
      const totalPayments = payments.length;
      const averageAmount = totalPayments > 0 ? totalRevenue / totalPayments : 0;
      const successRate = totalPayments > 0 ? (completed / totalPayments) * 100 : 0;

      return {
        totalRevenue,
        totalPayments,
        completedPayments: completed,
        failedPayments: failed,
        refundedPayments: refunded,
        averageAmount,
        successRate,
      };
    } catch (error) {
      logger.error('Error fetching payment stats', error);
      throw error;
    }
  }

  async getPaymentsByStatus(status: string, teamId?: string, limit = 50): Promise<Payment[]> {
    try {
      const where: any = { status };
      if (teamId) where.teamId = teamId;

      return await this.prisma.payment.findMany({
        where,
        include: {
          order: true,
          customer: true,
          team: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Error fetching payments by status', error);
      throw error;
    }
  }

  async getTopPaymentMethods(teamId: string, limit = 5): Promise<{ method: string; count: number; totalAmount: number }[]> {
    try {
      const payments = await this.prisma.payment.findMany({
        where: { teamId, status: 'completed' },
        orderBy: { amount: 'desc' },
      });

      const methodStats: Record<string, { count: number; totalAmount: number }> = {};

      payments.forEach((payment) => {
        if (!methodStats[payment.method]) {
          methodStats[payment.method] = { count: 0, totalAmount: 0 };
        }
        methodStats[payment.method].count++;
        methodStats[payment.method].totalAmount += payment.amount;
      });

      return Object.entries(methodStats)
        .map(([method, stats]) => ({ method, ...stats }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error fetching top payment methods', error);
      throw error;
    }
  }

  async getFailedPayments(teamId: string, limit = 20): Promise<Payment[]> {
    try {
      return await this.prisma.payment.findMany({
        where: { teamId, status: 'failed' },
        include: {
          order: true,
          customer: true,
          team: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Error fetching failed payments', error);
      throw error;
    }
  }

  async getRefundablePayments(orderId: string): Promise<Payment[]> {
    try {
      return await this.prisma.payment.findMany({
        where: {
          orderId,
          status: 'completed',
          refundStatus: null,
        },
        include: {
          order: true,
          customer: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error fetching refundable payments', error);
      throw error;
    }
  }
}
