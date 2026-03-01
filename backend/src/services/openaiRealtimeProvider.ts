/**
 * OpenAI Realtime API provider.
 * Thin adapter that wraps the existing OpenAIRealtimeService.
 */
import { VoiceAIProvider, CallSessionParams } from './voiceAIProvider';
import { OpenAIRealtimeService } from './openaiRealtime';
import { TwilioStreamService } from './twilioStream';

export class OpenAIRealtimeProvider implements VoiceAIProvider {
  private service: OpenAIRealtimeService;

  constructor(twilioService: TwilioStreamService) {
    this.service = new OpenAIRealtimeService(twilioService);
  }

  connect() {
    this.service.connect();
  }

  async initializeConversation(params: CallSessionParams) {
    await this.service.initializeConversation(
      params.streamSid,
      params.callId,
      params.teamId,
      params.campaignId,
      params.templateId,
      params.customerId,
    );
  }

  sendAudio(base64Audio: string) {
    this.service.sendAudio(base64Audio);
  }

  sendUserText(text: string) {
    this.service.sendUserText(text);
  }

  async disconnect() {
    await this.service.disconnect();
  }

  /** Expose the underlying service for legacy callManager usage. */
  getUnderlyingService() {
    return this.service;
  }
}
