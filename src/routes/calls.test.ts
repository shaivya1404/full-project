import request from 'supertest';
import app from '../app';
import { CallRepository } from '../db/repositories/callRepository';
import { StorageService } from '../services/storageService';
import * as fs from 'fs';
import { promisify } from 'util';

jest.mock('../db/repositories/callRepository');
jest.mock('../services/storageService');
jest.mock('fs');

const mockCallRepository = CallRepository as jest.MockedClass<typeof CallRepository>;
const mockStorageService = StorageService as jest.MockedClass<typeof StorageService>;

describe('Calls API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/calls', () => {
    it('should return paginated list of calls', async () => {
      const mockCalls = [
        {
          id: 'call-1',
          streamSid: 'stream-1',
          callSid: 'twilio-1',
          caller: '+1234567890',
          agent: 'agent-1',
          startTime: new Date(),
          endTime: new Date(),
          duration: 300,
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
          recordings: [],
          transcripts: [],
          analytics: [],
          metadata: null,
        },
      ];

      mockCallRepository.prototype.searchCalls.mockResolvedValue({
        calls: mockCalls,
        total: 1,
      });

      const res = await request(app).get('/api/calls');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('total', 1);
      expect(res.body.pagination).toHaveProperty('limit', 10);
      expect(res.body.pagination).toHaveProperty('offset', 0);
      expect(res.body.pagination).toHaveProperty('hasMore', false);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe('call-1');
    });

    it('should support pagination parameters', async () => {
      mockCallRepository.prototype.searchCalls.mockResolvedValue({
        calls: [],
        total: 100,
      });

      const res = await request(app).get('/api/calls?limit=20&offset=40');

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(20);
      expect(res.body.pagination.offset).toBe(40);
      expect(mockCallRepository.prototype.searchCalls).toHaveBeenCalledWith(
        20,
        40,
        expect.any(Object),
      );
    });

    it('should enforce maximum limit of 100', async () => {
      mockCallRepository.prototype.searchCalls.mockResolvedValue({
        calls: [],
        total: 0,
      });

      const res = await request(app).get('/api/calls?limit=200');

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100);
    });

    it('should support caller filter', async () => {
      mockCallRepository.prototype.searchCalls.mockResolvedValue({
        calls: [],
        total: 0,
      });

      const res = await request(app).get('/api/calls?caller=%2B1234567890');

      expect(res.status).toBe(200);
      expect(mockCallRepository.prototype.searchCalls).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          caller: '+1234567890',
        }),
      );
    });

    it('should support agent filter', async () => {
      mockCallRepository.prototype.searchCalls.mockResolvedValue({
        calls: [],
        total: 0,
      });

      const res = await request(app).get('/api/calls?agent=agent-1');

      expect(res.status).toBe(200);
      expect(mockCallRepository.prototype.searchCalls).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          agent: 'agent-1',
        }),
      );
    });

    it('should support sentiment filter', async () => {
      mockCallRepository.prototype.searchCalls.mockResolvedValue({
        calls: [],
        total: 0,
      });

      const res = await request(app).get('/api/calls?sentiment=positive');

      expect(res.status).toBe(200);
      expect(mockCallRepository.prototype.searchCalls).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          sentiment: 'positive',
        }),
      );
    });

    it('should support date range filters', async () => {
      mockCallRepository.prototype.searchCalls.mockResolvedValue({
        calls: [],
        total: 0,
      });

      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';
      const res = await request(app).get(
        `/api/calls?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      );

      expect(res.status).toBe(200);
      expect(mockCallRepository.prototype.searchCalls).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      );
    });

    it('should handle repository errors', async () => {
      mockCallRepository.prototype.searchCalls.mockRejectedValue(
        new Error('Database error'),
      );

      const res = await request(app).get('/api/calls');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/calls/:id', () => {
    it('should return call with full details', async () => {
      const mockCall = {
        id: 'call-1',
        streamSid: 'stream-1',
        callSid: 'twilio-1',
        caller: '+1234567890',
        agent: 'agent-1',
        startTime: new Date(),
        endTime: new Date(),
        duration: 300,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        recordings: [
          {
            id: 'rec-1',
            callId: 'call-1',
            filePath: '/tmp/rec1.wav',
            fileUrl: 'http://example.com/rec1.wav',
            format: 'wav',
            codec: 'pcm',
            sampleRate: 16000,
            channels: 1,
            duration: 300,
            sizeBytes: 9600000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        transcripts: [
          {
            id: 'trans-1',
            callId: 'call-1',
            speaker: 'agent',
            text: 'Hello',
            confidence: 0.95,
            startTime: 0,
            endTime: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        analytics: [
          {
            id: 'ana-1',
            callId: 'call-1',
            sentiment: 'positive',
            sentimentScore: 0.8,
            talkTime: 200,
            silenceTime: 100,
            interruptions: 0,
            averageLatency: 50,
            metrics: null,
            snapshotTime: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        metadata: {
          id: 'meta-1',
          callId: 'call-1',
          language: 'en',
          region: 'US',
          deviceType: 'mobile',
          networkQuality: 'good',
          customData: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockCallRepository.prototype.getCallWithDetails.mockResolvedValue(mockCall);

      const res = await request(app).get('/api/calls/call-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.id).toBe('call-1');
      expect(res.body.data.recordings).toHaveLength(1);
      expect(res.body.data.transcripts).toHaveLength(1);
      expect(res.body.data.analytics).toHaveLength(1);
      expect(res.body.data.metadata).toBeDefined();
    });

    it('should return 404 when call not found', async () => {
      mockCallRepository.prototype.getCallWithDetails.mockResolvedValue(null);

      const res = await request(app).get('/api/calls/nonexistent-id');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Call not found');
      expect(res.body).toHaveProperty('code', 'CALL_NOT_FOUND');
    });

    it('should handle repository errors', async () => {
      mockCallRepository.prototype.getCallWithDetails.mockRejectedValue(
        new Error('Database error'),
      );

      const res = await request(app).get('/api/calls/call-1');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/calls/:id/recording', () => {
    it('should return 404 when call not found', async () => {
      mockCallRepository.prototype.getCallWithDetails.mockResolvedValue(null);

      const res = await request(app).get('/api/calls/nonexistent-id/recording');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Call not found');
    });

    it('should return 404 when recording file does not exist', async () => {
      const mockCall = {
        id: 'call-1',
        streamSid: 'stream-1',
        callSid: 'twilio-1',
        caller: '+1234567890',
        agent: 'agent-1',
        startTime: new Date(),
        endTime: new Date(),
        duration: 300,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
        recordings: [
          {
            id: 'rec-1',
            callId: 'call-1',
            filePath: '/tmp/rec1.wav',
            fileUrl: 'http://example.com/rec1.wav',
            format: 'wav',
            codec: 'pcm',
            sampleRate: 16000,
            channels: 1,
            duration: 300,
            sizeBytes: 9600000,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        transcripts: [],
        analytics: [],
        metadata: null,
      };

      mockCallRepository.prototype.getCallWithDetails.mockResolvedValue(mockCall);
      mockStorageService.prototype.fileExists.mockResolvedValue(false);

      const res = await request(app).get('/api/calls/call-1/recording');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Recording file not found on storage');
      expect(res.body).toHaveProperty('code', 'FILE_NOT_FOUND');
    });
  });
});
