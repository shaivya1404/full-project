import { prisma } from '../db/client';
import { CustomerMemory } from '@prisma/client';
import { logger } from '../utils/logger';

// Types
export type FactType = 'preference' | 'issue' | 'promise' | 'personal_info' | 'interaction_note';

export interface CustomerFact {
  factType: FactType;
  factKey: string;
  factValue: string;
  confidence?: number;
  source: string; // call_id
  expiresAt?: Date;
}

export interface FactFilters {
  factType?: FactType;
  factKey?: string;
  activeOnly?: boolean;
}

export interface ExtractedFact {
  factType: FactType;
  factKey: string;
  factValue: string;
  confidence: number;
}

export interface MemorySummary {
  customerId: string;
  name?: string;
  preferences: { key: string; value: string }[];
  pastIssues: { issue: string; when: Date }[];
  unfulfilledPromises: { promise: string; madeAt: Date }[];
  personalNotes: string[];
  interactionCount: number;
  lastInteraction?: Date;
}

// Patterns for fact extraction
const FACT_PATTERNS = {
  preference: [
    { pattern: /(?:i\s+(?:always|usually|prefer|like|love|want))\s+(.+)/i, key: 'general_preference' },
    { pattern: /(?:my\s+favorite\s+(?:is|are))\s+(.+)/i, key: 'favorite' },
    { pattern: /(?:i'm\s+(?:vegetarian|vegan|allergic))/i, key: 'dietary' },
    { pattern: /(?:no\s+(?:onions|garlic|spice|cheese|mushrooms|meat))/i, key: 'dietary_restriction' },
    { pattern: /(?:extra\s+(?:cheese|spicy|sauce))/i, key: 'extra_preference' },
  ],
  personal_info: [
    { pattern: /(?:my\s+name\s+is)\s+(\w+)/i, key: 'name' },
    { pattern: /(?:i\s+live\s+(?:at|in))\s+(.+)/i, key: 'location' },
    { pattern: /(?:my\s+(?:birthday|anniversary)\s+is)\s+(.+)/i, key: 'special_date' },
    { pattern: /(?:i\s+have\s+(?:a|an))\s+(\w+\s+(?:allergy|condition))/i, key: 'health_info' },
  ],
  issue: [
    { pattern: /(?:problem\s+with|issue\s+with|complaint\s+about)\s+(.+)/i, key: 'complaint' },
    { pattern: /(?:last\s+time\s+(?:you|the)\s+(?:order|delivery|service))\s+(.+)/i, key: 'past_issue' },
    { pattern: /(?:this\s+is\s+the\s+(\d+)(?:st|nd|rd|th)\s+time)/i, key: 'repeat_issue' },
  ],
};

// Promise detection patterns
const PROMISE_PATTERNS = [
  /(?:i(?:'ll|\s+will))\s+(.+)/i,
  /(?:let\s+me)\s+(.+)/i,
  /(?:i'm\s+going\s+to)\s+(.+)/i,
  /(?:we(?:'ll|\s+will))\s+(.+)/i,
];

/**
 * Service for managing persistent customer memory across conversations
 */
export class CustomerMemoryService {
  /**
   * Store a new fact about a customer
   */
  async storeFact(
    customerId: string,
    teamId: string,
    fact: CustomerFact
  ): Promise<CustomerMemory> {
    try {
      const memory = await prisma.customerMemory.upsert({
        where: {
          customerId_factType_factKey: {
            customerId,
            factType: fact.factType,
            factKey: fact.factKey,
          },
        },
        create: {
          customerId,
          teamId,
          factType: fact.factType,
          factKey: fact.factKey,
          factValue: fact.factValue,
          confidence: fact.confidence ?? 1.0,
          source: fact.source,
          expiresAt: fact.expiresAt,
          learnedAt: new Date(),
        },
        update: {
          factValue: fact.factValue,
          confidence: fact.confidence ?? 1.0,
          source: fact.source,
          expiresAt: fact.expiresAt,
          isActive: true,
        },
      });

      logger.info(`Stored fact for customer ${customerId}: ${fact.factType}/${fact.factKey}`);
      return memory;
    } catch (error) {
      logger.error('Error storing customer fact', error);
      throw error;
    }
  }

  /**
   * Get facts about a customer with optional filters
   */
  async getFacts(
    customerId: string,
    teamId: string,
    filters?: FactFilters
  ): Promise<CustomerMemory[]> {
    try {
      const where: any = {
        customerId,
        teamId,
      };

      if (filters?.factType) {
        where.factType = filters.factType;
      }

      if (filters?.factKey) {
        where.factKey = filters.factKey;
      }

      if (filters?.activeOnly !== false) {
        where.isActive = true;
        where.OR = [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ];
      }

      return await prisma.customerMemory.findMany({
        where,
        orderBy: { learnedAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error getting customer facts', error);
      return [];
    }
  }

  /**
   * Update an existing fact
   */
  async updateFact(
    memoryId: string,
    updates: Partial<Pick<CustomerFact, 'factValue' | 'confidence' | 'expiresAt'>>
  ): Promise<CustomerMemory | null> {
    try {
      return await prisma.customerMemory.update({
        where: { id: memoryId },
        data: updates,
      });
    } catch (error) {
      logger.error('Error updating customer fact', error);
      return null;
    }
  }

  /**
   * Deactivate a fact (soft delete)
   */
  async expireFact(memoryId: string): Promise<void> {
    try {
      await prisma.customerMemory.update({
        where: { id: memoryId },
        data: { isActive: false },
      });
    } catch (error) {
      logger.error('Error expiring customer fact', error);
    }
  }

  /**
   * Extract facts from a transcript using pattern matching
   */
  extractFactsFromTranscript(transcript: string): ExtractedFact[] {
    const facts: ExtractedFact[] = [];

    // Extract preferences
    for (const { pattern, key } of FACT_PATTERNS.preference) {
      const match = transcript.match(pattern);
      if (match) {
        facts.push({
          factType: 'preference',
          factKey: key,
          factValue: match[1] || match[0],
          confidence: 0.8,
        });
      }
    }

    // Extract personal info
    for (const { pattern, key } of FACT_PATTERNS.personal_info) {
      const match = transcript.match(pattern);
      if (match) {
        facts.push({
          factType: 'personal_info',
          factKey: key,
          factValue: match[1] || match[0],
          confidence: 0.9,
        });
      }
    }

    // Extract issues
    for (const { pattern, key } of FACT_PATTERNS.issue) {
      const match = transcript.match(pattern);
      if (match) {
        facts.push({
          factType: 'issue',
          factKey: key,
          factValue: match[1] || match[0],
          confidence: 0.85,
        });
      }
    }

    return facts;
  }

  /**
   * Process transcript and store extracted facts
   */
  async categorizeAndStoreFacts(
    customerId: string,
    teamId: string,
    callId: string,
    transcript: string
  ): Promise<CustomerMemory[]> {
    const extractedFacts = this.extractFactsFromTranscript(transcript);
    const storedFacts: CustomerMemory[] = [];

    for (const fact of extractedFacts) {
      try {
        const stored = await this.storeFact(customerId, teamId, {
          ...fact,
          source: callId,
        });
        storedFacts.push(stored);
      } catch (error) {
        logger.error(`Error storing extracted fact: ${fact.factKey}`, error);
      }
    }

    return storedFacts;
  }

  /**
   * Track a promise made by AI during conversation
   */
  async trackPromise(
    customerId: string,
    teamId: string,
    promise: string,
    callId: string
  ): Promise<CustomerMemory> {
    // Create unique key based on promise content
    const promiseKey = `promise_${Date.now()}`;

    return await this.storeFact(customerId, teamId, {
      factType: 'promise',
      factKey: promiseKey,
      factValue: promise,
      confidence: 1.0,
      source: callId,
      // Promises expire after 7 days by default
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  /**
   * Extract promises from AI response text
   */
  extractPromisesFromText(text: string): string[] {
    const promises: string[] = [];

    for (const pattern of PROMISE_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) {
        promises.push(match[1].trim());
      }
    }

    return promises;
  }

  /**
   * Get unfulfilled promises for a customer
   */
  async checkUnfulfilledPromises(
    customerId: string,
    teamId: string
  ): Promise<CustomerMemory[]> {
    return await this.getFacts(customerId, teamId, {
      factType: 'promise',
      activeOnly: true,
    });
  }

  /**
   * Mark a promise as fulfilled
   */
  async fulfillPromise(memoryId: string): Promise<void> {
    await this.expireFact(memoryId);
    logger.info(`Promise fulfilled: ${memoryId}`);
  }

  /**
   * Link an issue to past issues for the customer
   */
  async linkIssueToHistory(
    customerId: string,
    teamId: string,
    issue: string,
    callId: string
  ): Promise<string[]> {
    // Get past issues
    const pastIssues = await this.getFacts(customerId, teamId, {
      factType: 'issue',
      activeOnly: true,
    });

    // Store current issue
    await this.storeFact(customerId, teamId, {
      factType: 'issue',
      factKey: `issue_${Date.now()}`,
      factValue: issue,
      source: callId,
    });

    // Return related past issues
    return pastIssues.map(i => i.factValue);
  }

  /**
   * Get a comprehensive memory summary for AI context injection
   */
  async getMemorySummary(
    customerId: string,
    teamId: string
  ): Promise<MemorySummary> {
    const allFacts = await this.getFacts(customerId, teamId);

    // Get customer info
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        orders: {
          orderBy: { orderTime: 'desc' },
          take: 1,
        },
      },
    });

    const preferences = allFacts
      .filter(f => f.factType === 'preference')
      .map(f => ({ key: f.factKey, value: f.factValue }));

    const pastIssues = allFacts
      .filter(f => f.factType === 'issue')
      .map(f => ({ issue: f.factValue, when: f.learnedAt }));

    const unfulfilledPromises = allFacts
      .filter(f => f.factType === 'promise')
      .map(f => ({ promise: f.factValue, madeAt: f.learnedAt }));

    const personalNotes = allFacts
      .filter(f => f.factType === 'personal_info' || f.factType === 'interaction_note')
      .map(f => `${f.factKey}: ${f.factValue}`);

    return {
      customerId,
      name: customer?.name || undefined,
      preferences,
      pastIssues,
      unfulfilledPromises,
      personalNotes,
      interactionCount: allFacts.length,
      lastInteraction: customer?.orders[0]?.orderTime || undefined,
    };
  }

  /**
   * Generate a natural language summary for AI prompt injection
   */
  async generateNaturalSummary(
    customerId: string,
    teamId: string
  ): Promise<string> {
    const summary = await this.getMemorySummary(customerId, teamId);
    const parts: string[] = [];

    if (summary.name) {
      parts.push(`Customer name: ${summary.name}`);
    }

    if (summary.preferences.length > 0) {
      const prefs = summary.preferences.map(p => `${p.key}: ${p.value}`).join(', ');
      parts.push(`Known preferences: ${prefs}`);
    }

    if (summary.pastIssues.length > 0) {
      const issues = summary.pastIssues.slice(0, 3).map(i => i.issue).join('; ');
      parts.push(`Past issues: ${issues}`);
    }

    if (summary.unfulfilledPromises.length > 0) {
      const promises = summary.unfulfilledPromises.map(p => p.promise).join('; ');
      parts.push(`IMPORTANT - Unfulfilled promises to follow up on: ${promises}`);
    }

    if (summary.personalNotes.length > 0) {
      parts.push(`Personal notes: ${summary.personalNotes.join(', ')}`);
    }

    if (parts.length === 0) {
      return 'No prior history with this customer.';
    }

    return parts.join('\n');
  }
}

export const customerMemoryService = new CustomerMemoryService();
