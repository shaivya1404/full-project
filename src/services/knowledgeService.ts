import { KnowledgeBaseRepository } from '../db/repositories/knowledgeBaseRepository';
import { ProductRepository } from '../db/repositories/productRepository';
import { CallRepository } from '../db/repositories/callRepository';
import { logger } from '../utils/logger';

export interface KnowledgeContext {
  knowledgeBase: any[];
  products: any[];
  faqs: any[];
  relevanceScore: number;
}

export interface SearchResult {
  id: string;
  type: 'knowledge' | 'product' | 'faq';
  title: string;
  content: string;
  relevanceScore: number;
  metadata: {
    category?: string;
    tags?: string[];
    price?: number;
    productId?: string;
    faqId?: string;
  };
}

export interface ConfidenceScore {
  overall: number;
  knowledgeBased: number;
  fallback: boolean;
  sources: Array<{
    id: string;
    type: string;
    relevanceScore: number;
  }>;
}

export class KnowledgeService {
  private knowledgeBaseRepository: KnowledgeBaseRepository;
  private productRepository: ProductRepository;
  private callRepository: CallRepository;

  constructor() {
    this.knowledgeBaseRepository = new KnowledgeBaseRepository();
    this.productRepository = new ProductRepository();
    this.callRepository = new CallRepository();
  }

  /**
   * Perform semantic search across knowledge base, products, and FAQs
   */
  async searchRelevantKnowledge(
    query: string,
    teamId: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];
      
      // Search knowledge base
      const knowledgeResults = await this.knowledgeBaseRepository.search(query, {
        teamId,
      });
      
      for (const kb of knowledgeResults) {
        const relevanceScore = this.calculateRelevanceScore(query, kb.content, kb.title);
        results.push({
          id: kb.id,
          type: 'knowledge',
          title: kb.title,
          content: kb.content,
          relevanceScore,
          metadata: {
            category: kb.category,
            tags: kb.tags ? JSON.parse(kb.tags) : [],
          },
        });
      }

      // Search products
      const products = await this.productRepository.findMany({ teamId });
      for (const product of products) {
        const searchText = `${product.name} ${product.description}`;
        const relevanceScore = this.calculateRelevanceScore(query, searchText, product.name);
        
        if (relevanceScore > 0.1) { // Threshold for relevance
          results.push({
            id: product.id,
            type: 'product',
            title: product.name,
            content: product.description,
            relevanceScore,
            metadata: {
              category: product.category,
              price: product.price,
            },
          });
        }
      }

      // Search FAQs
      const faqResults = await this.searchFaqs(query, teamId);
      for (const faq of faqResults) {
        const relevanceScore = this.calculateRelevanceScore(query, faq.answer, faq.question);
        results.push({
          id: faq.id,
          type: 'faq',
          title: faq.question,
          content: faq.answer,
          relevanceScore,
          metadata: {
            category: faq.category,
            relevantProductId: faq.relevantProductId,
          },
        });
      }

