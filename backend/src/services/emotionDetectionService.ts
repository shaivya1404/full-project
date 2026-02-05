import { prisma } from '../db/client';
import { EmotionTemplate } from '@prisma/client';
import { conversationStateService } from './conversationStateService';
import { logger } from '../utils/logger';

// Types
export type Emotion = 'anger' | 'frustration' | 'sadness' | 'confusion' | 'fear' | 'neutral' | 'happy' | 'satisfied';

export interface EmotionDetectionResult {
  emotion: Emotion;
  confidence: number;
  score: number; // 0-1, where 0 is very negative, 1 is very positive
  triggers: string[];
}

export interface AdaptedResponse {
  originalResponse: string;
  adaptedResponse: string;
  empathyPrefix?: string;
  toneGuidance?: string;
  templateUsed?: string;
}

export interface EmotionTrend {
  trend: 'improving' | 'declining' | 'stable';
  current: Emotion;
  history: { emotion: Emotion; timestamp: Date }[];
  averageScore: number;
}

// Emotion detection patterns
const EMOTION_PATTERNS: Record<Emotion, { keywords: string[]; phrases: string[] }> = {
  anger: {
    keywords: ['angry', 'furious', 'outraged', 'mad', 'livid', 'unacceptable', 'ridiculous', 'terrible', 'worst', 'horrible'],
    phrases: [
      'this is ridiculous',
      'what the hell',
      'i want to speak to',
      'i am so angry',
      'this is unacceptable',
      'i\'ve had enough',
      'are you kidding me',
      'i can\'t believe',
      'this is the worst',
      'how dare you',
    ],
  },
  frustration: {
    keywords: ['frustrated', 'annoyed', 'irritated', 'bothered', 'fed up', 'tired of', 'again', 'still', 'already'],
    phrases: [
      'i already told you',
      'how many times',
      'this is frustrating',
      'i\'ve been waiting',
      'still not working',
      'this keeps happening',
      'why is this so hard',
      'i just want',
      'for the third time',
    ],
  },
  sadness: {
    keywords: ['sad', 'disappointed', 'upset', 'unhappy', 'hurt', 'let down', 'heartbroken', 'devastated'],
    phrases: [
      'i\'m so disappointed',
      'this makes me sad',
      'i trusted you',
      'you let me down',
      'i feel terrible',
      'this is really upsetting',
    ],
  },
  confusion: {
    keywords: ['confused', 'don\'t understand', 'unclear', 'lost', 'puzzled', 'what', 'how', 'why'],
    phrases: [
      'i don\'t understand',
      'can you explain',
      'what do you mean',
      'i\'m confused',
      'that doesn\'t make sense',
      'what are you talking about',
      'i\'m not following',
      'wait what',
    ],
  },
  fear: {
    keywords: ['worried', 'scared', 'afraid', 'nervous', 'anxious', 'concerned', 'alarmed', 'panicking'],
    phrases: [
      'i\'m worried',
      'what if',
      'is it going to be okay',
      'i\'m scared',
      'this is concerning',
      'i\'m nervous about',
    ],
  },
  neutral: {
    keywords: ['okay', 'fine', 'alright', 'sure', 'yes', 'no', 'maybe'],
    phrases: [],
  },
  happy: {
    keywords: ['happy', 'great', 'wonderful', 'excellent', 'amazing', 'perfect', 'fantastic', 'awesome', 'love'],
    phrases: [
      'thank you so much',
      'that\'s great',
      'you\'ve been helpful',
      'i really appreciate',
      'this is perfect',
      'exactly what i needed',
    ],
  },
  satisfied: {
    keywords: ['satisfied', 'pleased', 'good', 'nice', 'helpful', 'resolved', 'better', 'thanks'],
    phrases: [
      'that works',
      'sounds good',
      'i\'m satisfied',
      'that helps',
      'much better',
      'problem solved',
    ],
  },
};

// Emotion scores (0 = most negative, 1 = most positive)
const EMOTION_SCORES: Record<Emotion, number> = {
  anger: 0.1,
  frustration: 0.2,
  sadness: 0.25,
  fear: 0.3,
  confusion: 0.4,
  neutral: 0.5,
  satisfied: 0.7,
  happy: 0.9,
};

