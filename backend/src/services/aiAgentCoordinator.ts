import { customerMemoryService, MemorySummary } from './customerMemoryService';
import { conversationStateService, ProgressSummary } from './conversationStateService';
import { loopDetectionService, LoopDetectionResult } from './loopDetectionService';
import { emotionDetectionService, EmotionDetectionResult, AdaptedResponse } from './emotionDetectionService';
import { apologyIntelligenceService, ApologyDecision, ApologyResponse } from './apologyIntelligenceService';
import { factVerificationService, ClaimToVerify, VerificationResponse, ConfidenceScore } from './factVerificationService';
import { transferContextService, AgentViewContext } from './transferContextService';
// Phase 2: Problem-solving services
import { rootCauseService, RootCauseAnalysis } from './rootCauseService';
import { proactiveProblemService, ProactiveProblem, CustomerRiskProfile } from './proactiveProblemService';
import { actionAuthorityService, ActionRequest, ActionResult } from './actionAuthorityService';
import { smartSuggestionService, Suggestion, SuggestionContext } from './smartSuggestionService';
import { customerEducationService, ConfusionIndicator } from './customerEducationService';
import { logger } from '../utils/logger';

// Types
export interface AIAgentContext {
  callId: string;
  streamSid: string;
  teamId?: string;
  customerId?: string;
  customerMemory?: MemorySummary;
  isReturningCustomer: boolean;
  collectedFields: Record<string, any>;
  currentEmotion: string;
  emotionScore: number;
  loopStatus: LoopDetectionResult;
  progress: ProgressSummary;
  apologyGiven: boolean;
  // Phase 2: Problem-solving context
  proactiveProblems?: ProactiveProblem[];
  riskProfile?: CustomerRiskProfile;
  rootCauseAnalysis?: RootCauseAnalysis;
  pendingSuggestions?: Suggestion[];
  confusionDetected?: boolean;
}

export interface ProcessedInput {
  originalInput: string;
  normalizedInput: string;
  emotion: EmotionDetectionResult;
  loopStatus: LoopDetectionResult;
  extractedFacts: any[];
  shouldEscalate: boolean;
  escalationReason?: string;
  suggestedAction?: string;
}

export interface ProcessedResponse {
  originalResponse: string;
  adaptedResponse: string;
  emotionAdaptation?: AdaptedResponse;
  apologyIncluded?: ApologyResponse;
  confidenceScore: ConfidenceScore;
  promisesMade: string[];
  fieldsCollected: string[];
}

export interface EnhancedPromptContext {
  customerContext: string;
  collectedInfo: string;
  emotionGuidance: string;
  loopGuidance: string;
  progressInfo: string;
  apologyStatus: string;
  specialInstructions: string[];
}

/**
 * Central coordinator for all AI Agent services
 * Orchestrates memory, emotion, loops, verification, and context
 */
export class AIAgentCoordinator {
  /**
   * Initialize AI agent context when call starts
   */
  async onCallStart(
    streamSid: string,
    callId: string,
    customerId?: string,
    teamId?: string
  ): Promise<AIAgentContext> {
    try {
      logger.info(`Initializing AI Agent for call ${callId}`);

      // Initialize conversation state
      await conversationStateService.initializeState(callId, streamSid, customerId);

      // Initialize loop detection
      loopDetectionService.initializeTracking(streamSid);

      // Get customer memory if available
      let customerMemory: MemorySummary | undefined;
      let isReturningCustomer = false;

      if (customerId && teamId) {
        customerMemory = await customerMemoryService.getMemorySummary(customerId, teamId);
        isReturningCustomer = customerMemory.interactionCount > 0;

        // Check for unfulfilled promises
        const unfulfilledPromises = await customerMemoryService.checkUnfulfilledPromises(customerId, teamId);
        if (unfulfilledPromises.length > 0) {
          logger.info(`Customer has ${unfulfilledPromises.length} unfulfilled promises`);
        }
      }

      const progress = conversationStateService.getProgressSummary(streamSid);
      const loopStatus = loopDetectionService.detectLoop(streamSid);

      const context: AIAgentContext = {
        callId,
        streamSid,
        teamId,
        customerId,
        customerMemory,
        isReturningCustomer,
        collectedFields: {},
        currentEmotion: 'neutral',
        emotionScore: 0.5,
        loopStatus,
        progress,
        apologyGiven: false,
      };

      logger.info(`AI Agent initialized for ${streamSid}. Returning customer: ${isReturningCustomer}`);
      return context;
    } catch (error) {
      logger.error('Error initializing AI Agent', error);
      throw error;
    }
  }

