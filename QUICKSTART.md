# Quick Start Guide

This guide will help you get the Twilio/OpenAI Realtime Bridge Server up and running quickly.

## Prerequisites

1. **Node.js** (v14 or higher)
2. **Twilio Account** with:
   - Account SID
   - Auth Token
   - Phone Number
3. **OpenAI API Key** with access to Realtime API

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd backend
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
NODE_ENV=development
PORT=3000

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBHOOK_SECRET=your_webhook_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Database Configuration
DATABASE_URL=file:./dev.db

# Storage Configuration
RECORDING_STORAGE_PATH=./recordings
```

### 3. Set Up Database

Initialize the database with migrations:

```bash
npm run db:migrate
npm run db:generate
```

This will:
- Create the SQLite database at `./dev.db`
- Apply all migrations
- Generate Prisma client

### 4. Start the Server

For development (with hot reload):

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

The server will start on `http://localhost:3000`

## Configure Twilio

### 1. Expose Your Local Server

For development, use a tunneling service like ngrok:

```bash
ngrok http 3000
```

This will give you a public URL like: `https://abc123.ngrok.io`

### 2. Configure Twilio Phone Number

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Select your phone number
4. Under **Voice Configuration**, set:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://your-domain.com/twilio/incoming-call`
   - **HTTP Method**: POST
5. Under **Call Status Changes**, optionally set:
   - **URL**: `https://your-domain.com/twilio/call-status`
   - **HTTP Method**: POST
6. Save your changes

## Test the Setup

### 1. Check Server Health

```bash
curl http://localhost:3000/health
```

You should see:
```json
{
  "status": "ok",
  "uptime": 123.456
}
```

### 2. Make a Test Call

Call your Twilio phone number. The system should:
1. Answer the call
2. Establish a WebSocket connection
3. Stream audio to OpenAI Realtime API
4. Stream responses back to Twilio
5. Record the call and save transcripts

### 3. View Call Records

List all calls:
```bash
curl http://localhost:3000/api/calls
```

Get specific call details:
```bash
curl http://localhost:3000/api/calls/{call-id}
```

Download recording:
```bash
curl http://localhost:3000/api/calls/{call-id}/recording?download=true -o recording.wav
```

### 4. View Analytics

```bash
curl http://localhost:3000/api/analytics
```

### 5. Browse Database

Open Prisma Studio to browse the database:

```bash
npm run db:studio
```

This will open a web interface at `http://localhost:5555`

## API Testing

### List Calls with Filters

```bash
# Get calls from a specific caller
curl "http://localhost:3000/api/calls?caller=%2B1234567890"

# Get calls with positive sentiment
curl "http://localhost:3000/api/calls?sentiment=positive"

# Get calls within a date range
curl "http://localhost:3000/api/calls?startDate=2024-01-01&endDate=2024-12-31"
```

### Add Notes to a Call

```bash
curl -X POST http://localhost:3000/api/calls/{call-id}/notes \
  -H "Content-Type: application/json" \
  -d '{"notes": "Customer requested callback"}'
```

### Get Analytics

```bash
# Daily analytics
curl "http://localhost:3000/api/analytics?interval=day"

# Weekly analytics for date range
curl "http://localhost:3000/api/analytics?interval=week&startDate=2024-01-01&endDate=2024-12-31"
```

### Real-time Status Updates (SSE)

```bash
curl -N http://localhost:3000/api/status
```

## Development

### Run Tests

```bash
npm test
```

### Lint Code

```bash
npm run lint
```

### Format Code

```bash
npm run format
```

### Reset Database

To reset and re-apply all migrations:

```bash
npm run db:reset
```

⚠️ **Warning**: This will delete all data in the database!

## Troubleshooting

### Database Issues

If you encounter database errors:

1. Delete the database file:
   ```bash
   rm dev.db dev.db-journal
   ```

2. Re-run migrations:
   ```bash
   npm run db:migrate
   ```

### WebSocket Connection Errors

If WebSocket connections fail:

1. Check that the `/streams` path is accessible
2. Verify your ngrok or public URL is correct
3. Check Twilio webhook configuration
4. Review server logs for errors

### OpenAI API Errors

If OpenAI connections fail:

1. Verify your API key is correct
2. Check you have access to the Realtime API
3. Monitor the logs for specific error messages
4. The system will automatically retry up to 5 times

### Recording Storage Issues

If recordings aren't being saved:

1. Check the `RECORDING_STORAGE_PATH` exists or can be created
2. Verify write permissions for the recordings directory
3. Check disk space availability

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production` in `.env`
2. Use a proper database (can still use SQLite or upgrade to PostgreSQL)
3. Set up proper logging and monitoring
4. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start npm --name "twilio-bridge" -- start
   ```
5. Set up HTTPS with proper SSL certificates
6. Configure firewall rules
7. Set up automated backups for database and recordings

## Next Steps

- Customize OpenAI prompts and instructions
- Add custom analytics and metrics
- Implement call routing logic
- Add authentication for API endpoints
- Set up monitoring and alerting
- Integrate with CRM or other systems

## Support

For issues or questions:
1. Check the main README.md for detailed documentation
2. Review the IMPLEMENTATION_SUMMARY.md for architecture details
3. Check logs in the console (development) or log files (production)
