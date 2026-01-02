import { Payment, Customer, Order } from '@prisma/client';
import { PaymentRepository } from '../db/repositories/paymentRepository';
import { logger } from '../utils/logger';

export interface PaymentAnalyticsFilters {
  teamId: string;
  startDate?: Date;
  endDate?: Date;
  paymentMethod?: string;
}

type PaymentWithRelations = Payment & {
  customer: Customer | null;
  order: Order | null;
};

export interface PaymentMetrics {
  totalRevenue: number;
  totalPayments: number;
  completedPayments: number;
  failedPayments: number;
  refundedPayments: number;
  pendingPayments: number;
  averageAmount: number;
  successRate: number;
  refundRate: number;
}

export interface MethodBreakdown {
  method: string;
  count: number;
  totalAmount: number;
  averageAmount: number;
  successRate: number;
}

export interface DailyTrend {
  date: string;
  revenue: number;
  payments: number;
  successRate: number;
}

export interface TopPayer {
  customerId: string;
  customerName?: string;
  totalPayments: number;
  totalSpent: number;
  averageAmount: number;
}

export class PaymentAnalyticsService {
  private paymentRepository: PaymentRepository;

  constructor() {
    this.paymentRepository = new PaymentRepository();
  }

  // Get comprehensive payment metrics
  async getPaymentMetrics(filters: PaymentAnalyticsFilters): Promise<PaymentMetrics> {
    try {
      const stats = await this.paymentRepository.getPaymentStatsByTeam(
        filters.teamId,
        filters.startDate,
        filters.endDate
      );

      // Get pending payments count
      const pendingPayments = await this.paymentRepository.getPaymentsByStatus('pending', filters.teamId);

      return {
        totalRevenue: stats.totalRevenue,
        totalPayments: stats.totalPayments,
        completedPayments: stats.completedPayments,
        failedPayments: stats.failedPayments,
        refundedPayments: stats.refundedPayments,
        pendingPayments: pendingPayments.length,
        averageAmount: stats.averageAmount,
        successRate: stats.successRate,
        refundRate: stats.totalPayments > 0 ? (stats.refundedPayments / stats.totalPayments) * 100 : 0,
      };
    } catch (error) {
      logger.error('Error getting payment metrics', error);
      throw error;
    }
  }

