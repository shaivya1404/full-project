# Call APIs Implementation

This document describes the implementation of the REST endpoints and real-time streaming features for the dashboard.

## Overview

The implementation exposes comprehensive Call APIs with pagination, search, filtering, recording streaming, analytics aggregation, and real-time status updates via Server-Sent Events (SSE).

## Endpoints

### 1. List Calls with Pagination and Filters
**Endpoint:** `GET /api/calls`

**Query Parameters:**
- `limit` (number, default: 10, max: 100) - Number of calls to return
- `offset` (number, default: 0) - Number of calls to skip
- `caller` (string, optional) - Filter by caller phone number (case-insensitive partial match)
- `agent` (string, optional) - Filter by agent name (case-insensitive partial match)
- `sentiment` (string, optional) - Filter by sentiment from analytics
- `startDate` (ISO 8601 string, optional) - Filter calls created after this date
- `endDate` (ISO 8601 string, optional) - Filter calls created before this date

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "streamSid": "string",
      "callSid": "string|null",
      "caller": "string",
      "agent": "string|null",
      "startTime": "ISO 8601",
      "endTime": "ISO 8601|null",
      "duration": "number|null",
      "status": "string",
      "recordings": [...],
      "transcripts": [...],
      "analytics": [...],
      "metadata": {...}
    }
  ],
  "pagination": {
    "total": "number",
    "limit": "number",
    "offset": "number",
    "hasMore": "boolean"
  }
}
```

**Error Handling:**
- Returns 500 if database error occurs

### 2. Get Call Details
**Endpoint:** `GET /api/calls/:id`

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "streamSid": "string",
    "callSid": "string|null",
    "caller": "string",
    "agent": "string|null",
    "startTime": "ISO 8601",
    "endTime": "ISO 8601|null",
    "duration": "number|null",
    "status": "string",
    "recordings": [
      {
        "id": "uuid",
        "filePath": "string",
        "fileUrl": "string|null",
        "format": "wav|pcm",
        "codec": "string",
        "sampleRate": "number",
        "channels": "number",
        "duration": "number|null",
        "sizeBytes": "number|null"
      }
    ],
    "transcripts": [
      {
        "id": "uuid",
        "speaker": "string",
        "text": "string",
        "confidence": "number|null",
        "startTime": "number|null",
        "endTime": "number|null"
      }
    ],
    "analytics": [
      {
        "id": "uuid",
        "sentiment": "string|null",
        "sentimentScore": "number|null",
        "talkTime": "number|null",
        "silenceTime": "number|null",
        "interruptions": "number|null",
        "averageLatency": "number|null",
        "snapshotTime": "ISO 8601"
      }
    ],
    "metadata": {
      "language": "string|null",
      "region": "string|null",
      "deviceType": "string|null",
      "networkQuality": "string|null",
      "customData": "string|null"
    }
  }
}
```

**Error Handling:**
- Returns 404 if call not found
- Returns 500 if database error occurs

### 3. Stream/Download Recording
**Endpoint:** `GET /api/calls/:id/recording`

**Query Parameters:**
- `download` (boolean, default: false) - If true, sets Content-Disposition header for download

**Response:**
- 200: Audio file stream (Content-Type: audio/wav)
- Headers:
  - `Content-Type`: audio/wav
  - `Content-Length`: file size in bytes
  - `Accept-Ranges`: bytes
  - `Content-Disposition` (if download=true): attachment; filename="recording-{callId}.wav"

**Error Handling:**
- Returns 404 if call not found
- Returns 404 if no recordings exist for this call
- Returns 404 if recording file not found on storage
- Returns 500 if stream error occurs

### 4. Analytics - Aggregates and Timeseries
**Endpoint:** `GET /api/analytics`

**Query Parameters:**
- `interval` (string, default: 'day') - Timeseries interval: 'hour', 'day', or 'week'
- `startDate` (ISO 8601 string, optional) - Filter data from this date
- `endDate` (ISO 8601 string, optional) - Filter data until this date

**Response:**
```json
{
  "data": {
    "aggregates": {
      "totalCalls": "number",
      "averageDuration": "number|null",
      "callsByStatus": {
        "completed": "number",
        "active": "number",
        "failed": "number"
      },
      "sentimentBreakdown": {
        "positive": "number",
        "neutral": "number",
        "negative": "number"
      }
    },
    "timeSeries": [
      {
        "timestamp": "ISO 8601",
        "callCount": "number",
        "averageDuration": "number|null"
      }
    ]
  }
}
```

**Error Handling:**
- Returns 400 if invalid interval is provided
- Returns 500 if database error occurs

### 5. Real-time Status Updates (SSE)
**Endpoint:** `GET /api/status`

**Protocol:** Server-Sent Events (text/event-stream)

**Initial Message:**
```json
{"type":"connected","message":"Connected to status updates"}
```

**Status Update Messages:**
```json
{
  "type": "call_started|call_ended|recording_saved|error",
  "callId": "string|undefined",
  "streamSid": "string|undefined",
  "data": {"key": "value"},
  "timestamp": "ISO 8601"
}
```

