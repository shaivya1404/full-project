import { PrismaClient } from '@prisma/client';
import { CallRepository } from './callRepository';

const mockPrisma = {
  call: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  recording: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  transcript: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  analytics: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  callMetadata: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

jest.mock('../client', () => ({
  getPrismaClient: () => mockPrisma,
}));

describe('CallRepository', () => {
  let repository: CallRepository;

  beforeEach(() => {
    repository = new CallRepository();
    jest.clearAllMocks();
  });

  describe('Call operations', () => {
    it('should create a new call', async () => {
      const mockCall = {
        id: 'call_123',
        streamSid: 'stream_123',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.call.create as jest.Mock).mockResolvedValue(mockCall);

      const call = await repository.createCall({
        streamSid: 'stream_123',
        caller: '+1234567890',
      });

      expect(call).toEqual(mockCall);
      expect(mockPrisma.call.create).toHaveBeenCalledWith({
        data: {
          streamSid: 'stream_123',
          caller: '+1234567890',
          callSid: undefined,
          agent: undefined,
        },
      });
    });

    it('should create call with optional fields', async () => {
      const mockCall = {
        id: 'call_456',
        streamSid: 'stream_456',
        callSid: 'call_456',
        caller: '+1234567890',
        agent: 'Agent Smith',
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.call.create as jest.Mock).mockResolvedValue(mockCall);

      const call = await repository.createCall({
        streamSid: 'stream_456',
        callSid: 'call_456',
        caller: '+1234567890',
        agent: 'Agent Smith',
      });

      expect(call.callSid).toBe('call_456');
      expect(call.agent).toBe('Agent Smith');
    });

    it('should update a call', async () => {
      const mockCall = {
        id: 'call_789',
        streamSid: 'stream_789',
        callSid: 'call_789',
        caller: '+1234567890',
        agent: 'Agent Jones',
        startTime: new Date(),
        endTime: null,
        duration: 120,
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.call.update as jest.Mock).mockResolvedValue(mockCall);

      const updated = await repository.updateCall('call_789', {
        callSid: 'call_789',
        agent: 'Agent Jones',
        status: 'completed',
        duration: 120,
      });

      expect(updated.callSid).toBe('call_789');
      expect(updated.agent).toBe('Agent Jones');
      expect(updated.status).toBe('completed');
      expect(updated.duration).toBe(120);
    });

    it('should get call by id', async () => {
      const mockCall = {
        id: 'call_abc',
        streamSid: 'stream_abc',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

      const retrieved = await repository.getCallById('call_abc');

      expect(retrieved).toEqual(mockCall);
      expect(mockPrisma.call.findUnique).toHaveBeenCalledWith({
        where: { id: 'call_abc' },
        include: {
          recordings: true,
          transcripts: true,
          analytics: true,
          metadata: true,
        },
      });
    });

    it('should get call by streamSid', async () => {
      const mockCall = {
        id: 'call_def',
        streamSid: 'stream_def',
        callSid: null,
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

      const retrieved = await repository.getCallByStreamSid('stream_def');

      expect(retrieved).toEqual(mockCall);
    });

    it('should get call by callSid', async () => {
      const mockCall = {
        id: 'call_ghi',
        streamSid: 'stream_ghi',
        callSid: 'call_ghi',
        caller: '+1234567890',
        agent: null,
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.call.findUnique as jest.Mock).mockResolvedValue(mockCall);

      const retrieved = await repository.getCallByCallSid('call_ghi');

      expect(retrieved).toEqual(mockCall);
    });

    it('should get all calls', async () => {
      const mockCalls = [
        {
          id: 'call_1',
          streamSid: 'stream_1',
          callSid: null,
          caller: '+1234567890',
          agent: null,
          startTime: new Date(),
          endTime: null,
          duration: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'call_2',
          streamSid: 'stream_2',
          callSid: null,
          caller: '+9876543210',
          agent: null,
          startTime: new Date(),
          endTime: null,
          duration: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

      const calls = await repository.getAllCalls();

      expect(calls.length).toBe(2);
    });

    it('should get calls with pagination', async () => {
      const mockCalls = [
        {
          id: 'call_b',
          streamSid: 'stream_b',
          callSid: null,
          caller: '+2222222222',
          agent: null,
          startTime: new Date(),
          endTime: null,
          duration: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'call_c',
          streamSid: 'stream_c',
          callSid: null,
          caller: '+3333333333',
          agent: null,
          startTime: new Date(),
          endTime: null,
          duration: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.call.findMany as jest.Mock).mockResolvedValue(mockCalls);

      const calls = await repository.getAllCalls(2, 1);

      expect(calls.length).toBe(2);
      expect(mockPrisma.call.findMany).toHaveBeenCalledWith({
        take: 2,
        skip: 1,
        orderBy: { createdAt: 'desc' },
        include: {
          recordings: true,
          transcripts: true,
          analytics: true,
          metadata: true,
        },
      });
    });

    it('should delete a call', async () => {
      (mockPrisma.call.delete as jest.Mock).mockResolvedValue({});

      await repository.deleteCall('call_delete');

      expect(mockPrisma.call.delete).toHaveBeenCalledWith({
        where: { id: 'call_delete' },
      });
    });
  });

  describe('Recording operations', () => {
    it('should create a recording', async () => {
      const mockRecording = {
        id: 'rec_123',
        callId: 'call_rec',
        filePath: '/recordings/test.wav',
        fileUrl: null,
        format: 'wav',
        codec: 'pcm',
        sampleRate: 8000,
        channels: 1,
        duration: null,
        sizeBytes: 1024,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.recording.create as jest.Mock).mockResolvedValue(mockRecording);

      const recording = await repository.createRecording({
        callId: 'call_rec',
        filePath: '/recordings/test.wav',
        sizeBytes: 1024,
      });

      expect(recording).toEqual(mockRecording);
      expect(recording.format).toBe('wav');
      expect(recording.codec).toBe('pcm');
    });

    it('should get recordings by call id', async () => {
      const mockRecordings = [
        {
          id: 'rec_1',
          callId: 'call_rec2',
          filePath: '/recordings/test1.wav',
          fileUrl: null,
          format: 'wav',
          codec: 'pcm',
          sampleRate: 8000,
          channels: 1,
          duration: null,
          sizeBytes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'rec_2',
          callId: 'call_rec2',
          filePath: '/recordings/test2.wav',
          fileUrl: null,
          format: 'wav',
          codec: 'pcm',
          sampleRate: 8000,
          channels: 1,
          duration: null,
          sizeBytes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.recording.findMany as jest.Mock).mockResolvedValue(mockRecordings);

      const recordings = await repository.getRecordingsByCallId('call_rec2');

      expect(recordings.length).toBe(2);
    });
  });

  describe('Transcript operations', () => {
    it('should create a transcript', async () => {
      const mockTranscript = {
        id: 'trans_123',
        callId: 'call_trans',
        speaker: 'caller',
        text: 'Hello, how can I help you?',
        confidence: 0.95,
        startTime: null,
        endTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.transcript.create as jest.Mock).mockResolvedValue(mockTranscript);

      const transcript = await repository.createTranscript({
        callId: 'call_trans',
        speaker: 'caller',
        text: 'Hello, how can I help you?',
        confidence: 0.95,
      });

      expect(transcript).toEqual(mockTranscript);
      expect(transcript.speaker).toBe('caller');
      expect(transcript.text).toBe('Hello, how can I help you?');
      expect(transcript.confidence).toBe(0.95);
    });

    it('should get transcripts by call id', async () => {
      const mockTranscripts = [
        {
          id: 'trans_1',
          callId: 'call_trans2',
          speaker: 'caller',
          text: 'First message',
          confidence: null,
          startTime: null,
          endTime: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'trans_2',
          callId: 'call_trans2',
          speaker: 'agent',
          text: 'Second message',
          confidence: null,
          startTime: null,
          endTime: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.transcript.findMany as jest.Mock).mockResolvedValue(mockTranscripts);

      const transcripts = await repository.getTranscriptsByCallId('call_trans2');

      expect(transcripts.length).toBe(2);
    });
  });

  describe('Analytics operations', () => {
    it('should create analytics', async () => {
      const mockAnalytics = {
        id: 'analytics_123',
        callId: 'call_analytics',
        sentiment: 'positive',
        sentimentScore: 0.8,
        talkTime: 45.5,
        silenceTime: 5.2,
        interruptions: 2,
        averageLatency: 150.5,
        metrics: null,
        snapshotTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.analytics.create as jest.Mock).mockResolvedValue(mockAnalytics);

      const analytics = await repository.createAnalytics({
        callId: 'call_analytics',
        sentiment: 'positive',
        sentimentScore: 0.8,
        talkTime: 45.5,
        silenceTime: 5.2,
        interruptions: 2,
        averageLatency: 150.5,
      });

      expect(analytics).toEqual(mockAnalytics);
      expect(analytics.sentiment).toBe('positive');
      expect(analytics.sentimentScore).toBe(0.8);
      expect(analytics.talkTime).toBe(45.5);
    });

    it('should get analytics by call id', async () => {
      const mockAnalytics = [
        {
          id: 'analytics_1',
          callId: 'call_analytics2',
          sentiment: 'positive',
          sentimentScore: 0.8,
          talkTime: null,
          silenceTime: null,
          interruptions: null,
          averageLatency: null,
          metrics: null,
          snapshotTime: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'analytics_2',
          callId: 'call_analytics2',
          sentiment: 'neutral',
          sentimentScore: 0.5,
          talkTime: null,
          silenceTime: null,
          interruptions: null,
          averageLatency: null,
          metrics: null,
          snapshotTime: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.analytics.findMany as jest.Mock).mockResolvedValue(mockAnalytics);

      const analytics = await repository.getAnalyticsByCallId('call_analytics2');

      expect(analytics.length).toBe(2);
    });
  });

  describe('Metadata operations', () => {
    it('should create metadata', async () => {
      const mockMetadata = {
        id: 'meta_123',
        callId: 'call_meta',
        language: 'en-US',
        region: 'US',
        deviceType: 'mobile',
        networkQuality: 'good',
        customData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.callMetadata.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.callMetadata.create as jest.Mock).mockResolvedValue(mockMetadata);

      const metadata = await repository.createOrUpdateMetadata({
        callId: 'call_meta',
        language: 'en-US',
        region: 'US',
        deviceType: 'mobile',
        networkQuality: 'good',
      });

      expect(metadata).toEqual(mockMetadata);
      expect(metadata.language).toBe('en-US');
      expect(metadata.region).toBe('US');
    });

    it('should update existing metadata', async () => {
      const existingMetadata = {
        id: 'meta_456',
        callId: 'call_meta2',
        language: 'en-US',
        region: null,
        deviceType: null,
        networkQuality: null,
        customData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedMetadata = {
        ...existingMetadata,
        language: 'es-ES',
        region: 'ES',
      };

      (mockPrisma.callMetadata.findUnique as jest.Mock).mockResolvedValue(existingMetadata);
      (mockPrisma.callMetadata.update as jest.Mock).mockResolvedValue(updatedMetadata);

      const metadata = await repository.createOrUpdateMetadata({
        callId: 'call_meta2',
        language: 'es-ES',
        region: 'ES',
      });

      expect(metadata.language).toBe('es-ES');
      expect(metadata.region).toBe('ES');
    });

    it('should get metadata by call id', async () => {
      const mockMetadata = {
        id: 'meta_789',
        callId: 'call_meta3',
        language: 'en-US',
        region: null,
        deviceType: null,
        networkQuality: null,
        customData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.callMetadata.findUnique as jest.Mock).mockResolvedValue(mockMetadata);

      const metadata = await repository.getMetadataByCallId('call_meta3');

      expect(metadata).toEqual(mockMetadata);
      expect(metadata?.language).toBe('en-US');
    });
  });
});
