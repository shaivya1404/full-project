import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Types
export interface Problem {
  type: ProblemType;
  description: string;
  confidence: number;
  evidence: string[];
}

export type ProblemType =
  | 'order_issue'
  | 'delivery_issue'
  | 'product_issue'
  | 'billing_issue'
  | 'service_issue'
  | 'technical_issue'
  | 'communication_issue'
  | 'unknown';

export interface RootCauseAnalysis {
  identifiedProblems: Problem[];
  rootCause: string | null;
  rootCauseConfidence: number;
  contributingFactors: string[];
  suggestedResolution: string | null;
  resolutionSteps: string[];
  isResolvableByAI: boolean;
  requiresHumanIntervention: boolean;
  relatedPastIssues: any[];
}

export interface ProblemPattern {
  type: ProblemType;
  keywords: string[];
  phrases: string[];
  indicators: string[];
}

// Problem detection patterns
const PROBLEM_PATTERNS: ProblemPattern[] = [
  {
    type: 'order_issue',
    keywords: ['order', 'ordered', 'purchase', 'bought', 'received'],
    phrases: [
      'wrong order',
      'didn\'t receive',
      'order missing',
      'incomplete order',
      'cancelled order',
      'order status',
      'where is my order',
    ],
    indicators: ['missing items', 'wrong items', 'order not placed', 'order cancelled'],
  },
  {
    type: 'delivery_issue',
    keywords: ['delivery', 'delivered', 'shipping', 'arrived', 'late'],
    phrases: [
      'not delivered',
      'late delivery',
      'wrong address',
      'delivery time',
      'tracking',
      'courier',
      'hasn\'t arrived',
    ],
    indicators: ['delay', 'lost package', 'wrong location', 'damaged in transit'],
  },
  {
    type: 'product_issue',
    keywords: ['product', 'item', 'quality', 'damaged', 'broken', 'defective'],
    phrases: [
      'doesn\'t work',
      'poor quality',
      'not as described',
      'expired',
      'wrong size',
      'wrong color',
    ],
    indicators: ['defect', 'malfunction', 'mismatch', 'quality issue'],
  },
  {
    type: 'billing_issue',
    keywords: ['charge', 'charged', 'payment', 'bill', 'price', 'refund'],
    phrases: [
      'overcharged',
      'double charged',
      'wrong amount',
      'didn\'t authorize',
      'refund pending',
      'price difference',
    ],
    indicators: ['incorrect amount', 'unauthorized charge', 'missing refund'],
  },
  {
    type: 'service_issue',
    keywords: ['service', 'support', 'help', 'agent', 'representative'],
    phrases: [
      'rude service',
      'not helpful',
      'no response',
      'waiting too long',
      'promised but',
      'told different',
    ],
    indicators: ['miscommunication', 'poor service', 'broken promise'],
  },
  {
    type: 'technical_issue',
    keywords: ['app', 'website', 'login', 'error', 'crash', 'bug'],
    phrases: [
      'can\'t login',
      'app crashed',
      'website down',
      'error message',
      'not loading',
      'technical problem',
    ],
    indicators: ['system error', 'technical failure', 'functionality issue'],
  },
  {
    type: 'communication_issue',
    keywords: ['told', 'said', 'promised', 'email', 'notification', 'update'],
    phrases: [
      'wasn\'t informed',
      'no notification',
      'conflicting information',
      'different from what',
      'never received',
    ],
    indicators: ['missing communication', 'wrong information', 'no updates'],
  },
];

// Resolution templates by problem type
const RESOLUTION_TEMPLATES: Record<ProblemType, { steps: string[]; aiResolvable: boolean }> = {
  order_issue: {
    steps: [
      'Verify order details in system',
      'Check order status and history',
      'Identify what went wrong',
      'Offer correction or replacement',
      'Provide updated timeline',
    ],
    aiResolvable: true,
  },
  delivery_issue: {
    steps: [
      'Check delivery tracking information',
      'Verify delivery address',
      'Contact delivery partner if needed',
      'Provide updated delivery estimate',
      'Offer alternatives if severely delayed',
    ],
    aiResolvable: true,
  },
  product_issue: {
    steps: [
      'Document the product issue',
      'Check return/exchange policy',
      'Initiate return or replacement',
      'Arrange pickup if needed',
      'Process refund or exchange',
    ],
    aiResolvable: true,
  },
  billing_issue: {
    steps: [
      'Review transaction history',
      'Identify billing discrepancy',
      'Verify correct charges',
      'Process refund if applicable',
      'Confirm resolution with customer',
    ],
    aiResolvable: true,
  },
  service_issue: {
    steps: [
      'Acknowledge the service failure',
      'Document the incident',
      'Escalate for internal review',
      'Offer appropriate compensation',
      'Follow up to ensure satisfaction',
    ],
    aiResolvable: false,
  },
  technical_issue: {
    steps: [
      'Identify the technical problem',
      'Check for known issues',
      'Provide workaround if available',
      'Escalate to technical team if needed',
      'Follow up on resolution',
    ],
    aiResolvable: false,
  },
  communication_issue: {
    steps: [
      'Clarify the correct information',
      'Identify communication breakdown point',
      'Provide accurate details',
      'Set expectations clearly',
      'Document for process improvement',
    ],
    aiResolvable: true,
  },
  unknown: {
    steps: [
      'Gather more information from customer',
      'Identify the core issue',
      'Determine appropriate resolution path',
      'Escalate if unable to resolve',
    ],
    aiResolvable: false,
  },
};

