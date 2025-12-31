import { KnowledgeService } from '../src/services/knowledgeService';
import { PromptService } from '../src/services/promptService';
import { CallRepository } from '../src/db/repositories/callRepository';
import { ProductRepository } from '../src/db/repositories/productRepository';
import { KnowledgeBaseRepository } from '../src/db/repositories/knowledgeBaseRepository';

describe('Knowledge Integration System', () => {
  let knowledgeService: KnowledgeService;
  let promptService: PromptService;
  let mockCallRepository: jest.Mocked<CallRepository>;
  let mockProductRepository: jest.Mocked<ProductRepository>;
  let mockKnowledgeBaseRepository: jest.Mocked<KnowledgeBaseRepository>;

  beforeEach(() => {
    // Mock repositories
    mockCallRepository = {
      createCall: jest.fn(),
      updateCall: jest.fn(),
      getCallById: jest.fn(),
      getCallByStreamSid: jest.fn(),
      getAllCalls: jest.fn(),
      getCallWithDetails: jest.fn(),
      createRecording: jest.fn(),
      createTranscript: jest.fn(),
      createAnalytics: jest.fn(),
      createOrUpdateMetadata: jest.fn(),
      createKnowledgeBaseSource: jest.fn(),
      getRecentTranscripts: jest.fn(),
      getFaqsByTeamId: jest.fn(),
      createOrUpdateUnansweredQuestion: jest.fn(),
      getKnowledgeUsedForCall: jest.fn(),
      getUnansweredQuestions: jest.fn(),
      getKnowledgeAnalytics: jest.fn(),
    } as any;

    mockProductRepository = {
      createProduct: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      updateProduct: jest.fn(),
      deleteProduct: jest.fn(),
      searchProducts: jest.fn(),
      searchProductFAQs: jest.fn(),
    } as any;

    mockKnowledgeBaseRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    } as any;

    knowledgeService = new KnowledgeService();
    promptService = new PromptService();

    // Mock the repositories in the services
    (knowledgeService as any).callRepository = mockCallRepository;
    (knowledgeService as any).productRepository = mockProductRepository;
    (knowledgeService as any).knowledgeBaseRepository = mockKnowledgeBaseRepository;
  });

  describe('KnowledgeService', () => {
    test('should search relevant knowledge across all sources', async () => {
      const teamId = 'test-team-id';
      const query = 'product features pricing';

      // Mock repository responses
      mockKnowledgeBaseRepository.search.mockResolvedValue([
        {
          id: 'kb-1',
          title: 'Product Features Guide',
          content: 'Our product has advanced features...',
          category: 'products',
          tags: JSON.stringify(['features', 'guide']),
        },
      ]);

      mockProductRepository.findMany.mockResolvedValue([
        {
          id: 'product-1',
          name: 'Premium Plan',
          description: 'Premium plan with advanced features',
          category: 'plans',
          price: 99.99,
        },
      ]);

      mockCallRepository.getFaqsByTeamId.mockResolvedValue([
        {
          id: 'faq-1',
          question: 'What are the pricing options?',
          answer: 'We offer flexible pricing plans...',
          category: 'pricing',
        },
      ]);

      const results = await knowledgeService.searchRelevantKnowledge(query, teamId);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('type');
      expect(results[0]).toHaveProperty('relevanceScore');
    });

    test('should get knowledge context for a call', async () => {
      const callId = 'test-call-id';
      const teamId = 'test-team-id';

      mockCallRepository.getRecentTranscripts.mockResolvedValue([
        {
          id: 'transcript-1',
          text: 'What are your product features?',
          speaker: 'customer',
          createdAt: new Date(),
        },
      ]);

      mockKnowledgeBaseRepository.search.mockResolvedValue([
        {
          id: 'kb-1',
          title: 'Product Features',
          content: 'Our product includes...',
          category: 'products',
        },
      ]);

      mockProductRepository.findMany.mockResolvedValue([]);

      const context = await knowledgeService.getKnowledgeContext(callId, teamId);

      expect(context).toHaveProperty('knowledgeBase');
      expect(context).toHaveProperty('products');
      expect(context).toHaveProperty('faqs');
      expect(context).toHaveProperty('relevanceScore');
    });

    test('should calculate confidence score correctly', () => {
      const knowledgeContext = {
        knowledgeBase: [
          { id: 'kb-1', title: 'Test KB', relevanceScore: 0.8 },
        ],
        products: [],
        faqs: [],
        relevanceScore: 0.8,
      };

      const confidence = knowledgeService.calculateConfidenceScore(
        knowledgeContext,
        ['kb-1'],
      );

      expect(confidence.overall).toBeGreaterThan(0);
      expect(confidence.knowledgeBased).toBeGreaterThan(0);
      expect(confidence.sources).toHaveLength(1);
    });

    test('should detect fallback scenarios', () => {
      const context = {
        knowledgeBase: [],
        products: [],
        faqs: [],
        relevanceScore: 0.1,
      };

      const shouldFallback = !knowledgeService.isWithinKnowledgeScope(
        'What is the meaning of life?',
        context,
      );

      expect(shouldFallback).toBe(true);
    });
  });

  describe('PromptService', () => {
    test('should generate dynamic prompt with knowledge', async () => {
      const callId = 'test-call-id';
      const teamId = 'test-team-id';
      const templateId = 'customer-support';

      // Mock knowledge context
      const mockKnowledgeContext = {
        knowledgeBase: [
          {
            id: 'kb-1',
            title: 'Product Features',
            content: 'Our product includes advanced features...',
            relevanceScore: 0.9,
          },
        ],
        products: [],
        faqs: [],
        relevanceScore: 0.9,
      };

      // Mock campaign repository
      const mockCampaignRepository = {
        getCampaignById: jest.fn(),
      };
      (promptService as any).campaignRepository = mockCampaignRepository;

      const dynamicPrompt = await promptService.generateDynamicPrompt(
        callId,
        teamId,
        undefined,
        templateId,
      );

      expect(dynamicPrompt).toHaveProperty('systemPrompt');
      expect(dynamicPrompt).toHaveProperty('knowledgeContext');
      expect(dynamicPrompt).toHaveProperty('confidenceThreshold');
      expect(dynamicPrompt.systemPrompt).toContain('Product Features');
    });

    test('should provide available templates', () => {
      const templates = promptService.getAvailableTemplates();

      expect(templates).toHaveLength(4);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('basePrompt');
    });

    test('should update campaign prompt', async () => {
      const campaignId = 'test-campaign-id';
      const script = 'Custom campaign script...';
      const templateId = 'sales-agent';

      const mockCampaignRepository = {
        updateCampaign: jest.fn(),
      };
      (promptService as any).campaignRepository = mockCampaignRepository;

      await promptService.updateCampaignPrompt(campaignId, script, templateId);

      expect(mockCampaignRepository.updateCampaign).toHaveBeenCalledWith(
        campaignId,
        { script },
      );
    });
  });

  describe('Integration Tests', () => {
    test('should integrate knowledge with OpenAI service', async () => {
      // This would test the full integration flow
      // For now, we'll just verify the services can be instantiated
      expect(knowledgeService).toBeDefined();
      expect(promptService).toBeDefined();
    });

    test('should handle knowledge search workflow', async () => {
      const query = 'pricing plans';
      const teamId = 'test-team-id';

      mockKnowledgeBaseRepository.search.mockResolvedValue([
        {
          id: 'kb-1',
          title: 'Pricing Information',
          content: 'Our pricing is competitive...',
          category: 'pricing',
        },
      ]);

      mockProductRepository.searchProducts.mockResolvedValue([
        {
          id: 'product-1',
          name: 'Basic Plan',
          description: 'Basic plan starting at $9.99',
          category: 'plans',
          price: 9.99,
        },
      ]);

      const results = await knowledgeService.searchRelevantKnowledge(query, teamId);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.type === 'knowledge')).toBe(true);
      expect(results.some(r => r.type === 'product')).toBe(true);
    });
  });
});