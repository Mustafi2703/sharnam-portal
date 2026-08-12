#!/usr/bin/env bash
# Deploy Sharnam portal to Hostinger VPS from your Mac.
# Safe alongside app.spdc.in — uses portal.spdc.in on port 4001.
# Usage: ./scripts/deploy-to-hostinger.sh root@YOUR_VPS_IP [portal.spdc.in]
set -euo pipefail

TARGET="${1:-}"
DOMAIN="${2:-portal.spdc.in}"
SHARNAM_PORT="${SHARNAM_PORT:-4001}"

if [ -z "$TARGET" ]; then
  echo "Usage: ./scripts/deploy-to-hostinger.sh root@VPS_IP [portal.domain.com]"
  exit 1
fi

KEY="${HOSTINGER_SSH_KEY:-$HOME/.ssh/hostinger_sharnam}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new"
SCP="scp -i $KEY -o StrictHostKeyChecking=accept-new"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Testing SSH to $TARGET"
$SSH "$TARGET" "echo OK && uname -a"

echo "==> Upload deploy script"
$SCP "$ROOT/scripts/remote-deploy.sh" "$TARGET:/root/remote-deploy.sh"

echo "==> Run remote bootstrap + deploy (port ${SHARNAM_PORT}, will not touch app.spdc.in)"
$SSH "$TARGET" "chmod +x /root/remote-deploy.sh && SHARNAM_PORT=${SHARNAM_PORT} bash /root/remote-deploy.sh"

if [ -f "$ROOT/.env" ]; then
  echo "==> Upload local .env (Azure + secrets)"
  $SSH "$TARGET" "mkdir -p /var/www/sharnam-portal && chown sharnam:sharnam /var/www/sharnam-portal"
  $SCP "$ROOT/.env" "$TARGET:/var/www/sharnam-portal/.env"
  $SSH "$TARGET" "chown sharnam:sharnam /var/www/sharnam-portal/.env"
else
  echo "WARN: No local .env — edit /var/www/sharnam-portal/.env on server"
fi

if [ -n "$DOMAIN" ]; then
  echo "==> Set WEB_ORIGIN + nginx server_name for $DOMAIN"
  $SSH "$TARGET" "sed -i 's|^WEB_ORIGIN=.*|WEB_ORIGIN=https://${DOMAIN}|' /var/www/sharnam-portal/.env || echo WEB_ORIGIN=https://${DOMAIN} >> /var/www/sharnam-portal/.env"
  $SSH "$TARGET" "sed -i 's/server_name .*/server_name ${DOMAIN};/' /etc/nginx/sites-available/sharnam-portal && nginx -t && systemctl reload nginx"
  echo "Run on server: certbot --nginx -d ${DOMAIN}"
fi

echo "==> Rebuild + restart"
$SSH "$TARGET" "cd /var/www/sharnam-portal && sudo -u sharnam npm run build && sudo -u sharnam pm2 restart sharnam-portal"

echo "==> Health check (Sharnam on :${SHARNAM_PORT})"
$SSH "$TARGET" "curl -sS http://127.0.0.1:${SHARNAM_PORT}/api/health | head -c 500" || true

echo ""
echo "Done."
echo "  Sharnam:      https://${DOMAIN}/login  (after DNS A record + certbot)"
echo "  Existing app: https://app.spdc.in       (should be unchanged)"