/**
 * Service for root cause analysis of customer issues
 */
export class RootCauseService {
  /**
   * Analyze conversation to identify problems and root cause
   */
  analyzeConversation(transcript: string, context?: any): RootCauseAnalysis {
    const normalizedText = transcript.toLowerCase();
    const identifiedProblems: Problem[] = [];

    // Detect problems from transcript
    for (const pattern of PROBLEM_PATTERNS) {
      const problem = this.detectProblem(normalizedText, pattern);
      if (problem) {
        identifiedProblems.push(problem);
      }
    }

    // Sort by confidence
    identifiedProblems.sort((a, b) => b.confidence - a.confidence);

    // Determine root cause (highest confidence problem)
    const rootCause = identifiedProblems.length > 0 ? identifiedProblems[0] : null;

    // Get resolution steps
    const resolutionTemplate = rootCause
      ? RESOLUTION_TEMPLATES[rootCause.type]
      : RESOLUTION_TEMPLATES.unknown;

    // Extract contributing factors
    const contributingFactors = this.extractContributingFactors(
      identifiedProblems,
      normalizedText
    );

    // Generate suggested resolution
    const suggestedResolution = rootCause
      ? this.generateResolutionSuggestion(rootCause, context)
      : null;

    return {
      identifiedProblems,
      rootCause: rootCause?.description || null,
      rootCauseConfidence: rootCause?.confidence || 0,
      contributingFactors,
      suggestedResolution,
      resolutionSteps: resolutionTemplate.steps,
      isResolvableByAI: resolutionTemplate.aiResolvable,
      requiresHumanIntervention: !resolutionTemplate.aiResolvable || identifiedProblems.length > 2,
      relatedPastIssues: [],
    };
  }

  /**
   * Detect a specific problem type in text
   */
  private detectProblem(text: string, pattern: ProblemPattern): Problem | null {
    let score = 0;
    const evidence: string[] = [];

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (text.includes(keyword)) {
        score += 1;
        evidence.push(`Keyword: "${keyword}"`);
      }
    }

    // Check phrases (weighted higher)
    for (const phrase of pattern.phrases) {
      if (text.includes(phrase)) {
        score += 3;
        evidence.push(`Phrase: "${phrase}"`);
      }
    }

    // Check indicators
    for (const indicator of pattern.indicators) {
      if (text.includes(indicator)) {
        score += 2;
        evidence.push(`Indicator: "${indicator}"`);
      }
    }

    // Require minimum score to avoid false positives
    if (score < 3) return null;

    // Calculate confidence (max score ~15)
    const confidence = Math.min(score / 10, 1);

