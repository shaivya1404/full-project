import { FAQ, UnansweredQuestion, TopicAnalytics, CampaignAnalytics, Transcript } from '@prisma/client';
import { AnalyticsRepository } from '../db/repositories/analyticsRepository';
import { CallRepository } from '../db/repositories/callRepository';
import { CampaignRepository } from '../db/repositories/campaignRepository';
import { logger } from '../utils/logger';

export class AnalyticsService {
  private analyticsRepository: AnalyticsRepository;
  private callRepository: CallRepository;
  private campaignRepository: CampaignRepository;

  constructor() {
    this.analyticsRepository = new AnalyticsRepository();
    this.callRepository = new CallRepository();
    this.campaignRepository = new CampaignRepository();
  }

  async processAllTranscripts(): Promise<void> {
    logger.info('Starting transcript analysis for analytics...');
    const calls = await this.callRepository.getAllCalls();
    
    for (const call of calls) {
      const callWithDetails = await this.callRepository.getCallWithDetails(call.id);
      if (callWithDetails && callWithDetails.transcripts && callWithDetails.transcripts.length > 0) {
        await this.analyzeTranscripts(call.id, callWithDetails.transcripts);
      }
    }
    
    // Also process Campaign analytics
    await this.updateAllCampaignAnalytics();
    
    logger.info('Transcript analysis completed.');
  }

  async analyzeTranscripts(callId: string, transcripts: Transcript[]): Promise<void> {
    for (let i = 0; i < transcripts.length; i++) {
      const transcript = transcripts[i];
      const speaker = transcript.speaker.toLowerCase();
      
      if (speaker === 'user' || speaker === 'customer' || speaker === 'caller') {
        const text = transcript.text.trim();
        
        // Extract questions
        if (text.endsWith('?') || this.isQuestion(text)) {
          const topic = this.detectTopic(text);
          await this.analyticsRepository.upsertFAQ({
            question: text,
            topic: topic
          });
          
          if (topic) {
              await this.analyticsRepository.upsertTopicAnalytics({
                  topic: topic,
                  sentiment: 0 // Default sentiment for now
              });
          }
        }
      } else if (speaker === 'assistant' || speaker === 'agent' || speaker === 'ai') {
        const text = transcript.text.toLowerCase();
        
        // Detect unanswered questions
        if (
          text.includes("i don't know") || 
          text.includes("i'm not sure") || 
          text.includes("transfer you to a human") || 
          text.includes("let me connect you with an agent") ||
          text.includes("speak with a representative")
        ) {
          // Find the previous question from the user
          if (i > 0) {
            const prevTranscript = transcripts[i - 1];
            const prevSpeaker = prevTranscript.speaker.toLowerCase();
            if (prevSpeaker === 'user' || prevSpeaker === 'customer' || prevSpeaker === 'caller') {
              await this.analyticsRepository.upsertUnansweredQuestion({
                question: prevTranscript.text
              });
            }
          }
        }
      }
    }
  }

  private isQuestion(text: string): boolean {
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'is', 'are', 'do', 'does'];
    const firstWord = text.split(' ')[0].toLowerCase();
    return questionWords.includes(firstWord);
  }

  private detectTopic(text: string): string | undefined {
    const topics = {
      'insurance': ['policy', 'coverage', 'claim', 'premium', 'insurance', 'deductible'],
      'pizza': ['pizza', 'delivery', 'topping', 'crust', 'order', 'menu', 'price'],
      'billing': ['bill', 'payment', 'refund', 'charge', 'cost', 'price', 'credit'],
      'support': ['help', 'support', 'technical', 'issue', 'problem', 'broken']
    };

    const lowerText = text.toLowerCase();
    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return topic;
      }
    }
    return undefined;
  }

  async updateAllCampaignAnalytics(): Promise<void> {
    const campaigns = await this.campaignRepository.getAllCampaigns();
    for (const campaign of campaigns) {
      const progress = await this.campaignRepository.getCampaignProgress(campaign.id);
      
      // Rough ROI estimation: cost $1 per call, revenue $10 per success
      const cost = progress.completedCalls * 1.0;
      const revenue = progress.successfulCalls * 10.0;
      const roi = cost > 0 ? (revenue - cost) / cost : 0;

      await this.analyticsRepository.upsertCampaignAnalytics({
        campaignId: campaign.id,
        successRate: progress.successRate,
        cost: cost,
        revenue: revenue,
        roi: roi
      });
    }
  }

  async getTopFAQs(limit?: number): Promise<FAQ[]> {
    return this.analyticsRepository.getTopFAQs(limit);
  }

  async getTopUnansweredQuestions(limit?: number): Promise<UnansweredQuestion[]> {
    return this.analyticsRepository.getTopUnansweredQuestions(limit);
  }

  async getTopicBreakdown(): Promise<TopicAnalytics[]> {
    return this.analyticsRepository.getAllTopicAnalytics();
  }

  async getCampaignPerformance(campaignId: string): Promise<CampaignAnalytics | null> {
    return this.analyticsRepository.getCampaignAnalytics(campaignId);
  }

  async getAnalyticsSummary(): Promise<any> {
    const topFAQs = await this.getTopFAQs(5);
    const topUnanswered = await this.getTopUnansweredQuestions(5);
    const topics = await this.getTopicBreakdown();
    
    return {
      topFAQs,
      topUnanswered,
      topics,
      lastUpdated: new Date()
    };
  }

  async generateCSVReport(): Promise<string> {
    const faqs = await this.getTopFAQs(100);
    let csv = 'Question,Frequency,Topic\n';
    faqs.forEach(f => {
      csv += `"${f.question}",${f.frequency},${f.topic || ''}\n`;
    });
    return csv;
  }
}
