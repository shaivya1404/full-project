import { prisma } from '../db/client';
import { ConversationState } from '@prisma/client';
import { logger } from '../utils/logger';

// Types
export interface InMemoryState {
  callId: string;
  streamSid: string;
  customerId?: string;
  collectedFields: Record<string, any>;
  pendingConfirmations: string[];
  questionHistory: QuestionEntry[];
  responseHistory: ResponseEntry[];
  loopDetected: boolean;
  loopType?: string;
  currentEmotion: string;
  emotionScore: number;
  emotionHistory: EmotionEntry[];
  conversationStage: string;
  progressPercentage: number;
  stepsCompleted: string[];
  stepsRemaining: string[];
  apologyGiven: boolean;
  apologyReason?: string;
  promisesMade: PromiseEntry[];
  lastSyncedAt: Date;
}

export interface QuestionEntry {
  question: string;
  normalizedQuestion: string;
  count: number;
  askedAt: Date;
}

export interface ResponseEntry {
  response: string;
  normalizedResponse: string;
  count: number;
  receivedAt: Date;
}

export interface EmotionEntry {
  emotion: string;
  timestamp: Date;
  trigger?: string;
}

export interface PromiseEntry {
  promise: string;
  madeAt: Date;
  fulfilled: boolean;
}

export interface ProgressSummary {
  stage: string;
  percentage: number;
  completed: string[];
  remaining: string[];
  summary: string;
}

// Conversation stages for different use cases
export const ORDER_STAGES = [
  'greeting',
  'identifying_customer',
  'collecting_items',
  'confirming_items',
  'collecting_address',
  'collecting_contact',
  'confirming_order',
  'processing_payment',
  'complete',
];

export const SUPPORT_STAGES = [
  'greeting',
  'identifying_customer',
  'understanding_issue',
  'investigating',
  'proposing_solution',
  'confirming_resolution',
  'complete',
];

export const SALES_STAGES = [
  'greeting',
  'qualifying_lead',
  'presenting_offer',
  'handling_objections',
  'closing',
  'complete',
];

/**
 * Service for managing in-call conversation state
 * Provides zero-repetition tracking and progress management
 */
export class ConversationStateService {
  // In-memory state for fast access during calls
  private activeStates: Map<string, InMemoryState> = new Map();

  // Sync interval in milliseconds
  private readonly SYNC_INTERVAL = 5000;

  /**
   * Initialize a new conversation state
   */
  async initializeState(
    callId: string,
    streamSid: string,
    customerId?: string
  ): Promise<InMemoryState> {
    const state: InMemoryState = {
      callId,
      streamSid,
      customerId,
      collectedFields: {},
      pendingConfirmations: [],
      questionHistory: [],
      responseHistory: [],
      loopDetected: false,
      currentEmotion: 'neutral',
      emotionScore: 0.5,
      emotionHistory: [],
      conversationStage: 'greeting',
      progressPercentage: 0,
      stepsCompleted: [],
      stepsRemaining: [...ORDER_STAGES], // Default to order stages
      apologyGiven: false,
      promisesMade: [],
      lastSyncedAt: new Date(),
    };

    // Store in memory
    this.activeStates.set(streamSid, state);

    // Create database record
    try {
      await prisma.conversationState.create({
        data: {
          callId,
          streamSid,
          customerId,
          collectedFields: JSON.stringify(state.collectedFields),
          questionHistory: JSON.stringify(state.questionHistory),
          responseHistory: JSON.stringify(state.responseHistory),
          emotionHistory: JSON.stringify(state.emotionHistory),
          stepsCompleted: JSON.stringify(state.stepsCompleted),
          stepsRemaining: JSON.stringify(state.stepsRemaining),
          promisesMade: JSON.stringify(state.promisesMade),
        },
      });
    } catch (error) {
      logger.error('Error creating conversation state in database', error);
    }

    logger.info(`Initialized conversation state for ${streamSid}`);
    return state;
  }

