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

  // Helper function to create mock Call objects
  const createMockCall = (id: string = 'call_123'): Call => ({
    id,
    streamSid: `stream_${id}`,
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
    teamId: 'test-team-id',
  });

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
    } as any;

    // Mock the CallManager's dependencies
    (CallManager.prototype as any).repository = mockRepository;
    (CallManager.prototype as any).storage = mockStorage;
    (CallManager.prototype as any).analyticsService = mockAnalyticsService;

    manager = new CallManager();
  });

  describe('Call lifecycle', () => {
    it('should start a call', async () => {
      const mockCall = createMockCall('call_123');

      mockRepository.createCall.mockResolvedValue(mockCall);

      const call = await manager.startCall('stream_123', '+1234567890');

      expect(call).toBe(mockCall);
      expect(mockRepository.createCall).toHaveBeenCalledWith({
        streamSid: 'stream_123',
        callSid: undefined,
        caller: '+1234567890',
        teamId: undefined,
      });
    });

    it('should update call', async () => {
      const mockCall = createMockCall();

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
      const mockCall = createMockCall();

      mockRepository.createCall.mockResolvedValue(mockCall);
      mockRepository.getCallWithDetails.mockResolvedValue({
        ...mockCall,
        recordings: [],
        transcripts: [],
        analytics: [],
        metadata: null,
      });

      await manager.startCall('stream_123', '+1234567890');
      await manager.endCall('stream_123');

      expect(mockRepository.updateCall).toHaveBeenCalledWith(
        'call_123',
        expect.objectContaining({
          endTime: expect.any(Date),
          status: 'completed',
        }),
      );
    });

    it('should handle non-existent call when ending', async () => {
      await expect(manager.endCall('nonexistent')).resolves.not.toThrow();
    });

    it('should not save recording if no audio chunks', async () => {
      const mockCall = createMockCall();

      mockRepository.createCall.mockResolvedValue(mockCall);
      mockRepository.getCallWithDetails.mockResolvedValue({
        ...mockCall,
        recordings: [],
        transcripts: [],
        analytics: [],
        metadata: null,
      });

      await manager.startCall('stream_123', '+1234567890');
      await manager.endCall('stream_123');

      expect(mockStorage.saveRecording).not.toHaveBeenCalled();
    });
  });

  describe('Transcript operations', () => {
    it('should add transcript', async () => {
      const mockCall = createMockCall();

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
      await expect(
        manager.addTranscript('nonexistent', 'caller', 'Hello', 0.9),
      ).resolves.not.toThrow();
    });
  });

  describe('Recording operations', () => {
    it('should add audio chunk', async () => {
      const mockCall = createMockCall();

      mockRepository.createCall.mockResolvedValue(mockCall);
      mockStorage.saveRecording.mockResolvedValue({
        filePath: '/tmp/recording.wav',
        duration: 10.5,
        sizeBytes: 1024,
      });

      await manager.startCall('stream_123', '+1234567890');
      await manager.addAudioChunk('stream_123', 'base64audio');
      await manager.endCall('stream_123');

      expect(mockStorage.saveRecording).toHaveBeenCalled();
    });

    it('should handle audio chunk for non-existent call', async () => {
      await expect(
        manager.addAudioChunk('nonexistent', 'base64audio'),
      ).resolves.not.toThrow();
    });
  });

  describe('Analytics operations', () => {
    it('should add analytics', async () => {
      const mockCall = createMockCall('call_123');

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
      const mockCall = createMockCall();

      mockRepository.createCall.mockResolvedValue(mockCall);

      await manager.startCall('stream_123', '+1234567890');
      await manager.setMetadata('stream_123', {
        language: 'en-US',
        region: 'US',
        deviceType: 'mobile',
        networkQuality: 'good',
        customData: { platform: 'iOS' },
      });

      expect(mockRepository.createOrUpdateMetadata).toHaveBeenCalledWith({
        callId: 'call_123',
        language: 'en-US',
        region: 'US',
        deviceType: 'mobile',
        networkQuality: 'good',
        customData: '{"platform":"iOS"}',
      });
    });

    it('should handle metadata for non-existent call', async () => {
      await expect(
        manager.setMetadata('nonexistent', { language: 'en' }),
      ).resolves.not.toThrow();
    });
  });

  describe('Knowledge Integration', () => {
    it('should initialize knowledge context', async () => {
      const mockCall = createMockCall();
      mockRepository.createCall.mockResolvedValue(mockCall);

      await manager.startCall('stream_123', '+1234567890', undefined, 'team-123', 'campaign-456', 'customer-support');

      const session = (manager as any).activeCalls.get('stream_123');
      expect(session).toBeDefined();
      expect(session.teamId).toBe('team-123');
      expect(session.campaignId).toBe('campaign-456');
      expect(session.templateId).toBe('customer-support');
    });

    it('should search relevant knowledge', async () => {
      const results = await manager.searchRelevantKnowledge('pricing plans', 'team-123', 5);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should track unanswered questions', async () => {
      await expect(
        manager.trackUnansweredQuestion('What is the meaning of life?'),
      ).resolves.not.toThrow();
    });
  });

  describe('Fallback Detection', () => {
    it('should detect fallback scenarios', () => {
      const shouldFallback = manager.shouldTriggerFallback('stream_123', "I don't know the answer to that question");
      expect(shouldFallback).toBe(true);
    });

    it('should not trigger fallback for confident responses', () => {
      const shouldFallback = manager.shouldTriggerFallback('stream_123', 'Based on our product features, I can help you with that');
      expect(shouldFallback).toBe(false);
    });
  });
});