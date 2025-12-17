import { CallManager } from '../services/callManager';
import { AudioNormalizer } from '../utils/audioNormalizer';

export async function demonstrateCallStorage() {
  const callManager = new CallManager();

  const streamSid = 'example_stream_123';
  const caller = '+1234567890';
  const callSid = 'example_call_123';

  const call = await callManager.startCall(streamSid, caller, callSid);
  console.log('Call started:', call);

  await callManager.updateCall(streamSid, callSid, 'Agent Smith');

  const sampleAudio = Buffer.alloc(160);
  for (let i = 0; i < 80; i++) {
    sampleAudio.writeInt16LE(Math.sin(i * 0.1) * 1000, i * 2);
  }
  const mulawAudio = AudioNormalizer.pcm16ToMulaw(sampleAudio);
  const base64Audio = AudioNormalizer.encodeBase64(mulawAudio);

  await callManager.addAudioChunk(streamSid, base64Audio);

  await callManager.addTranscript(
    streamSid,
    'caller',
    'Hello, I need help with my account',
    0.95,
    0.0,
    2.5,
  );
  await callManager.addTranscript(
    streamSid,
    'agent',
    'Of course! I can help you with that. What seems to be the issue?',
    0.92,
    2.5,
    5.0,
  );

  await callManager.addAnalytics(streamSid, {
    sentiment: 'positive',
    sentimentScore: 0.75,
    talkTime: 120.5,
    silenceTime: 5.5,
    interruptions: 0,
    averageLatency: 250.5,
    metrics: {
      wordsPerMinute: 150,
      pauseCount: 3,
    },
  });

  await callManager.setMetadata(streamSid, {
    language: 'en-US',
    region: 'US-East',
    deviceType: 'mobile',
    networkQuality: 'excellent',
    customData: {
      campaignId: 'campaign_123',
      customerId: 'customer_456',
    },
  });

  await callManager.endCall(streamSid);

  const retrievedCall = await callManager.getCall(streamSid);
  console.log('Retrieved call:', retrievedCall);

  const allCalls = await callManager.getAllCalls(10, 0);
  console.log('All calls:', allCalls);
}

export async function demonstrateAudioNormalization() {
  const pcmBuffer = Buffer.alloc(160);
  for (let i = 0; i < 80; i++) {
    pcmBuffer.writeInt16LE(Math.sin(i * 0.1) * 1000, i * 2);
  }

  const mulawBuffer = AudioNormalizer.pcm16ToMulaw(pcmBuffer);
  console.log('Mu-law encoded buffer length:', mulawBuffer.length);

  const base64Audio = AudioNormalizer.encodeBase64(mulawBuffer);
  console.log('Base64 encoded audio length:', base64Audio.length);

  const openAIFormat = AudioNormalizer.convertToOpenAIFormat(base64Audio);
  console.log('OpenAI format audio length:', openAIFormat.length);

  const storageFormat = AudioNormalizer.convertToStorageFormat(base64Audio);
  console.log('Storage format buffer length:', storageFormat.length);

  const wavBuffer = AudioNormalizer.bufferToWav(storageFormat);
  console.log('WAV file buffer length:', wavBuffer.length);

  const extractedPCM = AudioNormalizer.extractPCMFromWav(wavBuffer);
  console.log('Extracted PCM buffer length:', extractedPCM.length);
}
