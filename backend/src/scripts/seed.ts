import * as fs from 'fs';
import * as path from 'path';
import { CallRepository } from '../db/repositories/callRepository';
import { logger } from '../utils/logger';
import { config } from '../config/env';

async function seedDatabase() {
  try {
    const callRepository = new CallRepository();

    const storageDir = config.RECORDING_STORAGE_PATH;
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
      logger.info(`Created storage directory at ${storageDir}`);
    }

    const now = new Date();
    const demoAgents = ['John Smith', 'Jane Doe', 'Bob Johnson', 'Alice Williams'];
    const demoCallers = [
      '+12125551234',
      '+12125555678',
      '+14155552345',
      '+13105559876',
      '+17025551111',
    ];

    const transcripts = [
      [
        'Hello, how can I help you today?',
        'Hi! I need help with my account.',
        'Sure, let me look into that.',
      ],
      [
        'Welcome to customer service.',
        'I want to upgrade my plan.',
        'Great! Which plan would you like?',
      ],
      ['Thank you for calling.', 'I have a billing question.', 'I can help you with that.'],
      [
        'Good morning, how are you?',
        'I need technical support.',
        'Let me connect you with our tech team.',
      ],
      ['Hi there!', 'Can I cancel my subscription?', 'Of course. May I ask why?'],
    ];

    logger.info('Seeding database with demo calls...');

    for (let i = 0; i < 15; i++) {
      const agent = demoAgents[i % demoAgents.length];
      const caller = demoCallers[i % demoCallers.length];
      const durationSeconds = 120 + Math.floor(Math.random() * 900);

      const callStartTime = new Date(now);
      callStartTime.setDate(callStartTime.getDate() - Math.floor(Math.random() * 30));
      callStartTime.setHours(Math.floor(Math.random() * 24));
      callStartTime.setMinutes(Math.floor(Math.random() * 60));

      const callEndTime = new Date(callStartTime);
      callEndTime.setSeconds(callEndTime.getSeconds() + durationSeconds);

      const call = await callRepository.createCall({
        streamSid: `stream_${Date.now()}_${i}`,
        callSid: `CA${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        caller,
        agent,
      });

      await callRepository.updateCall(call.id, {
        startTime: callStartTime,
        endTime: callEndTime,
        duration: durationSeconds,
        status: Math.random() > 0.1 ? 'completed' : 'failed',
      });

      const transcript = transcripts[i % transcripts.length];
      let currentTime = 0;

      for (let j = 0; j < transcript.length; j++) {
        const startTime = currentTime;
        const endTime = currentTime + 3 + Math.random() * 5;

        await callRepository.createTranscript({
          callId: call.id,
          speaker: j % 2 === 0 ? 'customer' : 'agent',
          text: transcript[j],
          confidence: 0.92 + Math.random() * 0.08,
          startTime,
          endTime,
        });

        currentTime = endTime;
      }

      const sentiments = ['positive', 'neutral', 'negative'];
      const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];

      await callRepository.createAnalytics({
        callId: call.id,
        sentiment,
        sentimentScore: Math.random(),
        talkTime: durationSeconds * (0.6 + Math.random() * 0.3),
        silenceTime: durationSeconds * (0.1 + Math.random() * 0.3),
        interruptions: Math.floor(Math.random() * 4),
        averageLatency: 40 + Math.random() * 120,
      });

      await callRepository.createOrUpdateMetadata({
        callId: call.id,
        language: 'en-US',
        region: ['US', 'CA', 'UK'][Math.floor(Math.random() * 3)],
        deviceType: ['phone', 'voip', 'mobile'][Math.floor(Math.random() * 3)],
        networkQuality: ['excellent', 'good', 'fair', 'poor'][Math.floor(Math.random() * 4)],
      });

      const demoAudioPath = path.join(storageDir, `call_${call.id}.wav`);
      const dummyAudio = Buffer.alloc(1024);
      fs.writeFileSync(demoAudioPath, dummyAudio);

      await callRepository.createRecording({
        callId: call.id,
        filePath: demoAudioPath,
        format: 'wav',
        codec: 'pcm',
        sampleRate: 16000,
        channels: 1,
        duration: durationSeconds,
        sizeBytes: 1024,
      });

      logger.info(`Created demo call ${i + 1}/15: ${call.id}`);
    }

    logger.info('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database', error);
    process.exit(1);
  }
}

seedDatabase();
