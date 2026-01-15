import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import axios from 'axios';
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
  detectedLanguage?: string; // Track detected language
  lastUserInput?: string; // Track last user input
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
  private aiTranscripts: Map<string, string> = new Map();
  private modelToUse?: string;
  private attemptedModels: Set<string> = new Set();
  private modelDiscoveryInProgress: boolean = false;

  // ⭐ Audio buffer for audio received before OpenAI connection is established
  private pendingAudioBuffer: string[] = [];
  private readonly MAX_PENDING_AUDIO_CHUNKS = 100; // Limit buffer to prevent memory issues

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
      // Use environment variable or default to latest available model
      // Update OPENAI_REALTIME_MODEL in .env if model access issues occur
      const modelName = config.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview';
      const url = `wss://api.openai.com/v1/realtime?model=${modelName}`;
      logger.info(`Connecting to OpenAI Realtime with model: ${modelName}`);
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
        this.handlePostConnect();
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
      case 'session.created':
        logger.info('OpenAI Session Created');
        break;

      case 'session.updated':
        logger.info('OpenAI Session Updated');
        // If we have a stored context for an ongoing call, we might want to trigger a greeting here
        // but it's usually better to do it explicitly after calling updateSession
        break;

      case 'response.created':
        logger.info('OpenAI Response Created');
        break;

      case 'response.audio.delta':
        if (event.delta) {
          logger.debug('OpenAI audio delta received', { length: event.delta.length });
          this.twilioService.sendAudio(event.delta);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript && this.twilioService.streamSid) {
          const transcript = event.transcript.trim();
          logger.info(`USER: ${transcript}`);

          // Detect and store language from user input
          const detectedLang = this.detectLanguage(transcript);
          const context = this.conversationContexts.get(this.twilioService.streamSid);
          if (context) {
            const previousLang = context.detectedLanguage;
            context.detectedLanguage = detectedLang;
            context.lastUserInput = transcript;

            logger.info(`Detected language: ${detectedLang}`);

            // If language changed, update session to reinforce language matching
            if (previousLang && previousLang !== detectedLang && detectedLang !== 'auto') {
              logger.info(`Language switch detected: ${previousLang} -> ${detectedLang}`);
              await this.reinforceLanguageContext(this.twilioService.streamSid, detectedLang);
            }
          }

          await this.twilioService.callManager.addTranscript(
            this.twilioService.streamSid,
            'User',
            transcript,
          );
        }
        break;

      case 'response.audio_transcript.delta':
        if (event.delta && event.response_id) {
          const current = this.aiTranscripts.get(event.response_id) || '';
          this.aiTranscripts.set(event.response_id, current + event.delta);
        }
        break;

      case 'response.output_text.delta':
      case 'response.text.delta':
        if (event.delta && event.response_id) {
          const current = this.aiTranscripts.get(event.response_id) || '';
          this.aiTranscripts.set(event.response_id, current + event.delta);
        }
        await this.handleTextResponse(event.delta);
        break;

      case 'response.done':
        // ⭐ CRITICAL: Flush any remaining audio buffer to ensure all audio is sent to Twilio
        this.twilioService.flushAudioBuffer();

        // Check if response failed before processing
        if (event.response?.status === 'failed') {
          const statusDetails = event.response?.status_details;
          logger.error('OpenAI Response Failed', {
            responseId: event.response?.id,
            statusDetails,
          });

          // If the failure is due to model access, try to discover a usable realtime model and reconnect
          const errorCode = statusDetails?.error?.code;
          if (errorCode === 'model_not_found') {
            try {
              await this.handleModelNotFound();
            } catch (e) {
              logger.error('Error handling model_not_found', e);
            }
          }
        } else {
          // Handle completion and confidence scoring
          await this.handleResponseCompletion(event);
        }
        break;

      case 'input_audio_buffer.speech_started':
        logger.info('User started speaking');
        break;

      case 'input_audio_buffer.speech_stopped':
        logger.info('User stopped speaking');
        break;

      case 'input_audio_buffer.committed':
      case 'conversation.item.created':
      case 'conversation.item.input_audio_transcription.delta':
      case 'response.content_part.added':
      case 'response.content_part.done':
      case 'response.output_item.added':
      case 'response.output_item.done':
      case 'rate_limits.updated':
        // Silence frequent protocol events
        break;

      case 'error':
        logger.error('OpenAI Error Event:', event.error);
        break;

      default:
        logger.debug(`Unhandled OpenAI event type: ${event.type}`);
    }
  }

  /**
   * Detect language from user input text
   */
  private detectLanguage(text: string): string {
    // Basic language detection using Unicode ranges and patterns
    const hindiPattern = /[\u0900-\u097F]/; // Devanagari script (Hindi)
    const arabicPattern = /[\u0600-\u06FF]/; // Arabic script
    const chinesePattern = /[\u4E00-\u9FFF]/; // Chinese characters
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/; // Hiragana and Katakana

    // Check for non-Latin scripts first
    if (hindiPattern.test(text)) {
      return 'hindi';
    } else if (arabicPattern.test(text)) {
      return 'arabic';
    } else if (chinesePattern.test(text)) {
      return 'chinese';
    } else if (japanesePattern.test(text)) {
      return 'japanese';
    }

    // Check for common Hindi romanized words
    const hindiRomanizedWords = ['namaste', 'dhanyavaad', 'kripya', 'aap', 'main', 'haan', 'nahi'];
    const textLower = text.toLowerCase();
    const hasHindiWords = hindiRomanizedWords.some((word) => textLower.includes(word));

    if (hasHindiWords) {
      return 'hindi-romanized';
    }

    // Default to English if primarily Latin characters
    const englishPattern = /^[a-zA-Z\s.,!?'"0-9]+$/;
    if (englishPattern.test(text.trim())) {
      return 'english';
    }

    // Auto-detect for mixed or unknown
    return 'auto';
  }

  /**
   * Reinforce language context when language changes
   */
  private async reinforceLanguageContext(streamSid: string, language: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const languageMap: { [key: string]: string } = {
        hindi: 'Hindi (हिंदी)',
        'hindi-romanized': 'Hindi (in Roman script)',
        english: 'English',
        arabic: 'Arabic',
        chinese: 'Chinese',
        japanese: 'Japanese',
      };

      const languageName = languageMap[language] || language;

      const reinforcementInstruction = `IMPORTANT: The user is now speaking in ${languageName}. 
You MUST respond in ${languageName} for all subsequent responses. 
Continue the conversation naturally in ${languageName}.`;

      const event = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: reinforcementInstruction,
            },
          ],
        },
      };

      this.ws.send(JSON.stringify(event));
      logger.info(`Reinforced language context to ${languageName}`);
    }
  }

  private async handleTextResponse(textDelta: string) {
    // Track text generation for confidence scoring
    // This could be used to monitor AI responses in real-time
  }

  private async handleResponseCompletion(event: any) {
    const response = event.response || {};

    const responseId = response.id;
    // Try to use accumulated deltas if present
    let aiTranscript = this.aiTranscripts.get(responseId) || '';

    // If no accumulated text, inspect other response shapes
    if (!aiTranscript) {
      if (response.output_text) {
        if (typeof response.output_text === 'string') aiTranscript = response.output_text.trim();
        else if (Array.isArray(response.output_text))
          aiTranscript = response.output_text.join(' ').trim();
      }
    }

    // Fallback: search in output array for text/audio parts
    if (!aiTranscript && Array.isArray(response.output)) {
      for (const item of response.output) {
        const content = item.content || [];
        for (const part of content) {
          if (part.type === 'text' && part.text) {
            aiTranscript += (aiTranscript ? ' ' : '') + part.text.trim();
          } else if (part.type === 'audio' && part.transcript) {
            aiTranscript += (aiTranscript ? ' ' : '') + part.transcript.trim();
          }
        }
        if (aiTranscript) break;
      }
    }

    if (aiTranscript) {
      logger.info(`AI: ${aiTranscript}`);
      if (this.twilioService.streamSid) {
        await this.twilioService.callManager.addTranscript(
          this.twilioService.streamSid,
          'AI',
          aiTranscript,
        );
      }
    } else {
      // Log the full response for debugging when extraction fails
      logger.debug('Could not extract AI transcript from response.done', {
        responseId,
        response,
      });
    }

    // Cleanup accumulated transcript
    if (responseId) {
      this.aiTranscripts.delete(responseId);
    }

    // Handle knowledge usage using extracted text or any output_text
    const textForProcessing =
      aiTranscript ||
      (typeof response.output_text === 'string'
        ? response.output_text
        : Array.isArray(response.output_text)
          ? response.output_text.join(' ')
          : undefined);

    for (const [streamSid, context] of this.conversationContexts) {
      if (textForProcessing) {
        await this.processResponseKnowledgeUsage(streamSid, textForProcessing, context);
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
          usedSources.map((s) => s.id),
        );

        // Log confidence metrics
        logger.info(
          `Response confidence for call ${context.callId}: ${confidence.overall.toFixed(2)}`,
        );

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
              responseText,
            },
          });

          // Optionally notify OpenAI to stop or say something about the transfer
          await this.updateSystemPrompt(
            streamSid,
            'The customer is being transferred to a human agent. Please acknowledge this and tell them to wait a moment.',
          );
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
      'operator',
    ];

    if (transferRequests.some((phrase) => textLower.includes(phrase))) {
      return true;
    }

    // Very low confidence or repeated fallback
    if (confidence.overall < 0.2 || (confidence.fallback && confidence.overall < 0.4)) {
      return true;
    }

    // Negative sentiment/Frustration
    const frustrationKeywords = [
      'angry',
      'upset',
      'terrible',
      'horrible',
      'stupid bot',
      'not helping',
      'useless',
    ];
    if (frustrationKeywords.some((keyword) => textLower.includes(keyword))) {
      return true;
    }

    return false;
  }

  private identifyKnowledgeSources(
    responseText: string,
    context: ConversationContext,
  ): Array<{ id: string; type: 'knowledge' | 'product' | 'faq'; relevanceScore: number }> {
    const usedSources: Array<{
      id: string;
      type: 'knowledge' | 'product' | 'faq';
      relevanceScore: number;
    }> = [];
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
    ]
      .join(' ')
      .toLowerCase()
      .split(' ');

    const significantWords = sourceKeywords.filter((word) => word.length > 3);
    const matches = significantWords.filter((word) => text.includes(word)).length;

    return matches >= Math.max(1, Math.floor(significantWords.length * 0.3));
  }

  /**
   * Initialize conversation context with knowledge integration and multilingual support
   */
  async initializeConversation(
    streamSid: string,
    callId: string,
    teamId: string,
    campaignId?: string,
    templateId?: string,
  ): Promise<void> {
    try {
      logger.info(`Initializing multilingual knowledge-enhanced conversation for call ${callId}`);

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
        detectedLanguage: 'auto', // Initialize as auto-detect
        lastUserInput: undefined,
      });

      // Update session with Twilio-specific configuration and knowledge
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        await this.updateSession(streamSid, dynamicPrompt.systemPrompt);

        // Trigger initial greeting
        await this.triggerGreeting(streamSid);
      } else {
        logger.info(
          `Conversation context stored for call ${callId}, waiting for connection to initialize session.`,
        );
      }

      logger.info(`Multilingual knowledge-enhanced conversation initialized for call ${callId}`);
    } catch (error) {
      logger.error('Error initializing conversation context', error);
    }
  }

  private async handlePostConnect() {
    for (const [streamSid, context] of this.conversationContexts) {
      try {
        logger.info(`Performing post-connect initialization for streamSid: ${streamSid}`);

        // Regenerate prompt to ensure it's fresh
        const dynamicPrompt = await this.promptService.generateDynamicPrompt(
          context.callId,
          context.teamId,
          context.campaignId,
        );

        await this.updateSession(streamSid, dynamicPrompt.systemPrompt);
        await this.triggerGreeting(streamSid);
      } catch (error) {
        logger.error(`Error in post-connect initialization for stream ${streamSid}`, error);
      }
    }

    // ⭐ Flush any audio that was buffered while waiting for connection
    if (this.pendingAudioBuffer.length > 0) {
      logger.info(`Flushing ${this.pendingAudioBuffer.length} buffered audio chunks to OpenAI`);
      for (const audioChunk of this.pendingAudioBuffer) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const event = {
            type: 'input_audio_buffer.append',
            audio: audioChunk,
          };
          this.ws.send(JSON.stringify(event));
        }
      }
      this.pendingAudioBuffer = [];
      logger.info('Buffered audio flushed to OpenAI');
    }
  }

  private async updateSession(streamSid: string, systemPrompt: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const context = this.conversationContexts.get(streamSid);

      // ═══════════════════════════════════════════════════════════════════════════
      // HUMAN-LIKE VOICE CONFIGURATION
      // These settings are optimized to make the AI sound natural and human
      // ═══════════════════════════════════════════════════════════════════════════

      const event = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: systemPrompt,

          // ⭐ VOICE SELECTION - 'shimmer' is warm and natural sounding
          // Options: 'alloy', 'echo', 'shimmer', 'ash', 'ballad', 'coral', 'sage', 'verse'
          // 'shimmer' - warm, friendly female voice (best for customer service)
          // 'echo' - clear, professional male voice
          voice: 'shimmer',

          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',

          input_audio_transcription: {
            model: 'whisper-1', // Auto language detection
          },

          // ⭐ TURN DETECTION - Natural conversation flow
          turn_detection: {
            type: 'server_vad',
            threshold: 0.6,           // Slightly higher = waits for clearer speech end
            prefix_padding_ms: 400,   // Captures beginning of speech better
            silence_duration_ms: 700, // Waits a bit longer before responding (more natural)
          },

          // ⭐ TEMPERATURE - Higher = more natural variation in responses
          // 0.9 gives good variation while staying coherent
          temperature: 0.9,

          max_response_output_tokens: 4096,
        },
      };

      logger.info('Updating OpenAI Session with human-like voice settings', {
        voice: 'shimmer',
        temperature: 0.9,
        silenceDuration: 700,
      });

      this.ws.send(JSON.stringify(event));
    }
  }

  private async triggerGreeting(streamSid: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.info('Triggering human-like greeting');

      // ═══════════════════════════════════════════════════════════════════════════
      // HUMAN-LIKE GREETING
      // This greeting sounds like a real customer service rep, not a bot
      // ═══════════════════════════════════════════════════════════════════════════

      const greetingInstruction = `Give a warm, natural greeting like a real customer service rep would.

IMPORTANT RULES:
- DO NOT say you're an AI, bot, or virtual assistant
- DO NOT say "I'm here to assist you" or similar robotic phrases
- Sound like a friendly human coworker

GREETING STYLE (pick one naturally based on your mood):
- "Hey there! Thanks for calling. What can I help you with?"
- "Hi! How's it going? What can I do for you today?"
- "Hello! Thanks for reaching out. What's up?"

Keep it SHORT - just 1-2 sentences. Be warm and friendly.
Then WAIT for them to tell you what they need.

If they greet you back or make small talk, engage briefly and naturally before asking how you can help.`;

      const event = {
        type: 'response.create',
        response: {
          instructions: greetingInstruction,
        },
      };
      this.ws.send(JSON.stringify(event));
    }
  }

  private async updateSystemPrompt(streamSid: string, systemPrompt: string): Promise<void> {
    await this.updateSession(streamSid, systemPrompt);
  }

  /**
   * Update conversation context with new knowledge
   */
  async updateConversationKnowledge(streamSid: string, query: string): Promise<void> {
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
            knowledgeBase: [
              ...context.knowledgeContext.knowledgeBase,
              ...newKnowledge.filter((k) => k.type === 'knowledge'),
            ],
            products: [
              ...context.knowledgeContext.products,
              ...newKnowledge.filter((k) => k.type === 'product'),
            ],
            faqs: [
              ...context.knowledgeContext.faqs,
              ...newKnowledge.filter((k) => k.type === 'faq'),
            ],
          },
        };

        this.conversationContexts.set(streamSid, updatedContext);

        // Update system prompt with new knowledge
        const dynamicPrompt = await this.promptService.generateDynamicPrompt(
          context.callId,
          context.teamId,
          context.campaignId,
        );

        await this.updateSession(streamSid, dynamicPrompt.systemPrompt);

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

    // Check for uncertainty indicators in response (multilingual)
    const uncertaintyPhrases = [
      "i'm not sure",
      "i don't know",
      "i can't",
      'not certain',
      'unclear',
      'beyond my knowledge',
      'मुझे नहीं पता', // Hindi: I don't know
      'मुझे यकीन नहीं', // Hindi: I'm not sure
      'मैं नहीं जानता', // Hindi: I don't know
      'no sé', // Spanish: I don't know
      'não sei', // Portuguese: I don't know
    ];

    const textLower = responseText.toLowerCase();
    return uncertaintyPhrases.some((phrase) => textLower.includes(phrase));
  }

  public sendAudio(base64Audio: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const event = {
        type: 'input_audio_buffer.append',
        audio: base64Audio,
      };
      this.ws.send(JSON.stringify(event));
    } else {
      // ⭐ Buffer audio if connection not yet established
      // This prevents losing initial user speech while OpenAI connects
      if (this.pendingAudioBuffer.length < this.MAX_PENDING_AUDIO_CHUNKS) {
        this.pendingAudioBuffer.push(base64Audio);
        if (this.pendingAudioBuffer.length === 1) {
          logger.info('Buffering audio while waiting for OpenAI connection...');
        }
      } else if (this.pendingAudioBuffer.length === this.MAX_PENDING_AUDIO_CHUNKS) {
        logger.warn('Audio buffer full, dropping oldest chunks');
        this.pendingAudioBuffer.shift();
        this.pendingAudioBuffer.push(base64Audio);
      }
    }
  }

  /**
   * Send text input as if it were user speech (for testing)
   */
  public sendUserText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // 1. Send the user message
      const itemEvent = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: text,
            },
          ],
        },
      };
      this.ws.send(JSON.stringify(itemEvent));

      // 2. Trigger a response generation
      const responseEvent = {
        type: 'response.create',
      };
      this.ws.send(JSON.stringify(responseEvent));

      logger.info(`Sent test text input: "${text}"`);
    } else {
      logger.warn('Cannot send test text: OpenAI user WebSocket not open');
    }
  }

  public disconnect() {
    if (this.ws) {
      this.isClosing = true;
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
    // Clear any pending audio buffer to prevent memory leaks
    this.pendingAudioBuffer = [];
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

  private async handleModelNotFound(): Promise<void> {
    if (this.modelDiscoveryInProgress) return;
    this.modelDiscoveryInProgress = true;

    try {
      // Discover available realtime models from OpenAI
      const discovered = await this.discoverRealtimeModel();
      if (discovered) {
        if (this.attemptedModels.has(discovered)) {
          logger.warn('Discovered model was already attempted, skipping', { discovered });
        } else {
          logger.info('Discovered realtime model, will reconnect with it', { discovered });
          this.attemptedModels.add(discovered);
          this.modelToUse = discovered;

          // Reconnect using discovered model
          try {
            this.disconnect();
            // Slight delay before reconnect
            setTimeout(() => this.connect(), 500);
          } catch (e) {
            logger.error('Failed to reconnect with discovered model', e);
          }
        }
      } else {
        logger.warn('No realtime model discovered in account');
      }
    } finally {
      this.modelDiscoveryInProgress = false;
    }
  }

  private async discoverRealtimeModel(): Promise<string | null> {
    const apiKey = config.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error('OPENAI_API_KEY not configured; cannot discover models');
      return null;
    }

    try {
      const res = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });

      const models: any[] = res.data?.data || [];
      // Prefer models that match typical realtime naming
      const preferredPatterns = [/gpt-?4.*realtime/i, /realtime/i];

      for (const pat of preferredPatterns) {
        const found = models.find((m) => pat.test(m.id));
        if (found) return found.id;
      }

      return null;
    } catch (err) {
      logger.error('Error querying OpenAI models endpoint', err);
      return null;
    }
  }
}
