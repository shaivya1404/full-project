import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { CallbackSchedule } from '@prisma/client';

export interface ScheduleCallbackInput {
  teamId: string;
  contactId: string;
  campaignId?: string;
  scheduledTime: Date;
  timezone?: string;
  reason?: 'customer_request' | 'no_answer' | 'follow_up' | 'reschedule';
  priority?: number;
  notes?: string;
  maxAttempts?: number;
}

export interface CallbackWithContact extends CallbackSchedule {
  contact: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
  };
  campaign?: {
    id: string;
    name: string;
  } | null;
}

export class CallbackService {
  /**
   * Schedule a callback
   */
  async scheduleCallback(input: ScheduleCallbackInput): Promise<CallbackSchedule> {
    const callback = await prisma.callbackSchedule.create({
      data: {
        teamId: input.teamId,
        contactId: input.contactId,
        campaignId: input.campaignId,
        scheduledTime: input.scheduledTime,
        timezone: input.timezone || 'Asia/Kolkata',
        reason: input.reason || 'customer_request',
        priority: input.priority || 0,
        notes: input.notes,
        maxAttempts: input.maxAttempts || 3,
        status: 'pending'
      }
    });

    logger.info(`Callback scheduled for contact ${input.contactId} at ${input.scheduledTime}`);
    return callback;
  }