// Default empathy templates
const DEFAULT_EMPATHY_TEMPLATES: Record<Emotion, string[]> = {
  anger: [
    "I completely understand your frustration, and you have every right to be upset.",
    "I'm truly sorry this happened. Let me make this right immediately.",
    "I can hear how frustrated you are, and I take full responsibility for fixing this.",
  ],
  frustration: [
    "I understand this has been frustrating. Let me help you right away.",
    "I apologize for the inconvenience. I'm going to make sure we resolve this now.",
    "I can see why this is frustrating. Let's get this sorted out together.",
  ],
  sadness: [
    "I'm really sorry you're going through this. I'm here to help.",
    "I understand this is disappointing. Let me see what I can do.",
    "I can hear this has been upsetting. Let me try to make it better.",
  ],
  confusion: [
    "No problem at all! Let me explain that more clearly.",
    "Great question - let me break that down in simpler terms.",
    "I understand this can be confusing. Let me walk you through it step by step.",
  ],
  fear: [
    "I understand your concern. Let me reassure you and explain exactly what will happen.",
    "Don't worry - I'm here to help and will make sure everything is taken care of.",
    "I can see you're worried. Let me put your mind at ease.",
  ],
  neutral: [],
  happy: [],
  satisfied: [],
};

/**
 * Service for detecting and responding to customer emotions
 */
