# How to Test the Voice Agent Pipeline

## What you need before starting
- Docker Desktop running
- Python 3.11
- `.env` file created (copy from `.env.example`, fill in GROQ_API_KEY + CARTESIA_API_KEY)

---

## Step 1 — Start Postgres + Redis

```bash
docker compose -f infra/docker/docker-compose.dev.yml up postgres redis -d
```

Check:
```bash
docker ps
# Should see: postgres:15 on :5432, redis:7-alpine on :6379
```

---

## Step 2 — Run Prisma Migration (one time only)

```bash
cd backend
npx prisma migrate dev --name add_voice_agent_models
cd ..
```

---

## Step 3 — Start Services (each in a separate terminal)

### Terminal 1 — Admin API
```bash
cd admin-api
pip install -r requirements.txt
cd ..
DATABASE_URL=postgresql://tts_stt:tts_stt_password@localhost:5432/tts_stt \
  uvicorn admin_api.app:app --host 0.0.0.0 --port 8006 --reload
```

### Terminal 2 — Emotion Service
```bash
cd emotion-service
pip install -r requirements.txt
cd ..
uvicorn emotion_service.app:app --host 0.0.0.0 --port 8003 --reload
```
> First run downloads emotion2vec_plus_large (~1.5GB). Subsequent starts are instant.

### Terminal 3 — STT Service (existing)
```bash
cd ml-service/stt-service
pip install -r requirements.txt   # if not already
cd ../..
LORA_MODEL_PATH=./whisper-stt-model-29-1-2026 \
  uvicorn ml-service.stt-service.app:app --host 0.0.0.0 --port 8002 --reload
```

### Terminal 4 — Agent
```bash
cd agent
pip install -r requirements.txt
cd ..
# Make sure .env exists with GROQ_API_KEY, CARTESIA_API_KEY, DATABASE_URL, REDIS_URL
python -m agent.main
```
> Agent runs WebSocket on :8010, HTTP REST on :8011

---

## Step 4 — Quick Health Checks

Run these in a new terminal to verify each service is up:

```bash
curl http://localhost:8006/admin/v1/health
# {"status":"ok","service":"admin-api"}

curl http://localhost:8003/emotion/health
# {"status":"ok","service":"emotion-service","model_loaded":true}

curl http://localhost:8002/ml/stt/health
# {"status":"ok","detail":"stt-service healthy",...}

curl http://localhost:8011/health
# {"status":"ok","active_calls":0}
```

---

## Step 5 — Run the Full Test Script

```bash
pip install httpx websockets soundfile numpy

# Basic test (uses generated tone, not real speech)
python scripts/test_pipeline.py

# Better test with your own voice recording
TEST_AUDIO_PATH=path/to/recording.wav python scripts/test_pipeline.py
```

The script does everything automatically:
1. Creates a test company "Acme Support" in the DB
2. Registers `+911234567890` as its phone number
3. Starts a call session
4. Streams audio over WebSocket
5. Reports latency + what the agent said

---

## Step 6 — Manual curl Tests

### Create a company manually
```bash
curl -X POST http://localhost:8006/admin/v1/companies \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "org-001",
    "name": "My Company",
    "agent_name": "Aria",
    "system_prompt": "You are Aria, a helpful support agent. Be concise.",
    "language": "en",
    "voice_id": "YOUR_CARTESIA_VOICE_ID"
  }'
```

### Register a phone number
```bash
curl -X POST http://localhost:8006/admin/v1/phone-numbers \
  -H "Content-Type: application/json" \
  -d '{"company_id": "COMPANY_ID_FROM_ABOVE", "number": "+911234567890"}'
```

### Start a call
```bash
curl -X POST http://localhost:8011/calls \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+911234567890", "from_number": "+919999999999", "call_id": "test-001"}'
# Returns: {"call_id":"test-001","ws_url":"ws://0.0.0.0:8010/calls/test-001/audio",...}
```

### Test emotion directly
```bash
# Encode your WAV as base64 first:
AUDIO_B64=$(base64 -w0 your_audio.wav)

curl -X POST http://localhost:8003/emotion/analyze \
  -H "Content-Type: application/json" \
  -d "{\"audio_b64\": \"$AUDIO_B64\", \"sample_rate\": 16000}"
# Returns: {"label":"neutral","score":0.87,"all_scores":{...}}
```

### Test STT LoRA directly
```bash
curl -X POST http://localhost:8002/ml/stt/transcribe/lora \
  -F "file=@your_audio.wav" \
  -F "language_hint=en"
# Returns: {"text":"hello I need help","confidence":0.8,...}
```

---

## What to Expect

| Test | Expected output |
|------|-----------------|
| Admin API health | `{"status":"ok"}` |
| Emotion health | `model_loaded: true` (after download) |
| STT LoRA | transcription (if model path is correct) |
| STT LoRA 503 | model path wrong — set LORA_MODEL_PATH |
| Agent POST /calls | `ws_url` returned |
| WebSocket audio | audio bytes back OR `agent_text` JSON event |
| Latency | first audio in 800-1500ms is the target |

---

## Giving the API to the Calling Product Developer

Give them exactly this:

```
POST http://YOUR_SERVER_IP:8011/calls
Body: {"to_number": "+91...", "from_number": "+91...", "call_id": "their-call-id"}
Returns: {"ws_url": "ws://YOUR_SERVER_IP:8010/calls/{id}/audio", ...}

WebSocket ws://YOUR_SERVER_IP:8010/calls/{id}/audio
  Send:    binary PCM frames (16kHz, int16, mono)
  Receive: binary PCM frames (agent speech to play to caller)
           OR JSON: {"type":"agent_text","text":"..."} if no voice_id set
```

That is the entire integration. Two endpoints.
