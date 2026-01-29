# Complete Backend API Documentation

This document provides comprehensive documentation for all backend APIs implemented in this project.

## Table of Contents

1. [Authentication APIs](#authentication-apis)
2. [Call Management APIs](#call-management-apis)
3. [Recording/Audio APIs](#recordingaudio-apis)
4. [Analytics APIs](#analytics-apis)
5. [Real-time APIs](#real-time-apis)
6. [Testing APIs](#testing-apis)
7. [Health & Status](#health--status)
8. [Error Handling](#error-handling)

---

## Authentication APIs

All authentication endpoints are in `/api/auth`. These endpoints provide simple token-based authentication suitable for demo and local testing.

### POST /api/auth/register

Register a new user account.

**Request:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d {
    "email": "user@example.com",
    "password": "securepassword"
  }
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "user_1765951460701",
    "email": "user@example.com",
    "token": "token_1765951460701_abc123"
  },
  "message": "User registered successfully"
}
```

**Validation:**

- Email: required, must be string
- Password: required, must be at least 6 characters

---

### POST /api/auth/login

Login with email and password.

**Request:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d {
    "email": "user@example.com",
    "password": "securepassword"
  }
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "user_1765951460701",
    "email": "user@example.com",
    "token": "token_1765951460702_def456"
  },
  "message": "Login successful"
}
```

**Error (401 Unauthorized):**

```json
{
  "success": false,
  "error": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}
```

---

### POST /api/auth/logout

Logout and revoke the current authentication token.

**Request:**

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer token_1765951460702_def456"
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {},
  "message": "Logout successful"
}
```

**Authentication:** Required (Bearer token in Authorization header or x-api-token header)

---

### GET /api/auth/me

Get information about the currently authenticated user.

**Request:**

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer token_1765951460702_def456"
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "user_1765951460701",
    "email": "user@example.com"
  }
}
```

**Authentication:** Required (Bearer token in Authorization header or x-api-token header)

---

## Call Management APIs

### GET /api/calls

List all calls with pagination and filtering.

**Query Parameters:**

- `limit` (optional): Results per page, default 10, max 100
- `offset` (optional): Pagination offset, default 0
- `caller` (optional): Filter by caller phone number (substring match)
- `agent` (optional): Filter by agent name (substring match)
- `sentiment` (optional): Filter by sentiment (positive, neutral, negative)
- `startDate` (optional): ISO date string for start of date range
- `endDate` (optional): ISO date string for end of date range

**Request:**

```bash
curl "http://localhost:3000/api/calls?limit=10&offset=0&caller=+1234"
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "call-uuid-1",
      "streamSid": "stream_123",
      "callSid": "CA123",
      "caller": "+12125551234",
      "agent": "John Smith",
      "startTime": "2025-12-17T06:04:20.701Z",
      "endTime": "2025-12-17T06:09:20.701Z",
      "duration": 300,
      "status": "completed",
      "notes": null,
      "recordings": [...],
      "transcripts": [...],
      "analytics": [...],
      "metadata": {...}
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### GET /api/calls/search

Search calls by various criteria (same parameters as GET /api/calls).

**Request:**

```bash
curl "http://localhost:3000/api/calls/search?sentiment=positive&startDate=2025-12-01"
```

**Response:** Same as GET /api/calls

---

### GET /api/calls/:id

Get detailed information about a specific call.

**Request:**

```bash
curl "http://localhost:3000/api/calls/call-uuid-1"
```

**Response (200 OK):**

```json
{
  "data": {
    "id": "call-uuid-1",
    "streamSid": "stream_123",
    "callSid": "CA123",
    "caller": "+12125551234",
    "agent": "John Smith",
    "startTime": "2025-12-17T06:04:20.701Z",
    "endTime": "2025-12-17T06:09:20.701Z",
    "duration": 300,
    "status": "completed",
    "notes": "Customer satisfied",
    "recordings": [
      {
        "id": "rec-uuid-1",
        "callId": "call-uuid-1",
        "filePath": "/recordings/call_call-uuid-1.wav",
        "fileUrl": null,
        "format": "wav",
        "codec": "pcm",
        "sampleRate": 16000,
        "channels": 1,
        "duration": 300,
        "sizeBytes": 9600000
      }
    ],
    "transcripts": [
      {
        "id": "trans-uuid-1",
        "callId": "call-uuid-1",
        "speaker": "customer",
        "text": "Hello, how can I help you today?",
        "confidence": 0.97,
        "startTime": 0,
        "endTime": 3.5
      }
    ],
    "analytics": [
      {
        "id": "ana-uuid-1",
        "callId": "call-uuid-1",
        "sentiment": "positive",
        "sentimentScore": 0.85,
        "talkTime": 220,
        "silenceTime": 80,
        "interruptions": 1,
        "averageLatency": 75.5
      }
    ],
    "metadata": {
      "id": "meta-uuid-1",
      "callId": "call-uuid-1",
      "language": "en-US",
      "region": "US",
      "deviceType": "phone",
      "networkQuality": "good"
    }
  }
}
```

**Error (404 Not Found):**

```json
{
  "message": "Call not found",
  "code": "CALL_NOT_FOUND"
}
```

---

### GET /api/calls/:id/transcript

Get detailed transcript for a specific call.

**Request:**

```bash
curl "http://localhost:3000/api/calls/call-uuid-1/transcript"
```

**Response (200 OK):**

```json
{
  "data": {
    "callId": "call-uuid-1",
    "callStartTime": "2025-12-17T06:04:20.701Z",
    "callEndTime": "2025-12-17T06:09:20.701Z",
    "transcripts": [
      {
        "id": "trans-uuid-1",
        "speaker": "customer",
        "text": "Hello, how can I help you today?",
        "confidence": 0.97,
        "startTime": 0,
        "endTime": 3.5,
        "timestamp": "2025-12-17T06:04:20.701Z"
      },
      {
        "id": "trans-uuid-2",
        "speaker": "agent",
        "text": "Hi! Thank you for calling. How can I assist you?",
        "confidence": 0.95,
        "startTime": 3.8,
        "endTime": 8.2,
        "timestamp": "2025-12-17T06:04:24.000Z"
      }
    ],
    "totalSegments": 2
  }
}
```

---

### GET /api/calls/:id/recording

Stream or download a call recording.

**Query Parameters:**

- `download` (optional): Set to "true" to download as attachment, default is stream

**Request:**

```bash
# Stream the recording
curl "http://localhost:3000/api/calls/call-uuid-1/recording" \
  -o recording.wav

# Download as attachment
curl "http://localhost:3000/api/calls/call-uuid-1/recording?download=true" \
  -o recording.wav
```

**Response (200 OK):**

- Content-Type: audio/wav
- Binary audio data
- Headers:
  - Content-Length: file size in bytes
  - Accept-Ranges: bytes
  - Content-Disposition: attachment (if download=true)

**Error (404 Not Found):**

```json
{
  "message": "No recording found for this call",
  "code": "RECORDING_NOT_FOUND"
}
```

---

### POST /api/calls/:id/notes

Add or update notes for a call.

**Request:**

```bash
curl -X POST http://localhost:3000/api/calls/call-uuid-1/notes \
  -H "Content-Type: application/json" \
  -d {
    "notes": "Customer satisfied with resolution. Follow up in 1 week."
  }
```

**Response (200 OK):**

```json
{
  "message": "Notes added successfully",
  "data": {
    "id": "call-uuid-1",
    "streamSid": "stream_123",
    "callSid": "CA123",
    "caller": "+12125551234",
    "agent": "John Smith",
    "notes": "Customer satisfied with resolution. Follow up in 1 week.",
    ...
  }
}
```

---

## Recording/Audio APIs

### GET /api/recordings/:recordingId

Get a recording by its ID (direct access).

**Query Parameters:**

- `download` (optional): Set to "true" to download as attachment

**Request:**

```bash
curl "http://localhost:3000/api/recordings/rec-uuid-1" -o recording.wav
```

**Response (200 OK):**

- Same as GET /api/calls/:id/recording

**Error (404 Not Found):**

```json
{
  "message": "Recording not found",
  "code": "RECORDING_NOT_FOUND"
}
```

---

## Analytics APIs

### GET /api/analytics

Get comprehensive analytics with time-series data.

**Query Parameters:**

- `interval` (optional): "hour", "day", or "week", default is "day"
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Request:**

```bash
curl "http://localhost:3000/api/analytics?interval=day&startDate=2025-12-01"
```

**Response (200 OK):**

```json
{
  "data": {
    "aggregates": {
      "totalCalls": 42,
      "averageDuration": 285.5,
      "callsByStatus": {
        "completed": 38,
        "failed": 4,
        "active": 0
      },
      "sentimentBreakdown": {
        "positive": 25,
        "neutral": 12,
        "negative": 5
      }
    },
    "timeSeries": [
      {
        "timestamp": "2025-12-16T00:00:00.000Z",
        "callCount": 8,
        "averageDuration": 290.5
      },
      {
        "timestamp": "2025-12-17T00:00:00.000Z",
        "callCount": 15,
        "averageDuration": 280.3
      }
    ]
  }
}
```

---

### GET /api/analytics/summary

Get overall summary statistics.

**Request:**

```bash
curl "http://localhost:3000/api/analytics/summary"
```

**Response (200 OK):**

```json
{
  "data": {
    "totalCalls": 42,
    "averageDuration": 285.5,
    "completedCalls": 38,
    "failedCalls": 4,
    "activeCalls": 0,
    "successRate": 90.48
  }
}
```

---

### GET /api/analytics/daily

Get daily call statistics.

**Request:**

```bash
curl "http://localhost:3000/api/analytics/daily"
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "date": "2025-12-16T00:00:00.000Z",
      "callCount": 8,
      "averageDuration": 290.5
    },
    {
      "date": "2025-12-17T00:00:00.000Z",
      "callCount": 15,
      "averageDuration": 280.3
    }
  ]
}
```

---

### GET /api/analytics/sentiment

Get sentiment analysis breakdown.

**Request:**

```bash
curl "http://localhost:3000/api/analytics/sentiment"
```

**Response (200 OK):**

```json
{
  "data": {
    "positive": 25,
    "neutral": 12,
    "negative": 5
  }
}
```

---

### GET /api/analytics/peak-hours

Get the top 10 hours with the most calls.

**Request:**

```bash
curl "http://localhost:3000/api/analytics/peak-hours"
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "hour": "2025-12-17T14:00:00.000Z",
      "callCount": 12
    },
    {
      "hour": "2025-12-17T10:00:00.000Z",
      "callCount": 10
    },
    {
      "hour": "2025-12-17T15:00:00.000Z",
      "callCount": 8
    }
  ]
}
```

---

### GET /api/analytics/call-duration

Get call duration trends over time.

**Request:**

```bash
curl "http://localhost:3000/api/analytics/call-duration"
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "date": "2025-12-16T00:00:00.000Z",
      "averageDuration": 290.5
    },
    {
      "date": "2025-12-17T00:00:00.000Z",
      "averageDuration": 280.3
    }
  ]
}
```

---

## Real-time APIs

### GET /api/status

Server-Sent Events (SSE) endpoint for real-time status updates.

**Request:**

```bash
curl "http://localhost:3000/api/status"
```

**Response (200 OK - Streaming):**

```
event: message
data: {"type":"status","timestamp":"2025-12-17T06:04:20.701Z","message":"Call started"}

