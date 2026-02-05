import { Contact, CallLog } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Buying signal keywords
const BUYING_SIGNALS = {
  high_intent: [
    'interested', 'sign up', 'sign me up', 'how much', 'price', 'cost',
    'when can', 'how soon', 'start today', 'ready to', 'want to buy',
    'purchase', 'subscribe', 'enroll', 'register'
  ],
  medium_intent: [
    'tell me more', 'explain', 'details', 'benefits', 'features',
    'compare', 'options', 'plans', 'packages'
  ],
  low_intent: [
    'maybe', 'think about', 'consider', 'not sure', 'later'
  ],
  negative: [
    'not interested', 'no thanks', 'don\'t call', 'remove me',
    'stop calling', 'already have', 'competitor'
  ]
};

// Lead tier thresholds
const TIER_THRESHOLDS = {
  hot: 70,
  warm: 40,
  cold: 0
};

export type LeadTier = 'hot' | 'warm' | 'cold' | 'unknown';

export interface LeadScoreDetails {
  contactId: string;
  totalScore: number;
  tier: LeadTier;
  breakdown: {
    callHistory: number;
    engagement: number;
    recency: number;
    signals: number;
  };
  buyingSignals: string[];
  lastScoredAt: Date;
}

export interface LeadAnalytics {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  averageScore: number;
  scoreDistribution: { range: string; count: number }[];
  topSignals: { signal: string; count: number }[];
}

