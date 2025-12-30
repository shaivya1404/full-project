import { Call } from '@prisma/client';
import { CallRepository } from '../db/repositories/callRepository';
import { StorageService } from './storageService';
import { AnalyticsService } from './analyticsService';
import { AudioNormalizer } from '../utils/audioNormalizer';
import { logger } from '../utils/logger';

export interface CallSession {
  call: Call;
  audioChunks: Buffer[];
}

export class CallManager {
  private repository: CallRepository;
  private storage: StorageService;
  private analyticsService: AnalyticsService;
  private activeCalls: Map<string, CallSession>;

  constructor() {
    this.repository = new CallRepository();
    this.storage = new StorageService();
    this.analyticsService = new AnalyticsService();
    this.activeCalls = new Map();
  }

  async startCall(streamSid: string, caller: string, callSid?: string): Promise<Call> {
    logger.info(`Starting call for streamSid: ${streamSid}`);

    const call = await this.repository.createCall({
      streamSid,
      callSid,
      caller,
    });

    this.activeCalls.set(streamSid, {
      call,
      audioChunks: [],
    });

    return call;
  }

  async updateCall(streamSid: string, callSid?: string, agent?: string): Promise<void> {
    const session = this.activeCalls.get(streamSid);
    if (!session) {
      logger.warn(`No active call session found for streamSid: ${streamSid}`);
      return;
    }

    await this.repository.updateCall(session.call.id, {
      callSid,
      agent,
    });

    session.call = (await this.repository.getCallById(session.call.id))!;
  }

  async addAudioChunk(streamSid: string, base64Audio: string): Promise<void> {
    const session = this.activeCalls.get(streamSid);
    if (!session) {
      logger.warn(`No active call session found for streamSid: ${streamSid}`);
      return;
    }

    const pcmBuffer = AudioNormalizer.convertToStorageFormat(base64Audio);
    session.audioChunks.push(pcmBuffer);
  }

  async addTranscript(
    streamSid: string,
    speaker: string,
    text: string,
    confidence?: number,
    startTime?: number,
    endTime?: number,
  ): Promise<void> {
    const session = this.activeCalls.get(streamSid);
    if (!session) {
      logger.warn(`No active call session found for streamSid: ${streamSid}`);
      return;
    }

    await this.repository.createTranscript({
      callId: session.call.id,
      speaker,
      text,
      confidence,
      startTime,
      endTime,
    });

    logger.info(`Transcript added for call ${session.call.id}`);
  }

  async addAnalytics(
    streamSid: string,
    analytics: {
      sentiment?: string;
      sentimentScore?: number;
      talkTime?: number;
      silenceTime?: number;
      interruptions?: number;
      averageLatency?: number;
      metrics?: Record<string, unknown>;
    },
  ): Promise<void> {
    const session = this.activeCalls.get(streamSid);
    if (!session) {
      logger.warn(`No active call session found for streamSid: ${streamSid}`);
      return;
    }

    await this.repository.createAnalytics({
      callId: session.call.id,
      sentiment: analytics.sentiment,
      sentimentScore: analytics.sentimentScore,
      talkTime: analytics.talkTime,
      silenceTime: analytics.silenceTime,
      interruptions: analytics.interruptions,
      averageLatency: analytics.averageLatency,
      metrics: analytics.metrics ? JSON.stringify(analytics.metrics) : undefined,
    });

    logger.info(`Analytics snapshot added for call ${session.call.id}`);
  }

  async setMetadata(
    streamSid: string,
    metadata: {
      language?: string;
      region?: string;
      deviceType?: string;
      networkQuality?: string;
      customData?: Record<string, unknown>;
    },
  ): Promise<void> {
    const session = this.activeCalls.get(streamSid);
    if (!session) {
      logger.warn(`No active call session found for streamSid: ${streamSid}`);
      return;
    }

    await this.repository.createOrUpdateMetadata({
      callId: session.call.id,
      language: metadata.language,
      region: metadata.region,
      deviceType: metadata.deviceType,
      networkQuality: metadata.networkQuality,
      customData: metadata.customData ? JSON.stringify(metadata.customData) : undefined,
    });

    logger.info(`Metadata updated for call ${session.call.id}`);
  }

  async endCall(streamSid: string): Promise<void> {
    const session = this.activeCalls.get(streamSid);
    if (!session) {
      logger.warn(`No active call session found for streamSid: ${streamSid}`);
      return;
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.call.startTime.getTime()) / 1000);

    await this.repository.updateCall(session.call.id, {
      endTime,
      duration,
      status: 'completed',
    });

    if (session.audioChunks.length > 0) {
      await this.saveRecording(streamSid, session);
    }

    // Analyze transcripts at the end of the call for advanced analytics
    try {
      const callWithDetails = await this.repository.getCallWithDetails(session.call.id);
      if (callWithDetails && callWithDetails.transcripts.length > 0) {
        await this.analyticsService.analyzeTranscripts(session.call.id, callWithDetails.transcripts);
      }
    } catch (error) {
      logger.error(`Failed to analyze transcripts for call ${session.call.id}`, error);
    }

    this.activeCalls.delete(streamSid);
    logger.info(`Call ended for streamSid: ${streamSid}, duration: ${duration}s`);
  }

  private async saveRecording(streamSid: string, session: CallSession): Promise<void> {
    try {
      const combinedAudio = Buffer.concat(session.audioChunks);

      const result = await this.storage.saveRecording({
        streamSid,
        format: 'wav',
        audioData: combinedAudio,
      });

      await this.repository.createRecording({
        callId: session.call.id,
        filePath: result.filePath,
        format: 'wav',
        codec: 'pcm',
        sampleRate: 16000,
        channels: 1,
        duration: result.duration,
        sizeBytes: result.sizeBytes,
      });

      logger.info(`Recording saved for call ${session.call.id}: ${result.filePath}`);
    } catch (error) {
      logger.error(`Failed to save recording for call ${session.call.id}`, error);
    }
  }

  async getCall(streamSid: string): Promise<Call | null> {
    return this.repository.getCallByStreamSid(streamSid);
  }

  async getCallById(id: string): Promise<Call | null> {
    return this.repository.getCallById(id);
  }

  async getAllCalls(limit?: number, offset?: number): Promise<Call[]> {
    return this.repository.getAllCalls(limit, offset);
  }

  isCallActive(streamSid: string): boolean {
    return this.activeCalls.has(streamSid);
  }
}
