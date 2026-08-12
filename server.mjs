/**
 * Hostinger Node.js Web App entry point — start Express API only.
 * DB migrate + seed run at BUILD time (hostinger:build), not here.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);

for (const dir of ["data", "uploads"]) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
}

const port = process.env.PORT || "4000";
console.log("==> Sharnam portal starting");
console.log("    cwd:", root);
console.log("    PORT:", port);
console.log("    NODE:", process.version);

const entry = path.join(root, "apps", "api", "src", "index.ts");
if (!fs.existsSync(entry)) {
  console.error("Missing API entry:", entry);
  process.exit(1);
}

const webDist = path.join(root, "apps", "web", "dist", "index.html");
if (!fs.existsSync(webDist)) {
  console.warn("WARN: Web UI not built at apps/web/dist — run hostinger:build");
}

const child = spawn("npx", ["tsx", entry], {
  stdio: "inherit",
  env: { ...process.env, HOST: "0.0.0.0" },
  cwd: root,
  shell: true,
});

child.on("exit", (code) => {
  console.error("API process exited with code", code);
  process.exit(code ?? 1);
});

process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
