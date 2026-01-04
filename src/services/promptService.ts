import { KnowledgeService, KnowledgeContext } from './knowledgeService';
import { CampaignRepository } from '../db/repositories/campaignRepository';
import { logger } from '../utils/logger';

export interface SystemPromptTemplate {
  id: string;
  name: string;
  description: string;
  basePrompt: string;
  role: string;
  tone: string;
  knowledgeInjection: boolean;
  confidenceThreshold: number;
  language?: string;  // 'en' for English, 'hi' for Hindi
  welcomeMessage?: string;  // Custom welcome greeting
}

export interface DynamicPrompt {
  systemPrompt: string;
  knowledgeContext: KnowledgeContext;
  confidenceThreshold: number;
  fallbackGuidance: string;
}

export class PromptService {
  private knowledgeService: KnowledgeService;
  private campaignRepository: CampaignRepository;

  // Default prompt templates for different use cases
  private readonly defaultTemplates: SystemPromptTemplate[] = [
    {
      id: 'customer-support',
      name: 'Customer Support Agent',
      description: 'Standard customer support agent for general inquiries',
      role: 'customer support agent',
      tone: 'professional, helpful, and empathetic',
      knowledgeInjection: true,
      confidenceThreshold: 0.5,
      language: 'en',
      welcomeMessage: 'Hello! Thank you for calling. How can I assist you today?',
      basePrompt: `You are a professional customer support agent. Your role is to help customers with their questions and concerns using the provided knowledge base and product information.

⭐ IMPORTANT: Always respond in ENGLISH only. Do not translate or use any other language.

Guidelines:
- Be professional, helpful, and empathetic
- Use the knowledge base and product information provided to answer questions accurately
- If you're unsure about something, say so honestly
- Offer to transfer to a human agent if the customer needs more complex assistance
- Always prioritize customer satisfaction while being truthful about your capabilities`
    },
    {
      id: 'sales-agent',
      name: 'Sales Agent',
      description: 'Sales-focused agent for product inquiries and lead generation',
      role: 'sales agent',
      tone: 'enthusiastic, persuasive, and consultative',
      knowledgeInjection: true,
      confidenceThreshold: 0.6,
      language: 'en',
      welcomeMessage: 'Hi! Welcome. I\'m here to help you find the perfect product. What interests you today?',
      basePrompt: `You are a knowledgeable sales agent specializing in our products and services. Your goal is to help customers understand our offerings and guide them toward suitable solutions.

⭐ IMPORTANT: Always respond in ENGLISH only. Do not translate or use any other language.

Guidelines:
- Be enthusiastic and consultative, not pushy
- Use product knowledge and FAQs to provide detailed information
- Ask qualifying questions to understand customer needs
- Highlight relevant features and benefits
- If you can't answer a product question, be honest and offer to connect them with a product specialist`
    },
    {
      id: 'technical-support',
      name: 'Technical Support',
      description: 'Technical support agent for troubleshooting and product setup',
      role: 'technical support agent',
      tone: 'patient, detailed, and solution-oriented',
      knowledgeInjection: true,
      confidenceThreshold: 0.7,
      language: 'en',
      welcomeMessage: 'Welcome to technical support. Please describe the issue you\'re experiencing.',
      basePrompt: `You are a technical support specialist. Your expertise includes troubleshooting, product setup, and resolving technical issues.

⭐ IMPORTANT: Always respond in ENGLISH only. Do not translate or use any other language.

Guidelines:
- Be patient and methodical in your approach
- Use technical knowledge base and troubleshooting guides
- Ask diagnostic questions to identify the issue
- Provide step-by-step instructions when appropriate
- If the issue is beyond your expertise, escalate to a senior technician`
    },
    {
      id: 'order-status',
      name: 'Order Status Agent',
      description: 'Specialized agent for order inquiries and status updates',
      role: 'order status agent',
      tone: 'helpful, informative, and reassuring',
      knowledgeInjection: true,
      confidenceThreshold: 0.8,
      language: 'en',
      welcomeMessage: 'Hi! I can help you track your order. What\'s your order number?',
      basePrompt: `You are an order status specialist. Your primary responsibility is to help customers track orders, check delivery status, and handle order-related inquiries.

⭐ IMPORTANT: Always respond in ENGLISH only. Do not translate or use any other language.

Guidelines:
- Be informative and reassuring about order progress
- Use order tracking information and delivery policies
- Provide accurate timelines and expectations
- Handle order modifications when possible
- Escalate complex order issues to order management team`
    }
  ];

