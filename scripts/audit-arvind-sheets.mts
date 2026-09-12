/**
 * Read-only workbook audit — no database.
 *
 *   npm run db:audit-arvind-sheets
 */
import { auditArvindWorkbooks } from "../apps/api/src/services/sheetWorkbookAudit.ts";

const report = auditArvindWorkbooks();
console.log("\n=== Arvind / module_prompts sheet audit ===\n");
console.log(
  "Counts:",
  JSON.stringify(report.counts)
);
console.log("\nBudget health");
for (const [key, b] of Object.entries(report.budget)) {
  console.log(
    `  ${key}: ${b.found ? b.name : "MISSING"} · full=${b.fullSpdcWorkbook} · costSource=${b.costSource} · ${b.detail}`
  );
}
console.log("\nWorkbooks");
for (const row of report.rows) {
  const loc = row.found ? row.found : "not found";
  console.log(`  [${row.status}] ${row.name} → ${row.importer} (${row.feeds})`);
  console.log(`           ${loc}${row.sheets.length ? ` · sheets: ${row.sheets.slice(0, 8).join(", ")}` : ""}`);
}
console.log("\nLeftovers for a real-project upload");
for (const line of report.leftovers) console.log(`  - ${line}`);
console.log("");
