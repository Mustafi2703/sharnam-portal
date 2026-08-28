/**
 * MySQL migrate + seed at BUILD time only (Hostinger runtime cannot run tsx/esbuild).
 * Uses npx — available during Hostinger build with full PATH.
 *
 * RUN_SEED=1     — full seed once (seed.ts includes demo screenshot pack). Remove after first OK deploy.
 * SKIP_BUILD_SEED=1 — skip all seed (fast redeploy when DB already populated).
 * Otherwise      — lightweight demo pack refresh only (no full seed.ts).
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

/** Local mock only during build — avoids slow/failing SharePoint calls on every DPR discipline. */
const seedEnv = { ...process.env, MOCK_ONEDRIVE: "true" };
const runFullSeed = process.env.RUN_SEED === "1";
const skipAllSeed = process.env.SKIP_BUILD_SEED === "1";

if (skipAllSeed) {
  console.log("==> SKIP_BUILD_SEED=1 — no database seed during this build");
} else if (runFullSeed) {
  console.log("==> RUN_SEED=1 — full seed (users, sheets, DPR week, WPR, pilot week, demo pack)…");
  console.log("    Tip: set RUN_SEED=0 and SKIP_BUILD_SEED=1 on later deploys for faster builds.");
  try {
    execSync("npx tsx seed/seed.ts", {
      stdio: "inherit",
      env: seedEnv,
      cwd: rootDir,
      timeout: 1_800_000,
    });
    console.log("==> Full seed complete. Remove RUN_SEED=1 from Hostinger env after verifying login.");
  } catch {
    console.error("FATAL: seed failed during build — Hostinger will retry on next deploy after the seed bug is fixed.");
    process.exit(1);
  }
} else {
  console.log("==> Incremental demo refresh (set RUN_SEED=1 once for empty DB)…");
  try {
    console.log("==> Demo screenshot pack (quality, safety, drawing register, DPR/WPR week)…");
    execSync("npx tsx seed/demoScreenshotsPack.ts", {
      stdio: "inherit",
      env: seedEnv,
      cwd: rootDir,
      timeout: 900_000,
    });
  } catch {
    console.warn("WARN: Demo screenshot pack skipped (non-fatal — run npm run db:seed-demo-screenshots)");
  }

  try {
    console.log("==> BBS demo bend diagrams (idempotent)…");
    execSync("npx tsx seed/runBbsDemoShapes.ts", {
      stdio: "inherit",
      env: seedEnv,
      cwd: rootDir,
      timeout: 120_000,
    });
  } catch {
    console.warn("WARN: BBS demo shapes skipped (non-fatal)");
  }
}

process.exit(0);