export class LeadScoringService {
  /**
   * Calculate lead score for a contact
   */
  async calculateLeadScore(contactId: string): Promise<LeadScoreDetails> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        callLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }

    const breakdown = {
      callHistory: this.calculateCallHistoryScore(contact),
      engagement: this.calculateEngagementScore(contact.callLogs),
      recency: this.calculateRecencyScore(contact.lastContactedAt),
      signals: 0
    };

    // Analyze transcripts for buying signals
    const buyingSignals = this.detectBuyingSignalsFromLogs(contact.callLogs);
    breakdown.signals = this.calculateSignalScore(buyingSignals);

    const totalScore = Math.min(100, Math.max(0,
      breakdown.callHistory + breakdown.engagement + breakdown.recency + breakdown.signals
    ));

    const tier = this.determineTier(totalScore);

    // Update contact with new score
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        leadScore: totalScore,
        leadTier: tier,
        buyingSignals: JSON.stringify(buyingSignals),
        lastScoredAt: new Date()
      }
    });

    logger.info(`Lead score calculated for ${contactId}: ${totalScore} (${tier})`);

    return {
      contactId,
      totalScore,
      tier,
      breakdown,
      buyingSignals,
      lastScoredAt: new Date()
    };
  }

  /**
   * Calculate score based on call history
   */
  private calculateCallHistoryScore(contact: Contact): number {
    let score = 0;

    // Successful calls contribute positively
    score += Math.min(20, (contact.successfulCalls || 0) * 5);

    // Total engagement shows interest
    score += Math.min(10, (contact.totalCalls || 0) * 2);

    return score;
  }

  /**
   * Calculate score based on engagement from call logs
   */
  private calculateEngagementScore(callLogs: CallLog[]): number {
    if (!callLogs || callLogs.length === 0) return 0;

    let score = 0;

    for (const log of callLogs) {
      // Longer calls indicate more engagement
      if (log.duration) {
        if (log.duration > 300) score += 10; // > 5 min
        else if (log.duration > 120) score += 5; // > 2 min
        else if (log.duration > 30) score += 2; // > 30 sec
      }

      // Successful outcomes
      if (log.result === 'completed' || log.result === 'interested') {
        score += 10;
      } else if (log.result === 'callback_requested') {
        score += 15;
      } else if (log.result === 'not_interested') {
        score -= 10;
      }
    }

    return Math.min(30, Math.max(-10, score));
  }

  /**
   * Calculate score based on recency of last contact
   */
  private calculateRecencyScore(lastContactedAt: Date | null): number {
    if (!lastContactedAt) return 5; // New lead gets some baseline score

    const daysSinceContact = Math.floor(
      (Date.now() - new Date(lastContactedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceContact <= 1) return 20;
    if (daysSinceContact <= 3) return 15;
    if (daysSinceContact <= 7) return 10;
    if (daysSinceContact <= 14) return 5;
    if (daysSinceContact <= 30) return 2;
    return 0;
  }

  /**
   * Calculate score from detected buying signals
   */
  private calculateSignalScore(signals: string[]): number {
    let score = 0;

    for (const signal of signals) {
      if (BUYING_SIGNALS.high_intent.includes(signal.toLowerCase())) {
        score += 10;
      } else if (BUYING_SIGNALS.medium_intent.includes(signal.toLowerCase())) {
        score += 5;
      } else if (BUYING_SIGNALS.negative.includes(signal.toLowerCase())) {
        score -= 15;
      }
    }

    return Math.min(30, Math.max(-20, score));
  }

  /**
   * Detect buying signals from call log transcripts
   */
  detectBuyingSignalsFromLogs(callLogs: CallLog[]): string[] {
    const signals: string[] = [];

    for (const log of callLogs) {
      if (log.transcript) {
        const detectedSignals = this.detectBuyingSignals(log.transcript);
        signals.push(...detectedSignals);
      }
    }

    // Return unique signals
    return [...new Set(signals)];
  }

  /**
   * Detect buying signals from text
   */
  detectBuyingSignals(text: string): string[] {
    const lowerText = text.toLowerCase();
    const signals: string[] = [];

    const allSignals = [
      ...BUYING_SIGNALS.high_intent,
      ...BUYING_SIGNALS.medium_intent,
      ...BUYING_SIGNALS.low_intent,
      ...BUYING_SIGNALS.negative
    ];

    for (const signal of allSignals) {
      if (lowerText.includes(signal)) {
        signals.push(signal);
      }
    }

    return signals;
  }

  /**
   * Determine lead tier based on score
   */
  private determineTier(score: number): LeadTier {
    if (score >= TIER_THRESHOLDS.hot) return 'hot';
    if (score >= TIER_THRESHOLDS.warm) return 'warm';
    if (score >= TIER_THRESHOLDS.cold) return 'cold';
    return 'unknown';
  }

  /**
   * Update lead tier for a contact
   */
  async updateLeadTier(contactId: string): Promise<LeadTier> {
    const details = await this.calculateLeadScore(contactId);
    return details.tier;
  }

  /**
   * Get hot leads for a campaign
   */
  async getHotLeads(campaignId?: string, limit: number = 50): Promise<Contact[]> {
    const where: any = { leadTier: 'hot' };
    if (campaignId) {
      where.campaignId = campaignId;
    }

    return prisma.contact.findMany({
      where,
      orderBy: { leadScore: 'desc' },
      take: limit
    });
  }

  /**
   * Get leads by tier
   */
  async getLeadsByTier(
    tier: LeadTier,
    campaignId?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ leads: Contact[]; total: number }> {
    const where: any = { leadTier: tier };
    if (campaignId) {
      where.campaignId = campaignId;
    }

    const [leads, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { leadScore: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.contact.count({ where })
    ]);

    return { leads, total };
  }

  /**
   * Score a call outcome and update contact
   */
  async scoreCallOutcome(callLogId: string): Promise<void> {
    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
      include: { contact: true }
    });

    if (!callLog) {
      throw new Error(`CallLog ${callLogId} not found`);
    }

    // Update contact stats
    const updateData: any = {
      totalCalls: { increment: 1 },
      lastContactedAt: new Date()
    };

    if (callLog.result === 'completed' || callLog.result === 'interested') {
      updateData.successfulCalls = { increment: 1 };
    }

    await prisma.contact.update({
      where: { id: callLog.contactId },
      data: updateData
    });

    // Recalculate lead score
    await this.calculateLeadScore(callLog.contactId);

    logger.info(`Call outcome scored for contact ${callLog.contactId}`);
  }

  /**
   * Get lead analytics for a team/campaign
   */
  async getLeadAnalytics(teamId?: string, campaignId?: string): Promise<LeadAnalytics> {
    const where: any = {};
    if (campaignId) {
      where.campaignId = campaignId;
    }

    const contacts = await prisma.contact.findMany({
      where,
      select: {
        leadScore: true,
        leadTier: true,
        buyingSignals: true
      }
    });

    const totalLeads = contacts.length;
    const hotLeads = contacts.filter(c => c.leadTier === 'hot').length;
    const warmLeads = contacts.filter(c => c.leadTier === 'warm').length;
    const coldLeads = contacts.filter(c => c.leadTier === 'cold').length;

    const averageScore = totalLeads > 0
      ? contacts.reduce((sum, c) => sum + (c.leadScore || 0), 0) / totalLeads
      : 0;

    // Score distribution
    const scoreDistribution = [
      { range: '0-20', count: contacts.filter(c => (c.leadScore || 0) >= 0 && (c.leadScore || 0) < 20).length },
      { range: '20-40', count: contacts.filter(c => (c.leadScore || 0) >= 20 && (c.leadScore || 0) < 40).length },
      { range: '40-60', count: contacts.filter(c => (c.leadScore || 0) >= 40 && (c.leadScore || 0) < 60).length },
      { range: '60-80', count: contacts.filter(c => (c.leadScore || 0) >= 60 && (c.leadScore || 0) < 80).length },
      { range: '80-100', count: contacts.filter(c => (c.leadScore || 0) >= 80).length }
    ];

    // Top signals
    const signalCounts: Record<string, number> = {};
    for (const contact of contacts) {
      if (contact.buyingSignals) {
        try {
          const signals = JSON.parse(contact.buyingSignals) as string[];
          for (const signal of signals) {
            signalCounts[signal] = (signalCounts[signal] || 0) + 1;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    const topSignals = Object.entries(signalCounts)
      .map(([signal, count]) => ({ signal, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      averageScore: Math.round(averageScore * 10) / 10,
      scoreDistribution,
      topSignals
    };
  }

  /**
   * Bulk recalculate scores for a campaign
   */
  async bulkRecalculateScores(campaignId: string): Promise<{ processed: number }> {
    const contacts = await prisma.contact.findMany({
      where: { campaignId },
      select: { id: true }
    });

    let processed = 0;
    for (const contact of contacts) {
      try {
        await this.calculateLeadScore(contact.id);
        processed++;
      } catch (err) {
        logger.error(`Error scoring contact ${contact.id}:`, err);
      }
    }

    logger.info(`Bulk scored ${processed}/${contacts.length} contacts for campaign ${campaignId}`);
    return { processed };
  }
}

export const leadScoringService = new LeadScoringService();