  // Hindi language variants
  private readonly hindiTemplates: SystemPromptTemplate[] = [
    {
      id: 'customer-support-hi',
      name: 'Customer Support Agent (Hindi)',
      description: 'Customer support agent that responds in Hindi',
      role: 'customer support agent',
      tone: 'professional, helpful, and empathetic',
      knowledgeInjection: true,
      confidenceThreshold: 0.5,
      language: 'hi',
      welcomeMessage: 'नमस्ते! आपको कैसे मदद कर सकते हैं?',
      basePrompt: `आप एक पेशेवर ग्राहक सहायता एजेंट हैं। आपकी भूमिका ग्राहकों को उनके प्रश्नों और चिंताओं में सहायता करना है।

⭐ महत्वपूर्ण: हमेशा केवल HINDI में जवाब दें। अन्य किसी भी भाषा का उपयोग न करें।

दिशानिर्देश:
- पेशेवर, सहायक और सहानुभूतिशील रहें
- ज्ञान आधार का उपयोग करके सटीक उत्तर दें
- यदि आप कुछ नहीं जानते हैं तो ईमानदारी से बताएं
- जटिल समस्याओं के लिए मानव एजेंट को ट्रांसफर करने की पेशकश करें
- हमेशा ग्राहक संतुष्टि को प्राथमिकता दें`
    }
  ];

  constructor() {
    this.knowledgeService = new KnowledgeService();
    this.campaignRepository = new CampaignRepository();
  }

  /**
   * Generate dynamic system prompt with knowledge injection
   */
  async generateDynamicPrompt(
    callId: string,
    teamId: string,
    campaignId?: string,
    templateId?: string,
  ): Promise<DynamicPrompt> {
    try {
      // Get knowledge context for the call
      const knowledgeContext = await this.knowledgeService.getKnowledgeContext(callId, teamId);
      
      // Get campaign-specific settings or use template
      let template: SystemPromptTemplate;
      let confidenceThreshold = 0.5;
      let fallbackGuidance = '';

      if (campaignId) {
        const campaign = await this.campaignRepository.getCampaignById(campaignId);
        if (campaign?.script) {
          // Use campaign's custom script as base prompt
          template = {
            id: 'campaign-custom',
            name: campaign.name,
            description: campaign.description || 'Custom campaign prompt',
            role: 'campaign agent',
            tone: 'professional',
            knowledgeInjection: true,
            confidenceThreshold: 0.5,
            basePrompt: campaign.script,
          };
        } else {
          template = this.getDefaultTemplate(templateId);
        }
      } else {
        template = this.getDefaultTemplate(templateId);
      }

      confidenceThreshold = template.confidenceThreshold;

      // Generate system prompt with knowledge injection
      const systemPrompt = this.buildSystemPrompt(template, knowledgeContext);
      
      // Generate fallback guidance for low-confidence responses
      fallbackGuidance = this.generateFallbackGuidance(template);

      return {
        systemPrompt,
        knowledgeContext,
        confidenceThreshold,
        fallbackGuidance,
      };
    } catch (error) {
      logger.error('Error generating dynamic prompt', error);
      
      // Return basic prompt as fallback
      return {
        systemPrompt: this.getDefaultTemplate(templateId).basePrompt,
        knowledgeContext: {
          knowledgeBase: [],
          products: [],
          faqs: [],
          relevanceScore: 0,
        },
        confidenceThreshold: 0.5,
        fallbackGuidance: 'I apologize, but I need to transfer you to a human agent who can better assist you.',
      };
    }
  }

  /**
   * Update campaign system prompt
   */
  async updateCampaignPrompt(
    campaignId: string,
    script: string,
    templateId?: string,
  ): Promise<void> {
    try {
      const template = templateId ? this.getTemplateById(templateId) : null;
      
      await this.campaignRepository.updateCampaign(campaignId, {
        script,
      });

      logger.info(`Updated system prompt for campaign: ${campaignId}`);
    } catch (error) {
      logger.error('Error updating campaign prompt', error);
      throw error;
    }
  }

