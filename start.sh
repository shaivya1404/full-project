#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Oolix Voice AI — Full Auto-Setup + Start All Services
#  Run: bash /workspace/full-project/start.sh
#
#  Safe to run on a brand-new RunPod pod — installs everything,
#  runs migrations, seeds demo data, and starts all services.
# ─────────────────────────────────────────────────────────────
set -e
ROOT="/workspace/full-project"
ENV_FILE="$ROOT/.env"

echo ""
echo "  Oolix Voice AI — Setup & Start"
echo ""

# ── 0. System dependencies ───────────────────────────────────
echo "[0/6] Checking system dependencies..."

if ! command -v cloudflared &>/dev/null; then
  echo "      Installing cloudflared..."
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
    -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared
fi

if ! command -v ffmpeg &>/dev/null; then
  echo "      Installing ffmpeg..."
  apt-get install -y ffmpeg -qq
fi

if ! command -v node &>/dev/null; then
  echo "      Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs -qq
fi

echo "      System deps OK."

# ── 1. Python pipeline dependencies ──────────────────────────
echo "[1/6] Checking Python deps..."
python3 -c "import websockets, numpy, aiohttp, silero_vad" 2>/dev/null || {
  echo "      Installing Python packages..."
  pip install -q websockets aiohttp numpy torch torchaudio silero-vad groq
  echo "      Python deps installed."
}

# STT service deps
python3 -c "import fastapi, uvicorn, soundfile, loguru" 2>/dev/null || {
  echo "      Installing STT service packages..."
  pip install -q fastapi uvicorn soundfile loguru pydantic python-multipart
}

# Apply NeMo numpy 2.x compatibility patch (fixes TypeError in segment.py)
NEMO_SEGMENT="/opt/AI4Bharat-NeMo/nemo/collections/asr/parts/preprocessing/segment.py"
if [ -f "$NEMO_SEGMENT" ]; then
  if grep -q "samples.dtype in samples.dtype.kind" "$NEMO_SEGMENT" 2>/dev/null; then
    echo "      Patching NeMo segment.py for numpy 2.x compatibility..."
    sed -i 's/if samples\.dtype in samples\.dtype\.kind in ("i","u"):/if samples.dtype.kind in ("i","u"):/' "$NEMO_SEGMENT"
    sed -i 's/elif samples\.dtype in samples\.dtype\.kind == "f":/elif samples.dtype.kind == "f":/' "$NEMO_SEGMENT"
    echo "      NeMo patch applied."
  fi
fi

# Ensure hi.nemo symlink exists (local model takes priority over HF download)
NEMO_LOCAL_DIR="/models/stt/indicconformer"
NEMO_CACHE_FILE=$(find /root/.cache/torch/NeMo -name "indicconformer_stt_hi*.nemo" 2>/dev/null | head -1)
if [ -n "$NEMO_CACHE_FILE" ] && [ ! -f "$NEMO_LOCAL_DIR/hi.nemo" ]; then
  echo "      Symlinking hi.nemo from NeMo cache..."
  mkdir -p "$NEMO_LOCAL_DIR"
  ln -sf "$NEMO_CACHE_FILE" "$NEMO_LOCAL_DIR/hi.nemo"
  echo "      hi.nemo symlinked."
fi

echo "      Python deps OK."

# ── 2. Node.js dependencies + build ──────────────────────────
echo "[2/6] Setting up backend..."

# Install backend node_modules if missing
if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "      npm install (backend)..."
  cd "$ROOT/backend" && npm install --silent
fi

# Regenerate Prisma client (always safe — fast if already up to date)
echo "      Generating Prisma client..."
cd "$ROOT/backend" && npx prisma generate --silent 2>/dev/null || npx prisma generate

# Run DB migrations (deploy = non-interactive, safe for production)
echo "      Running DB migrations..."
cd "$ROOT/backend" && node --env-file="$ENV_FILE" -e "
const { execSync } = require('child_process');
execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
" 2>/dev/null || npx prisma db push --accept-data-loss 2>/dev/null || echo "      Migrations already up to date."

# Build backend if dist is missing or source is newer
if [ ! -f "$ROOT/backend/dist/server.js" ] || \
   [ "$ROOT/backend/src/server.ts" -nt "$ROOT/backend/dist/server.js" ]; then
  echo "      Building backend TypeScript..."
  cd "$ROOT/backend" && npx tsc --noEmitOnError false 2>/dev/null
  echo "      Build complete."
fi

echo "      Backend OK."

# ── 3. Frontend dependencies ──────────────────────────────────
echo "[3/6] Setting up frontend..."
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "      npm install (frontend)..."
  cd "$ROOT/frontend" && npm install --silent
fi
echo "      Frontend OK."

