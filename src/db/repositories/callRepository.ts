import { PrismaClient, Call, Recording, Transcript, Analytics, CallMetadata } from '@prisma/client';
import { getPrismaClient } from '../client';

export interface CreateCallInput {
  streamSid: string;
  callSid?: string;
  caller: string;
  agent?: string;
}

export interface UpdateCallInput {
  callSid?: string;
  agent?: string;
  endTime?: Date;
  duration?: number;
  status?: string;
}

export interface CreateRecordingInput {
  callId: string;
  filePath: string;
  fileUrl?: string;
  format?: string;
  codec?: string;
  sampleRate?: number;
  channels?: number;
  duration?: number;
  sizeBytes?: number;
}

export interface CreateTranscriptInput {
  callId: string;
  speaker: string;
  text: string;
  confidence?: number;
  startTime?: number;
  endTime?: number;
}

export interface CreateAnalyticsInput {
  callId: string;
  sentiment?: string;
  sentimentScore?: number;
  talkTime?: number;
  silenceTime?: number;
  interruptions?: number;
  averageLatency?: number;
  metrics?: string;
}

export interface CreateCallMetadataInput {
  callId: string;
  language?: string;
  region?: string;
  deviceType?: string;
  networkQuality?: string;
  customData?: string;
}

export class CallRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async createCall(data: CreateCallInput): Promise<Call> {
    return this.prisma.call.create({
      data: {
        streamSid: data.streamSid,
        callSid: data.callSid,
        caller: data.caller,
        agent: data.agent,
      },
    });
  }

  async updateCall(id: string, data: UpdateCallInput): Promise<Call> {
    return this.prisma.call.update({
      where: { id },
      data,
    });
  }

  async getCallById(id: string): Promise<Call | null> {
    return this.prisma.call.findUnique({
      where: { id },
      include: {
        recordings: true,
        transcripts: true,
        analytics: true,
        metadata: true,
      },
    });
  }

  async getCallByStreamSid(streamSid: string): Promise<Call | null> {
    return this.prisma.call.findUnique({
      where: { streamSid },
      include: {
        recordings: true,
        transcripts: true,
        analytics: true,
        metadata: true,
      },
    });
  }

  async getCallByCallSid(callSid: string): Promise<Call | null> {
    return this.prisma.call.findUnique({
      where: { callSid },
      include: {
        recordings: true,
        transcripts: true,
        analytics: true,
        metadata: true,
      },
    });
  }

  async getAllCalls(limit?: number, offset?: number): Promise<Call[]> {
    return this.prisma.call.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        recordings: true,
        transcripts: true,
        analytics: true,
        metadata: true,
      },
    });
  }

  async createRecording(data: CreateRecordingInput): Promise<Recording> {
    return this.prisma.recording.create({
      data: {
        callId: data.callId,
        filePath: data.filePath,
        fileUrl: data.fileUrl,
        format: data.format || 'wav',
        codec: data.codec || 'pcm',
        sampleRate: data.sampleRate || 8000,
        channels: data.channels || 1,
        duration: data.duration,
        sizeBytes: data.sizeBytes,
      },
    });
  }

  async getRecordingsByCallId(callId: string): Promise<Recording[]> {
    return this.prisma.recording.findMany({
      where: { callId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTranscript(data: CreateTranscriptInput): Promise<Transcript> {
    return this.prisma.transcript.create({
      data: {
        callId: data.callId,
        speaker: data.speaker,
        text: data.text,
        confidence: data.confidence,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });
  }

  async getTranscriptsByCallId(callId: string): Promise<Transcript[]> {
    return this.prisma.transcript.findMany({
      where: { callId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createAnalytics(data: CreateAnalyticsInput): Promise<Analytics> {
    return this.prisma.analytics.create({
      data: {
        callId: data.callId,
        sentiment: data.sentiment,
        sentimentScore: data.sentimentScore,
        talkTime: data.talkTime,
        silenceTime: data.silenceTime,
        interruptions: data.interruptions,
        averageLatency: data.averageLatency,
        metrics: data.metrics,
      },
    });
  }

  async getAnalyticsByCallId(callId: string): Promise<Analytics[]> {
    return this.prisma.analytics.findMany({
      where: { callId },
      orderBy: { snapshotTime: 'asc' },
    });
  }

  async createOrUpdateMetadata(data: CreateCallMetadataInput): Promise<CallMetadata> {
    const existing = await this.prisma.callMetadata.findUnique({
      where: { callId: data.callId },
    });

    if (existing) {
      return this.prisma.callMetadata.update({
        where: { callId: data.callId },
        data: {
          language: data.language,
          region: data.region,
          deviceType: data.deviceType,
          networkQuality: data.networkQuality,
          customData: data.customData,
        },
      });
    }

    return this.prisma.callMetadata.create({
      data: {
        callId: data.callId,
        language: data.language,
        region: data.region,
        deviceType: data.deviceType,
        networkQuality: data.networkQuality,
        customData: data.customData,
      },
    });
  }

  async getMetadataByCallId(callId: string): Promise<CallMetadata | null> {
    return this.prisma.callMetadata.findUnique({
      where: { callId },
    });
  }

  async deleteCall(id: string): Promise<void> {
    await this.prisma.call.delete({
      where: { id },
    });
  }
}
