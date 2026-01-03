import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { TwilioStreamService } from './twilioStream';
import { KnowledgeService, KnowledgeContext, ConfidenceScore } from './knowledgeService';
import { PromptService, DynamicPrompt } from './promptService';
import { QueueService } from './queueService';

export interface RealtimeMessage {
  type: string;
  [key: string]: any;
}

export interface ConversationContext {
  callId: string;
  teamId: string;
  campaignId?: string;
  knowledgeContext: KnowledgeContext;
  confidenceThreshold: number;
  knowledgeSources: Set<string>;
}

export class OpenAIRealtimeService {
  private ws: WebSocket | null = null;
  private twilioService: TwilioStreamService;
  private knowledgeService: KnowledgeService;
  private promptService: PromptService;
  private queueService: QueueService;
  private isConnected: boolean = false;
  private isClosing: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 1000;
  private conversationContexts: Map<string, ConversationContext> = new Map();

  constructor(twilioService: TwilioStreamService) {
    this.twilioService = twilioService;
    this.knowledgeService = new KnowledgeService();
    this.promptService = new PromptService();
    this.queueService = new QueueService();
  }

  public connect() {
    if (this.isConnected) return;
    this.isClosing = false;

    try {
      const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${config.OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      this.ws.on('open', () => {
        logger.info('Connected to OpenAI Realtime API');
        this.isConnected = true;
        this.retryCount = 0;
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        // Handle messages from OpenAI
        try {
          const event = JSON.parse(data.toString());
          this.handleOpenAIMessage(event);
        } catch (err) {
          logger.error('Error parsing OpenAI message', err);
        }
      });

      this.ws.on('error', (error) => {
        logger.error('OpenAI WebSocket error', error);
      });

      this.ws.on('close', () => {
        logger.warn('OpenAI WebSocket closed');
        this.isConnected = false;
        if (!this.isClosing) {
          this.attemptReconnect();
        }
      });
    } catch (error) {
      logger.error('Failed to connect to OpenAI', error);
      if (!this.isClosing) {
        this.attemptReconnect();
      }
    }
  }

  private async handleOpenAIMessage(event: any) {
    switch (event.type) {
      case 'response.audio.delta':
        if (event.delta) {
          this.twilioService.sendAudio(event.delta);
        }
        break;

      case 'response.text.delta':
        // Handle text response for knowledge tracking
        await this.handleTextResponse(event.delta);
        break;

      case 'response.done':
        // Handle completion and confidence scoring
        await this.handleResponseCompletion(event);
        break;

      case 'error':
        logger.error('OpenAI Error Event:', event.error);
        break;

      default:
        logger.debug(`Unhandled OpenAI event type: ${event.type}`);
    }
  }

  private async handleTextResponse(textDelta: string) {
    // Track text generation for confidence scoring
    // This could be used to monitor AI responses in real-time
  }

  private async handleResponseCompletion(event: any) {
    // Handle final response and record knowledge usage
    for (const [streamSid, context] of this.conversationContexts) {
      if (event.response?.output_text) {
        await this.processResponseKnowledgeUsage(streamSid, event.response.output_text, context);
      }
    }
  }

  private async processResponseKnowledgeUsage(
    streamSid: string,
    responseText: string,
    context: ConversationContext,
  ) {
    try {
      // Analyze response for knowledge source references
      const usedSources = this.identifyKnowledgeSources(responseText, context);

      if (usedSources.length > 0) {
        await this.knowledgeService.recordKnowledgeUsage(context.callId, usedSources);

        // Calculate confidence score
        const confidence = this.knowledgeService.calculateConfidenceScore(
          context.knowledgeContext,
          usedSources.map(s => s.id),
        );

        // Log confidence metrics
        logger.info(`Response confidence for call ${context.callId}: ${confidence.overall.toFixed(2)}`);

        // Track fallback responses
        if (confidence.fallback) {
          await this.knowledgeService.trackUnansweredQuestion(responseText);
        }

        // Check if we should trigger a transfer to a human agent
        if (this.shouldTriggerTransfer(responseText, confidence)) {
          logger.info(`Triggering automated transfer request for call ${context.callId}`);
          await this.queueService.requestTransfer(context.callId, {
            reason: confidence.fallback ? 'AI Uncertainty' : 'Customer Request',
            priority: 1,
            teamId: context.teamId,
            context: {
              lastConfidence: confidence.overall,
              responseText
            }
          });

          // Optionally notify OpenAI to stop or say something about the transfer
          await this.updateSystemPrompt(streamSid, "The customer is being transferred to a human agent. Please acknowledge this and tell them to wait a moment.");
        }
      }
    } catch (error) {
      logger.error('Error processing response knowledge usage', error);
    }
  }

  /**
   * Determine if the conversation should be transferred to a human agent
   */
  private shouldTriggerTransfer(text: string, confidence: ConfidenceScore): boolean {
    const textLower = text.toLowerCase();

    // Explicit requests for a human
    const transferRequests = [
      'talk to a human',
      'speak with an agent',
      'representative',
      'human',
      'real person',
      'manager',
      'operator'
    ];

    if (transferRequests.some(phrase => textLower.includes(phrase))) {
      return true;
    }

    // Very low confidence or repeated fallback
    if (confidence.overall < 0.2 || (confidence.fallback && confidence.overall < 0.4)) {
      return true;
    }

    // Negative sentiment/Frustration
    const frustrationKeywords = ['angry', 'upset', 'terrible', 'horrible', 'stupid bot', 'not helping', 'useless'];
    if (frustrationKeywords.some(keyword => textLower.includes(keyword))) {
      return true;
    }

    return false;
  }

  private identifyKnowledgeSources(
    responseText: string,
    context: ConversationContext,
  ): Array<{ id: string; type: 'knowledge' | 'product' | 'faq'; relevanceScore: number }> {
    const usedSources: Array<{ id: string; type: 'knowledge' | 'product' | 'faq'; relevanceScore: number }> = [];
    const textLower = responseText.toLowerCase();

    // Check which knowledge sources were referenced in the response
    for (const kb of context.knowledgeContext.knowledgeBase) {
      if (this.isSourceReferenced(textLower, kb)) {
        usedSources.push({
          id: kb.id,
          type: 'knowledge',
          relevanceScore: kb.relevanceScore,
        });
      }
    }

    for (const product of context.knowledgeContext.products) {
      if (this.isSourceReferenced(textLower, product)) {
        usedSources.push({
          id: product.id,
          type: 'product',
          relevanceScore: product.relevanceScore,
        });
      }
    }

    for (const faq of context.knowledgeContext.faqs) {
      if (this.isSourceReferenced(textLower, faq)) {
        usedSources.push({
          id: faq.id,
          type: 'faq',
          relevanceScore: faq.relevanceScore,
        });
      }
    }

    return usedSources;
  }

  private isSourceReferenced(text: string, source: any): boolean {
    // Simple keyword matching - in production, this could use semantic similarity
    const sourceKeywords = [
      source.title || source.name || '',
      source.content || source.description || source.answer || '',
    ].join(' ').toLowerCase().split(' ');

    const significantWords = sourceKeywords.filter(word => word.length > 3);
    const matches = significantWords.filter(word => text.includes(word)).length;

    return matches >= Math.max(1, Math.floor(significantWords.length * 0.3));
  }

  /**
   * Initialize conversation context with knowledge integration
   */
  async initializeConversation(
    streamSid: string,
    callId: string,
    teamId: string,
    campaignId?: string,
    templateId?: string,
  ): Promise<void> {
    try {
      logger.info(`Initializing knowledge-enhanced conversation for call ${callId}`);

      // Generate dynamic prompt with knowledge context
      const dynamicPrompt = await this.promptService.generateDynamicPrompt(
        callId,
        teamId,
        campaignId,
        templateId,
      );

      // Store conversation context
      this.conversationContexts.set(streamSid, {
        callId,
        teamId,
        campaignId,
        knowledgeContext: dynamicPrompt.knowledgeContext,
        confidenceThreshold: dynamicPrompt.confidenceThreshold,
        knowledgeSources: new Set(),
      });

      // Update system prompt if connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        await this.updateSystemPrompt(streamSid, dynamicPrompt.systemPrompt);
      }

      logger.info(`Knowledge-enhanced conversation initialized for call ${callId}`);
    } catch (error) {
      logger.error('Error initializing conversation context', error);
    }
  }

