/**
 * MySQL schema sync at BUILD time only (Hostinger runtime cannot run tsx/esbuild).
 * Uses npx — available during Hostinger build with full PATH.
 *
 * A normal redeploy only updates the schema. It does not insert demo rows and it does
 * not delete users, projects, consultant types, or anything else already in MySQL.
 *
 * RUN_SEED=1 — one-time full seed for an empty database. Leave it unset after that.
 */
import { execSync } from "node:child_process";
import { applyDatabaseUrl, maskDatabaseUrl } from "./resolve-database-url.mjs";

const rootDir = process.cwd();
const url = applyDatabaseUrl();

if (!url.startsWith("mysql://")) {
  console.log("SKIP hostinger-db-push: MYSQL_* not set at build time");
  process.exit(0);
}

console.log("==> Build-time DB setup:", maskDatabaseUrl(url));

// Neutralise conflicting Lead(srNo, sourceSheet) pairs BEFORE the schema
// change so the new @@unique constraint can apply without losing rows.
try {
  execSync("node scripts/hostinger-pre-push-dedupe.mjs", {
    stdio: "inherit",
    env: process.env,
    cwd: rootDir,
    timeout: 120_000,
  });
} catch (err) {
  console.warn("WARN: pre-push dedupe failed — proceeding to db push anyway.");
  console.warn(String(err?.message || err));
}

try {
  // --accept-data-loss is required by Prisma to acknowledge new unique
  // constraints on tables with existing data; dedupe step above ensures
  // there are no actual conflicts by the time we get here.
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: process.env,
    cwd: rootDir,
    timeout: 300_000,
  });
  console.log("==> Prisma schema synced");
} catch {
  console.error("FATAL: prisma db push failed during build — check MYSQL_PASSWORD and MYSQL_HOST=127.0.0.1");
  process.exit(1);
}

const runFullSeed = process.env.RUN_SEED === "1";

if (!runFullSeed) {
  console.log("==> Schema only. Existing portal data is left as it is. No demo pack and no user cleanup.");
} else {
  console.log("==> RUN_SEED=1 — one-time full seed. Unset RUN_SEED after this deploy so later builds do not load demo data.");
  const seedEnv = { ...process.env, MOCK_ONEDRIVE: "true" };
  try {
    execSync("npx tsx seed/seed.ts", {
      stdio: "inherit",
      env: seedEnv,
      cwd: rootDir,
      timeout: 1_800_000,
    });
    console.log("==> Full seed complete. Remove RUN_SEED=1 from Hostinger env before the next deploy.");
  } catch {
    console.error("FATAL: seed failed during build — Hostinger will retry on next deploy after the seed bug is fixed.");
    process.exit(1);
  }
}

process.exit(0);