    return {
      type: pattern.type,
      description: this.getProblemDescription(pattern.type),
      confidence,
      evidence,
    };
  }

  /**
   * Get human-readable problem description
   */
  private getProblemDescription(type: ProblemType): string {
    const descriptions: Record<ProblemType, string> = {
      order_issue: 'Issue with order processing or fulfillment',
      delivery_issue: 'Problem with delivery or shipping',
      product_issue: 'Product quality or specification issue',
      billing_issue: 'Billing or payment discrepancy',
      service_issue: 'Customer service experience issue',
      technical_issue: 'Technical or system problem',
      communication_issue: 'Communication or information issue',
      unknown: 'Unidentified issue',
    };
    return descriptions[type];
  }

  /**
   * Extract contributing factors from multiple problems
   */
  private extractContributingFactors(problems: Problem[], text: string): string[] {
    const factors: string[] = [];

    // If multiple problems detected, they contribute to each other
    if (problems.length > 1) {
      factors.push('Multiple issues contributing to customer frustration');
    }

    // Check for escalation indicators
    const escalationPhrases = ['multiple times', 'called before', 'told you', 'again'];
    for (const phrase of escalationPhrases) {
      if (text.includes(phrase)) {
        factors.push('Recurring issue requiring follow-up');
        break;
      }
    }

    // Check for urgency indicators
    const urgencyPhrases = ['urgent', 'immediately', 'asap', 'right now', 'emergency'];
    for (const phrase of urgencyPhrases) {
      if (text.includes(phrase)) {
        factors.push('Time-sensitive situation requiring priority handling');
        break;
      }
    }

    // Check for emotional escalation
    const emotionalPhrases = ['frustrated', 'angry', 'upset', 'disappointed'];
    for (const phrase of emotionalPhrases) {
      if (text.includes(phrase)) {
        factors.push('Emotional state requiring empathetic handling');
        break;
      }
    }

    return factors;
  }

  /**
   * Generate resolution suggestion based on problem and context
   */
  private generateResolutionSuggestion(problem: Problem, context?: any): string {
    const suggestions: Record<ProblemType, string> = {
      order_issue: 'I can help resolve this by checking your order and making necessary corrections.',
      delivery_issue: 'Let me track your delivery and provide you with the latest status.',
      product_issue: 'I can arrange a return or replacement for the affected product.',
      billing_issue: 'I\'ll review your charges and process any necessary adjustments or refunds.',
      service_issue: 'I apologize for your experience. Let me ensure we address your concerns properly.',
      technical_issue: 'I\'ll help troubleshoot this issue or connect you with technical support.',
      communication_issue: 'Let me clarify the correct information and ensure you have accurate details.',
      unknown: 'Let me gather more information to better understand and resolve your concern.',
    };

    return suggestions[problem.type];
  }

  /**
   * Look up related past issues for a customer
   */
  async getRelatedPastIssues(customerId: string, problemType?: ProblemType): Promise<any[]> {
    try {
      const recentCalls = await prisma.call.findMany({
        where: {
          orders: {
            some: {
              customerId,
            },
          },
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
          },
        },
        include: {
          transcripts: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Analyze past calls for similar issues
      const relatedIssues = [];
      for (const call of recentCalls) {
        const transcriptText = call.transcripts?.map((t: any) => t.text).join(' ') || '';
        if (problemType) {
          const pattern = PROBLEM_PATTERNS.find(p => p.type === problemType);
          if (pattern) {
            const problem = this.detectProblem(transcriptText.toLowerCase(), pattern);
            if (problem) {
              relatedIssues.push({
                callId: call.id,
                date: call.createdAt,
                problem: problem.type,
                confidence: problem.confidence,
              });
            }
          }
        }
      }

      return relatedIssues;
    } catch (error) {
      logger.error('Error getting related past issues', error);
      return [];
    }
  }

  /**
   * Analyze issue severity
   */
  analyzeSeverity(analysis: RootCauseAnalysis, customerContext?: any): 'low' | 'medium' | 'high' | 'critical' {
    let severityScore = 0;

    // Multiple problems increase severity
    severityScore += analysis.identifiedProblems.length * 10;

    // High confidence root cause increases severity
    severityScore += analysis.rootCauseConfidence * 20;

    // Billing issues are more severe
    if (analysis.identifiedProblems.some(p => p.type === 'billing_issue')) {
      severityScore += 15;
    }

    // Contributing factors add to severity
    severityScore += analysis.contributingFactors.length * 5;

    // Customer tier affects severity
    if (customerContext?.tier === 'vip') {
      severityScore += 20;
    } else if (customerContext?.tier === 'premium') {
      severityScore += 10;
    }

    // Determine severity level
    if (severityScore >= 60) return 'critical';
    if (severityScore >= 40) return 'high';
    if (severityScore >= 20) return 'medium';
    return 'low';
  }

  /**
   * Get recommended actions based on analysis
   */
  getRecommendedActions(analysis: RootCauseAnalysis): string[] {
    const actions: string[] = [];

    // Primary action based on root cause
    if (analysis.suggestedResolution) {
      actions.push(analysis.suggestedResolution);
    }

    // Add resolution steps
    actions.push(...analysis.resolutionSteps.slice(0, 3));

    // Add escalation action if needed
    if (analysis.requiresHumanIntervention) {
      actions.push('Consider transferring to a human agent for complex resolution');
    }

    // Add follow-up action
    actions.push('Follow up to ensure customer satisfaction');

    return actions;
  }
}

export const rootCauseService = new RootCauseService();
