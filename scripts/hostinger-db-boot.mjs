/**
 * Run prisma db push (+ optional seed) at app startup — not during Hostinger build.
 * Build containers often cannot reach MySQL; runtime can.
 */
import { execSync } from "node:child_process";
import { resolveDatabaseUrl, maskDatabaseUrl } from "./resolve-database-url.mjs";

const url = resolveDatabaseUrl();
if (!url.startsWith("mysql://")) {
  console.error("FATAL: MySQL not configured.");
  console.error("  Set DATABASE_URL=mysql://user:pass@localhost:3306/dbname");
  console.error("  OR set MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_HOST=localhost");
  process.exit(1);
}

process.env.DATABASE_URL = url;
console.log("==> DB boot:", maskDatabaseUrl(url));

try {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit", env: process.env });
} catch {
  console.error("FATAL: prisma db push failed — check MYSQL_USER / MYSQL_PASSWORD in Environment variables");
  process.exit(1);
}

if (process.env.RUN_SEED === "1") {
  console.log("==> RUN_SEED=1 — seeding demo data...");
  try {
    execSync("npx tsx seed/seed.ts", { stdio: "inherit", env: process.env });
    console.log("==> Seed complete. Remove RUN_SEED=1 before next redeploy.");
  } catch {
    console.error("FATAL: seed failed");
    process.exit(1);
  }
} else {
  console.log("==> Skipping seed (set RUN_SEED=1 once for first deploy demo data)");
}
