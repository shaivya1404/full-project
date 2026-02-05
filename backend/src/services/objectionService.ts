import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Objection type definitions with keywords
const OBJECTION_PATTERNS: Record<string, { keywords: string[]; category: string }> = {
  price: {
    keywords: ['expensive', 'costly', 'budget', 'afford', 'cheaper', 'too much', 'high price', 'discount'],
    category: 'financial'
  },
  timing: {
    keywords: ['later', 'busy', 'not now', 'call back', 'bad time', 'wrong time', 'in a meeting'],
    category: 'timing'
  },
  competitor: {
    keywords: ['other company', 'already using', 'comparing', 'alternative', 'competitor', 'another provider'],
    category: 'competition'
  },
  not_interested: {
    keywords: ['not interested', 'don\'t need', 'no thanks', 'don\'t want', 'not looking'],
    category: 'rejection'
  },
  need_time: {
    keywords: ['think about', 'consider', 'discuss', 'talk to', 'spouse', 'family', 'manager', 'get back'],
    category: 'decision'
  },
  trust: {
    keywords: ['scam', 'fraud', 'don\'t trust', 'never heard', 'is this legit', 'how do i know'],
    category: 'trust'
  },
  satisfaction: {
    keywords: ['happy with', 'satisfied', 'current provider', 'no complaints', 'working fine'],
    category: 'satisfaction'
  }
};

export interface ObjectionDetectionResult {
  detected: boolean;
  type?: string;
  confidence: number;
  matchedKeywords: string[];
  category?: string;
}

export interface ObjectionStats {
  totalObjections: number;
  resolvedCount: number;
  resolutionRate: number;
  byType: { type: string; count: number; resolvedCount: number }[];
  topKeywords: { keyword: string; count: number }[];
  averageResolutionTime: number; // in seconds
}

export class ObjectionService {
  /**
   * Detect objection from text
   */
  detectObjection(text: string): ObjectionDetectionResult {
    const lowerText = text.toLowerCase();
    let bestMatch: ObjectionDetectionResult = {
      detected: false,
      confidence: 0,
      matchedKeywords: []
    };

    for (const [objectionType, pattern] of Object.entries(OBJECTION_PATTERNS)) {
      const matchedKeywords: string[] = [];

      for (const keyword of pattern.keywords) {
        if (lowerText.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }

      if (matchedKeywords.length > 0) {
        const confidence = Math.min(1, matchedKeywords.length * 0.3 + 0.4);

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            detected: true,
            type: objectionType,
            confidence,
            matchedKeywords,
            category: pattern.category
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Get suggested response for an objection type
   */
  async getSuggestedResponse(teamId: string, objectionType: string): Promise<string | null> {
    // First try to get team-specific template
    const template = await prisma.objectionTemplate.findFirst({
      where: {
        teamId,
        objectionType,
        isActive: true
      },
      orderBy: { successRate: 'desc' }
    });

    if (template) {
      // Increment usage count
      await prisma.objectionTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 } }
      });
      return template.suggestedResponse;
    }

    // Return default response if no template
    return this.getDefaultResponse(objectionType);
  }

  /**
   * Get default response for objection type
   */
  private getDefaultResponse(objectionType: string): string | null {
    const defaults: Record<string, string> = {
      price: "I understand budget is important. Let me share some flexible options that might work better for you.",
      timing: "No problem at all. When would be a better time for me to call you back?",
      competitor: "That's great that you're exploring options. Can I share what makes us different?",
      not_interested: "I appreciate your time. May I ask what would make this more relevant for you?",
      need_time: "Absolutely, take your time. When should I follow up with you?",
      trust: "I completely understand your concern. We're a verified company and I can share our credentials.",
      satisfaction: "That's great to hear! We often help customers who were happy but found ways to save more."
    };

    return defaults[objectionType] || null;
  }

  /**
   * Log an objection from a call
   */
  async logObjection(
    callLogId: string,
    objectionType: string,
    objectionText?: string,
    responseUsed?: string
  ): Promise<void> {
    await prisma.callObjection.create({
      data: {
        callLogId,
        objectionType,
        objectionText,
        responseUsed,
        wasResolved: false
      }
    });

    logger.info(`Objection logged: ${objectionType} for call ${callLogId}`);
  }

  /**
   * Mark objection as resolved
   */
  async resolveObjection(objectionId: string, responseUsed?: string): Promise<void> {
    await prisma.callObjection.update({
      where: { id: objectionId },
      data: {
        wasResolved: true,
        resolvedAt: new Date(),
        responseUsed
      }
    });

    logger.info(`Objection ${objectionId} marked as resolved`);
  }

