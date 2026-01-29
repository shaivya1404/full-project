import { PaymentRepository } from '../db/repositories/paymentRepository';
import { logger } from '../utils/logger';

export interface FraudCheckRequest {
  customerId?: string;
  teamId: string;
  amount: number;
  method: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

export interface FraudCheckResult {
  isFraudulent: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  score: number;
  reasons: string[];
  actions: string[];
}

export interface FraudPattern {
  type: 'velocity' | 'amount' | 'location' | 'device' | 'card' | 'customer';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export class FraudDetectionService {
  private paymentRepository: PaymentRepository;

  constructor() {
    this.paymentRepository = new PaymentRepository();
  }

  // Perform comprehensive fraud check
  async checkFraud(request: FraudCheckRequest): Promise<FraudCheckResult> {
    try {
      const reasons: string[] = [];
      const actions: string[] = [];
      let riskScore = 0;

      // Check 1: Velocity check - multiple payments in short time
      const velocityCheck = await this.checkPaymentVelocity(request.customerId, request.teamId);
      if (velocityCheck.isSuspicious) {
        reasons.push(velocityCheck.reason);
        riskScore += velocityCheck.score;
      }

      // Check 2: Amount check - unusually high amount
      const amountCheck = await this.checkAmountAnomaly(request.teamId, request.amount);
      if (amountCheck.isAnomalous) {
        reasons.push(amountCheck.reason);
        riskScore += amountCheck.score;
      }

      // Check 3: Customer history check
      if (request.customerId) {
        const customerCheck = await this.checkCustomerHistory(request.customerId, request.teamId);
        if (customerCheck.isSuspicious) {
          reasons.push(customerCheck.reason);
          riskScore += customerCheck.score;
        }
      }

      // Check 4: Failed payment attempts
      const failureCheck = await this.checkFailedAttempts(request.customerId, request.teamId);
      if (failureCheck.isSuspicious) {
        reasons.push(failureCheck.reason);
        riskScore += failureCheck.score;
      }

      // Check 5: Pattern matching
      const patternCheck = await this.detectFraudPatterns(request);
      if (patternCheck.length > 0) {
        patternCheck.forEach((pattern) => {
          reasons.push(`Fraud pattern detected: ${pattern.description}`);
          riskScore += pattern.severity === 'high' ? 30 : pattern.severity === 'medium' ? 20 : 10;
        });
      }

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (riskScore >= 50) {
        riskLevel = 'high';
        actions.push('block', 'manual_review', 'notify_admin');
      } else if (riskScore >= 25) {
        riskLevel = 'medium';
        actions.push('additional_verification', 'monitor');
      } else if (riskScore >= 10) {
        riskLevel = 'low';
        actions.push('monitor');
      }

      // Determine if fraudulent
      const isFraudulent = riskScore >= 25;

      logger.info(`Fraud check completed for team ${request.teamId}: ${isFraudulent ? 'FRAUDULENT' : 'CLEAN'} (score: ${riskScore})`);

      return {
        isFraudulent,
        riskLevel,
        score: riskScore,
        reasons,
        actions,
      };
    } catch (error) {
      logger.error('Error performing fraud check', error);
      throw error;
    }
  }

  // Check payment velocity
  private async checkPaymentVelocity(customerId?: string, teamId?: string): Promise<{ isSuspicious: boolean; reason: string; score: number }> {
    try {
      if (!customerId) {
        return { isSuspicious: false, reason: '', score: 0 };
      }

      const recentPayments = await this.paymentRepository.getPaymentsByCustomerId(customerId, 20);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const paymentsLastHour = recentPayments.filter((p) => p.timestamp > oneHourAgo);
      const paymentsLast5Minutes = recentPayments.filter((p) => p.timestamp > fiveMinutesAgo);

      // More than 10 payments in last hour
      if (paymentsLastHour.length >= 10) {
        return {
          isSuspicious: true,
          reason: `High payment velocity: ${paymentsLastHour.length} payments in last hour`,
          score: 30,
        };
      }

      // More than 3 payments in last 5 minutes
      if (paymentsLast5Minutes.length >= 3) {
        return {
          isSuspicious: true,
          reason: `High payment velocity: ${paymentsLast5Minutes.length} payments in last 5 minutes`,
          score: 25,
        };
      }

      return { isSuspicious: false, reason: '', score: 0 };
    } catch (error) {
      logger.error('Error checking payment velocity', error);
      return { isSuspicious: false, reason: '', score: 0 };
    }
  }

  // Check amount anomaly
  private async checkAmountAnomaly(teamId: string, amount: number): Promise<{ isAnomalous: boolean; reason: string; score: number }> {
    try {
      const stats = await this.paymentRepository.getPaymentStatsByTeam(teamId);
      const averageAmount = stats.averageAmount;
      const stdDev = stats.averageAmount * 0.5; // Approximate standard deviation

      // More than 10x average
      if (amount > averageAmount * 10) {
        return {
          isAnomalous: true,
          reason: `Unusually high payment amount: ₹${amount.toFixed(2)} (avg: ₹${averageAmount.toFixed(2)})`,
          score: 35,
        };
      }

      // More than 5x average
      if (amount > averageAmount * 5) {
        return {
          isAnomalous: true,
          reason: `High payment amount: ₹${amount.toFixed(2)} (avg: ₹${averageAmount.toFixed(2)})`,
          score: 20,
        };
      }

      // More than 3x average
      if (amount > averageAmount * 3) {
        return {
          isAnomalous: true,
          reason: `Elevated payment amount: ₹${amount.toFixed(2)} (avg: ₹${averageAmount.toFixed(2)})`,
          score: 10,
        };
      }

      return { isAnomalous: false, reason: '', score: 0 };
    } catch (error) {
      logger.error('Error checking amount anomaly', error);
      return { isAnomalous: false, reason: '', score: 0 };
    }
  }

  // Check customer history
  private async checkCustomerHistory(customerId: string, teamId: string): Promise<{ isSuspicious: boolean; reason: string; score: number }> {
    try {
      const customerPayments = await this.paymentRepository.getPaymentsByCustomerId(customerId, 50);

      // Check for high refund rate
      const refundedPayments = customerPayments.filter((p) => p.refundStatus === 'completed');
      if (customerPayments.length > 5 && refundedPayments.length / customerPayments.length > 0.5) {
        return {
          isSuspicious: true,
          reason: `High refund rate: ${((refundedPayments.length / customerPayments.length) * 100).toFixed(1)}%`,
          score: 20,
        };
      }

      // Check for high failure rate
      const failedPayments = customerPayments.filter((p) => p.status === 'failed');
      if (customerPayments.length > 5 && failedPayments.length / customerPayments.length > 0.5) {
        return {
          isSuspicious: true,
          reason: `High failure rate: ${((failedPayments.length / customerPayments.length) * 100).toFixed(1)}%`,
          score: 15,
        };
      }

      return { isSuspicious: false, reason: '', score: 0 };
    } catch (error) {
      logger.error('Error checking customer history', error);
      return { isSuspicious: false, reason: '', score: 0 };
    }
  }

  // Check for failed payment attempts
  private async checkFailedAttempts(customerId?: string, teamId?: string): Promise<{ isSuspicious: boolean; reason: string; score: number }> {
    try {
      const where: any = { status: 'failed' };
      if (teamId) where.teamId = teamId;
      if (customerId) where.customerId = customerId;

      const failedPayments = await this.paymentRepository.getPaymentsByStatus('failed', teamId, 50);

      if (!customerId) {
        return { isSuspicious: false, reason: '', score: 0 };
      }

      const customerFailedPayments = failedPayments.filter((p) => p.customerId === customerId);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentFailures = customerFailedPayments.filter((p) => p.timestamp > oneHourAgo);

      // More than 5 failed attempts in last hour
      if (recentFailures.length >= 5) {
        return {
          isSuspicious: true,
          reason: `Multiple failed payment attempts: ${recentFailures.length} in last hour`,
          score: 40,
        };
      }

      // More than 3 failed attempts in last hour
      if (recentFailures.length >= 3) {
        return {
          isSuspicious: true,
          reason: `Several failed payment attempts: ${recentFailures.length} in last hour`,
          score: 20,
        };
      }

      return { isSuspicious: false, reason: '', score: 0 };
    } catch (error) {
      logger.error('Error checking failed attempts', error);
      return { isSuspicious: false, reason: '', score: 0 };
    }
  }

  // Detect fraud patterns
  private async detectFraudPatterns(request: FraudCheckRequest): Promise<FraudPattern[]> {
    try {
      const patterns: FraudPattern[] = [];

      // Pattern 1: Card testing (multiple small amounts)
      if (request.method === 'card' && request.amount < 100 && request.customerId) {
        const recentPayments = await this.paymentRepository.getPaymentsByCustomerId(request.customerId, 20);
        const smallCardPayments = recentPayments.filter(
          (p) => p.method === 'card' && p.amount < 100 && p.timestamp > new Date(Date.now() - 60 * 60 * 1000)
        );

        if (smallCardPayments.length >= 5) {
          patterns.push({
            type: 'card',
            description: 'Card testing pattern detected - multiple small card payments',
            severity: 'high',
          });
        }
      }

      // Pattern 2: Rapid payment switching between methods
      if (request.customerId) {
        const recentPayments = await this.paymentRepository.getPaymentsByCustomerId(request.customerId, 10);
        const uniqueMethods = new Set(recentPayments.slice(0, 5).map((p) => p.method));

        if (uniqueMethods.size >= 3 && recentPayments.length >= 3) {
          patterns.push({
            type: 'customer',
            description: 'Rapid payment method switching detected',
            severity: 'medium',
          });
        }
      }

      // Pattern 3: Round number amounts (suspicious)
      if (request.amount % 1000 === 0 && request.amount > 10000) {
        patterns.push({
          type: 'amount',
          description: 'Suspicious round number amount detected',
          severity: 'low',
        });
      }

      // Pattern 4: High-value COD orders
      if (request.method === 'cod' && request.amount > 50000) {
        patterns.push({
          type: 'amount',
          description: 'High-value COD order detected',
          severity: 'medium',
        });
      }

      return patterns;
    } catch (error) {
      logger.error('Error detecting fraud patterns', error);
      return [];
    }
  }

  // Report fraud
  async reportFraud(paymentId: string, reason: string, reportedBy?: string): Promise<void> {
    try {
      const payment = await this.paymentRepository.getPaymentById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Log fraud report
      await this.paymentRepository.createPaymentLog({
        paymentId,
        action: 'fraud_reported',
        status: 'success',
        errorMessage: reason,
        metadata: {
          reportedBy,
          reportedAt: new Date().toISOString(),
        },
      });

      logger.warn(`Fraud reported for payment ${paymentId}: ${reason}`);
    } catch (error) {
      logger.error('Error reporting fraud', error);
      throw error;
    }
  }

  // Get fraud statistics
  async getFraudStatistics(teamId: string): Promise<{
    totalFraudulentPayments: number;
    totalBlockedPayments: number;
    topFraudReasons: Array<{ reason: string; count: number }>;
    fraudByMethod: Array<{ method: string; count: number }>;
  }> {
    try {
      const result = await this.paymentRepository.searchPayments(10000, 0, { teamId });

      // Count fraudulent payments (based on logs)
      const fraudulentPaymentIds = new Set<string>();

      for (const payment of result.payments) {
        const logs = await this.paymentRepository.getPaymentLogs(payment.id, 100);
        const hasFraudReport = logs.some((log) => log.action === 'fraud_reported');
        if (hasFraudReport) {
          fraudulentPaymentIds.add(payment.id);
        }
      }

      // Get fraud reasons from logs
      const fraudReasons: Record<string, number> = {};
      for (const paymentId of fraudulentPaymentIds) {
        const logs = await this.paymentRepository.getPaymentLogs(paymentId, 100);
        const fraudLog = logs.find((log) => log.action === 'fraud_reported');
        if (fraudLog && fraudLog.errorMessage) {
          fraudReasons[fraudLog.errorMessage] = (fraudReasons[fraudLog.errorMessage] || 0) + 1;
        }
      }

      // Count by method
      const fraudByMethod: Record<string, number> = {};
      for (const paymentId of fraudulentPaymentIds) {
        const payment = result.payments.find((p) => p.id === paymentId);
        if (payment) {
          fraudByMethod[payment.method] = (fraudByMethod[payment.method] || 0) + 1;
        }
      }

      // Top fraud reasons
      const topFraudReasons = Object.entries(fraudReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Fraud by method
      const fraudByMethodArray = Object.entries(fraudByMethod)
        .map(([method, count]) => ({ method, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalFraudulentPayments: fraudulentPaymentIds.size,
        totalBlockedPayments: 0, // This would be tracked separately
        topFraudReasons,
        fraudByMethod: fraudByMethodArray,
      };
    } catch (error) {
      logger.error('Error getting fraud statistics', error);
      throw error;
    }
  }
}
