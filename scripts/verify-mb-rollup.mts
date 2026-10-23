/**
 * Compare MB and BBS rollups with Monitoring achieved quantities in
 * seed/data/SPDC_Budget_Arvind 49.xls. No database.
 *
 *   npx tsx scripts/verify-mb-rollup.mts
 */
import fs from "fs";
import path from "path";
import XLSX from "../apps/api/src/lib/xlsx.ts";
import { parseAllBbsSheets, parseAllMbSheets, rollupMbQtyByItem, mbItemUnits, normItemNo } from "../apps/api/src/services/costSheetParser.ts";
import { parseWorkbookIssues } from "../apps/api/src/services/workbookIssues.ts";

const root = process.cwd();
const file = path.join(root, "seed/data/SPDC_Budget_Arvind 49.xls");
const buffer = fs.readFileSync(file);
const wb = XLSX.read(buffer, { type: "buffer", cellFormula: true });

const pairs: [string, string][] = [
  ["Dormitory Civil", "Monitoring Civil Dormitory"],
  ["Plumbing", "Monitoring Plumbing"],
  ["Electric", "Monitoring Electric"],
];

type MonRow = { qty: number; description: string; uom: string };

function numericQty(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim().replace(/,/g, "");
  if (!text || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

/** Item numbers restart under Extra Items. Repeated numbers in one section are summed. */
function achievedByItem(sheetName: string) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "" });
  const main = new Map<string, MonRow>();
  const extra = new Map<string, MonRow>();
  let inExtra = false;
  for (const row of rows) {
    const itemRaw = String(row[0] ?? "").trim();
    const description = String(row[1] ?? "");
    if (/extra\s*items?\s*:?/i.test(description) && !/^\d/.test(itemRaw)) {
      inExtra = true;
      continue;
    }
    const item = normItemNo(itemRaw);
    if (!/^\d+$/.test(item)) continue;
    const qty = numericQty(row[7]);
    if (qty == null) continue;
    const bucket = inExtra ? extra : main;
    const prev = bucket.get(item);
    if (!prev) bucket.set(item, { qty, description, uom: String(row[2] ?? "") });
    else prev.qty += qty;
  }
  return { main, extra };
}

function statedUpToDate(lines: { rowKind?: string; description: string; itemCode?: string; qty: number }[]) {
  const out = new Map<string, number>();
  for (const line of lines) {
    if (line.rowKind !== "total" || !/up to date/i.test(line.description || "")) continue;
    const code = normItemNo(line.itemCode);
    if (!code || out.has(code)) continue;
    out.set(code, Number(line.qty) || 0);
  }
  return out;
}

function unitKey(unit: string): string {
  return unit.toLowerCase().replace(/[^a-z]/g, "");
}

function toMonitoringQty(qty: number, mbUnit: string | undefined, monUom: string): number {
  const from = unitKey(mbUnit || "");
  const to = unitKey(monUom);
  if ((from === "kg" || from === "kgs") && (to === "mt" || to === "ton" || to === "tonne" || to === "tonnes")) return qty / 1000;
  return qty;
}