  /**
   * Get objection analytics
   */
  async getObjectionAnalytics(
    teamId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ObjectionStats> {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    // Get all objections through call logs
    const objections = await prisma.callObjection.findMany({
      where: {
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
        callLog: {
          campaign: {
            teamId
          }
        }
      },
      include: {
        callLog: true
      }
    });

    const totalObjections = objections.length;
    const resolvedCount = objections.filter(o => o.wasResolved).length;
    const resolutionRate = totalObjections > 0 ? (resolvedCount / totalObjections) * 100 : 0;

    // Group by type
    const byTypeMap: Record<string, { count: number; resolvedCount: number }> = {};
    const keywordCounts: Record<string, number> = {};

    for (const objection of objections) {
      // Count by type
      if (!byTypeMap[objection.objectionType]) {
        byTypeMap[objection.objectionType] = { count: 0, resolvedCount: 0 };
      }
      byTypeMap[objection.objectionType].count++;
      if (objection.wasResolved) {
        byTypeMap[objection.objectionType].resolvedCount++;
      }

      // Count keywords from objection text
      if (objection.objectionText) {
        const pattern = OBJECTION_PATTERNS[objection.objectionType];
        if (pattern) {
          for (const keyword of pattern.keywords) {
            if (objection.objectionText.toLowerCase().includes(keyword)) {
              keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
            }
          }
        }
      }
    }

    const byType = Object.entries(byTypeMap)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count);

    const topKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate average resolution time
    const resolvedWithTime = objections.filter(o => o.wasResolved && o.resolvedAt);
    const avgResolutionTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, o) => {
          const created = new Date(o.createdAt).getTime();
          const resolved = new Date(o.resolvedAt!).getTime();
          return sum + (resolved - created) / 1000;
        }, 0) / resolvedWithTime.length
      : 0;

    return {
      totalObjections,
      resolvedCount,
      resolutionRate: Math.round(resolutionRate * 10) / 10,
      byType,
      topKeywords,
      averageResolutionTime: Math.round(avgResolutionTime)
    };
  }

  /**
   * Create objection template
   */
  async createTemplate(
    teamId: string,
    objectionType: string,
    keywords: string[],
    suggestedResponse: string
  ): Promise<any> {
    return prisma.objectionTemplate.create({
      data: {
        teamId,
        objectionType,
        keywords: JSON.stringify(keywords),
        suggestedResponse,
        isActive: true
      }
    });
  }

  /**
   * Update objection template
   */
  async updateTemplate(
    templateId: string,
    data: {
      keywords?: string[];
      suggestedResponse?: string;
      isActive?: boolean;
    }
  ): Promise<any> {
    const updateData: any = {};
    if (data.keywords) updateData.keywords = JSON.stringify(data.keywords);
    if (data.suggestedResponse) updateData.suggestedResponse = data.suggestedResponse;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.objectionTemplate.update({
      where: { id: templateId },
      data: updateData
    });
  }

  /**
   * Delete objection template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await prisma.objectionTemplate.delete({
      where: { id: templateId }
    });
  }

  /**
   * Get all templates for a team
   */
  async getTemplates(teamId: string): Promise<any[]> {
    const templates = await prisma.objectionTemplate.findMany({
      where: { teamId },
      orderBy: [
        { objectionType: 'asc' },
        { successRate: 'desc' }
      ]
    });

    return templates.map(t => ({
      ...t,
      keywords: JSON.parse(t.keywords)
    }));
  }

  /**
   * Update template success rate based on resolution
   */
  async updateTemplateSuccess(templateId: string, wasSuccessful: boolean): Promise<void> {
    const template = await prisma.objectionTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) return;

    const totalUses = template.usageCount;
    const currentSuccessRate = template.successRate;
    const successfulUses = Math.round(currentSuccessRate * totalUses);

    const newSuccessfulUses = wasSuccessful ? successfulUses + 1 : successfulUses;
    const newSuccessRate = totalUses > 0 ? newSuccessfulUses / totalUses : 0;

    await prisma.objectionTemplate.update({
      where: { id: templateId },
      data: { successRate: newSuccessRate }
    });
  }

  /**
   * Get objection types
   */
  getObjectionTypes(): { type: string; category: string; keywords: string[] }[] {
    return Object.entries(OBJECTION_PATTERNS).map(([type, pattern]) => ({
      type,
      category: pattern.category,
      keywords: pattern.keywords
    }));
  }
}

export const objectionService = new ObjectionService();
