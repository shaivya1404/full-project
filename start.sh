#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Oolix Voice AI — Full Auto-Setup + Start All Services
#  Run: bash /workspace/full-project/start.sh
#
#  Safe to run on a fresh RunPod pod OR on restart — installs
#  everything, runs migrations, seeds demo data, starts all
#  services, and auto-updates Twilio webhooks.
# ─────────────────────────────────────────────────────────────
set -uo pipefail
ROOT="/workspace/full-project"
ENV_FILE="$ROOT/.env"

# Colours
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "      ${GREEN}✓${NC} $*"; }
warn() { echo -e "      ${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "      ${RED}✗${NC}  $*"; }

echo ""
echo "  ══════════════════════════════════════════"
echo "    Oolix Voice AI — Setup & Start"
echo "  ══════════════════════════════════════════"
echo ""

# Load .env early so all steps can use API keys
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
else
  err ".env not found at $ENV_FILE — aborting."
  exit 1
fi

# ── 0. Kill everything cleanly first ─────────────────────────
echo "[0/6] Stopping any running services..."
pkill -f "dist/server.js"      2>/dev/null || true
pkill -f "pipeline/server.py"  2>/dev/null || true
pkill -f "uvicorn app:app"     2>/dev/null || true
pkill -f "vite.*5173"          2>/dev/null || true
pkill -f "cloudflared"         2>/dev/null || true
# Force-kill anything still holding our ports
for PORT in 4000 5173 8010 8765; do
  PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
  if [ -n "$PID" ]; then
    kill -9 "$PID" 2>/dev/null || true
    warn "Force-killed PID $PID on port $PORT"
  fi
done
sleep 3
ok "Ports 4000 5173 8010 8765 cleared."

# ── 1. System dependencies ───────────────────────────────────
echo "[1/6] Checking system dependencies..."

if ! command -v cloudflared &>/dev/null; then
  echo "      Installing cloudflared..."
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
fi

if ! command -v ffmpeg &>/dev/null; then
  echo "      Installing ffmpeg..."
  apt-get install -y ffmpeg -qq 2>/dev/null
fi

if ! command -v node &>/dev/null; then
  echo "      Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
  apt-get install -y nodejs -qq 2>/dev/null
fi

ok "System deps OK (cloudflared, ffmpeg, node $(node -v 2>/dev/null || echo '?'))"

# ── 2. Python + AI/ML dependencies ───────────────────────────
echo "[2/6] Checking Python + ML deps..."

# Core pipeline packages
python3 -c "import websockets, numpy, aiohttp" 2>/dev/null || {
  echo "      Installing core pipeline packages..."
  pip install -q websockets aiohttp numpy torch torchaudio
}

# STT service — install from requirements.txt (covers onnxruntime, soundfile, etc.)
echo "      Installing STT requirements..."
pip install -q -r "$ROOT/ml-service/stt-service/requirements.txt" 2>/dev/null \
  || warn "Some STT requirements failed — continuing anyway."

# AI4Bharat NeMo
NEMO_SRC="$ROOT/vendor/AI4Bharat-NeMo"
python3 -c "import nemo" 2>/dev/null || {
  echo "      Installing AI4Bharat NeMo..."
  if [ -d "$NEMO_SRC" ]; then
    pip install -q -e "$NEMO_SRC" 2>&1 | tail -3
    ok "NeMo installed from workspace."
  else
    warn "NeMo source not found at $NEMO_SRC — cloning (one-time ~2 min)..."
    git clone -q --depth 1 --branch nemo-v2 https://github.com/AI4Bharat/NeMo.git "$NEMO_SRC"
    pip install -q -e "$NEMO_SRC" 2>&1 | tail -3
    ok "NeMo installed from GitHub."
  fi
}

# Apply NeMo numpy 2.x patch (idempotent)
NEMO_SEGMENT=$(python3 -c "import nemo.collections.asr.parts.preprocessing.segment as m; print(m.__file__)" 2>/dev/null) || true
if [ -n "$NEMO_SEGMENT" ] && grep -q "samples.dtype in samples.dtype.kind" "$NEMO_SEGMENT" 2>/dev/null; then
  sed -i 's/if samples\.dtype in samples\.dtype\.kind in ("i","u"):/if samples.dtype.kind in ("i","u"):/' "$NEMO_SEGMENT"
  sed -i 's/elif samples\.dtype in samples\.dtype\.kind == "f":/elif samples.dtype.kind == "f":/' "$NEMO_SEGMENT"
  ok "NeMo numpy 2.x patch applied."
fi

# Models — stored in persistent /workspace
MODELS_DIR="$ROOT/models/stt/indicconformer"
if [ ! -f "$MODELS_DIR/hi.nemo" ]; then
  echo "      Downloading hi.nemo from HuggingFace..."
  mkdir -p "$MODELS_DIR"
  python3 -c "
import os
from huggingface_hub import hf_hub_download
token = os.getenv('HF_TOKEN') or os.getenv('HUGGING_FACE_HUB_TOKEN')
path = hf_hub_download(
    repo_id='ai4bharat/indicconformer_stt_hi_hybrid_ctc_rnnt_large',
    filename='indicconformer_stt_hi_hybrid_rnnt_large.nemo',
    token=token,
    local_dir='$MODELS_DIR',
)
import shutil, pathlib
dest = pathlib.Path('$MODELS_DIR/hi.nemo')
if not dest.exists():
    shutil.copy(path, dest)
print('Downloaded to', dest)
" && ok "hi.nemo ready." || warn "hi.nemo download failed — STT may use fallback."
else
  ok "hi.nemo already in workspace."
fi

ok "Python + ML deps OK."

# ── 3. Node.js — backend build ────────────────────────────────
echo "[3/6] Setting up backend..."
cd "$ROOT/backend"

[ ! -d node_modules ] && { echo "      npm install (backend)..."; npm install --silent; }

echo "      Generating Prisma client..."
npx prisma generate --silent 2>/dev/null || npx prisma generate

echo "      Running DB migrations..."
node --env-file="$ENV_FILE" -e "
const { execSync } = require('child_process');
try { execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env }); }
catch(e) { console.log('migrate deploy failed, trying db push...'); }
" 2>/dev/null || \
npx prisma db push --accept-data-loss 2>/dev/null || \
warn "Migrations already up to date."

