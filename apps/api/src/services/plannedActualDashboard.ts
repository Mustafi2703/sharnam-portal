/**
 * Planned Vs. Actual Dashboard.xlsx — import / export.
 * Activity qty from "As per drawing status" sheet (client workbook layout).
 */
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { renderBrandedReportHtml, workbookBuffer, type SheetSpec } from "./brandedExport.js";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function s(v: unknown, max = 500) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const num = Number(v);
  if (!Number.isFinite(num) || num < 20000) return null;
  const ms = (num - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export type ParsedPlannedActual = {
  cashflow: Array<{
    periodLabel: string;
    packageName: string;
    plannedAmount: number;
    actualAmount: number;
    plannedPct: number;
    actualPct: number;
  }>;
  manpower: Array<{
    trade: string;
    required: number;
    available: number;
    shortage: number;
    shortagePct: number;
    rank: number;
  }>;
  activityLines: Array<{
    srNo: number;
    tower: string | null;
    activity: string;
    unit: string | null;
    plannedStart: Date | null;
    plannedEnd: Date | null;
    boqQty: number;
    gfcQty: number;
    executedQty: number;
    balanceQty: number;
    weeklyPlanned: number;
    weeklyActual: number;
    cumulativeQty: number;
    status: string | null;
    pctComplete: number;
  }>;
};

function parseCashflowSheet(rows: unknown[][]): ParsedPlannedActual["cashflow"] {
  const out: ParsedPlannedActual["cashflow"] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const month = s(row[0], 40);
    const planned = n(row[3]);
    if (!month || !planned) continue;
    const actual = n(row[4]);
    out.push({
      periodLabel: month,
      packageName: s(row[1], 40) || "Overall",
      plannedAmount: planned,
      actualAmount: actual,
      plannedPct: planned ? 1 : 0,
      actualPct: planned ? Math.min(1.5, actual / planned) : 0,
    });
  }
  return out;
}

function parseManpowerSheet(rows: unknown[][]): ParsedPlannedActual["manpower"] {
  const out: ParsedPlannedActual["manpower"] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const trade = s(row[0], 80);
    if (!trade || /total/i.test(trade) || /^date$/i.test(trade)) break;
    if (!n(row[1]) && !n(row[2])) continue;
    out.push({
      trade,
      required: n(row[1]),
      available: n(row[2]),
      shortage: n(row[3]),
      shortagePct: n(row[4]),
      rank: Math.round(n(row[5])) || out.length + 1,
    });
  }
  return out;
}

/** "As per drawing status" — Sr, Tower, Activity, Unit, BOQ, GFC, Wk plan, Wk act, Total achieved */
function parseDrawingStatusSheet(rows: unknown[][]): ParsedPlannedActual["activityLines"] {
  const out: ParsedPlannedActual["activityLines"] = [];
  let lastTower = "";
  let startRow = rows.findIndex((r) => /sr\.?no/i.test(String((r as unknown[])[0]))) + 1;
  if (startRow <= 0) startRow = 3;
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const sr = n(row[0]);
    const activity = s(row[2], 200);
    if (!sr || !activity) continue;
    const towerCell = s(row[1], 80);
    if (towerCell) lastTower = towerCell;
    const tower = towerCell || lastTower || null;
    const gfc = n(row[5]);
    const totalAchieved = n(row[8]);
    out.push({
      srNo: sr,
      tower,
      activity,
      unit: s(row[3], 20) || null,
      plannedStart: null,
      plannedEnd: null,
      boqQty: n(row[4]),
      gfcQty: gfc,
      executedQty: totalAchieved,
      balanceQty: gfc > 0 ? Math.max(0, gfc - totalAchieved) : 0,
      weeklyPlanned: n(row[6]),
      weeklyActual: n(row[7]),
      cumulativeQty: totalAchieved,
      status: null,
      pctComplete: gfc > 0 ? Math.min(1.2, totalAchieved / gfc) : 0,
    });
  }
  return out;
}

