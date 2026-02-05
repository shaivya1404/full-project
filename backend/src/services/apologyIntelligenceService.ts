import { prisma } from '../db/client';
import { ApologyTemplate } from '@prisma/client';
import { conversationStateService } from './conversationStateService';
import { customerMemoryService } from './customerMemoryService';
import { logger } from '../utils/logger';

// Types
export type ApologySituation =
  | 'late_delivery'
  | 'wrong_order'
  | 'poor_service'
  | 'billing_error'
  | 'repeat_issue'
  | 'long_wait'
  | 'system_error'
  | 'miscommunication'
  | 'product_unavailable'
  | 'general';

export interface ApologyContext {
  transcript: string;
  customerMemory?: any;
  isRepeatIssue?: boolean;
  callCount?: number;
  waitTime?: number;
}

export interface ApologyDecision {
  shouldApologize: boolean;
  situation?: ApologySituation;
  reason?: string;
  isCompanyFault: boolean;
}

export interface ApologyResponse {
  apology: string;
  isSpecific: boolean;
  followUpAction?: string;
  promiseMade?: string;
}

// Situation detection patterns
const SITUATION_PATTERNS: Record<ApologySituation, { keywords: string[]; phrases: string[] }> = {
  late_delivery: {
    keywords: ['late', 'delay', 'waiting', 'slow', 'hours', 'still'],
    phrases: [
      'where is my order',
      'hasn\'t arrived',
      'still waiting',
      'been waiting',
      'too long',
      'order is late',
      'not delivered',
    ],
  },
  wrong_order: {
    keywords: ['wrong', 'incorrect', 'mistake', 'different', 'not what'],
    phrases: [
      'wrong order',
      'sent the wrong',
      'not what i ordered',
      'received wrong',
      'got something else',
    ],
  },
  poor_service: {
    keywords: ['rude', 'unhelpful', 'terrible', 'worst', 'awful', 'bad service'],
    phrases: [
      'terrible service',
      'worst experience',
      'very disappointed',
      'never again',
      'treated badly',
    ],
  },
  billing_error: {
    keywords: ['charged', 'overcharged', 'double', 'billing', 'payment'],
    phrases: [
      'charged twice',
      'wrong amount',
      'overcharged me',
      'billing mistake',
      'shouldn\'t have charged',
    ],
  },
  repeat_issue: {
    keywords: ['again', 'third', 'fourth', 'keeps', 'always', 'every time'],
    phrases: [
      'this is the third time',
      'happened again',
      'keeps happening',
      'same problem',
      'every single time',
    ],
  },
  long_wait: {
    keywords: ['hold', 'waiting', 'minutes', 'forever'],
    phrases: [
      'been on hold',
      'waiting for',
      'took forever',
      'so long to',
    ],
  },
  system_error: {
    keywords: ['error', 'broken', 'crashed', 'glitch', 'bug', 'not working'],
    phrases: [
      'website error',
      'app crashed',
      'system down',
      'not working',
    ],
  },
  miscommunication: {
    keywords: ['told', 'said', 'promised', 'supposed'],
    phrases: [
      'you said',
      'i was told',
      'supposed to be',
      'promised me',
      'that\'s not what',
    ],
  },
  product_unavailable: {
    keywords: ['out of stock', 'unavailable', 'sold out', 'can\'t get'],
    phrases: [
      'not available',
      'out of stock',
      'can\'t find',
      'don\'t have',
    ],
  },
  general: {
    keywords: ['sorry', 'problem', 'issue', 'complaint'],
    phrases: [],
  },
};

// When NOT to apologize
const NO_APOLOGY_PATTERNS = [
  'customer error',
  'user mistake',
  'changed their mind',
  'didn\'t read',
  'missed the deadline',
  'outside policy',
];

