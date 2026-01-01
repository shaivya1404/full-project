import { CallAnalyticsService } from './callAnalyticsService';
import { CallRepository } from '../db/repositories/callRepository';

jest.mock('../db/repositories/callRepository');

const mockCallRepository = CallRepository as jest.MockedClass<typeof CallRepository>;

describe('CallAnalyticsService', () => {
  let service: CallAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CallAnalyticsService();
  });

  describe('getCallAnalytics', () => {
    it('should return complete analytics data', async () => {
      // Mock the prisma client indirectly through the service
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'call-1',
              status: 'completed',
              duration: 300,
              createdAt: new Date('2026-01-01T10:00:00Z'),
              analytics: [{ sentimentScore: 0.8 }],
              orders: [{ id: 'order-1' }],
            },
            {
              id: 'call-2',
              status: 'failed',
              duration: 150,
              createdAt: new Date('2026-01-01T14:00:00Z'),
              analytics: [{ sentimentScore: 0.5 }],
              orders: [],
            },
          ]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      const result = await service.getCallAnalytics();

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('topReasons');
      expect(result).toHaveProperty('peakHours');
    });

    it('should handle empty data', async () => {
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      const result = await service.getCallAnalytics();

      expect(result.summary.totalCalls).toBe(0);
      expect(result.summary.completedCalls).toBe(0);
      expect(result.summary.failedCalls).toBe(0);
      expect(result.summary.activeOngoingCalls).toBe(0);
      expect(result.summary.averageCallDuration).toBe(0);
      expect(result.summary.averageSentiment).toBe(0);
      expect(result.summary.conversionRate).toBe(0);
    });

    it('should calculate conversion rate correctly', async () => {
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'call-1',
              status: 'completed',
              duration: 300,
              createdAt: new Date('2026-01-01T10:00:00Z'),
              analytics: [],
              orders: [{ id: 'order-1' }],
            },
            {
              id: 'call-2',
              status: 'completed',
              duration: 250,
              createdAt: new Date('2026-01-01T11:00:00Z'),
              analytics: [],
              orders: [],
            },
            {
              id: 'call-3',
              status: 'completed',
              duration: 280,
              createdAt: new Date('2026-01-01T12:00:00Z'),
              analytics: [],
              orders: [{ id: 'order-2' }],
            },
          ]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      const result = await service.getCallAnalytics();

      expect(result.summary.completedCalls).toBe(3);
      expect(result.summary.conversionRate).toBe(2 / 3); // 2 orders out of 3 completed calls
    });

    it('should calculate average duration correctly', async () => {
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'call-1',
              status: 'completed',
              duration: 300,
              createdAt: new Date('2026-01-01T10:00:00Z'),
              analytics: [],
              orders: [],
            },
            {
              id: 'call-2',
              status: 'completed',
              duration: 200,
              createdAt: new Date('2026-01-01T11:00:00Z'),
              analytics: [],
              orders: [],
            },
            {
              id: 'call-3',
              status: 'completed',
              duration: 400,
              createdAt: new Date('2026-01-01T12:00:00Z'),
              analytics: [],
              orders: [],
            },
          ]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      const result = await service.getCallAnalytics();

      expect(result.summary.averageCallDuration).toBe(300); // (300 + 200 + 400) / 3 = 300
    });

    it('should calculate average sentiment correctly', async () => {
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'call-1',
              status: 'completed',
              duration: 300,
              createdAt: new Date('2026-01-01T10:00:00Z'),
              analytics: [{ sentimentScore: 0.8 }],
              orders: [],
            },
            {
              id: 'call-2',
              status: 'completed',
              duration: 250,
              createdAt: new Date('2026-01-01T11:00:00Z'),
              analytics: [{ sentimentScore: 0.6 }, { sentimentScore: 0.7 }],
              orders: [],
            },
            {
              id: 'call-3',
              status: 'completed',
              duration: 280,
              createdAt: new Date('2026-01-01T12:00:00Z'),
              analytics: [{ sentimentScore: 0.9 }],
              orders: [],
            },
          ]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      const result = await service.getCallAnalytics();

      // Call 1: 0.8, Call 2: (0.6 + 0.7) / 2 = 0.65, Call 3: 0.9
      // Average: (0.8 + 0.65 + 0.9) / 3 = 0.7833
      expect(result.summary.averageSentiment).toBeCloseTo(0.78, 1);
    });

    it('should group trends by date', async () => {
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'call-1',
              status: 'completed',
              duration: 300,
              createdAt: new Date('2026-01-01T10:00:00Z'),
              analytics: [],
              orders: [],
            },
            {
              id: 'call-2',
              status: 'failed',
              duration: 150,
              createdAt: new Date('2026-01-01T14:00:00Z'),
              analytics: [],
              orders: [],
            },
            {
              id: 'call-3',
              status: 'completed',
              duration: 280,
              createdAt: new Date('2026-01-02T10:00:00Z'),
              analytics: [],
              orders: [],
            },
          ]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      const result = await service.getCallAnalytics();

      expect(result.trends).toHaveLength(2);
      expect(result.trends[0].date).toBe('2026-01-01');
      expect(result.trends[0].calls).toBe(2);
      expect(result.trends[0].completed).toBe(1);
      expect(result.trends[0].failed).toBe(1);
      expect(result.trends[1].date).toBe('2026-01-02');
      expect(result.trends[1].calls).toBe(1);
      expect(result.trends[1].completed).toBe(1);
    });

    it('should identify peak hours', async () => {
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'call-1',
              status: 'completed',
              duration: 300,
              createdAt: new Date('2026-01-01T10:00:00Z'),
              analytics: [],
              orders: [],
            },
            {
              id: 'call-2',
              status: 'completed',
              duration: 250,
              createdAt: new Date('2026-01-01T10:30:00Z'),
              analytics: [],
              orders: [],
            },
            {
              id: 'call-3',
              status: 'completed',
              duration: 280,
              createdAt: new Date('2026-01-01T14:00:00Z'),
              analytics: [],
              orders: [],
            },
            {
              id: 'call-4',
              status: 'completed',
              duration: 320,
              createdAt: new Date('2026-01-01T14:15:00Z'),
              analytics: [],
              orders: [],
            },
            {
              id: 'call-5',
              status: 'completed',
              duration: 270,
              createdAt: new Date('2026-01-01T14:30:00Z'),
              analytics: [],
              orders: [],
            },
          ]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      const result = await service.getCallAnalytics();

      expect(result.peakHours[0].hour).toBe(14);
      expect(result.peakHours[0].calls).toBe(3);
      expect(result.peakHours[1].hour).toBe(10);
      expect(result.peakHours[1].calls).toBe(2);
    });

    it('should filter by teamId', async () => {
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'call-1',
              status: 'completed',
              duration: 300,
              createdAt: new Date('2026-01-01T10:00:00Z'),
              analytics: [],
              orders: [],
              teamId: 'team-123',
            },
          ]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      await service.getCallAnalytics({ teamId: 'team-123' });

      expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teamId: 'team-123',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      await service.getCallAnalytics({
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          }),
        })
      );
    });

    it('should filter by campaignId', async () => {
      const mockPrisma = {
        call: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'call-1',
              status: 'completed',
              duration: 300,
              createdAt: new Date('2026-01-01T10:00:00Z'),
              analytics: [],
              orders: [],
              campaignId: 'campaign-123',
            },
          ]),
        },
      };

      (service as any).callRepository.prisma = mockPrisma;

      await service.getCallAnalytics({ campaignId: 'campaign-123' });

      expect(mockPrisma.call.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            campaignId: 'campaign-123',
          }),
        })
      );
    });
  });
});
