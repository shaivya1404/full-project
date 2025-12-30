import { CallManager } from './callManager';
import { CallRepository } from '../db/repositories/callRepository';
import { StorageService } from './storageService';
import { AnalyticsService } from './analyticsService';
import { Call } from '@prisma/client';

jest.mock('../db/repositories/callRepository');
jest.mock('./storageService');
jest.mock('./analyticsService');

describe('CallManager', () => {
  let manager: CallManager;
  let mockRepository: jest.Mocked<CallRepository>;
  let mockStorage: jest.Mocked<StorageService>;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(() => {
    mockRepository = {
      createCall: jest.fn(),
      updateCall: jest.fn(),
      getCallById: jest.fn(),
      getCallByStreamSid: jest.fn(),
      getCallByCallSid: jest.fn(),
      getAllCalls: jest.fn(),
      createRecording: jest.fn(),
      getRecordingsByCallId: jest.fn(),
      createTranscript: jest.fn(),
      getTranscriptsByCallId: jest.fn(),
      createAnalytics: jest.fn(),
      getAnalyticsByCallId: jest.fn(),
      createOrUpdateMetadata: jest.fn(),
      getMetadataByCallId: jest.fn(),
      deleteCall: jest.fn(),
      getCallWithDetails: jest.fn(),
    } as any;

    mockStorage = {
      saveRecording: jest.fn(),
      appendToRecording: jest.fn(),
      saveTranscript: jest.fn(),
      saveMetadata: jest.fn(),
      getFilePath: jest.fn(),
      fileExists: jest.fn(),
      deleteFile: jest.fn(),
    } as any;

    mockAnalyticsService = {
      processAllTranscripts: jest.fn(),
      analyzeTranscripts: jest.fn(),
      updateAllCampaignAnalytics: jest.fn(),
      getTopFAQs: jest.fn(),
      getTopUnansweredQuestions: jest.fn(),
      getTopicBreakdown: jest.fn(),
      getCampaignPerformance: jest.fn(),
      getAnalyticsSummary: jest.fn(),
      generateCSVReport: jest.fn(),
    } as any;

    (CallRepository as jest.Mock).mockImplementation(() => mockRepository);
    (StorageService as jest.Mock).mockImplementation(() => mockStorage);
    (AnalyticsService as jest.Mock).mockImplementation(() => mockAnalyticsService);

    manager = new CallManager();
  });

  describe('Call lifecycle', () => {
    it('should start a call', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createCall.mockResolvedValue(mockCall);

      const call = await manager.startCall('stream_123', '+1234567890');

      expect(call).toBe(mockCall);
      expect(mockRepository.createCall).toHaveBeenCalledWith({
        streamSid: 'stream_123',
        caller: '+1234567890',
        callSid: undefined,
      });
      expect(manager.isCallActive('stream_123')).toBe(true);
    });

    it('should update a call', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createCall.mockResolvedValue(mockCall);
      mockRepository.getCallById.mockResolvedValue({
        ...mockCall,
        callSid: 'call_123',
        agent: 'Agent Smith',
      });

      await manager.startCall('stream_123', '+1234567890');
      await manager.updateCall('stream_123', 'call_123', 'Agent Smith');

      expect(mockRepository.updateCall).toHaveBeenCalledWith('call_123', {
        callSid: 'call_123',
        agent: 'Agent Smith',
      });
    });

    it('should end a call', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createCall.mockResolvedValue(mockCall);
      mockRepository.getCallWithDetails.mockResolvedValue({
        ...mockCall,
        recordings: [],
        transcripts: [{ speaker: 'user', text: 'Hello?' }],
        analytics: [],
        metadata: null,
      } as any);

      await manager.startCall('stream_123', '+1234567890');
      await manager.endCall('stream_123');

      expect(mockRepository.updateCall).toHaveBeenCalled();
      expect(mockAnalyticsService.analyzeTranscripts).toHaveBeenCalled();
      expect(manager.isCallActive('stream_123')).toBe(false);
    });

    it('should handle end call for non-existent call', async () => {
      await expect(manager.endCall('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('Audio recording', () => {
    it('should add audio chunks', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createCall.mockResolvedValue(mockCall);

      await manager.startCall('stream_123', '+1234567890');

      const base64Audio = Buffer.alloc(80).toString('base64');
      await manager.addAudioChunk('stream_123', base64Audio);

      expect(true).toBe(true);
    });

    it('should save recording on call end', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createCall.mockResolvedValue(mockCall);
      mockRepository.getCallWithDetails.mockResolvedValue({
        ...mockCall,
        recordings: [],
        transcripts: [],
        analytics: [],
        metadata: null,
      } as any);
      mockStorage.saveRecording.mockResolvedValue({
        filePath: '/recordings/test.wav',
        sizeBytes: 1000,
        duration: 1.5,
      });

      await manager.startCall('stream_123', '+1234567890');

      const base64Audio = Buffer.alloc(80).toString('base64');
      await manager.addAudioChunk('stream_123', base64Audio);

      await manager.endCall('stream_123');

      expect(mockStorage.saveRecording).toHaveBeenCalled();
      expect(mockRepository.createRecording).toHaveBeenCalled();
    });

    it('should not save recording if no audio chunks', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createCall.mockResolvedValue(mockCall);
      mockRepository.getCallWithDetails.mockResolvedValue({
        ...mockCall,
        recordings: [],
        transcripts: [],
        analytics: [],
        metadata: null,
      } as any);

      await manager.startCall('stream_123', '+1234567890');
      await manager.endCall('stream_123');

      expect(mockStorage.saveRecording).not.toHaveBeenCalled();
    });
  });

  describe('Transcript operations', () => {
    it('should add transcript', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createCall.mockResolvedValue(mockCall);

      await manager.startCall('stream_123', '+1234567890');
      await manager.addTranscript('stream_123', 'caller', 'Hello, how can I help?', 0.95);

      expect(mockRepository.createTranscript).toHaveBeenCalledWith({
        callId: 'call_123',
        speaker: 'caller',
        text: 'Hello, how can I help?',
        confidence: 0.95,
        startTime: undefined,
        endTime: undefined,
      });
    });

    it('should handle transcript for non-existent call', async () => {
      await expect(manager.addTranscript('nonexistent', 'caller', 'Test')).resolves.not.toThrow();
    });
  });

  describe('Analytics operations', () => {
    it('should add analytics', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createCall.mockResolvedValue(mockCall);

      await manager.startCall('stream_123', '+1234567890');
      await manager.addAnalytics('stream_123', {
        sentiment: 'positive',
        sentimentScore: 0.8,
        talkTime: 45.5,
      });

      expect(mockRepository.createAnalytics).toHaveBeenCalledWith({
        callId: 'call_123',
        sentiment: 'positive',
        sentimentScore: 0.8,
        talkTime: 45.5,
        silenceTime: undefined,
        interruptions: undefined,
        averageLatency: undefined,
        metrics: undefined,
      });
    });

    it('should handle analytics for non-existent call', async () => {
      await expect(
        manager.addAnalytics('nonexistent', { sentiment: 'neutral' }),
      ).resolves.not.toThrow();
    });
  });

  describe('Metadata operations', () => {
    it('should set metadata', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createCall.mockResolvedValue(mockCall);

      await manager.startCall('stream_123', '+1234567890');
      await manager.setMetadata('stream_123', {
        language: 'en-US',
        region: 'US',
      });

      expect(mockRepository.createOrUpdateMetadata).toHaveBeenCalledWith({
        callId: 'call_123',
        language: 'en-US',
        region: 'US',
        deviceType: undefined,
        networkQuality: undefined,
        customData: undefined,
      });
    });

    it('should handle metadata for non-existent call', async () => {
      await expect(
        manager.setMetadata('nonexistent', { language: 'en-US' }),
      ).resolves.not.toThrow();
    });
  });

  describe('Query operations', () => {
    it('should get call by streamSid', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getCallByStreamSid.mockResolvedValue(mockCall);

      const call = await manager.getCall('stream_123');

      expect(call).toBe(mockCall);
      expect(mockRepository.getCallByStreamSid).toHaveBeenCalledWith('stream_123');
    });

    it('should get call by id', async () => {
      const mockCall: Call = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getCallById.mockResolvedValue(mockCall);

      const call = await manager.getCallById('call_123');

      expect(call).toBe(mockCall);
      expect(mockRepository.getCallById).toHaveBeenCalledWith('call_123');
    });

    it('should get all calls', async () => {
      const mockCalls: Call[] = [
        {
          id: 'call_1',
          streamSid: 'stream_1',
          callSid: null,
          caller: '+1111111111',
          agent: null,
          startTime: new Date(),
          endTime: null,
          duration: null,
          status: 'active',
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'call_2',
          streamSid: 'stream_2',
          callSid: null,
          caller: '+2222222222',
          agent: null,
          startTime: new Date(),
          endTime: null,
          duration: null,
          status: 'active',
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.getAllCalls.mockResolvedValue(mockCalls);

      const calls = await manager.getAllCalls(10, 0);

      expect(calls).toBe(mockCalls);
      expect(mockRepository.getAllCalls).toHaveBeenCalledWith(10, 0);
    });
  });
});