      // Sort by relevance and return top results
      return results
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

    } catch (error) {
      logger.error('Error searching knowledge', error);
      return [];
    }
  }

  /**
   * Get knowledge context for a call session
   */
  async getKnowledgeContext(callId: string, teamId: string): Promise<KnowledgeContext> {
    try {
      const recentTranscripts = await this.callRepository.getRecentTranscripts(callId, 10);
      if (recentTranscripts.length === 0) {
        return {
          knowledgeBase: [],
          products: [],
          faqs: [],
          relevanceScore: 0,
        };
      }

      // Extract key topics from recent conversation
      const conversationText = recentTranscripts
        .map(t => t.text)
        .join(' ')
        .toLowerCase();

      // Search for relevant knowledge based on conversation context
      const searchResults = await this.searchRelevantKnowledge(conversationText, teamId, 10);

      const knowledgeBase = [];
      const products = [];
      const faqs = [];

      for (const result of searchResults) {
        if (result.relevanceScore > 0.3) { // Higher threshold for conversation context
          switch (result.type) {
            case 'knowledge':
              knowledgeBase.push({
                id: result.id,
                title: result.title,
                content: result.content,
                relevanceScore: result.relevanceScore,
              });
              break;
            case 'product':
              products.push({
                id: result.id,
                name: result.title,
                description: result.content,
                relevanceScore: result.relevanceScore,
                metadata: result.metadata,
              });
              break;
            case 'faq':
              faqs.push({
                id: result.id,
                question: result.title,
                answer: result.content,
                relevanceScore: result.relevanceScore,
                metadata: result.metadata,
              });
              break;
          }
        }
      }

      const overallRelevance = searchResults.length > 0 
        ? searchResults[0].relevanceScore 
        : 0;

      return {
        knowledgeBase,
        products,
        faqs,
        relevanceScore: overallRelevance,
      };
    } catch (error) {
      logger.error('Error getting knowledge context', error);
      return {
        knowledgeBase: [],
        products: [],
        faqs: [],
        relevanceScore: 0,
      };
    }
  }

  /**
   * Calculate confidence score for AI response
   */
  calculateConfidenceScore(
    context: KnowledgeContext,
    responseSources: string[],
  ): ConfidenceScore {
    const totalSources = responseSources.length;
    const knowledgeBasedSources = responseSources.filter(id => 
      context.knowledgeBase.some(k => k.id === id) ||
      context.products.some(p => p.id === id) ||
      context.faqs.some(f => f.id === id)
    ).length;

    const knowledgeBased = totalSources > 0 ? knowledgeBasedSources / totalSources : 0;
    const overall = Math.min(knowledgeBased + 0.2, 1.0); // Base confidence of 0.2 for any response

    return {
      overall,
      knowledgeBased,
      fallback: overall < 0.5,
      sources: responseSources.map(id => {
        const source = context.knowledgeBase.find(k => k.id === id) ||
                      context.products.find(p => p.id === id) ||
                      context.faqs.find(f => f.id === id);
        
        return {
          id,
          type: source ? source.constructor.name.toLowerCase() : 'unknown',
          relevanceScore: source?.relevanceScore || 0,
        };
      }),
    };
  }

  /**
   * Record knowledge source usage for a call
   */
  async recordKnowledgeUsage(
    callId: string,
    sources: Array<{
      type: 'knowledge' | 'product' | 'faq';
      id: string;
      relevanceScore: number;
    }>,
  ): Promise<void> {
    try {
      for (const source of sources) {
        await this.callRepository.createKnowledgeBaseSource({
          callId,
          relevanceScore: source.relevanceScore,
          ...(source.type === 'knowledge' && { knowledgeBaseId: source.id }),
          ...(source.type === 'product' && { productId: source.id }),
          ...(source.type === 'faq' && { faqId: source.id }),
        });
      }
    } catch (error) {
      logger.error('Error recording knowledge usage', error);
    }
  }

  /**
   * Track unanswered questions for analysis
   */
  async trackUnansweredQuestion(question: string): Promise<void> {
    try {
      await this.callRepository.createOrUpdateUnansweredQuestion(question);
    } catch (error) {
      logger.error('Error tracking unanswered question', error);
    }
  }

  /**
   * Check if question is within knowledge scope
   */
  isWithinKnowledgeScope(question: string, context: KnowledgeContext): boolean {
    return context.relevanceScore > 0.3;
  }

  /**
   * Get FAQs by team ID (placeholder implementation)
   */
  private async getFaqsByTeamId(teamId: string): Promise<any[]> {
    // This would need to be implemented based on your FAQ model structure
    // For now, returning empty array as placeholder
    return [];
  }

  /**
   * Search FAQs by query
   */
  private async searchFaqs(query: string, teamId: string): Promise<any[]> {
    // Simple text-based FAQ search - in production, this could use vector embeddings
    const faqs = await this.getFaqsByTeamId(teamId);
    
    return faqs.filter(faq => {
      const searchText = `${faq.question} ${faq.answer}`.toLowerCase();
      const queryWords = query.toLowerCase().split(' ');
      
      return queryWords.some(word => searchText.includes(word));
    });
  }

  /**
   * Get knowledge used for a call
   */
  async getKnowledgeUsedForCall(callId: string): Promise<any[]> {
    return this.callRepository.getKnowledgeUsedForCall(callId);
  }

  /**
   * Get unanswered questions with pagination
   */
  async getUnansweredQuestions(limit: number = 20, offset: number = 0): Promise<{
    questions: any[];
    total: number;
  }> {
    return this.callRepository.getUnansweredQuestions(limit, offset);
  }

  /**
   * Get knowledge analytics for a team
   */
  async getKnowledgeAnalytics(teamId: string, startDate?: string, endDate?: string): Promise<any> {
    return this.callRepository.getKnowledgeAnalytics(teamId, startDate, endDate);
  }

  private calculateRelevanceScore(query: string, content: string, title?: string): number {
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    const contentLower = content.toLowerCase();
    
    if (queryWords.length === 0) return 0;
    
    let score = 0;
    
    // Title matches get higher weight
    if (title) {
      const titleLower = title.toLowerCase();
      for (const word of queryWords) {
        if (titleLower.includes(word)) {
          score += 2;
        }
      }
    }
    
    // Content matches
    for (const word of queryWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const matches = (contentLower.match(regex) || []).length;
      score += matches;
    }
    
    // Normalize by query length and content length
    const normalizedScore = score / (queryWords.length * Math.log(content.length + 1));
    
    return Math.min(normalizedScore / 10, 1.0); // Cap at 1.0
  }
}