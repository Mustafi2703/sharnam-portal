/**
 * Parse Quality Dashboard.xlsx sheet tabs for Quality module KPIs / registers.
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function s(v: unknown, max = 200) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

function resolveQualityDashboardPath(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT
      ? path.join(process.env.SHARNAM_EXCEL_ROOT, "Quality Dashboard.xlsx")
      : "",
    path.join(process.cwd(), "seed", "data", "Quality Dashboard.xlsx"),
    path.join(process.cwd(), "Sharnam_modules_docs", "Quality Dashboard.xlsx"),
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

export type QualityDashboardKpis = {
  weekLabel: string;
  concretingM3: number;
  samplesLastWeek: number;
  source: string;
};

export type SorLogRow = {
  label: string;
  total: number;
  open: number;
  closed: number;
  closureRate: number;
};

export type ChecklistDisciplineRow = { discipline: string; filled: number };
export type ChecklistCatalogRow = { srNo: number; name: string; category: string };

export type QualityWorkbookData = {
  dashboard: QualityDashboardKpis | null;
  sorLog: SorLogRow[];
  checklistByDiscipline: ChecklistDisciplineRow[];
  checklistCatalog: ChecklistCatalogRow[];
  source: string;
};

export function parseQualityDashboard(rows: unknown[][]): Partial<QualityDashboardKpis> {
  const out: Partial<QualityDashboardKpis> = { weekLabel: "Week 13" };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const label = s(r[0], 120).toLowerCase();
    if (/quality performance report.*week/i.test(label)) {
      const m = label.match(/week\s*(\d+)/i);
      if (m) out.weekLabel = `Week ${m[1]}`;
    }
    if (/this week concreting/i.test(label)) {
      out.concretingM3 = n(String(r[0]).replace(/[^\d.]/g, "")) || n(r[1]);
      out.samplesLastWeek = n(r[6]) || n(r[7]);
    }
    if (/^\d+\s*m3/i.test(label)) {
      out.concretingM3 = n(String(r[0]).replace(/[^\d.]/g, ""));
      out.samplesLastWeek = n(r[6]) || out.samplesLastWeek;
    }
  }
  return out;
}

export function parseSorLog(rows: unknown[][]): SorLogRow[] {
  const out: SorLogRow[] = [];
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const r = rows[i] as unknown[];
    const sn = n(r[0]);
    const label = s(r[1], 80);
    if (!sn || !label || /sr\.?no/i.test(String(r[0]))) continue;
    out.push({
      label,
      total: n(r[2]) || n(r[3]),
      open: n(r[3]) || n(r[2]),
      closed: n(r[4]),
      closureRate: n(r[5]),
    });
  }
  return out;
}

export function parseChecklistDiscipline(rows: unknown[][]): ChecklistDisciplineRow[] {
  const out: ChecklistDisciplineRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const discipline = s(r[0], 80);
    const filled = n(r[1]);
    if (!discipline || /row labels/i.test(discipline)) continue;
    out.push({ discipline, filled });
  }
  return out;
}

export function parseChecklistCatalog(rows: unknown[][]): ChecklistCatalogRow[] {
  const out: ChecklistCatalogRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const sr = n(r[0]);
    const name = s(r[1], 200);
    const category = s(r[2], 80);
    if (!sr || !name || /sr no|file name/i.test(String(r[0]))) continue;
    out.push({ srNo: sr, name, category: category || "General" });
  }
  return out.slice(0, 80);
}

export function loadQualityDashboardWorkbook(): QualityWorkbookData | null {
  const file = resolveQualityDashboardPath();
  if (!file) return null;
  const wb = XLSX.readFile(file);
  const dashboard = parseQualityDashboard(readSheet(wb, /^Dashboard$/i));
  const sorLog = parseSorLog(readSheet(wb, /SOR Log/i));
  const checklistByDiscipline = parseChecklistDiscipline(readSheet(wb, /^Sheet2$/i));
  const checklistCatalog = parseChecklistCatalog(readSheet(wb, /^Sheet1$/i));
  return {
    dashboard: dashboard
      ? {
          weekLabel: dashboard.weekLabel || "Week 13",
          concretingM3: dashboard.concretingM3 ?? 0,
          samplesLastWeek: dashboard.samplesLastWeek ?? 0,
          source: path.basename(file),
        }
      : null,
    sorLog,
    checklistByDiscipline,
    checklistCatalog,
    source: path.basename(file),
  };
}
