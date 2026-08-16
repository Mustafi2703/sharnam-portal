/**
 * Parse Safety Dashboard.xlsx one-pager + safe-hours KPIs (client sheet parity).
 */
import fs from "fs";
import path from "path";
import XLSX, { type WorkBook } from "../lib/xlsx.js";

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

function readSheet(wb: WorkBook, pattern: RegExp) {
  const key = wb.SheetNames.find((n: string) => pattern.test(n));
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

function labelAt(r: unknown[], col: number) {
  return String(r[col] ?? "").toLowerCase().trim();
}

function isNumericCell(v: unknown) {
  if (v === "" || v == null) return false;
  return Number.isFinite(Number(v));
}

/** One Pager uses label row + value row with KPIs in columns 0, 3, 6, 9, 12. */
export function parseSafetyOnePager(rows: unknown[][]): Partial<SafetyOnePagerKpis> {
  const out: Partial<SafetyOnePagerKpis> = {};
  for (let i = 0; i < rows.length; i++) {
    const labels = rows[i] as unknown[];
    const values = (rows[i + 1] as unknown[]) || [];
    for (let col = 0; col < labels.length; col++) {
      const label = labelAt(labels, col);
      if (!label || !isNumericCell(values[col])) continue;
      const value = n(values[col]);
      if (label.includes("total incident")) out.totalIncidents = value;
      if (label.includes("total unsafe act")) out.totalUnsafeActs = value;
      if (label.includes("total ncr")) out.totalNcrs = value;
      if (label.includes("weekley safe") || label.includes("weekly safe")) {
        out.safeManHours = value || out.safeManHours;
      }
      if (label.includes("cumulative safe")) {
        out.safeManHours = value || out.safeManHours;
      }
    }
    // Legacy single-column layout fallback
    const solo = labelAt(labels, 0);
    if (solo.includes("total incident") && isNumericCell(labels[1])) {
      out.totalIncidents = n(labels[1]) || out.totalIncidents;
    }
    if (solo.includes("total unsafe act") && isNumericCell(labels[4] ?? labels[1])) {
      out.totalUnsafeActs = n(labels[4] ?? labels[1]) || out.totalUnsafeActs;
    }
    if (labelAt(labels, 7).includes("total ncr") && isNumericCell(labels[8] ?? labels[4])) {
      out.totalNcrs = n(labels[8] ?? labels[4]) || out.totalNcrs;
    }
  }
  return out;
}

export function parseSafetyHours(rows: unknown[][]): Partial<SafetyOnePagerKpis> {
  const out: Partial<SafetyOnePagerKpis> = {};
  const headerIdx = rows.findIndex(
    (r) => /sr\.?\s*no/i.test(String(r[0] ?? "")) && /hse indicators/i.test(String(r[1] ?? ""))
  );
  const start = headerIdx >= 0 ? headerIdx + 1 : 8;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!n(r[0])) break;
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
    safeManHours: onePager.safeManHours || hours.safeManHours || 0,
    toolboxTalks: hours.toolboxTalks ?? 0,
    siteInstructions: hours.siteInstructions ?? 0,
    source: path.basename(file),
  };
}
