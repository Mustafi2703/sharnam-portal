/**
 * Hostinger entry — DB migrate/seed runs at BUILD time only (see hostinger-db-push.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyDatabaseUrl, maskDatabaseUrl } from "./scripts/resolve-database-url.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
process.chdir(rootDir);

process.on("uncaughtException", (err) => {
  console.error("FATAL uncaughtException:", err);
});
function isPrismaFatal(err) {
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return name.includes("PrismaClient") || msg.includes("PANIC:") || msg.includes("timer has gone away");
}

process.on("unhandledRejection", (err) => {
  console.error("ERROR unhandledRejection:", err);
  if (isPrismaFatal(err)) {
    console.error("FATAL: Prisma engine panic — exiting for clean Hostinger restart");
    setTimeout(() => process.exit(1), 150);
  }
});

for (const dir of ["data", "uploads"]) {
  fs.mkdirSync(path.join(rootDir, dir), { recursive: true });
}

const dbUrl = applyDatabaseUrl();

console.log("==> Sharnam portal boot");
console.log("    cwd:", rootDir);
console.log("    PORT:", process.env.PORT || "4000");
console.log("    NODE:", process.version);
console.log("    DATABASE:", dbUrl ? maskDatabaseUrl(dbUrl) : "NOT SET — add MYSQL_* env vars");
if (process.env.MYSQL_USER) console.log("    MYSQL_USER:", process.env.MYSQL_USER);

const webIndex = path.join(rootDir, "apps", "web", "dist", "index.html");
const apiEntry = path.join(rootDir, "apps", "api", "dist", "index.js");

if (!fs.existsSync(webIndex)) {
  console.error("FATAL: Missing apps/web/dist/index.html");
  process.exit(1);
}
if (!fs.existsSync(apiEntry)) {
  console.error("FATAL: Missing apps/api/dist/index.js");
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
