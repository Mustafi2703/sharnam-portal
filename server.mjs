/**
 * Hostinger Node.js Web App entry point.
 * Runs DB migrate then starts the Express + React API (tsx).
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
process.chdir(root);

for (const dir of ["data", "uploads"]) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
}

function run(cmd, args) {
  execSync([cmd, ...args].join(" "), { stdio: "inherit", env: process.env });
}

console.log("==> Sharnam portal starting on Hostinger");
console.log("    PORT:", process.env.PORT || "4000");
console.log("    NODE:", process.version);

try {
  run("npx", ["prisma", "generate"]);
  run("npx", ["prisma", "db", "push"]);
  if (process.env.RUN_SEED === "1") {
    console.log("==> Seeding demo data (RUN_SEED=1)");
    run("npx", ["tsx", "seed/seed.ts"]);
  } else if (process.env.SKIP_SEED !== "1") {
    console.log("==> Tip: set RUN_SEED=1 on first deploy, then SKIP_SEED=1");
  }
} catch (err) {
  console.error("Database setup failed:", err);
  process.exit(1);
}

const tsxBin = path.join(root, "node_modules", ".bin", "tsx");
const entry = path.join(root, "apps", "api", "src", "index.ts");
const child = spawn(tsxBin, [entry], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});

child.on("exit", (code) => process.exit(code ?? 1));
