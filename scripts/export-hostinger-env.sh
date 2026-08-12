#!/usr/bin/env bash
# Prints Hostinger env vars from local .env for manual copy-paste in hPanel.
# Usage: bash scripts/export-hostinger-env.sh
# Output also saved to ./hostinger-env-paste.txt (delete after use)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env — copy from .env.hostinger.example first"
  exit 1
fi

OUT="hostinger-env-paste.txt"
{
  echo "# Paste each KEY and VALUE in Hostinger → Environment variables → Add"
  echo "# DELETE this file after copying — contains secrets"
  echo ""
  grep -v '^#' .env | grep -v '^$' | while IFS= read -r line; do
    key="${line%%=*}"
    val="${line#*=}"
    # Skip PORT — Hostinger sets automatically
    if [ "$key" = "PORT" ]; then continue; fi
    echo "KEY:   $key"
    echo "VALUE: $val"
    echo "---"
  done
} | tee "$OUT"

echo ""
echo "Saved to $OUT — open in Cursor, copy each pair into Hostinger Add dialog"
echo "Delete $OUT when done."
