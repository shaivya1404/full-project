import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { TwilioStreamService } from './twilioStream';

export class OpenAIRealtimeService {
  private ws: WebSocket | null = null;
  private twilioService: TwilioStreamService;
  private isConnected: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 1000;

  constructor(twilioService: TwilioStreamService) {
    this.twilioService = twilioService;
  }

  public connect() {
    if (this.isConnected) return;

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
          if (event.type === 'response.audio.delta' && event.delta) {
            this.twilioService.sendAudio(event.delta);
          }
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
        this.attemptReconnect();
      });
    } catch (error) {
      logger.error('Failed to connect to OpenAI', error);
      this.attemptReconnect();
    }
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