// Default apology templates
const DEFAULT_APOLOGIES: Record<ApologySituation, { specific: string; generic: string; followUp?: string }> = {
  late_delivery: {
    specific: "I'm truly sorry your order is running late. That's unacceptable and I understand how frustrating it is.",
    generic: "I apologize for the delay.",
    followUp: "Let me check the status right now and see what we can do to make this right.",
  },
  wrong_order: {
    specific: "I sincerely apologize - we made a mistake with your order. That should never happen.",
    generic: "I'm sorry about the order mix-up.",
    followUp: "Let me arrange for the correct items to be sent to you immediately, and we'll handle the return of the wrong items.",
  },
  poor_service: {
    specific: "I'm deeply sorry for the experience you had. That's not the level of service we strive for.",
    generic: "I apologize for the poor experience.",
    followUp: "I want to make this right. Let me see what I can do for you.",
  },
  billing_error: {
    specific: "I sincerely apologize for the billing error. I can see this was our mistake.",
    generic: "I'm sorry about the billing issue.",
    followUp: "Let me correct this right now and process the refund immediately.",
  },
  repeat_issue: {
    specific: "I'm so sorry this has happened again. You shouldn't have to deal with the same problem multiple times.",
    generic: "I apologize for the recurring issue.",
    followUp: "This time, I'm going to make sure we fix this properly so it doesn't happen again.",
  },
  long_wait: {
    specific: "I apologize for the long wait - your time is valuable and that's not fair to you.",
    generic: "I'm sorry you had to wait.",
    followUp: "Let me make sure we resolve everything quickly now.",
  },
  system_error: {
    specific: "I apologize for the technical difficulties. I understand how frustrating system issues can be.",
    generic: "I'm sorry for the technical problems.",
    followUp: "Let me help you complete what you were trying to do.",
  },
  miscommunication: {
    specific: "I apologize for the confusion. There was clearly a miscommunication on our end.",
    generic: "I'm sorry for the misunderstanding.",
    followUp: "Let me clarify and make sure we're on the same page.",
  },
  product_unavailable: {
    specific: "I'm sorry that item isn't available. I know it's disappointing when you can't get what you want.",
    generic: "I apologize for the inconvenience.",
    followUp: "Let me check if we have any alternatives or when it might be back in stock.",
  },
  general: {
    specific: "I sincerely apologize for the trouble you've experienced.",
    generic: "I'm sorry for the inconvenience.",
    followUp: "Let me help you resolve this.",
  },
};

/**
 * Service for intelligent apology selection and tracking
 */
export class ApologyIntelligenceService {
  /**
   * Determine if an apology is appropriate and why
   */
  isApologyAppropriate(streamSid: string, context: ApologyContext): ApologyDecision {
    const { transcript, isRepeatIssue, callCount, waitTime } = context;
    const normalizedText = transcript.toLowerCase();

    // Check if this is NOT a company fault situation
    for (const pattern of NO_APOLOGY_PATTERNS) {
      if (normalizedText.includes(pattern)) {
        return {
          shouldApologize: false,
          isCompanyFault: false,
          reason: 'Issue appears to be customer-related, not company fault',
        };
      }
    }

    // Detect situation
    const situation = this.detectApologySituation(transcript);

    // Check for repeat issues (always apologize)
    if (isRepeatIssue || (callCount && callCount > 2)) {
      return {
        shouldApologize: true,
        situation: 'repeat_issue',
        reason: 'Customer has contacted multiple times about issues',
        isCompanyFault: true,
      };
    }

    // Check for long wait (always apologize)
    if (waitTime && waitTime > 60) { // More than 60 seconds wait
      return {
        shouldApologize: true,
        situation: 'long_wait',
        reason: `Customer waited ${waitTime} seconds`,
        isCompanyFault: true,
      };
    }

    // If situation detected, apologize
    if (situation && situation !== 'general') {
      return {
        shouldApologize: true,
        situation,
        reason: `Detected ${situation.replace('_', ' ')} situation`,
        isCompanyFault: true,
      };
    }

    // Check apology already given
    if (conversationStateService.hasApologyBeenGiven(streamSid)) {
      return {
        shouldApologize: false,
        isCompanyFault: false,
        reason: 'Apology already given in this conversation',
      };
    }

    return {
      shouldApologize: false,
      isCompanyFault: false,
      reason: 'No apology-warranting situation detected',
    };
  }

