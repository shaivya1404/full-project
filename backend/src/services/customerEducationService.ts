import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Types
export type EducationTopic =
  | 'product_usage'
  | 'feature_explanation'
  | 'troubleshooting'
  | 'policy_explanation'
  | 'service_walkthrough'
  | 'faq_response'
  | 'process_guide'
  | 'best_practices';

export interface EducationContent {
  topic: EducationTopic;
  title: string;
  steps: EducationStep[];
  estimatedDuration: string;
  complexity: 'simple' | 'moderate' | 'complex';
  prerequisites?: string[];
  relatedTopics?: string[];
}

export interface EducationStep {
  stepNumber: number;
  instruction: string;
  spokenScript: string;
  confirmationQuestion?: string;
  commonQuestions?: string[];
  tips?: string[];
}

export interface EducationSession {
  id: string;
  customerId: string;
  callId: string;
  topic: EducationTopic;
  currentStep: number;
  totalSteps: number;
  isComplete: boolean;
  startedAt: Date;
  completedAt?: Date;
  feedback?: 'helpful' | 'somewhat_helpful' | 'not_helpful';
}

export interface ConfusionIndicator {
  detected: boolean;
  confidence: number;
  type: 'verbal' | 'hesitation' | 'repetition' | 'question';
  suggestedResponse: string;
}

