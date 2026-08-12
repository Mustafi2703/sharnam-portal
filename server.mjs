/**
 * Hostinger entry — listen on PORT first, then connect MySQL (avoids 503 while DB is misconfigured).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDatabaseUrl, maskDatabaseUrl } from "./scripts/resolve-database-url.mjs";
import { runDbBoot } from "./scripts/hostinger-db-boot.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
process.chdir(rootDir);

process.on("uncaughtException", (err) => {
  console.error("FATAL uncaughtException:", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("FATAL unhandledRejection:", err);
  process.exit(1);
});

for (const dir of ["data", "uploads"]) {
  fs.mkdirSync(path.join(rootDir, dir), { recursive: true });
}

const dbUrl = resolveDatabaseUrl();
if (dbUrl.startsWith("mysql://")) {
  process.env.DATABASE_URL = dbUrl;
}

console.log("==> Sharnam portal boot");
console.log("    cwd:", rootDir);
console.log("    PORT:", process.env.PORT || "(Hostinger injects this — if empty, app will not receive traffic)");
console.log("    NODE:", process.version);
console.log(
  "    DATABASE:",
  dbUrl ? maskDatabaseUrl(dbUrl) : "NOT SET — add MYSQL_* env vars",
);
if (process.env.MYSQL_USER) {
  console.log("    MYSQL_USER:", process.env.MYSQL_USER);
}

const webIndex = path.join(rootDir, "apps", "web", "dist", "index.html");
const apiEntry = path.join(rootDir, "apps", "api", "dist", "index.js");

if (!fs.existsSync(webIndex)) {
  console.error("FATAL: Missing apps/web/dist/index.html — build did not run vite");
  process.exit(1);
}
if (!fs.existsSync(apiEntry)) {
  console.error("FATAL: Missing apps/api/dist/index.js — build must run: npm run hostinger:build");
  process.exit(1);
}

if (!process.env.JWT_SECRET?.trim()) {
  console.warn("WARN: JWT_SECRET is not set — auth will fail");
}

try {
  await import("./apps/api/dist/index.js");
} catch (err) {
  console.error("FATAL: API failed to start:", err);
  process.exit(1);
}

void runDbBoot();
