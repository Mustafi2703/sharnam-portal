/**
 * WPR dashboard charts — mirrors SPDC_Arvind Limited_WPR_50.pptx chart slides:
 * milestone Gantt-style bars, manpower histogram, cashflow, drawing DCI,
 * planned vs actual, quality pie, safety PW/CW bars, project S-curve.
 */
import type { PrismaClient } from "@prisma/client";
import { computeDpr, type DprLine, type DprSnapshot } from "./dprXlsx.js";

export type WprBarPoint = { label: string; planned: number; actual: number };
export type WprScurvePoint = { date: string; label: string; planned: number; actual: number };
export type WprPiePoint = { label: string; value: number };
export type WprSafetyPoint = { label: string; previous: number; current: number };

export type WprChartPack = {
  rangeStart: string;
  rangeEnd: string;
  summary: {
    plannedPct: number;
    actualPct: number;
    variancePct: number;
    spi: number;
    openNcrs: number;
    dprDaysInRange: number;
    milestonesOnTrack: number;
    milestonesTotal: number;
    drawingsRegistered: number;
    safetyEvents: number;
  };
  scurve: WprScurvePoint[];
  manpowerHistogram: WprBarPoint[];
  cashflow: WprBarPoint[];
  milestones: WprBarPoint[];
  drawingDci: WprPiePoint[];
  plannedVsActual: WprBarPoint[];
  quality: WprPiePoint[];
  safety: WprSafetyPoint[];
  dashboardKpis: [string, string | number][];
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function parseDprSnap(headerJson: string | null, linesJson: string | null): DprSnapshot {
  const raw = JSON.parse(headerJson || "{}") as Record<string, unknown>;
  const { _extras, ...header } = raw;
  const extras = (_extras || {}) as { manpower?: { trade: string; planned?: number; actual?: number }[] };
  return {
    discipline: "CIVIL",
    header: header as DprSnapshot["header"],
    lines: JSON.parse(linesJson || "[]") as DprLine[],
    manpower: extras.manpower,
  };
}

function avgActualPct(snaps: { headerJson: string | null; linesJson: string | null; logDate: Date }[]): number {
  if (!snaps.length) return 0;
  let sum = 0;
  for (const s of snaps) {
    const snap = parseDprSnap(s.headerJson, s.linesJson);
    sum += computeDpr(snap).kpis.actualPct * 100;
  }
  return Math.round((sum / snaps.length) * 10) / 10;
}

/** Build chart pack for any reporting window (day, week, or multi-week). */
export async function loadWprChartPack(
  prisma: PrismaClient,
  projectId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<WprChartPack> {
  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(23, 59, 59, 999);

  const prevStart = new Date(start);
  const spanMs = end.getTime() - start.getTime();
  prevStart.setTime(start.getTime() - spanMs - 86400000);

  const [
    dprSnaps,
    dailyLogs,
    milestones,
    registerLines,
    cashflow,
    plannedActual,
    activityLines,
    progressManpower,
    qap,
    cubes,
    safetyCurrent,
    safetyPrev,
    ncrs,
  ] = await Promise.all([
    prisma.dprSnapshot.findMany({
      where: { projectId, logDate: { gte: start, lte: end } },
      orderBy: { logDate: "asc" },
    }),
    prisma.dailyLog.findMany({
      where: { projectId, logDate: { gte: start, lte: end } },
      include: { manpower: true },
      orderBy: { logDate: "asc" },
    }),
    prisma.progressMilestone.findMany({ where: { projectId }, take: 130 }),
    prisma.drawingRegisterLine.findMany({ where: { projectId }, take: 200 }),
    prisma.costCashflowPeriod.findMany({
      where: { projectId, NOT: { packageName: "COP-day" } },
      orderBy: { periodDate: "asc" },
      take: 24,
    }),
    prisma.progressPlannedActual.findMany({ where: { projectId }, take: 24 }),
    prisma.progressActivityLine.findMany({
      where: { projectId },
      orderBy: { srNo: "asc" },
      take: 16,
    }),
    prisma.progressManpower.findMany({ where: { projectId }, orderBy: { rank: "asc" }, take: 20 }),
    prisma.qapActivity.findMany({
      where: { projectId },
      orderBy: { weekLabel: "desc" },
      take: 80,
    }),
    prisma.cubeTest.findMany({
      where: { projectId, castDate: { gte: start, lte: end } },
      take: 40,
    }),
    prisma.safetyRecord.findMany({
      where: { projectId, occurredAt: { gte: start, lte: end } },
      take: 80,
    }),
    prisma.safetyRecord.findMany({
      where: { projectId, occurredAt: { gte: prevStart, lt: start } },
      take: 80,
    }),
    prisma.qualityNcr.findMany({
      where: { projectId, OR: [{ status: "Open" }, { issueDate: { gte: start, lte: end } }] },
      take: 60,
    }),
  ]);

  const rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const useWeeklyPoints = rangeDays > 14;

  // S-curve: daily DPR actual % or weekly rollup
  const scurve: WprScurvePoint[] = [];
  if (useWeeklyPoints) {
    const byWeek = new Map<string, typeof dprSnaps>();
    for (const s of dprSnaps) {
      const wEnd = new Date(s.logDate);
      const day = wEnd.getDay();
      if (day !== 0) wEnd.setDate(wEnd.getDate() + (7 - day));
      const key = iso(wEnd);
      const bucket = byWeek.get(key) || [];
      bucket.push(s);
      byWeek.set(key, bucket);
    }
    for (const [date, snaps] of [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const d = new Date(date);
      scurve.push({
        date,
        label: dayLabel(d),
        planned: 0,
        actual: avgActualPct(snaps),
      });
    }
  } else {
    const byDay = new Map<string, typeof dprSnaps>();
    for (const s of dprSnaps) {
      const key = iso(s.logDate);
      const bucket = byDay.get(key) || [];
      bucket.push(s);
      byDay.set(key, bucket);
    }
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
      const d = new Date(t);
      const key = iso(d);
      const snaps = byDay.get(key) || [];
      scurve.push({
        date: key,
        label: dayLabel(d),
        planned: 0,
        actual: snaps.length ? avgActualPct(snaps) : 0,
      });
    }
  }

  // Manpower histogram — daily totals or trade shortage bars
  const manpowerHistogram: WprBarPoint[] = [];
  if (progressManpower.length > 0) {
    for (const m of progressManpower) {
      manpowerHistogram.push({
        label: (m.trade || "Trade").slice(0, 28),
        planned: Number(m.required || 0),
        actual: Number(m.available || 0),
      });
    }
  } else if (dailyLogs.length > 0) {
    for (const d of dailyLogs) {
      const total = d.manpower.reduce((s, m) => s + (m.workerCount || 0), 0);
      manpowerHistogram.push({ label: dayLabel(d.logDate), planned: 0, actual: total });
    }
  } else {
    const byDay = new Map<string, number>();
    for (const s of dprSnaps) {
      const extras = JSON.parse(s.headerJson || "{}")._extras || {};
      const mp = extras.manpower || [];
      const total = mp.reduce((sum: number, m: { actual?: number }) => sum + Number(m.actual || 0), 0);
      byDay.set(iso(s.logDate), (byDay.get(iso(s.logDate)) || 0) + total);
    }
    for (const [date, total] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      manpowerHistogram.push({ label: dayLabel(new Date(date)), planned: 0, actual: total });
    }
  }

  const cashRows = cashflow.length > 0 ? cashflow : plannedActual;
  const cashflowChart: WprBarPoint[] = cashRows.slice(-12).map((c) => ({
    label: (c.periodLabel || c.packageName || "Period").slice(0, 20),
    planned: Math.round(Number(c.plannedAmount || 0) / 100000) / 10,
    actual: Math.round(Number(c.actualAmount || 0) / 100000) / 10,
  }));

  const milestonesChart: WprBarPoint[] = milestones
    .filter((m) => m.activity)
    .slice(0, 14)
    .map((m) => ({
      label: (m.code || m.activity || "").slice(0, 24),
      planned: Number(m.plannedDays || 0),
      actual: Number(m.actualDays || 0),
    }));

  const disciplineCounts = new Map<string, number>();
  for (const d of registerLines) {
    const disc = (d.discipline || "Other").trim() || "Other";
    disciplineCounts.set(disc, (disciplineCounts.get(disc) || 0) + 1);
  }
  const drawingDci: WprPiePoint[] = [...disciplineCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  const plannedVsActual: WprBarPoint[] = activityLines
    .filter((a) => a.activity && (a.weeklyPlanned || a.weeklyActual || a.executedQty))
    .slice(0, 12)
    .map((a) => ({
      label: (a.activity || "").slice(0, 28),
      planned: Number(a.weeklyPlanned || 0),
      actual: Number(a.weeklyActual || a.executedQty || 0),
    }));

  const qapStatus = new Map<string, number>();
  for (const q of qap) {
    const st = (q.status || "Pending").trim();
    qapStatus.set(st, (qapStatus.get(st) || 0) + 1);
  }
  const quality: WprPiePoint[] = [...qapStatus.entries()].map(([label, value]) => ({ label, value }));
  if (cubes.length) {
    quality.push({ label: "Cube tests (period)", value: cubes.length });
  }

  const countSafety = (rows: typeof safetyCurrent, needle: string) =>
    rows.filter((s) => (s.recordType || "").toLowerCase().includes(needle)).length;

  const safety: WprSafetyPoint[] = [
    {
      label: "Toolbox Talk",
      previous: countSafety(safetyPrev, "tool"),
      current: countSafety(safetyCurrent, "tool"),
    },
    {
      label: "HSE Inductions",
      previous: countSafety(safetyPrev, "induct"),
      current: countSafety(safetyCurrent, "induct"),
    },
    {
      label: "Incidents",
      previous: countSafety(safetyPrev, "incident"),
      current: countSafety(safetyCurrent, "incident"),
    },
    {
      label: "All events",
      previous: safetyPrev.length,
      current: safetyCurrent.length,
    },
  ];

  const pvaRow = plannedActual[plannedActual.length - 1];
  const plannedPct = Math.round(Number(pvaRow?.plannedPct || 0) * 1000) / 10;
  const actualPct = Math.round(Number(pvaRow?.actualPct || 0) * 1000) / 10;
  const variancePct = Math.round((actualPct - plannedPct) * 10) / 10;
  const spi = plannedPct > 0 ? Math.round((actualPct / plannedPct) * 100) / 100 : 1;

  const onTrack = milestones.filter(
    (m) => (m.varianceDays || 0) <= 0 && (m.status || "").toLowerCase() !== "delayed"
  ).length;

  const dashboardKpis: [string, string | number][] = [
    ["Planned progress %", plannedPct || "—"],
    ["Actual progress %", actualPct || "—"],
    ["Variance %", variancePct || "—"],
    ["SPI", spi || "—"],
    ["DPR days in period", dprSnaps.length ? new Set(dprSnaps.map((s) => iso(s.logDate))).size : 0],
    ["Open NCRs", ncrs.filter((n) => n.status === "Open").length],
    ["Milestones on track", milestones.length ? `${onTrack}/${milestones.length}` : "—"],
    ["Drawings registered", registerLines.length || "—"],
    ["Safety events (period)", safetyCurrent.length],
    ["Cube tests (period)", cubes.length],
  ];

  return {
    rangeStart: iso(start),
    rangeEnd: iso(end),
    summary: {
      plannedPct,
      actualPct,
      variancePct,
      spi,
      openNcrs: ncrs.filter((n) => n.status === "Open").length,
      dprDaysInRange: new Set(dprSnaps.map((s) => iso(s.logDate))).size,
      milestonesOnTrack: onTrack,
      milestonesTotal: milestones.length,
      drawingsRegistered: registerLines.length,
      safetyEvents: safetyCurrent.length,
    },
    scurve: scurve.slice(-16),
    manpowerHistogram: manpowerHistogram.slice(-14),
    cashflow: cashflowChart,
    milestones: milestonesChart,
    drawingDci,
    plannedVsActual,
    quality,
    safety,
    dashboardKpis,
  };
}
