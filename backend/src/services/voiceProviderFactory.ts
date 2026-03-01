/**
 * Factory — returns the correct VoiceAIProvider based on VOICE_PROVIDER env var.
 *
 * VOICE_PROVIDER=openai   → OpenAI Realtime API  (default)
 * VOICE_PROVIDER=custom   → Silero-VAD → Whisper → emotion2vec → Qwen → Cartesia
 */
import { VoiceAIProvider, VoiceProviderType } from './voiceAIProvider';
import { OpenAIRealtimeProvider } from './openaiRealtimeProvider';
import { CustomPipelineProvider } from './customPipelineProvider';
import { TwilioStreamService } from './twilioStream';
import { logger } from '../utils/logger';

export function createVoiceProvider(twilioService: TwilioStreamService): VoiceAIProvider {
  const providerType = (process.env.VOICE_PROVIDER || 'openai').toLowerCase() as VoiceProviderType;

  if (providerType === 'custom') {
    logger.info('[VoiceProviderFactory] Using Custom Pipeline (Whisper → Qwen → Cartesia)');
    return new CustomPipelineProvider(twilioService);
  }

  logger.info('[VoiceProviderFactory] Using OpenAI Realtime API');
  return new OpenAIRealtimeProvider(twilioService);
}

export function getActiveProviderType(): VoiceProviderType {
  return (process.env.VOICE_PROVIDER || 'openai').toLowerCase() as VoiceProviderType;
}
