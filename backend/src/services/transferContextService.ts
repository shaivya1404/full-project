import { prisma } from '../db/client';
import { TransferContext, TransferLog } from '@prisma/client';
import { conversationStateService } from './conversationStateService';
import { customerMemoryService } from './customerMemoryService';
import { emotionDetectionService } from './emotionDetectionService';
import { logger } from '../utils/logger';

// Types
export interface CustomerContext {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  isReturningCustomer: boolean;
  customerTier: 'vip' | 'regular' | 'new';
  previousIssuesCount: number;
  lifetimeValue?: number;
}

export interface ConversationSummary {
  summary: string;
  topicsDiscussed: string[];
  callDuration: number;
  turnsCount: number;
}

export interface IssueDetails {
  primaryIssue?: string;
  issueCategory?: string;
  issueSeverity: 'low' | 'medium' | 'high' | 'critical';
  relatedIssues?: string[];
}

export interface EmotionAnalysis {
  overallSentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  currentEmotion: string;
  frustrationLevel: number;
  emotionTrend: 'improving' | 'declining' | 'stable';
}

export interface SolutionAttempts {
  attemptedSolutions: string[];
  whatWorked: string[];
  whatDidntWork: string[];
}

export interface AgentRecommendations {
  recommendations: string[];
  warningsForAgent: string[];
  suggestedOpening?: string;
}

export interface AgentViewContext {
  customer: CustomerContext;
  conversation: ConversationSummary;
  issue: IssueDetails;
  emotion: EmotionAnalysis;
  solutions: SolutionAttempts;
  recommendations: AgentRecommendations;
  collectedInfo: Record<string, any>;
  transferReason: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Issue severity keywords
const SEVERITY_KEYWORDS = {
  critical: ['urgent', 'emergency', 'immediately', 'right now', 'asap', 'critical', 'life', 'health', 'safety'],
  high: ['very upset', 'furious', 'unacceptable', 'legal', 'lawsuit', 'complaint', 'third time', 'fourth time'],
  medium: ['frustrated', 'annoyed', 'disappointed', 'problem', 'issue'],
  low: ['question', 'wondering', 'curious', 'minor'],
};

// Issue category patterns
const ISSUE_CATEGORIES = {
  billing: ['charge', 'payment', 'refund', 'price', 'cost', 'money', 'invoice'],
  delivery: ['delivery', 'shipping', 'arrived', 'late', 'missing', 'track'],
  product: ['quality', 'broken', 'damaged', 'defective', 'wrong item'],
  service: ['rude', 'unhelpful', 'service', 'support', 'agent'],
  account: ['account', 'password', 'login', 'access', 'profile'],
  order: ['order', 'cancel', 'modify', 'change'],
};

/**
 * Service for building comprehensive transfer context for human agents
 */
export class TransferContextService {
  /**
   * Build complete transfer context
   */
  async buildTransferContext(
    callId: string,
    transferLogId: string
  ): Promise<TransferContext> {
    try {
      // Get call information
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: {
          transcripts: { orderBy: { createdAt: 'asc' } },
          analytics: { take: 1 },
          conversationState: true,
        },
      });

      if (!call) {
        throw new Error(`Call ${callId} not found`);
      }

      // Get customer context
      const customerContext = await this.gatherCustomerContext(call.caller, call.teamId);

      // Summarize conversation
      const conversationSummary = await this.summarizeConversation(call);

      // Extract issue details
      const issueDetails = this.extractIssueDetails(call.transcripts);

      // Analyze sentiment and emotion
      const emotionAnalysis = await this.analyzeSentimentAndEmotion(call);

      // Get attempted solutions from conversation state
      const solutions = await this.getAttemptedSolutions(call.streamSid);

      // Generate recommendations
      const recommendations = this.generateAgentRecommendations({
        customer: customerContext,
        issue: issueDetails,
        emotion: emotionAnalysis,
        solutions,
      });

      // Get collected info
      const collectedInfo = conversationStateService.getCollectedFields(call.streamSid);