// Education content library
const EDUCATION_LIBRARY: Record<string, EducationContent> = {
  // Order tracking
  order_tracking: {
    topic: 'process_guide',
    title: 'How to Track Your Order',
    steps: [
      {
        stepNumber: 1,
        instruction: 'Find order confirmation',
        spokenScript: "First, you'll need your order confirmation number. This was sent to your email when you placed the order. Do you have that handy?",
        confirmationQuestion: 'Do you have your order number?',
        tips: ['Check your spam folder if you can\'t find the email'],
      },
      {
        stepNumber: 2,
        instruction: 'Access tracking',
        spokenScript: 'Great! Now you can either click the tracking link in that email, or visit our website and go to "Track Order" from the menu. Which would you prefer?',
        commonQuestions: ['Where is track order on the website?', 'What if the link doesn\'t work?'],
      },
      {
        stepNumber: 3,
        instruction: 'Enter details',
        spokenScript: 'Enter your order number and the phone number you used when ordering. Then click "Track" and you\'ll see your order status.',
        confirmationQuestion: 'Were you able to see your order status?',
      },
    ],
    estimatedDuration: '2 minutes',
    complexity: 'simple',
    relatedTopics: ['delivery_status', 'order_modification'],
  },

  // Return process
  return_process: {
    topic: 'process_guide',
    title: 'How to Return a Product',
    steps: [
      {
        stepNumber: 1,
        instruction: 'Check return eligibility',
        spokenScript: 'Before we start, let me check if your item is eligible for return. Returns are accepted within 7 days of delivery for most products. When did you receive the item?',
        tips: ['Some products like food items may not be returnable'],
      },
      {
        stepNumber: 2,
        instruction: 'Initiate return request',
        spokenScript: 'Perfect, you\'re within the return window. To start the return, go to "My Orders" on our app or website, find this order, and tap "Return Item". I can also initiate it for you right now if you prefer.',
        confirmationQuestion: 'Would you like me to initiate the return for you?',
      },
      {
        stepNumber: 3,
        instruction: 'Schedule pickup',
        spokenScript: 'Once the return is initiated, you can schedule a pickup. Our delivery partner will come to collect the item. Please have it packed in its original packaging if possible.',
        tips: ['Keep the item in its original packaging', 'Include all accessories'],
      },
      {
        stepNumber: 4,
        instruction: 'Refund timeline',
        spokenScript: 'After we receive and inspect the item, your refund will be processed within 3-5 business days back to your original payment method. I\'ll send you a confirmation when it\'s done.',
        confirmationQuestion: 'Do you have any questions about the return process?',
      },
    ],
    estimatedDuration: '5 minutes',
    complexity: 'moderate',
    prerequisites: ['Order must be delivered', 'Within return window'],
    relatedTopics: ['refund_status', 'exchange_process'],
  },

  // App features
  app_features: {
    topic: 'feature_explanation',
    title: 'Key App Features',
    steps: [
      {
        stepNumber: 1,
        instruction: 'Quick reorder',
        spokenScript: 'Did you know you can reorder your favorite items with just one tap? On the home screen, you\'ll see a "Reorder" section showing your past orders. Just tap the one you want and confirm!',
        confirmationQuestion: 'Would you like me to explain any other feature?',
      },
      {
        stepNumber: 2,
        instruction: 'Saved addresses',
        spokenScript: 'You can save multiple delivery addresses - like home and office - so you don\'t have to type them each time. Go to "Profile" and then "Saved Addresses" to add them.',
        tips: ['Set a default address for faster checkout'],
      },
      {
        stepNumber: 3,
        instruction: 'Order scheduling',
        spokenScript: 'You can also schedule orders for later! When checking out, instead of "Deliver Now", choose "Schedule for Later" and pick your preferred date and time.',
        confirmationQuestion: 'Have you tried scheduling an order before?',
      },
    ],
    estimatedDuration: '3 minutes',
    complexity: 'simple',
    relatedTopics: ['payment_methods', 'notifications'],
  },

  // Payment methods
  payment_methods: {
    topic: 'feature_explanation',
    title: 'Payment Options',
    steps: [
      {
        stepNumber: 1,
        instruction: 'Available options',
        spokenScript: 'We accept several payment methods: credit/debit cards, UPI apps like GPay and PhonePe, net banking, and cash on delivery. Which would you like to know more about?',
      },
      {
        stepNumber: 2,
        instruction: 'Saving cards',
        spokenScript: 'To make future checkouts faster, you can save your card securely. Just check the "Save this card" option during payment. Your card details are encrypted for security.',
        tips: ['You can remove saved cards anytime from Settings'],
      },
      {
        stepNumber: 3,
        instruction: 'UPI setup',
        spokenScript: 'For UPI, you can either enter your UPI ID or scan a QR code. You can also save your UPI ID for quicker payments next time.',
        confirmationQuestion: 'Do you need help with any specific payment method?',
      },
    ],
    estimatedDuration: '3 minutes',
    complexity: 'simple',
    relatedTopics: ['refund_status', 'payment_issues'],
  },

  // Subscription explanation
  subscription: {
    topic: 'feature_explanation',
    title: 'Subscription Benefits',
    steps: [
      {
        stepNumber: 1,
        instruction: 'What is included',
        spokenScript: 'Our subscription gives you free delivery on all orders, priority customer support, and exclusive member discounts. Would you like to hear more about any of these benefits?',
      },
      {
        stepNumber: 2,
        instruction: 'Pricing',
        spokenScript: 'The subscription costs just Rs 199 per month, or Rs 999 for a full year - that\'s like getting 5 months free! Most customers save much more than that on delivery alone.',
        tips: ['Calculate savings based on average orders'],
      },
      {
        stepNumber: 3,
        instruction: 'How to subscribe',
        spokenScript: 'You can subscribe right from the app - go to "Profile" and tap "Subscribe". You\'ll start getting benefits immediately. Would you like me to help you with that?',
        confirmationQuestion: 'Would you like to try the subscription?',
      },
    ],
    estimatedDuration: '3 minutes',
    complexity: 'simple',
    relatedTopics: ['loyalty_program', 'member_discounts'],
  },
};

/**
 * Service for customer education during calls
 * Teaches customers about products, features, and processes
 */
export class CustomerEducationService {
  private activeSessions: Map<string, EducationSession> = new Map();

