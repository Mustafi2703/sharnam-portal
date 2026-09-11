/**
 * Merge live chart API data with WPR section tables — same logic as web wprChartFallback.
 */
import type { WprChartPack } from "./wprCharts.js";
import type { WprSections } from "./wprXlsx.js";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type Section = { rows?: (string | number | null)[][] };

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

export function mergeWprChartsForExport(
  sections: WprSections,
  api: WprChartPack | null | undefined,
  rangeStart: string,
  rangeEnd: string
): WprChartPack {
  const base: WprChartPack = api || {
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

  const milestoneNamed = barRows(sections.milestones, 2, 5, 8);
  const milestoneShort = barRows(sections.milestones, 1, 2, 3);
  const milestones = base.milestones.length
    ? base.milestones
    : milestoneNamed.filter((r) => r.planned || r.actual).length
      ? milestoneNamed
      : milestoneShort.length
        ? milestoneShort
        : barRows(sections.milestones, 0, 1, 2);

  const pvaDirect = barRows(sections.plannedVsActual, 0, 1, 2);
  const pvaActivity = (sections.plannedVsActual?.rows || [])
    .map((row) => ({
      label: `${String(row[1] ?? "")} ${String(row[2] ?? "")}`.trim().slice(0, 28),
      planned: num(row[10] ?? row[6]),
      actual: num(row[11] ?? row[7]),
    }))
    .filter((r) => r.label && (r.planned || r.actual));
  const execBars = (sections.weeklyExecuted?.rows || [])
    .map((row) => ({
      label: `${String(row[1] ?? "")} ${String(row[2] ?? "")}`.trim().slice(0, 28),
      planned: num(row[6]),
      actual: num(row[7]),
    }))
    .filter((r) => r.label && (r.planned || r.actual));
  const plannedVsActual = base.plannedVsActual.length
    ? base.plannedVsActual
    : pvaActivity.length
      ? pvaActivity.slice(0, 24)
      : pvaDirect.length
        ? pvaDirect
        : execBars.slice(0, 24);

  const manpowerHistogram = base.manpowerHistogram.length
    ? base.manpowerHistogram
    : barRows(sections.manpowerHistogram, 0, 1, 2);

  const cashflowSeed = barRows(sections.cashflow, 0, 2, 3);
  const cashflowJuly = barRows(sections.cashflow, 0, 3, 4);
  const cashflowScore = (rows: { planned: number; actual: number }[]) =>
    rows.filter((r) => r.planned || r.actual).length;
  const cashflow = base.cashflow.length
    ? base.cashflow
    : cashflowScore(cashflowJuly) > cashflowScore(cashflowSeed)
      ? cashflowJuly
      : cashflowSeed.length
        ? cashflowSeed
        : barRows(sections.cashflow, 0, 1, 2);

  const drawingByDisc = (() => {
    const counts = new Map<string, number>();
    for (const row of sections.drawingRegister?.rows || []) {
      const a = String(row[0] ?? "").trim();
      if (!a || /^sr/i.test(a) || /^total$/i.test(a) || /discipline/i.test(a)) continue;
      const key = /^(ST|S)/i.test(a)
        ? "Structural"
        : /^A/i.test(a)
          ? "Architecture"
          : /^E/i.test(a)
            ? "Electrical"
            : /^P/i.test(a)
              ? "Plumbing"
              : /^F/i.test(a)
                ? "Fire"
                : a.slice(0, 18);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts].map(([label, value]) => ({ label, value }));
  })();
  const drawingDci = base.drawingDci.length
    ? base.drawingDci
    : drawingByDisc.length
      ? drawingByDisc
      : pieFromRows(sections.drawingRegister, 1, 4);

  const qualityFromObs = pieFromRows(sections.quality, 1, 2);
  const quality = base.quality.length
    ? base.quality
    : qualityFromObs.length
      ? qualityFromObs
      : pieFromRows(sections.quality, 0, 1);

  const safetyFromHse = (sections.safety?.rows || [])
    .map((row) => ({
      label: String(row[1] ?? row[0] ?? "").trim(),
      previous: num(row[2]),
      current: num(row[3]),
    }))
    .filter((r) => r.label && !/^sr\.?no/i.test(r.label) && (r.previous > 0 || r.current > 0));

  const scurveFromCash = (() => {
    if (!cashflow.length) return [];
    const pTot = cashflow.reduce((s, r) => s + r.planned, 0);
    const aTot = cashflow.reduce((s, r) => s + r.actual, 0);
    if (!pTot && !aTot) return [];
    let p = 0;
    let a = 0;
    return cashflow.map((r) => {
      p += r.planned;
      a += r.actual;
      return {
        date: rangeStart,
        label: r.label,
        planned: pTot ? Math.round((p / pTot) * 1000) / 10 : 0,
        actual: aTot ? Math.round((a / aTot) * 1000) / 10 : 0,
      };
    });
  })();
  const scurve =
    base.scurve.some((p) => p.planned || p.actual)
      ? base.scurve
      : scurveFromCash.length
        ? scurveFromCash
        : plannedVsActual.length > 0
          ? plannedVsActual.slice(0, 12).map((r, i) => ({
              date: rangeStart,
              label: r.label || `P${i + 1}`,
              planned: r.planned,
              actual: r.actual,
            }))
          : [
              {
                date: rangeEnd,
                label: "Period",
                planned: base.summary.plannedPct,
                actual: base.summary.actualPct,
              },
            ];

  const summary = {
    ...base.summary,
    plannedPct: base.summary.plannedPct || (plannedVsActual[0]?.planned ?? scurve.at(-1)?.planned ?? 0),
    actualPct: base.summary.actualPct || (plannedVsActual[0]?.actual ?? scurve.at(-1)?.actual ?? 0),
    milestonesTotal: base.summary.milestonesTotal || milestones.length,
  };
  summary.variancePct =
    summary.variancePct || Math.round((summary.actualPct - summary.plannedPct) * 10) / 10;
  summary.spi =
    summary.spi ||
    (summary.plannedPct > 0 ? Math.round((summary.actualPct / summary.plannedPct) * 100) / 100 : 1);

  const dashRows = (sections.projectDashboard?.rows || [])
    .filter((r) => String(r[0] || "").trim())
    .slice(0, 10)
    .map((r) => [String(r[0]), r[1] ?? "—"] as [string, string | number]);
  const dashboardKpis: [string, string | number][] = base.dashboardKpis.length
    ? base.dashboardKpis
    : dashRows.length
      ? dashRows
      : [
          ["Planned progress %", summary.plannedPct || "—"],
          ["Actual progress %", summary.actualPct || "—"],
          ["Variance %", summary.variancePct || "—"],
          ["SPI", summary.spi || "—"],
          ["DPR days in period", summary.dprDaysInRange || "—"],
          ["Open NCRs", summary.openNcrs || "—"],
          [
            "Milestones on track",
            summary.milestonesTotal ? `${summary.milestonesOnTrack}/${summary.milestonesTotal}` : "—",
          ],
          ["Drawings registered", summary.drawingsRegistered || "—"],
          ["Safety events (period)", summary.safetyEvents || "—"],
        ];

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
      : safetyFromHse.length
        ? safetyFromHse
        : [
            { label: "Toolbox Talk", previous: 0, current: 0 },
            { label: "HSE Inductions", previous: 0, current: 0 },
            { label: "Incidents", previous: 0, current: 0 },
            { label: "All events", previous: 0, current: 0 },
          ],
    dashboardKpis,
  };
}
