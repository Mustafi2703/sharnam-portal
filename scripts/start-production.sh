#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p data uploads 2>/dev/null || true

echo "==> Prisma generate + db push"
npx prisma generate
npx prisma db push

if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "==> Seeding database (RUN_SEED=1)"
  npx tsx seed/seed.ts
elif [ "${SKIP_SEED:-0}" = "1" ]; then
  echo "==> Skipping seed (SKIP_SEED=1)"
else
  echo "==> Seeding database (default — set SKIP_SEED=1 after first deploy)"
  npx tsx seed/seed.ts
fi

echo "==> Starting API on port ${PORT:-4000}"
exec npm run start -w @sharnam/api
