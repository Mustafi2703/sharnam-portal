/**
 * Run prisma db push (+ optional seed) after the HTTP server is listening.
 */
import { execSync } from "node:child_process";
import { resolveDatabaseUrl, maskDatabaseUrl } from "./resolve-database-url.mjs";

export async function runDbBoot() {
  const url = resolveDatabaseUrl();
  if (!url.startsWith("mysql://")) {
    console.error("WARN: MySQL not configured — app will start but login/data will fail.");
    console.error("  Set MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_HOST=localhost");
    return false;
  }

  process.env.DATABASE_URL = url;
  console.log("==> DB boot:", maskDatabaseUrl(url));

  try {
    execSync("npx prisma db push --skip-generate", { stdio: "inherit", env: process.env, timeout: 120_000 });
  } catch (err) {
    console.error("WARN: prisma db push failed — check MYSQL_USER / MYSQL_PASSWORD / MYSQL_HOST");
    console.error(err?.message || err);
    return false;
  }

  if (process.env.RUN_SEED === "1") {
    console.log("==> RUN_SEED=1 — seeding demo data...");
    try {
      execSync("npx tsx seed/seed.ts", { stdio: "inherit", env: process.env, timeout: 300_000 });
      console.log("==> Seed complete. Remove RUN_SEED=1 before next redeploy.");
    } catch (err) {
      console.error("WARN: seed failed:", err?.message || err);
      return false;
    }
  } else {
    console.log("==> Skipping seed (set RUN_SEED=1 once for first deploy demo data)");
  }

  return true;
}
