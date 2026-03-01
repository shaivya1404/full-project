#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Oolix Voice AI — Local Dev Startup
#  Reads the single root .env and starts all three services
# ─────────────────────────────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example to .env and fill in values."
  exit 1
fi

# Export all vars from root .env into this shell session
set -a
source "$ENV_FILE"
set +a

echo ""
echo "  Oolix Voice AI — starting services"
echo "  ENV: $ENV_FILE"
echo "  VOICE_PROVIDER: $VOICE_PROVIDER"
echo ""

# ── Pipeline server (Python) ─────────────────────────────────
if [ "$VOICE_PROVIDER" = "custom" ]; then
  echo "[1/3] Starting Python pipeline server on port ${PIPELINE_PORT:-8765}..."
  cd "$ROOT/backend/pipeline"
  python server.py &
  PIPELINE_PID=$!
  echo "      PID: $PIPELINE_PID"
  sleep 2
else
  echo "[1/3] Skipping pipeline server (VOICE_PROVIDER=openai)"
fi

# ── Backend (Node.js) ────────────────────────────────────────
echo "[2/3] Starting Node.js backend on port ${PORT:-4000}..."
cd "$ROOT/backend"
npm run dev &
BACKEND_PID=$!
echo "      PID: $BACKEND_PID"

# ── Frontend (Vite) ──────────────────────────────────────────
echo "[3/3] Starting React frontend..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
echo "      PID: $FRONTEND_PID"

echo ""
echo "  All services started."
echo "  Backend  → http://localhost:${PORT:-4000}"
echo "  Frontend → http://localhost:5173"
[ "$VOICE_PROVIDER" = "custom" ] && echo "  Pipeline → ws://localhost:${PIPELINE_PORT:-8765}"
echo ""
echo "  Press Ctrl+C to stop all services."

# Stop all on Ctrl+C
trap "echo 'Stopping...'; kill $PIPELINE_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
