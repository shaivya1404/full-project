# Call Storage Implementation

This document describes the implementation of the call storage system for the Twilio/OpenAI Realtime Bridge Server.

## Overview

The call storage system provides persistent storage for call history, audio recordings, transcripts, analytics, and metadata using SQLite with Prisma ORM.

## Architecture

### Components

1. **Database Layer** (`src/db/`)
   - **Prisma Client** (`client.ts`): Manages database connections
   - **Call Repository** (`repositories/callRepository.ts`): Provides CRUD operations for all database models

2. **Service Layer** (`src/services/`)
   - **Call Manager** (`callManager.ts`): Orchestrates call lifecycle and data persistence
   - **Storage Service** (`storageService.ts`): Handles file system operations for recordings

3. **Utilities** (`src/utils/`)
   - **Audio Normalizer** (`audioNormalizer.ts`): Handles audio format conversions

## Database Schema

### Models

#### Call

Primary entity representing a phone call.

- Tracks call lifecycle (start, end, duration, status)
- Links to recordings, transcripts, analytics, and metadata
- Indexed by streamSid and callSid for quick lookups

#### Recording

Stores information about audio recordings.

- References call
- Stores file path and metadata (format, codec, sample rate, size)
- Supports cloud URLs for remote storage

#### Transcript

Stores transcribed text from calls.

- References call
- Includes speaker identification
- Tracks confidence scores and timestamps
- Ordered by creation time

#### Analytics

Stores analytics snapshots during/after calls.

- References call
- Tracks sentiment, talk time, silence, interruptions, latency
- Supports custom metrics via JSON field
- Multiple snapshots per call for temporal analysis

#### CallMetadata

Stores additional call metadata.

- One-to-one relationship with call
- Tracks language, region, device type, network quality
- Supports custom data via JSON field

## Audio Processing Pipeline

### Input: Twilio Stream

- Format: mu-law (G.711)
- Sample Rate: 8000 Hz
- Encoding: Base64
- Channels: Mono (1)
- Bit Depth: 8-bit (mu-law)

### Conversion Process

1. **Base64 Decoding**

   ```
   Base64 String → Raw mu-law Buffer
   ```

2. **Mu-law Decoding**

   ```
   Mu-law Buffer → PCM16 Buffer (16-bit linear)
   ```

3. **Resampling** (for target format)
   - For OpenAI: 8000 Hz → 24000 Hz
   - For Storage: 8000 Hz → 16000 Hz

4. **Encoding** (for transmission/storage)
   - For OpenAI: PCM16 Buffer → Base64 String
   - For Storage: PCM16 Buffer → WAV File

### Output Formats

#### For OpenAI Realtime API

- Format: PCM16
- Sample Rate: 24000 Hz
- Encoding: Base64
- Channels: Mono (1)
- Bit Depth: 16-bit

#### For Storage

- Format: WAV (RIFF)
- Sample Rate: 16000 Hz
- Codec: PCM16
- Channels: Mono (1)
- Bit Depth: 16-bit

## Call Lifecycle

### 1. Call Start

```typescript
const call = await callManager.startCall(streamSid, caller, callSid);
```

- Creates Call record in database
- Initializes in-memory session
- Sets status to "active"

### 2. During Call

```typescript
// Add audio chunks
await callManager.addAudioChunk(streamSid, base64Audio);

// Add transcripts
await callManager.addTranscript(streamSid, speaker, text, confidence);

// Add analytics snapshots
await callManager.addAnalytics(streamSid, { sentiment, sentimentScore, ... });

// Set/update metadata
await callManager.setMetadata(streamSid, { language, region, ... });
```

- Audio chunks accumulated in memory
- Transcripts/analytics persisted immediately
- Metadata can be updated during call

### 3. Call End

```typescript
await callManager.endCall(streamSid);
```

- Updates call status to "completed"
- Calculates and stores duration
- Combines audio chunks into single WAV file
- Saves recording to disk
- Stores recording metadata in database
- Cleans up in-memory session

## Repository Pattern

All database operations go through the repository layer for:

- Type safety
- Consistent error handling
- Testability (mockable)
- Business logic separation

### Key Methods

**Call Operations:**

- `createCall()` - Create new call record
- `updateCall()` - Update call details
- `getCallById()` - Retrieve call by ID
- `getCallByStreamSid()` - Retrieve call by stream SID
- `getAllCalls()` - List calls with pagination

**Recording Operations:**

- `createRecording()` - Store recording metadata
- `getRecordingsByCallId()` - Get all recordings for a call

**Transcript Operations:**

