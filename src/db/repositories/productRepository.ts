import { PrismaClient, Product, ProductFAQ } from '@prisma/client';
import { getPrismaClient } from '../client';

export interface CreateProductInput {
  name: string;
  description: string;
  teamId: string;
  category?: string;
  price?: number;
  details?: Record<string, unknown>;
  faqs?: Record<string, unknown>[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  details?: Record<string, unknown>;
  faqs?: Record<string, unknown>[];
}

export interface SearchProductFilters {
  teamId?: string;
  category?: string;
  name?: string;
}

export interface CreateProductFAQInput {
  question: string;
  answer: string;
  teamId: string;
  category?: string;
  relevantProductId?: string;
}

export interface UpdateProductFAQInput {
  question?: string;
  answer?: string;
  category?: string;
  views?: number;
  helpfulCount?: number;
}

export interface SearchFAQFilters {
  teamId?: string;
  category?: string;
  question?: string;
}

export class ProductRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  // Product operations
  async createProduct(data: CreateProductInput): Promise<Product> {
    return this.prisma.product.create({
      data: {
        ...data,
        details: data.details ? JSON.stringify(data.details) : undefined,
        faqs: data.faqs ? JSON.stringify(data.faqs) : undefined,
      },
    });
  }

  async findProductById(id: string): Promise<(Product & { productFaqs?: ProductFAQ[] }) | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: { productFaqs: true },
    });
  }

  async findManyProducts(filters?: SearchProductFilters): Promise<Product[]> {
    const where: Record<string, unknown> = {};

    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters?.category) {
      where.category = filters.category;
    }

    return this.prisma.product.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }

  async searchProducts(term: string, filters?: SearchProductFilters): Promise<Product[]> {
    const where: Record<string, unknown> = {};

    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }

    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
    ];

    return this.prisma.product.findMany({ where });
  }

  async updateProduct(id: string, data: UpdateProductInput): Promise<Product> {
    const updateData: Record<string, unknown> = { ...data };
    
    if (data.details) {
      updateData.details = JSON.stringify(data.details);
    }
    if (data.faqs) {
      updateData.faqs = JSON.stringify(data.faqs);
    }

    return this.prisma.product.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }

  async bulkCreateProducts(data: CreateProductInput[]): Promise<Product[]> {
    return this.prisma.$transaction(
      data.map((item) => 
        this.prisma.product.create({
          data: {
            ...item,
            details: item.details ? JSON.stringify(item.details) : undefined,
            faqs: item.faqs ? JSON.stringify(item.faqs) : undefined,
          },
        })
      )
    );
  }

  // Product FAQ operations
  async createProductFAQ(data: CreateProductFAQInput): Promise<ProductFAQ> {
    return this.prisma.productFAQ.create({ data });
  }

  async findProductFAQById(id: string): Promise<ProductFAQ | null> {
    return this.prisma.productFAQ.findUnique({ where: { id } });
  }

  async findProductFAQs(filters?: SearchFAQFilters): Promise<ProductFAQ[]> {
    const where: Record<string, unknown> = {};

    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters?.category) {
      where.category = filters.category;
    }

    return this.prisma.productFAQ.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }

  async searchProductFAQs(term: string, filters?: SearchFAQFilters): Promise<ProductFAQ[]> {
    const where: Record<string, unknown> = {};

    if (filters?.teamId) {
      where.teamId = filters.teamId;
    }

    where.OR = [
      { question: { contains: term, mode: 'insensitive' } },
      { answer: { contains: term, mode: 'insensitive' } },
    ];

    return this.prisma.productFAQ.findMany({ where });
  }

  async updateProductFAQ(id: string, data: UpdateProductFAQInput): Promise<ProductFAQ> {
    return this.prisma.productFAQ.update({ where: { id }, data });
  }

  async deleteProductFAQ(id: string): Promise<void> {
    await this.prisma.productFAQ.delete({ where: { id } });
  }

  async getProductFAQsByProductId(productId: string): Promise<ProductFAQ[]> {
    return this.prisma.productFAQ.findMany({ where: { relevantProductId: productId } });
  }

  async markFAQHelpful(id: string): Promise<ProductFAQ> {
    return this.prisma.productFAQ.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });
  }

  async incrementFAQViews(id: string): Promise<ProductFAQ> {
    return this.prisma.productFAQ.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }

  async bulkCreateProductFAQs(data: CreateProductFAQInput[]): Promise<ProductFAQ[]> {
    return this.prisma.$transaction(
      data.map((item) => this.prisma.productFAQ.create({ data: item }))
    );
  }
}