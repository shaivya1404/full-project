import request from 'supertest';
import app from '../app';
import { CallRepository } from '../db/repositories/callRepository';
import { AnalyticsService } from '../services/analyticsService';

jest.mock('../db/repositories/callRepository');
jest.mock('../services/analyticsService');

const mockCallRepository = CallRepository as jest.MockedClass<typeof CallRepository>;
const mockAnalyticsService = AnalyticsService as jest.MockedClass<typeof AnalyticsService>;

describe('Analytics API Phase 1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/faqs', () => {
    it('should return top FAQs', async () => {
      const mockFAQs = [
        { id: '1', question: 'What is the premium?', frequency: 45, topic: 'insurance' },
        { id: '2', question: 'How to file a claim?', frequency: 30, topic: 'insurance' },
      ];

      mockAnalyticsService.prototype.getTopFAQs.mockResolvedValue(mockFAQs as any);

      const res = await request(app).get('/api/analytics/faqs');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockFAQs);
      expect(mockAnalyticsService.prototype.getTopFAQs).toHaveBeenCalled();
    });
  });

  describe('GET /api/analytics/unanswered', () => {
    it('should return unanswered questions', async () => {
      const mockUnanswered = [
        { id: '1', question: 'What about refunds?', frequency: 5 },
      ];

      mockAnalyticsService.prototype.getTopUnansweredQuestions.mockResolvedValue(mockUnanswered as any);

      const res = await request(app).get('/api/analytics/unanswered');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockUnanswered);
    });
  });

  describe('GET /api/analytics/topics', () => {
    it('should return topic breakdown', async () => {
      const mockTopics = [
        { id: '1', topic: 'insurance', callCount: 50, sentiment: 0.8 },
        { id: '2', topic: 'pizza', callCount: 30, sentiment: 0.6 },
      ];

      mockAnalyticsService.prototype.getTopicBreakdown.mockResolvedValue(mockTopics as any);

      const res = await request(app).get('/api/analytics/topics');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockTopics);
    });
  });

  describe('GET /api/analytics/campaigns/:id', () => {
    it('should return campaign performance', async () => {
      const mockPerformance = {
        id: '1',
        campaignId: 'camp1',
        successRate: 0.75,
        roi: 2.5,
        cost: 100,
        revenue: 350
      };

      mockAnalyticsService.prototype.getCampaignPerformance.mockResolvedValue(mockPerformance as any);

      const res = await request(app).get('/api/analytics/campaigns/camp1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockPerformance);
    });

    it('should return 404 if performance not found', async () => {
      mockAnalyticsService.prototype.getCampaignPerformance.mockResolvedValue(null);

      const res = await request(app).get('/api/analytics/campaigns/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/analytics/report', () => {
    it('should generate CSV report', async () => {
      const mockCSV = 'Question,Frequency,Topic\n"What is the premium?",45,insurance';
      mockAnalyticsService.prototype.generateCSVReport.mockResolvedValue(mockCSV);

      const res = await request(app)
        .post('/api/analytics/report')
        .send({ format: 'csv' });

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/csv');
      expect(res.text).toBe(mockCSV);
    });
  });

  describe('POST /api/analytics/process', () => {
    it('should trigger processing', async () => {
      mockAnalyticsService.prototype.processAllTranscripts.mockResolvedValue();

      const res = await request(app).post('/api/analytics/process');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Analytics processing completed');
      expect(mockAnalyticsService.prototype.processAllTranscripts).toHaveBeenCalled();
    });
  });

  describe('GET /api/analytics/summary', () => {
    it('should return extended summary', async () => {
        const mockAggregates = {
            totalCalls: 100,
            averageDuration: 300,
            callsByStatus: { completed: 90 },
            sentimentBreakdown: {}
        };
        const mockNewSummary = {
            topFAQs: [],
            topUnanswered: [],
            topics: []
        };

        mockCallRepository.prototype.getAnalyticsAggregate.mockResolvedValue(mockAggregates as any);
        mockAnalyticsService.prototype.getAnalyticsSummary.mockResolvedValue(mockNewSummary);

        const res = await request(app).get('/api/analytics/summary');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveProperty('topFAQs');
        expect(res.body.data).toHaveProperty('successRate', 90);
    });
  });
});
