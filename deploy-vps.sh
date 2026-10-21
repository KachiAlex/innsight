#!/usr/bin/env bash
# InnSight PMS — deploy to VPS (67.211.210.8) via SSH + Docker Compose.
# Usage: bash deploy-vps.sh
set -euo pipefail

VPS_HOST="${VPS_HOST:-67.211.210.8}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/innsight_vps}"
REMOTE_DIR="/opt/innsight"
ARCHIVE="/tmp/innsight-deploy.tar.gz"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📦 Packaging repository..."
tar czf "$ARCHIVE" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.env' \
  --exclude='backend/uploads' \
  --exclude='backend/rooms-export' \
  -C "$ROOT_DIR" .

echo "⬆️  Uploading to ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR} ..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" "mkdir -p ${REMOTE_DIR} /tmp/innsight-extract && rm -rf /tmp/innsight-extract/*"
scp -i "$SSH_KEY" "$ARCHIVE" "${VPS_USER}@${VPS_HOST}:${ARCHIVE}"
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "cd /tmp/innsight-extract && tar xzf ${ARCHIVE} && rm -f ${ARCHIVE} && \
   rsync -a --delete --exclude='.env' --exclude='backend/uploads' /tmp/innsight-extract/ ${REMOTE_DIR}/ && \
   rm -rf /tmp/innsight-extract/*"

echo "🔐 Ensuring .env exists on server..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" bash -s <<'EOF'
cd /opt/innsight
if [ ! -f .env ]; then
  {
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
    echo "CORS_ORIGIN=http://67.211.210.8:3061"
    echo "PUBLIC_PORTAL_BASE_URL=http://67.211.210.8:3061"
  } > .env
  chmod 600 .env
  echo "Generated new .env"
else
  echo ".env already exists, keeping it"
fi
EOF

echo "🐳 Building and starting containers..."
ssh -i "$SSH_KEY" "${VPS_USER}@${VPS_HOST}" \
  "cd ${REMOTE_DIR} && docker compose up -d --build --remove-orphans"

echo "✅ Deploy complete."
echo "   Frontend: http://${VPS_HOST}:3061"
echo "   API health: http://${VPS_HOST}:3061/api/health"
