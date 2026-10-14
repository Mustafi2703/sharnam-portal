#!/usr/bin/env node
/**
 * Per-module production UAT runner.
 *
 *   node scripts/uat-modules/run.mjs CRM
 *   node scripts/uat-modules/run.mjs DWG QA SAF
 *   node scripts/uat-modules/run.mjs --all
 *   node scripts/uat-modules/run.mjs --from DWG
 *
 * Each module writes its own evidence folder:
 *   docs/uat-evidence/modules/<date>/<MODULE>/REPORT.md
 * Aggregate index:
 *   docs/uat-evidence/modules/<date>/INDEX.md
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "modules.json"), "utf8"));
const TODAY = process.env.UAT_DATE || new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const BASE_OUT = path.resolve(ROOT, process.env.UAT_MODULES_OUT || `docs/uat-evidence/modules/${TODAY}`);
const DEEP = path.join(ROOT, "scripts/prod-deep-uat.mjs");

const args = process.argv.slice(2).filter(Boolean);
let selected = [];
if (args.includes("--all") || args.length === 0) {
  selected = [...catalog.order];
} else if (args[0] === "--from") {
  const start = args[1]?.toUpperCase();
  const i = catalog.order.indexOf(start);
  if (i < 0) {
    console.error(`Unknown module ${start}. Known: ${catalog.order.join(", ")}`);
    process.exit(2);
  }
  selected = catalog.order.slice(i);
} else {
  selected = args.map((a) => a.toUpperCase());
  for (const m of selected) {
    if (!catalog.modules[m]) {
      console.error(`Unknown module ${m}. Known: ${catalog.order.join(", ")}`);
      process.exit(2);
    }
  }
}

fs.mkdirSync(BASE_OUT, { recursive: true });

function runOne(code) {
  const mod = catalog.modules[code];
  const outDir = path.join(BASE_OUT, code);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n════════ ${code} · ${mod.title} ════════`);
  console.log(`UAT_ONLY=${mod.only} · evidence → ${outDir}`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [DEEP], {
      cwd: ROOT,
      env: {
        ...process.env,
        UAT_ONLY: mod.only,
        UAT_OUT: outDir,
        UAT_DATE: TODAY,
      },
      stdio: "inherit",
    });
    child.on("close", (codeExit) => {
      let summary = { module: code, title: mod.title, exit: codeExit, passed: null, failed: null, total: null };
      try {
        const j = JSON.parse(fs.readFileSync(path.join(outDir, "results.json"), "utf8"));
        summary = { ...summary, passed: j.passed, failed: j.failed, total: j.total, commit: j.commit, project: j.project };
        const fails = (j.results || []).filter((r) => !r.ok).map((r) => `${r.id}: ${r.note}`);
        fs.writeFileSync(
          path.join(outDir, "SUMMARY.md"),
          [
            `# ${code} — ${mod.title}`,
            "",
            `**${j.passed} / ${j.total}** passed · commit \`${j.commit || "?"}\` · project \`${j.project || "?"}\``,
            "",
            "## Logins that create data",
            "",
            ...(mod.logins || []).map((l) => `- ${l}`),
            "",
            "## What this module creates",
            "",
            mod.creates || "",
            "",
            "## Failures",
            "",
            ...(fails.length ? fails.map((f) => `- ${f}`) : ["- (none)"]),
            "",
          ].join("\n"),
        );
      } catch {
        /* results may be missing on hard crash */
      }
      resolve(summary);
    });
  });
}

function writeIndex(rows) {
  const md = [
    `# Module-wise UAT — ${TODAY}`,
    "",
    `Portal ${process.env.PORTAL_URL || "https://portal.spdc.in"} · password \`Demo@1234\``,
    "",
    "| Module | Title | Pass | Fail | Total | Status | Report |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const status = r.exit === 0 && r.failed === 0 ? "✅" : r.total == null ? "💥" : "❌";
    md.push(
      `| ${r.module} | ${r.title} | ${r.passed ?? "—"} | ${r.failed ?? "—"} | ${r.total ?? "—"} | ${status} | [REPORT](./${r.module}/REPORT.md) |`,
    );
  }
  md.push("", "## How to re-run one module", "", "```bash", "node scripts/uat-modules/run.mjs CRM", "node scripts/uat-modules/run.mjs DWG", "node scripts/uat-modules/run.mjs --from QA", "```", "");
  fs.writeFileSync(path.join(BASE_OUT, "INDEX.md"), md.join("\n"));
  fs.writeFileSync(path.join(BASE_OUT, "index.json"), JSON.stringify({ date: TODAY, rows }, null, 2));
}

const all = [];
for (const code of selected) {
  const row = await runOne(code);
  all.push(row);
  writeIndex(all);
  console.log(`→ ${row.module}: ${row.passed ?? "?"}/${row.total ?? "?"} (exit ${row.exit})`);
}

console.log(`\nIndex: ${path.join(BASE_OUT, "INDEX.md")}`);
const hardFail = all.some((r) => r.exit !== 0 && r.exit != null);
process.exit(hardFail ? 1 : 0);
