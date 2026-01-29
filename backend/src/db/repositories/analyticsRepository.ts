import { PrismaClient, UnansweredQuestion, TopicAnalytics, CampaignAnalytics } from '@prisma/client';
import { getPrismaClient } from '../client';
import { logger } from '../../utils/logger';

type FAQ = any;

export interface CreateFAQInput {
  question: string;
  frequency?: number;
  topic?: string;
}

export interface CreateUnansweredQuestionInput {
  question: string;
  frequency?: number;
  lastAsked?: Date;
}

export interface CreateTopicAnalyticsInput {
  topic: string;
  callCount?: number;
  sentiment?: number;
}

export interface CreateCampaignAnalyticsInput {
  campaignId: string;
  successRate?: number;
  roi?: number;
  cost?: number;
  revenue?: number;
}

export class AnalyticsRepository {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async upsertFAQ(data: CreateFAQInput): Promise<FAQ> {
    // Some deployments/schema variations may not include an `FAQ` top-level model.
    // Guard against missing model to avoid runtime crashes when analyzing transcripts.
    const clientAny = this.prisma as any;
    if (!clientAny.fAQ) {
      logger.warn('FAQ model not present in Prisma schema; skipping upsertFAQ');
      return Promise.resolve(null as any);
    }

    const existing = await clientAny.fAQ.findUnique({
      where: { question: data.question },
    });

    if (existing) {
      return clientAny.fAQ.update({
        where: { question: data.question },
        data: {
          frequency: { increment: 1 },
          topic: data.topic || existing.topic,
        },
      });
    }

    return clientAny.fAQ.create({
      data: {
        question: data.question,
        frequency: data.frequency || 1,
        topic: data.topic,
      },
    });
  }

  async getTopFAQs(limit: number = 10): Promise<FAQ[]> {
    const clientAny = this.prisma as any;
    if (!clientAny.fAQ) {
      logger.warn('FAQ model not present in Prisma schema; getTopFAQs will return empty list');
      return [];
    }

    return clientAny.fAQ.findMany({
      take: limit,
      orderBy: { frequency: 'desc' },
    });
  }

  async upsertUnansweredQuestion(data: CreateUnansweredQuestionInput): Promise<UnansweredQuestion> {
    const existing = await this.prisma.unansweredQuestion.findUnique({
      where: { question: data.question },
    });

    if (existing) {
      return this.prisma.unansweredQuestion.update({
        where: { question: data.question },
        data: {
          frequency: { increment: 1 },
          lastAsked: data.lastAsked || new Date(),
        },
      });
    }

    return this.prisma.unansweredQuestion.create({
      data: {
        question: data.question,
        frequency: data.frequency || 1,
        lastAsked: data.lastAsked || new Date(),
      },
    });
  }

  async getTopUnansweredQuestions(limit: number = 10): Promise<UnansweredQuestion[]> {
    return this.prisma.unansweredQuestion.findMany({
      take: limit,
      orderBy: { frequency: 'desc' },
    });
  }

  async upsertTopicAnalytics(data: CreateTopicAnalyticsInput): Promise<TopicAnalytics> {
    const existing = await this.prisma.topicAnalytics.findUnique({
      where: { topic: data.topic },
    });

    if (existing) {
      // Calculate new average sentiment if provided
      let newSentiment = existing.sentiment;
      if (data.sentiment !== undefined) {
          if (existing.sentiment !== null) {
              newSentiment = (existing.sentiment * existing.callCount + data.sentiment) / (existing.callCount + 1);
          } else {
              newSentiment = data.sentiment;
          }
      }

      return this.prisma.topicAnalytics.update({
        where: { topic: data.topic },
        data: {
          callCount: { increment: 1 },
          sentiment: newSentiment,
        },
      });
    }

    return this.prisma.topicAnalytics.create({
      data: {
        topic: data.topic,
        callCount: data.callCount || 1,
        sentiment: data.sentiment,
      },
    });
  }

  async getAllTopicAnalytics(): Promise<TopicAnalytics[]> {
    return this.prisma.topicAnalytics.findMany({
      orderBy: { callCount: 'desc' },
    });
  }

  async upsertCampaignAnalytics(data: CreateCampaignAnalyticsInput): Promise<CampaignAnalytics> {
    return this.prisma.campaignAnalytics.upsert({
      where: { campaignId: data.campaignId },
      update: {
        successRate: data.successRate,
        roi: data.roi,
        cost: data.cost,
        revenue: data.revenue,
      },
      create: {
        campaignId: data.campaignId,
        successRate: data.successRate || 0,
        roi: data.roi || 0,
        cost: data.cost || 0,
        revenue: data.revenue || 0,
      },
    });
  }

  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics | null> {
    return this.prisma.campaignAnalytics.findUnique({
      where: { campaignId },
    });
  }
}