const mb = parseAllMbSheets(buffer);
let failed = 0;
console.log("MB rollup vs Monitoring achieved");
for (const [pkg, sheet] of pairs) {
  const batch = mb.find((row) => row.packageName === pkg);
  const lines = batch?.lines || [];
  const totals = rollupMbQtyByItem(lines);
  const units = mbItemUnits(lines);
  const stated = statedUpToDate(lines);
  const excel = achievedByItem(sheet);
  console.log(`\n${pkg} (${lines.length} MB rows)`);
  const compare = (label: string, item: string, excelRow: MonRow, portalRaw: number) => {
    if (!excelRow.qty && !portalRaw) return;
    const portal = toMonitoringQty(portalRaw, units.get(item), excelRow.uom);
    const diff = portal - excelRow.qty;
    if (Math.abs(diff) <= 0.01) {
      if (excelRow.qty) console.log(`OK ${label} ${item} portal ${portal.toFixed(3)} excel ${excelRow.qty.toFixed(3)}`);
      return;
    }
    const uom = unitKey(excelRow.uom);
    const steel =
      (uom === "mt" || uom === "ton" || uom === "tonne" || uom === "tonnes") &&
      /reinforc|bending,\s*binding|bar bending/i.test(excelRow.description);
    if (steel) {
      console.log(`NOTE ${label} ${item} is reinforcement. Monitoring shows ${excelRow.qty.toFixed(3)} ${excelRow.uom}. MB measurement sum is ${portal.toFixed(3)}. Steel comes from the BBS.`);
      return;
    }
    const statedQty = toMonitoringQty(stated.get(item) || 0, units.get(item), excelRow.uom);
    if (stated.has(item) && Math.abs(statedQty - excelRow.qty) <= 0.01) {
      console.log(
        `NOTE ${label} ${item} monitoring ${excelRow.qty.toFixed(3)} matches the MB total cell ${statedQty.toFixed(3)}. Measurement sum is ${portal.toFixed(3)}.`
      );
      return;
    }
    failed += 1;
    console.log(`DIFF ${label} ${item} portal ${portal.toFixed(3)} excel ${excelRow.qty.toFixed(3)} diff ${diff.toFixed(3)}`);
  };
  for (const [item, excelRow] of excel.main) compare("item", item, excelRow, totals.get(item) || 0);
  for (const [item, excelRow] of excel.extra) compare("extra", `E${item}`, excelRow, totals.get(`E${item}`) || 0);
}

const bbs = parseAllBbsSheets(buffer);
const dormBbs = bbs.find((row) => row.packageName === "Dormitory BBS");
const steelKg = (dormBbs?.lines || [])
  .filter((row) => row.rowKind === "data" && !row.sourceError)
  .reduce((sum, row) => sum + (row.weightKg || 0), 0);
const bbsRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["DORMITORY BBS"], { header: 1, defval: "" });
let sheetKg = 0;
for (const row of bbsRows) {
  if (!/total in kg/i.test(String(row[1] ?? ""))) continue;
  for (const cell of row) {
    const n = Number(cell);
    if (n > 1000) sheetKg = n;
  }
}
const portalMt = steelKg / 1000;
const sheetMt = sheetKg / 1000;
const bbsOk = sheetKg > 0 && Math.abs(portalMt - sheetMt) <= 0.05;
if (!bbsOk) failed += 1;
console.log(`\n${bbsOk ? "OK" : "DIFF"} Dormitory BBS ${steelKg.toFixed(1)} kg = ${portalMt.toFixed(3)} MT, sheet total ${sheetKg.toFixed(1)} kg = ${sheetMt.toFixed(3)} MT`);
const dormExcel = achievedByItem("Monitoring Civil Dormitory");
const reinforcement = [...dormExcel.main.entries()].find(
  ([, row]) =>
    (unitKey(row.uom) === "mt" || unitKey(row.uom) === "ton") &&
    /reinforc|bending,\s*binding|bar bending/i.test(row.description)
);
if (reinforcement) {
  const [item, row] = reinforcement;
  console.log(
    `NOTE reinforcement item ${item}: monitoring cell is ${row.qty.toFixed(3)} MT (typed on the sheet). Portal steel is the BBS bar total ${portalMt.toFixed(3)} MT.`
  );
}
const sourceErrors = bbs.flatMap((sheet) =>
  sheet.lines.filter((row) => row.sourceError).map((row) => `${sheet.sheetName} ${row.barMark || ""} ${row.location || ""}`.trim())
);
console.log(`\nBBS source errors: ${sourceErrors.length}`);
for (const line of sourceErrors.slice(0, 20)) console.log("  " + line);

const issues = parseWorkbookIssues(buffer);
const bbsIssues = issues.errors.filter((err) => /bbs/i.test(err.tab));
console.log(`\n#REF! / #DIV/0! cells: ${issues.errors.length} (${bbsIssues.length} on BBS tabs)`);
for (const err of bbsIssues.slice(0, 20)) console.log(`  ${err.tab} ${err.cell} ${err.error}`);
if (!bbsIssues.length) {
  for (const err of issues.errors.slice(0, 8)) console.log(`  ${err.tab} ${err.cell} ${err.error}`);
}
console.log(`External links: ${issues.externalLinks.length}`);
for (const link of issues.externalLinks) console.log("  " + link);

console.log(failed ? `\n${failed} differences over 0.01` : "\nAll compared items within 0.01");
process.exit(failed ? 1 : 0);
