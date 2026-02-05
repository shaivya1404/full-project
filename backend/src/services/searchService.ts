import { prisma } from '../db/client';
import { logger } from '../utils/logger';

export interface SearchOptions {
  query: string;
  teamId?: string;
  types?: ('calls' | 'orders' | 'customers' | 'products' | 'knowledge' | 'agents' | 'campaigns')[];
  limit?: number;
  offset?: number;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  relevance: number;
  data: Record<string, any>;
  createdAt: Date;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: {
    type: Record<string, number>;
  };
  took: number;
}

class SearchService {
  async search(options: SearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();
    const {
      query,
      teamId,
      types = ['calls', 'orders', 'customers', 'products', 'knowledge', 'agents', 'campaigns'],
      limit = 20,
      offset = 0,
      dateFrom,
      dateTo,
    } = options;

    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results: SearchResult[] = [];
    const facets: Record<string, number> = {};

    // Search each type in parallel
    const searchPromises: Promise<SearchResult[]>[] = [];

    if (types.includes('calls')) {
      searchPromises.push(this.searchCalls(searchTerms, teamId, dateFrom, dateTo));
    }
    if (types.includes('orders')) {
      searchPromises.push(this.searchOrders(searchTerms, teamId, dateFrom, dateTo));
    }
    if (types.includes('customers')) {
      searchPromises.push(this.searchCustomers(searchTerms, teamId));
    }
    if (types.includes('products')) {
      searchPromises.push(this.searchProducts(searchTerms, teamId));
    }
    if (types.includes('knowledge')) {
      searchPromises.push(this.searchKnowledge(searchTerms, teamId));
    }
    if (types.includes('agents')) {
      searchPromises.push(this.searchAgents(searchTerms, teamId));
    }
    if (types.includes('campaigns')) {
      searchPromises.push(this.searchCampaigns(searchTerms, teamId));
    }

    const allResults = await Promise.all(searchPromises);

    // Combine and sort by relevance
    allResults.forEach((typeResults) => {
      typeResults.forEach((result) => {
        results.push(result);
        facets[result.type] = (facets[result.type] || 0) + 1;
      });
    });

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total,
      facets: { type: facets },
      took: Date.now() - startTime,
    };
  }

  private calculateRelevance(searchTerms: string[], ...fields: (string | null | undefined)[]): number {
    let score = 0;
    const text = fields.filter(Boolean).join(' ').toLowerCase();

    searchTerms.forEach((term) => {
      // Exact match
      if (text.includes(term)) {
        score += 10;
      }
      // Word boundary match
      const wordRegex = new RegExp(`\\b${term}\\b`, 'i');
      if (wordRegex.test(text)) {
        score += 5;
      }
      // Starts with match
      const startsWithRegex = new RegExp(`\\b${term}`, 'i');
      if (startsWithRegex.test(text)) {
        score += 3;
      }
    });

    return score;
  }

  private async searchCalls(searchTerms: string[], teamId?: string, dateFrom?: Date, dateTo?: Date): Promise<SearchResult[]> {
    try {
      const where: any = {};
      if (teamId) where.teamId = teamId;
      if (dateFrom || dateTo) {
        where.startTime = {};
        if (dateFrom) where.startTime.gte = dateFrom;
        if (dateTo) where.startTime.lte = dateTo;
      }

      // Build OR conditions for search
      where.OR = searchTerms.map((term) => ({
        OR: [
          { caller: { contains: term, mode: 'insensitive' } },
          { agent: { contains: term, mode: 'insensitive' } },
          { notes: { contains: term, mode: 'insensitive' } },
        ],
      }));

      const calls = await prisma.call.findMany({
        where,
        include: { analytics: true },
        take: 50,
        orderBy: { startTime: 'desc' },
      });

      return calls.map((call) => ({
        type: 'call',
        id: call.id,
        title: `Call from ${call.caller}`,
        subtitle: call.agent ? `Agent: ${call.agent}` : 'No agent assigned',
        description: call.notes || undefined,
        relevance: this.calculateRelevance(searchTerms, call.caller, call.agent, call.notes),
        data: {
          caller: call.caller,
          agent: call.agent,
          duration: call.duration,
          status: call.status,
          sentiment: call.analytics?.[0]?.sentiment,
        },
        createdAt: call.startTime,
      }));
    } catch (error) {
      logger.error('Error searching calls', error);
      return [];
    }
  }

  private async searchOrders(searchTerms: string[], teamId?: string, dateFrom?: Date, dateTo?: Date): Promise<SearchResult[]> {
    try {
      const where: any = {};
      if (teamId) where.teamId = teamId;
      if (dateFrom || dateTo) {
        where.orderTime = {};
        if (dateFrom) where.orderTime.gte = dateFrom;
        if (dateTo) where.orderTime.lte = dateTo;
      }

      where.OR = searchTerms.map((term) => ({
        OR: [
          { orderNumber: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { notes: { contains: term, mode: 'insensitive' } },
          { deliveryAddress: { contains: term, mode: 'insensitive' } },
        ],
      }));

      const orders = await prisma.order.findMany({
        where,
        include: { customer: true, items: true },
        take: 50,
        orderBy: { orderTime: 'desc' },
      });

      return orders.map((order) => ({
        type: 'order',
        id: order.id,
        title: `Order #${order.orderNumber}`,
        subtitle: `${order.customer?.name || order.phone || 'Unknown'} - ${order.status}`,
        description: order.items.map((i) => i.productName).join(', '),
        relevance: this.calculateRelevance(
          searchTerms,
          order.orderNumber,
          order.phone,
          order.email,
          order.customer?.name,
          order.notes
        ),
        data: {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          status: order.status,
          itemCount: order.items.length,
          customerName: order.customer?.name,
        },
        createdAt: order.orderTime,
      }));
    } catch (error) {
      logger.error('Error searching orders', error);
      return [];
    }
  }

  private async searchCustomers(searchTerms: string[], teamId?: string): Promise<SearchResult[]> {
    try {
      const where: any = {};
      if (teamId) where.teamId = teamId;

      where.OR = searchTerms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { address: { contains: term, mode: 'insensitive' } },
        ],
      }));

      const customers = await prisma.customer.findMany({
        where,
        include: { orders: { take: 5 } },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });

      return customers.map((customer) => ({
        type: 'customer',
        id: customer.id,
        title: customer.name || customer.phone || 'Unknown Customer',
        subtitle: customer.email || customer.phone || '',
        description: customer.address || undefined,
        relevance: this.calculateRelevance(searchTerms, customer.name, customer.phone, customer.email, customer.address),
        data: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          orderCount: customer.previousOrders,
          totalValue: customer.orders.reduce((sum, o) => sum + o.totalAmount, 0),
        },
        createdAt: customer.createdAt,
      }));
    } catch (error) {
      logger.error('Error searching customers', error);
      return [];
    }
  }

  private async searchProducts(searchTerms: string[], teamId?: string): Promise<SearchResult[]> {
    try {
      const where: any = {};
      if (teamId) where.teamId = teamId;

      where.OR = searchTerms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { category: { contains: term, mode: 'insensitive' } },
        ],
      }));

      const products = await prisma.product.findMany({
        where,
        take: 50,
        orderBy: { name: 'asc' },
      });

      return products.map((product) => ({
        type: 'product',
        id: product.id,
        title: product.name,
        subtitle: product.category || 'Uncategorized',
        description: product.description,
        relevance: this.calculateRelevance(searchTerms, product.name, product.description, product.category),
        data: {
          name: product.name,
          price: product.price,
          category: product.category,
        },
        createdAt: product.createdAt,
      }));
    } catch (error) {
      logger.error('Error searching products', error);
      return [];
    }
  }

  private async searchKnowledge(searchTerms: string[], teamId?: string): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];

      // Search knowledge base articles
      const kbWhere: any = {};
      if (teamId) kbWhere.teamId = teamId;
      kbWhere.OR = searchTerms.map((term) => ({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { content: { contains: term, mode: 'insensitive' } },
          { category: { contains: term, mode: 'insensitive' } },
        ],
      }));

      const articles = await prisma.knowledgeBase.findMany({
        where: kbWhere,
        take: 25,
      });

      articles.forEach((article) => {
        results.push({
          type: 'knowledge',
          id: article.id,
          title: article.title,
          subtitle: article.category || 'General',
          description: article.content.substring(0, 200) + '...',
          relevance: this.calculateRelevance(searchTerms, article.title, article.content, article.category),
          data: {
            title: article.title,
            category: article.category,
          },
          createdAt: article.createdAt,
        });
      });

      // Search FAQs
      const faqWhere: any = {};
      if (teamId) faqWhere.teamId = teamId;
      faqWhere.OR = searchTerms.map((term) => ({
        OR: [
          { question: { contains: term, mode: 'insensitive' } },
          { answer: { contains: term, mode: 'insensitive' } },
        ],
      }));

      const faqs = await prisma.productFAQ.findMany({
        where: faqWhere,
        take: 25,
      });

      faqs.forEach((faq) => {
        results.push({
          type: 'faq',
          id: faq.id,
          title: faq.question,
          subtitle: faq.category || 'General',
          description: faq.answer.substring(0, 200) + '...',
          relevance: this.calculateRelevance(searchTerms, faq.question, faq.answer),
          data: {
            question: faq.question,
            views: faq.views,
            helpfulCount: faq.helpfulCount,
          },
          createdAt: faq.createdAt,
        });
      });

      return results;
    } catch (error) {
      logger.error('Error searching knowledge', error);
      return [];
    }
  }

  private async searchAgents(searchTerms: string[], teamId?: string): Promise<SearchResult[]> {
    try {
      const where: any = {};
      if (teamId) where.teamId = teamId;

      where.OR = searchTerms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { skills: { contains: term, mode: 'insensitive' } },
        ],
      }));

      const agents = await prisma.agent.findMany({
        where,
        take: 50,
        orderBy: { name: 'asc' },
      });

      return agents.map((agent) => ({
        type: 'agent',
        id: agent.id,
        title: agent.name,
        subtitle: agent.email,
        description: agent.skills || undefined,
        relevance: this.calculateRelevance(searchTerms, agent.name, agent.email, agent.skills),
        data: {
          name: agent.name,
          email: agent.email,
          status: agent.availabilityStatus,
          role: agent.role,
        },
        createdAt: agent.createdAt,
      }));
    } catch (error) {
      logger.error('Error searching agents', error);
      return [];
    }
  }

  private async searchCampaigns(searchTerms: string[], teamId?: string): Promise<SearchResult[]> {
    try {
      const where: any = {};
      if (teamId) where.teamId = teamId;

      where.OR = searchTerms.map((term) => ({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { script: { contains: term, mode: 'insensitive' } },
        ],
      }));

      const campaigns = await prisma.campaign.findMany({
        where,
        include: { contacts: true, analytics: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });

      return campaigns.map((campaign) => ({
        type: 'campaign',
        id: campaign.id,
        title: campaign.name,
        subtitle: campaign.status,
        description: campaign.description || undefined,
        relevance: this.calculateRelevance(searchTerms, campaign.name, campaign.description, campaign.script),
        data: {
          name: campaign.name,
          status: campaign.status,
          contactCount: campaign.contacts.length,
          successRate: campaign.analytics?.successRate,
        },
        createdAt: campaign.createdAt,
      }));
    } catch (error) {
      logger.error('Error searching campaigns', error);
      return [];
    }
  }
}

export const searchService = new SearchService();
export default searchService;
