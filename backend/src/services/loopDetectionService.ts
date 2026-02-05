import { conversationStateService } from './conversationStateService';
import { logger } from '../utils/logger';

// Types
export type LoopType = 'question_repeat' | 'response_repeat' | 'circular' | 'no_progress';

export interface LoopDetectionResult {
  loopDetected: boolean;
  loopType?: LoopType;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  details?: string;
  suggestion?: string;
}

export interface LoopBreakerResponse {
  message: string;
  shouldEscalate: boolean;
  alternativeApproach?: string;
}

// Loop detection thresholds
const LOOP_THRESHOLDS = {
  questionRepeatCount: 3,    // Same question asked 3+ times
  responseRepeatCount: 3,    // Same response received 3+ times
  similarityThreshold: 0.85, // 85% similarity = considered same
  noProgressTurns: 5,        // 5 turns without stage change
  escalationThreshold: 4,    // 4+ repetitions = escalate
};

// Loop breaker templates
const LOOP_BREAKER_TEMPLATES = {
  question_repeat: [
    "I apologize - I seem to be having trouble understanding. Let me try a different approach.",
    "I'm sorry for the confusion. Could you help me by saying it in a different way?",
    "Let me pause and try this differently.",
  ],
  response_repeat: [
    "I hear you, and I want to make sure I fully understand. Let me summarize what I've got so far.",
    "Thank you for your patience. I think there might be some miscommunication. Let me clarify.",
    "I understand you've said that. Let me see what else I can do to help.",
  ],
  circular: [
    "We seem to be going in circles. Let me connect you with someone who can help better.",
    "I apologize - I'm not providing the help you need. Let me get a team member to assist.",
    "I want to make sure you get the right help. Let me transfer you to a specialist.",
  ],
  no_progress: [
    "I realize we haven't made much progress. What would be most helpful for you right now?",
    "Let me step back and ask - what's the one thing you most need help with?",
    "I want to focus on what matters most to you. What's your main concern?",
  ],
};

/**
 * Service for detecting and breaking conversation loops
 */
export class LoopDetectionService {
  // In-memory tracking for fast loop detection
  private loopCounters: Map<string, {
    questionCounts: Map<string, number>;
    responseCounts: Map<string, number>;
    lastStageChange: Date;
    turnsWithoutProgress: number;
    loopBrokenAt?: Date;
  }> = new Map();

  /**
   * Initialize tracking for a conversation
   */
  initializeTracking(streamSid: string): void {
    this.loopCounters.set(streamSid, {
      questionCounts: new Map(),
      responseCounts: new Map(),
      lastStageChange: new Date(),
      turnsWithoutProgress: 0,
    });
  }

  /**
   * Track a question asked by AI
   */
  trackQuestion(streamSid: string, question: string): void {
    const counters = this.getOrCreateCounters(streamSid);
    const normalized = this.normalizeText(question);

    // Check for similar existing questions
    let matched = false;
    for (const [existingQ, count] of counters.questionCounts) {
      if (this.calculateSimilarity(normalized, existingQ) >= LOOP_THRESHOLDS.similarityThreshold) {
        counters.questionCounts.set(existingQ, count + 1);
        matched = true;
        break;
      }
    }

    if (!matched) {
      counters.questionCounts.set(normalized, 1);
    }

    // Also record in conversation state
    conversationStateService.recordQuestion(streamSid, question);
  }

  /**
   * Track a response from customer
   */
  trackResponse(streamSid: string, response: string): void {
    const counters = this.getOrCreateCounters(streamSid);
    const normalized = this.normalizeText(response);

    // Check for similar existing responses
    let matched = false;
    for (const [existingR, count] of counters.responseCounts) {
      if (this.calculateSimilarity(normalized, existingR) >= LOOP_THRESHOLDS.similarityThreshold) {
        counters.responseCounts.set(existingR, count + 1);
        matched = true;
        break;
      }
    }

    if (!matched) {
      counters.responseCounts.set(normalized, 1);
    }

    // Increment turns without progress
    counters.turnsWithoutProgress++;

    // Also record in conversation state
    conversationStateService.recordResponse(streamSid, response);
  }

  /**
   * Track stage change (resets no-progress counter)
   */
  trackStageChange(streamSid: string): void {
    const counters = this.loopCounters.get(streamSid);
    if (counters) {
      counters.lastStageChange = new Date();
      counters.turnsWithoutProgress = 0;
    }
  }

  /**
   * Detect if conversation is in a loop
   */
  detectLoop(streamSid: string): LoopDetectionResult {
    const counters = this.loopCounters.get(streamSid);

    if (!counters) {
      return { loopDetected: false, severity: 'none' };
    }

    // Check for question repetition loop
    for (const [question, count] of counters.questionCounts) {
      if (count >= LOOP_THRESHOLDS.questionRepeatCount) {
        const severity = this.calculateSeverity(count);
        conversationStateService.setLoopDetected(streamSid, 'question_repeat');

        return {
          loopDetected: true,
          loopType: 'question_repeat',
          severity,
          details: `Same question asked ${count} times`,
          suggestion: this.getLoopBreakerSuggestion('question_repeat'),
        };
      }
    }

    // Check for response repetition loop
    for (const [response, count] of counters.responseCounts) {
      if (count >= LOOP_THRESHOLDS.responseRepeatCount) {
        const severity = this.calculateSeverity(count);
        conversationStateService.setLoopDetected(streamSid, 'response_repeat');

        return {
          loopDetected: true,
          loopType: 'response_repeat',
          severity,
          details: `Customer repeated same response ${count} times`,
          suggestion: this.getLoopBreakerSuggestion('response_repeat'),
        };
      }
    }

    // Check for no progress loop
    if (counters.turnsWithoutProgress >= LOOP_THRESHOLDS.noProgressTurns) {
      conversationStateService.setLoopDetected(streamSid, 'no_progress');

      return {
        loopDetected: true,
        loopType: 'no_progress',
        severity: 'moderate',
        details: `No stage progress in ${counters.turnsWithoutProgress} turns`,
        suggestion: this.getLoopBreakerSuggestion('no_progress'),
      };
    }

    return { loopDetected: false, severity: 'none' };
  }

