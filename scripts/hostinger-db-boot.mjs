/**
 * Create tables + seed via direct node binaries (npx fails on Hostinger runtime).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { maskDatabaseUrl, resolveDatabaseUrl } from "./resolve-database-url.mjs";

function buildUrl(host) {
  const user = process.env.MYSQL_USER?.trim();
  const password = process.env.MYSQL_PASSWORD?.trim();
  const database = process.env.MYSQL_DATABASE?.trim();
  const port = process.env.MYSQL_PORT?.trim() || "3306";
  if (!user || !password || !database) return "";
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function runCmd(label, cmd, cwd, env) {
  try {
    const out = execSync(cmd, {
      encoding: "utf8",
      env,
      cwd,
      timeout: 300_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (out?.trim()) console.log(out.trim());
    return true;
  } catch (err) {
    console.error(`==> ${label} failed:`);
    if (err.stdout?.trim()) console.error(err.stdout.trim());
    if (err.stderr?.trim()) console.error(err.stderr.trim());
    console.error(err.message || err);
    return false;
  }
}

export async function runDbBoot(rootDir = process.cwd()) {
  const configured = resolveDatabaseUrl();
  if (!configured.startsWith("mysql://") && !process.env.MYSQL_USER) {
    console.error("WARN: MySQL not configured — login will fail.");
    return false;
  }

  const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
  const tsxCli = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");
  if (!fs.existsSync(prismaCli)) {
    console.error("FATAL: missing", prismaCli);
    return false;
  }

  const hosts = [
    process.env.MYSQL_HOST?.trim(),
    "localhost",
    "127.0.0.1",
    process.env.MYSQL_HOST_ALT?.trim(),
    "srv1398.hstgr.io",
  ].filter(Boolean);
  const uniqueHosts = [...new Set(hosts)];

  let connected = false;
  for (const host of uniqueHosts) {
    const url = buildUrl(host) || configured.replace(/@[^/]+\//, `@${host}/`);
    if (!url.startsWith("mysql://")) continue;

    process.env.DATABASE_URL = url;
    console.log("==> DB boot try:", maskDatabaseUrl(url));

    const ok = runCmd(
      "prisma db push",
      `node "${prismaCli}" db push --skip-generate`,
      rootDir,
      process.env,
    );
    if (ok) {
      connected = true;
      console.log("==> DB schema ready via", host);
      break;
    }
  }

  if (!connected) {
    console.error("WARN: prisma db push failed on all hosts");
    return false;
  }

  if (process.env.RUN_SEED === "1") {
    console.log("==> RUN_SEED=1 — seeding demo data...");
    const seedCmd = fs.existsSync(tsxCli)
      ? `node "${tsxCli}" seed/seed.ts`
      : `node --import tsx seed/seed.ts`;
    const seeded = runCmd("seed", seedCmd, rootDir, process.env);
    if (seeded) {
      console.log("==> Seed complete. Remove RUN_SEED=1 before next redeploy.");
    } else {
      return false;
    }
  } else {
    console.log("==> Skipping seed (set RUN_SEED=1 once for demo logins)");
  }

  return true;
}