# ── 4. Seed demo data (only runs if data is missing) ──────────
echo "[4/6] Checking demo data..."
cd "$ROOT/backend"
STORE_EXISTS=$(node --env-file="$ENV_FILE" -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.storeInfo.count().then(n => { console.log(n); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });
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
" 2>/dev/null && echo "      Demo data ready." || echo "      Demo data seed skipped (DB may not be reachable yet)."
else
  echo "      Demo data already present, skipping."
fi

# ── Kill any leftover processes ───────────────────────────────
pkill -f "dist/server.js" 2>/dev/null || true
pkill -f "pipeline/server.py" 2>/dev/null || true
pkill -f "uvicorn app:app" 2>/dev/null || true
pkill -f "stt-service" 2>/dev/null || true
pkill -f "vite.*5173" 2>/dev/null || true
pkill -f "cloudflared" 2>/dev/null || true
# Kill anything holding ports we need
for PORT in 4000 5173 8010 8765; do
  PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
  [ -n "$PID" ] && kill "$PID" 2>/dev/null || true
done
sleep 2

# ── 5. Start all services ─────────────────────────────────────

# Backend
echo "[5/6] Starting backend on port 4000..."
cd "$ROOT/backend"
node --env-file="$ENV_FILE" dist/server.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
for i in $(seq 1 15); do
  curl -sf http://localhost:4000/health > /dev/null 2>&1 && break
  [ "$i" -eq 15 ] && { echo "      ERROR — backend failed. Check /tmp/backend.log:"; tail -10 /tmp/backend.log; exit 1; }
  sleep 2
done
echo "      OK — http://localhost:4000  (PID $BACKEND_PID)"

# Frontend
echo "      Starting frontend on port 5173..."
cd "$ROOT/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
for i in $(seq 1 15); do
  curl -sf http://localhost:5173/ > /dev/null 2>&1 && break
  [ "$i" -eq 15 ] && echo "      WARNING — frontend slow to start. Check /tmp/frontend.log."
  sleep 2
done
echo "      OK — http://localhost:5173  (PID $FRONTEND_PID)"

# STT Service (AI4Bharat IndicConformer) on port 8010
echo "      Starting STT service on port 8010..."
set -a; source "$ENV_FILE"; set +a
cd "$ROOT/ml-service/stt-service"
HF_TOKEN="$HF_TOKEN" HUGGING_FACE_HUB_TOKEN="$HUGGING_FACE_HUB_TOKEN" \
  python3 -m uvicorn app:app --host 0.0.0.0 --port 8010 > /tmp/stt-service.log 2>&1 &
STT_PID=$!
# Wait for STT HTTP endpoint (NeMo warmup takes ~20s)
echo "      Waiting for NeMo model to warm up (may take ~20s)..."
for i in $(seq 1 40); do
  STATUS=$(curl -sf http://localhost:8010/ml/stt/health 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
  [ "$STATUS" = "ok" ] && break
  [ "$i" -eq 40 ] && { echo "      WARNING — STT service slow to start. Check /tmp/stt-service.log."; break; }
  sleep 2
done
echo "      OK — http://localhost:8010  (PID $STT_PID)"

# Pipeline
echo "      Starting voice pipeline on port 8765..."
set -a; source "$ENV_FILE"; set +a
cd "$ROOT/backend"
python3 "$ROOT/backend/pipeline/server.py" > /tmp/pipeline.log 2>&1 &
PIPELINE_PID=$!
for i in $(seq 1 20); do
  ss -tlnp 2>/dev/null | grep -q ':8765' && break
  [ "$i" -eq 20 ] && echo "      WARNING — pipeline slow to start. Check /tmp/pipeline.log."
  sleep 2
done
echo "      OK — ws://localhost:8765  (PID $PIPELINE_PID)"

# ── 6. Cloudflare Tunnel + Twilio webhooks ────────────────────
echo "[6/6] Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:5173 --no-autoupdate --protocol http2 \
  > /tmp/cloudflared.log 2>&1 &
TUNNEL_PID=$!

TUNNEL_URL=""
for i in $(seq 1 20); do
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cloudflared.log | head -1)
  [ -n "$TUNNEL_URL" ] && break
  sleep 2
done

if [ -n "$TUNNEL_URL" ]; then
  echo "      OK — $TUNNEL_URL  (PID $TUNNEL_PID)"

  # Update .env with new tunnel URL
  sed -i "s|^BASE_URL=.*|BASE_URL=$TUNNEL_URL|" "$ENV_FILE"
  sed -i "s|^PUBLIC_SERVER_URL=.*|PUBLIC_SERVER_URL=$TUNNEL_URL|" "$ENV_FILE"
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=$TUNNEL_URL|" "$ENV_FILE"
  sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=$TUNNEL_URL,http://localhost:5173,http://localhost:4000|" "$ENV_FILE"
  sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$TUNNEL_URL/api|" "$ENV_FILE"
  printf "VITE_API_BASE_URL=/api\n" > "$ROOT/frontend/.env"

  # Restart backend with updated CORS
  kill "$BACKEND_PID" 2>/dev/null; sleep 2
  cd "$ROOT/backend"
  node --env-file="$ENV_FILE" dist/server.js > /tmp/backend.log 2>&1 &
  BACKEND_PID=$!
  for i in $(seq 1 10); do
    curl -sf http://localhost:4000/health > /dev/null 2>&1 && break
    sleep 2
  done
  echo "      Backend restarted with updated CORS origins."

  # Update Twilio webhooks
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
echo "  Twilio webhook URLs (auto-updated):"
echo "    Inbound  : $TUNNEL_URL/twilio/incoming-call"
echo "    Status   : $TUNNEL_URL/twilio/call-status"
echo "    Recording: $TUNNEL_URL/twilio/recording-complete"
echo ""
echo "  Logs:"
echo "    Backend  → /tmp/backend.log"
echo "    Frontend → /tmp/frontend.log"
echo "    STT      → /tmp/stt-service.log"
echo "    Pipeline → /tmp/pipeline.log"
echo "    Tunnel   → /tmp/cloudflared.log"
echo "══════════════════════════════════════════════════════════"
echo ""
