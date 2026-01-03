import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { OpenAIRealtimeService } from './openaiRealtime';
import { CallManager } from './callManager';

export class TwilioStreamService {
  private ws: WebSocket;
  private openAIService: OpenAIRealtimeService;
  private callManager: CallManager;
  private streamSid: string | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.openAIService = new OpenAIRealtimeService(this);
    this.callManager = new CallManager();
    this.callManager.setOpenAIService(this.openAIService);
  }

  public handleConnection() {
    logger.info('New Twilio Stream connection');

    this.ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        switch (data.event) {
          case 'connected':
            logger.info('Twilio Media Stream connected');
            break;
          case 'start':
            this.streamSid = data.start.streamSid;
            const callSid = data.start.callSid;
            const customParameters = data.start.customParameters || {};
            const teamId = customParameters.teamId || 'default-team';

            logger.info(`Twilio Media Stream started: ${this.streamSid}`, { callSid, teamId });

            // Initialize call in database
            await this.callManager.startCall(
              this.streamSid!,
              'Inbound Call',
              callSid,
              teamId
            );

            this.openAIService.connect();
            break;
          case 'media':
            // Forward audio to OpenAI
            this.openAIService.sendAudio(data.media.payload);
            // Also add to recording
            if (this.streamSid) {
              await this.callManager.addAudioChunk(this.streamSid, data.media.payload);
            }
            break;
          case 'stop':
            logger.info('Twilio Media Stream stopped');
            if (this.streamSid) {
              await this.callManager.endCall(this.streamSid);
            }
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
