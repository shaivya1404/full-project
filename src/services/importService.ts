import { KnowledgeBaseRepository, CreateKnowledgeBaseInput } from '../db/repositories/knowledgeBaseRepository';
import { ProductRepository, CreateProductInput, CreateProductFAQInput } from '../db/repositories/productRepository';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { Logger } from '../utils/logger';

export interface CSVImportOptions {
  hasHeader?: boolean;
  delimiter?: string;
  quote?: string;
}

export interface CSVFieldMapping {
  [csvField: string]: string;
}

export class ImportValidationError extends Error {
  constructor(message: string, public row?: number, public field?: string) {
    super(message);
    this.name = 'ImportValidationError';
  }
}

export class ImportService {
  private knowledgeBaseRepo: KnowledgeBaseRepository;
  private productRepo: ProductRepository;
  private logger: Logger;

  constructor(
    knowledgeBaseRepo?: KnowledgeBaseRepository,
    productRepo?: ProductRepository,
  ) {
    this.knowledgeBaseRepo = knowledgeBaseRepo || new KnowledgeBaseRepository();
    this.productRepo = productRepo || new ProductRepository();
    this.logger = new Logger('ImportService');
  }

  /**
   * Import knowledge base entries from CSV
   */
  async importKnowledgeBaseFromCSV(
    fileBuffer: Buffer,
    teamId: string,
    mapping: CSVFieldMapping = {},
    options: CSVImportOptions = { hasHeader: true }
  ): Promise<{ imported: number; errors: ImportValidationError[] }> {
    const errors: ImportValidationError[] = [];
    const imports: CreateKnowledgeBaseInput[] = [];

    try {
      const parser = this.createCSVParser(fileBuffer, options);
      
      for await (const record of parser) {
        try {
          const importData = this.mapCSVToKnowledgeBase(record, teamId, mapping);
          imports.push(importData);
        } catch (error) {
          if (error instanceof ImportValidationError) {
            errors.push(error);
          } else {
            this.logger.error('Unexpected error mapping CSV record', error);
          }
        }
      }

      if (imports.length > 0) {
        await this.knowledgeBaseRepo.bulkCreate(imports);
      }

      return { imported: imports.length, errors };
    } catch (error) {
      this.logger.error('Error importing knowledge base from CSV', error);
      throw error;
    }
  }

  /**
   * Import knowledge base entries from JSON
   */
  async importKnowledgeBaseFromJSON(
    jsonData: any[],
    teamId: string,
    mapping: CSVFieldMapping = {}
  ): Promise<{ imported: number; errors: ImportValidationError[] }> {
    const errors: ImportValidationError[] = [];
    const imports: CreateKnowledgeBaseInput[] = [];

    try {
      for (const [index, item] of jsonData.entries()) {
        try {
          const importData = this.mapJSONToKnowledgeBase(item, teamId, mapping);
          imports.push(importData);
        } catch (error) {
          if (error instanceof ImportValidationError) {
            error.row = index + 1;
            errors.push(error);
          } else {
            this.logger.error('Unexpected error mapping JSON item', error);
          }
        }
      }

      if (imports.length > 0) {
        await this.knowledgeBaseRepo.bulkCreate(imports);
      }

      return { imported: imports.length, errors };
    } catch (error) {
      this.logger.error('Error importing knowledge base from JSON', error);
      throw error;
    }
  }

  /**
   * Import products from CSV
   */
  async importProductsFromCSV(
    fileBuffer: Buffer,
    teamId: string,
    mapping: CSVFieldMapping = {},
    options: CSVImportOptions = { hasHeader: true }
  ): Promise<{ imported: number; errors: ImportValidationError[] }> {
    const errors: ImportValidationError[] = [];
    const imports: CreateProductInput[] = [];

    try {
      const parser = this.createCSVParser(fileBuffer, options);
      
      for await (const record of parser) {
        try {
          const importData = this.mapCSVToProduct(record, teamId, mapping);
          imports.push(importData);
        } catch (error) {
          if (error instanceof ImportValidationError) {
            errors.push(error);
          } else {
            this.logger.error('Unexpected error mapping CSV record', error);
          }
        }
      }

      if (imports.length > 0) {
        await this.productRepo.bulkCreateProducts(imports);
      }

      return { imported: imports.length, errors };
    } catch (error) {
      this.logger.error('Error importing products from CSV', error);
      throw error;
    }
  }

