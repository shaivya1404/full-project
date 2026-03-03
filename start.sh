#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Oolix Voice AI — Start All Services
#  Run: bash /workspace/full-project/start.sh
# ─────────────────────────────────────────────────────────────
set -e
ROOT="/workspace/full-project"

echo ""
echo "  Oolix Voice AI — Starting services..."
echo ""

# ── 1. Backend (Node.js) ─────────────────────────────────────
echo "[1/3] Starting backend on port 4000..."
cd "$ROOT/backend"
node --env-file="$ROOT/.env" dist/server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "      PID: $BACKEND_PID"
sleep 6

# Verify backend started
if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
  echo "      OK — http://localhost:4000"
else
  echo "      ERROR — check /tmp/backend.log"
  cat /tmp/backend.log | tail -5
  exit 1
fi

# ── 2. Frontend (Vite dev server) ────────────────────────────
echo "[2/3] Starting frontend on port 5173..."
cd "$ROOT/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/frontend.log 2>&1 &
echo "      PID: $!"
sleep 5

if curl -sf http://localhost:5173/ > /dev/null 2>&1; then
  echo "      OK — http://localhost:5173"
else
  echo "      ERROR — check /tmp/frontend.log"
fi

# ── 3. Python Pipeline (Whisper + VAD + LLM + TTS) ──────────
echo "[3/3] Starting voice pipeline on port 8765..."
source "$ROOT/.env" 2>/dev/null || true

WHISPER_MODEL=small \
STT_PROVIDER=custom \
PIPELINE_HOST=0.0.0.0 \
PIPELINE_PORT=8765 \
LLM_BASE_URL="${LLM_BASE_URL:-https://api.groq.com/openai/v1}" \
LLM_API_KEY="${LLM_API_KEY}" \
LLM_MODEL="${LLM_MODEL:-llama-3.3-70b-versatile}" \
CARTESIA_API_KEY="${CARTESIA_API_KEY}" \
CARTESIA_VOICE_ID="${CARTESIA_VOICE_ID}" \
CARTESIA_MODEL="${CARTESIA_MODEL:-sonic-3}" \
python3 "$ROOT/backend/pipeline/server.py" > /tmp/pipeline.log 2>&1 &
echo "      PID: $!"
sleep 8

if ss -tlnp | grep -q ':8765'; then
  echo "      OK — ws://localhost:8765"
else
  echo "      ERROR — check /tmp/pipeline.log"
  cat /tmp/pipeline.log | tail -5
fi

# ── 4. Cloudflare Tunnel ─────────────────────────────────────
echo ""
echo "[+] Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:3002 --no-autoupdate --protocol http2 > /tmp/cloudflared.log 2>&1 &
echo "    PID: $!"
sleep 10

TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cloudflared.log | head -1)

if [ -n "$TUNNEL_URL" ]; then
  echo "    OK — $TUNNEL_URL"

  # Update .env with new tunnel URL
  sed -i "s|BASE_URL=.*|BASE_URL=$TUNNEL_URL|" "$ROOT/.env"
  sed -i "s|PUBLIC_SERVER_URL=.*|PUBLIC_SERVER_URL=$TUNNEL_URL|" "$ROOT/.env"
  sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$TUNNEL_URL|" "$ROOT/.env"
  sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$TUNNEL_URL,http://localhost:5173,http://localhost:4000|" "$ROOT/.env"
  sed -i "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$TUNNEL_URL/api|" "$ROOT/.env"
  sed -i "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=/api|" "$ROOT/frontend/.env"

  # Restart backend with updated ALLOWED_ORIGINS
  kill $BACKEND_PID 2>/dev/null
  sleep 2
  cd "$ROOT/backend"
  node --env-file="$ROOT/.env" dist/server.js > /tmp/backend.log 2>&1 &
  sleep 5
  echo "    Backend restarted with new CORS origin"
else
  echo "    WARNING — tunnel URL not found, check /tmp/cloudflared.log"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  All services running!"
echo "  App URL : $TUNNEL_URL"
echo "  Login   : demo@example.com / demo123"
echo "  Logs    : /tmp/backend.log  /tmp/pipeline.log"
echo "  Twilio webhooks:"
echo "    $TUNNEL_URL/twilio/incoming-call"
echo "    $TUNNEL_URL/twilio/call-status"
echo "══════════════════════════════════════════════"
echo ""
