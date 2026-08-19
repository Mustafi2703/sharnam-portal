/**
 * Parse Quality Dashboard.xlsx sheet tabs for Quality module KPIs / registers.
 */
import fs from "fs";
import path from "path";
import XLSX, { type WorkBook } from "../lib/xlsx.js";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function parseLeadingNumber(v: unknown) {
  const m = String(v ?? "").match(/(\d+(?:\.\d+)?)/);
  return m ? n(m[1]) : 0;
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

function readSheet(wb: WorkBook, pattern: RegExp) {
  const key = wb.SheetNames.find((n: string) => pattern.test(n));
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

export type SorLogEntry = {
  id: string;
  date: string;
  type: string;
  reference: string;
  description: string;
  location?: string | null;
  status: string;
  source?: string;
};

export type ChecklistDisciplineRow = { discipline: string; filled: number };
export type ChecklistCatalogRow = { srNo: number; name: string; category: string };

export type QapDetailRow = {
  srNo: string | null;
  section: string;
  description: string;
  frequency: string;
  codeOfConformance: string;
  testAgency: string;
  contractorPerformer: string;
  contractorChecker: string;
  pmcRole: string;
  clientRole: string;
  records: string;
  remarks: string;
};

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
      const next = (rows[i + 1] as unknown[]) || [];
      out.concretingM3 = parseLeadingNumber(next[0]) || parseLeadingNumber(next[1]);
      out.samplesLastWeek = n(next[6]) || n(next[7]) || out.samplesLastWeek;
    }
    if (/^\d+\s*m3/i.test(label)) {
      out.concretingM3 = parseLeadingNumber(r[0]);
      out.samplesLastWeek = n(r[6]) || out.samplesLastWeek;
    }
    if (/no\.?\s*of sample last week/i.test(s(r[6], 80).toLowerCase())) {
      const next = (rows[i + 1] as unknown[]) || [];
      out.samplesLastWeek = n(next[6]) || n(next[7]) || out.samplesLastWeek;
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
  return out.slice(0, 200);
}

/** Quality Assurance Plan - Detail / Week 50 Sheet1 layout (header row 7–8, data from row 9). */
export function parseQapDetailSheet(rows: unknown[][], startRow = 9): QapDetailRow[] {
  const out: QapDetailRow[] = [];
  let section = "";
  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const srRaw = s(r[0], 20);
    const act = s(r[1], 120);
    const detail = s(r[2], 400);
    if (act) section = act;
    if (!detail) continue;
    const srNo = srRaw && /^\d+$/.test(srRaw) ? srRaw : null;
    const contractorPerformer = s(r[6], 80);
    const contractorChecker = s(r[7], 80);
    const pmcRole = s(r[8], 80);
    const clientRole = s(r[9], 80);
    const remarks = s(r[11], 120);
    out.push({
      srNo,
      section: section || act || "General",
      description: detail,
      frequency: s(r[3], 120),
      codeOfConformance: s(r[4], 160),
      testAgency: s(r[5], 120),
      contractorPerformer,
      contractorChecker,
      pmcRole,
      clientRole,
      records: s(r[10], 160),
      remarks,
    });
  }
  return out;
}

export function qapStatusFromRow(row: QapDetailRow): { status: string; contractorOk: boolean; pmcOk: boolean; clientOk: boolean } {
  const done = /complete|done|yes/i.test(row.remarks);
  const contractorOk = !!(row.contractorPerformer || row.contractorChecker);
  const pmcOk = /review|witness|yes/i.test(row.pmcRole);
  const clientOk = /witness|random|yes/i.test(row.clientRole);
  return {
    contractorOk,
    pmcOk,
    clientOk,
    status: done || (pmcOk && clientOk) ? "Done" : "Open",
  };
}

/** Merge workbook SOR summary with live portal site observation / instruction counts */
export function buildLiveSorLog(
  workbookRows: SorLogRow[],
  siteRecords: { recordType: string; status: string }[]
): SorLogRow[] {
  const liveByType: Record<string, { total: number; open: number; closed: number }> = {};
  for (const r of siteRecords) {
    const key = r.recordType === "Site Instruction" ? "Site Instruction" : "Site Observation";
    if (!liveByType[key]) liveByType[key] = { total: 0, open: 0, closed: 0 };
    liveByType[key].total++;
    if (r.status === "Closed") liveByType[key].closed++;
    else liveByType[key].open++;
  }

  const merged = [...workbookRows];
  for (const [label, counts] of Object.entries(liveByType)) {
    const idx = merged.findIndex((r) => r.label.toLowerCase().includes(label.toLowerCase().split(" ")[0]!));
    if (idx >= 0) {
      merged[idx] = {
        ...merged[idx],
        total: merged[idx].total + counts.total,
        open: merged[idx].open + counts.open,
        closed: merged[idx].closed + counts.closed,
        closureRate:
          merged[idx].total + counts.total
            ? (merged[idx].closed + counts.closed) / (merged[idx].total + counts.total)
            : merged[idx].closureRate,
      };
    } else {
      merged.push({
        label,
        total: counts.total,
        open: counts.open,
        closed: counts.closed,
        closureRate: counts.total ? counts.closed / counts.total : 0,
      });
    }
  }
  return merged;
}

/** Dated SOR lines for DPR — site observation, instruction, NCR, CAR */
export function buildLiveSorEntries(
  siteRecords: {
    id: string;
    recordType: string;
    title: string;
    description?: string | null;
    location?: string | null;
    status: string;
    occurredAt: Date | string;
  }[],
  ncrs: {
    id: string;
    number: string | null;
    description: string;
    location?: string | null;
    status: string;
    issueDate?: Date | string | null;
    ncrType?: string | null;
    source?: string | null;
  }[]
): SorLogEntry[] {
  const entries: SorLogEntry[] = [];

  for (const r of siteRecords) {
    entries.push({
      id: r.id,
      date: new Date(r.occurredAt).toISOString().slice(0, 10),
      type: r.recordType,
      reference: r.title,
      description: r.description || r.title,
      location: r.location,
      status: r.status,
      source: "portal",
    });
  }

  for (const n of ncrs) {
    const isCar = /^CAR/i.test(n.number || "") || /CAR/i.test(n.source || "");
    entries.push({
      id: n.id,
      date: n.issueDate ? new Date(n.issueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      type: isCar ? "CAR" : "NCR",
      reference: n.number || n.id,
      description: n.description,
      location: n.location,
      status: n.status,
      source: n.source || "NCR register",
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
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
