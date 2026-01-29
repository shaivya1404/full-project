import { Analytics, Call, CallMetadata, CallQueue, Prisma, PrismaClient, Transcript } from '@prisma/client';
import { getPrismaClient } from '../db/client';
import { logger } from '../utils/logger';

export interface LiveCallFilters {
  teamId?: string;
  status?: string[];
  limit?: number;
  offset?: number;
}

export interface LiveCallSummary {
  id: string;
  streamSid: string;
  callSid?: string | null;
  caller: string;
  agent?: string | null;
  status: string;
  startTime: Date;
  endTime?: Date | null;
  durationSeconds: number | null;
  teamId?: string | null;
  queueStatus?: string | null;
  waitTimeSeconds?: number | null;
  sentimentScore?: number | null;
  sentimentLabel?: string | null;
  lastTranscript?: string | null;
  metadata?: {
    language?: string | null;
    region?: string | null;
    deviceType?: string | null;
    networkQuality?: string | null;
  } | null;
}

export interface LiveCallDetail extends LiveCallSummary {
  transcripts: LiveCallTranscriptLine[];
  analytics: LiveCallAnalyticsSnapshot[];
  queue?: {
    id: string;
    status: string;
    priority: number;
    assignedAgentId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

export interface LiveCallAnalyticsSnapshot {
  id: string;
  sentiment?: string | null;
  sentimentScore?: number | null;
  talkTime?: number | null;
  silenceTime?: number | null;
  interruptions?: number | null;
  averageLatency?: number | null;
  snapshotTime: Date;
}

export interface LiveCallMetrics {
  callId: string;
  durationSeconds: number | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  averageLatency: number | null;
  talkTime: number | null;
  silenceTime: number | null;
  interruptions: number | null;
  lastUpdatedAt: Date | null;
}

export interface LiveCallTranscriptLine {
  id: string;
  speaker: string;
  text: string;
  confidence?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  timestamp: Date;
}

export interface LiveCallListResult {
  items: LiveCallSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const DEFAULT_LIVE_STATUSES = ['active', 'in_progress', 'queued', 'transferring', 'initiated'];

type CallWithRelations = Call & {
  analytics: Analytics[];
  transcripts: Transcript[];
  metadata: CallMetadata | null;
  callQueue: CallQueue | null;
};

export class LiveCallService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async listLiveCalls(filters: LiveCallFilters = {}): Promise<LiveCallListResult> {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const statuses = (filters.status?.length ? filters.status : DEFAULT_LIVE_STATUSES).map((status) =>
      status.trim().toLowerCase(),
    );

    const where: Prisma.CallWhereInput = {
      status: { in: statuses },
    };

    if (filters.teamId) {
      where.teamId = filters.teamId;
    }

    try {
      const [calls, total] = await Promise.all([
        this.prisma.call.findMany({
          where,
          include: {
            analytics: {
              orderBy: { snapshotTime: 'desc' },
              take: 1,
            },
            transcripts: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            metadata: true,
            callQueue: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.call.count({ where }),
      ]);

      return {
        items: calls.map((call) => this.formatSummary(call)),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      logger.error('Error listing live calls', error);
      throw error;
    }
  }

  async getLiveCallById(callId: string): Promise<LiveCallDetail | null> {
    try {
      const call = await this.prisma.call.findUnique({
        where: { id: callId },
        include: {
          analytics: {
            orderBy: { snapshotTime: 'asc' },
          },
          transcripts: {
            orderBy: { createdAt: 'asc' },
          },
          metadata: true,
          callQueue: true,
        },
      });

      if (!call) {
        return null;
      }

      const summary = this.formatSummary(call);

      return {
        ...summary,
        transcripts: call.transcripts.map((t) => ({
          id: t.id,
          speaker: t.speaker,
          text: t.text,
          confidence: t.confidence,
          startTime: t.startTime,
          endTime: t.endTime,
          timestamp: t.createdAt,
        })),
        analytics: call.analytics.map((analytics) => ({
          id: analytics.id,
          sentiment: analytics.sentiment,
          sentimentScore: analytics.sentimentScore,
          talkTime: analytics.talkTime,
          silenceTime: analytics.silenceTime,
          interruptions: analytics.interruptions,
          averageLatency: analytics.averageLatency,
          snapshotTime: analytics.snapshotTime,
        })),
        queue: call.callQueue
          ? {
              id: call.callQueue.id,
              status: call.callQueue.status,
              priority: call.callQueue.priority,
              assignedAgentId: call.callQueue.assignedAgentId,
              createdAt: call.callQueue.createdAt,
              updatedAt: call.callQueue.updatedAt,
            }
          : null,
      };
    } catch (error) {
      logger.error(`Error fetching live call ${callId}`, error);
      throw error;
    }
  }

  async getLiveCallMetrics(callId: string): Promise<LiveCallMetrics | null> {
    try {
      const call = await this.prisma.call.findUnique({
        where: { id: callId },
        include: {
          analytics: true,
        },
      });

      if (!call) {
        return null;
      }

      const { analytics } = call;
      const sentimentEntries = analytics.filter((entry) => typeof entry.sentimentScore === 'number');
      const latencyEntries = analytics.filter((entry) => typeof entry.averageLatency === 'number');
      const talkTimeEntries = analytics.filter((entry) => typeof entry.talkTime === 'number');
      const silenceTimeEntries = analytics.filter((entry) => typeof entry.silenceTime === 'number');
      const interruptionEntries = analytics.filter((entry) => typeof entry.interruptions === 'number');

      const average = (values: number[]): number | null => {
        if (!values.length) {
          return null;
        }
        return values.reduce((sum, value) => sum + value, 0) / values.length;
      };

      const durationSeconds = this.resolveDuration(call);

      return {
        callId,
        durationSeconds,
        sentimentScore: average(sentimentEntries.map((entry) => entry.sentimentScore || 0)),
        sentimentLabel: sentimentEntries.length ? sentimentEntries[sentimentEntries.length - 1].sentiment || null : null,
        averageLatency: average(latencyEntries.map((entry) => entry.averageLatency || 0)),
        talkTime: average(talkTimeEntries.map((entry) => entry.talkTime || 0)),
        silenceTime: average(silenceTimeEntries.map((entry) => entry.silenceTime || 0)),
        interruptions: average(interruptionEntries.map((entry) => entry.interruptions || 0)),
        lastUpdatedAt: analytics.length ? analytics[analytics.length - 1].snapshotTime : null,
      };
    } catch (error) {
      logger.error(`Error fetching metrics for live call ${callId}`, error);
      throw error;
    }
  }

  async getLiveCallTranscript(callId: string): Promise<LiveCallTranscriptLine[] | null> {
    try {
      const transcripts = await this.prisma.transcript.findMany({
        where: { callId },
        orderBy: { createdAt: 'asc' },
      });

      if (!transcripts.length) {
        return null;
      }

      return transcripts.map((transcript) => ({
        id: transcript.id,
        speaker: transcript.speaker,
        text: transcript.text,
        confidence: transcript.confidence,
        startTime: transcript.startTime,
        endTime: transcript.endTime,
        timestamp: transcript.createdAt,
      }));
    } catch (error) {
      logger.error(`Error fetching transcript for live call ${callId}`, error);
      throw error;
    }
  }

  private formatSummary(call: CallWithRelations): LiveCallSummary {
    const latestAnalytics = call.analytics[0];
    const latestTranscript = call.transcripts[0];

    return {
      id: call.id,
      streamSid: call.streamSid,
      callSid: call.callSid,
      caller: call.caller,
      agent: call.agent,
      status: call.status,
      startTime: call.startTime,
      endTime: call.endTime,
      durationSeconds: this.resolveDuration(call),
      teamId: call.teamId,
      queueStatus: call.callQueue?.status,
      waitTimeSeconds: call.callQueue?.waitTime ?? null,
      sentimentScore: latestAnalytics?.sentimentScore ?? null,
      sentimentLabel: latestAnalytics?.sentiment ?? null,
      lastTranscript: latestTranscript?.text ?? null,
      metadata: call.metadata
        ? {
            language: call.metadata.language,
            region: call.metadata.region,
            deviceType: call.metadata.deviceType,
            networkQuality: call.metadata.networkQuality,
          }
        : null,
    };
  }

  private resolveDuration(call: Call): number | null {
    if (typeof call.duration === 'number') {
      return call.duration;
    }

    const start = call.startTime ? new Date(call.startTime) : null;
    const end = call.endTime ? new Date(call.endTime) : new Date();

    if (!start) {
      return null;
    }

    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  }
}