  /**
   * Clean up when call ends
   */
  async onCallEnd(streamSid: string, callId: string): Promise<void> {
    try {
      logger.info(`Cleaning up AI Agent for call ${callId}`);

      // Sync conversation state to database
      await conversationStateService.syncToDatabase(streamSid);

      // Clean up in-memory state
      await conversationStateService.cleanupState(streamSid);
      loopDetectionService.cleanup(streamSid);

      logger.info(`AI Agent cleanup complete for ${streamSid}`);
    } catch (error) {
      logger.error('Error cleaning up AI Agent', error);
    }
  }

  /**
   * Process user input before AI responds
   */
  async processUserInput(
    streamSid: string,
    input: string,
    teamId?: string,
    customerId?: string
  ): Promise<ProcessedInput> {
    try {
      const normalizedInput = input.toLowerCase().trim();

      // Detect emotion
      const emotion = emotionDetectionService.detectEmotion(input);
      emotionDetectionService.trackEmotionOverTime(streamSid, input);

      // Track for loop detection
      loopDetectionService.trackResponse(streamSid, input);
      const loopStatus = loopDetectionService.detectLoop(streamSid);

      // Extract facts if customer ID known
      let extractedFacts: any[] = [];
      if (customerId && teamId) {
        extractedFacts = customerMemoryService.extractFactsFromTranscript(input);
      }

      // Determine if escalation needed
      let shouldEscalate = false;
      let escalationReason: string | undefined;

      // Escalate if in severe loop
      if (loopStatus.severity === 'severe') {
        shouldEscalate = true;
        escalationReason = 'Conversation stuck in loop';
      }

      // Escalate if very negative emotion
      if (emotion.score <= 0.2) {
        shouldEscalate = true;
        escalationReason = `Customer highly ${emotion.emotion}`;
      }

      // Suggested action based on analysis
      let suggestedAction: string | undefined;

      if (loopStatus.loopDetected && !shouldEscalate) {
        suggestedAction = loopStatus.suggestion;
      }

      if (emotion.emotion === 'confusion') {
        suggestedAction = 'Simplify explanation and check understanding';
      }

      return {
        originalInput: input,
        normalizedInput,
        emotion,
        loopStatus,
        extractedFacts,
        shouldEscalate,
        escalationReason,
        suggestedAction,
      };
    } catch (error) {
      logger.error('Error processing user input', error);
      return {
        originalInput: input,
        normalizedInput: input.toLowerCase(),
        emotion: { emotion: 'neutral', confidence: 0.5, score: 0.5, triggers: [] },
        loopStatus: { loopDetected: false, severity: 'none' },
        extractedFacts: [],
        shouldEscalate: false,
      };
    }
  }

  /**
   * Preprocess AI response before sending
   */
  async preprocessAIResponse(
    streamSid: string,
    response: string,
    teamId?: string,
    callId?: string
  ): Promise<ProcessedResponse> {
    try {
      let adaptedResponse = response;
      let emotionAdaptation: AdaptedResponse | undefined;
      let apologyIncluded: ApologyResponse | undefined;
      const promisesMade: string[] = [];
      const fieldsCollected: string[] = [];

      // Adapt response based on emotion
      if (teamId) {
        emotionAdaptation = await emotionDetectionService.getAdaptedResponse(
          streamSid,
          response,
          teamId
        );
        adaptedResponse = emotionAdaptation.adaptedResponse;
      }

      // Check if apology is appropriate
      const apologyDecision = apologyIntelligenceService.isApologyAppropriate(streamSid, {
        transcript: response,
      });

      if (apologyDecision.shouldApologize && apologyDecision.situation && teamId) {
        apologyIncluded = await apologyIntelligenceService.generateApology(
          streamSid,
          teamId,
          apologyDecision.situation
        );

        // Prepend apology if not already included
        if (!adaptedResponse.toLowerCase().includes('sorry') &&
            !adaptedResponse.toLowerCase().includes('apologize')) {
          adaptedResponse = `${apologyIncluded.apology} ${adaptedResponse}`;
        }

        if (apologyIncluded.promiseMade) {
          promisesMade.push(apologyIncluded.promiseMade);
        }
      }

      // Track any questions being asked (for loop detection)
      if (response.includes('?')) {
        loopDetectionService.trackQuestion(streamSid, response);
      }

      // Extract promises from response
      const responsePromises = customerMemoryService.extractPromisesFromText(response);
      promisesMade.push(...responsePromises);

      // Record promises in state
      for (const promise of promisesMade) {
        conversationStateService.recordPromise(streamSid, promise);
      }

      // Calculate confidence (simplified - would normally verify specific claims)
      const confidenceScore: ConfidenceScore = {
        overall: 0.85,
        breakdown: { verifiedClaims: 0, unverifiedClaims: 0, contradictedClaims: 0 },
        shouldAcknowledgeUncertainty: false,
      };

      return {
        originalResponse: response,
        adaptedResponse,
        emotionAdaptation,
        apologyIncluded,
        confidenceScore,
        promisesMade,
        fieldsCollected,
      };
    } catch (error) {
      logger.error('Error preprocessing AI response', error);
      return {
        originalResponse: response,
        adaptedResponse: response,
        confidenceScore: {
          overall: 0.5,
          breakdown: { verifiedClaims: 0, unverifiedClaims: 0, contradictedClaims: 0 },
          shouldAcknowledgeUncertainty: true,
        },
        promisesMade: [],
        fieldsCollected: [],
      };
    }
  }

