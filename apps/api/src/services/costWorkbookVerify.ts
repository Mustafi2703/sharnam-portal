import fs from "fs";
import path from "path";
import XLSX, { type WorkBook } from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { resolveBudgetWorkbookPath } from "./budgetWorkbookImport.js";
import { parseBbsRows, parseMbRows } from "./costSheetParser.js";
import { monitoringItemRows, parseSpdcMonitoringRows } from "./spdcMonitoringParser.js";
import {
  SPDC_BBS_SHEETS,
  SPDC_BUDGET_DATA_START_ROW,
  SPDC_MB_SHEETS,
  SPDC_MONITORING_SHEETS,
  SPDC_RATE_SHEETS,
} from "./spdcBudgetManifest.js";

export type CostVerifyCheck = {
  key: string;
  label: string;
  ok: boolean;
  expected: string | number;
  actual: string | number;
  detail?: string;
};

function cellStr(v: unknown) {
  return String(v ?? "").trim();
}

function cellNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sheetRows(wb: WorkBook, name: string): unknown[][] {
  const key = wb.SheetNames.find((sheetName: string) => sheetName === name || sheetName.trim() === name.trim());
  if (!key || !wb.Sheets[key]) return [];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], { header: 1, defval: "" }) as unknown[][];
}

function countBudgetRows(rows: unknown[][]) {
  let n = 0;
  for (let i = SPDC_BUDGET_DATA_START_ROW; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const description = cellStr(row[1]);
    if (!description || /^description$/i.test(description)) continue;
    if (/total net project cost|total project cost|^gst\s|^expected over budget/i.test(description)) continue;
    n++;
  }
  return n;
}

function countMonitoringRows(rows: unknown[][], packageName: string) {
  return monitoringItemRows(parseSpdcMonitoringRows(rows, packageName)).length;
}

function countRateRows(wb: WorkBook) {
  let steel = 0;
  for (let i = 3; i < sheetRows(wb, "STEEL RATE DIFFRENCE").length; i++) {
    const row = sheetRows(wb, "STEEL RATE DIFFRENCE")[i] as unknown[];
    if (cellNum(row[5]) || cellNum(row[7])) steel++;
  }
  let cement = 0;
  for (let i = 2; i < sheetRows(wb, "CEMENT RATE DIFFRENCE").length; i++) {
    const row = sheetRows(wb, "CEMENT RATE DIFFRENCE")[i] as unknown[];
    if (cellNum(row[4]) || cellNum(row[5])) cement++;
  }
  let tiles = 0;
  for (let i = 2; i < sheetRows(wb, "Tiles Rate Difference").length; i++) {
    const row = sheetRows(wb, "Tiles Rate Difference")[i] as unknown[];
    if (cellNum(row[4]) || cellNum(row[5])) tiles++;
  }
  return { steel, cement, tiles, total: steel + cement + tiles };
}

export function readSpdcBudgetExpectations(workbookPath?: string | null) {
  const file = workbookPath || resolveBudgetWorkbookPath();
  if (!file || !fs.existsSync(file)) {
    return { file: null as string | null, sheets: [] as string[], counts: null as Record<string, number> | null };
  }
  const wb = XLSX.readFile(file);
  const counts: Record<string, number> = {
    budget: countBudgetRows(sheetRows(wb, "Budget")),
  };

  for (const [sheetName, packageName] of SPDC_MONITORING_SHEETS) {
    counts[`mon:${packageName}`] = countMonitoringRows(sheetRows(wb, sheetName), packageName);
  }
  for (const [sheetName, packageName] of SPDC_MB_SHEETS) {
    counts[`mb:${packageName}`] = parseMbRows(sheetRows(wb, sheetName)).length;
  }
  for (const [sheetName, packageName] of SPDC_BBS_SHEETS) {
    counts[`bbs:${packageName}`] = parseBbsRows(sheetRows(wb, sheetName)).filter(
      (r) => r.rowKind !== "header" && (r.diameterMm || r.totalLength || r.weightKg || r.nos)
    ).length;
  }
  const rates = countRateRows(wb);
  counts["rates:steel"] = rates.steel;
  counts["rates:cement"] = rates.cement;
  counts["rates:tiles"] = rates.tiles;
  counts["rates:total"] = rates.total;
  counts["monitoring:total"] = SPDC_MONITORING_SHEETS.reduce((s, [, pkg]) => s + (counts[`mon:${pkg}`] || 0), 0);
  counts["mb:total"] = SPDC_MB_SHEETS.reduce((s, [, pkg]) => s + (counts[`mb:${pkg}`] || 0), 0);
  counts["bbs:total"] = SPDC_BBS_SHEETS.reduce((s, [, pkg]) => s + (counts[`bbs:${pkg}`] || 0), 0);

  return { file, sheets: wb.SheetNames, counts };
}

