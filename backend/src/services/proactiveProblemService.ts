import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Types
export interface ProactiveProblem {
  type: ProactiveProblemType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestedAction: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  detectedAt: Date;
}

export type ProactiveProblemType =
  | 'delayed_order'
  | 'payment_failed'
  | 'stock_unavailable'
  | 'delivery_issue'
  | 'upcoming_expiry'
  | 'unfulfilled_promise'
  | 'repeated_calls'
  | 'negative_history'
  | 'pending_refund'
  | 'service_outage';

export interface CustomerRiskProfile {
  customerId: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  churnProbability: number;
  recentProblems: ProactiveProblem[];
  recommendedApproach: string;
}

export interface OrderStatus {
  orderId: string;
  status: string;
  expectedDelivery?: Date;
  actualDelivery?: Date;
  isDelayed: boolean;
  delayReason?: string;
}

/**
 * Service for proactive problem detection
 * Identifies issues before customers mention them
 */
export class ProactiveProblemService {
  /**
   * Detect all potential problems for a customer before/during call
   */
  async detectProblems(
    customerId: string,
    teamId: string,
    phone?: string
  ): Promise<ProactiveProblem[]> {
    const problems: ProactiveProblem[] = [];

    try {
      // Run all detection methods in parallel
      const [
        orderProblems,
        paymentProblems,
        promiseProblems,
        callHistoryProblems,
        refundProblems,
      ] = await Promise.all([
        this.detectOrderProblems(customerId),
        this.detectPaymentProblems(customerId),
        this.detectUnfulfilledPromises(customerId, teamId),
        this.detectCallHistoryIssues(customerId, phone),
        this.detectPendingRefunds(customerId),
      ]);

      problems.push(
        ...orderProblems,
        ...paymentProblems,
        ...promiseProblems,
        ...callHistoryProblems,
        ...refundProblems
      );

      // Sort by severity (critical first)
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      problems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      logger.info(`Detected ${problems.length} proactive problems for customer ${customerId}`);
      return problems;
    } catch (error) {
      logger.error('Error detecting proactive problems', error);
      return [];
    }
  }

