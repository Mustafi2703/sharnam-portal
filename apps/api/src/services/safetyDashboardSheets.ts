/**
 * Parse Safety Dashboard.xlsx one-pager + safe-hours KPIs (client sheet parity).
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function resolveSafetyDashboardPath(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT
      ? path.join(process.env.SHARNAM_EXCEL_ROOT, "Safety Dashboard.xlsx")
      : "",
    path.join(process.cwd(), "seed", "data", "Safety Dashboard.xlsx"),
    path.join(process.cwd(), "Sharnam_modules_docs", "Safety Dashboard.xlsx"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function readSheet(wb: XLSX.WorkBook, pattern: RegExp) {
  const key = wb.SheetNames.find((n) => pattern.test(n));
  if (!key || !wb.Sheets[key]) return [] as unknown[][];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], {
    header: 1,
    defval: "",
  }) as unknown[][];
}

export type SafetyOnePagerKpis = {
  totalIncidents: number;
  totalUnsafeActs: number;
  totalNcrs: number;
  safeManHours: number;
  toolboxTalks: number;
  siteInstructions: number;
  source: string;
};

export function parseSafetyOnePager(rows: unknown[][]): Partial<SafetyOnePagerKpis> {
  const out: Partial<SafetyOnePagerKpis> = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const label = String(r[0] ?? "").toLowerCase();
    if (label.includes("total incidents")) out.totalIncidents = n(r[1]);
    if (label.includes("total unsafe act")) out.totalUnsafeActs = n(r[4] ?? r[1]);
    if (String(r[7] ?? "").toLowerCase().includes("total ncr")) out.totalNcrs = n(r[8] ?? r[4]);
  }
  return out;
}

export function parseSafetyHours(rows: unknown[][]): Partial<SafetyOnePagerKpis> {
  const out: Partial<SafetyOnePagerKpis> = {};
  for (const r of rows) {
    const label = String(r[1] ?? "").toLowerCase();
    if (label.includes("safe-manhours") || label.includes("safe manhours")) {
      out.safeManHours = n(r[4]) || n(r[3]);
    }
    if (label.includes("toolbox talk")) out.toolboxTalks = n(r[4]) || n(r[3]);
    if (label.includes("site safety instruction")) out.siteInstructions = n(r[4]) || n(r[3]);
  }
  return out;
}

export function loadSafetyDashboardKpis(): SafetyOnePagerKpis | null {
  const file = resolveSafetyDashboardPath();
  if (!file) return null;
  const wb = XLSX.readFile(file);
  const onePager = parseSafetyOnePager(readSheet(wb, /One Pager/i));
  const hours = parseSafetyHours(readSheet(wb, /Safety Hours/i));
  return {
    totalIncidents: onePager.totalIncidents ?? 0,
    totalUnsafeActs: onePager.totalUnsafeActs ?? 0,
    totalNcrs: onePager.totalNcrs ?? 0,
    safeManHours: hours.safeManHours ?? 0,
    toolboxTalks: hours.toolboxTalks ?? 0,
    siteInstructions: hours.siteInstructions ?? 0,
    source: path.basename(file),
  };
}
