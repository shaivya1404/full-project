import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface SttTimestamp {
  start: number;
  end: number;
  word: string;
}

export interface SttMeta {
  duration_seconds?: number;
  quality_score?: number;
  language_detected?: string;
  model_name?: string;
  audio_samples?: number;
}

export interface SttResult {
  text: string;
  language: string;
  confidence: number;
  timestamps: SttTimestamp[];
  meta: SttMeta;
  modelUsed: string;
  status: 'success' | 'error';
}

export interface SttHealthResult {
  status: string;
  provider: string;
  models?: Array<{ type: string; name: string; version: string; status: string }>;
  device?: string;
}

class SttProvider {
  private provider: 'custom' | 'openai';
  private customUrl: string;

  constructor() {
    this.provider = config.STT_PROVIDER;
    this.customUrl = config.STT_SERVICE_URL;
    logger.info(`STT Provider initialized: ${this.provider}`);
  }

  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    languageHint?: string
  ): Promise<SttResult> {
    if (this.provider === 'custom') {
      return this.transcribeCustom(audioBuffer, filename, mimeType, languageHint);
    }
    return this.transcribeOpenAI(audioBuffer, filename, mimeType, languageHint);
  }

  private async transcribeCustom(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    languageHint?: string
  ): Promise<SttResult> {
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename, contentType: mimeType });
    if (languageHint) {
      formData.append('language_hint', languageHint);
    }

    const response = await axios.post(
      `${this.customUrl}/ml/stt/transcribe`,
      formData,
      {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 60000,
      }
    );

    return {
      text: response.data.text,
      language: response.data.language,
      confidence: response.data.confidence,
      timestamps: response.data.timestamps || [],
      meta: response.data.meta || {},
      modelUsed: response.data.modelUsed || 'custom_whisper',
      status: response.data.status || 'success',
    };
  }

  private async transcribeOpenAI(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    languageHint?: string
  ): Promise<SttResult> {
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename, contentType: mimeType });
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    if (languageHint) {
      formData.append('language', languageHint);
    }

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${config.OPENAI_API_KEY}`,
        },
        maxBodyLength: Infinity,
        timeout: 60000,
      }
    );

    const data = response.data;
    const timestamps: SttTimestamp[] = (data.words || []).map((w: any) => ({
      start: w.start,
      end: w.end,
      word: w.word,
    }));

    return {
      text: data.text,
      language: data.language || languageHint || 'en',
      confidence: 0.95, // OpenAI doesn't return confidence per-request
      timestamps,
      meta: {
        duration_seconds: data.duration,
        model_name: 'whisper-1',
        language_detected: data.language,
      },
      modelUsed: 'openai:whisper-1',
      status: 'success',
    };
  }

  async healthCheck(): Promise<SttHealthResult> {
    if (this.provider === 'custom') {
      try {
        const response = await axios.get(`${this.customUrl}/ml/stt/health`, { timeout: 5000 });
        return { ...response.data, provider: 'custom' };
      } catch (error) {
        return { status: 'unhealthy', provider: 'custom' };
      }
    }

    // OpenAI health check — just verify the API key works
    try {
      await axios.get('https://api.openai.com/v1/models/whisper-1', {
        headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
        timeout: 5000,
      });
      return {
        status: 'healthy',
        provider: 'openai',
        models: [{ type: 'stt', name: 'whisper-1', version: 'v1', status: 'ready' }],
      };
    } catch {
      return { status: 'unhealthy', provider: 'openai' };
    }
  }

  getProvider(): string {
    return this.provider;
  }
}

export const sttProvider = new SttProvider();