  /**
   * Import products from JSON
   */
  async importProductsFromJSON(
    jsonData: any[],
    teamId: string,
    mapping: CSVFieldMapping = {}
  ): Promise<{ imported: number; errors: ImportValidationError[] }> {
    const errors: ImportValidationError[] = [];
    const imports: CreateProductInput[] = [];

    try {
      for (const [index, item] of jsonData.entries()) {
        try {
          const importData = this.mapJSONToProduct(item, teamId, mapping);
          imports.push(importData);
        } catch (error) {
          if (error instanceof ImportValidationError) {
            error.row = index + 1;
            errors.push(error);
          } else {
            this.logger.error('Unexpected error mapping JSON item', error);
          }
        }
      }

      if (imports.length > 0) {
        await this.productRepo.bulkCreateProducts(imports);
      }

      return { imported: imports.length, errors };
    } catch (error) {
      this.logger.error('Error importing products from JSON', error);
      throw error;
    }
  }

  /**
   * Import FAQs from CSV
   */
  async importFAQsFromCSV(
    fileBuffer: Buffer,
    teamId: string,
    mapping: CSVFieldMapping = {},
    options: CSVImportOptions = { hasHeader: true }
  ): Promise<{ imported: number; errors: ImportValidationError[] }> {
    const errors: ImportValidationError[] = [];
    const imports: CreateProductFAQInput[] = [];

    try {
      const parser = this.createCSVParser(fileBuffer, options);
      
      for await (const record of parser) {
        try {
          const importData = this.mapCSVToFAQ(record, teamId, mapping);
          imports.push(importData);
        } catch (error) {
          if (error instanceof ImportValidationError) {
            errors.push(error);
          } else {
            this.logger.error('Unexpected error mapping CSV record', error);
          }
        }
      }

      if (imports.length > 0) {
        await this.productRepo.bulkCreateProductFAQs(imports);
      }

      return { imported: imports.length, errors };
    } catch (error) {
      this.logger.error('Error importing FAQs from CSV', error);
      throw error;
    }
  }

  /**
   * Import FAQs from JSON
   */
  async importFAQsFromJSON(
    jsonData: any[],
    teamId: string,
    mapping: CSVFieldMapping = {}
  ): Promise<{ imported: number; errors: ImportValidationError[] }> {
    const errors: ImportValidationError[] = [];
    const imports: CreateProductFAQInput[] = [];

    try {
      for (const [index, item] of jsonData.entries()) {
        try {
          const importData = this.mapJSONToFAQ(item, teamId, mapping);
          imports.push(importData);
        } catch (error) {
          if (error instanceof ImportValidationError) {
            error.row = index + 1;
            errors.push(error);
          } else {
            this.logger.error('Unexpected error mapping JSON item', error);
          }
        }
      }

      if (imports.length > 0) {
        await this.productRepo.bulkCreateProductFAQs(imports);
      }

      return { imported: imports.length, errors };
    } catch (error) {
      this.logger.error('Error importing FAQs from JSON', error);
      throw error;
    }
  }

  private createCSVParser(fileBuffer: Buffer, options: CSVImportOptions) {
    const parserOptions = {
      columns: options.hasHeader,
      delimiter: options.delimiter || ',',
      quote: options.quote || '"',
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    };

    return parse(fileBuffer.toString('utf-8'), parserOptions);
  }

  private mapCSVToKnowledgeBase(
    record: Record<string, string>, 
    teamId: string,
    mapping: CSVFieldMapping
  ): CreateKnowledgeBaseInput {
    const defaultMapping = {
      title: mapping.title || 'title',
      content: mapping.content || 'content',
      category: mapping.category || 'category',
      tags: mapping.tags || 'tags',
    };

    const mapped: CreateKnowledgeBaseInput = {
      teamId,
      title: record[defaultMapping.title] || '',
      content: record[defaultMapping.content] || '',
      category: record[defaultMapping.category] || undefined,
      tags: record[defaultMapping.tags] ? record[defaultMapping.tags].split(',').map((t) => t.trim()) : undefined,
    };

    this.validateKnowledgeBaseInput(mapped);
    return mapped;
  }

