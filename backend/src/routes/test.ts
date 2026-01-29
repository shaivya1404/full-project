import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CallRepository } from '../db/repositories/callRepository';
import { StorageService } from '../services/storageService';
import { logger } from '../utils/logger';

const router = Router();

let callRepository: CallRepository;
let storageService: StorageService;

const getRepositories = () => {
  if (!callRepository) {
    callRepository = new CallRepository();
  }
  if (!storageService) {
    storageService = new StorageService();
  }
  return { callRepository, storageService };
};

interface ErrorResponse {
  message: string;
  error?: string;
  code?: string;
}

// GET /api/test/calls - Returns demo call data if available
router.get('/calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callRepository: repo } = getRepositories();
    const calls = await repo.getAllCalls(10, 0);

    res.status(200).json({
      data: {
        calls,
        totalCalls: calls.length,
      },
      message: 'Test calls retrieved successfully',
    });
  } catch (error) {
    logger.error('Error fetching test calls', error);
    next(error);
  }
});

// POST /api/test/simulate-call - Simulate a complete call for testing
router.post('/simulate-call', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callRepository: repo, storageService: storage } = getRepositories();

    const streamSid = `stream_${Date.now()}`;
    const callSid = `CA${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const caller = '+1234567890';
    const agent = 'agent@example.com';

    const durationSeconds = Math.floor(Math.random() * 900) + 120;

    const call = await repo.createCall({
      streamSid,
      callSid,
      caller,
      agent,
    });

    const endTime = new Date();
    endTime.setSeconds(endTime.getSeconds() + durationSeconds);

    await repo.updateCall(call.id, {
      endTime,
      duration: durationSeconds,
      status: 'completed',
    });

    const transcript = [
      { speaker: 'customer', text: 'Hello, how can I help you today?' },
      { speaker: 'agent', text: 'Hi! Thank you for calling. How can I assist you?' },
      { speaker: 'customer', text: 'I want to know about your premium plan.' },
      { speaker: 'agent', text: 'Great! Our premium plan offers unlimited features.' },
      { speaker: 'customer', text: 'What is the pricing?' },
      { speaker: 'agent', text: 'The premium plan is $99 per month.' },
      { speaker: 'customer', text: 'That sounds good. Can I sign up now?' },
      { speaker: 'agent', text: 'Of course! Let me help you with that.' },
      { speaker: 'customer', text: 'Thank you so much!' },
      { speaker: 'agent', text: 'You are welcome. Have a great day!' },
    ];

    let currentTime = 0;
    for (let i = 0; i < transcript.length; i++) {
      const startTime = currentTime;
      const endTime = currentTime + 5 + Math.random() * 5;

      await repo.createTranscript({
        callId: call.id,
        speaker: transcript[i].speaker,
        text: transcript[i].text,
        confidence: 0.95 + Math.random() * 0.05,
        startTime,
        endTime,
      });

      currentTime = endTime;
    }

    const sentiments = ['positive', 'neutral', 'negative'];
    const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    const sentimentScore = Math.random();

    await repo.createAnalytics({
      callId: call.id,
      sentiment,
      sentimentScore,
      talkTime: durationSeconds * 0.7,
      silenceTime: durationSeconds * 0.3,
      interruptions: Math.floor(Math.random() * 3),
      averageLatency: 50 + Math.random() * 100,
    });

    await repo.createOrUpdateMetadata({
      callId: call.id,
      language: 'en-US',
      region: 'US',
      deviceType: 'phone',
      networkQuality: 'good',
    });

    const demoAudioPath = path.join(
      process.env.RECORDING_STORAGE_PATH || './recordings',
      `call_${call.id}.wav`,
    );

    const storageDir = process.env.RECORDING_STORAGE_PATH || './recordings';
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const dummyAudio = Buffer.alloc(1024);
    fs.writeFileSync(demoAudioPath, dummyAudio);

    await repo.createRecording({
      callId: call.id,
      filePath: demoAudioPath,
      format: 'wav',
      codec: 'pcm',
      sampleRate: 16000,
      channels: 1,
      duration: durationSeconds,
      sizeBytes: 1024,
    });

    const callWithDetails = await repo.getCallWithDetails(call.id);

    res.status(201).json({
      data: callWithDetails,
      message: 'Test call simulated successfully',
    });
  } catch (error) {
    logger.error('Error simulating call', error);
    next(error);
  }
});

export default router;
