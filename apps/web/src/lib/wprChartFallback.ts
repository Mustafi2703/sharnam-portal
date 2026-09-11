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
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/[,₹%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function barRows(sec: Section | undefined, labelCol = 0, plannedCol = 1, actualCol = 2) {
  if (!sec?.rows?.length) return [];
  return sec.rows
    .map((row) => ({
      label: String(row[labelCol] ?? "").trim().slice(0, 28),
      planned: num(row[plannedCol]),
      actual: num(row[actualCol]),
    }))
    .filter((r) => r.label && !/^sr\.?n/i.test(r.label) && !/^month$/i.test(r.label));
}

function pieFromRows(sec: Section | undefined, labelCol = 0, valueCol = 1) {
  if (!sec?.rows?.length) return [];
  return sec.rows
    .map((row) => ({ label: String(row[labelCol] ?? "").trim(), value: num(row[valueCol]) }))
    .filter((r) => r.label && r.value > 0 && !/^sr\.?n/i.test(r.label));
}

/** Merge API charts with WPR section tables so the dashboard matches the July source sheets. */
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

  const milestoneBars = barRows(pack.sections.milestones, 2, 5, 8).length
    ? barRows(pack.sections.milestones, 2, 5, 8)
    : barRows(pack.sections.milestones, 1, 2, 3).length
      ? barRows(pack.sections.milestones, 1, 2, 3)
      : barRows(pack.sections.milestones, 0, 1, 2);
  const milestones = base.milestones.length ? base.milestones : milestoneBars;

  const pvaActivity = (pack.sections.plannedVsActual?.rows || [])
    .map((row) => ({
      label: `${String(row[1] ?? "")} ${String(row[2] ?? "")}`.trim().slice(0, 28),
      planned: num(row[10] ?? row[6]),
      actual: num(row[11] ?? row[7]),
    }))
    .filter((r) => r.label && (r.planned || r.actual));
  const execBars = (pack.sections.weeklyExecuted?.rows || [])
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
      : execBars.slice(0, 24);

  const manpowerHistogram = base.manpowerHistogram.length
    ? base.manpowerHistogram
    : barRows(pack.sections.manpowerHistogram, 0, 1, 2);

  const cashflowJuly = barRows(pack.sections.cashflow, 0, 3, 4);
  const cashflowSeed = barRows(pack.sections.cashflow, 0, 2, 3);
  const cashScore = (rows: { planned: number; actual: number }[]) => rows.filter((r) => r.planned || r.actual).length;
  const cashflow = base.cashflow.length
    ? base.cashflow
    : cashScore(cashflowJuly) >= cashScore(cashflowSeed)
      ? cashflowJuly
      : cashflowSeed;

  const drawingByDisc = (() => {
    const counts = new Map<string, number>();
    for (const row of pack.sections.drawingRegister?.rows || []) {
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
      : pieFromRows(pack.sections.drawingRegister, 1, 8).length
        ? pieFromRows(pack.sections.drawingRegister, 1, 8)
        : pieFromRows(pack.sections.weeklyExecuted, 1, 8);

  const qualityFromObs = pieFromRows(pack.sections.quality, 1, 2);
  const quality = base.quality.length ? base.quality : qualityFromObs.length ? qualityFromObs : pieFromRows(pack.sections.quality, 0, 1);

  const safetyFromHse = (pack.sections.safety?.rows || [])
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
        : plannedVsActual.length
          ? plannedVsActual.slice(0, 12).map((r, i) => ({
              date: rangeStart,
              label: r.label || `P${i + 1}`,
              planned: r.planned,
              actual: r.actual,
            }))
          : [{ date: rangeEnd, label: "Week", planned: base.summary.plannedPct, actual: base.summary.actualPct }];

  const ncrRow = (pack.sections.quality?.rows || []).find((r) => /ncr/i.test(String(r[1] ?? r[0] ?? "")));
  const summary = {
    ...base.summary,
    plannedPct: base.summary.plannedPct || Number(scurve.at(-1)?.planned) || 0,
    actualPct: base.summary.actualPct || Number(scurve.at(-1)?.actual) || 0,
    openNcrs: base.summary.openNcrs || num(ncrRow?.[3] ?? ncrRow?.[2]),
    milestonesTotal: base.summary.milestonesTotal || milestones.length,
    drawingsRegistered: base.summary.drawingsRegistered || (pack.sections.drawingRegister?.rows?.length || pack.sections.weeklyExecuted?.rows?.length || 0),
    safetyEvents: base.summary.safetyEvents || safetyFromHse.reduce((s, r) => s + r.current, 0),
  };
  summary.variancePct = summary.variancePct || Math.round((summary.actualPct - summary.plannedPct) * 10) / 10;
  summary.spi =
    summary.spi || (summary.plannedPct > 0 ? Math.round((summary.actualPct / summary.plannedPct) * 100) / 100 : 1);

  const dashboardKpis: [string, string | number][] = base.dashboardKpis.length
    ? base.dashboardKpis
    : (pack.sections.projectDashboard?.rows || [])
        .filter((r) => String(r[0] || "").trim())
        .slice(0, 10)
        .map((r) => [String(r[0]), r[1] ?? "—"] as [string, string | number]);

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
    safety: base.safety.some((x) => x.previous || x.current) ? base.safety : safetyFromHse,
    dashboardKpis: dashboardKpis.length ? dashboardKpis : base.dashboardKpis,
  };
}