- `createTranscript()` - Store transcript entry
- `getTranscriptsByCallId()` - Get all transcripts for a call

**Analytics Operations:**

- `createAnalytics()` - Store analytics snapshot
- `getAnalyticsByCallId()` - Get all analytics for a call

**Metadata Operations:**

- `createOrUpdateMetadata()` - Create or update call metadata
- `getMetadataByCallId()` - Get metadata for a call

## File Storage

### Directory Structure

```
recordings/
├── {streamSid}_{timestamp}.wav
├── {streamSid}_{timestamp}_transcript.txt
└── {streamSid}_{timestamp}_metadata.json
```

### Storage Service Features

- Automatic WAV header generation
- File existence checking
- Atomic writes
- Duration calculation
- Size tracking
- File cleanup/deletion

## Testing Strategy

### Unit Tests

1. **Audio Normalizer** (`audioNormalizer.test.ts`)
   - Base64 encoding/decoding
   - Mu-law encoding/decoding
   - PCM format conversions
   - Resampling algorithms
   - WAV file operations
   - Edge cases and error handling

2. **Call Repository** (`callRepository.test.ts`)
   - CRUD operations for all models
   - Relationship handling
   - Pagination
   - Error cases

3. **Storage Service** (`storageService.test.ts`)
   - File creation and writing
   - Format conversions
   - Directory management
   - Error handling

4. **Call Manager** (`callManager.test.ts`)
   - Call lifecycle management
   - Audio chunk handling
   - Transcript/analytics/metadata operations
   - Integration with repository and storage

### Test Coverage

- All public methods tested
- Edge cases covered
- Error conditions handled
- Mock external dependencies

## Performance Considerations

### Memory Management

- Audio chunks buffered in memory during active call
- Memory released when call ends
- Recommended to limit maximum call duration to prevent memory issues

### Database

- Indexes on frequently queried fields (streamSid, callSid)
- Cascading deletes for related records
- Pagination for large result sets

### File System

- Asynchronous I/O for all file operations
- Atomic writes to prevent corruption
- Configurable storage path

## Error Handling

### Graceful Degradation

- Logging of all errors
- Non-blocking operations where possible
- Warnings for missing/invalid data

### Error Types

- Database connection errors
- File system errors
- Audio format errors
- Invalid input data

## Future Enhancements

### Potential Improvements

1. **Cloud Storage Integration**
   - S3/GCS/Azure Blob support
   - Automatic upload after call completion
   - URL generation for recordings

2. **Streaming Audio Storage**
   - Write audio chunks to disk during call
   - Reduce memory footprint
   - Support longer calls

3. **Advanced Analytics**
   - Real-time sentiment analysis
   - Speaker diarization
   - Keyword detection
   - Call quality metrics

4. **Data Retention**
   - Automatic cleanup of old recordings
   - Configurable retention policies
   - Archive to cold storage

5. **Database Optimization**
   - Connection pooling
   - Query optimization
   - Indexes tuning
   - Partitioning for large datasets

## Security Considerations

### Data Protection

- Recordings contain sensitive audio data
- Database contains PII (phone numbers)
- Implement encryption at rest
- Access control for recordings
- Audit logging

### Best Practices

- Validate all inputs
- Sanitize file paths
- Use parameterized queries (Prisma handles this)
- Implement rate limiting
- Monitor storage usage

## Deployment

### Prerequisites

- Node.js 14+
- Write access to database location
- Write access to recordings directory
- Sufficient disk space

### Environment Setup

1. Set DATABASE_URL
2. Set RECORDING_STORAGE_PATH
3. Run migrations: `npm run db:migrate`
4. Generate Prisma client: `npm run db:generate`

### Production Checklist

- [ ] Database backups configured
- [ ] Storage monitoring enabled
- [ ] Error logging configured
- [ ] Retention policy implemented
- [ ] Access controls configured
- [ ] Performance monitoring enabled
- [ ] Disk space alerts configured

## Monitoring

### Key Metrics

- Active calls count
- Recording file sizes
- Database size
- Storage usage
- Query performance
- Error rates

### Logging

- All operations logged via Winston
- Structured JSON logs in production
- Log levels: error, warn, info, debug

## Maintenance

### Regular Tasks

1. Monitor disk space
2. Review error logs
3. Clean up old recordings (if retention policy)
4. Backup database
5. Optimize database (VACUUM for SQLite)
6. Update dependencies

### Database Migrations

```bash
# Create new migration
npm run db:migrate

# Reset database (development only)
npm run db:reset

# Generate client after schema changes
npm run db:generate
```