  /**
   * Get upcoming callbacks (next N hours)
   */
  async getUpcomingCallbacks(
    teamId: string,
    hours: number = 24
  ): Promise<CallbackWithContact[]> {
    const now = new Date();
    const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return prisma.callbackSchedule.findMany({
      where: {
        teamId,
        status: 'pending',
        scheduledTime: {
          gte: now,
          lte: endTime
        }
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledTime: 'asc' }
      ]
    }) as Promise<CallbackWithContact[]>;
  }

  /**
   * Get all callbacks for a team with filters
   */
  async getCallbacks(
    teamId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: string;
      campaignId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ callbacks: CallbackWithContact[]; total: number }> {
    const where: any = { teamId };

    if (filters?.status) where.status = filters.status;
    if (filters?.campaignId) where.campaignId = filters.campaignId;
    if (filters?.startDate || filters?.endDate) {
      where.scheduledTime = {};
      if (filters.startDate) where.scheduledTime.gte = filters.startDate;
      if (filters.endDate) where.scheduledTime.lte = filters.endDate;
    }

    const [callbacks, total] = await Promise.all([
      prisma.callbackSchedule.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true
            }
          },
          campaign: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { scheduledTime: 'asc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.callbackSchedule.count({ where })
    ]);

    return { callbacks: callbacks as CallbackWithContact[], total };
  }

  /**
   * Get callbacks due for processing
   */
  async getDueCallbacks(teamId?: string): Promise<CallbackWithContact[]> {
    const now = new Date();
    const where: any = {
      status: 'pending',
      scheduledTime: { lte: now }
    };

    if (teamId) where.teamId = teamId;

    return prisma.callbackSchedule.findMany({
      where,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledTime: 'asc' }
      ]
    }) as Promise<CallbackWithContact[]>;
  }

  /**
   * Process callback queue (to be called by cron job)
   */
  async processCallbackQueue(): Promise<{ processed: number; failed: number }> {
    const dueCallbacks = await this.getDueCallbacks();
    let processed = 0;
    let failed = 0;

    for (const callback of dueCallbacks) {
      try {
        // Mark as in progress
        await prisma.callbackSchedule.update({
          where: { id: callback.id },
          data: {
            status: 'in_progress',
            attempts: { increment: 1 }
          }
        });

        // Here you would integrate with your calling system
        // For now, we'll just log and mark as processed
        logger.info(`Processing callback ${callback.id} for contact ${callback.contactId}`);

        // This would be replaced with actual call initiation
        // await twilioService.initiateCall(callback.contact.phone, ...);

        processed++;
      } catch (err) {
        logger.error(`Failed to process callback ${callback.id}:`, err);

        // Check if max attempts reached
        if (callback.attempts + 1 >= callback.maxAttempts) {
          await prisma.callbackSchedule.update({
            where: { id: callback.id },
            data: { status: 'missed' }
          });
        } else {
          // Reschedule for later
          const nextAttempt = new Date();
          nextAttempt.setMinutes(nextAttempt.getMinutes() + 30); // Retry in 30 minutes

          await prisma.callbackSchedule.update({
            where: { id: callback.id },
            data: {
              status: 'pending',
              scheduledTime: nextAttempt
            }
          });
        }

        failed++;
      }
    }

    logger.info(`Callback queue processed: ${processed} success, ${failed} failed`);
    return { processed, failed };
  }

  /**
   * Cancel a callback
   */
  async cancelCallback(callbackId: string): Promise<void> {
    await prisma.callbackSchedule.update({
      where: { id: callbackId },
      data: { status: 'cancelled' }
    });

    logger.info(`Callback ${callbackId} cancelled`);
  }

  /**
   * Reschedule a callback
   */
  async rescheduleCallback(
    callbackId: string,
    newScheduledTime: Date,
    notes?: string
  ): Promise<CallbackSchedule> {
    const updated = await prisma.callbackSchedule.update({
      where: { id: callbackId },
      data: {
        scheduledTime: newScheduledTime,
        status: 'pending',
        notes: notes ? `${notes} (rescheduled)` : undefined
      }
    });

    logger.info(`Callback ${callbackId} rescheduled to ${newScheduledTime}`);
    return updated;
  }

  /**
   * Mark callback as complete
   */
  async markCallbackComplete(
    callbackId: string,
    resultCallId?: string,
    notes?: string
  ): Promise<void> {
    await prisma.callbackSchedule.update({
      where: { id: callbackId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        resultCallId,
        notes: notes || undefined
      }
    });

    logger.info(`Callback ${callbackId} marked as completed`);
  }

  /**
   * Get callback statistics
   */
  async getCallbackStats(teamId: string, days: number = 30): Promise<{
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    missed: number;
    completionRate: number;
    avgCallbackDelay: number; // in hours
    byReason: { reason: string; count: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const callbacks = await prisma.callbackSchedule.findMany({
      where: {
        teamId,
        createdAt: { gte: startDate }
      },
      select: {
        status: true,
        reason: true,
        scheduledTime: true,
        completedAt: true
      }
    });

    const total = callbacks.length;
    const pending = callbacks.filter((c: any) => c.status === 'pending').length;
    const completed = callbacks.filter((c: any) => c.status === 'completed').length;
    const cancelled = callbacks.filter((c: any) => c.status === 'cancelled').length;
    const missed = callbacks.filter((c: any) => c.status === 'missed').length;

    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    // Calculate average delay
    const completedWithTimes = callbacks.filter((c: any) => c.status === 'completed' && c.completedAt);
    const avgDelay = completedWithTimes.length > 0
      ? completedWithTimes.reduce((sum: any, c: any) => {
          const scheduled = new Date(c.scheduledTime).getTime();
          const completed = new Date(c.completedAt!).getTime();
          return sum + (completed - scheduled) / (1000 * 60 * 60); // Convert to hours
        }, 0) / completedWithTimes.length
      : 0;

    // Group by reason
    const reasonCounts: Record<string, number> = {};
    for (const callback of callbacks) {
      const reason = callback.reason || 'unknown';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }

    const byReason = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      pending,
      completed,
      cancelled,
      missed,
      completionRate: Math.round(completionRate * 10) / 10,
      avgCallbackDelay: Math.round(avgDelay * 10) / 10,
      byReason
    };
  }

  /**
   * Get best time to call based on historical data
   */
  async getBestTimeToCall(contactId: string): Promise<string | null> {
    // Get successful calls for this contact
    const callLogs = await prisma.callLog.findMany({
      where: {
        contactId,
        result: { in: ['completed', 'interested', 'callback_requested'] }
      },
      select: {
        createdAt: true
      }
    });

    if (callLogs.length === 0) return null;

    // Analyze hour distribution
    const hourCounts: Record<number, number> = {};
    for (const log of callLogs) {
      const hour = new Date(log.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    // Find the hour with most successful calls
    let bestHour = 10; // Default to 10 AM
    let maxCount = 0;

    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestHour = parseInt(hour, 10);
      }
    }

    // Format as time string
    const formattedHour = bestHour.toString().padStart(2, '0');
    return `${formattedHour}:00`;
  }

  /**
   * Get callback by ID
   */
  async getCallbackById(callbackId: string): Promise<CallbackWithContact | null> {
    return prisma.callbackSchedule.findUnique({
      where: { id: callbackId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      }
    }) as Promise<CallbackWithContact | null>;
  }
}

export const callbackService = new CallbackService();
