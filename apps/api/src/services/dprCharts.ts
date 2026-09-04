/**
 * DPR dashboard charts — KPIs, S-curve history, BOQ progress bars.
 * Powers DPR Maker UI, PDF/HTML export, and INPUT sheet S-curve rows.
 */
import { prisma } from "../prisma.js";
import {
  computeDpr,
  type DprHeader,
  type DprLine,
  type DprManpower,
  type DprSafety,
  type DprSnapshot,
} from "./dprXlsx.js";
import type ExcelJS from "exceljs";

export type DprChartPoint = { date: string; label: string; planned: number; actual: number };
export type DprScurveEntryInput = { date: string; label?: string; planned: number; actual: number };

export function normalizeScurveEntries(
  entries?: DprScurveEntryInput[]
): DprChartPoint[] | undefined {
  if (!entries?.length) return undefined;
  return entries
    .map((p) => ({
      date: p.date.slice(0, 10),
      label: p.label || p.date.slice(0, 10),
      planned: Number(p.planned) || 0,
      actual: Number(p.actual) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-13);
}
export type DprBarPoint = { label: string; planned: number; actual: number };
export type DprChartPack = {
  summary: {
    plannedPct: number;
    actualPct: number;
    variance: number;
    spi: number;
    overallStatus: string;
    earnedValueLakh: number;
    valueDoneTodayInr: number;
  };
  scurve: DprChartPoint[];
  boqProgress: DprBarPoint[];
  manpower: DprBarPoint[];
};

function parseSnap(headerJson: string | null, linesJson: string | null): DprSnapshot {
  const raw = JSON.parse(headerJson || "{}") as Record<string, unknown>;
  const { _extras, ...header } = raw;
  const extras = (_extras || {}) as {
    manpower?: DprManpower[];
    safety?: DprSafety;
  };
  return {
    discipline: "CIVIL",
    header: header as DprHeader,
    lines: JSON.parse(linesJson || "[]") as DprLine[],
    manpower: extras.manpower,
    safety: extras.safety,
  };
}

function snapActualPct(snap: DprSnapshot): number {
  return computeDpr(snap).kpis.actualPct;
}

/** Last 13 reporting dates → planned vs actual % for S-curve chart. */
export async function loadDprScurveHistory(
  projectId: string,
  discipline: string,
  logDate: Date,
  currentSnap: DprSnapshot,
  manualEntries?: DprScurveEntryInput[]
): Promise<DprChartPoint[]> {
  const manual = normalizeScurveEntries(manualEntries);
  if (manual?.length) return manual;

  const disciplineKey = discipline.toUpperCase();
  const registerPoints = await prisma.progressScurvePoint.findMany({
    where: {
      projectId,
      discipline: { in: [disciplineKey, "OVERALL"] },
      periodDate: { lte: logDate },
    },
    orderBy: { periodDate: "asc" },
    take: 13,
  });
  if (registerPoints.length) {
    return registerPoints.map((p) => ({
      date: p.periodDate.toISOString().slice(0, 10),
      label: p.periodLabel || p.periodDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      planned: Number(p.plannedPct) || 0,
      actual: Number(p.actualPct) || 0,
    }));
  }

  let msPlannedByDate = new Map<string, number>();
  try {
    const { loadMsProjectSummary } = await import("./msProjectSchedule.js");
    const ms = await loadMsProjectSummary(projectId);
    for (const p of ms.scurve || []) {
      msPlannedByDate.set(p.date.slice(0, 10), p.plannedPct);
    }
  } catch {
    /* MS Project schedule optional */
  }

  const end = new Date(logDate);
  end.setHours(23, 59, 59, 999);
  const prior = await prisma.dprSnapshot.findMany({
    where: { projectId, discipline, logDate: { lte: end } },
    orderBy: { logDate: "asc" },
    take: 12,
  });

  const points: DprChartPoint[] = [];
  for (const row of prior) {
    const snap = parseSnap(row.headerJson, row.linesJson);
    snap.discipline = discipline;
    snap.header.dataDate = row.logDate.toISOString();
    const computed = computeDpr(snap);
    const dateKey = row.logDate.toISOString().slice(0, 10);
    points.push({
      date: dateKey,
      label: row.logDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      planned: msPlannedByDate.has(dateKey)
        ? msPlannedByDate.get(dateKey)!
        : Math.round(computed.kpis.plannedPct * 1000) / 10,
      actual: Math.round(computed.kpis.actualPct * 1000) / 10,
    });
  }

  const hasToday = points.some((p) => p.date === logDate.toISOString().slice(0, 10));
  if (!hasToday) {
    const computed = computeDpr(currentSnap);
    const dateKey = logDate.toISOString().slice(0, 10);
    points.push({
      date: dateKey,
      label: logDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      planned: msPlannedByDate.has(dateKey)
        ? msPlannedByDate.get(dateKey)!
        : Math.round(computed.kpis.plannedPct * 1000) / 10,
      actual: Math.round(computed.kpis.actualPct * 1000) / 10,
    });
  }

  return points.slice(-13);
}

/** Map MS Project S-curve export → DPR chart points (for manual override after XML import). */
export async function msProjectScurveToDprPoints(projectId: string): Promise<DprChartPoint[]> {
  const { loadMsProjectSummary } = await import("./msProjectSchedule.js");
  const ms = await loadMsProjectSummary(projectId);
  return (ms.scurve || []).map((p) => ({
    date: p.date.slice(0, 10),
    label: p.periodLabel || p.date.slice(0, 10),
    planned: p.plannedPct,
    actual: p.actualPct,
  }));
}

export function buildDprChartPack(snap: DprSnapshot, scurve: DprChartPoint[] = []): DprChartPack {
  const computed = computeDpr(snap);
  const boqProgress = computed.rows.slice(0, 10).map((r) => ({
    label: (r.description || "Item").slice(0, 36),
    planned: Math.round(r.planned * 1000) / 10,
    actual: Math.round(r.pctComplete * 1000) / 10,
  }));

  const manpower = (snap.manpower || [])
    .filter((m) => m.trade && (m.planned || m.actual))
    .slice(0, 8)
    .map((m) => ({
      label: m.trade.slice(0, 24),
      planned: Number(m.planned || 0),
      actual: Number(m.actual || 0),
    }));

  return {
    summary: {
      plannedPct: Math.round(computed.kpis.plannedPct * 1000) / 10,
      actualPct: Math.round(computed.kpis.actualPct * 1000) / 10,
      variance: Math.round(computed.kpis.variance * 1000) / 10,
      spi: Math.round(computed.kpis.spi * 100) / 100,
      overallStatus: computed.kpis.overallStatus,
      earnedValueLakh: Math.round(computed.kpis.earnedValueLakh * 100) / 100,
      valueDoneTodayInr: Math.round(computed.kpis.valueDoneTodayInr),
    },
    scurve: scurve.length ? scurve : [
      {
        date: new Date().toISOString().slice(0, 10),
        label: "Today",
        planned: Math.round(computed.kpis.plannedPct * 1000) / 10,
        actual: Math.round(computed.kpis.actualPct * 1000) / 10,
      },
    ],
    boqProgress,
    manpower,
  };
}

/** Write S-curve history into INPUT rows 125–137 for DASHBOARD chart formulas. */
export function fillScurveHistorySheet(ws: ExcelJS.Worksheet, history: DprChartPoint[]) {
  const slice = history.slice(-13);
  for (let i = 0; i < 13; i++) {
    const row = 125 + i;
    const p = slice[i];
    if (!p) {
      ws.getCell(`A${row}`).value = null;
      ws.getCell(`B${row}`).value = null;
      ws.getCell(`C${row}`).value = null;
      continue;
    }
    const d = new Date(p.date);
    d.setHours(0, 0, 0, 0);
    ws.getCell(`A${row}`).value = d;
    ws.getCell(`B${row}`).value = p.planned / 100;
    ws.getCell(`C${row}`).value = p.actual / 100;
  }
}

/** Inline SVG for branded PDF — planned vs actual S-curve + summary bars. */
export function dprChartsSvg(charts: DprChartPack): string {
  const pts = charts.scurve;
  const w = 520;
  const h = 160;
  const pad = 28;
  const maxY = Math.max(100, ...pts.flatMap((p) => [p.planned, p.actual])) * 1.1;
  const step = pts.length > 1 ? (w - pad * 2) / (pts.length - 1) : 0;

  const toY = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const plannedPath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * step} ${toY(p.planned)}`)
    .join(" ");
  const actualPath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * step} ${toY(p.actual)}`)
    .join(" ");

  const barW = 36;
  const summaryX = 560;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 200" width="100%" style="max-width:720px;background:#f7f8fa;border:1px solid #e2e5eb;border-radius:10px">
  <text x="28" y="22" fill="#1a1d26" font-size="12" font-weight="700">S-curve · Planned vs Actual (%)</text>
  <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#d5dadd"/>
  <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="#d5dadd"/>
  <path d="${plannedPath}" fill="none" stroke="#2563EB" stroke-width="2.5"/>
  <path d="${actualPath}" fill="none" stroke="#0F766E" stroke-width="2.5"/>
  <text x="${w - 80}" y="36" fill="#2563EB" font-size="10">— Planned</text>
  <text x="${w - 80}" y="50" fill="#0F766E" font-size="10">— Actual</text>
  <text x="${summaryX}" y="22" fill="#1a1d26" font-size="12" font-weight="700">Today KPIs</text>
  <rect x="${summaryX}" y="40" width="${barW}" height="${(charts.summary.plannedPct / maxY) * 100}" fill="#2563EB" opacity="0.85"/>
  <rect x="${summaryX + 44}" y="40" width="${barW}" height="${(charts.summary.actualPct / maxY) * 100}" fill="#0F766E" opacity="0.85"/>
  <text x="${summaryX}" y="155" fill="#5c6578" font-size="9">Planned ${charts.summary.plannedPct}%</text>
  <text x="${summaryX + 44}" y="155" fill="#5c6578" font-size="9">Actual ${charts.summary.actualPct}%</text>
  <text x="${summaryX}" y="175" fill="#1a1d26" font-size="10">SPI ${charts.summary.spi} · ${charts.summary.overallStatus}</text>
</svg>`;
}
