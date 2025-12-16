import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { OpenAIRealtimeService } from './openaiRealtime';

export class TwilioStreamService {
  private ws: WebSocket;
  private openAIService: OpenAIRealtimeService;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.openAIService = new OpenAIRealtimeService(this);
  }

  public handleConnection() {
    logger.info('New Twilio Stream connection');

    this.ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        switch (data.event) {
          case 'connected':
            logger.info('Twilio Media Stream connected');
            break;
          case 'start':
            logger.info(`Twilio Media Stream started: ${data.streamSid}`);
            this.openAIService.connect();
            break;
          case 'media':
            // Forward audio to OpenAI
            this.openAIService.sendAudio(data.media.payload);
            break;
          case 'stop':
            logger.info('Twilio Media Stream stopped');
            this.openAIService.disconnect();
            break;
        }
      } catch (error) {
        logger.error('Error handling Twilio message', error);
      }
    });

    this.ws.on('close', () => {
      logger.info('Twilio Stream connection closed');
      this.openAIService.disconnect();
    });
  }

  public sendAudio(payload: string) {
    if (this.ws.readyState === WebSocket.OPEN) {
      // Send audio back to Twilio
      const message = {
        event: 'media',
        media: {
          payload: payload,
        },
      };
      this.ws.send(JSON.stringify(message));
    }
  }
}
