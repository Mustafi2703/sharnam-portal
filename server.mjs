/**
 * Hostinger entry — must listen on PORT in this process (no child spawn / tsx loader).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
process.chdir(rootDir);

for (const dir of ["data", "uploads"]) {
  fs.mkdirSync(path.join(rootDir, dir), { recursive: true });
}

console.log("==> Sharnam portal boot");
console.log("    cwd:", rootDir);
console.log("    PORT:", process.env.PORT || "(Hostinger injects this)");
console.log("    NODE:", process.version);
console.log("    DATABASE:", process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@") || "(not set)");

const webIndex = path.join(rootDir, "apps", "web", "dist", "index.html");
if (!fs.existsSync(webIndex)) {
  console.error("ERROR: Missing apps/web/dist — run hostinger:build first");
  process.exit(1);
}

const apiEntry = path.join(rootDir, "apps", "api", "dist", "index.js");
if (!fs.existsSync(apiEntry)) {
  console.error("ERROR: Missing apps/api/dist — run hostinger:build first");
  process.exit(1);
}

await import("./apps/api/dist/index.js");
