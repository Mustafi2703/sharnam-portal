#!/usr/bin/env bash
# One-time Hostinger VPS bootstrap (Ubuntu 22/24). Run as root or with sudo.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/sharnam-portal}"
APP_USER="${APP_USER:-sharnam}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> Installing system packages"
apt-get update -qq
apt-get install -y curl git nginx certbot python3-certbot-nginx build-essential

if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
fi

echo "==> Installing Node.js ${NODE_MAJOR}"
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
apt-get install -y nodejs

echo "==> Installing PM2"
npm install -g pm2

mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo ""
echo "Next steps (as $APP_USER):"
echo "  1. Clone repo into $APP_DIR"
echo "  2. cp .env.hostinger.example .env  → fill secrets"
echo "  3. npm install && npm run build"
echo "  4. RUN_SEED=1 bash scripts/start-production.sh   # first time only"
echo "  5. pm2 start ecosystem.config.cjs && pm2 save"
echo "  6. Copy deploy/nginx-sharnam.conf → /etc/nginx/sites-available/sharnam-portal"
echo "  7. certbot --nginx -d your.domain.com"
echo ""
echo "See DEPLOY_HOSTINGER.md for full checklist."