      // Create transfer context
      const transferContext = await prisma.transferContext.create({
        data: {
          callId,
          transferLogId,
          customerName: customerContext.customerName,
          customerPhone: customerContext.customerPhone,
          customerId: customerContext.customerId,
          isReturningCustomer: customerContext.isReturningCustomer,
          customerTier: customerContext.customerTier,
          conversationSummary: conversationSummary.summary,
          topicsDiscussed: JSON.stringify(conversationSummary.topicsDiscussed),
          callDuration: conversationSummary.callDuration,
          primaryIssue: issueDetails.primaryIssue,
          issueCategory: issueDetails.issueCategory,
          issueSeverity: issueDetails.issueSeverity,
          overallSentiment: emotionAnalysis.overallSentiment,
          sentimentScore: emotionAnalysis.sentimentScore,
          currentEmotion: emotionAnalysis.currentEmotion,
          frustrationLevel: emotionAnalysis.frustrationLevel,
          attemptedSolutions: JSON.stringify(solutions.attemptedSolutions),
          whatWorked: JSON.stringify(solutions.whatWorked),
          whatDidntWork: JSON.stringify(solutions.whatDidntWork),
          recommendations: JSON.stringify(recommendations.recommendations),
          warningsForAgent: JSON.stringify(recommendations.warningsForAgent),
          collectedInfo: JSON.stringify(collectedInfo),
        },
      });