  /**
   * Start an education session
   */
  startSession(
    customerId: string,
    callId: string,
    topicKey: string
  ): { session: EducationSession; content: EducationContent } | null {
    const content = EDUCATION_LIBRARY[topicKey];
    if (!content) {
      logger.warn(`Education topic not found: ${topicKey}`);
      return null;
    }

    const session: EducationSession = {
      id: `edu_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      customerId,
      callId,
      topic: content.topic,
      currentStep: 0,
      totalSteps: content.steps.length,
      isComplete: false,
      startedAt: new Date(),
    };

    this.activeSessions.set(callId, session);

    logger.info(`Education session started: ${session.id} for topic ${topicKey}`);

    return { session, content };
  }

  /**
   * Get current step in education session
   */
  getCurrentStep(callId: string): { step: EducationStep; session: EducationSession } | null {
    const session = this.activeSessions.get(callId);
    if (!session || session.isComplete) return null;

    // Find content for this session's topic
    const content = Object.values(EDUCATION_LIBRARY).find(c => c.topic === session.topic);
    if (!content) return null;

    const step = content.steps[session.currentStep];
    return { step, session };
  }

  /**
   * Move to next step in education
   */
  nextStep(callId: string): { step: EducationStep | null; isComplete: boolean; session: EducationSession } | null {
    const session = this.activeSessions.get(callId);
    if (!session) return null;

    // Find content
    const content = Object.values(EDUCATION_LIBRARY).find(c => c.topic === session.topic);
    if (!content) return null;

    session.currentStep += 1;

    if (session.currentStep >= content.steps.length) {
      session.isComplete = true;
      session.completedAt = new Date();
      return { step: null, isComplete: true, session };
    }

    return {
      step: content.steps[session.currentStep],
      isComplete: false,
      session,
    };
  }

  /**
   * Detect customer confusion from transcript
   */
  detectConfusion(transcript: string): ConfusionIndicator {
    const normalizedText = transcript.toLowerCase();

    // Verbal confusion indicators
    const confusionPhrases = [
      { phrase: 'i don\'t understand', type: 'verbal' as const, confidence: 0.9 },
      { phrase: 'what do you mean', type: 'verbal' as const, confidence: 0.85 },
      { phrase: 'i\'m confused', type: 'verbal' as const, confidence: 0.95 },
      { phrase: 'can you repeat', type: 'verbal' as const, confidence: 0.7 },
      { phrase: 'say that again', type: 'verbal' as const, confidence: 0.7 },
      { phrase: 'wait what', type: 'verbal' as const, confidence: 0.8 },
      { phrase: 'huh', type: 'verbal' as const, confidence: 0.6 },
      { phrase: 'sorry', type: 'verbal' as const, confidence: 0.5 },
      { phrase: 'too fast', type: 'verbal' as const, confidence: 0.8 },
      { phrase: 'slow down', type: 'verbal' as const, confidence: 0.85 },
    ];

    // Question patterns that indicate confusion
    const questionPatterns = [
      { pattern: /where (do|can|should) i/i, type: 'question' as const, confidence: 0.7 },
      { pattern: /how (do|can|should) i/i, type: 'question' as const, confidence: 0.7 },
      { pattern: /what (is|does|should)/i, type: 'question' as const, confidence: 0.6 },
      { pattern: /which (one|button|option)/i, type: 'question' as const, confidence: 0.7 },
    ];

    // Check confusion phrases
    for (const { phrase, type, confidence } of confusionPhrases) {
      if (normalizedText.includes(phrase)) {
        return {
          detected: true,
          confidence,
          type,
          suggestedResponse: this.getConfusionResponse(type, phrase),
        };
      }
    }

    // Check question patterns
    for (const { pattern, type, confidence } of questionPatterns) {
      if (pattern.test(normalizedText)) {
        return {
          detected: true,
          confidence,
          type,
          suggestedResponse: this.getConfusionResponse(type),
        };
      }
    }

    return {
      detected: false,
      confidence: 0,
      type: 'verbal',
      suggestedResponse: '',
    };
  }

  /**
   * Get appropriate response to confusion
   */
  private getConfusionResponse(type: string, trigger?: string): string {
    const responses = {
      verbal: [
        "No problem, let me explain that differently.",
        "I'll slow down a bit. Let me break this down step by step.",
        "That's totally fine - this can be a bit tricky. Let me make it simpler.",
      ],
      hesitation: [
        "Take your time - there's no rush.",
        "Would you like me to repeat that?",
        "Let me know when you're ready for the next step.",
      ],
      repetition: [
        "I notice you mentioned that before - let me clarify.",
        "I want to make sure I'm being clear.",
      ],
      question: [
        "Great question! Let me explain.",
        "I'm happy to clarify that.",
      ],
    };

    const responseList = responses[type as keyof typeof responses] || responses.verbal;
    return responseList[Math.floor(Math.random() * responseList.length)];
  }

  /**
   * Adapt explanation based on customer's understanding level
   */
  adaptExplanation(
    originalScript: string,
    understandingLevel: 'beginner' | 'intermediate' | 'advanced'
  ): string {
    if (understandingLevel === 'beginner') {
      // Simplify language, add more context
      return this.simplifyExplanation(originalScript);
    } else if (understandingLevel === 'advanced') {
      // Be more direct, skip obvious details
      return this.condenseExplanation(originalScript);
    }
    return originalScript;
  }

  /**
   * Simplify explanation for beginners
   */
  private simplifyExplanation(script: string): string {
    // Add clarifying phrases
    const simplifications: [RegExp, string][] = [
      [/click/gi, 'tap or click'],
      [/navigate/gi, 'go'],
      [/select/gi, 'choose'],
      [/proceed/gi, 'continue'],
      [/configure/gi, 'set up'],
      [/authenticate/gi, 'confirm your identity'],
    ];

    let simplified = script;
    for (const [pattern, replacement] of simplifications) {
      simplified = simplified.replace(pattern, replacement);
    }

    return simplified;
  }

  /**
   * Condense explanation for advanced users
   */
  private condenseExplanation(script: string): string {
    // Remove obvious instructions
    const redundantPhrases = [
      /you'll need to /gi,
      /you can /gi,
      /what you do is /gi,
      /first,? /gi,
      /then,? /gi,
      /after that,? /gi,
    ];

    let condensed = script;
    for (const pattern of redundantPhrases) {
      condensed = condensed.replace(pattern, '');
    }

    return condensed.trim();
  }

  /**
   * Get available education topics
   */
  getAvailableTopics(): { key: string; title: string; duration: string; complexity: string }[] {
    return Object.entries(EDUCATION_LIBRARY).map(([key, content]) => ({
      key,
      title: content.title,
      duration: content.estimatedDuration,
      complexity: content.complexity,
    }));
  }

  /**
   * Get education content by key
   */
  getContent(topicKey: string): EducationContent | null {
    return EDUCATION_LIBRARY[topicKey] || null;
  }

  /**
   * Find relevant education topic based on customer's question
   */
  findRelevantTopic(question: string): { topicKey: string; content: EducationContent; relevance: number } | null {
    const normalizedQuestion = question.toLowerCase();
    let bestMatch: { topicKey: string; content: EducationContent; relevance: number } | null = null;

    const topicKeywords: Record<string, string[]> = {
      order_tracking: ['track', 'where', 'order', 'status', 'delivery', 'when'],
      return_process: ['return', 'refund', 'send back', 'exchange', 'damaged'],
      app_features: ['app', 'feature', 'how to use', 'function', 'what can'],
      payment_methods: ['pay', 'payment', 'card', 'upi', 'cash', 'money'],
      subscription: ['subscription', 'member', 'premium', 'benefits', 'subscribe'],
    };

    for (const [topicKey, keywords] of Object.entries(topicKeywords)) {
      const matchCount = keywords.filter(kw => normalizedQuestion.includes(kw)).length;
      const relevance = matchCount / keywords.length;

      if (relevance > 0 && (!bestMatch || relevance > bestMatch.relevance)) {
        const content = EDUCATION_LIBRARY[topicKey];
        if (content) {
          bestMatch = { topicKey, content, relevance };
        }
      }
    }

    return bestMatch && bestMatch.relevance >= 0.3 ? bestMatch : null;
  }

  /**
   * End education session and record feedback
   */
  endSession(callId: string, feedback?: 'helpful' | 'somewhat_helpful' | 'not_helpful'): void {
    const session = this.activeSessions.get(callId);
    if (session) {
      session.isComplete = true;
      session.completedAt = new Date();
      session.feedback = feedback;

      logger.info(`Education session ended: ${session.id}`, {
        topic: session.topic,
        stepsCompleted: session.currentStep,
        totalSteps: session.totalSteps,
        feedback,
      });

      this.activeSessions.delete(callId);
    }
  }

  /**
   * Get session progress
   */
  getProgress(callId: string): { current: number; total: number; percentage: number } | null {
    const session = this.activeSessions.get(callId);
    if (!session) return null;

    return {
      current: session.currentStep + 1,
      total: session.totalSteps,
      percentage: Math.round(((session.currentStep + 1) / session.totalSteps) * 100),
    };
  }
}

export const customerEducationService = new CustomerEducationService();
