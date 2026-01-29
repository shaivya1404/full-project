import { CallManager } from '../services/callManager';
import { AudioNormalizer } from '../utils/audioNormalizer';

export class TwilioCallHandler {
  private callManager: CallManager;

  constructor() {
    this.callManager = CallManager.getInstance();
  }

  async handleCallStart(streamSid: string, callSid: string, from: string): Promise<void> {
    await this.callManager.startCall(streamSid, from, callSid);

    await this.callManager.setMetadata(streamSid, {
      deviceType: 'phone',
      networkQuality: 'good',
    });
  }

  async handleMediaPacket(streamSid: string, base64Audio: string): Promise<void> {
    await this.callManager.addAudioChunk(streamSid, base64Audio);

    const openAIFormat = AudioNormalizer.convertToOpenAIFormat(base64Audio);
    return;
  }

  async handleTranscription(
    streamSid: string,
    speaker: string,
    text: string,
    confidence: number,
  ): Promise<void> {
    await this.callManager.addTranscript(streamSid, speaker, text, confidence);
  }

  async handleCallEnd(streamSid: string): Promise<void> {
    const call = await this.callManager.getCall(streamSid);

    if (call) {
      const endTime = Date.now();
      const startTime = new Date(call.startTime).getTime();
      const durationSeconds = (endTime - startTime) / 1000;

      await this.callManager.addAnalytics(streamSid, {
        talkTime: durationSeconds,
        sentiment: 'neutral',
      });
    }

    await this.callManager.endCall(streamSid);
  }
}