      logger.info(`Built transfer context for call ${callId}`);
      return transferContext;
    } catch (error) {
      logger.error('Error building transfer context', error);
      throw error;
    }
  }

  /**
   * Gather customer context
   */
  private async gatherCustomerContext(
    phone: string,
    teamId?: string | null
  ): Promise<CustomerContext> {
    try {
      // Find customer
      const customer = await prisma.customer.findFirst({
        where: {
          phone: { contains: phone.slice(-10) },
          ...(teamId && { teamId }),
        },
        include: {
          orders: { orderBy: { orderTime: 'desc' }, take: 10 },
          memories: { where: { factType: 'issue', isActive: true } },
        },
      });

      if (!customer) {
        return {
          customerPhone: phone,
          isReturningCustomer: false,
          customerTier: 'new',
          previousIssuesCount: 0,
        };
      }

      // Calculate lifetime value
      const lifetimeValue = customer.orders.reduce((sum, o) => sum + o.totalAmount, 0);

      // Determine tier
      let customerTier: 'vip' | 'regular' | 'new' = 'regular';
      if (lifetimeValue > 10000) customerTier = 'vip';
      else if (customer.orders.length < 2) customerTier = 'new';

      return {
        customerId: customer.id,
        customerName: customer.name || undefined,
        customerPhone: customer.phone || phone,
        isReturningCustomer: customer.orders.length > 0,
        customerTier,
        previousIssuesCount: customer.memories.length,
        lifetimeValue,
      };
    } catch (error) {
      logger.error('Error gathering customer context', error);
      return {
        customerPhone: phone,
        isReturningCustomer: false,
        customerTier: 'new',
        previousIssuesCount: 0,
      };
    }
  }

  /**
   * Summarize the conversation
   */
  private async summarizeConversation(call: any): Promise<ConversationSummary> {
    const transcripts = call.transcripts || [];

    // Build conversation text
    const conversationText = transcripts
      .map((t: any) => `${t.speaker}: ${t.text}`)
      .join('\n');

    // Extract topics (simplified - in production would use NLP)
    const topics = this.extractTopics(conversationText);

    // Calculate duration
    const callDuration = call.duration || 0;

    // Generate summary
    const summary = this.generateSummary(transcripts);

    return {
      summary,
      topicsDiscussed: topics,
      callDuration,
      turnsCount: transcripts.length,
    };
  }

  /**
   * Extract topics from conversation
   */
  private extractTopics(text: string): string[] {
    const normalizedText = text.toLowerCase();
    const topics: string[] = [];

    for (const [category, keywords] of Object.entries(ISSUE_CATEGORIES)) {
      for (const keyword of keywords) {
        if (normalizedText.includes(keyword)) {
          if (!topics.includes(category)) {
            topics.push(category);
          }
          break;
        }
      }
    }

    return topics.length > 0 ? topics : ['general inquiry'];
  }

  /**
   * Generate conversation summary
   */
  private generateSummary(transcripts: any[]): string {
    if (transcripts.length === 0) {
      return 'No conversation recorded.';
    }

    const customerMessages = transcripts
      .filter((t: any) => t.speaker === 'customer' || t.speaker === 'user')
      .slice(-5);

    if (customerMessages.length === 0) {
      return 'Customer did not speak during the call.';
    }

    // Get first and last customer messages
    const firstMessage = customerMessages[0]?.text || '';
    const lastMessage = customerMessages[customerMessages.length - 1]?.text || '';

    return `Customer started by saying: "${firstMessage.slice(0, 100)}..." ` +
      `Last concern: "${lastMessage.slice(0, 100)}..."`;
  }

  /**
   * Extract issue details from transcripts
   */
  private extractIssueDetails(transcripts: any[]): IssueDetails {
    const customerText = transcripts
      .filter((t: any) => t.speaker === 'customer' || t.speaker === 'user')
      .map((t: any) => t.text)
      .join(' ')
      .toLowerCase();

    // Determine severity
    let issueSeverity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    for (const keyword of SEVERITY_KEYWORDS.critical) {
      if (customerText.includes(keyword)) {
        issueSeverity = 'critical';
        break;
      }
    }

    if (issueSeverity !== 'critical') {
      for (const keyword of SEVERITY_KEYWORDS.high) {
        if (customerText.includes(keyword)) {
          issueSeverity = 'high';
          break;
        }
      }
    }

    if (issueSeverity === 'medium') {
      let hasLowKeyword = false;
      for (const keyword of SEVERITY_KEYWORDS.low) {
        if (customerText.includes(keyword)) {
          hasLowKeyword = true;
          break;
        }
      }
      if (hasLowKeyword && !SEVERITY_KEYWORDS.medium.some(k => customerText.includes(k))) {
        issueSeverity = 'low';
      }
    }

    // Determine category
    let issueCategory: string | undefined;
    for (const [category, keywords] of Object.entries(ISSUE_CATEGORIES)) {
      for (const keyword of keywords) {
        if (customerText.includes(keyword)) {
          issueCategory = category;
          break;
        }
      }
      if (issueCategory) break;
    }

    // Extract primary issue (simplified)
    const primaryIssue = customerText.length > 200
      ? customerText.slice(0, 200) + '...'
      : customerText;

    return {
      primaryIssue,
      issueCategory,
      issueSeverity,
    };
  }

  /**
   * Analyze sentiment and emotion
   */
  private async analyzeSentimentAndEmotion(call: any): Promise<EmotionAnalysis> {
    const state = await conversationStateService.getState(call.streamSid);
    const analytics = call.analytics?.[0];

    const emotionTrend = conversationStateService.getEmotionTrend(call.streamSid);

    let sentimentScore = state?.emotionScore || 0.5;
    if (analytics?.sentimentScore !== null && analytics?.sentimentScore !== undefined) {
      sentimentScore = (sentimentScore + analytics.sentimentScore) / 2;
    }

    let overallSentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (sentimentScore >= 0.6) overallSentiment = 'positive';
    else if (sentimentScore <= 0.4) overallSentiment = 'negative';

    // Calculate frustration level (0-10)
    let frustrationLevel = Math.round((1 - sentimentScore) * 10);
    if (state?.currentEmotion === 'anger') frustrationLevel = Math.max(frustrationLevel, 8);
    if (state?.currentEmotion === 'frustration') frustrationLevel = Math.max(frustrationLevel, 6);

    return {
      overallSentiment,
      sentimentScore,
      currentEmotion: state?.currentEmotion || 'neutral',
      frustrationLevel,
      emotionTrend: emotionTrend.trend,
    };
  }

  /**
   * Get attempted solutions from conversation state
   */
  private async getAttemptedSolutions(streamSid: string): Promise<SolutionAttempts> {
    const state = await conversationStateService.getState(streamSid);

    // In a real implementation, this would track specific solution attempts
    // For now, derive from steps completed
    const attemptedSolutions = state?.stepsCompleted || [];

    return {
      attemptedSolutions,
      whatWorked: [], // Would be tracked during conversation
      whatDidntWork: [], // Would be tracked during conversation
    };
  }

  /**
   * Generate recommendations for the agent
   */
  private generateAgentRecommendations(context: {
    customer: CustomerContext;
    issue: IssueDetails;
    emotion: EmotionAnalysis;
    solutions: SolutionAttempts;
  }): AgentRecommendations {
    const recommendations: string[] = [];
    const warnings: string[] = [];

    // Based on emotion
    if (context.emotion.frustrationLevel >= 7) {
      recommendations.push('Customer is highly frustrated - start with sincere apology');
      warnings.push('Avoid asking them to repeat information');
    }

    if (context.emotion.currentEmotion === 'anger') {
      recommendations.push('Let customer vent first before offering solutions');
      warnings.push('Do not interrupt or be defensive');
    }

    // Based on customer tier
    if (context.customer.customerTier === 'vip') {
      recommendations.push('VIP customer - consider priority treatment and compensation');
    }

    if (context.customer.previousIssuesCount > 2) {
      recommendations.push('Customer has multiple past issues - escalation may be needed');
      warnings.push('This is a repeat issue - standard responses may not work');
    }

    // Based on issue severity
    if (context.issue.issueSeverity === 'critical') {
      recommendations.push('URGENT: Resolve immediately or escalate to supervisor');
    }

    // Suggested opening
    let suggestedOpening = "Hi, I've been briefed on the situation. ";

    if (context.emotion.frustrationLevel >= 6) {
      suggestedOpening += "I completely understand your frustration and I'm here to help resolve this.";
    } else {
      suggestedOpening += "How can I help you further?";
    }

    return {
      recommendations,
      warningsForAgent: warnings,
      suggestedOpening,
    };
  }

  /**
   * Get transfer context by transfer log ID
   */
  async getTransferContext(transferLogId: string): Promise<TransferContext | null> {
    return await prisma.transferContext.findUnique({
      where: { transferLogId },
    });
  }

  /**
   * Get formatted context for agent dashboard
   */
  async getContextForAgent(callId: string): Promise<AgentViewContext | null> {
    try {
      const context = await prisma.transferContext.findFirst({
        where: { callId },
        orderBy: { createdAt: 'desc' },
      });

      if (!context) return null;

      return {
        customer: {
          customerId: context.customerId || undefined,
          customerName: context.customerName || undefined,
          customerPhone: context.customerPhone || undefined,
          isReturningCustomer: context.isReturningCustomer,
          customerTier: (context.customerTier as 'vip' | 'regular' | 'new') || 'new',
          previousIssuesCount: 0, // Would need to query
        },
        conversation: {
          summary: context.conversationSummary,
          topicsDiscussed: JSON.parse(context.topicsDiscussed || '[]'),
          callDuration: context.callDuration || 0,
          turnsCount: 0,
        },
        issue: {
          primaryIssue: context.primaryIssue || undefined,
          issueCategory: context.issueCategory || undefined,
          issueSeverity: (context.issueSeverity as 'low' | 'medium' | 'high' | 'critical') || 'medium',
        },
        emotion: {
          overallSentiment: (context.overallSentiment as 'positive' | 'neutral' | 'negative') || 'neutral',
          sentimentScore: context.sentimentScore || 0.5,
          currentEmotion: context.currentEmotion || 'neutral',
          frustrationLevel: context.frustrationLevel,
          emotionTrend: 'stable',
        },
        solutions: {
          attemptedSolutions: JSON.parse(context.attemptedSolutions || '[]'),
          whatWorked: JSON.parse(context.whatWorked || '[]'),
          whatDidntWork: JSON.parse(context.whatDidntWork || '[]'),
        },
        recommendations: {
          recommendations: JSON.parse(context.recommendations || '[]'),
          warningsForAgent: JSON.parse(context.warningsForAgent || '[]'),
        },
        collectedInfo: JSON.parse(context.collectedInfo || '{}'),
        transferReason: 'AI requested transfer',
        urgencyLevel: context.frustrationLevel >= 7 ? 'high' : context.frustrationLevel >= 4 ? 'medium' : 'low',
      };
    } catch (error) {
      logger.error('Error getting context for agent', error);
      return null;
    }
  }

  /**
   * Update live context during call (before transfer)
   */
  async updateLiveContext(
    callId: string,
    updates: Partial<{
      attemptedSolutions: string[];
      currentEmotion: string;
      frustrationLevel: number;
    }>
  ): Promise<void> {
    try {
      const context = await prisma.transferContext.findFirst({
        where: { callId },
        orderBy: { createdAt: 'desc' },
      });

      if (context) {
        await prisma.transferContext.update({
          where: { id: context.id },
          data: {
            ...(updates.attemptedSolutions && {
              attemptedSolutions: JSON.stringify(updates.attemptedSolutions),
            }),
            ...(updates.currentEmotion && { currentEmotion: updates.currentEmotion }),
            ...(updates.frustrationLevel !== undefined && { frustrationLevel: updates.frustrationLevel }),
          },
        });
      }
    } catch (error) {
      logger.error('Error updating live context', error);
    }
  }
}

export const transferContextService = new TransferContextService();
