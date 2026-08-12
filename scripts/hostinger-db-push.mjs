/**
 * MySQL migrate + seed at BUILD time only (Hostinger runtime cannot run tsx/esbuild).
 * Uses npx — available during Hostinger build with full PATH.
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

try {
  execSync("npx prisma db push --skip-generate", {
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

if (process.env.RUN_SEED === "1") {
  console.log("==> RUN_SEED=1 — seeding demo data at build time...");
  try {
    execSync("npx tsx seed/seed.ts", {
      stdio: "inherit",
      env: process.env,
      cwd: rootDir,
      timeout: 600_000,
    });
    console.log("==> Seed complete. Remove RUN_SEED=1 after verifying login.");
  } catch {
    console.error("FATAL: seed failed during build");
    process.exit(1);
  }
} else {
  console.log("==> Skipping seed (set RUN_SEED=1 for first deploy demo users)");
}

process.exit(0);