/** Legacy "Planned Vs Actual" sheet with date columns */
function parseLegacyActivitySheet(rows: unknown[][]): ParsedPlannedActual["activityLines"] {
  const out: ParsedPlannedActual["activityLines"] = [];
  let lastTower = "";
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const sr = n(row[0]);
    const activity = s(row[2], 200);
    if (!sr || !activity) continue;
    const towerCell = s(row[1], 80);
    if (towerCell) lastTower = towerCell;
    const tower = towerCell || lastTower || null;
    const gfc = n(row[7]);
    const executed = n(row[8]);
    out.push({
      srNo: sr,
      tower,
      activity,
      unit: s(row[5], 20),
      plannedStart: excelDate(row[3]),
      plannedEnd: excelDate(row[4]),
      boqQty: n(row[6]),
      gfcQty: gfc,
      executedQty: executed,
      balanceQty: n(row[9]),
      weeklyPlanned: n(row[10]),
      weeklyActual: n(row[11]),
      cumulativeQty: n(row[12]) || executed,
      status: s(row[16], 40),
      pctComplete: gfc > 0 ? Math.min(1.2, executed / gfc) : n(row[17]),
    });
  }
  return out;
}

export function parsePlannedActualDashboard(buffer: Buffer): ParsedPlannedActual {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const cashName = wb.SheetNames.find((name) => /cashflow/i.test(name));
  const cashSheet =
    (cashName && wb.Sheets[cashName]) || wb.Sheets["Project Cashflow "] || wb.Sheets["Project Cashflow"];
  const manSheet = wb.Sheets["Weekly Manpower"];
  const drawSheet = wb.Sheets["As per drawing status"];
  const actName = wb.SheetNames.find((name) => /planned vs actual/i.test(name) && !/dashboard/i.test(name));
  const legacyActSheet = (actName && wb.Sheets[actName]) || wb.Sheets["Planned Vs Actual "] || wb.Sheets["Planned Vs Actual"];

  const cashRows = cashSheet
    ? (XLSX.utils.sheet_to_json<(string | number)[]>(cashSheet, { header: 1, defval: "" }) as unknown[][])
    : [];
  const manRows = manSheet
    ? (XLSX.utils.sheet_to_json<(string | number)[]>(manSheet, { header: 1, defval: "" }) as unknown[][])
    : [];
  const drawRows = drawSheet
    ? (XLSX.utils.sheet_to_json<(string | number)[]>(drawSheet, { header: 1, defval: "" }) as unknown[][])
    : [];
  const legacyActRows = legacyActSheet
    ? (XLSX.utils.sheet_to_json<(string | number)[]>(legacyActSheet, { header: 1, defval: "" }) as unknown[][])
    : [];

  const activityLines = drawRows.length
    ? parseDrawingStatusSheet(drawRows)
    : parseLegacyActivitySheet(legacyActRows);

  return {
    cashflow: parseCashflowSheet(cashRows),
    manpower: parseManpowerSheet(manRows),
    activityLines,
  };
}

export async function importPlannedActualDashboard(projectId: string, buffer: Buffer) {
  const parsed = parsePlannedActualDashboard(buffer);
  if (!parsed.cashflow.length && !parsed.manpower.length && !parsed.activityLines.length) {
    throw new Error("No recognised sheets — use Planned Vs. Actual Dashboard.xlsx or Progress Overview pack");
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.cashflow.length) {
      await tx.progressPlannedActual.deleteMany({ where: { projectId } });
      for (const row of parsed.cashflow) {
        await tx.progressPlannedActual.create({ data: { projectId, ...row } });
      }
    }
    if (parsed.manpower.length) {
      await tx.progressManpower.deleteMany({ where: { projectId } });
      for (const row of parsed.manpower) {
        await tx.progressManpower.create({ data: { projectId, ...row } });
      }
    }
    if (parsed.activityLines.length) {
      await tx.progressActivityLine.deleteMany({ where: { projectId } });
      for (const row of parsed.activityLines) {
        await tx.progressActivityLine.create({ data: { projectId, ...row } });
      }
    }
  });

  return {
    cashflow: parsed.cashflow.length,
    manpower: parsed.manpower.length,
    activityLines: parsed.activityLines.length,
  };
}

export async function loadPlannedActualExportData(projectId: string) {
  const [project, cashflow, manpower, activityLines] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    prisma.progressPlannedActual.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.progressManpower.findMany({ where: { projectId }, orderBy: { rank: "asc" } }),
    prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
  ]);
  return { project, cashflow, manpower, activityLines };
}