  /**
   * Build enhanced context for prompt injection
   */
  async buildEnhancedPromptContext(
    streamSid: string,
    customerId?: string,
    teamId?: string
  ): Promise<EnhancedPromptContext> {
    try {
      const specialInstructions: string[] = [];

      // Customer context
      let customerContext = 'New customer - no prior history.';
      if (customerId && teamId) {
        customerContext = await customerMemoryService.generateNaturalSummary(customerId, teamId);

        const unfulfilledPromises = await customerMemoryService.checkUnfulfilledPromises(customerId, teamId);
        if (unfulfilledPromises.length > 0) {
          specialInstructions.push(
            `IMPORTANT: Follow up on unfulfilled promises: ${unfulfilledPromises.map(p => p.factValue).join('; ')}`
          );
        }
      }

      // Collected info
      const collectedFields = conversationStateService.getCollectedFields(streamSid);
      const collectedInfo = conversationStateService.getCollectionSummary(streamSid);

      if (Object.keys(collectedFields).length > 0) {
        specialInstructions.push(
          `DO NOT ask again for: ${Object.keys(collectedFields).join(', ')} - already collected`
        );
      }

      // Emotion guidance
      const state = await conversationStateService.getState(streamSid);
      let emotionGuidance = 'Customer emotion: neutral. Maintain friendly tone.';

      if (state) {
        const emotion = state.currentEmotion;
        if (emotion === 'anger' || emotion === 'frustration') {
          emotionGuidance = `Customer is ${emotion}. Be extra empathetic, apologize if appropriate, and focus on resolution.`;
        } else if (emotion === 'confusion') {
          emotionGuidance = 'Customer seems confused. Use simpler language and confirm understanding.';
        } else if (emotion === 'sadness') {
          emotionGuidance = 'Customer seems upset. Be gentle and supportive.';
        }
      }

      // Loop guidance
      const loopStatus = loopDetectionService.detectLoop(streamSid);
      let loopGuidance = '';

      if (loopStatus.loopDetected) {
        loopGuidance = `WARNING: ${loopStatus.details}. ${loopStatus.suggestion}`;
        specialInstructions.push('Change your approach - do not repeat previous questions');
      }

      // Progress info
      const progress = conversationStateService.getProgressSummary(streamSid);
      const progressInfo = `Conversation progress: ${progress.percentage}%. Stage: ${progress.stage}. ${progress.summary}`;

      // Apology status
      const apologyGiven = conversationStateService.hasApologyBeenGiven(streamSid);
      const apologyStatus = apologyGiven
        ? 'Apology already given - do not over-apologize'
        : 'No apology given yet - apologize if appropriate';

      return {
        customerContext,
        collectedInfo,
        emotionGuidance,
        loopGuidance,
        progressInfo,
        apologyStatus,
        specialInstructions,
      };
    } catch (error) {
      logger.error('Error building enhanced prompt context', error);
      return {
        customerContext: 'Unable to load customer context',
        collectedInfo: '',
        emotionGuidance: '',
        loopGuidance: '',
        progressInfo: '',
        apologyStatus: '',
        specialInstructions: [],
      };
    }
  }

