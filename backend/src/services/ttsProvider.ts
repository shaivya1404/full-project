import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface TtsMeta {
  language?: string;
  voice_id?: string;
  speed?: number;
  mos_score?: number;
  model?: string;
  version?: string;
  char_count?: number;
}

export interface TtsResult {
  audioBase64: string;
  audioUrl?: string;
  duration: number;
  status: 'success' | 'error';
  meta: TtsMeta;
}

export interface TtsVoice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  status: string;
}

export interface TtsHealthResult {
  status: string;
  provider: string;
  models?: Array<{ type: string; name: string; version: string; status: string }>;
  device?: string;
}

const OPENAI_TTS_VOICES: TtsVoice[] = [
  { id: 'alloy', name: 'Alloy', language: 'multi', gender: 'neutral', status: 'ready' },
  { id: 'echo', name: 'Echo', language: 'multi', gender: 'male', status: 'ready' },
  { id: 'fable', name: 'Fable', language: 'multi', gender: 'male', status: 'ready' },
  { id: 'onyx', name: 'Onyx', language: 'multi', gender: 'male', status: 'ready' },
  { id: 'nova', name: 'Nova', language: 'multi', gender: 'female', status: 'ready' },
  { id: 'shimmer', name: 'Shimmer', language: 'multi', gender: 'female', status: 'ready' },
];

class TtsProvider {
  private provider: 'custom' | 'openai';
  private customUrl: string;
  private defaultVoice: string;

  constructor() {
    this.provider = config.TTS_PROVIDER;
    this.customUrl = config.TTS_SERVICE_URL;
    this.defaultVoice = config.TTS_VOICE;
    logger.info(`TTS Provider initialized: ${this.provider}`);
  }

  async synthesize(
    text: string,
    language: string,
    voiceId?: string,
    speed?: number,
    emotion?: string
  ): Promise<TtsResult> {
    if (this.provider === 'custom') {
      return this.synthesizeCustom(text, language, voiceId, speed, emotion);
    }
    return this.synthesizeOpenAI(text, language, voiceId, speed);
  }

  private async synthesizeCustom(
    text: string,
    language: string,
    voiceId?: string,
    speed?: number,
    emotion?: string
  ): Promise<TtsResult> {
    const response = await axios.post(
      `${this.customUrl}/ml/tts/predict`,
      {
        text,
        language,
        voice_id: voiceId || this.defaultVoice,
        speed: speed || 1.0,
        emotion: emotion || null,
        speaker_wav: null,
      },
      { timeout: 30000 }
    );

    const data = response.data;
    return {
      audioBase64: data.audio_base64,
      audioUrl: data.audio_url ? `${this.customUrl}${data.audio_url}` : undefined,
      duration: data.duration,
      status: data.status || 'success',
      meta: data.meta || {},
    };
  }

  private async synthesizeOpenAI(
    text: string,
    language: string,
    voiceId?: string,
    speed?: number
  ): Promise<TtsResult> {
    const voice = voiceId || 'shimmer';
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        input: text,
        voice,
        speed: speed || 1.0,
        response_format: 'wav',
      },
      {
        headers: {
          Authorization: `Bearer ${config.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    const audioBuffer = Buffer.from(response.data);
    const audioBase64 = audioBuffer.toString('base64');

    // Estimate duration from WAV: (fileSize - 44 header) / (sampleRate * channels * bytesPerSample)
    const estimatedDuration = Math.max(0, (audioBuffer.length - 44) / (24000 * 1 * 2));

    return {
      audioBase64,
      duration: estimatedDuration,
      status: 'success',
      meta: {
        language,
        voice_id: voice,
        speed: speed || 1.0,
        model: 'tts-1',
        char_count: text.length,
      },
    };
  }

  async getVoices(): Promise<TtsVoice[]> {
    if (this.provider === 'openai') {
      return OPENAI_TTS_VOICES;
    }

    // Custom provider — return a default list (custom ML service doesn't have a voices endpoint)
    return [
      { id: 'default', name: 'Default', language: 'multi', status: 'ready' },
    ];
  }

  async healthCheck(): Promise<TtsHealthResult> {
    if (this.provider === 'custom') {
      try {
        const response = await axios.get(`${this.customUrl}/ml/tts/health`, { timeout: 5000 });
        return { ...response.data, provider: 'custom' };
      } catch {
        return { status: 'unhealthy', provider: 'custom' };
      }
    }

    try {
      await axios.get('https://api.openai.com/v1/models/tts-1', {
        headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
        timeout: 5000,
      });
      return {
        status: 'healthy',
        provider: 'openai',
        models: [{ type: 'tts', name: 'tts-1', version: 'v1', status: 'ready' }],
      };
    } catch {
      return { status: 'unhealthy', provider: 'openai' };
    }
  }

  getProvider(): string {
    return this.provider;
  }
}

export const ttsProvider = new TtsProvider();
