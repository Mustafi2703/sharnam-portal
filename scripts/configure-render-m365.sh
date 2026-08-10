#!/usr/bin/env bash
# Configure Microsoft 365 / SharePoint env vars on Render (sharnam-portal).
# Usage:
#   export RENDER_API_KEY=rnd_...   # or rely on ~/.render/cli.yaml after `render login`
#   source .env.render.local         # AZURE_* values — never commit this file
#   ./scripts/configure-render-m365.sh
#
# Optional: SERVICE_ID=srv-xxx ./scripts/configure-render-m365.sh

set -euo pipefail

SERVICE_ID="${SERVICE_ID:-srv-d9a6v17aqgkc7396s2a0}"
API_KEY="${RENDER_API_KEY:-}"

if [[ -z "$API_KEY" && -f "$HOME/.render/cli.yaml" ]]; then
  API_KEY=$(grep -E '^\s+key: rnd_' "$HOME/.render/cli.yaml" | head -1 | awk '{print $2}')
fi

if [[ -z "$API_KEY" ]]; then
  echo "Set RENDER_API_KEY or run: render login" >&2
  exit 1
fi

required=(AZURE_TENANT_ID AZURE_CLIENT_ID AZURE_CLIENT_SECRET SHAREPOINT_SITE_URL GRAPH_MAIL_FROM)
for k in "${required[@]}"; do
  if [[ -z "${!k:-}" ]]; then
    echo "Missing $k — create .env.render.local from .env.render.local.example" >&2
    exit 1
  fi
done

put_var() {
  local key="$1" val="$2"
  curl -fsS -X PUT "https://api.render.com/v1/services/${SERVICE_ID}/env-vars/${key}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"value\":\"${val}\"}" >/dev/null
  echo "  ✓ ${key}"
}

echo "Updating Render service ${SERVICE_ID}…"
put_var AZURE_TENANT_ID "$AZURE_TENANT_ID"
put_var AZURE_CLIENT_ID "$AZURE_CLIENT_ID"
put_var AZURE_CLIENT_SECRET "$AZURE_CLIENT_SECRET"
put_var SHAREPOINT_SITE_URL "$SHAREPOINT_SITE_URL"
put_var GRAPH_MAIL_FROM "$GRAPH_MAIL_FROM"
put_var MOCK_ONEDRIVE "${MOCK_ONEDRIVE:-false}"
put_var GRAPH_MAIL_ENABLED "${GRAPH_MAIL_ENABLED:-true}"

echo "Triggering redeploy…"
curl -fsS -X POST "https://api.render.com/v1/services/${SERVICE_ID}/deploys" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}' >/dev/null

echo "Done. Check https://dashboard.render.com/web/${SERVICE_ID}"