  private async updateSystemPrompt(streamSid: string, systemPrompt: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const event = {
        type: 'session.update',
        session: {
          instructions: systemPrompt,
        },
      };
      this.ws.send(JSON.stringify(event));
    }
  }

  /**
   * Update conversation context with new knowledge
   */
  async updateConversationKnowledge(
    streamSid: string,
    query: string,
  ): Promise<void> {
    const context = this.conversationContexts.get(streamSid);
    if (!context) {
      logger.warn(`No conversation context found for streamSid: ${streamSid}`);
      return;
    }

    try {
      // Search for new relevant knowledge based on query
      const newKnowledge = await this.knowledgeService.searchRelevantKnowledge(
        query,
        context.teamId,
        3,
      );

      // Update conversation context if significant new knowledge found
      if (newKnowledge.length > 0) {
        const updatedContext = {
          ...context,
          knowledgeContext: {
            ...context.knowledgeContext,
            knowledgeBase: [...context.knowledgeContext.knowledgeBase, ...newKnowledge.filter(k => k.type === 'knowledge')],
            products: [...context.knowledgeContext.products, ...newKnowledge.filter(k => k.type === 'product')],
            faqs: [...context.knowledgeContext.faqs, ...newKnowledge.filter(k => k.type === 'faq')],
          },
        };

        this.conversationContexts.set(streamSid, updatedContext);

        // Update system prompt with new knowledge
        const dynamicPrompt = await this.promptService.generateDynamicPrompt(
          context.callId,
          context.teamId,
          context.campaignId,
        );

        await this.updateSystemPrompt(streamSid, dynamicPrompt.systemPrompt);

        logger.info(`Updated conversation knowledge for call ${context.callId}`);
      }
    } catch (error) {
      logger.error('Error updating conversation knowledge', error);
    }
  }

  /**
   * Check if response should trigger fallback
   */
  shouldTriggerFallback(streamSid: string, responseText: string): boolean {
    const context = this.conversationContexts.get(streamSid);
    if (!context) return false;

    // Check for uncertainty indicators in response
    const uncertaintyPhrases = [
      "i'm not sure",
      "i don't know",
      "i can't",
      "not certain",
      "unclear",
      "beyond my knowledge",
    ];

    const textLower = responseText.toLowerCase();
    return uncertaintyPhrases.some(phrase => textLower.includes(phrase));
  }

  public sendAudio(base64Audio: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const event = {
        type: 'input_audio_buffer.append',
        audio: base64Audio,
      };
      this.ws.send(JSON.stringify(event));
    }
  }

  public disconnect() {
    if (this.ws) {
      this.isClosing = true;
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  private attemptReconnect() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = this.retryDelay * this.retryCount;
      logger.info(
        `Attempting to reconnect to OpenAI in ${delay}ms (Attempt ${this.retryCount}/${this.maxRetries})`,
      );
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      logger.error('Max retries reached. Could not reconnect to OpenAI.');
    }
  }
}