/**
 * Hostinger entry — DB migrate/seed runs at BUILD time only (see hostinger-db-push.mjs).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// SharePoint folder creation used to sit on one request until nginx returned 504 and the tree stopped halfway.
// Keep the Node socket open long enough for a slow Graph retry. The folder job itself also continues after the response.
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function listenWithLongTimeout(...args) {
  const server = listen.apply(this, args);
  server.requestTimeout = 900_000;
  server.headersTimeout = 910_000;
  server.timeout = 0;
  return server;
};
import { applyDatabaseUrl, maskDatabaseUrl } from "./scripts/resolve-database-url.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
process.chdir(rootDir);

process.on("uncaughtException", (err) => {
  console.error("FATAL uncaughtException:", err);
});
function isPrismaFatal(err) {
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  if (name === "PrismaClientKnownRequestError" || name === "PrismaClientValidationError") return false;
  if (/^P20\d{2}$/.test(code)) return false;
  return name.includes("RustPanic") || name.includes("PrismaClientInitializationError") || msg.includes("PANIC:") || msg.includes("timer has gone away");
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
