import { Call, Analytics, Order } from '@prisma/client';
import { CallRepository } from '../db/repositories/callRepository';
import { logger } from '../utils/logger';

export interface CallAnalyticsSummary {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  activeOngoingCalls: number;
  averageCallDuration: number;
  averageSentiment: number;
  conversionRate: number;
}

export interface CallAnalyticsTrend {
  date: string;
  calls: number;
  completed: number;
  failed: number;
  avgDuration: number;
}

export interface CallAnalyticsByStatus {
  completed: number;
  failed: number;
  abandoned: number;
  inProgress: number;
}

export interface CallAnalyticsTopReason {
  reason: string;
  count: number;
  conversionRate: number;
}

export interface CallAnalyticsPeakHour {
  hour: number;
  calls: number;
}

export interface CallAnalyticsData {
  summary: CallAnalyticsSummary;
  trends: CallAnalyticsTrend[];
  byStatus: CallAnalyticsByStatus;
  topReasons: CallAnalyticsTopReason[];
  peakHours: CallAnalyticsPeakHour[];
}

export interface CallAnalyticsFilters {
  teamId?: string;
  startDate?: Date;
  endDate?: Date;
  campaignId?: string;
}

type CallWithRelations = Call & {
  analytics: Analytics[];
  orders: Order[];
};

export class CallAnalyticsService {
  private callRepository: CallRepository;

  constructor() {
    this.callRepository = new CallRepository();
  }

  async getCallAnalytics(filters?: CallAnalyticsFilters): Promise<CallAnalyticsData> {
    try {
      const [summary, trends, byStatus, topReasons, peakHours] = await Promise.all([
        this.getSummary(filters),
        this.getTrends(filters),
        this.getCallsByStatus(filters),
        this.getTopReasons(filters),
        this.getPeakHours(filters),
      ]);

      return {
        summary,
        trends,
        byStatus,
        topReasons,
        peakHours,
      };
    } catch (error) {
      logger.error('Error fetching call analytics', error);
      throw error;
    }
  }

  private async getSummary(filters?: CallAnalyticsFilters): Promise<CallAnalyticsSummary> {
    const calls = await this.filterCalls(filters);

    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.status === 'completed').length;
    const failedCalls = calls.filter(c => c.status === 'failed').length;
    const activeOngoingCalls = calls.filter(c => c.status === 'active' || c.status === 'in_progress').length;

    const validDurations = calls
      .filter(c => c.duration !== null && c.duration !== undefined)
      .map(c => c.duration || 0);
    const averageCallDuration =
      validDurations.length > 0
        ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
        : 0;

    // Get sentiment scores from analytics
    const sentimentScores: number[] = [];
    for (const call of calls) {
      if (call.analytics && call.analytics.length > 0) {
        const avgScore = this.getAverageSentiment(call.analytics);
        if (avgScore !== null) {
          sentimentScores.push(avgScore);
        }
      }
    }
    const averageSentiment =
      sentimentScores.length > 0
        ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
        : 0;

    const conversionRate =
      completedCalls > 0 ? (calls as any[]).filter(c => c.orders && c.orders.length > 0).length / completedCalls : 0;

    return {
      totalCalls,
      completedCalls,
      failedCalls,
      activeOngoingCalls,
      averageCallDuration: Math.round(averageCallDuration),
      averageSentiment: Math.round(averageSentiment * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }

  private async getTrends(filters?: CallAnalyticsFilters): Promise<CallAnalyticsTrend[]> {
    const calls = await this.filterCalls(filters);

    const groupedByDate: Record<string, CallWithRelations[]> = {};
    calls.forEach(call => {
      const date = call.createdAt.toISOString().slice(0, 10);
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(call);
    });

    const trends = Object.entries(groupedByDate)
      .map(([date, dayCalls]) => {
        const completed = dayCalls.filter(c => c.status === 'completed').length;
        const failed = dayCalls.filter(c => c.status === 'failed').length;
        const validDurations = dayCalls
          .filter(c => c.duration !== null && c.duration !== undefined)
          .map(c => c.duration || 0);
        const avgDuration =
          validDurations.length > 0
            ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
            : 0;

        return {
          date,
          calls: dayCalls.length,
          completed,
          failed,
          avgDuration: Math.round(avgDuration),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return trends;
  }

  private async getCallsByStatus(filters?: CallAnalyticsFilters): Promise<CallAnalyticsByStatus> {
    const calls = await this.filterCalls(filters);

    return {
      completed: calls.filter(c => c.status === 'completed').length,
      failed: calls.filter(c => c.status === 'failed').length,
      abandoned: calls.filter(c => c.status === 'abandoned').length,
      inProgress: calls.filter(c => c.status === 'active' || c.status === 'in_progress').length,
    };
  }

  private async getTopReasons(filters?: CallAnalyticsFilters): Promise<CallAnalyticsTopReason[]> {
    const calls = await this.filterCalls(filters);

    // Use status as "reason" for call outcomes
    const byStatus: Record<string, CallWithRelations[]> = {};
    calls.forEach(call => {
      if (!byStatus[call.status]) {
        byStatus[call.status] = [];
      }
      byStatus[call.status].push(call);
    });

    const reasons = Object.entries(byStatus)
      .map(([status, statusCalls]: [string, CallWithRelations[]]) => {
        const callsWithOrders = statusCalls.filter(c => (c as any).orders && (c as any).orders.length > 0).length;
        const conversionRate =
          statusCalls.length > 0 ? callsWithOrders / statusCalls.length : 0;

        return {
          reason: status,
          count: statusCalls.length,
          conversionRate: Math.round(conversionRate * 100) / 100,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return reasons;
  }

  private async getPeakHours(filters?: CallAnalyticsFilters): Promise<CallAnalyticsPeakHour[]> {
    const calls = await this.filterCalls(filters);

    const byHour: Record<number, number> = {};
    calls.forEach(call => {
      const hour = call.createdAt.getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
    });

    const peakHours = Object.entries(byHour)
      .map(([hour, count]) => ({
        hour: parseInt(hour, 10),
        calls: count,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    return peakHours;
  }

  private async filterCalls(filters?: CallAnalyticsFilters): Promise<CallWithRelations[]> {
    const prisma = (this.callRepository as any).prisma;
    const where: Record<string, unknown> = {};

    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }

    // Calls don't have campaignId directly, so filter through orders
    if (filters?.campaignId) {
      where.orders = {
        some: {
          campaignId: filters.campaignId,
        },
      };
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters?.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const calls = await prisma.call.findMany({
      where,
      include: {
        analytics: true,
        orders: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return calls as CallWithRelations[];
  }

  private getAverageSentiment(analytics: Analytics[]): number | null {
    const sentimentScores = analytics
      .map(a => a.sentimentScore)
      .filter((score): score is number => score !== null && score !== undefined);

    if (sentimentScores.length === 0) {
      return null;
    }

    return sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length;
  }
}