event: message
data: {"type":"status","timestamp":"2025-12-17T06:04:25.701Z","message":"Transcript received"}

event: ping
data: {}
```

**Features:**

- Maintains a queue of up to 100 recent messages
- Sends keepalive ping every 30 seconds
- Automatic cleanup of disconnected clients
- Real-time call status updates

---

## Testing APIs

### GET /api/test/calls

Get demo call data (if available).

**Request:**

```bash
curl "http://localhost:3000/api/test/calls"
```

**Response (200 OK):**

```json
{
  "data": {
    "calls": [
      {
        "id": "call-uuid-1",
        "streamSid": "stream_123",
        "caller": "+12125551234",
        ...
      }
    ],
    "totalCalls": 1
  },
  "message": "Test calls retrieved successfully"
}
```

---

### POST /api/test/simulate-call

Simulate a complete call with realistic data for testing.

**Request:**

```bash
curl -X POST http://localhost:3000/api/test/simulate-call
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "call-uuid-123",
    "streamSid": "stream_sim_123",
    "callSid": "CA_SIM_123",
    "caller": "+14155552345",
    "agent": "Alice Williams",
    "startTime": "2025-12-17T06:04:20.701Z",
    "endTime": "2025-12-17T06:09:20.701Z",
    "duration": 300,
    "status": "completed",
    "recordings": [...],
    "transcripts": [...],
    "analytics": [...],
    "metadata": {...}
  },
  "message": "Test call simulated successfully"
}
```

**Features:**

- Creates a complete call with realistic data
- Generates 10 transcript segments
- Creates analytics with random sentiment
- Saves dummy recording file
- Returns full call details

---

## Health & Status

### GET /health

Simple health check endpoint.

**Request:**

```bash
curl "http://localhost:3000/health"
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "uptime": 3600.123
}
```

---

## Error Handling

All error responses follow a consistent format:

**Error Response Format:**

```json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "error": "Detailed error (only in development)"
}
```

**Common HTTP Status Codes:**

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid auth token)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (e.g., user already exists)
- `500` - Internal Server Error

**Common Error Codes:**

- `INVALID_EMAIL` - Email validation failed
- `INVALID_PASSWORD` - Password validation failed
- `PASSWORD_TOO_SHORT` - Password must be at least 6 characters
- `USER_EXISTS` - User already registered
- `INVALID_CREDENTIALS` - Email or password incorrect
- `INVALID_INTERVAL` - Invalid analytics interval
- `CALL_NOT_FOUND` - Call ID doesn't exist
- `RECORDING_NOT_FOUND` - Recording not found
- `FILE_NOT_FOUND` - File not found on storage
- `STREAM_ERROR` - Error streaming file

---

## Authentication

Most endpoints can optionally require authentication. To use authentication:

**Option 1: Bearer Token in Authorization Header**

```bash
curl "http://localhost:3000/api/auth/me" \
  -H "Authorization: Bearer your_token_here"
