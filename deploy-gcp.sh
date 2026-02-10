#!/bin/bash
# =============================================================
# GCP Compute Engine Deployment Script
# Voice AI Dashboard (Backend + Frontend)
#
# NOTE: ML services (STT/TTS) are deployed from your other project.
#       This script only deploys the dashboard.
#
# Usage:
#   1. Install gcloud CLI: https://cloud.google.com/sdk/docs/install
#   2. Run: gcloud auth login
#   3. Run: gcloud config set project YOUR_PROJECT_ID
#   4. Run: bash deploy-gcp.sh
# =============================================================

set -e

# ─── Configuration ───────────────────────────────────────────
PROJECT_ID=$(gcloud config get-value project)
ZONE="asia-south1-a"                    # Mumbai (closest to India)
INSTANCE_NAME="voice-ai-dashboard"
MACHINE_TYPE="e2-standard-2"            # 2 vCPU, 8GB RAM (enough for dashboard)
DISK_SIZE="50"                          # GB
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"

echo "============================================="
echo "  GCP Deployment: Voice AI Dashboard"
echo "  Project: $PROJECT_ID"
echo "  Zone: $ZONE"
echo "  Machine: $MACHINE_TYPE (2 vCPU, 8GB RAM)"
echo "============================================="

# ─── Step 1: Create Firewall Rules ──────────────────────────
echo ""
echo "[1/4] Creating firewall rules..."

gcloud compute firewall-rules create allow-voice-ai-http \
    --allow tcp:80,tcp:443,tcp:3000 \
    --target-tags voice-ai-server \
    --description "Allow HTTP/HTTPS/API traffic" \
    --quiet 2>/dev/null || echo "  Firewall rule already exists, skipping."

# ─── Step 2: Create VM Instance ─────────────────────────────
echo ""
echo "[2/4] Creating Compute Engine VM..."

gcloud compute instances create $INSTANCE_NAME \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --boot-disk-size=${DISK_SIZE}GB \
    --boot-disk-type=pd-ssd \
    --image-family=$IMAGE_FAMILY \
    --image-project=$IMAGE_PROJECT \
    --tags=voice-ai-server \
    --metadata=startup-script='#!/bin/bash
apt-get update && apt-get upgrade -y
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
apt-get install -y git
mkdir -p /opt/voice-ai
echo "VM setup complete."
' \
    --quiet

echo "  VM created successfully."

# ─── Step 3: Wait for VM to be ready ────────────────────────
echo ""
echo "[3/4] Waiting for VM to be ready..."
sleep 30

for i in {1..12}; do
    if gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="echo ready" --quiet 2>/dev/null; then
        echo "  VM is ready."
        break
    fi
    echo "  Waiting... ($i/12)"
    sleep 10
done

# ─── Step 4: Get VM IP ──────────────────────────────────────
echo ""
echo "[4/4] Getting VM details..."

EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME \
    --zone=$ZONE \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "============================================="
echo "  VM CREATED SUCCESSFULLY"
echo "============================================="
echo ""
echo "  External IP: $EXTERNAL_IP"
echo "  SSH: gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo ""
echo "============================================="
echo "  NEXT STEPS"
echo "============================================="
echo ""
echo "  1. SSH into the VM:"
echo "     gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo ""
echo "  2. Clone your repo:"
echo "     cd /opt/voice-ai && git clone <YOUR_REPO_URL> ."
echo ""
echo "  3. Configure env:"
echo "     cp .env.production .env"
echo "     nano .env   # fill in your secrets"
echo ""
echo "  4. Set ML service URLs in .env:"
echo "     # If ML services on same VM:"
echo "     STT_SERVICE_URL=http://localhost:8002"
echo "     TTS_SERVICE_URL=http://localhost:8001"
echo ""
echo "     # If ML services on separate VM:"
echo "     STT_SERVICE_URL=http://<ML_VM_IP>:8002"
echo "     TTS_SERVICE_URL=http://<ML_VM_IP>:8001"
echo ""
echo "  5. Start dashboard:"
echo "     docker-compose up -d --build"
echo ""
echo "  6. Health checks:"
echo "     curl http://$EXTERNAL_IP:3000/health"
echo "     curl http://$EXTERNAL_IP/api/stt/health"
echo "     curl http://$EXTERNAL_IP/api/tts/health"
echo ""
echo "  7. Access dashboard:"
echo "     http://$EXTERNAL_IP"
echo ""
echo "============================================="
echo "  COST: ~\$50/month (e2-standard-2, Mumbai)"
echo "============================================="