function inr(v: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);
}

export function plannedActualToSheets(data: Awaited<ReturnType<typeof loadPlannedActualExportData>>): SheetSpec[] {
  const { cashflow, manpower, activityLines } = data;
  return [
    {
      name: "Project Cashflow ",
      rows: [
        ["Month", "", "Budgeted work", "Planned Work ", "Actual Work", ""],
        ...cashflow.map((p) => [
          p.periodLabel,
          p.packageName,
          "",
          p.plannedAmount,
          p.actualAmount,
          p.plannedAmount ? p.actualAmount - p.plannedAmount : "",
        ]),
      ],
    },
    {
      name: "Weekly Manpower",
      rows: [
        ["Type of Manpower", "Required Manpower for week", "Available", "Shortage ", "% Shortage", "Rank"],
        ...manpower.map((m) => [m.trade, m.required, m.available, m.shortage, m.shortagePct, m.rank]),
      ],
    },
    {
      name: "As per drawing status",
      rows: [
        ["Weekly Executed Plan"],
        [],
        [
          "Sr.No.",
          "Tower",
          "Activity",
          "Unit ",
          "As per BOQ total Quantity",
          "As per GFC total Quantity",
          "Weekly planned Qty.",
          "Weekly actual Qty.",
          "Total Achieved Qty.",
        ],
        ...activityLines.map((a) => [
          a.srNo,
          a.tower || "",
          a.activity,
          a.unit || "",
          a.boqQty,
          a.gfcQty,
          a.weeklyPlanned,
          a.weeklyActual,
          a.cumulativeQty || a.executedQty,
        ]),
      ],
    },
  ];
}

export async function buildPlannedActualWorkbook(projectId: string): Promise<Buffer> {
  const data = await loadPlannedActualExportData(projectId);
  return workbookBuffer(plannedActualToSheets(data), {
    title: "Planned Vs. Actual Dashboard",
    projectCode: data.project.code,
  });
}

export async function renderPlannedActualHtml(projectId: string): Promise<string> {
  const data = await loadPlannedActualExportData(projectId);
  const p = data.project;
  const avgPct =
    data.cashflow.length > 0
      ? data.cashflow.reduce((sum, row) => sum + row.actualPct, 0) / data.cashflow.length
      : 0;

  return renderBrandedReportHtml({
    title: "Planned Vs. Actual Dashboard",
    subtitle: "Cashflow · weekly manpower · as per drawing status",
    project: { code: p.code, name: p.name, clientName: p.clientName, location: p.location },
    kpis: [
      { label: "Cashflow periods", value: data.cashflow.length },
      { label: "Activity lines", value: data.activityLines.length },
      { label: "Manpower trades", value: data.manpower.length },
      { label: "Avg cashflow %", value: `${Math.round(avgPct * 100)}%` },
    ],
    sections: [
      {
        heading: "Project cashflow · planned vs actual",
        headers: ["Month", "Package", "Planned", "Actual", "Actual %"],
        rows: data.cashflow.map((row) => [
          row.periodLabel,
          row.packageName,
          inr(row.plannedAmount),
          inr(row.actualAmount),
          `${Math.round(row.actualPct * 100)}%`,
        ]),
      },
      {
        heading: "Weekly manpower",
        headers: ["Trade", "Required", "Available", "Shortage", "Shortage %"],
        rows: data.manpower.map((m) => [
          m.trade,
          m.required,
          m.available,
          m.shortage,
          `${Math.round((m.shortagePct || 0) * 100)}%`,
        ]),
      },
      {
        heading: "As per drawing status",
        headers: ["#", "Tower", "Activity", "Unit", "BOQ", "GFC", "Wk plan", "Wk act", "Total achieved"],
        rows: data.activityLines.map((a) => [
          a.srNo,
          a.tower || "—",
          a.activity,
          a.unit || "—",
          a.boqQty,
          a.gfcQty,
          a.weeklyPlanned,
          a.weeklyActual,
          a.cumulativeQty || a.executedQty,
        ]),
      },
    ],
  });
}
