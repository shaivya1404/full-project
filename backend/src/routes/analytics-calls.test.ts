import request from 'supertest';
import app from '../app';
import { CallAnalyticsService } from '../services/callAnalyticsService';
import { CallRepository } from '../db/repositories/callRepository';

jest.mock('../services/callAnalyticsService');
jest.mock('../db/repositories/callRepository');

const mockCallAnalyticsService = CallAnalyticsService as jest.MockedClass<typeof CallAnalyticsService>;

describe('GET /api/analytics/calls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return comprehensive call analytics', async () => {
    const mockAnalyticsData = {
      summary: {
        totalCalls: 45,
        completedCalls: 38,
        failedCalls: 7,
        activeOngoingCalls: 2,
        averageCallDuration: 245,
        averageSentiment: 0.85,
        conversionRate: 0.84,
      },
      trends: [
        {
          date: '2026-01-01',
          calls: 12,
          completed: 10,
          failed: 2,
          avgDuration: 250,
        },
        {
          date: '2026-01-02',
          calls: 15,
          completed: 13,
          failed: 2,
          avgDuration: 240,
        },
      ],
      byStatus: {
        completed: 38,
        failed: 7,
        abandoned: 3,
        inProgress: 2,
      },
      topReasons: [
        {
          reason: 'completed',
          count: 38,
          conversionRate: 0.95,
        },
        {
          reason: 'failed',
          count: 7,
          conversionRate: 0.0,
        },
      ],
      peakHours: [
        {
          hour: 10,
          calls: 8,
        },
        {
          hour: 14,
          calls: 6,
        },
      ],
    };

    mockCallAnalyticsService.prototype.getCallAnalytics.mockResolvedValue(mockAnalyticsData);

    const res = await request(app).get('/api/analytics/calls');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('message', 'Call analytics retrieved successfully');
    expect(res.body.data).toEqual(mockAnalyticsData);
  });

  it('should support teamId filter', async () => {
    mockCallAnalyticsService.prototype.getCallAnalytics.mockResolvedValue({
      summary: {
        totalCalls: 10,
        completedCalls: 8,
        failedCalls: 2,
        activeOngoingCalls: 0,
        averageCallDuration: 200,
        averageSentiment: 0.75,
        conversionRate: 0.8,
      },
      trends: [],
      byStatus: {
        completed: 8,
        failed: 2,
        abandoned: 0,
        inProgress: 0,
      },
      topReasons: [],
      peakHours: [],
    });

    const res = await request(app).get('/api/analytics/calls?teamId=team-123');

    expect(res.status).toBe(200);
    expect(mockCallAnalyticsService.prototype.getCallAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-123',
      })
    );
  });

  it('should support startDate filter', async () => {
    mockCallAnalyticsService.prototype.getCallAnalytics.mockResolvedValue({
      summary: {
        totalCalls: 20,
        completedCalls: 15,
        failedCalls: 5,
        activeOngoingCalls: 0,
        averageCallDuration: 220,
        averageSentiment: 0.8,
        conversionRate: 0.75,
      },
      trends: [],
      byStatus: {
        completed: 15,
        failed: 5,
        abandoned: 0,
        inProgress: 0,
      },
      topReasons: [],
      peakHours: [],
    });

    const res = await request(app).get('/api/analytics/calls?startDate=2026-01-01');

    expect(res.status).toBe(200);
    expect(mockCallAnalyticsService.prototype.getCallAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: new Date('2026-01-01'),
      })
    );
  });

  it('should support endDate filter', async () => {
    mockCallAnalyticsService.prototype.getCallAnalytics.mockResolvedValue({
      summary: {
        totalCalls: 15,
        completedCalls: 12,
        failedCalls: 3,
        activeOngoingCalls: 0,
        averageCallDuration: 210,
        averageSentiment: 0.78,
        conversionRate: 0.8,
      },
      trends: [],
      byStatus: {
        completed: 12,
        failed: 3,
        abandoned: 0,
        inProgress: 0,
      },
      topReasons: [],
      peakHours: [],
    });

    const res = await request(app).get('/api/analytics/calls?endDate=2026-01-31');

    expect(res.status).toBe(200);
    expect(mockCallAnalyticsService.prototype.getCallAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        endDate: new Date('2026-01-31'),
      })
    );
  });

  it('should support campaignId filter', async () => {
    mockCallAnalyticsService.prototype.getCallAnalytics.mockResolvedValue({
      summary: {
        totalCalls: 5,
        completedCalls: 4,
        failedCalls: 1,
        activeOngoingCalls: 0,
        averageCallDuration: 180,
        averageSentiment: 0.82,
        conversionRate: 0.8,
      },
      trends: [],
      byStatus: {
        completed: 4,
        failed: 1,
        abandoned: 0,
        inProgress: 0,
      },
      topReasons: [],
      peakHours: [],
    });

    const res = await request(app).get('/api/analytics/calls?campaignId=campaign-123');

    expect(res.status).toBe(200);
    expect(mockCallAnalyticsService.prototype.getCallAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'campaign-123',
      })
    );
  });

  it('should support all filters together', async () => {
    mockCallAnalyticsService.prototype.getCallAnalytics.mockResolvedValue({
      summary: {
        totalCalls: 3,
        completedCalls: 2,
        failedCalls: 1,
        activeOngoingCalls: 0,
        averageCallDuration: 190,
        averageSentiment: 0.76,
        conversionRate: 0.67,
      },
      trends: [],
      byStatus: {
        completed: 2,
        failed: 1,
        abandoned: 0,
        inProgress: 0,
      },
      topReasons: [],
      peakHours: [],
    });

    const res = await request(app).get(
      '/api/analytics/calls?teamId=team-123&startDate=2026-01-01&endDate=2026-01-31&campaignId=campaign-123'
    );

    expect(res.status).toBe(200);
    expect(mockCallAnalyticsService.prototype.getCallAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-123',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        campaignId: 'campaign-123',
      })
    );
  });

  it('should return 400 for invalid startDate', async () => {
    const res = await request(app).get('/api/analytics/calls?startDate=invalid-date');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message', 'Invalid startDate format. Use YYYY-MM-DD');
    expect(res.body).toHaveProperty('code', 'INVALID_DATE');
  });

  it('should return 400 for invalid endDate', async () => {
    const res = await request(app).get('/api/analytics/calls?endDate=invalid-date');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message', 'Invalid endDate format. Use YYYY-MM-DD');
    expect(res.body).toHaveProperty('code', 'INVALID_DATE');
  });

  it('should handle empty analytics gracefully', async () => {
    mockCallAnalyticsService.prototype.getCallAnalytics.mockResolvedValue({
      summary: {
        totalCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
        activeOngoingCalls: 0,
        averageCallDuration: 0,
        averageSentiment: 0,
        conversionRate: 0,
      },
      trends: [],
      byStatus: {
        completed: 0,
        failed: 0,
        abandoned: 0,
        inProgress: 0,
      },
      topReasons: [],
      peakHours: [],
    });

    const res = await request(app).get('/api/analytics/calls');

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalCalls).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    mockCallAnalyticsService.prototype.getCallAnalytics.mockRejectedValue(
      new Error('Database error')
    );

    const res = await request(app).get('/api/analytics/calls');

    expect(res.status).toBe(500);
  });
});