  /**
   * Get the count for a specific question
   */
  getQuestionCount(streamSid: string, question: string): number {
    const counters = this.loopCounters.get(streamSid);
    if (!counters) return 0;

    const normalized = this.normalizeText(question);

    for (const [existingQ, count] of counters.questionCounts) {
      if (this.calculateSimilarity(normalized, existingQ) >= LOOP_THRESHOLDS.similarityThreshold) {
        return count;
      }
    }

    return 0;
  }

  /**
   * Get the count for a specific response
   */
  getResponseCount(streamSid: string, response: string): number {
    const counters = this.loopCounters.get(streamSid);
    if (!counters) return 0;

    const normalized = this.normalizeText(response);

    for (const [existingR, count] of counters.responseCounts) {
      if (this.calculateSimilarity(normalized, existingR) >= LOOP_THRESHOLDS.similarityThreshold) {
        return count;
      }
    }

    return 0;
  }

  /**
   * Generate a loop-breaking response
   */
  generateLoopBreaker(streamSid: string, loopType: LoopType): LoopBreakerResponse {
    const counters = this.loopCounters.get(streamSid);
    const shouldEscalate = this.shouldEscalate(streamSid);

    // Mark loop as broken
    if (counters) {
      counters.loopBrokenAt = new Date();
    }

    // Reset loop tracking in conversation state
    conversationStateService.resetLoopTracking(streamSid);

    const templates = LOOP_BREAKER_TEMPLATES[loopType];
    const message = templates[Math.floor(Math.random() * templates.length)];

    let alternativeApproach: string | undefined;

    switch (loopType) {
      case 'question_repeat':
        alternativeApproach = 'Try rephrasing the question or asking for the information differently';
        break;
      case 'response_repeat':
        alternativeApproach = 'Acknowledge what the customer said and move to a different topic';
        break;
      case 'circular':
      case 'no_progress':
        alternativeApproach = 'Escalate to human agent or offer callback';
        break;
    }

    return {
      message,
      shouldEscalate,
      alternativeApproach,
    };
  }

  /**
   * Determine if escalation is needed
   */
  shouldEscalate(streamSid: string): boolean {
    const counters = this.loopCounters.get(streamSid);
    if (!counters) return false;

    // Check if any count exceeds escalation threshold
    for (const count of counters.questionCounts.values()) {
      if (count >= LOOP_THRESHOLDS.escalationThreshold) return true;
    }

    for (const count of counters.responseCounts.values()) {
      if (count >= LOOP_THRESHOLDS.escalationThreshold) return true;
    }

    // Escalate if no progress for too long
    if (counters.turnsWithoutProgress >= LOOP_THRESHOLDS.noProgressTurns + 2) {
      return true;
    }

    return false;
  }

  /**
   * Trigger escalation due to loop
   */
  async triggerLoopEscalation(streamSid: string, callId: string): Promise<void> {
    logger.warn(`Loop escalation triggered for call ${callId}`);

    // This would integrate with queueService to request transfer
    // For now, just log and mark
    conversationStateService.setLoopDetected(streamSid, 'circular');
  }

  /**
   * Calculate text similarity using Jaccard index
   */
  calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' '));
    const words2 = new Set(text2.split(' '));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * Reset loop tracking for a conversation
   */
  resetLoopTracking(streamSid: string): void {
    const counters = this.loopCounters.get(streamSid);
    if (counters) {
      counters.questionCounts.clear();
      counters.responseCounts.clear();
      counters.turnsWithoutProgress = 0;
    }

    conversationStateService.resetLoopTracking(streamSid);
  }

  /**
   * Clean up tracking when call ends
   */
  cleanup(streamSid: string): void {
    this.loopCounters.delete(streamSid);
  }

  // ==================== PRIVATE HELPERS ====================

  private getOrCreateCounters(streamSid: string) {
    let counters = this.loopCounters.get(streamSid);
    if (!counters) {
      this.initializeTracking(streamSid);
      counters = this.loopCounters.get(streamSid)!;
    }
    return counters;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateSeverity(count: number): 'none' | 'mild' | 'moderate' | 'severe' {
    if (count < LOOP_THRESHOLDS.questionRepeatCount) return 'none';
    if (count === LOOP_THRESHOLDS.questionRepeatCount) return 'mild';
    if (count < LOOP_THRESHOLDS.escalationThreshold) return 'moderate';
    return 'severe';
  }

  private getLoopBreakerSuggestion(loopType: LoopType): string {
    switch (loopType) {
      case 'question_repeat':
        return 'Rephrase the question or accept partial information';
      case 'response_repeat':
        return 'Acknowledge and move forward with what you have';
      case 'circular':
        return 'Escalate to human agent';
      case 'no_progress':
        return 'Reset conversation focus or escalate';
      default:
        return 'Try a different approach';
    }
  }
}

export const loopDetectionService = new LoopDetectionService();
