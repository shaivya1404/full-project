# Call Storage Migration Guide

This guide explains how to set up and use the call storage system.

## Setup

### 1. Install Dependencies

The following dependencies are already installed:

- `prisma` - Prisma CLI
- `@prisma/client` - Prisma Client for database access

### 2. Configure Environment

Update your `.env` file with the following:

```env
DATABASE_URL=file:./dev.db
RECORDING_STORAGE_PATH=./recordings
```

For production, you might use:

```env
DATABASE_URL=file:./production.db
RECORDING_STORAGE_PATH=/var/recordings
```

### 3. Run Database Migrations

```bash
npm run db:migrate
```

This will:

- Create the SQLite database file
- Apply all migrations
- Generate the Prisma Client

### 4. Verify Setup

Run the test suite to verify everything is working:

```bash
npm test
```

## Usage

### Starting a Call

```typescript
import { CallManager } from './services/callManager';

const callManager = new CallManager();

const call = await callManager.startCall(
  'stream_sid_123', // Twilio stream SID
  '+1234567890', // Caller phone number
  'call_sid_123', // Optional: Twilio call SID
);
```

### Adding Audio Chunks

When receiving audio from Twilio (base64-encoded mu-law):

```typescript
await callManager.addAudioChunk(streamSid, base64Audio);
```

The audio will be automatically:

1. Decoded from base64
2. Converted from mu-law to PCM16
3. Resampled to 16kHz for storage
4. Accumulated for final recording

### Adding Transcripts

```typescript
await callManager.addTranscript(
  streamSid,
  'caller', // Speaker: 'caller', 'agent', etc.
  'Hello, how can I help you?', // Transcript text
  0.95, // Confidence (0.0 - 1.0)
  0.0, // Start time in seconds
  2.5, // End time in seconds
);
```

### Adding Analytics

```typescript
await callManager.addAnalytics(streamSid, {
  sentiment: 'positive', // 'positive', 'neutral', 'negative'
  sentimentScore: 0.8, // Score (0.0 - 1.0)
  talkTime: 120.5, // Talk time in seconds
  silenceTime: 5.5, // Silence time in seconds
  interruptions: 2, // Number of interruptions
  averageLatency: 250.5, // Average latency in milliseconds
  metrics: {
    // Custom metrics as JSON
    wordsPerMinute: 150,
    pauseCount: 3,
  },
});
```

### Setting Metadata

```typescript
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
```

### Ending a Call

```typescript
await callManager.endCall(streamSid);
```

This will:

1. Update call status to 'completed'
2. Calculate and store call duration
3. Save accumulated audio chunks as a WAV file
4. Store recording metadata in the database
5. Clean up in-memory session

### Retrieving Call Data

```typescript
// Get a specific call
const call = await callManager.getCall(streamSid);

// Get call by ID
const callById = await callManager.getCallById(callId);

// Get all calls with pagination
const calls = await callManager.getAllCalls(limit, offset);
```

## Audio Format Conversion

### Twilio to OpenAI Format

```typescript
import { AudioNormalizer } from './utils/audioNormalizer';

// Twilio sends mu-law encoded audio as base64
const openAIAudio = AudioNormalizer.convertToOpenAIFormat(twilioBase64Audio);
// Returns: base64-encoded PCM16 at 24kHz
```

### Twilio to Storage Format

```typescript
const storageBuffer = AudioNormalizer.convertToStorageFormat(twilioBase64Audio);
// Returns: PCM16 buffer at 16kHz
```

### Creating WAV Files

```typescript
const pcmBuffer = AudioNormalizer.convertToStorageFormat(twilioBase64Audio);
const wavBuffer = AudioNormalizer.bufferToWav(pcmBuffer);
// Returns: Complete WAV file with headers
```

### Manual Encoding/Decoding

```typescript
// Base64 operations
const decoded = AudioNormalizer.decodeBase64(base64String);
const encoded = AudioNormalizer.encodeBase64(buffer);

// Mu-law operations
const pcm16 = AudioNormalizer.mulawToPCM16(mulawBuffer);
const mulaw = AudioNormalizer.pcm16ToMulaw(pcm16Buffer);

// Resampling
const resampled = AudioNormalizer.resample(buffer, fromRate, toRate);
```

## Database Schema

### Call

- `id` - UUID
- `streamSid` - Twilio stream SID (unique)
- `callSid` - Twilio call SID (unique, optional)
- `caller` - Caller phone number
- `agent` - Agent identifier (optional)
- `startTime` - Call start timestamp
- `endTime` - Call end timestamp (optional)
- `duration` - Call duration in seconds (optional)
- `status` - Call status (default: 'active')

### Recording

- `id` - UUID
- `callId` - Foreign key to Call
- `filePath` - File system path to recording
- `fileUrl` - URL for cloud storage (optional)
- `format` - Audio format (e.g., 'wav', 'pcm')
- `codec` - Audio codec (e.g., 'pcm', 'mulaw')
- `sampleRate` - Sample rate in Hz
- `channels` - Number of audio channels
- `duration` - Recording duration in seconds (optional)
- `sizeBytes` - File size in bytes (optional)

### Transcript

- `id` - UUID
- `callId` - Foreign key to Call
- `speaker` - Speaker identifier
- `text` - Transcript text
- `confidence` - Confidence score (0.0 - 1.0, optional)
- `startTime` - Start time in seconds (optional)
- `endTime` - End time in seconds (optional)

### Analytics

- `id` - UUID
- `callId` - Foreign key to Call
- `sentiment` - Sentiment classification (optional)
- `sentimentScore` - Sentiment score (optional)
- `talkTime` - Talk time in seconds (optional)
- `silenceTime` - Silence time in seconds (optional)
- `interruptions` - Number of interruptions (optional)
- `averageLatency` - Average latency in ms (optional)
- `metrics` - Custom metrics as JSON string (optional)
- `snapshotTime` - Time of snapshot

### CallMetadata

- `id` - UUID
- `callId` - Foreign key to Call (unique)
- `language` - Language code (optional)
- `region` - Region identifier (optional)
- `deviceType` - Device type (optional)
- `networkQuality` - Network quality assessment (optional)
- `customData` - Custom data as JSON string (optional)

## Testing

Unit tests are provided for:

- Audio normalization utilities
- Database repositories
- Storage service
- Call manager service

Run tests with:

```bash
npm test
```

## Best Practices

1. **Always start calls** before adding audio/transcripts/analytics
2. **Always end calls** to ensure data is persisted
3. **Use proper error handling** around all call manager operations
4. **Monitor storage space** for recording files
5. **Implement retention policies** for old recordings
6. **Use analytics snapshots** for periodic metrics collection
7. **Set metadata early** in the call lifecycle
8. **Validate audio formats** before processing

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

```bash
npm run db:generate
```

### Migration Conflicts

If migrations are out of sync:

```bash
npm run db:reset
```

**Warning**: This will delete all data!

### Storage Directory Issues

Ensure the recording storage directory exists and has write permissions:

```bash
mkdir -p ./recordings
chmod 755 ./recordings
```

### Test Failures

Clear test artifacts:

```bash
rm -rf /tmp/test-recordings/*
```
