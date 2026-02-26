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
            // Extract parameters - Twilio sends callSid at data.start.callSid
            // and customParameters from <Parameter> elements
            const callSid = data.start.callSid;
            const customParameters = data.start.customParameters || {};

            // Read parameters passed from TwiML <Parameter> elements
            const teamId = customParameters.teamId || '';
            const caller = customParameters.caller || data.start.caller || 'Inbound Call';
            const passedCallSid = customParameters.callSid || callSid;
            const campaignId = customParameters.campaignId || undefined;
            const callType = customParameters.callType || 'inbound';

            logger.info(`Twilio Media Stream started: ${this.streamSid}`, {
              callSid: passedCallSid,
              teamId,
              caller,
              callType,
              campaignId,
              customParameters
            });

            // ⭐ Connect to OpenAI IMMEDIATELY (non-blocking) so the connection
            // is established in parallel with the DB/AI-agent initialization below.
            // This shaves ~1-2s off the time until the AI can greet the caller.
            logger.info('Initiating OpenAI Realtime connection...');
            this.openAIService.connect();

            // Initialize call in database with proper caller info
            // Pass campaignId so the AI uses the campaign script as context
            await this.callManager.startCall(this.streamSid!, caller, passedCallSid, teamId, campaignId);

            this.isCallInitialized = true;
            logger.info(
              `Call session initialized for ${this.streamSid}. Flushing ${this.audioBuffer.length} buffered chunks.`,
            );

            // Process buffered audio (convert to OpenAI format before storing)
            for (const payload of this.audioBuffer) {
              await this.callManager.addAudioChunk(this.streamSid!, payload);
            }
            this.audioBuffer = [];
            break;
          case 'media':
            // ⭐ CRITICAL FIX: Convert Twilio μ-law 8kHz to OpenAI PCM16 24kHz before sending
            // Twilio sends: μ-law encoded audio at 8kHz
            // OpenAI expects: PCM16 audio at 24kHz
            const convertedAudio = AudioNormalizer.convertToOpenAIFormat(data.media.payload);
            this.openAIService.sendAudio(convertedAudio);

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
                const resampledBuffer = AudioNormalizer.resample(
                  this.audioConversionBuffer,
                  24000,
                  8000,
                );
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

          case 'test_input':
            // 🧪 TEST ONLY: Allow injecting text input (simulating user speech)
            if (data.text) {
              logger.info(`Received test input text: "${data.text}"`);
              this.openAIService.sendUserText(data.text);
            }
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
    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket not open, cannot send audio');
      return;
    }

    try {
      // 1️⃣ Decode Base64 from OpenAI audio delta
      const incomingBuffer = AudioNormalizer.decodeBase64(payload);
      // logger.debug(`Received audio chunk from OpenAI: ${incomingBuffer.length} bytes`);

      // 2️⃣ Append to buffer
      this.audioConversionBuffer = Buffer.concat([this.audioConversionBuffer, incomingBuffer]);

      // 3️⃣ Process in smaller chunks (~480 bytes = 20ms at 24kHz)
      const CHUNK_SIZE_24KHZ = 480; // ~20ms of PCM16 @ 24kHz

      while (this.audioConversionBuffer.length >= CHUNK_SIZE_24KHZ) {
        const chunk = this.audioConversionBuffer.slice(0, CHUNK_SIZE_24KHZ);
        this.audioConversionBuffer = this.audioConversionBuffer.slice(CHUNK_SIZE_24KHZ);

        // 4️⃣ Resample 24kHz → 8kHz (input is already PCM16 mono)
        const resampled = AudioNormalizer.resample(chunk, 24000, 8000);
        // logger.debug(`Resampled: ${chunk.length} bytes @ 24kHz → ${resampled.length} bytes @ 8kHz`);

        // 5️⃣ Convert PCM16 → μ-law
        const mulawBuffer = AudioNormalizer.pcm16ToMulaw(resampled);

        // 6️⃣ Slice μ-law buffer into 160-byte Twilio frames (20ms @ 8kHz)
        for (let i = 0; i < mulawBuffer.length; i += 160) {
          const frame = mulawBuffer.slice(i, i + 160);
          const base64Frame = frame.toString('base64');

          const message = {
            event: 'media',
            streamSid: this.streamSid,
            media: {
              payload: base64Frame,
              track: 'outbound', // ⭐ CRITICAL: tells Twilio this is bot audio (not user audio)
            },
          };

          this.ws.send(JSON.stringify(message));
          // logger.debug(`Sent Twilio audio frame (${frame.length} bytes, track: outbound)`);
        }
      }
    } catch (err) {
      logger.error('Failed to convert and send audio to Twilio', err);
    }
  }

  // 7️⃣ Call this on response.audio.done to flush remaining buffer
  public flushAudioBuffer() {
    if (this.audioConversionBuffer.length === 0) {
      logger.debug('Audio buffer is empty, nothing to flush');
      return;
    }

    try {
      logger.info(`Flushing remaining audio buffer (${this.audioConversionBuffer.length} bytes)`);

      const chunk = this.audioConversionBuffer;
      this.audioConversionBuffer = Buffer.alloc(0);

      const resampled = AudioNormalizer.resample(chunk, 24000, 8000);
      const mulawBuffer = AudioNormalizer.pcm16ToMulaw(resampled);

      let frameCount = 0;
      for (let i = 0; i < mulawBuffer.length; i += 160) {
        const frame = mulawBuffer.slice(i, i + 160);
        const base64Frame = frame.toString('base64');

        const message = {
          event: 'media',
          streamSid: this.streamSid,
          media: { payload: base64Frame, track: 'outbound' },
        };
        this.ws.send(JSON.stringify(message));
        frameCount++;
      }

      // logger.debug(`Flushed ${frameCount} audio frames (${chunk.length} bytes total)`);
    } catch (err) {
      logger.error('Error flushing audio buffer', err);
    }
  }
}
