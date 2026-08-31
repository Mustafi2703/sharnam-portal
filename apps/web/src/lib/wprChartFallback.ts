import type { WprCharts } from "../components/WprDashboardCharts";

type Section = {
  title?: string;
  headers?: string[];
  rows?: (string | number | null)[][];
};

type PackLike = {
  weekStart: string;
  weekEnd: string;
  sections: Record<string, Section>;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function barRows(sec: Section | undefined, labelCol = 0, plannedCol = 1, actualCol = 2) {
  if (!sec?.rows?.length) return [];
  return sec.rows
    .map((row) => ({
      label: String(row[labelCol] ?? "").slice(0, 28),
      planned: num(row[plannedCol]),
      actual: num(row[actualCol]),
    }))
    .filter((r) => r.label);
}

function pieFromRows(sec: Section | undefined, labelCol = 0, valueCol = 1) {
  if (!sec?.rows?.length) return [];
  return sec.rows
    .map((row) => ({ label: String(row[labelCol] ?? ""), value: num(row[valueCol]) }))
    .filter((r) => r.label && r.value > 0);
}

/** Merge API charts with WPR section tables so dashboard always has something to render. */
export function mergeWprCharts(pack: PackLike, api: WprCharts | null | undefined): WprCharts {
  const rangeStart = pack.weekStart.slice(0, 10);
  const rangeEnd = pack.weekEnd.slice(0, 10);
  const base: WprCharts = api || {
    rangeStart,
    rangeEnd,
    summary: {
      plannedPct: 0,
      actualPct: 0,
      variancePct: 0,
      spi: 0,
      openNcrs: 0,
      dprDaysInRange: 0,
      milestonesOnTrack: 0,
      milestonesTotal: 0,
      drawingsRegistered: 0,
      safetyEvents: 0,
    },
    scurve: [],
    manpowerHistogram: [],
    cashflow: [],
    milestones: [],
    drawingDci: [],
    plannedVsActual: [],
    quality: [],
    safety: [],
    dashboardKpis: [],
  };

  const milestones = base.milestones.length
    ? base.milestones
    : barRows(pack.sections.milestones, 1, 2, 3).length
      ? barRows(pack.sections.milestones, 1, 2, 3)
      : barRows(pack.sections.milestones, 0, 1, 2);

  const plannedVsActual = base.plannedVsActual.length
    ? base.plannedVsActual
    : barRows(pack.sections.plannedVsActual, 0, 1, 2);

  const manpowerHistogram = base.manpowerHistogram.length
    ? base.manpowerHistogram
    : barRows(pack.sections.manpowerHistogram, 0, 1, 2);

  const cashflow = base.cashflow.length
    ? base.cashflow
    : barRows(pack.sections.cashflow, 0, 1, 2);

  const drawingDci = base.drawingDci.length
    ? base.drawingDci
    : pieFromRows(pack.sections.drawingRegister, 1, 4);

  const quality = base.quality.length ? base.quality : pieFromRows(pack.sections.quality, 0, 1);

  const scurve =
    base.scurve.length > 0
      ? base.scurve
      : plannedVsActual.length > 0
        ? plannedVsActual.map((r, i) => ({
            date: rangeStart,
            label: r.label || `P${i + 1}`,
            planned: r.planned,
            actual: r.actual,
          }))
        : [{ date: rangeEnd, label: "Week", planned: base.summary.plannedPct, actual: base.summary.actualPct }];

  const summary = {
    ...base.summary,
    plannedPct: base.summary.plannedPct || (plannedVsActual[0]?.planned ?? 0),
    actualPct: base.summary.actualPct || (plannedVsActual[0]?.actual ?? 0),
    milestonesTotal: base.summary.milestonesTotal || milestones.length,
  };
  summary.variancePct = summary.variancePct || Math.round((summary.actualPct - summary.plannedPct) * 10) / 10;
  summary.spi = summary.spi || (summary.plannedPct > 0 ? Math.round((summary.actualPct / summary.plannedPct) * 100) / 100 : 1);

  return {
    ...base,
    rangeStart: base.rangeStart || rangeStart,
    rangeEnd: base.rangeEnd || rangeEnd,
    summary,
    scurve,
    milestones,
    plannedVsActual,
    manpowerHistogram,
    cashflow,
    drawingDci,
    quality,
    safety: base.safety.length
      ? base.safety
      : [
          { label: "Toolbox Talk", previous: 0, current: 0 },
          { label: "Incidents", previous: 0, current: 0 },
        ],
  };
}
