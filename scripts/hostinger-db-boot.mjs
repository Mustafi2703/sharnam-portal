/**
 * Run prisma db push (+ optional seed) after the HTTP server is listening.
 */
import { execSync } from "node:child_process";
import { applyDatabaseUrl, maskDatabaseUrl, resolveDatabaseUrl } from "./resolve-database-url.mjs";

function buildUrl(host) {
  const user = process.env.MYSQL_USER?.trim();
  const password = process.env.MYSQL_PASSWORD?.trim();
  const database = process.env.MYSQL_DATABASE?.trim();
  const port = process.env.MYSQL_PORT?.trim() || "3306";
  if (!user || !password || !database) return "";
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export async function runDbBoot() {
  const configured = resolveDatabaseUrl();
  if (!configured.startsWith("mysql://") && !process.env.MYSQL_USER) {
    console.error("WARN: MySQL not configured — login will fail.");
    console.error("  Delete DATABASE_URL=file:... and set MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_HOST");
    return false;
  }

  const hosts = [
    process.env.MYSQL_HOST?.trim(),
    "localhost",
    "127.0.0.1",
    process.env.MYSQL_HOST_ALT?.trim(),
  ].filter(Boolean);
  const uniqueHosts = [...new Set(hosts)];

  let connected = false;
  for (const host of uniqueHosts) {
    const url = buildUrl(host) || configured.replace(/@[^/]+\//, `@${host}/`);
    if (!url.startsWith("mysql://")) continue;

    process.env.DATABASE_URL = url;
    console.log("==> DB boot try:", maskDatabaseUrl(url));

    try {
      execSync("npx prisma db push --skip-generate", {
        stdio: "inherit",
        env: process.env,
        timeout: 120_000,
      });
      connected = true;
      console.log("==> DB connected via", host);
      break;
    } catch {
      console.warn("==> DB failed on host:", host);
    }
  }

  if (!connected) {
    console.error("WARN: prisma db push failed on all hosts — check MYSQL_USER / MYSQL_PASSWORD");
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
    console.log("==> Skipping seed (set RUN_SEED=1 once for demo logins)");
  }

  return true;
}
