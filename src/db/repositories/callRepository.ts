import { PrismaClient, Call, Recording, Transcript, Analytics, CallMetadata, KnowledgeBaseSource } from '@prisma/client';
import { getPrismaClient } from '../client';
import { logger } from '../../utils/logger';

export interface CreateCallInput {
  streamSid: string;
  callSid?: string;
  caller: string;
  agent?: string;
  teamId?: string;
}

export interface UpdateCallInput {
  callSid?: string;
  agent?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  status?: string;
  notes?: string;
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

  async getRecentRecordings(limit: number = 5): Promise<Recording[]> {
    return this.prisma.recording.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getRecordingById(recordingId: string): Promise<Recording | null> {
    return this.prisma.recording.findUnique({
      where: { id: recordingId },
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

  async searchCalls(
    limit: number = 10,
    offset: number = 0,
    filters?: {
      caller?: string;
      agent?: string;
      sentiment?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<{ calls: Call[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters?.caller) {
      where.caller = { contains: filters.caller, mode: 'insensitive' };
    }
    if (filters?.agent) {
      where.agent = { contains: filters.agent, mode: 'insensitive' };
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters?.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    if (filters?.sentiment) {
      where.analytics = {
        some: {
          sentiment: { equals: filters.sentiment, mode: 'insensitive' },
        },
      };
    }

    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          recordings: true,
          transcripts: true,
          analytics: true,
          metadata: true,
        },
      }),
      this.prisma.call.count({ where }),
    ]);

    return { calls, total };
  }

  async getCallWithDetails(id: string): Promise<
    | (Call & {
      recordings: Recording[];
      transcripts: Transcript[];
      analytics: Analytics[];
      metadata: CallMetadata | null;
    })
    | null
  > {
    return this.prisma.call.findUnique({
      where: { id },
      include: {
        recordings: true,
        transcripts: {
          orderBy: { createdAt: 'asc' },
        },
        analytics: {
          orderBy: { snapshotTime: 'asc' },
        },
        metadata: true,
      },
    });
  }


  async getAnalyticsAggregate(filters?: { startDate?: Date; endDate?: Date }): Promise<{
    totalCalls: number;
    averageDuration: number | null;
    callsByStatus: Record<string, number>;
    sentimentBreakdown: Record<string, number>;
  }> {
    const where: Record<string, unknown> = {};

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters?.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const calls = await this.prisma.call.findMany({
      where,
      include: {
        analytics: true,
      },
    });

    const totalCalls = calls.length;
    const validDurations = calls
      .filter((c) => c.duration !== null && c.duration !== undefined)
      .map((c) => c.duration || 0);
    const averageDuration =
      validDurations.length > 0
        ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
        : null;

    const callsByStatus: Record<string, number> = {};
    calls.forEach((call) => {
      callsByStatus[call.status] = (callsByStatus[call.status] || 0) + 1;
    });

    const sentimentBreakdown: Record<string, number> = {};
    calls.forEach((call) => {
      call.analytics.forEach((analytics) => {
        if (analytics.sentiment) {
          sentimentBreakdown[analytics.sentiment] =
            (sentimentBreakdown[analytics.sentiment] || 0) + 1;
        }
      });
    });

    return {
      totalCalls,
      averageDuration,
      callsByStatus,
      sentimentBreakdown,
    };
  }

  async getAnalyticsTimeSeries(
    interval: 'hour' | 'day' | 'week' = 'day',
    filters?: {
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<Array<{ timestamp: Date; callCount: number; averageDuration: number | null }>> {
    const where: Record<string, unknown> = {};

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters?.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const calls = await this.prisma.call.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, Call[]> = {};
    calls.forEach((call) => {
      const date = new Date(call.createdAt);
      let key: string;

      if (interval === 'hour') {
        key = date.toISOString().slice(0, 13);
      } else if (interval === 'week') {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        key = startOfWeek.toISOString().slice(0, 10);
      } else {
        key = date.toISOString().slice(0, 10);
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(call);
    });

    const timeSeries = Object.entries(grouped).map(([key, groupCalls]) => {
      const validDurations = groupCalls
        .filter((c) => c.duration !== null && c.duration !== undefined)
        .map((c) => c.duration || 0);
      const averageDuration =
        validDurations.length > 0
          ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
          : null;

      return {
        timestamp: new Date(key),
        callCount: groupCalls.length,
        averageDuration,
      };
    });

    return timeSeries;
  }

  /**
   * Create knowledge base source record
   */
  async createKnowledgeBaseSource(data: {
    callId: string;
    knowledgeBaseId?: string;
    productId?: string;
    faqId?: string;
    relevanceScore?: number;
  }): Promise<KnowledgeBaseSource> {
    const prisma = getPrismaClient();

    return prisma.knowledgeBaseSource.create({
      data: {
        callId: data.callId,
        knowledgeBaseId: data.knowledgeBaseId,
        productId: data.productId,
        faqId: data.faqId,
        relevanceScore: data.relevanceScore,
      },
    });
  }

  /**
   * Get recent transcripts for a call
   */
  async getRecentTranscripts(callId: string, limit: number = 10): Promise<Transcript[]> {
    const prisma = getPrismaClient();

    return prisma.transcript.findMany({
      where: { callId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get FAQs by team ID
   */
  async getFaqsByTeamId(teamId: string): Promise<any[]> {
    const prisma = getPrismaClient();

    // This would need to be implemented based on your FAQ model structure
    // For now, returning empty array as placeholder
    return [];
  }

  /**
   * Create or update unanswered question
   */
  async createOrUpdateUnansweredQuestion(question: string): Promise<void> {
    const prisma = getPrismaClient();

    try {
      await prisma.unansweredQuestion.upsert({
        where: { question },
        update: {
          frequency: { increment: 1 },
          lastAsked: new Date(),
        },
        create: {
          question,
          frequency: 1,
        },
      });
    } catch (error) {
      logger.error('Error creating/updating unanswered question', error);
      throw error;
    }
  }

  /**
   * Get knowledge used for a call
   */
  async getKnowledgeUsedForCall(callId: string): Promise<any[]> {
    const prisma = getPrismaClient();

    const sources = await prisma.knowledgeBaseSource.findMany({
      where: { callId },
      include: {
        knowledgeBase: true,
        product: true,
        faq: true,
      },
      orderBy: { usedAt: 'desc' },
    });

    return sources.map(source => ({
      id: source.id,
      type: source.knowledgeBaseId ? 'knowledge' : source.productId ? 'product' : 'faq',
      title: source.knowledgeBase?.title || source.product?.name || source.faq?.question,
      content: source.knowledgeBase?.content || source.product?.description || source.faq?.answer,
      relevanceScore: source.relevanceScore,
      usedAt: source.usedAt,
      metadata: {
        category: source.knowledgeBase?.category || source.product?.category || source.faq?.category,
      },
    }));
  }

  /**
   * Get unanswered questions with pagination
   */
  async getUnansweredQuestions(limit: number = 20, offset: number = 0): Promise<{
    questions: any[];
    total: number;
  }> {
    const prisma = getPrismaClient();

    const [questions, total] = await Promise.all([
      prisma.unansweredQuestion.findMany({
        orderBy: [
          { frequency: 'desc' },
          { lastAsked: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.unansweredQuestion.count(),
    ]);

    return {
      questions,
      total,
    };
  }

  /**
   * Get knowledge analytics for a team
   */
  async getKnowledgeAnalytics(teamId: string, startDate?: string, endDate?: string): Promise<any> {
    const prisma = getPrismaClient();

    const whereClause: any = {
      call: {
        teamId,
      },
    };

    if (startDate || endDate) {
      whereClause.usedAt = {};
      if (startDate) whereClause.usedAt.gte = new Date(startDate);
      if (endDate) whereClause.usedAt.lte = new Date(endDate);
    }

    const [
      totalSources,
      knowledgeSources,
      productSources,
      faqSources,
      averageRelevance,
    ] = await Promise.all([
      prisma.knowledgeBaseSource.count({ where: whereClause }),
      prisma.knowledgeBaseSource.count({
        where: { ...whereClause, knowledgeBaseId: { not: null } }
      }),
      prisma.knowledgeBaseSource.count({
        where: { ...whereClause, productId: { not: null } }
      }),
      prisma.knowledgeBaseSource.count({
        where: { ...whereClause, faqId: { not: null } }
      }),
      prisma.knowledgeBaseSource.aggregate({
        where: whereClause,
        _avg: { relevanceScore: true },
      }),
    ]);

    return {
      totalSources,
      byType: {
        knowledge: knowledgeSources,
        product: productSources,
        faq: faqSources,
      },
      averageRelevance: averageRelevance._avg.relevanceScore || 0,
      period: {
        startDate,
        endDate,
      },
    };
  }
}
