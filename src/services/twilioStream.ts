import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { OpenAIRealtimeService } from './openaiRealtime';
import { CallManager } from './callManager';
import { AudioNormalizer } from '../utils/audioNormalizer';

export class TwilioStreamService {
  private ws: WebSocket;
  private openAIService: OpenAIRealtimeService;
  public callManager: CallManager;
  public streamSid: string | null = null;
  private audioBuffer: string[] = [];
  private isCallInitialized: boolean = false;
  private audioConversionBuffer: Buffer = Buffer.alloc(0);
  private readonly AUDIO_CHUNK_THRESHOLD = 2400; // Buffer ~100ms of 24kHz audio before conversion

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.openAIService = new OpenAIRealtimeService(this);
    this.callManager = CallManager.getInstance();
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

            this.isCallInitialized = true;
            logger.info(`Call session initialized for ${this.streamSid}. Flushing ${this.audioBuffer.length} buffered chunks.`);

            // Process buffered audio
            for (const payload of this.audioBuffer) {
              await this.callManager.addAudioChunk(this.streamSid!, payload);
            }
            this.audioBuffer = [];

            this.openAIService.connect();
            break;
          case 'media':
            // Forward audio to OpenAI
            this.openAIService.sendAudio(data.media.payload);

            // Also add to recording
            if (this.streamSid) {
              if (this.isCallInitialized) {
                await this.callManager.addAudioChunk(this.streamSid, data.media.payload);
              } else {
                // Buffer audio if session not yet initialized
                this.audioBuffer.push(data.media.payload);
              }
            }
            break;
          case 'stop':
            logger.info('Twilio Media Stream stopped');
            // Flush any remaining buffered audio
            if (this.audioConversionBuffer.length > 0) {
              try {
                const resampledBuffer = AudioNormalizer.resample(this.audioConversionBuffer, 24000, 8000);
                const mulawBuffer = AudioNormalizer.pcm16ToMulaw(resampledBuffer);
                const twilioPayload = AudioNormalizer.encodeBase64(mulawBuffer);
                
                const message = {
                  event: 'media',
                  media: {
                    payload: twilioPayload,
                    track: 'outbound',
                  },
                };
                
                this.ws.send(JSON.stringify(message));
                logger.debug('Flushed remaining audio to Twilio', {
                  bufferBytes: this.audioConversionBuffer.length,
                  convertedBytes: twilioPayload.length,
                });
              } catch (err) {
                logger.error('Error flushing audio buffer', err);
              }
              this.audioConversionBuffer = Buffer.alloc(0);
            }
            
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
      try {
        // Decode and buffer audio chunks to ensure we have enough data for proper resampling
        const incomingBuffer = AudioNormalizer.decodeBase64(payload);
        this.audioConversionBuffer = Buffer.concat([this.audioConversionBuffer, incomingBuffer]);

        // Only convert when buffer has enough data (~100ms at 24kHz = 2400 bytes)
        while (this.audioConversionBuffer.length >= this.AUDIO_CHUNK_THRESHOLD) {
          const chunk = this.audioConversionBuffer.slice(0, this.AUDIO_CHUNK_THRESHOLD);
          this.audioConversionBuffer = this.audioConversionBuffer.slice(this.AUDIO_CHUNK_THRESHOLD);

          // Convert OpenAI audio (PCM16 @ 24kHz) to Twilio format (μ-law @ 8kHz)
          const resampledBuffer = AudioNormalizer.resample(chunk, 24000, 8000);
          const mulawBuffer = AudioNormalizer.pcm16ToMulaw(resampledBuffer);
          const twilioPayload = AudioNormalizer.encodeBase64(mulawBuffer);

          const message = {
            event: 'media',
            media: {
              payload: twilioPayload,
              track: 'outbound',
            },
          };

          this.ws.send(JSON.stringify(message));
          logger.debug('Sent converted audio to Twilio', {
            chunkedBytes: chunk.length,
            convertedBytes: twilioPayload.length,
            bufferRemaining: this.audioConversionBuffer.length,
          });
        }
      } catch (err) {
        logger.error('Failed to convert and send audio to Twilio', err);
      }
    }
  }
}