  /**
   * Detect order-related problems (delays, issues)
   */
  async detectOrderProblems(customerId: string): Promise<ProactiveProblem[]> {
    const problems: ProactiveProblem[] = [];

    try {
      // Get recent orders
      const recentOrders = await prisma.order.findMany({
        where: {
          customerId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      for (const order of recentOrders) {
        // Check for delayed orders (orders processing for more than 24 hours)
        if (order.status === 'processing' || order.status === 'shipped') {
          const orderAge = Date.now() - new Date(order.orderTime).getTime();
          const isDelayed = orderAge > 24 * 60 * 60 * 1000; // More than 24 hours
          if (isDelayed) {
            problems.push({
              type: 'delayed_order',
              severity: 'warning',
              message: `Order #${order.id.slice(-6)} is delayed past expected delivery`,
              suggestedAction: 'Proactively acknowledge the delay and provide updated timeline',
              relatedEntityId: order.id,
              relatedEntityType: 'order',
              detectedAt: new Date(),
            });
          }
        }

        // Check for recently cancelled orders
        if (order.status === 'cancelled') {
          const cancelledRecently = (Date.now() - new Date(order.updatedAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
          if (cancelledRecently) {
            problems.push({
              type: 'delayed_order',
              severity: 'info',
              message: `Order #${order.id.slice(-6)} was recently cancelled`,
              suggestedAction: 'Ask if they need help with their cancelled order or would like to reorder',
              relatedEntityId: order.id,
              relatedEntityType: 'order',
              detectedAt: new Date(),
            });
          }
        }

        // Check for partially fulfilled orders
        if (order.status === 'partially_fulfilled') {
          problems.push({
            type: 'delayed_order',
            severity: 'warning',
            message: `Order #${order.id.slice(-6)} is only partially fulfilled`,
            suggestedAction: 'Explain partial fulfillment status and expected timeline for remaining items',
            relatedEntityId: order.id,
            relatedEntityType: 'order',
            detectedAt: new Date(),
          });
        }
      }
    } catch (error) {
      logger.error('Error detecting order problems', error);
    }

    return problems;
  }

  /**
   * Detect payment-related problems
   */
  async detectPaymentProblems(customerId: string): Promise<ProactiveProblem[]> {
    const problems: ProactiveProblem[] = [];

    try {
      // Get recent payments
      const recentPayments = await prisma.payment.findMany({
        where: {
          order: {
            customerId,
          },
          createdAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Last 14 days
          },
        },
        include: {
          order: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const payment of recentPayments) {
        const orderIdSuffix = payment.orderId?.slice(-6) || 'unknown';

        // Check for failed payments
        if (payment.status === 'failed') {
          problems.push({
            type: 'payment_failed',
            severity: 'critical',
            message: `Payment failed for order #${orderIdSuffix}`,
            suggestedAction: 'Offer to help retry payment or use alternative payment method',
            relatedEntityId: payment.id,
            relatedEntityType: 'payment',
            detectedAt: new Date(),
          });
        }

        // Check for pending payments
        if (payment.status === 'pending') {
          const pendingTooLong = (Date.now() - new Date(payment.createdAt).getTime()) > 24 * 60 * 60 * 1000;
          if (pendingTooLong) {
            problems.push({
              type: 'payment_failed',
              severity: 'warning',
              message: `Payment pending for over 24 hours on order #${orderIdSuffix}`,
              suggestedAction: 'Check payment status and offer assistance',
              relatedEntityId: payment.id,
              relatedEntityType: 'payment',
              detectedAt: new Date(),
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error detecting payment problems', error);
    }

    return problems;
  }

  /**
   * Detect unfulfilled promises from previous calls
   */
  async detectUnfulfilledPromises(customerId: string, teamId: string): Promise<ProactiveProblem[]> {
    const problems: ProactiveProblem[] = [];

    try {
      // Get unfulfilled promises from customer memory
      const promises = await prisma.customerMemory.findMany({
        where: {
          customerId,
          teamId,
          factType: 'promise',
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const promise of promises) {
        // Check if promise is overdue (older than 3 days without resolution)
        const promiseAge = Date.now() - new Date(promise.createdAt).getTime();
        const isOverdue = promiseAge > 3 * 24 * 60 * 60 * 1000;

        if (isOverdue) {
          problems.push({
            type: 'unfulfilled_promise',
            severity: 'warning',
            message: `Unfulfilled promise: "${promise.factValue}"`,
            suggestedAction: 'Acknowledge the pending commitment and provide update',
            relatedEntityId: promise.id,
            relatedEntityType: 'promise',
            detectedAt: new Date(),
          });
        }
      }
    } catch (error) {
      logger.error('Error detecting unfulfilled promises', error);
    }

    return problems;
  }

  /**
   * Detect issues from call history
   */
  async detectCallHistoryIssues(customerId: string, phone?: string): Promise<ProactiveProblem[]> {
    const problems: ProactiveProblem[] = [];

    try {
      // Get recent calls for this customer
      const whereConditions: any[] = [];
      if (customerId) {
        whereConditions.push({ orders: { some: { customerId } } });
      }
      if (phone) {
        whereConditions.push({ caller: phone });
      }

      const recentCalls = await prisma.call.findMany({
        where: {
          OR: whereConditions.length > 0 ? whereConditions : undefined,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Check for repeated calls (potential frustration)
      if (recentCalls.length >= 3) {
        problems.push({
          type: 'repeated_calls',
          severity: 'warning',
          message: `Customer has called ${recentCalls.length} times in the last 7 days`,
          suggestedAction: 'Acknowledge previous contacts and ensure thorough resolution this time',
          detectedAt: new Date(),
        });
      }

      // Check for escalated calls
      const escalatedCalls = recentCalls.filter((c: any) => c.wasEscalated);
      if (escalatedCalls.length > 0) {
        problems.push({
          type: 'negative_history',
          severity: 'warning',
          message: 'Customer had escalated calls recently',
          suggestedAction: 'Handle with extra care and ensure satisfaction',
          detectedAt: new Date(),
        });
      }

      // Check for negative sentiment history
      const negativeCalls = recentCalls.filter((c: any) => c.sentimentScore && c.sentimentScore < 0.3);
      if (negativeCalls.length > 0) {
        problems.push({
          type: 'negative_history',
          severity: 'info',
          message: 'Customer has history of negative call experiences',
          suggestedAction: 'Be extra empathetic and focus on positive resolution',
          detectedAt: new Date(),
        });
      }
    } catch (error) {
      logger.error('Error detecting call history issues', error);
    }

    return problems;
  }

  /**
   * Detect pending refunds
   */
  async detectPendingRefunds(customerId: string): Promise<ProactiveProblem[]> {
    const problems: ProactiveProblem[] = [];

    try {
      // Get recent refunds
      const recentRefunds = await prisma.payment.findMany({
        where: {
          order: {
            customerId,
          },
          status: 'refund_pending',
        },
        include: {
          order: true,
        },
      });

      for (const refund of recentRefunds) {
        const refundAge = Date.now() - new Date(refund.updatedAt).getTime();
        const isOld = refundAge > 5 * 24 * 60 * 60 * 1000; // Older than 5 days
        const orderIdSuffix = refund.orderId?.slice(-6) || 'unknown';

        problems.push({
          type: 'pending_refund',
          severity: isOld ? 'warning' : 'info',
          message: `Refund pending for order #${orderIdSuffix}`,
          suggestedAction: isOld
            ? 'Apologize for delay and provide refund status update'
            : 'Proactively mention refund is being processed',
          relatedEntityId: refund.id,
          relatedEntityType: 'refund',
          detectedAt: new Date(),
        });
      }
    } catch (error) {
      logger.error('Error detecting pending refunds', error);
    }

    return problems;
  }

  /**
   * Build customer risk profile
   */
  async buildRiskProfile(customerId: string, teamId: string): Promise<CustomerRiskProfile> {
    try {
      const problems = await this.detectProblems(customerId, teamId);

      // Calculate risk factors
      const riskFactors: string[] = [];
      let riskScore = 0;

      // Critical problems increase risk significantly
      const criticalCount = problems.filter(p => p.severity === 'critical').length;
      if (criticalCount > 0) {
        riskFactors.push(`${criticalCount} critical issue(s) detected`);
        riskScore += criticalCount * 30;
      }

      // Warning problems add moderate risk
      const warningCount = problems.filter(p => p.severity === 'warning').length;
      if (warningCount > 0) {
        riskFactors.push(`${warningCount} warning(s) detected`);
        riskScore += warningCount * 15;
      }

      // Multiple problems compound risk
      if (problems.length > 3) {
        riskFactors.push('Multiple simultaneous issues');
        riskScore += 20;
      }

      // Unfulfilled promises are serious
      const unfulfilledPromises = problems.filter(p => p.type === 'unfulfilled_promise');
      if (unfulfilledPromises.length > 0) {
        riskFactors.push('Unfulfilled commitments from previous interactions');
        riskScore += 25;
      }

      // Repeated calls indicate frustration
      const repeatedCalls = problems.filter(p => p.type === 'repeated_calls');
      if (repeatedCalls.length > 0) {
        riskFactors.push('Repeated contact attempts');
        riskScore += 20;
      }

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (riskScore >= 60) riskLevel = 'high';
      else if (riskScore >= 30) riskLevel = 'medium';

      // Calculate churn probability (simplified)
      const churnProbability = Math.min(riskScore / 100, 0.95);

      // Generate recommended approach
      let recommendedApproach = 'Standard friendly service';
      if (riskLevel === 'high') {
        recommendedApproach = 'High-touch empathetic handling. Acknowledge past issues proactively. Focus on complete resolution.';
      } else if (riskLevel === 'medium') {
        recommendedApproach = 'Extra attentive service. Check for any pending issues before concluding.';
      }

      return {
        customerId,
        riskLevel,
        riskFactors,
        churnProbability,
        recentProblems: problems,
        recommendedApproach,
      };
    } catch (error) {
      logger.error('Error building risk profile', error);
      return {
        customerId,
        riskLevel: 'low',
        riskFactors: [],
        churnProbability: 0,
        recentProblems: [],
        recommendedApproach: 'Standard service',
      };
    }
  }

  /**
   * Generate proactive message for detected problems
   */
  generateProactiveMessage(problems: ProactiveProblem[]): string | null {
    if (problems.length === 0) return null;

    const criticalProblems = problems.filter(p => p.severity === 'critical');
    const warningProblems = problems.filter(p => p.severity === 'warning');

    // Prioritize critical issues
    if (criticalProblems.length > 0) {
      const problem = criticalProblems[0];
      if (problem.type === 'payment_failed') {
        return "I notice there was an issue with your recent payment. I'd like to help you resolve that right away.";
      }
      return `I see there's an issue I'd like to help you with regarding ${problem.type.replace('_', ' ')}.`;
    }

    // Address warnings
    if (warningProblems.length > 0) {
      const problem = warningProblems[0];
      if (problem.type === 'delayed_order') {
        return "I see your order is taking longer than expected. Let me give you an update on that.";
      }
      if (problem.type === 'unfulfilled_promise') {
        return "Before we continue, I want to follow up on something from our last conversation.";
      }
      if (problem.type === 'pending_refund') {
        return "I notice you have a refund in progress. Let me give you an update on that.";
      }
    }

    return null;
  }
}

export const proactiveProblemService = new ProactiveProblemService();
