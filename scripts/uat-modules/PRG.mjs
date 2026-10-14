#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const run = path.join(path.dirname(fileURLToPath(import.meta.url)), "run.mjs");
const code = path.basename(fileURLToPath(import.meta.url), ".mjs");
spawn(process.execPath, [run, code], { stdio: "inherit" }).on("close", (c) => process.exit(c ?? 1));