  /**
   * Initiate warm transfer to human agent
   */
  async initiateWarmTransfer(
    callId: string,
    streamSid: string,
    reason: string,
    teamId?: string
  ): Promise<AgentViewContext | null> {
    try {
      logger.info(`Initiating warm transfer for call ${callId}. Reason: ${reason}`);

      // Sync state before transfer
      await conversationStateService.syncToDatabase(streamSid);

      // Create transfer log
      const transferLog = await this.createTransferLog(callId, reason);

      // Build transfer context
      await transferContextService.buildTransferContext(callId, transferLog.id);

      // Get formatted context for agent
      const agentContext = await transferContextService.getContextForAgent(callId);

      logger.info(`Transfer context built for call ${callId}`);
      return agentContext;
    } catch (error) {
      logger.error('Error initiating warm transfer', error);
      return null;
    }
  }

  /**
   * Verify a claim before responding
   */
  async verifyClaim(callId: string, claim: ClaimToVerify): Promise<VerificationResponse> {
    return await factVerificationService.verifyClaim(callId, claim);
  }

  /**
   * Mark a field as collected
   */
  markFieldCollected(streamSid: string, fieldName: string, value: any): void {
    conversationStateService.markFieldCollected(streamSid, fieldName, value);
  }

  /**
   * Check if a field is already collected
   */
  isFieldCollected(streamSid: string, fieldName: string): boolean {
    return conversationStateService.isFieldCollected(streamSid, fieldName);
  }

  /**
   * Update conversation stage
   */
  updateStage(streamSid: string, stage: string): void {
    conversationStateService.updateStage(streamSid, stage);
    loopDetectionService.trackStageChange(streamSid);
  }

  /**
   * Store customer fact
   */
  async storeCustomerFact(
    customerId: string,
    teamId: string,
    fact: { factType: string; factKey: string; factValue: string },
    callId: string
  ): Promise<void> {
    await customerMemoryService.storeFact(customerId, teamId, {
      factType: fact.factType as any,
      factKey: fact.factKey,
      factValue: fact.factValue,
      source: callId,
    });
  }

  /**
   * Get current AI agent context
   */
  async getContext(streamSid: string, customerId?: string, teamId?: string): Promise<AIAgentContext | null> {
    const state = await conversationStateService.getState(streamSid);
    if (!state) return null;

    let customerMemory: MemorySummary | undefined;
    if (customerId && teamId) {
      customerMemory = await customerMemoryService.getMemorySummary(customerId, teamId);
    }

    const loopStatus = loopDetectionService.detectLoop(streamSid);
    const progress = conversationStateService.getProgressSummary(streamSid);

    return {
      callId: state.callId,
      streamSid,
      teamId,
      customerId,
      customerMemory,
      isReturningCustomer: customerMemory ? customerMemory.interactionCount > 0 : false,
      collectedFields: conversationStateService.getCollectedFields(streamSid),
      currentEmotion: state.currentEmotion,
      emotionScore: state.emotionScore,
      loopStatus,
      progress,
      apologyGiven: state.apologyGiven,
    };
  }

  // Private helper
  private async createTransferLog(callId: string, reason: string) {
    const { prisma } = await import('../db/client');
    return await prisma.transferLog.create({
      data: {
        callId,
        fromBot: true,
        context: reason,
      },
    });
  }

  // ==================== PHASE 2: PROBLEM-SOLVING CAPABILITIES ====================

  /**
   * Detect proactive problems for a customer at call start
   */
  async detectProactiveProblems(
    customerId: string,
    teamId: string,
    phone?: string
  ): Promise<ProactiveProblem[]> {
    try {
      const problems = await proactiveProblemService.detectProblems(customerId, teamId, phone);
      logger.info(`Detected ${problems.length} proactive problems for customer ${customerId}`);
      return problems;
    } catch (error) {
      logger.error('Error detecting proactive problems', error);
      return [];
    }
  }

