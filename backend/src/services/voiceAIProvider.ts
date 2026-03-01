/**
 * Abstract interface for voice AI providers.
 *
 * Providers handle the full loop:
 *   Twilio audio in → STT → LLM → TTS → Twilio audio out
 *
 * Two implementations:
 *   - OpenAIRealtimeProvider  : single WebSocket to api.openai.com/v1/realtime
 *   - CustomPipelineProvider  : Silero-VAD → Whisper+LoRA → emotion2vec → Qwen → Cartesia
 */

export interface CallSessionParams {
  streamSid: string;
  callId: string;
  teamId: string;
  campaignId?: string;
  templateId?: string;
  customerId?: string;
  caller?: string;
  callType?: 'inbound' | 'outbound';
}

export interface VoiceAIProvider {
  /** Connect to the underlying AI service. */
  connect(): void;

  /** Initialize conversation context after stream start. */
  initializeConversation(params: CallSessionParams): Promise<void>;

  /** Feed a base64-encoded mulaw audio chunk from Twilio. */
  sendAudio(base64Audio: string): void;

  /** Inject a text utterance as if the user said it (for testing/transfer). */
  sendUserText(text: string): void;

  /** Gracefully shut down. */
  disconnect(): Promise<void>;
}

export type VoiceProviderType = 'openai' | 'custom';