```

**Option 2: API Token in Custom Header**

```bash
curl "http://localhost:3000/api/auth/me" \
  -H "x-api-token: your_token_here"
```

Get a token by registering or logging in with the authentication endpoints.

---

## Demo Data Seeding

To populate the database with realistic demo data:

```bash
npm run seed
```

This creates 15 sample calls with:

- Varied durations (2-15 minutes)
- Timestamps spread over the past 30 days
- Realistic transcripts with customer/agent dialogue
- Random sentiments and analytics
- Multiple agents and caller numbers
- Dummy recording files

---

## API Response Format

Most successful API responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

Paginated responses include pagination info:

```json
{
  "data": [...],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

Error responses use:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. For production, consider:

- Implementing rate limiting per IP or user
- Adding API key authentication
- Throttling authentication endpoints

---

## CORS

CORS is enabled for all origins. The server accepts requests from any domain with standard HTTP methods and JSON content type.

---

## Security Notes for Demo

This demo implementation uses:

- Simple in-memory token storage (not persistent)
- No password hashing (for demo simplicity)
- No rate limiting
- Wide CORS permissions

**For production, implement:**

- Proper password hashing (bcrypt)
- Database-backed token storage
- Rate limiting
- Restricted CORS
- HTTPS/TLS
- Token refresh mechanisms
- Input validation and sanitization
