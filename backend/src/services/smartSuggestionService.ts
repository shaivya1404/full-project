import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Types
export interface Suggestion {
  type: SuggestionType;
  productId?: string;
  productName?: string;
  reason: string;
  confidence: number;
  script: string;
  timing: 'now' | 'later' | 'end_of_call';
  priority: number;
}

export type SuggestionType =
  | 'upsell'
  | 'cross_sell'
  | 'reorder'
  | 'upgrade'
  | 'bundle'
  | 'loyalty_offer'
  | 'promotional'
  | 'complementary'
  | 'replacement';

export interface SuggestionContext {
  customerId?: string;
  currentOrderId?: string;
  callReason?: string;
  customerSentiment?: number;
  conversationStage?: string;
  teamId: string;
}

export interface ProductRecommendation {
  productId: string;
  name: string;
  price: number;
  reason: string;
  relevanceScore: number;
  margin?: number;
}

/**
 * Service for intelligent product suggestions and upselling
 */
export class SmartSuggestionService {
  /**
   * Generate suggestions based on context
   */
  async generateSuggestions(context: SuggestionContext): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    try {
      // Only suggest when sentiment is neutral or positive
      if (context.customerSentiment !== undefined && context.customerSentiment < 0.4) {
        logger.info('Skipping suggestions due to low customer sentiment');
        return []; // Don't upsell when customer is unhappy
      }

      // Generate different types of suggestions in parallel
      const [
        reorderSuggestions,
        crossSellSuggestions,
        upsellSuggestions,
        bundleSuggestions,
        loyaltySuggestions,
      ] = await Promise.all([
        context.customerId ? this.generateReorderSuggestions(context.customerId, context.teamId) : [],
        context.currentOrderId ? this.generateCrossSellSuggestions(context.currentOrderId) : [],
        context.currentOrderId ? this.generateUpsellSuggestions(context.currentOrderId) : [],
        context.currentOrderId ? this.generateBundleSuggestions(context.currentOrderId) : [],
        context.customerId ? this.generateLoyaltySuggestions(context.customerId, context.teamId) : [],
      ]);

      suggestions.push(
        ...reorderSuggestions,
        ...crossSellSuggestions,
        ...upsellSuggestions,
        ...bundleSuggestions,
        ...loyaltySuggestions
      );

      // Sort by priority and confidence
      suggestions.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.confidence - a.confidence;
      });

      // Limit suggestions
      return suggestions.slice(0, 3);
    } catch (error) {
      logger.error('Error generating suggestions', error);
      return [];
    }
  }

  /**
   * Generate reorder suggestions based on purchase history
   */
  private async generateReorderSuggestions(
    customerId: string,
    teamId: string
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    try {
      // Get past orders
      const pastOrders = await prisma.order.findMany({
        where: {
          customerId,
          status: 'delivered',
        },
        include: {
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Find frequently ordered products
      const productFrequency = new Map<string, { count: number; productName: string; lastOrdered: Date }>();

      for (const order of pastOrders) {
        for (const item of order.items) {
          if (!item.productId) continue;
          const existing = productFrequency.get(item.productId);
          if (existing) {
            existing.count += 1;
            if (order.createdAt > existing.lastOrdered) {
              existing.lastOrdered = order.createdAt;
            }
          } else {
            productFrequency.set(item.productId, {
              count: 1,
              productName: item.productName,
              lastOrdered: order.createdAt,
            });
          }
        }
      }

      // Suggest products ordered 2+ times that haven't been ordered recently
      for (const [productId, data] of productFrequency) {
        if (data.count >= 2) {
          const daysSinceLastOrder = Math.floor(
            (Date.now() - data.lastOrdered.getTime()) / (24 * 60 * 60 * 1000)
          );

          // Suggest if more than 30 days since last order
          if (daysSinceLastOrder > 30) {
            suggestions.push({
              type: 'reorder',
              productId,
              productName: data.productName,
              reason: `Customer ordered this ${data.count} times, last ${daysSinceLastOrder} days ago`,
              confidence: Math.min(data.count / 5, 1),
              script: `I noticed you've ordered ${data.productName || 'this item'} before. Would you like to add it to your order today?`,
              timing: 'end_of_call',
              priority: 2,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error generating reorder suggestions', error);
    }

    return suggestions;
  }

  /**
   * Generate cross-sell suggestions based on current order
   */
  private async generateCrossSellSuggestions(orderId: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    try {
      // Get current order with items
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (!order) return suggestions;

      // Get product IDs from current order
      const currentProductIds = order.items
        .map((item) => item.productId)
        .filter(Boolean) as string[];

      // Find other popular products not in current order
      const complementaryProducts = await prisma.product.findMany({
        where: {
          id: {
            notIn: currentProductIds,
          },
          isAvailable: true,
          stockQuantity: {
            gt: 0,
          },
        },
        take: 5,
      });

      for (const product of complementaryProducts) {
        suggestions.push({
          type: 'cross_sell',
          productId: product.id,
          productName: product.name,
          reason: 'Complementary product',
          confidence: 0.6,
          script: `Many customers also add ${product.name} to their order. Would you like to include it?`,
          timing: 'now',
          priority: 3,
        });
      }
    } catch (error) {
      logger.error('Error generating cross-sell suggestions', error);
    }

    return suggestions;
  }

  /**
   * Generate upsell suggestions (premium versions)
   */
  private async generateUpsellSuggestions(orderId: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    try {
      // Get current order items
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (!order) return suggestions;

      // For each item, find premium alternatives
      for (const item of order.items) {
        if (!item.productId) continue;

        // Get the product details
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product || !product.price) continue;

        // Find higher-priced products in same category
        const premiumProducts = await prisma.product.findMany({
          where: {
            category: product.category,
            price: {
              gt: product.price,
              lte: product.price * 1.5, // Up to 50% more expensive
            },
            isAvailable: true,
            stockQuantity: {
              gt: 0,
            },
            id: {
              not: item.productId,
            },
          },
          orderBy: { price: 'asc' },
          take: 1,
        });

        for (const premium of premiumProducts) {
          if (!premium.price) continue;
          const priceDiff = premium.price - product.price;
          suggestions.push({
            type: 'upsell',
            productId: premium.id,
            productName: premium.name,
            reason: `Premium upgrade for ${item.productName}`,
            confidence: 0.5,
            script: `For just Rs ${priceDiff} more, you could upgrade to ${premium.name}. Would you like to hear about the benefits?`,
            timing: 'now',
            priority: 2,
          });
        }
      }
    } catch (error) {
      logger.error('Error generating upsell suggestions', error);
    }

    return suggestions;
  }

  /**
   * Generate bundle suggestions
   */
  private async generateBundleSuggestions(orderId: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) return suggestions;

      // Calculate current order value
      const orderValue = order.totalAmount;

      // Suggest adding items to reach free delivery threshold or discount tier
      const freeDeliveryThreshold = 500;
      const discountThreshold = 1000;

      if (orderValue < freeDeliveryThreshold) {
        const amountNeeded = freeDeliveryThreshold - orderValue;
        suggestions.push({
          type: 'bundle',
          reason: 'Help customer reach free delivery threshold',
          confidence: 0.7,
          script: `You're just Rs ${amountNeeded} away from free delivery! Would you like to add something small to qualify?`,
          timing: 'end_of_call',
          priority: 1,
        });
      } else if (orderValue < discountThreshold) {
        const amountNeeded = discountThreshold - orderValue;
        suggestions.push({
          type: 'bundle',
          reason: 'Help customer reach discount threshold',
          confidence: 0.6,
          script: `You're Rs ${amountNeeded} away from a 10% discount on your entire order! Would you like to add anything?`,
          timing: 'end_of_call',
          priority: 1,
        });
      }
    } catch (error) {
      logger.error('Error generating bundle suggestions', error);
    }

    return suggestions;
  }

  /**
   * Generate loyalty suggestions
   */
  private async generateLoyaltySuggestions(
    customerId: string,
    teamId: string
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    try {
      // Get customer's order history
      const orderCount = await prisma.order.count({
        where: {
          customerId,
          status: 'delivered',
        },
      });

      // Milestone rewards
      if (orderCount === 4) {
        suggestions.push({
          type: 'loyalty_offer',
          reason: 'Customer approaching 5th order milestone',
          confidence: 0.8,
          script: "This is your 5th order with us! As a thank you, you'll get 15% off. Shall I apply that discount?",
          timing: 'now',
          priority: 1,
        });
      } else if (orderCount >= 10 && orderCount % 10 === 0) {
        suggestions.push({
          type: 'loyalty_offer',
          reason: `Customer reached ${orderCount} orders milestone`,
          confidence: 0.9,
          script: `Congratulations on your ${orderCount}th order! You've earned a special loyalty discount of 20%!`,
          timing: 'now',
          priority: 1,
        });
      }

      // VIP tier suggestion
      if (orderCount >= 8 && orderCount < 10) {
        suggestions.push({
          type: 'loyalty_offer',
          reason: 'Customer close to VIP status',
          confidence: 0.7,
          script: `You're just ${10 - orderCount} orders away from VIP status, which includes free priority delivery on all orders!`,
          timing: 'end_of_call',
          priority: 2,
        });
      }
    } catch (error) {
      logger.error('Error generating loyalty suggestions', error);
    }

    return suggestions;
  }

  /**
   * Get product recommendations for a customer
   */
  async getProductRecommendations(
    customerId: string,
    limit: number = 5
  ): Promise<ProductRecommendation[]> {
    const recommendations: ProductRecommendation[] = [];

    try {
      // Get customer's purchase history
      const pastOrders = await prisma.order.findMany({
        where: {
          customerId,
          status: 'delivered',
        },
        include: {
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // Collect product IDs from past orders
      const productIds = pastOrders
        .flatMap((order) => order.items.map((item) => item.productId))
        .filter(Boolean) as string[];

      // Get product details for category and price analysis
      const purchasedProducts = productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds } },
          })
        : [];

      // Extract preferred categories and price range
      const categoryScores = new Map<string, number>();
      let totalPrice = 0;
      let priceCount = 0;

      for (const product of purchasedProducts) {
        if (product.category) {
          const current = categoryScores.get(product.category) || 0;
          categoryScores.set(product.category, current + 1);
        }
        if (product.price) {
          totalPrice += product.price;
          priceCount++;
        }
      }

      const avgPrice = priceCount > 0 ? totalPrice / priceCount : 500;

      // Find products in preferred categories within price range
      const topCategories = Array.from(categoryScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);

      if (topCategories.length > 0) {
        const products = await prisma.product.findMany({
          where: {
            category: {
              in: topCategories,
            },
            price: {
              gte: avgPrice * 0.5,
              lte: avgPrice * 2,
            },
            isAvailable: true,
            stockQuantity: {
              gt: 0,
            },
          },
          take: limit * 2,
        });

        for (const product of products) {
          if (!product.price) continue;
          const categoryScore = categoryScores.get(product.category || '') || 0;
          const priceProximity = 1 - Math.abs(product.price - avgPrice) / avgPrice;

          recommendations.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            reason: 'Based on your purchase history',
            relevanceScore: (categoryScore * 0.6) + (priceProximity * 0.4),
          });
        }
      }

      // Sort by relevance and limit
      recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);
      return recommendations.slice(0, limit);
    } catch (error) {
      logger.error('Error getting product recommendations', error);
      return [];
    }
  }

  /**
   * Determine the right moment to make a suggestion
   */
  shouldMakeSuggestion(
    conversationStage: string,
    customerSentiment: number,
    problemResolved: boolean
  ): { shouldSuggest: boolean; reason: string } {
    // Never suggest during problem resolution
    if (!problemResolved) {
      return { shouldSuggest: false, reason: 'Customer issue not yet resolved' };
    }

    // Don't suggest if customer is unhappy
    if (customerSentiment < 0.5) {
      return { shouldSuggest: false, reason: 'Customer sentiment too low' };
    }

    // Good stages for suggestions
    const goodStages = ['resolution_complete', 'order_confirmed', 'closing', 'friendly_chat'];
    if (!goodStages.includes(conversationStage)) {
      return { shouldSuggest: false, reason: 'Not the right conversation stage' };
    }

    return { shouldSuggest: true, reason: 'Good moment for suggestion' };
  }

  /**
   * Generate natural upsell script
   */
  generateUpsellScript(
    suggestion: Suggestion,
    customerName?: string,
    tone: 'casual' | 'professional' = 'casual'
  ): string {
    const name = customerName ? `, ${customerName}` : '';

    if (tone === 'casual') {
      switch (suggestion.type) {
        case 'reorder':
          return `By the way${name}, I noticed you've enjoyed ${suggestion.productName} before. Want me to add it?`;
        case 'upsell':
          return `Oh${name}, we also have ${suggestion.productName} which is even better! Want to hear about it?`;
        case 'cross_sell':
          return `${suggestion.productName} goes great with what you're getting. Should I add one?`;
        case 'bundle':
          return suggestion.script;
        case 'loyalty_offer':
          return suggestion.script;
        default:
          return suggestion.script;
      }
    } else {
      switch (suggestion.type) {
        case 'reorder':
          return `Based on your previous orders${name}, I'd like to recommend ${suggestion.productName}. Would you like to add it to your order?`;
        case 'upsell':
          return `I'd like to inform you about our premium option, ${suggestion.productName}. May I share the details?`;
        case 'cross_sell':
          return `Many of our customers also order ${suggestion.productName} alongside their purchase. Would you be interested?`;
        default:
          return suggestion.script;
      }
    }
  }
}

export const smartSuggestionService = new SmartSuggestionService();