  private mapJSONToKnowledgeBase(
    item: any, 
    teamId: string,
    mapping: CSVFieldMapping
  ): CreateKnowledgeBaseInput {
    const defaultMapping = {
      title: mapping.title || 'title',
      content: mapping.content || 'content',
      category: mapping.category || 'category',
      tags: mapping.tags || 'tags',
    };

    const mapped: CreateKnowledgeBaseInput = {
      teamId,
      title: item[defaultMapping.title] || '',
      content: item[defaultMapping.content] || '',
      category: item[defaultMapping.category] || undefined,
      tags: item[defaultMapping.tags] || undefined,
    };

    this.validateKnowledgeBaseInput(mapped);
    return mapped;
  }

  private mapCSVToProduct(
    record: Record<string, string>, 
    teamId: string,
    mapping: CSVFieldMapping
  ): CreateProductInput {
    const defaultMapping = {
      name: mapping.name || 'name',
      description: mapping.description || 'description',
      category: mapping.category || 'category',
      price: mapping.price || 'price',
      details: mapping.details || 'details',
      faqs: mapping.faqs || 'faqs',
    };

    const mapped: CreateProductInput = {
      teamId,
      name: record[defaultMapping.name] || '',
      description: record[defaultMapping.description] || '',
      category: record[defaultMapping.category] || undefined,
      price: record[defaultMapping.price] ? parseFloat(record[defaultMapping.price]) : undefined,
      details: record[defaultMapping.details] ? JSON.parse(record[defaultMapping.details]) : undefined,
      faqs: record[defaultMapping.faqs] ? JSON.parse(record[defaultMapping.faqs]) : undefined,
    };

    this.validateProductInput(mapped);
    return mapped;
  }

  private mapJSONToProduct(
    item: any, 
    teamId: string,
    mapping: CSVFieldMapping
  ): CreateProductInput {
    const defaultMapping = {
      name: mapping.name || 'name',
      description: mapping.description || 'description',
      category: mapping.category || 'category',
      price: mapping.price || 'price',
      details: mapping.details || 'details',
      faqs: mapping.faqs || 'faqs',
    };

    const mapped: CreateProductInput = {
      teamId,
      name: item[defaultMapping.name] || '',
      description: item[defaultMapping.description] || '',
      category: item[defaultMapping.category] || undefined,
      price: item[defaultMapping.price] || undefined,
      details: item[defaultMapping.details] || undefined,
      faqs: item[defaultMapping.faqs] || undefined,
    };

    this.validateProductInput(mapped);
    return mapped;
  }

  private mapCSVToFAQ(
    record: Record<string, string>, 
    teamId: string,
    mapping: CSVFieldMapping
  ): CreateProductFAQInput {
    const defaultMapping = {
      question: mapping.question || 'question',
      answer: mapping.answer || 'answer',
      category: mapping.category || 'category',
      relevantProductId: mapping.relevantProductId || 'relevantProductId',
    };

    const mapped: CreateProductFAQInput = {
      teamId,
      question: record[defaultMapping.question] || '',
      answer: record[defaultMapping.answer] || '',
      category: record[defaultMapping.category] || undefined,
      relevantProductId: record[defaultMapping.relevantProductId] || undefined,
    };

    this.validateFAQInput(mapped);
    return mapped;
  }

  private mapJSONToFAQ(
    item: any, 
    teamId: string,
    mapping: CSVFieldMapping
  ): CreateProductFAQInput {
    const defaultMapping = {
      question: mapping.question || 'question',
      answer: mapping.answer || 'answer',
      category: mapping.category || 'category',
      relevantProductId: mapping.relevantProductId || 'relevantProductId',
    };

    const mapped: CreateProductFAQInput = {
      teamId,
      question: item[defaultMapping.question] || '',
      answer: item[defaultMapping.answer] || '',
      category: item[defaultMapping.category] || undefined,
      relevantProductId: item[defaultMapping.relevantProductId] || undefined,
    };

    this.validateFAQInput(mapped);
    return mapped;
  }

  private validateKnowledgeBaseInput(data: CreateKnowledgeBaseInput): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new ImportValidationError('Title is required');
    }
    if (!data.content || data.content.trim().length === 0) {
      throw new ImportValidationError('Content is required');
    }
  }

  private validateProductInput(data: CreateProductInput): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new ImportValidationError('Name is required for product');
    }
    if (!data.description || data.description.trim().length === 0) {
      throw new ImportValidationError('Description is required for product');
    }
  }

  private validateFAQInput(data: CreateProductFAQInput): void {
    if (!data.question || data.question.trim().length === 0) {
      throw new ImportValidationError('Question is required');
    }
    if (!data.answer || data.answer.trim().length === 0) {
      throw new ImportValidationError('Answer is required');
    }
  }
}