/** Parse Monthly Progress Dashboard · SOR Log summary block (first table only). */

import fs from "fs";
import path from "path";
import XLSX, { type WorkBook } from "../lib/xlsx.js";
import { resolveExcelRoot } from "../lib/excelRoot.js";
import { prisma } from "../prisma.js";

export type ProgressSorSummaryRow = {
  observation: string;
  total: number;
  openCount: number;
  closedCount: number;
  closureRate: number;
};

function cellStr(v: unknown, max = 120) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

function cellNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function resolveMonthlyDashboardPath(root = resolveExcelRoot()) {
  const named = path.join(
    root,
    fs.existsSync(path.join(root, "Monthly Progress Dashboard (1).xlsx"))
      ? "Monthly Progress Dashboard (1).xlsx"
      : "Monthly Progress Dashboard.xlsx"
  );
  return fs.existsSync(named) ? named : null;
}

export function readProgressSorSummaryFromWorkbook(wb: WorkBook): ProgressSorSummaryRow[] {
  const sheetName = wb.SheetNames.find((n) => /sor/i.test(n)) || "SOR Log";
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  return parseProgressSorSummaryRows(rows);
}

/**
 * Reads the primary SOR summary table (rows 2–4 in the client pack).
 * Stops before duplicate mini-tables / Average row — older seeds that scanned
 * the whole sheet produced 6 rows (3 real + 3 duplicates).
 */
export function parseProgressSorSummaryRows(rows: unknown[][]): ProgressSorSummaryRow[] {
  const out: ProgressSorSummaryRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const observation = cellStr(row[1]);
    const sr = cellNum(row[0]);
    if (!observation || sr <= 0 || /sr\.?no/i.test(observation)) {
      if (out.length > 0) break;
      continue;
    }
    out.push({
      observation,
      total: cellNum(row[2]),
      openCount: cellNum(row[3]),
      closedCount: cellNum(row[4]),
      closureRate: cellNum(row[5]),
    });
  }
  return out;
}

/** Replace project SOR summary rows from the client Monthly Progress Dashboard pack. */
export async function resyncProgressSorStats(projectId: string) {
  const monthlyFile = resolveMonthlyDashboardPath();
  if (!monthlyFile) throw new Error("Monthly Progress Dashboard workbook not found in seed/data");
  const wb = XLSX.readFile(monthlyFile);
  const summaryRows = readProgressSorSummaryFromWorkbook(wb);
  await prisma.progressSorStat.deleteMany({ where: { projectId } });
  for (const row of summaryRows) {
    await prisma.progressSorStat.create({
      data: {
        projectId,
        observation: row.observation,
        total: row.total,
        openCount: row.openCount,
        closedCount: row.closedCount,
        closureRate: row.closureRate,
      },
    });
  }
  return summaryRows;
}