/** Compare Cost* DB rows to SPDC_Budget_Arvind 49.xls */
export async function verifyCostProject(projectId: string) {
  const expected = readSpdcBudgetExpectations();
  if (!expected.counts || !expected.file) {
    return {
      ok: false,
      error: "SPDC_Budget_Arvind 49.xls not found on server",
      workbook: null,
      checks: [] as CostVerifyCheck[],
      summary: { passed: 0, total: 0 },
    };
  }

  const [
    budgetCount,
    monitoringTotal,
    mbTotal,
    bbsTotal,
    steelRates,
    cementRates,
    tilesRates,
    monByPkg,
    mbByPkg,
    bbsByPkg,
  ] = await Promise.all([
    prisma.costBudgetLine.count({ where: { projectId } }),
    prisma.costMonitoringLine.count({ where: { projectId, packageName: { not: "Cashflow Dashboard Monitoring" } } }),
    prisma.costMbLine.count({ where: { projectId } }),
    prisma.costBbsLine.count({ where: { projectId } }),
    prisma.costRateDifference.count({ where: { projectId, materialType: "Steel" } }),
    prisma.costRateDifference.count({ where: { projectId, materialType: "Cement" } }),
    prisma.costRateDifference.count({ where: { projectId, materialType: "Tiles" } }),
    prisma.costMonitoringLine.groupBy({
      by: ["packageName"],
      where: { projectId, packageName: { not: "Cashflow Dashboard Monitoring" } },
      _count: { _all: true },
    }),
    prisma.costMbLine.groupBy({ by: ["packageName"], where: { projectId }, _count: { _all: true } }),
    prisma.costBbsLine.groupBy({ by: ["packageName"], where: { projectId }, _count: { _all: true } }),
  ]);

  const monMap = Object.fromEntries(monByPkg.map((r) => [r.packageName, r._count._all]));
  const mbMap = Object.fromEntries(mbByPkg.map((r) => [r.packageName, r._count._all]));
  const bbsMap = Object.fromEntries(bbsByPkg.map((r) => [r.packageName, r._count._all]));

  const checks: CostVerifyCheck[] = [];

  const push = (key: string, label: string, exp: number, act: number, detail?: string) => {
    checks.push({ key, label, ok: exp === act, expected: exp, actual: act, detail });
  };

  push("budget", "Budget WBS lines", expected.counts.budget, budgetCount);
  push("monitoring.total", "Monitoring lines (all packages)", expected.counts["monitoring:total"], monitoringTotal);
  push("mb.total", "MB lines (all structures)", expected.counts["mb:total"], mbTotal);
  push("bbs.total", "BBS lines (all structures)", expected.counts["bbs:total"], bbsTotal);
  push("rates.steel", "Steel rate difference rows", expected.counts["rates:steel"], steelRates);
  push("rates.cement", "Cement rate difference rows", expected.counts["rates:cement"], cementRates);
  push("rates.tiles", "Tiles rate difference rows", expected.counts["rates:tiles"], tilesRates);

  for (const [sheetName, packageName] of SPDC_MONITORING_SHEETS) {
    push(
      `mon.${packageName}`,
      `Monitoring · ${packageName}`,
      expected.counts[`mon:${packageName}`] || 0,
      monMap[packageName] || 0,
      sheetName
    );
  }
  for (const [sheetName, packageName] of SPDC_MB_SHEETS) {
    push(`mb.${packageName}`, `MB · ${packageName}`, expected.counts[`mb:${packageName}`] || 0, mbMap[packageName] || 0, sheetName);
  }
  for (const [sheetName, packageName] of SPDC_BBS_SHEETS) {
    push(
      `bbs.${packageName}`,
      `BBS · ${packageName}`,
      expected.counts[`bbs:${packageName}`] || 0,
      bbsMap[packageName] || 0,
      sheetName
    );
  }

  const passed = checks.filter((c) => c.ok).length;
  return {
    ok: passed === checks.length,
    workbook: path.basename(expected.file),
    workbookPath: expected.file,
    sheetCount: expected.sheets.length,
    expectedSheets: expected.sheets.length,
    rateSheets: SPDC_RATE_SHEETS.map((r) => r.sheet),
    checks,
    summary: { passed, total: checks.length },
    totals: {
      budget: { expected: expected.counts.budget, actual: budgetCount },
      monitoring: { expected: expected.counts["monitoring:total"], actual: monitoringTotal },
      mb: { expected: expected.counts["mb:total"], actual: mbTotal },
      bbs: { expected: expected.counts["bbs:total"], actual: bbsTotal },
      rates: {
        expected: expected.counts["rates:total"],
        actual: steelRates + cementRates + tilesRates,
      },
    },
  };
}
