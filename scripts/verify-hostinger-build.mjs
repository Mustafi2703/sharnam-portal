/**
 * Fail fast if Hostinger build did not produce runtime artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const required = [
  "apps/web/dist/index.html",
  "apps/api/dist/index.js",
  "packages/shared/dist/index.js",
];

const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)));
if (missing.length) {
  console.error("HOSTINGER BUILD INCOMPLETE — missing:");
  for (const f of missing) console.error("  -", f);
  console.error("Build command must be: npm run hostinger:build");
  console.error("Expected git commit with MySQL + compiled API (0cbc434 or newer).");
  process.exit(1);
}

console.log("HOSTINGER BUILD OK — web + api + shared artifacts present");
