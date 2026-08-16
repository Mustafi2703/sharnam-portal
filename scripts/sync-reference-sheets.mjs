#!/usr/bin/env node
/**
 * Sync client Excel reference packs into seed/data (git-tracked demo) and docs/reference-sheets (local mirror).
 *
 * Usage:
 *   node scripts/sync-reference-sheets.mjs
 *   SHARNAM_EXCEL_ROOT=/path/to/Sharnam_modules_docs node scripts/sync-reference-sheets.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SOURCE =
  process.env.SHARNAM_EXCEL_ROOT ||
  path.join(process.env.HOME || "", "Downloads", "Sharnam_modules_docs");

const TARGETS = [
  path.join(root, "seed", "data"),
  path.join(root, "docs", "reference-sheets"),
];

/** Canonical filenames used by seed/* and module dashboards */
const FILES = [
  "Final Index.xlsx",
  "Drwing check master checklist.xlt.xls",
  "SPDC_Budget_Arvind 49.xls",
  "Quality Dashboard.xlsx",
  "Safety Dashboard.xlsx",
  "Safety NCR.xlsx",
  "Comparative Statement - R2.xlsx",
  "NCR 01 .xlsx",
  "DRAWING REGISTER - 01.xlsx",
  "Snaglist - Sharnam PMC.xlsx",
  "Lessons Learnt - Sharnam PMC.xls",
  "Project Closure Report.docx",
  "HInderance Register Dashboard.xlsx",
  "Legal Approvals - Dashboard.xlsx",
  "Milestone tracking.xlsx",
  "Monthly Progress Dashboard.xlsx",
  "Progress Overview.xlsx",
  "Quality Assurance Plan Week 50.xlsx",
  "Risk Register - Dashboard 1.xlsx",
  "SPDC CUBE REGISTER (1).xlsx",
  "Payment Summary - VIATRIX - Copy.xlsx",
  "Planned Vs. Actual Dashboard.xlsx",
  "Cashflow - Dashboard.xlsx",
  "Approval  &  GFC Drawing Log.xlsx",
  "Communication Matrix_BPCL (1).xlsx",
  "DPR-Sharnam PMC- ARVIND LIMITED (3).xlsx",
  "WPR File.xlsx",
];

if (!fs.existsSync(SOURCE)) {
  console.error(`Source folder not found: ${SOURCE}`);
  console.error("Set SHARNAM_EXCEL_ROOT to your Sharnam_modules_docs path.");
  process.exit(1);
}

for (const dir of TARGETS) fs.mkdirSync(dir, { recursive: true });

let copied = 0;
let missing = 0;
for (const name of FILES) {
  const src = path.join(SOURCE, name);
  if (!fs.existsSync(src)) {
    console.warn("missing source:", name);
    missing++;
    continue;
  }
  for (const dir of TARGETS) {
    fs.copyFileSync(src, path.join(dir, name));
  }
  copied++;
  console.log("synced:", name);
}

console.log(`Done — ${copied} files copied to seed/data + docs/reference-sheets (${missing} missing from source).`);