  /**
   * Get available prompt templates
   */
  getAvailableTemplates(): SystemPromptTemplate[] {
    return this.defaultTemplates;
  }

  /**
   * Get specific template by ID
   */
  getTemplateById(templateId: string): SystemPromptTemplate {
    const template = this.defaultTemplates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return template;
  }

  /**
   * Get campaign prompt
   */
  async getCampaignPrompt(campaignId: string): Promise<{
    script: string;
    template?: SystemPromptTemplate;
  }> {
    try {
      const campaign = await this.campaignRepository.getCampaignById(campaignId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Try to match script to a known template
      const template = this.defaultTemplates.find(t => 
        t.basePrompt === campaign.script
      );

      return {
        script: campaign.script,
        template,
      };
    } catch (error) {
      logger.error('Error getting campaign prompt', error);
      throw error;
    }
  }

  private getDefaultTemplate(templateId?: string): SystemPromptTemplate {
    if (templateId) {
      return this.getTemplateById(templateId);
    }
    return this.defaultTemplates[0]; // Default to customer support
  }

  private buildSystemPrompt(template: SystemPromptTemplate, context: KnowledgeContext): string {
    let prompt = template.basePrompt;

    // Add welcome message if available
    if (template.welcomeMessage) {
      prompt += `\n\n📞 INITIAL GREETING: When the call starts, begin with exactly this greeting: "${template.welcomeMessage}"`;
    }

    // Inject knowledge if available and template allows it
    if (template.knowledgeInjection && this.hasRelevantKnowledge(context)) {
      prompt += '\n\n=== KNOWLEDGE BASE CONTEXT ===';
      
      if (context.knowledgeBase.length > 0) {
        prompt += '\n\nRelevant Knowledge Base Articles:';
        context.knowledgeBase.forEach((kb, index) => {
          prompt += `\n${index + 1}. ${kb.title}`;
          prompt += `\n   Content: ${kb.content}`;
          prompt += `\n   Relevance: ${(kb.relevanceScore * 100).toFixed(1)}%`;
        });
      }

      if (context.products.length > 0) {
        prompt += '\n\nRelevant Products:';
        context.products.forEach((product, index) => {
          prompt += `\n${index + 1}. ${product.name}`;
          prompt += `\n   Description: ${product.description}`;
          if (product.metadata.price) {
            prompt += `\n   Price: $${product.metadata.price}`;
          }
          prompt += `\n   Relevance: ${(product.relevanceScore * 100).toFixed(1)}%`;
        });
      }

      if (context.faqs.length > 0) {
        prompt += '\n\nRelevant FAQs:';
        context.faqs.forEach((faq, index) => {
          prompt += `\n${index + 1}. Q: ${faq.question}`;
          prompt += `\n   A: ${faq.answer}`;
          prompt += `\n   Relevance: ${(faq.relevanceScore * 100).toFixed(1)}%`;
        });
      }

      prompt += '\n\n=== END KNOWLEDGE CONTEXT ===';
      prompt += '\n\nUse this knowledge to provide accurate and helpful responses. Always prioritize using the most relevant information.';
    }

    // Add role-specific behavior guidelines
    prompt += `\n\nAs a ${template.role}, maintain a ${template.tone} tone throughout the conversation.`;
    
    // Add confidence guidance
    prompt += `\n\nIf your confidence in answering a question is below ${(template.confidenceThreshold * 100).toFixed(0)}%, acknowledge the limitation and offer to transfer to a human agent.`;

    return prompt;
  }

  private generateFallbackGuidance(template: SystemPromptTemplate): string {
    return `I want to make sure you get the most accurate information. Let me transfer you to one of our specialists who can provide detailed assistance with your question. They have access to our complete knowledge base and can better address your specific needs.`;
  }

  private hasRelevantKnowledge(context: KnowledgeContext): boolean {
    return context.knowledgeBase.length > 0 || 
           context.products.length > 0 || 
           context.faqs.length > 0 ||
           context.relevanceScore > 0.1;
  }
}