  /**
   * Get current state (from memory if available, otherwise from DB)
   */
  async getState(streamSid: string): Promise<InMemoryState | null> {
    // Check memory first
    const memoryState = this.activeStates.get(streamSid);
    if (memoryState) {
      return memoryState;
    }

    // Fall back to database
    try {
      const dbState = await prisma.conversationState.findUnique({
        where: { streamSid },
      });

      if (dbState) {
        const state = this.deserializeDbState(dbState);
        this.activeStates.set(streamSid, state);
        return state;
      }
    } catch (error) {
      logger.error('Error getting conversation state from database', error);
    }

    return null;
  }

  /**
   * Sync in-memory state to database
   */
  async syncToDatabase(streamSid: string): Promise<void> {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    try {
      await prisma.conversationState.update({
        where: { streamSid },
        data: {
          collectedFields: JSON.stringify(state.collectedFields),
          pendingConfirmations: JSON.stringify(state.pendingConfirmations),
          questionHistory: JSON.stringify(state.questionHistory),
          responseHistory: JSON.stringify(state.responseHistory),
          loopDetected: state.loopDetected,
          loopType: state.loopType,
          currentEmotion: state.currentEmotion,
          emotionScore: state.emotionScore,
          emotionHistory: JSON.stringify(state.emotionHistory),
          conversationStage: state.conversationStage,
          progressPercentage: state.progressPercentage,
          stepsCompleted: JSON.stringify(state.stepsCompleted),
          stepsRemaining: JSON.stringify(state.stepsRemaining),
          apologyGiven: state.apologyGiven,
          apologyReason: state.apologyReason,
          promisesMade: JSON.stringify(state.promisesMade),
        },
      });
      state.lastSyncedAt = new Date();
    } catch (error) {
      logger.error('Error syncing conversation state to database', error);
    }
  }

  /**
   * Clean up state when call ends
   */
  async cleanupState(streamSid: string): Promise<void> {
    // Final sync before cleanup
    await this.syncToDatabase(streamSid);

    // Remove from memory
    this.activeStates.delete(streamSid);

    logger.info(`Cleaned up conversation state for ${streamSid}`);
  }

  // ==================== ZERO REPETITION FEATURES ====================

