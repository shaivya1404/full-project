import { PrismaClient, KnowledgeBase } from '@prisma/client';
import { getPrismaClient } from '../client';

export interface CreateKnowledgeBaseInput {
  title: string;
  content: string;
  teamId: string;
  category?: string;
  tags?: string[];
}

export interface UpdateKnowledgeBaseInput {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
}

export interface SearchKnowledgeBaseFilters {
  teamId?: string;
  category?: string;
  tags?: string[];
}

export class KnowledgeBaseRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  async create(data: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {
    return this.prisma.knowledgeBase.create({ 
      data: {
        ...data,
        tags: data.tags ? JSON.stringify(data.tags) : undefined
      }
    });
  }

  async findById(id: string): Promise<KnowledgeBase | null> {
    return this.prisma.knowledgeBase.findUnique({ where: { id } });
  }

  async findMany(filters?: SearchKnowledgeBaseFilters): Promise<KnowledgeBase[]> {
    const where: Record<string, unknown> = {};

    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.tags && filters.tags.length > 0) {
      where.tags = JSON.stringify(filters.tags);
    }

    return this.prisma.knowledgeBase.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }

  async search(term: string, filters?: SearchKnowledgeBaseFilters): Promise<KnowledgeBase[]> {
    const where: Record<string, unknown> = {};

    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.tags && filters.tags.length > 0) {
      where.tags = JSON.stringify(filters.tags);
    }

    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { content: { contains: term, mode: 'insensitive' } },
    ];

    return this.prisma.knowledgeBase.findMany({ where });
  }

  async update(id: string, data: UpdateKnowledgeBaseInput): Promise<KnowledgeBase> {
    const updateData: any = { ...data };
    if (data.tags) {
      updateData.tags = JSON.stringify(data.tags);
    }
    return this.prisma.knowledgeBase.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.knowledgeBase.delete({ where: { id } });
  }

  async bulkCreate(data: CreateKnowledgeBaseInput[]): Promise<KnowledgeBase[]> {
    return this.prisma.$transaction(
      data.map((item) => this.prisma.knowledgeBase.create({ 
        data: {
          ...item,
          tags: item.tags ? JSON.stringify(item.tags) : undefined
        }
      }))
    );
  }
}