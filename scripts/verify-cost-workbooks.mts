/**
 * Parser checks for the five client workbooks. No database.
 *
 *   npx tsx scripts/verify-cost-workbooks.mts
 */
import fs from "fs";
import path from "path";
import { SPDC_MB_SHEETS } from "../packages/shared/src/spdcBudgetTabs.ts";
import { parseAllMbSheets } from "../apps/api/src/services/costSheetParser.ts";
import { parseBudgetBuffer, parseCashflowBuffer } from "../apps/api/src/services/cashflowParser.ts";
import { parseWorkbookIssues } from "../apps/api/src/services/workbookIssues.ts";
import { budgetGrossTotal } from "../packages/shared/src/budgetGross.ts";
import { deriveMilestone, riskRating, riskSeverity } from "../packages/shared/src/progressDerive.ts";

const root = process.cwd();
const seed = path.join(root, "seed/data");
let failed = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "OK" : "DIFF"} ${name}: ${detail}`);
  if (!ok) failed += 1;
}

const budgetFile = path.join(seed, "SPDC_Budget_Arvind 49.xls");
const budget = fs.readFileSync(budgetFile);
const mbTabs = parseAllMbSheets(budget).map((sheet) => sheet.sheetName.trim().toLowerCase());
const expectedMb = SPDC_MB_SHEETS.map(([name]) => name.trim().toLowerCase());
check("MB tabs", expectedMb.every((name) => mbTabs.includes(name)) && mbTabs.length === expectedMb.length, mbTabs.join(", "));

const lines = parseBudgetBuffer(budget);
const sums = lines.reduce(
  (acc, line) => {
    acc.budgeted += line.budgetedAmount;
    acc.wo += line.workOrderAmount;
    acc.certified += line.certifiedAmount;
    acc.gross += line.grossTotal;
    return acc;
  },
  { budgeted: 0, wo: 0, certified: 0, gross: 0 }
);
const targets = [104684309, 108078134, 76300243, 111231831];
const got = [sums.budgeted, sums.wo, sums.certified, sums.gross].map((n) => Math.round(n));
check(
  "Budget 49 totals",
  got.every((n, i) => n === targets[i]),
  `budgeted ${got[0]} wo ${got[1]} certified ${got[2]} gross ${got[3]}`
);

function explainedByFollowingChildren(index: number, derived: number, cached: number): boolean {
  const sr = lines[index]?.srNo || "";
  if (!sr) return false;
  let net = 0;
  for (let j = index + 1; j < lines.length; j++) {
    const childSr = lines[j]?.srNo || "";
    if (!childSr.startsWith(`${sr}.`)) break;
    net += lines[j]!.forecastedAmount - lines[j]!.forecastReduction;
    if (Math.abs(derived + net - cached) <= 1) return true;
  }
  return false;
}
const grossOff: string[] = [];
const grossExplained: string[] = [];
for (let index = 0; index < lines.length; index++) {
  const line = lines[index]!;
  const derived = budgetGrossTotal(line);
  const cached = line.grossTotal;
  if (Math.abs(derived - cached) <= 1 || !cached) continue;
  const sr = line.srNo || "?";
  if (explainedByFollowingChildren(index, derived, cached)) {
    grossExplained.push(`${sr} cached gross also adds the forecast net of the following child rows`);
    continue;
  }
  if (line.certifiedAmount && Math.abs(line.certifiedAmount - cached) <= 1) {
    grossExplained.push(`${sr} sheet gross equals the certified amount, not the work-order identity`);
    continue;
  }
  grossOff.push(
    `${sr} "${String(line.description).slice(0, 42)}" cached ${Math.round(cached)} derived ${Math.round(derived)}`
  );
}
for (const row of grossExplained) console.log("  gross note " + row);
for (const row of grossOff) console.log("  gross " + row);
check(
  "Budget gross formula",
  grossOff.length === 0,
  grossOff.length ? `${grossOff.length} lines differ` : grossExplained.length ? `${grossExplained.length} lines explained` : "every line matches"
);

const cashflowPath = fs.existsSync(path.join(seed, "Cashflow - Dashboard.xlsx"))
  ? path.join(seed, "Cashflow - Dashboard.xlsx")
  : path.join(root, "module_prompts/Sharnam_modules_docs 2/Cashflow - Dashboard.xlsx");
const cash = fs.readFileSync(cashflowPath);
const periods = parseCashflowBuffer(cash, new Date("2025-01-01"));
const fake = periods.filter((row) =>
  /Tracking · (Month|Difference|CPI|Earned Value|Planned Budget|Progress|Actual Work|\d+)/i.test(row.packageName)
);
check("Cashflow packages", fake.length === 0, fake.length ? fake.map((row) => row.packageName).slice(0, 6).join(", ") : `${periods.length} rows`);
const cashBudget = parseBudgetBuffer(cash);
const cashGross = cashBudget.reduce((sum, line) => sum + line.grossTotal, 0);
check("Cashflow budget gross", cashGross > 0, String(Math.round(cashGross)));
const cashIssues = parseWorkbookIssues(cash);
check(
  "Cashflow external link",
  cashIssues.externalLinks.some((link) => /Superseeded|SPDC_Budget_Arvind/i.test(link)),
  cashIssues.externalLinks.join(" | ") || "none"
);

const late = deriveMilestone({
  plannedStart: new Date("2026-01-01"),
  plannedEnd: new Date("2026-01-10"),
  actualStart: new Date("2026-01-02"),
  actualEnd: new Date("2026-01-20"),
  pctComplete: 1,
});
check("Completed Late", late.status === "Completed Late" && late.varianceDays === 10 && late.pctComplete === 1, `${late.status} delay ${late.varianceDays}`);
const open = deriveMilestone({
  plannedStart: new Date("2026-01-01"),
  plannedEnd: new Date("2026-01-10"),
  actualStart: new Date("2026-01-02"),
  actualEnd: null,
  pctComplete: 1,
  today: new Date("2026-01-15"),
});
check("Delayed is not 100%", open.status === "Delayed" && open.pctComplete <= 0.99, `${open.status} ${open.pctComplete}`);
const bad = deriveMilestone({
  plannedStart: new Date("2026-06-01"),
  plannedEnd: new Date("2026-06-10"),
  actualStart: new Date("1900-01-08"),
  actualEnd: null,
  pctComplete: 0.4,
  today: new Date("2026-05-01"),
});
check("1900 date ignored", bad.status === "Not Started", bad.status);
check("Risk bands", riskRating(riskSeverity(5, 3)) === "High" && riskRating(riskSeverity(2, 3)) === "Low", `${riskSeverity(5, 3)} ${riskSeverity(2, 3)}`);

const overview = [
  path.join(seed, "Progress Overview.xlsx"),
  path.join(root, "module_prompts/Sharnam_modules_docs 2/Progress Overview.xlsx"),
].find((p) => fs.existsSync(p));
if (overview) {
  const issues = parseWorkbookIssues(fs.readFileSync(overview));
  console.log(`Progress Overview error cells: ${issues.errors.length}`);
}

console.log(failed ? `\n${failed} checks failed` : "\nWorkbook checks passed");
process.exit(failed ? 1 : 0);