  /**
   * Mark a field as collected (prevents re-asking)
   */
  markFieldCollected(streamSid: string, fieldName: string, value: any): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    state.collectedFields[fieldName] = value;
    logger.debug(`Marked field collected: ${fieldName} = ${value}`);
  }

  /**
   * Check if a field has already been collected
   */
  isFieldCollected(streamSid: string, fieldName: string): boolean {
    const state = this.activeStates.get(streamSid);
    if (!state) return false;

    return fieldName in state.collectedFields && state.collectedFields[fieldName] !== undefined;
  }

  /**
   * Get the value of a collected field
   */
  getCollectedField(streamSid: string, fieldName: string): any {
    const state = this.activeStates.get(streamSid);
    if (!state) return undefined;

    return state.collectedFields[fieldName];
  }

  /**
   * Get all collected fields
   */
  getCollectedFields(streamSid: string): Record<string, any> {
    const state = this.activeStates.get(streamSid);
    if (!state) return {};

    return { ...state.collectedFields };
  }

  /**
   * Get list of fields still needed
   */
  getUncollectedFields(streamSid: string, requiredFields: string[]): string[] {
    const state = this.activeStates.get(streamSid);
    if (!state) return requiredFields;

    return requiredFields.filter(field => !this.isFieldCollected(streamSid, field));
  }

  /**
   * Generate a summary of what's been collected (for AI prompt)
   */
  getCollectionSummary(streamSid: string): string {
    const fields = this.getCollectedFields(streamSid);
    const entries = Object.entries(fields);

    if (entries.length === 0) {
      return 'No information collected yet.';
    }

    return entries
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  // ==================== PROGRESS TRACKING ====================

  /**
   * Update the conversation stage
   */
  updateStage(streamSid: string, stage: string): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    state.conversationStage = stage;

    // Move stage to completed
    if (!state.stepsCompleted.includes(stage)) {
      state.stepsCompleted.push(stage);
    }

    // Remove from remaining
    state.stepsRemaining = state.stepsRemaining.filter(s => s !== stage);

    // Recalculate progress
    this.calculateProgress(streamSid);

    logger.debug(`Updated stage to: ${stage}`);
  }

  /**
   * Set the stages for this conversation type
   */
  setConversationStages(streamSid: string, stages: string[]): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    state.stepsRemaining = [...stages];
    state.stepsCompleted = [];
    state.progressPercentage = 0;
  }

  /**
   * Add a completed step
   */
  addCompletedStep(streamSid: string, step: string): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    if (!state.stepsCompleted.includes(step)) {
      state.stepsCompleted.push(step);
    }

    state.stepsRemaining = state.stepsRemaining.filter(s => s !== step);
    this.calculateProgress(streamSid);
  }

  /**
   * Set remaining steps
   */
  setRemainingSteps(streamSid: string, steps: string[]): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    state.stepsRemaining = steps;
    this.calculateProgress(streamSid);
  }

  /**
   * Calculate progress percentage
   */
  calculateProgress(streamSid: string): number {
    const state = this.activeStates.get(streamSid);
    if (!state) return 0;

    const total = state.stepsCompleted.length + state.stepsRemaining.length;
    if (total === 0) return 0;

    state.progressPercentage = Math.round((state.stepsCompleted.length / total) * 100);
    return state.progressPercentage;
  }

  /**
   * Get progress summary
   */
  getProgressSummary(streamSid: string): ProgressSummary {
    const state = this.activeStates.get(streamSid);
    if (!state) {
      return {
        stage: 'unknown',
        percentage: 0,
        completed: [],
        remaining: [],
        summary: 'No active conversation.',
      };
    }

    const remaining = state.stepsRemaining.length;
    let summary = '';

    if (remaining === 0) {
      summary = 'All steps completed!';
    } else if (remaining === 1) {
      summary = `Almost done! Just need: ${state.stepsRemaining[0]}`;
    } else {
      summary = `${state.progressPercentage}% complete. ${remaining} steps remaining.`;
    }

    return {
      stage: state.conversationStage,
      percentage: state.progressPercentage,
      completed: state.stepsCompleted,
      remaining: state.stepsRemaining,
      summary,
    };
  }

  // ==================== EMOTION TRACKING ====================

  /**
   * Update current emotion
   */
  updateEmotion(streamSid: string, emotion: string, score: number, trigger?: string): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    state.currentEmotion = emotion;
    state.emotionScore = score;
    state.emotionHistory.push({
      emotion,
      timestamp: new Date(),
      trigger,
    });

    // Keep only last 20 emotion entries
    if (state.emotionHistory.length > 20) {
      state.emotionHistory = state.emotionHistory.slice(-20);
    }
  }

  /**
   * Get emotion trend
   */
  getEmotionTrend(streamSid: string): { trend: 'improving' | 'declining' | 'stable'; current: string } {
    const state = this.activeStates.get(streamSid);
    if (!state || state.emotionHistory.length < 2) {
      return { trend: 'stable', current: state?.currentEmotion || 'neutral' };
    }

    const recent = state.emotionHistory.slice(-5);
    const positiveEmotions = ['happy', 'satisfied', 'neutral'];
    const negativeEmotions = ['anger', 'frustration', 'sadness', 'confusion'];

    let positiveCount = 0;
    let negativeCount = 0;

    recent.forEach(entry => {
      if (positiveEmotions.includes(entry.emotion)) positiveCount++;
      if (negativeEmotions.includes(entry.emotion)) negativeCount++;
    });

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (positiveCount > negativeCount + 1) trend = 'improving';
    if (negativeCount > positiveCount + 1) trend = 'declining';

    return { trend, current: state.currentEmotion };
  }

  // ==================== LOOP DETECTION SUPPORT ====================

  /**
   * Record a question asked by AI
   */
  recordQuestion(streamSid: string, question: string): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    const normalized = this.normalizeText(question);
    const existing = state.questionHistory.find(q => q.normalizedQuestion === normalized);

    if (existing) {
      existing.count++;
      existing.askedAt = new Date();
    } else {
      state.questionHistory.push({
        question,
        normalizedQuestion: normalized,
        count: 1,
        askedAt: new Date(),
      });
    }
  }

  /**
   * Record a response from customer
   */
  recordResponse(streamSid: string, response: string): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    const normalized = this.normalizeText(response);
    const existing = state.responseHistory.find(r => r.normalizedResponse === normalized);

    if (existing) {
      existing.count++;
      existing.receivedAt = new Date();
    } else {
      state.responseHistory.push({
        response,
        normalizedResponse: normalized,
        count: 1,
        receivedAt: new Date(),
      });
    }
  }

  /**
   * Mark loop as detected
   */
  setLoopDetected(streamSid: string, loopType: string): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    state.loopDetected = true;
    state.loopType = loopType;
  }

  /**
   * Reset loop tracking after breaking out of loop
   */
  resetLoopTracking(streamSid: string): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    state.loopDetected = false;
    state.loopType = undefined;
    state.questionHistory = [];
    state.responseHistory = [];
  }

  // ==================== APOLOGY TRACKING ====================

  /**
   * Mark that an apology was given
   */
  markApologyGiven(streamSid: string, reason: string): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    state.apologyGiven = true;
    state.apologyReason = reason;
  }

  /**
   * Check if apology has been given
   */
  hasApologyBeenGiven(streamSid: string): boolean {
    const state = this.activeStates.get(streamSid);
    return state?.apologyGiven ?? false;
  }

  // ==================== PROMISE TRACKING ====================

  /**
   * Record a promise made during conversation
   */
  recordPromise(streamSid: string, promise: string): void {
    const state = this.activeStates.get(streamSid);
    if (!state) return;

    state.promisesMade.push({
      promise,
      madeAt: new Date(),
      fulfilled: false,
    });
  }

  /**
   * Get all promises made in this conversation
   */
  getPromises(streamSid: string): PromiseEntry[] {
    const state = this.activeStates.get(streamSid);
    return state?.promisesMade ?? [];
  }

  // ==================== UTILITIES ====================

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Deserialize database state to in-memory format
   */
  private deserializeDbState(dbState: ConversationState): InMemoryState {
    return {
      callId: dbState.callId,
      streamSid: dbState.streamSid,
      customerId: dbState.customerId || undefined,
      collectedFields: JSON.parse(dbState.collectedFields || '{}'),
      pendingConfirmations: JSON.parse(dbState.pendingConfirmations || '[]'),
      questionHistory: JSON.parse(dbState.questionHistory || '[]'),
      responseHistory: JSON.parse(dbState.responseHistory || '[]'),
      loopDetected: dbState.loopDetected,
      loopType: dbState.loopType || undefined,
      currentEmotion: dbState.currentEmotion,
      emotionScore: dbState.emotionScore,
      emotionHistory: JSON.parse(dbState.emotionHistory || '[]'),
      conversationStage: dbState.conversationStage,
      progressPercentage: dbState.progressPercentage,
      stepsCompleted: JSON.parse(dbState.stepsCompleted || '[]'),
      stepsRemaining: JSON.parse(dbState.stepsRemaining || '[]'),
      apologyGiven: dbState.apologyGiven,
      apologyReason: dbState.apologyReason || undefined,
      promisesMade: JSON.parse(dbState.promisesMade || '[]'),
      lastSyncedAt: dbState.updatedAt,
    };
  }

  /**
   * Get state for database by stream sid
   */
  async getDbState(streamSid: string): Promise<ConversationState | null> {
    try {
      return await prisma.conversationState.findUnique({
        where: { streamSid },
      });
    } catch (error) {
      logger.error('Error getting conversation state from database', error);
      return null;
    }
  }
}

export const conversationStateService = new ConversationStateService();