  /**
   * Get customer risk profile
   */
  async getCustomerRiskProfile(
    customerId: string,
    teamId: string
  ): Promise<CustomerRiskProfile> {
    try {
      return await proactiveProblemService.buildRiskProfile(customerId, teamId);
    } catch (error) {
      logger.error('Error getting customer risk profile', error);
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
   * Generate proactive message to address detected problems
   */
  generateProactiveMessage(problems: ProactiveProblem[]): string | null {
    return proactiveProblemService.generateProactiveMessage(problems);
  }

  /**
   * Analyze conversation for root cause
   */
  analyzeRootCause(transcript: string, context?: any): RootCauseAnalysis {
    return rootCauseService.analyzeConversation(transcript, context);
  }

  /**
   * Get recommended actions based on root cause analysis
   */
  getRecommendedActions(analysis: RootCauseAnalysis): string[] {
    return rootCauseService.getRecommendedActions(analysis);
  }

  /**
   * Execute an action (cancel order, refund, etc.)
   */
  async executeAction(
    callId: string,
    actionType: string,
    entityId: string,
    parameters: Record<string, any>,
    reason: string
  ): Promise<ActionResult> {
    const request: ActionRequest = {
      type: actionType as any,
      entityId,
      entityType: 'order',
      parameters,
      reason,
      requestedBy: 'ai',
    };

    return await actionAuthorityService.executeAction(request, callId);
  }

  /**
   * Check if AI can perform an action
   */
  canPerformAction(
    actionType: string,
    context: { amount?: number; orderStatus?: string }
  ): { allowed: boolean; reason?: string } {
    return actionAuthorityService.canPerformAction(actionType as any, context);
  }

  /**
   * Generate smart suggestions for upselling/cross-selling
   */
  async generateSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    try {
      return await smartSuggestionService.generateSuggestions(context);
    } catch (error) {
      logger.error('Error generating suggestions', error);
      return [];
    }
  }

  /**
   * Check if it's appropriate to make a suggestion
   */
  shouldMakeSuggestion(
    conversationStage: string,
    customerSentiment: number,
    problemResolved: boolean
  ): { shouldSuggest: boolean; reason: string } {
    return smartSuggestionService.shouldMakeSuggestion(
      conversationStage,
      customerSentiment,
      problemResolved
    );
  }

  /**
   * Detect customer confusion from transcript
   */
  detectConfusion(transcript: string): ConfusionIndicator {
    return customerEducationService.detectConfusion(transcript);
  }

  /**
   * Find relevant education topic based on customer question
   */
  findEducationTopic(question: string) {
    return customerEducationService.findRelevantTopic(question);
  }

  /**
   * Start customer education session
   */
  startEducationSession(customerId: string, callId: string, topicKey: string) {
    return customerEducationService.startSession(customerId, callId, topicKey);
  }

  /**
   * Get next step in education session
   */
  getNextEducationStep(callId: string) {
    return customerEducationService.nextStep(callId);
  }

  /**
   * Enhanced call start with Phase 2 features
   */
  async onCallStartEnhanced(
    streamSid: string,
    callId: string,
    customerId?: string,
    teamId?: string,
    phone?: string
  ): Promise<AIAgentContext> {
    // First, run the standard Phase 1 initialization
    const context = await this.onCallStart(streamSid, callId, customerId, teamId);

    // Then add Phase 2 proactive problem detection
    if (customerId && teamId) {
      try {
        const [proactiveProblems, riskProfile] = await Promise.all([
          this.detectProactiveProblems(customerId, teamId, phone),
          this.getCustomerRiskProfile(customerId, teamId),
        ]);

        context.proactiveProblems = proactiveProblems;
        context.riskProfile = riskProfile;

        // Log risk level
        if (riskProfile.riskLevel === 'high') {
          logger.warn(`High-risk customer detected: ${customerId}. Factors: ${riskProfile.riskFactors.join(', ')}`);
        }
      } catch (error) {
        logger.error('Error in enhanced call start', error);
      }
    }

    return context;
  }

  /**
   * Enhanced user input processing with Phase 2 features
   */
  async processUserInputEnhanced(
    streamSid: string,
    input: string,
    teamId?: string,
    customerId?: string,
    currentContext?: AIAgentContext
  ): Promise<ProcessedInput & { confusion?: ConfusionIndicator; educationTopic?: any }> {
    // Run standard Phase 1 processing
    const processed = await this.processUserInput(streamSid, input, teamId, customerId);

    // Add Phase 2 confusion detection
    const confusion = this.detectConfusion(input);
    if (confusion.detected) {
      logger.info(`Confusion detected: ${confusion.type} (confidence: ${confusion.confidence})`);
    }

    // Check if customer is asking about a topic we can educate on
    const educationTopic = this.findEducationTopic(input);

    return {
      ...processed,
      confusion,
      educationTopic,
    };
  }
}

export const aiAgentCoordinator = new AIAgentCoordinator();
