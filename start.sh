#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Oolix Voice AI — Start All Services
#  Run: bash /workspace/full-project/start.sh
# ─────────────────────────────────────────────────────────────
ROOT="/workspace/full-project"
ENV_FILE="$ROOT/.env"

echo ""
echo "  Oolix Voice AI — Starting services..."
echo ""

# ── 0. Pre-flight checks ─────────────────────────────────────

# cloudflared
if ! command -v cloudflared &>/dev/null; then
  echo "[0/4] Installing cloudflared..."
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
  echo "      cloudflared installed."
fi

# ffmpeg (required by Whisper for audio decoding)
if ! command -v ffmpeg &>/dev/null; then
  echo "[0/4] Installing ffmpeg..."
  apt-get install -y ffmpeg -qq
  echo "      ffmpeg installed."
fi

# Python deps for pipeline
echo "[0/4] Checking Python deps..."
python3 -c "import websockets, whisper, numpy, aiohttp" 2>/dev/null || {
  echo "      Installing missing Python packages..."
  pip install -q websockets aiohttp numpy openai-whisper
  echo "      Python deps ready."
}

# Backend build
if [ ! -f "$ROOT/backend/dist/server.js" ]; then
  echo "[0/4] Backend not built — building now..."
  cd "$ROOT/backend" && npm run build
  echo "      Build complete."
fi

# Kill any leftover processes from previous runs
pkill -f "dist/server.js" 2>/dev/null || true
pkill -f "pipeline/server.py" 2>/dev/null || true
pkill -f "vite.*5173" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
sleep 1

# ── 1. Backend (Node.js) ─────────────────────────────────────
echo "[1/4] Starting backend on port 4000..."
cd "$ROOT/backend"
node --env-file="$ENV_FILE" dist/server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Poll until healthy (up to 30s)
for i in $(seq 1 15); do
  if curl -sf http://localhost:4000/health > /dev/null 2>&1; then
    echo "      OK — http://localhost:4000  (PID $BACKEND_PID)"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "      ERROR — backend did not start. Check /tmp/backend.log:"
    tail -10 /tmp/backend.log
    exit 1
  fi
  sleep 2
done

# ── 2. Frontend (Vite) ────────────────────────────────────────
echo "[2/4] Starting frontend on port 5173..."
cd "$ROOT/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

for i in $(seq 1 15); do
  if curl -sf http://localhost:5173/ > /dev/null 2>&1; then
    echo "      OK — http://localhost:5173  (PID $FRONTEND_PID)"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "      ERROR — frontend did not start. Check /tmp/frontend.log:"
    tail -5 /tmp/frontend.log
  fi
  sleep 2
done

# ── 3. Python Pipeline (Whisper + VAD + LLM + TTS) ──────────
echo "[3/4] Starting voice pipeline on port 8765..."
set -a; source "$ENV_FILE"; set +a
python3 "$ROOT/backend/pipeline/server.py" > /tmp/pipeline.log 2>&1 &
PIPELINE_PID=$!

for i in $(seq 1 20); do
  if ss -tlnp 2>/dev/null | grep -q ':8765'; then
    echo "      OK — ws://localhost:8765  (PID $PIPELINE_PID)"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo "      ERROR — pipeline did not start. Check /tmp/pipeline.log:"
    tail -10 /tmp/pipeline.log
  fi
  sleep 2
done

# ── 4. Cloudflare Tunnel → frontend:5173 ─────────────────────
# Vite proxies /api and /twilio to backend:4000 automatically
echo "[4/4] Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:5173 --no-autoupdate --protocol http2 \
  > /tmp/cloudflared.log 2>&1 &
TUNNEL_PID=$!

# Poll until URL appears (up to 40s)
TUNNEL_URL=""
for i in $(seq 1 20); do
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cloudflared.log | head -1)
  [ -n "$TUNNEL_URL" ] && break
  sleep 2
done

if [ -n "$TUNNEL_URL" ]; then
  echo "      OK — $TUNNEL_URL  (PID $TUNNEL_PID)"

  # Update .env with new tunnel URL (^ anchor prevents matching DATABASE_URL, LLM_BASE_URL etc.)
  sed -i "s|^BASE_URL=.*|BASE_URL=$TUNNEL_URL|" "$ENV_FILE"
  sed -i "s|^PUBLIC_SERVER_URL=.*|PUBLIC_SERVER_URL=$TUNNEL_URL|" "$ENV_FILE"
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=$TUNNEL_URL|" "$ENV_FILE"
  sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$TUNNEL_URL,http://localhost:5173,http://localhost:4000|" "$ENV_FILE"
  sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$TUNNEL_URL/api|" "$ENV_FILE"
  # Frontend always uses relative /api (Vite proxy handles it)
  printf "VITE_API_BASE_URL=/api\n" > "$ROOT/frontend/.env"

  # Restart backend so CORS picks up new ALLOWED_ORIGINS
  kill "$BACKEND_PID" 2>/dev/null; sleep 2
  cd "$ROOT/backend"
  node --env-file="$ENV_FILE" dist/server.js > /tmp/backend.log 2>&1 &
  BACKEND_PID=$!
  for i in $(seq 1 10); do
    curl -sf http://localhost:4000/health > /dev/null 2>&1 && break
    sleep 2
  done
  echo "      Backend restarted with updated CORS origins."

  # Auto-update Twilio webhooks with new tunnel URL
  if [ -n "$TWILIO_ACCOUNT_SID" ] && [ -n "$TWILIO_AUTH_TOKEN" ] && [ -n "$TWILIO_PHONE_NUMBER" ]; then
    echo "      Updating Twilio webhooks..."
    PN_SID=$(curl -sf -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
      "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json?PhoneNumber=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TWILIO_PHONE_NUMBER'))")" \
      | python3 -c "import sys,json; print(json.load(sys.stdin)['incoming_phone_numbers'][0]['sid'])" 2>/dev/null)
    if [ -n "$PN_SID" ]; then
      curl -sf -X POST -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
        "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/$PN_SID.json" \
        --data-urlencode "VoiceUrl=$TUNNEL_URL/twilio/incoming-call" \
        --data-urlencode "VoiceMethod=POST" \
        --data-urlencode "StatusCallback=$TUNNEL_URL/twilio/call-status" \
        --data-urlencode "StatusCallbackMethod=POST" > /dev/null
      echo "      Twilio webhooks updated for $TWILIO_PHONE_NUMBER"
    else
      echo "      WARNING — could not find Twilio phone number SID"
    fi
  fi
else
  echo "      WARNING — tunnel URL not found. Check /tmp/cloudflared.log"
  TUNNEL_URL="http://localhost:5173"
fi

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════"
echo "  All services running!"
echo ""
echo "  App URL  : $TUNNEL_URL"
echo "  Login    : demo@example.com / demo123"
echo ""
echo "  Twilio webhook URLs (set in Twilio console):"
echo "    Voice (Inbound) : $TUNNEL_URL/twilio/incoming-call"
echo "    Call Status     : $TUNNEL_URL/twilio/call-status"
echo "    Recording       : $TUNNEL_URL/twilio/recording-complete"
echo "    Outbound Handler: $TUNNEL_URL/twilio/outbound-call-handler"
echo ""
echo "  Logs:"
echo "    Backend  → /tmp/backend.log"
echo "    Frontend → /tmp/frontend.log"
echo "    Pipeline → /tmp/pipeline.log"
echo "    Tunnel   → /tmp/cloudflared.log"
echo "══════════════════════════════════════════════════════════"
echo ""