  // Get payment method breakdown
  async getMethodBreakdown(filters: PaymentAnalyticsFilters): Promise<MethodBreakdown[]> {
    try {
      let topMethods = await this.paymentRepository.getTopPaymentMethods(filters.teamId, 10);

      // Filter by payment method if specified
      if (filters.paymentMethod) {
        topMethods = topMethods.filter((m: any) => m.method === filters.paymentMethod);
      }

      // Get stats for success rate calculation
      const result = await this.paymentRepository.searchPayments(1000, 0, {
        teamId: filters.teamId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      const methodStats = new Map<string, { completed: number; total: number }>();

      result.payments.forEach((payment) => {
        if (!methodStats.has(payment.method)) {
          methodStats.set(payment.method, { completed: 0, total: 0 });
        }
        const stats = methodStats.get(payment.method)!;
        stats.total++;
        if (payment.status === 'completed') {
          stats.completed++;
        }
      });

      return topMethods.map((method) => ({
        method: method.method,
        count: method.count,
        totalAmount: method.totalAmount,
        averageAmount: method.count > 0 ? method.totalAmount / method.count : 0,
        successRate: methodStats.get(method.method)
          ? (methodStats.get(method.method)!.completed / methodStats.get(method.method)!.total) * 100
          : 0,
      }));
    } catch (error) {
      logger.error('Error getting method breakdown', error);
      throw error;
    }
  }

  // Get daily payment trends
  async getDailyTrends(filters: PaymentAnalyticsFilters, days: number = 30): Promise<DailyTrend[]> {
    try {
      const endDate = filters.endDate || new Date();
      const startDate = filters.startDate || new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const result = await this.paymentRepository.searchPayments(10000, 0, {
        teamId: filters.teamId,
        startDate,
        endDate,
      });

      // Group payments by date
      const dailyData = new Map<string, { revenue: number; payments: number; completed: number }>();

      result.payments.forEach((payment) => {
        const dateKey = payment.timestamp.toISOString().split('T')[0];
        if (!dailyData.has(dateKey)) {
          dailyData.set(dateKey, { revenue: 0, payments: 0, completed: 0 });
        }
        const dayData = dailyData.get(dateKey)!;
        dayData.revenue += payment.amount;
        dayData.payments++;
        if (payment.status === 'completed') {
          dayData.completed++;
        }
      });

      // Convert to array and sort by date
      const trends: DailyTrend[] = Array.from(dailyData.entries())
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          payments: data.payments,
          successRate: data.payments > 0 ? (data.completed / data.payments) * 100 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return trends;
    } catch (error) {
      logger.error('Error getting daily trends', error);
      throw error;
    }
  }

  // Get top payers (customers)
  async getTopPayers(filters: PaymentAnalyticsFilters, limit: number = 10): Promise<TopPayer[]> {
    try {
      const result = await this.paymentRepository.searchPayments(10000, 0, {
        teamId: filters.teamId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      // Group by customer
      const customerStats = new Map<string, { name?: string; totalPayments: number; totalSpent: number }>();

      result.payments.forEach((payment) => {
        if (!payment.customerId) return;

        if (!customerStats.has(payment.customerId)) {
          customerStats.set(payment.customerId, {
            name: (payment as any).customer?.name,
            totalPayments: 0,
            totalSpent: 0,
          });
        }
        const stats = customerStats.get(payment.customerId)!;
        stats.totalPayments++;
        if (payment.status === 'completed') {
          stats.totalSpent += payment.amount;
        }
      });

      // Convert to array and sort by total spent
      const topPayers: TopPayer[] = Array.from(customerStats.entries())
        .map(([customerId, stats]) => ({
          customerId,
          customerName: stats.name,
          totalPayments: stats.totalPayments,
          totalSpent: stats.totalSpent,
          averageAmount: stats.totalPayments > 0 ? stats.totalSpent / stats.totalPayments : 0,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, limit);

      return topPayers;
    } catch (error) {
      logger.error('Error getting top payers', error);
      throw error;
    }
  }

  // Get failed payment analysis
  async getFailedPaymentAnalysis(filters: PaymentAnalyticsFilters): Promise<{
    totalFailed: number;
    failureReasons: Array<{ reason: string; count: number; percentage: number }>;
    failedByMethod: Array<{ method: string; count: number; percentage: number }>;
    recentFailures: any[];
  }> {
    try {
      const failedPayments = await this.paymentRepository.getFailedPayments(filters.teamId, 100);

      // Filter by date range if specified
      const filteredFailures = filters.startDate || filters.endDate
        ? failedPayments.filter((payment) => {
          if (filters.startDate && payment.timestamp < filters.startDate) return false;
          if (filters.endDate && payment.timestamp > filters.endDate) return false;
          return true;
        })
        : failedPayments;

      // Group by failure reason
      const failureReasons = new Map<string, number>();
      filteredFailures.forEach((payment) => {
        const reason = payment.failureReason || 'Unknown';
        failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
      });

      const reasonsArray = Array.from(failureReasons.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: (count / filteredFailures.length) * 100,
        }))
        .sort((a, b) => b.count - a.count);

      // Group by payment method
      const failedByMethod = new Map<string, number>();
      filteredFailures.forEach((payment) => {
        failedByMethod.set(payment.method, (failedByMethod.get(payment.method) || 0) + 1);
      });

      const methodsArray = Array.from(failedByMethod.entries())
        .map(([method, count]) => ({
          method,
          count,
          percentage: (count / filteredFailures.length) * 100,
        }))
        .sort((a, b) => b.count - a.count);

      // Recent failures (last 10)
      const recentFailures = (filteredFailures as any[]).slice(0, 10).map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        reason: payment.failureReason,
        timestamp: payment.timestamp,
        customerName: payment.customer?.name,
      }));

      return {
        totalFailed: filteredFailures.length,
        failureReasons: reasonsArray,
        failedByMethod: methodsArray,
        recentFailures,
      };
    } catch (error) {
      logger.error('Error getting failed payment analysis', error);
      throw error;
    }
  }

  // Get refund analysis
  async getRefundAnalysis(filters: PaymentAnalyticsFilters): Promise<{
    totalRefunded: number;
    refundAmount: number;
    refundRate: number;
    refundReasons: Array<{ reason: string; count: number; percentage: number }>;
    recentRefunds: any[];
  }> {
    try {
      const result = await this.paymentRepository.searchPayments(10000, 0, {
        teamId: filters.teamId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      // Filter refunded payments
      const refundedPayments = result.payments.filter((p) => p.refundStatus === 'completed');

      // Calculate refund amount
      const refundAmount = refundedPayments.reduce((sum, p) => sum + (p.refundAmount || 0), 0);

      // Group by refund reason
      const refundReasons = new Map<string, number>();
      refundedPayments.forEach((payment) => {
        const metadata = payment.metadata ? JSON.parse(payment.metadata) : {};
        const reason = metadata.refundReason || 'Not specified';
        refundReasons.set(reason, (refundReasons.get(reason) || 0) + 1);
      });

      const reasonsArray = Array.from(refundReasons.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: refundedPayments.length > 0 ? (count / refundedPayments.length) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Recent refunds (last 10)
      const recentRefunds = refundedPayments
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, 10)
        .map((payment: any) => ({
          id: payment.id,
          amount: payment.amount,
          refundAmount: payment.refundAmount,
          reason: payment.metadata ? JSON.parse(payment.metadata).refundReason : 'Not specified',
          refundDate: payment.updatedAt,
          customerName: payment.customer?.name,
        }));

      return {
        totalRefunded: refundedPayments.length,
        refundAmount,
        refundRate: result.payments.length > 0 ? (refundedPayments.length / result.payments.length) * 100 : 0,
        refundReasons: reasonsArray,
        recentRefunds,
      };
    } catch (error) {
      logger.error('Error getting refund analysis', error);
      throw error;
    }
  }

  // Get comprehensive analytics dashboard
  async getAnalyticsDashboard(filters: PaymentAnalyticsFilters): Promise<{
    metrics: PaymentMetrics;
    methodBreakdown: MethodBreakdown[];
    dailyTrends: DailyTrend[];
    topPayers: TopPayer[];
    failedAnalysis: any;
    refundAnalysis: any;
  }> {
    try {
      const [metrics, methodBreakdown, dailyTrends, topPayers, failedAnalysis, refundAnalysis] = await Promise.all([
        this.getPaymentMetrics(filters),
        this.getMethodBreakdown(filters),
        this.getDailyTrends(filters, 30),
        this.getTopPayers(filters, 10),
        this.getFailedPaymentAnalysis(filters),
        this.getRefundAnalysis(filters),
      ]);

      return {
        metrics,
        methodBreakdown,
        dailyTrends,
        topPayers,
        failedAnalysis,
        refundAnalysis,
      };
    } catch (error) {
      logger.error('Error getting analytics dashboard', error);
      throw error;
    }
  }

  // Export analytics as CSV
  async exportPaymentsCSV(filters: PaymentAnalyticsFilters): Promise<string> {
    try {
      const result = await this.paymentRepository.searchPayments(10000, 0, {
        teamId: filters.teamId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        paymentMethod: filters.paymentMethod,
      });

      // CSV header
      const headers = [
        'Payment ID',
        'Order ID',
        'Customer ID',
        'Amount',
        'Currency',
        'Method',
        'Status',
        'Transaction ID',
        'Timestamp',
        'Completed At',
      ];

      // CSV rows
      const rows = result.payments.map((payment) => [
        payment.id,
        payment.orderId || '',
        payment.customerId || '',
        payment.amount.toFixed(2),
        payment.currency,
        payment.method,
        payment.status,
        payment.transactionId || '',
        payment.timestamp.toISOString(),
        payment.completedAt?.toISOString() || '',
      ]);

      // Combine header and rows
      const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

      return csvContent;
    } catch (error) {
      logger.error('Error exporting payments CSV', error);
      throw error;
    }
  }
}
