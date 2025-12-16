import request from 'supertest';
import app from '../app';
import { CallRepository } from '../db/repositories/callRepository';

jest.mock('../db/repositories/callRepository');

const mockCallRepository = CallRepository as jest.MockedClass<typeof CallRepository>;

describe('Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics', () => {
    it('should return aggregates and timeseries data', async () => {
      const mockAggregates = {
        totalCalls: 100,
        averageDuration: 300,
        callsByStatus: {
          completed: 90,
          active: 5,
          failed: 5,
        },
        sentimentBreakdown: {
          positive: 60,
          neutral: 30,
          negative: 10,
        },
      };

      const mockTimeSeries = [
        {
          timestamp: new Date('2024-01-01'),
          callCount: 10,
          averageDuration: 300,
        },
        {
          timestamp: new Date('2024-01-02'),
          callCount: 12,
          averageDuration: 310,
        },
      ];

      mockCallRepository.prototype.getAnalyticsAggregate.mockResolvedValue(mockAggregates);
      mockCallRepository.prototype.getAnalyticsTimeSeries.mockResolvedValue(mockTimeSeries);

      const res = await request(app).get('/api/analytics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('aggregates');
      expect(res.body.data).toHaveProperty('timeSeries');
      expect(res.body.data.aggregates).toEqual(mockAggregates);
      expect(res.body.data.timeSeries).toHaveLength(2);
      expect(res.body.data.timeSeries[0]).toHaveProperty('callCount', 10);
      expect(res.body.data.timeSeries[0]).toHaveProperty('averageDuration', 300);
      expect(res.body.data.timeSeries[1]).toHaveProperty('callCount', 12);
      expect(res.body.data.timeSeries[1]).toHaveProperty('averageDuration', 310);
    });

    it('should support day interval (default)', async () => {
      mockCallRepository.prototype.getAnalyticsAggregate.mockResolvedValue({
        totalCalls: 0,
        averageDuration: null,
        callsByStatus: {},
        sentimentBreakdown: {},
      });
      mockCallRepository.prototype.getAnalyticsTimeSeries.mockResolvedValue([]);

      await request(app).get('/api/analytics');

      expect(mockCallRepository.prototype.getAnalyticsTimeSeries).toHaveBeenCalledWith(
        'day',
        expect.any(Object),
      );
    });

    it('should support hour interval', async () => {
      mockCallRepository.prototype.getAnalyticsAggregate.mockResolvedValue({
        totalCalls: 0,
        averageDuration: null,
        callsByStatus: {},
        sentimentBreakdown: {},
      });
      mockCallRepository.prototype.getAnalyticsTimeSeries.mockResolvedValue([]);

      await request(app).get('/api/analytics?interval=hour');

      expect(mockCallRepository.prototype.getAnalyticsTimeSeries).toHaveBeenCalledWith(
        'hour',
        expect.any(Object),
      );
    });

    it('should support week interval', async () => {
      mockCallRepository.prototype.getAnalyticsAggregate.mockResolvedValue({
        totalCalls: 0,
        averageDuration: null,
        callsByStatus: {},
        sentimentBreakdown: {},
      });
      mockCallRepository.prototype.getAnalyticsTimeSeries.mockResolvedValue([]);

      await request(app).get('/api/analytics?interval=week');

      expect(mockCallRepository.prototype.getAnalyticsTimeSeries).toHaveBeenCalledWith(
        'week',
        expect.any(Object),
      );
    });

    it('should reject invalid interval', async () => {
      const res = await request(app).get('/api/analytics?interval=invalid');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'INVALID_INTERVAL');
    });

    it('should support date range filters', async () => {
      mockCallRepository.prototype.getAnalyticsAggregate.mockResolvedValue({
        totalCalls: 0,
        averageDuration: null,
        callsByStatus: {},
        sentimentBreakdown: {},
      });
      mockCallRepository.prototype.getAnalyticsTimeSeries.mockResolvedValue([]);

      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';
      await request(app).get(
        `/api/analytics?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      );

      expect(mockCallRepository.prototype.getAnalyticsAggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      );
      expect(mockCallRepository.prototype.getAnalyticsTimeSeries).toHaveBeenCalledWith(
        'day',
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      );
    });

    it('should ignore invalid date formats', async () => {
      mockCallRepository.prototype.getAnalyticsAggregate.mockResolvedValue({
        totalCalls: 0,
        averageDuration: null,
        callsByStatus: {},
        sentimentBreakdown: {},
      });
      mockCallRepository.prototype.getAnalyticsTimeSeries.mockResolvedValue([]);

      const res = await request(app).get('/api/analytics?startDate=invalid-date');

      expect(res.status).toBe(200);
      expect(mockCallRepository.prototype.getAnalyticsAggregate).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should handle repository errors', async () => {
      mockCallRepository.prototype.getAnalyticsAggregate.mockRejectedValue(
        new Error('Database error'),
      );

      const res = await request(app).get('/api/analytics');

      expect(res.status).toBe(500);
    });

    it('should return aggregates with full sentiment breakdown', async () => {
      const mockAggregates = {
        totalCalls: 50,
        averageDuration: 250,
        callsByStatus: {
          completed: 45,
          failed: 5,
        },
        sentimentBreakdown: {
          very_positive: 15,
          positive: 20,
          neutral: 10,
          negative: 4,
          very_negative: 1,
        },
      };

      mockCallRepository.prototype.getAnalyticsAggregate.mockResolvedValue(mockAggregates);
      mockCallRepository.prototype.getAnalyticsTimeSeries.mockResolvedValue([]);

      const res = await request(app).get('/api/analytics');

      expect(res.status).toBe(200);
      expect(res.body.data.aggregates.sentimentBreakdown).toEqual(mockAggregates.sentimentBreakdown);
    });

    it('should return zero values when no calls exist', async () => {
      const mockAggregates = {
        totalCalls: 0,
        averageDuration: null,
        callsByStatus: {},
        sentimentBreakdown: {},
      };

      mockCallRepository.prototype.getAnalyticsAggregate.mockResolvedValue(mockAggregates);
      mockCallRepository.prototype.getAnalyticsTimeSeries.mockResolvedValue([]);

      const res = await request(app).get('/api/analytics');

      expect(res.status).toBe(200);
      expect(res.body.data.aggregates).toEqual(mockAggregates);
      expect(res.body.data.timeSeries).toEqual([]);
    });
  });
});
