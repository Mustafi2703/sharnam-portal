#!/usr/bin/env bash
# Generate Hostinger env files from local .env
# Usage: bash scripts/export-hostinger-env.sh
#
# hostinger-env-import.env  → hPanel "Import .env" (KEY=value format)
# hostinger-env-paste.txt    → manual one-by-one Add (KEY:/VALUE: format)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env — copy from .env.hostinger.example first"
  exit 1
fi

IMPORT="hostinger-env-import.env"
PASTE="hostinger-env-paste.txt"

{
  echo "# Hostinger → Import .env — generated $(date -u +%Y-%m-%dT%H:%MZ)"
  echo "# DELETE after import — contains secrets"
  echo ""
  grep -v '^#' .env | grep -v '^$' | while IFS= read -r line; do
    key="${line%%=*}"
    val="${line#*=}"
    if [ "$key" = "PORT" ]; then continue; fi
    if [ "$key" = "RUN_SEED" ]; then continue; fi
    if [[ "$val" == *'#'* || "$val" == *' '* || "$val" == *'~'* ]]; then
      echo "${key}=\"${val}\""
    else
      echo "${key}=${val}"
    fi
  done
} > "$IMPORT"

{
  echo "# Manual paste only — hPanel does NOT import this format."
  echo "# For bulk import use: hostinger-env-import.env → Import .env"
  echo "# DELETE after use — contains secrets"
  echo ""
  grep -v '^#' .env | grep -v '^$' | while IFS= read -r line; do
    key="${line%%=*}"
    val="${line#*=}"
    if [ "$key" = "PORT" ]; then continue; fi
    echo "KEY:   $key"
    echo "VALUE: $val"
    echo "---"
  done
} > "$PASTE"

echo "Wrote $IMPORT  → upload in hPanel: Import .env"
echo "Wrote $PASTE   → manual Add dialog only"
echo "Delete both files when done."
