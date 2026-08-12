#!/usr/bin/env bash
# Safe side-by-side deploy — does NOT modify app.spdc.in or its nginx config.
set -euo pipefail

APP_DIR="/var/www/sharnam-portal"
APP_USER="sharnam"
REPO="https://github.com/Mustafi2703/sharnam-portal.git"
SHARNAM_PORT="${SHARNAM_PORT:-4001}"

echo "==> Pre-flight: existing apps on this server"
echo "--- nginx sites-enabled ---"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "(nginx not configured yet)"
echo "--- listening ports (node) ---"
ss -tlnp 2>/dev/null | grep -E ':400[0-9] ' || true
echo ""
echo "Sharnam will use port ${SHARNAM_PORT} and domain portal.spdc.in"
echo "app.spdc.in configs will NOT be touched."
echo ""

if ss -tln | grep -q ":${SHARNAM_PORT} "; then
  echo "ERROR: Port ${SHARNAM_PORT} already in use. Set SHARNAM_PORT=4002 and retry."
  exit 1
fi

echo "==> Bootstrap (skip if already installed)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y curl git build-essential
# nginx may already serve app.spdc.in — install only if missing
if ! command -v nginx >/dev/null; then
  apt-get install -y nginx
fi

if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
fi

if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null; then
  npm install -g pm2
fi

mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$(dirname "$APP_DIR")"

echo "==> Clone / update repo"
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
else
  sudo -u "$APP_USER" git clone "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"
sudo -u "$APP_USER" mkdir -p data uploads

if [ ! -f "$APP_DIR/.env" ]; then
  sudo -u "$APP_USER" cp .env.hostinger.example .env
fi

# Ensure port + origin in .env
grep -q '^PORT=' "$APP_DIR/.env" && sed -i "s/^PORT=.*/PORT=${SHARNAM_PORT}/" "$APP_DIR/.env" || echo "PORT=${SHARNAM_PORT}" >> "$APP_DIR/.env"
grep -q '^WEB_ORIGIN=' "$APP_DIR/.env" || echo "WEB_ORIGIN=https://portal.spdc.in" >> "$APP_DIR/.env"

echo "==> Install + build"
sudo -u "$APP_USER" npm install
sudo -u "$APP_USER" npm run build

echo "==> Database + seed (first run)"
sudo -u "$APP_USER" npx prisma generate
sudo -u "$APP_USER" npx prisma db push
if [ ! -f "$APP_DIR/data/prod.db" ] || [ "${FORCE_SEED:-0}" = "1" ]; then
  sudo -u "$APP_USER" npx tsx seed/seed.ts
fi
grep -q '^SKIP_SEED=1' "$APP_DIR/.env" 2>/dev/null || echo "SKIP_SEED=1" >> "$APP_DIR/.env"

echo "==> PM2 (process name: sharnam-portal only)"
sudo -u "$APP_USER" env PORT="${SHARNAM_PORT}" pm2 delete sharnam-portal 2>/dev/null || true
sudo -u "$APP_USER" env PORT="${SHARNAM_PORT}" pm2 start ecosystem.config.cjs --update-env
sudo -u "$APP_USER" pm2 save

echo "==> Nginx — add sharnam-portal site ONLY (never edit app.spdc.in)"
if [ ! -f /etc/nginx/sites-available/sharnam-portal ]; then
  cp deploy/nginx-sharnam.conf /etc/nginx/sites-available/sharnam-portal
  # Update proxy port if non-default
  sed -i "s/127.0.0.1:4001/127.0.0.1:${SHARNAM_PORT}/" /etc/nginx/sites-available/sharnam-portal
  ln -sf /etc/nginx/sites-available/sharnam-portal /etc/nginx/sites-enabled/sharnam-portal
fi
# DO NOT remove default or other sites — app.spdc.in may depend on them

nginx -t && systemctl reload nginx

echo ""
echo "==> Deploy complete (app.spdc.in untouched)"
echo "  Sharnam URL:  https://portal.spdc.in/login  (after DNS + certbot)"
echo "  Health:       curl http://127.0.0.1:${SHARNAM_PORT}/api/health"
echo "  PM2:          sudo -u sharnam pm2 status"
echo ""
echo "Next:"
echo "  1. DNS: portal.spdc.in → this server IP (A record) — separate from app.spdc.in"
echo "  2. nano $APP_DIR/.env  → Azure secrets if not set"
echo "  3. certbot --nginx -d portal.spdc.in"
echo "  4. Verify app.spdc.in still works"
