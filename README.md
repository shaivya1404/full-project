# Twilio/OpenAI Realtime Bridge Server

This project bootstraps a Twilio/OpenAI realtime bridge server. It acts as a middleware to stream audio from a Twilio call to OpenAI's Realtime API and stream the response back to Twilio.

## Features

- **TypeScript**: Typed code for better developer experience.
- **Express**: Fast, unopinionated web framework.
- **Structured Logging**: JSON logging via Winston (in production).
- **Environment Validation**: Validates all required environment variables on startup.
- **Resilience**: Automatic reconnection logic for OpenAI Realtime WebSocket.
- **Health Checks**: `/health` endpoint for monitoring.
- **Linting & Formatting**: ESLint and Prettier setup.
- **Testing**: Jest setup for unit and integration tests.
- **Persistent Storage**: SQLite database via Prisma for call history, recordings, transcripts, and analytics.
- **Audio Processing**: Utilities to normalize audio formats (Twilio PCM/mu-law to OpenAI-compatible format).
- **Call Management**: Complete call lifecycle tracking with metadata, sentiment analysis, and recording storage.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Twilio Account (Account SID, Auth Token, Phone Number)
- OpenAI API Key

## Setup

1.  Clone the repository.
2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Create a `.env` file in the root directory based on the following template:

    ```env
    NODE_ENV=development
    PORT=3000
    TWILIO_ACCOUNT_SID=your_twilio_sid
    TWILIO_AUTH_TOKEN=your_twilio_auth_token
    TWILIO_PHONE_NUMBER=your_twilio_number
    OPENAI_API_KEY=your_openai_key
    DATABASE_URL=file:./dev.db
    RECORDING_STORAGE_PATH=./recordings
    TWILIO_WEBHOOK_SECRET=your_twilio_webhook_secret
    ```

## Development

To start the server in development mode (with hot reload):

```bash
npm run dev
```

To run linting:

```bash
npm run lint
```

To run tests:

```bash
npm test
```

## Production

To build the project:

```bash
npm run build
```

To start the server in production mode:

```bash
npm start
```

## Database Setup

Initialize the database with migrations:

```bash
npm run db:migrate
```

Generate Prisma client:

```bash
npm run db:generate
```

View database in Prisma Studio:

```bash
npm run db:studio
```

## API Endpoints

### Health Check
- **GET** `/health` - Server health and uptime

### Call Management
- **GET** `/api/calls` - List all calls with pagination, filtering, and search
  - Query params: `limit`, `offset`, `caller`, `agent`, `sentiment`, `startDate`, `endDate`
- **GET** `/api/calls/:id` - Get call details with transcripts, recordings, analytics, and metadata
- **GET** `/api/calls/:id/recording` - Stream or download call recording
  - Query param: `download=true` to download as attachment
- **POST** `/api/calls/:id/notes` - Add notes to a call
  - Body: `{ "notes": "string" }`

### Analytics
- **GET** `/api/analytics` - Get call analytics aggregates and time series
  - Query params: `startDate`, `endDate`, `interval` (hour|day|week)

### Real-time Status
- **GET** `/api/status` - Server-Sent Events (SSE) for real-time status updates

### Twilio Webhooks
- **POST** `/twilio/incoming-call` - TwiML response for incoming calls
- **POST** `/twilio/call-status` - Call status webhook handler

### WebSocket
- **WS** `/streams` - Media stream endpoint for Twilio audio

## Project Structure

- `src/config`: Configuration and environment validation.
- `src/db`: Database client and repositories (Prisma).
- `src/middleware`: Express middleware (logging, error handling, validation).
- `src/routes`: API routes.
- `src/services`: Core logic (Twilio Stream, OpenAI Realtime, Call Manager, Storage).
- `src/utils`: Utility functions (Logger, Audio Normalizer).
- `src/app.ts`: Express application setup.
- `src/server.ts`: HTTP and WebSocket server entry point.
- `prisma/`: Database schema and migrations.

## Features Implemented

### Database Models
- **Call**: Main call record with metadata (streamSid, callSid, caller, agent, duration, status, notes)
- **Recording**: Audio recording files with format/codec information
- **Transcript**: Call transcripts with speaker, text, confidence, timestamps
- **Analytics**: Call analytics snapshots (sentiment, talk time, interruptions, latency)
- **CallMetadata**: Additional metadata (language, region, device, network quality, custom data)

### Audio Processing
- Twilio uses mu-law encoded PCM at 8kHz
- OpenAI expects PCM16 at 24kHz
- Storage format is PCM16 at 16kHz in WAV containers
- `AudioNormalizer` utility handles all format conversions
- Base64 encoding/decoding for transmission

### Call Lifecycle
1. Incoming call receives TwiML response with WebSocket stream URL
2. WebSocket connection established at `/streams`
3. Audio streams between Twilio and OpenAI Realtime API
4. Call data, transcripts, and audio chunks saved to database
5. Recording generated and stored on call end
6. Analytics and metadata captured throughout call

### Error Handling
- Comprehensive error handling with Winston logging
- Automatic reconnection for OpenAI WebSocket failures (up to 5 retries)
- Graceful degradation on storage/database failures
- Consistent error response format across all API endpoints

## Testing

All 109 tests pass with comprehensive coverage:
- Unit tests for services and utilities
- Integration tests for API endpoints
- Mock-based testing for database and external services

Run tests with:
```bash
npm test
```
