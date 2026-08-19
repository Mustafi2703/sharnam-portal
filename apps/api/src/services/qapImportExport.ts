/**
 * Quality Assurance Plan Week 50.xlsx — import / export with daily check columns.
 */
import fs from "fs";
import path from "path";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { parseQapDetailSheet, qapStatusFromRow, type QapDetailRow } from "./qualityDashboardSheets.js";
import { renderBrandedReportHtml, workbookBuffer, type SheetSpec } from "./brandedExport.js";

function s(v: unknown, max = 500) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

function excelSerialToDay(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 40000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(v));
    return epoch.toISOString().slice(0, 10);
  }
  const t = s(v, 40);
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  if (/^\d{1,2}[/-]/.test(t)) return t;
  return null;
}

function parseDailyChecks(row: unknown[], headerRow: unknown[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (let c = 12; c <= 25; c++) {
    const label = excelSerialToDay(headerRow[c]) || s(headerRow[c], 40);
    if (!label) continue;
    const val = row[c];
    out[label] = val === true || val === "x" || val === "X" || val === 1 || val === "1" || val === "yes" || val === "Yes";
  }
  return out;
}

export function resolveQapWeek50Path(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT
      ? path.join(process.env.SHARNAM_EXCEL_ROOT, "Quality Assurance Plan Week 50.xlsx")
      : "",
    path.join(process.cwd(), "seed", "data", "Quality Assurance Plan Week 50.xlsx"),
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", "Quality Assurance Plan Week 50.xlsx"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function parseQapWeek50Workbook(buffer: Buffer): {
  weekLabel: string;
  dayLabels: string[];
  rows: Array<QapDetailRow & { dailyChecks: Record<string, boolean> }>;
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames.find((n) => /sheet1/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
  }) as unknown[][];

  let weekLabel = "Week 50";
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    for (let c = 0; c < 20; c++) {
      const cell = s(rows[i]?.[c], 80);
      const m = cell.match(/week\s*(\d+)/i);
      if (m) weekLabel = `Week ${m[1]}`;
    }
  }

  const headerRow = rows[7] || [];
  const dayLabels: string[] = [];
  for (let c = 12; c <= 25; c++) {
    const label = excelSerialToDay(headerRow[c]) || s(headerRow[c], 40);
    if (label && (excelSerialToDay(headerRow[c]) || /^\d/.test(label))) dayLabels.push(label);
  }

  const base = parseQapDetailSheet(rows, 9);
  const enriched = base.map((row, idx) => {
    const srcIdx = 9 + idx;
    const src = rows[srcIdx] as unknown[] | undefined;
    return {
      ...row,
      dailyChecks: src ? parseDailyChecks(src, headerRow) : {},
    };
  });

  return { weekLabel, dayLabels, rows: enriched };
}

export async function importQapWorkbook(projectId: string, buffer: Buffer, replaceWeek = true) {
  const parsed = parseQapWeek50Workbook(buffer);
  if (!parsed.rows.length) throw new Error("No QAP rows found — use Quality Assurance Plan Week 50.xlsx layout");

  await prisma.$transaction(async (tx) => {
    if (replaceWeek) {
      await tx.qapActivity.deleteMany({ where: { projectId, weekLabel: parsed.weekLabel } });
    }
    for (const row of parsed.rows) {
      const flags = qapStatusFromRow(row);
      await tx.qapActivity.create({
        data: {
          projectId,
          weekLabel: parsed.weekLabel,
          srNo: row.srNo,
          section: row.section,
          activity: row.section,
          description: row.description,
          frequency: row.frequency || null,
          codeOfConformance: row.codeOfConformance || null,
          testAgency: row.testAgency || null,
          contractorPerformer: row.contractorPerformer || null,
          contractorChecker: row.contractorChecker || null,
          pmcRole: row.pmcRole || null,
          clientRole: row.clientRole || null,
          records: row.records || null,
          remarks: row.remarks || null,
          dailyChecks: Object.keys(row.dailyChecks).length ? JSON.stringify(row.dailyChecks) : null,
          contractorOk: flags.contractorOk,
          pmcOk: flags.pmcOk,
          clientOk: flags.clientOk,
          status: flags.status,
          completedAt: flags.status === "Done" ? new Date() : null,
        },
      });
    }
  });

  return { weekLabel: parsed.weekLabel, imported: parsed.rows.length, dayLabels: parsed.dayLabels };
}

export async function exportQapWorkbook(projectId: string, weekLabel?: string) {
  const where: { projectId: string; weekLabel?: string } = { projectId };
  if (weekLabel) where.weekLabel = weekLabel;
  const rows = await prisma.qapActivity.findMany({
    where,
    orderBy: [{ weekLabel: "asc" }, { section: "asc" }, { srNo: "asc" }],
  });
  if (!rows.length) throw new Error("No QAP rows to export");

  const wl = weekLabel || rows[0]?.weekLabel || "Week 50";
  let dayLabels: string[] = [];
  for (const r of rows) {
    if (r.dailyChecks) {
      try {
        dayLabels = Object.keys(JSON.parse(r.dailyChecks));
        if (dayLabels.length) break;
      } catch {
        /* ignore */
      }
    }
  }
  while (dayLabels.length < 7) dayLabels.push("");

  const header = [
    "Sr.No.",
    "Activity",
    "Description of Activity / Material",
    "Frequency of check",
    "Code of Conformance",
    "Test agency",
    "Contractor Performer",
    "Contractor Checker",
    "PMC",
    "CLIENT",
    "Records and documents to be Maintained",
    "Remarks if any",
    ...dayLabels.slice(0, 7),
  ];

  const dataRows = rows.map((r) => {
    let daily: Record<string, boolean> = {};
    if (r.dailyChecks) {
      try {
        daily = JSON.parse(r.dailyChecks);
      } catch {
        daily = {};
      }
    }
    return [
      r.srNo || "",
      r.section || r.activity,
      r.description || "",
      r.frequency || "",
      r.codeOfConformance || "",
      r.testAgency || "",
      r.contractorPerformer || "",
      r.contractorChecker || "",
      r.pmcRole || "",
      r.clientRole || "",
      r.records || "",
      r.remarks || "",
      ...dayLabels.slice(0, 7).map((d) => (daily[d] ? "x" : "")),
    ];
  });

  const sheets: SheetSpec[] = [{ name: "Sheet1", rows: [header, ...dataRows] }];
  return { weekLabel: wl, buffer: workbookBuffer(sheets), sheets };
}

export async function exportQapHtml(projectId: string, weekLabel?: string) {
  const { weekLabel: wl, sheets } = await exportQapWorkbook(projectId, weekLabel);
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const rows = await prisma.qapActivity.findMany({ where: { projectId, ...(weekLabel ? { weekLabel } : {}) } });
  return renderBrandedReportHtml({
    title: "Quality Assurance Plan",
    subtitle: `${wl} — exported from portal`,
    project,
    kpis: [
      { label: "Total lines", value: rows.length },
      { label: "Open", value: rows.filter((r) => r.status === "Open").length },
      { label: "Done", value: rows.filter((r) => r.status === "Done").length },
    ],
    sections: [
      {
        heading: "QAP register",
        headers: sheets[0].rows[0] as string[],
        rows: sheets[0].rows.slice(1) as (string | number)[][],
      },
    ],
  });
}