**Features:**
- Maintains queue of up to 100 recent messages for new clients
- Sends keepalive ping every 30 seconds
- Automatically cleans up disconnected clients
- Broadcasts updates to all connected clients in real-time

## Implementation Details

### Repository Methods Added

#### CallRepository

1. **searchCalls(limit, offset, filters)**
   - Searches calls with pagination
   - Supports filtering by caller, agent, sentiment, and date range
   - Case-insensitive partial matching for text fields
   - Returns both calls array and total count

2. **getCallWithDetails(id)**
   - Retrieves a single call with all related data
   - Includes recordings, transcripts, analytics, and metadata
   - Orders transcripts and analytics chronologically

3. **getRecordingById(id)**
   - Retrieves a specific recording by ID

4. **getAnalyticsAggregate(filters)**
   - Returns aggregated statistics across all calls
   - Calculates total calls, average duration, calls by status, and sentiment breakdown
   - Supports date range filtering

5. **getAnalyticsTimeSeries(interval, filters)**
   - Returns time-series data grouped by interval (hour, day, week)
   - For each time period: call count and average duration
   - Supports date range filtering

### Response Schema

All endpoints follow a consistent response pattern:

**Success Response:**
```json
{
  "data": {...},
  "pagination": {...} // Optional, only for paginated endpoints
}
```

**Error Response:**
```json
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE", // Optional
  "error": "Detailed error (only in development)" // Optional
}
```

### Error Handling

1. **HTTP Status Codes:**
   - 200: Success
   - 400: Bad request (invalid parameters)
   - 404: Not found (resource doesn't exist)
   - 500: Server error (database or system error)

2. **Consistent Error Responses:**
   - All errors include a descriptive message
   - Error codes provided for client-side handling
   - Detailed errors only shown in development

3. **Logging:**
   - All errors logged with Winston logger
   - Error details included for debugging

### Recording Streaming

1. **File System Integration:**
   - Recordings stored in `RECORDING_STORAGE_PATH` directory
   - Supports WAV and PCM formats
   - File validation before streaming

2. **Streaming Features:**
   - Efficient streaming using Node.js streams
   - Supports byte-range requests (Accept-Ranges header)
   - Optional download with proper Content-Disposition header

3. **Error Handling:**
   - Graceful error handling if file becomes unavailable
   - Error responses sent if stream fails

### Real-time Updates (SSE)

1. **Client Management:**
   - Maintains set of active SSE connections
   - Automatically removes disconnected clients
   - Handles client errors gracefully

2. **Message Queue:**
   - Keeps queue of up to 100 recent messages
   - New clients receive recent history
   - Queue prevents message loss on startup

3. **Keepalive:**
   - Sends comment-only keepalive every 30 seconds
   - Prevents connection timeout on idle connections
   - Works with all major browsers and clients

## Tests

Comprehensive test coverage includes:

### CallRepository Tests
- CRUD operations for all models
- Search with filters
- Pagination
- Aggregation functions
- Time-series generation

### Calls API Tests
- List with pagination
- Pagination limits
- Search by caller, agent, sentiment
- Date range filtering
- Get call details
- Recording not found scenarios
- Error handling

### Analytics API Tests
- Aggregate calculation
- Time-series generation
- Interval support (hour, day, week)
- Date filtering
- Invalid interval handling
- Error scenarios

### Status API Tests
- Message queuing
- Broadcast functionality
- All status types
- Error handling

## Usage Examples

### List recent calls
```bash
curl "http://localhost:3000/api/calls?limit=10&offset=0"
```

### Search calls by agent
```bash
curl "http://localhost:3000/api/calls?agent=John&limit=20"
```

### Get call details
```bash
curl "http://localhost:3000/api/calls/{callId}"
```

### Download recording
```bash
curl "http://localhost:3000/api/calls/{callId}/recording?download=true" \
  -o recording.wav
```

### Stream recording
```bash
curl "http://localhost:3000/api/calls/{callId}/recording" | ffmpeg -i pipe: output.wav
```

### Get analytics
```bash
curl "http://localhost:3000/api/analytics?interval=day&startDate=2024-01-01&endDate=2024-01-31"
```

### Listen for real-time updates
```bash
curl -N "http://localhost:3000/api/status"
```

## Configuration

### Environment Variables
- `RECORDING_STORAGE_PATH`: Directory where recordings are stored
- `DATABASE_URL`: SQLite database connection string
- `NODE_ENV`: development, test, or production

### Prisma Configuration
- Schema defined in `prisma/schema.prisma`
- Migrations in `prisma/migrations/`
- Client generation via `npm run db:generate`

## Future Enhancements

1. **Filtering:**
   - Advanced search with boolean operators
   - Additional metadata filtering
   - Transcript search

2. **Analytics:**
   - Real-time metric calculations
   - Custom metric definitions
   - Export functionality

3. **Real-time:**
   - WebSocket support for bidirectional communication
   - Selective subscriptions to call types
   - Compression support

4. **Performance:**
   - Database indexing optimization
   - Caching layer for analytics
   - Query pagination optimization

5. **Security:**
   - Authentication/authorization
   - Rate limiting
   - Request validation enhancement