export class EmotionDetectionService {
  /**
   * Detect emotion from text
   */
  detectEmotion(text: string): EmotionDetectionResult {
    const normalizedText = text.toLowerCase();
    const triggers: string[] = [];
    let detectedEmotion: Emotion = 'neutral';
    let highestScore = 0;

    // Check each emotion pattern
    for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS) as [Emotion, { keywords: string[]; phrases: string[] }][]) {
      let score = 0;

      // Check keywords
      for (const keyword of patterns.keywords) {
        if (normalizedText.includes(keyword)) {
          score += 1;
          triggers.push(keyword);
        }
      }

      // Check phrases (weighted higher)
      for (const phrase of patterns.phrases) {
        if (normalizedText.includes(phrase)) {
          score += 2;
          triggers.push(phrase);
        }
      }

      // Check for emphasis (caps, exclamation marks)
      const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
      const exclamations = (text.match(/!/g) || []).length;

      if (capsRatio > 0.3 && (emotion === 'anger' || emotion === 'frustration')) {
        score += 1;
      }
      if (exclamations > 1 && (emotion === 'anger' || emotion === 'frustration' || emotion === 'happy')) {
        score += 1;
      }

      if (score > highestScore) {
        highestScore = score;
        detectedEmotion = emotion;
      }
    }

    // Calculate confidence based on trigger count
    const confidence = Math.min(0.95, 0.5 + (triggers.length * 0.15));

    return {
      emotion: detectedEmotion,
      confidence,
      score: EMOTION_SCORES[detectedEmotion],
      triggers: [...new Set(triggers)], // Remove duplicates
    };
  }

  /**
   * Track emotion over time for a conversation
   */
  trackEmotionOverTime(streamSid: string, text: string): void {
    const detection = this.detectEmotion(text);

    conversationStateService.updateEmotion(
      streamSid,
      detection.emotion,
      detection.score,
      detection.triggers.join(', ')
    );
  }

  /**
   * Get emotion trend for conversation
   */
  async getEmotionTrend(streamSid: string): Promise<EmotionTrend> {
    const trend = conversationStateService.getEmotionTrend(streamSid);
    const state = await conversationStateService.getState(streamSid);

    const history = state?.emotionHistory.map(e => ({
      emotion: e.emotion as Emotion,
      timestamp: e.timestamp,
    })) || [];

    const averageScore = history.length > 0
      ? history.reduce((sum, e) => sum + EMOTION_SCORES[e.emotion], 0) / history.length
      : 0.5;

    return {
      trend: trend.trend,
      current: trend.current as Emotion,
      history,
      averageScore,
    };
  }

  /**
   * Adapt a response based on detected emotion
   */
  async getAdaptedResponse(
    streamSid: string,
    baseResponse: string,
    teamId: string
  ): Promise<AdaptedResponse> {
    const state = await conversationStateService.getState(streamSid);
    const currentEmotion = (state?.currentEmotion || 'neutral') as Emotion;

    // If positive or neutral emotion, no adaptation needed
    if (['neutral', 'happy', 'satisfied'].includes(currentEmotion)) {
      return {
        originalResponse: baseResponse,
        adaptedResponse: baseResponse,
      };
    }

    // Try to get team-specific template first
    const template = await this.selectEmpathyTemplate(teamId, currentEmotion);

    let empathyPrefix: string;
    let toneGuidance: string | undefined;
    let templateUsed: string | undefined;

    if (template) {
      empathyPrefix = template.responseTemplate;
      toneGuidance = template.toneGuidance || undefined;
      templateUsed = template.id;

      // Update template usage
      await this.updateTemplateUsage(template.id);
    } else {
      // Use default template
      const defaults = DEFAULT_EMPATHY_TEMPLATES[currentEmotion];
      empathyPrefix = defaults.length > 0
        ? defaults[Math.floor(Math.random() * defaults.length)]
        : '';
    }

    // Combine empathy prefix with response
    const adaptedResponse = empathyPrefix
      ? `${empathyPrefix} ${baseResponse}`
      : baseResponse;

    return {
      originalResponse: baseResponse,
      adaptedResponse,
      empathyPrefix: empathyPrefix || undefined,
      toneGuidance,
      templateUsed,
    };
  }

  /**
   * Select empathy template from database
   */
  async selectEmpathyTemplate(teamId: string, emotion: string): Promise<EmotionTemplate | null> {
    try {
      const templates = await prisma.emotionTemplate.findMany({
        where: {
          teamId,
          emotion,
          isActive: true,
        },
        orderBy: { successRate: 'desc' },
      });

      if (templates.length === 0) return null;

      // Weighted random selection based on success rate
      const totalWeight = templates.reduce((sum, t) => sum + (t.successRate + 0.1), 0);
      let random = Math.random() * totalWeight;

      for (const template of templates) {
        random -= (template.successRate + 0.1);
        if (random <= 0) return template;
      }

      return templates[0];
    } catch (error) {
      logger.error('Error selecting empathy template', error);
      return null;
    }
  }

  /**
   * Check if escalation is needed due to emotion
   */
  shouldEscalateDueToEmotion(streamSid: string): boolean {
    const state = conversationStateService.getCollectedFields(streamSid);
    // Note: Using conversationStateService internally to check emotion state

    // This is a simplified check - in production, would check emotion history
    return false; // Will be enhanced with actual state checking
  }

  /**
   * Get reason for emotion-based escalation
   */
  async getEmotionEscalationReason(streamSid: string): Promise<string | null> {
    const state = await conversationStateService.getState(streamSid);
    if (!state) return null;

    const emotion = state.currentEmotion as Emotion;
    const score = state.emotionScore;

    if (score <= 0.2) {
      return `Customer is highly ${emotion}. Immediate human assistance recommended.`;
    }

    if (emotion === 'anger' && score <= 0.3) {
      return 'Customer anger level requires human intervention.';
    }

    return null;
  }

  // ==================== TEMPLATE MANAGEMENT ====================

  /**
   * Create a new emotion template
   */
  async createEmotionTemplate(
    teamId: string,
    template: {
      emotion: string;
      triggerPatterns: string[];
      responseTemplate: string;
      toneGuidance?: string;
      escalationThreshold?: number;
    }
  ): Promise<EmotionTemplate> {
    return await prisma.emotionTemplate.create({
      data: {
        teamId,
        emotion: template.emotion,
        triggerPatterns: JSON.stringify(template.triggerPatterns),
        responseTemplate: template.responseTemplate,
        toneGuidance: template.toneGuidance,
        escalationThreshold: template.escalationThreshold ?? 3,
      },
    });
  }

  /**
   * Update template effectiveness based on outcome
   */
  async updateTemplateEffectiveness(templateId: string, wasEffective: boolean): Promise<void> {
    try {
      const template = await prisma.emotionTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) return;

      const newUsageCount = template.usageCount + 1;
      const effectiveCount = wasEffective
        ? Math.round(template.successRate * template.usageCount) + 1
        : Math.round(template.successRate * template.usageCount);

      const newSuccessRate = effectiveCount / newUsageCount;

      await prisma.emotionTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: newUsageCount,
          successRate: newSuccessRate,
        },
      });
    } catch (error) {
      logger.error('Error updating template effectiveness', error);
    }
  }

  /**
   * Get all emotion templates for a team
   */
  async getEmotionTemplates(teamId: string): Promise<EmotionTemplate[]> {
    return await prisma.emotionTemplate.findMany({
      where: { teamId },
      orderBy: { emotion: 'asc' },
    });
  }

  /**
   * Update template usage count
   */
  private async updateTemplateUsage(templateId: string): Promise<void> {
    try {
      await prisma.emotionTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: { increment: 1 },
        },
      });
    } catch (error) {
      logger.error('Error updating template usage', error);
    }
  }
}

export const emotionDetectionService = new EmotionDetectionService();
