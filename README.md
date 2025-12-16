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