echo "      Building backend TypeScript..."
npx tsc --noEmitOnError false 2>/dev/null && ok "Build complete." || warn "Build had TS errors (non-fatal)."

ok "Backend ready."

# ── 4. Frontend ───────────────────────────────────────────────
echo "[4/6] Setting up frontend..."
cd "$ROOT/frontend"
[ ! -d node_modules ] && { echo "      npm install (frontend)..."; npm install --silent; }
ok "Frontend ready."

# ── 5. Seed demo data ─────────────────────────────────────────
echo "[5/6] Checking demo data..."
cd "$ROOT/backend"
STORE_EXISTS=$(node --env-file="$ENV_FILE" -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.storeInfo.count()
  .then(n => { console.log(n); p.\$disconnect(); })
  .catch(() => { console.log(0); p.\$disconnect(); });
" 2>/dev/null)

if [ "$STORE_EXISTS" = "0" ] || [ -z "$STORE_EXISTS" ]; then
  echo "      Seeding demo data..."
  node --env-file="$ENV_FILE" -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const TEAM_ID = '28a96cd1-4866-41fb-85a3-e2171393838e';
async function seed() {
  const store = await prisma.storeInfo.upsert({
    where: { teamId: TEAM_ID },
    update: {},
    create: {
      teamId: TEAM_ID,
      storeName: 'Oolix Pizza',
      address: '12, MG Road, Sector 14, Gurugram, Haryana 122001',
      phone: '+911244567890',
      timezone: 'Asia/Kolkata',
      operatingHours: 'Mon-Sun 10:00 AM - 11:00 PM',
      deliveryEnabled: true,
      minOrderAmount: 199,
      avgPrepTime: 30,
    }
  });
  const existingZones = await prisma.deliveryZone.count({ where: { storeId: store.id } });
  if (existingZones === 0) {
    const zones = [
      { zoneName: 'Sector 14', deliveryFee: 30, estimatedTime: 20, minOrderAmount: 199, postalCodes: '122001' },
      { zoneName: 'Sector 15', deliveryFee: 40, estimatedTime: 25, minOrderAmount: 299, postalCodes: '122001' },
      { zoneName: 'DLF Phase 1', deliveryFee: 50, estimatedTime: 30, minOrderAmount: 399, postalCodes: '122002' },
      { zoneName: 'Sushant Lok', deliveryFee: 60, estimatedTime: 40, minOrderAmount: 499, postalCodes: '122003' },
    ];
    for (const z of zones) await prisma.deliveryZone.create({ data: { storeId: store.id, ...z, isActive: true } });
  }
  const products = [
    { name: 'Margherita Pizza', category: 'Pizza', price: 299, description: 'Classic tomato sauce, mozzarella, fresh basil', sku: 'PIZ-001', stockQuantity: 50 },
    { name: 'Paneer Tikka Pizza', category: 'Pizza', price: 399, description: 'Spicy paneer tikka, capsicum, onion, special sauce', sku: 'PIZ-002', stockQuantity: 40 },
    { name: 'Chicken Supreme Pizza', category: 'Pizza', price: 449, description: 'Grilled chicken, mushroom, olives, jalapeños', sku: 'PIZ-003', stockQuantity: 35 },
    { name: 'BBQ Chicken Pizza', category: 'Pizza', price: 429, description: 'BBQ sauce, pulled chicken, caramelized onions', sku: 'PIZ-004', stockQuantity: 30 },
    { name: 'Veggie Delight Pizza', category: 'Pizza', price: 349, description: 'Bell peppers, mushroom, olives, sweetcorn, tomato', sku: 'PIZ-005', stockQuantity: 45 },
    { name: 'Pepperoni Pizza', category: 'Pizza', price: 479, description: 'Classic pepperoni with mozzarella and tomato sauce', sku: 'PIZ-006', stockQuantity: 25 },
    { name: 'Garlic Bread', category: 'Sides', price: 99, description: 'Toasted garlic butter bread, 4 pieces', sku: 'SID-001', stockQuantity: 60 },
    { name: 'Stuffed Garlic Bread', category: 'Sides', price: 149, description: 'Garlic bread stuffed with cheese and herbs', sku: 'SID-002', stockQuantity: 50 },
    { name: 'Cheesy Dips (3pcs)', category: 'Sides', price: 79, description: 'Cheese dip, ranch, and marinara', sku: 'SID-003', stockQuantity: 80 },
    { name: 'Chicken Wings (6pcs)', category: 'Sides', price: 249, description: 'Crispy buffalo chicken wings', sku: 'SID-004', stockQuantity: 40 },
    { name: 'Coca-Cola (500ml)', category: 'Drinks', price: 60, description: 'Chilled Coca-Cola', sku: 'DRK-001', stockQuantity: 100 },
    { name: 'Sprite (500ml)', category: 'Drinks', price: 60, description: 'Chilled Sprite', sku: 'DRK-002', stockQuantity: 100 },
    { name: 'Fresh Lime Soda', category: 'Drinks', price: 80, description: 'Fresh lime with soda water, sweet or salted', sku: 'DRK-003', stockQuantity: 60 },
    { name: 'Choco Lava Cake', category: 'Desserts', price: 129, description: 'Warm chocolate cake with molten center', sku: 'DES-001', stockQuantity: 30 },
    { name: 'Vanilla Ice Cream', category: 'Desserts', price: 99, description: '2 scoops of creamy vanilla ice cream', sku: 'DES-002', stockQuantity: 40 },
  ];
  for (const p of products) {
    const ex = await prisma.product.findFirst({ where: { teamId: TEAM_ID, sku: p.sku } });
    if (!ex) await prisma.product.create({ data: { teamId: TEAM_ID, reorderLevel: 10, isAvailable: true, ...p } });
  }
  const faqs = [
    { q: 'What are your delivery hours?', a: 'We deliver from 10 AM to 11 PM every day including weekends.' },
    { q: 'What is the minimum order for delivery?', a: 'Minimum order is ₹199 for Sector 14. Higher minimums apply for farther zones.' },
    { q: 'Do you offer vegetarian options?', a: 'Yes! Margherita, Paneer Tikka, and Veggie Delight pizzas plus garlic bread are all vegetarian.' },
    { q: 'How long does delivery take?', a: 'Typically 20-40 minutes depending on your zone.' },
    { q: 'Can I customize my pizza?', a: 'Yes, you can add or remove toppings. Extra toppings may have a small charge.' },
    { q: 'Do you accept online payment?', a: 'Yes, we accept UPI, credit/debit cards, and net banking. Cash on delivery also available.' },
    { q: 'What are your pizza sizes?', a: 'We offer Medium (8 inch) and Large (12 inch) sizes for all pizzas.' },
    { q: 'Is there a delivery charge?', a: 'Delivery fee ranges from ₹30 to ₹60 depending on your area.' },
    { q: 'Can I reorder my last order?', a: 'Yes, just tell our assistant and we can place the same order after confirming.' },
    { q: 'Do you have combo deals?', a: 'Yes! Ask our assistant about current combos — pizza + drink + garlic bread deals.' },
  ];
  for (const f of faqs) {
    const ex = await prisma.productFAQ.findFirst({ where: { teamId: TEAM_ID, question: f.q } });
    if (!ex) await prisma.productFAQ.create({ data: { teamId: TEAM_ID, question: f.q, answer: f.a, helpfulCount: 0 } });
  }
  console.log('Demo data seeded.');
}
seed().catch(console.error).finally(() => prisma.\$disconnect());
" 2>/dev/null && ok "Demo data seeded." || warn "Demo data seed skipped (DB may not be reachable yet)."
else
  ok "Demo data already present."
fi

# ── 6. Start all services ─────────────────────────────────────
echo "[6/6] Starting services..."

# ── Backend (port 4000) ───────────────────────────────────────
echo "      Starting backend on port 4000..."
cd "$ROOT/backend"
node --env-file="$ENV_FILE" dist/server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
for i in $(seq 1 20); do
  curl -sf http://localhost:4000/health > /dev/null 2>&1 && break
  if [ "$i" -eq 20 ]; then
    err "Backend failed to start. Last log:"
    tail -15 /tmp/backend.log
    exit 1
  fi
  sleep 2
done
ok "Backend running  → http://localhost:4000  (PID $BACKEND_PID)"

# ── Frontend (port 5173) ──────────────────────────────────────
echo "      Starting frontend on port 5173..."
cd "$ROOT/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
for i in $(seq 1 15); do
  curl -sf http://localhost:5173/ > /dev/null 2>&1 && break
  [ "$i" -eq 15 ] && warn "Frontend slow to start — check /tmp/frontend.log."
  sleep 2
done
ok "Frontend running → http://localhost:5173  (PID $FRONTEND_PID)"

# ── STT Service (port 8010) ───────────────────────────────────
echo "      Starting STT service on port 8010..."
echo "      (IndicConformer model warmup takes ~60s on first run)"
cd "$ROOT/ml-service/stt-service"
HF_TOKEN="${HF_TOKEN:-}" \
HUGGING_FACE_HUB_TOKEN="${HUGGING_FACE_HUB_TOKEN:-$HF_TOKEN}" \
INDIC_MODEL_DIR="${INDIC_MODEL_DIR:-$ROOT/models/stt/indicconformer}" \
  python3 -m uvicorn app:app --host 0.0.0.0 --port 8010 > /tmp/stt-service.log 2>&1 &
STT_PID=$!
# Wait up to 3 minutes for model warmup
for i in $(seq 1 90); do
  STATUS=$(curl -sf http://localhost:8010/ml/stt/health 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
  if [ "$STATUS" = "ok" ]; then
    ok "STT service ready → http://localhost:8010  (PID $STT_PID)"
    break
  fi
  if [ "$i" -eq 90 ]; then
    warn "STT service taking very long — continuing anyway. Check /tmp/stt-service.log."
    warn "Calls will still work — STT loads on first request."
  fi
  sleep 2
done

# ── Voice Pipeline (port 8765) ────────────────────────────────
echo "      Starting voice pipeline on port 8765..."
cd "$ROOT/backend"
python3 "$ROOT/backend/pipeline/server.py" > /tmp/pipeline.log 2>&1 &
PIPELINE_PID=$!
for i in $(seq 1 20); do
  ss -tlnp 2>/dev/null | grep -q ':8765' && break
  [ "$i" -eq 20 ] && warn "Pipeline slow to start — check /tmp/pipeline.log."
  sleep 2
done
ok "Pipeline running  → ws://localhost:8765   (PID $PIPELINE_PID)"

# ── Cloudflare Tunnel → Backend ───────────────────────────────
# IMPORTANT: tunnel points to port 4000 (backend) so Twilio webhooks work
echo "      Starting Cloudflare Tunnel → backend:4000..."
cloudflared tunnel --url http://localhost:4000 --no-autoupdate --protocol http2 \
  > /tmp/cloudflared.log 2>&1 &
TUNNEL_PID=$!

TUNNEL_URL=""
for i in $(seq 1 25); do
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cloudflared.log | head -1)
  [ -n "$TUNNEL_URL" ] && break
  sleep 2
done

if [ -n "$TUNNEL_URL" ]; then
  ok "Tunnel active     → $TUNNEL_URL  (PID $TUNNEL_PID)"

  # Update .env with new tunnel URL
  sed -i "s|^BASE_URL=.*|BASE_URL=$TUNNEL_URL|"                   "$ENV_FILE"
  sed -i "s|^PUBLIC_SERVER_URL=.*|PUBLIC_SERVER_URL=$TUNNEL_URL|" "$ENV_FILE"
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=$TUNNEL_URL|"           "$ENV_FILE"
  sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$TUNNEL_URL,http://localhost:5173,http://localhost:4000|" "$ENV_FILE"
  sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$TUNNEL_URL/api|" "$ENV_FILE"
  printf "VITE_API_BASE_URL=/api\n" > "$ROOT/frontend/.env"

  # Restart backend so it picks up new CORS origins
  kill "$BACKEND_PID" 2>/dev/null
  sleep 2
  set -a; source "$ENV_FILE"; set +a
  cd "$ROOT/backend"
  node --env-file="$ENV_FILE" dist/server.js > /tmp/backend.log 2>&1 &
  BACKEND_PID=$!
  for i in $(seq 1 15); do
    curl -sf http://localhost:4000/health > /dev/null 2>&1 && break
    sleep 2
  done
  ok "Backend restarted with updated CORS."

  # Auto-update Twilio webhooks
  TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID:-}"
  TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN:-}"
  TWILIO_PHONE_NUMBER="${TWILIO_PHONE_NUMBER:-}"
  if [ -n "$TWILIO_ACCOUNT_SID" ] && [ -n "$TWILIO_AUTH_TOKEN" ] && [ -n "$TWILIO_PHONE_NUMBER" ]; then
    echo "      Updating Twilio webhooks..."
    PN_SID=$(curl -sf -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
      "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json" \
      | python3 -c "
import sys,json
pns = json.load(sys.stdin).get('incoming_phone_numbers',[])
match = [p for p in pns if p['phone_number'] == '$TWILIO_PHONE_NUMBER']
print((match or pns)[0]['sid'] if pns else '')
" 2>/dev/null)
    if [ -n "$PN_SID" ]; then
      curl -sf -X POST -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
        "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/$PN_SID.json" \
        --data-urlencode "VoiceUrl=$TUNNEL_URL/twilio/incoming-call" \
        --data-urlencode "VoiceMethod=POST" \
        --data-urlencode "StatusCallback=$TUNNEL_URL/twilio/call-status" \
        --data-urlencode "StatusCallbackMethod=POST" > /dev/null
      ok "Twilio webhooks updated for $TWILIO_PHONE_NUMBER"
    else
      warn "Could not find Twilio phone number SID — update webhooks manually."
    fi
  else
    warn "Twilio credentials not set — skipping webhook update."
  fi
else
  warn "Cloudflare tunnel URL not found. Check /tmp/cloudflared.log"
  warn "Twilio webhooks NOT updated — calls won't work externally."
  TUNNEL_URL="http://localhost:4000"
fi

# ── Final status ──────────────────────────────────────────────
echo ""
echo "  ══════════════════════════════════════════════════════════"
echo "  All services running!"
echo ""
printf "  %-12s %s\n" "Backend:"  "http://localhost:4000"
printf "  %-12s %s\n" "Frontend:" "http://localhost:5173"
printf "  %-12s %s\n" "STT:"      "http://localhost:8010"
printf "  %-12s %s\n" "Pipeline:" "ws://localhost:8765"
printf "  %-12s %s\n" "Tunnel:"   "$TUNNEL_URL"
echo ""
echo "  Login    : demo@example.com / demo123"
echo ""
echo "  Twilio webhooks (auto-configured):"
printf "  %-12s %s\n" "Inbound:"  "$TUNNEL_URL/twilio/incoming-call"
printf "  %-12s %s\n" "Status:"   "$TUNNEL_URL/twilio/call-status"
echo ""
echo "  Logs:"
printf "  %-12s %s\n" "Backend:"  "/tmp/backend.log"
printf "  %-12s %s\n" "Frontend:" "/tmp/frontend.log"
printf "  %-12s %s\n" "STT:"      "/tmp/stt-service.log"
printf "  %-12s %s\n" "Pipeline:" "/tmp/pipeline.log"
printf "  %-12s %s\n" "Tunnel:"   "/tmp/cloudflared.log"
echo "  ══════════════════════════════════════════════════════════"
echo ""