  /**
   * Detect the specific situation requiring apology
   */
  detectApologySituation(transcript: string): ApologySituation | null {
    const normalizedText = transcript.toLowerCase();
    let bestMatch: ApologySituation | null = null;
    let highestScore = 0;

    for (const [situation, patterns] of Object.entries(SITUATION_PATTERNS) as [ApologySituation, { keywords: string[]; phrases: string[] }][]) {
      let score = 0;

      // Check keywords
      for (const keyword of patterns.keywords) {
        if (normalizedText.includes(keyword)) {
          score += 1;
        }
      }

      // Check phrases (weighted higher)
      for (const phrase of patterns.phrases) {
        if (normalizedText.includes(phrase)) {
          score += 3;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = situation;
      }
    }

    // Require minimum score to avoid false positives
    return highestScore >= 2 ? bestMatch : null;
  }

  /**
   * Generate an apology response
   */
  async generateApology(
    streamSid: string,
    teamId: string,
    situation: ApologySituation,
    useSpecific: boolean = true
  ): Promise<ApologyResponse> {
    // Try to get team-specific template
    const template = await this.selectApologyTemplate(teamId, situation);

    let apology: string;
    let followUpAction: string | undefined;
    let promiseMade: string | undefined;

    if (template) {
      apology = template.template;
      followUpAction = template.followUpAction ?? undefined;

      // Update template usage
      await this.updateTemplateUsage(template.id);
    } else {
      // Use default template
      const defaultTemplate = DEFAULT_APOLOGIES[situation] || DEFAULT_APOLOGIES.general;
      apology = useSpecific ? defaultTemplate.specific : defaultTemplate.generic;
      followUpAction = defaultTemplate.followUp;
    }

    // Extract any promises made
    promiseMade = this.extractPromiseFromApology(apology + ' ' + (followUpAction || '')) ?? undefined;

    // Mark apology as given
    conversationStateService.markApologyGiven(streamSid, situation);

    // Track promise if made
    if (promiseMade) {
      conversationStateService.recordPromise(streamSid, promiseMade);
    }

    return {
      apology,
      isSpecific: useSpecific,
      followUpAction,
      promiseMade,
    };
  }

  /**
   * Select appropriate apology template from database
   */
  async selectApologyTemplate(
    teamId: string,
    situation: string
  ): Promise<ApologyTemplate | null> {
    try {
      const templates = await prisma.apologyTemplate.findMany({
        where: {
          teamId,
          situation,
          isActive: true,
        },
        orderBy: { effectivenessScore: 'desc' },
      });

      if (templates.length === 0) return null;

      // Weighted random selection based on effectiveness
      const totalWeight = templates.reduce((sum, t) => sum + (t.effectivenessScore + 0.1), 0);
      let random = Math.random() * totalWeight;

      for (const template of templates) {
        random -= (template.effectivenessScore + 0.1);
        if (random <= 0) return template;
      }

      return templates[0];
    } catch (error) {
      logger.error('Error selecting apology template', error);
      return null;
    }
  }

  /**
   * Determine if specific apology is warranted (vs generic)
   */
  shouldUseSpecificApology(
    situation: ApologySituation,
    context: {
      isVerifiedIssue?: boolean;
      isRepeatCustomer?: boolean;
      emotionScore?: number;
    }
  ): boolean {
    // Always use specific for these situations
    if (['wrong_order', 'billing_error', 'repeat_issue'].includes(situation)) {
      return true;
    }

    // Use specific if issue is verified
    if (context.isVerifiedIssue) {
      return true;
    }

    // Use specific for repeat customers
    if (context.isRepeatCustomer) {
      return true;
    }

    // Use specific if customer is very upset
    if (context.emotionScore !== undefined && context.emotionScore <= 0.3) {
      return true;
    }

    return false;
  }

  /**
   * Extract promises from apology text
   */
  extractPromiseFromApology(text: string): string | null {
    const promisePatterns = [
      /i(?:'ll| will) (.+?)(?:\.|,|$)/i,
      /let me (.+?)(?:\.|,|$)/i,
      /we(?:'ll| will) (.+?)(?:\.|,|$)/i,
      /going to (.+?)(?:\.|,|$)/i,
    ];

    for (const pattern of promisePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Check if apology has been given
   */
  hasApologyBeenGiven(streamSid: string): boolean {
    return conversationStateService.hasApologyBeenGiven(streamSid);
  }

  /**
   * Mark apology as given
   */
  markApologyGiven(streamSid: string, reason: string): void {
    conversationStateService.markApologyGiven(streamSid, reason);
  }

  // ==================== TEMPLATE MANAGEMENT ====================

  /**
   * Create a new apology template
   */
  async createApologyTemplate(
    teamId: string,
    template: {
      situation: string;
      isSpecific?: boolean;
      template: string;
      followUpAction?: string;
    }
  ): Promise<ApologyTemplate> {
    return await prisma.apologyTemplate.create({
      data: {
        teamId,
        situation: template.situation,
        isSpecific: template.isSpecific ?? true,
        template: template.template,
        followUpAction: template.followUpAction,
      },
    });
  }

  /**
   * Update template effectiveness based on outcome
   */
  async updateTemplateEffectiveness(
    templateId: string,
    customerReaction: 'positive' | 'neutral' | 'negative'
  ): Promise<void> {
    try {
      const template = await prisma.apologyTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) return;

      const newUsageCount = template.usageCount + 1;
      const reactionScore = customerReaction === 'positive' ? 1 : customerReaction === 'neutral' ? 0.5 : 0;

      const effectiveSum = (template.effectivenessScore * template.usageCount) + reactionScore;
      const newEffectivenessScore = effectiveSum / newUsageCount;

      await prisma.apologyTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: newUsageCount,
          effectivenessScore: newEffectivenessScore,
        },
      });
    } catch (error) {
      logger.error('Error updating apology template effectiveness', error);
    }
  }

  /**
   * Get all apology templates for a team
   */
  async getApologyTemplates(
    teamId: string,
    situation?: string
  ): Promise<ApologyTemplate[]> {
    const where: any = { teamId };
    if (situation) where.situation = situation;

    return await prisma.apologyTemplate.findMany({
      where,
      orderBy: { situation: 'asc' },
    });
  }

  /**
   * Get list of predefined situations
   */
  getSituations(): ApologySituation[] {
    return Object.keys(SITUATION_PATTERNS) as ApologySituation[];
  }

  /**
   * Update template usage count
   */
  private async updateTemplateUsage(templateId: string): Promise<void> {
    try {
      await prisma.apologyTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: { increment: 1 },
        },
      });
    } catch (error) {
      logger.error('Error updating apology template usage', error);
    }
  }
}

export const apologyIntelligenceService = new ApologyIntelligenceService();
