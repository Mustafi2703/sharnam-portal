/**
 * DPR dashboard charts — KPIs, S-curve history, BOQ progress bars.
 * Powers DPR Maker UI, PDF/HTML export, and INPUT sheet S-curve rows.
 */
import { prisma } from "../prisma.js";
import {
  computeDpr,
  dprLineKey,
  dprSheetLines,
  type DprHeader,
  type DprLine,
  type DprManpower,
  type DprSafety,
  type DprSnapshot,
} from "./dprXlsx.js";
import type ExcelJS from "exceljs";

/** actual is null for future dates (planned only). */
export type DprChartPoint = { date: string; label: string; planned: number; actual: number | null };
export type DprScurveEntryInput = { date: string; label?: string; planned: number; actual: number | null };

export function formatScurveLabel(date: string, label?: string): string {
  const trimmed = (label || "").trim();
  if (trimmed && !/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed;
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  return trimmed || date.slice(0, 10);
}

export function normalizeScurveEntries(
  entries?: DprScurveEntryInput[]
): DprChartPoint[] | undefined {
  if (!entries?.length) return undefined;
  return entries
    .map((p) => ({
      date: p.date.slice(0, 10),
      label: formatScurveLabel(p.date, p.label),
      planned: Number(p.planned) || 0,
      // Blank actual = planned-only (future) point.
      actual: p.actual == null || (p.actual as unknown) === "" ? null : Number(p.actual) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-13);
}

function mergeSummaryWithScurve(
  kpis: ReturnType<typeof computeDpr>["kpis"],
  scurve: DprChartPoint[]
): DprChartPack["summary"] {
  const last = [...scurve].reverse().find((p) => p.actual != null) ?? null;
  let plannedPct = Math.round(kpis.plannedPct * 1000) / 10;
  let actualPct = Math.round(kpis.actualPct * 1000) / 10;
  if (plannedPct === 0 && last && last.planned > 0) {
    plannedPct = last.planned;
  }
  if (actualPct === 0 && last && (last.actual ?? 0) > 0) {
    actualPct = last.actual ?? 0;
  }
  const variance = Math.round((actualPct - plannedPct) * 10) / 10;
  const spi = plannedPct > 0 ? Math.round((actualPct / plannedPct) * 100) / 100 : 0;
  return {
    plannedPct,
    actualPct,
    variance,
    spi,
    overallStatus: actualPct >= plannedPct ? "ON PROGRAMME" : "BEHIND PROGRAMME",
    earnedValueLakh: Math.round(kpis.earnedValueLakh * 100) / 100,
    valueDoneTodayInr: Math.round(kpis.valueDoneTodayInr),
  };
}

function boqProgressBars(computed: ReturnType<typeof computeDpr>): DprBarPoint[] {
  const qtyMode = computed.rows.some(
    (r) => (Number(r.plannedQtyToday) || 0) > 0 || (Number(r.qtyToday) || 0) > 0
  );
  return computed.rows
    .filter((r) => r.description && (Number(r.scopeQty) || 0) > 0)
    .slice(0, 10)
    .map((r) => {
      const plannedQty = Number(r.plannedQtyToday) || 0;
      const qtyToday = Number(r.qtyToday) || 0;
      if (qtyMode) {
        return {
          label: (r.description || "Item").slice(0, 36),
          planned: Math.round(plannedQty * 1000) / 1000,
          actual: Math.round(qtyToday * 1000) / 1000,
        };
      }
      const planned = r.planned > 0 ? Math.round(r.planned * 1000) / 10 : 0;
      const actual = Math.round(r.pctComplete * 1000) / 10;
      return {
        label: (r.description || "Item").slice(0, 36),
        planned,
        actual,
      };
    });
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

const DAY = 86400000;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfDay = (d: Date | string) => {
  const x = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const validDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? startOfDay(v) : startOfDay(String(v).slice(0, 10));
  return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d;
};

/**
 * DPR S-curve on the template's 13 slots: 6 past reporting dates, today (slot 7), 6 future dates.
 * Planned % — manual entries, else the S-curve register (discipline, then OVERALL), else the lines' planned
 * start/finish weighted by scope × rate (same formula as the DASHBOARD sheet).
 * Actual % — each line's cumulative quantity on the date from the DPR history (pre-portal dates are spread
 * linearly from project start to the first DPR's opening quantity).
 */
export type DprScurveTimeline = {
  points: DprChartPoint[];
  dates: Date[];
  /** Cumulative qty per sheet line (15) × past date (6); null where unknown. */
  pastCum: (number | null)[][];
  plannedFrom: "lines" | "register" | "manual";
  actualFrom: "dpr" | "manual";
};

function interpolate(points: { t: number; v: number }[], t: number): number {
  if (!points.length) return 0;
  if (t <= points[0].t) return points[0].t === t ? points[0].v : 0;
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i].t) {
      const a = points[i - 1];
      const b = points[i];
      return a.v + ((b.v - a.v) * (t - a.t)) / Math.max(1, b.t - a.t);
    }
  }
  return points[points.length - 1].v;
}

function linePlannedPct(lines: DprLine[], d: Date): number {
  const w = lines.map((l) => (Number(l.scopeQty) || 0) * (Number(l.rate) || 0));
  const total = w.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  let sum = 0;
  lines.forEach((l, i) => {
    const s = validDate(l.start);
    const f = validDate(l.finish);
    if (!s || !f || !w[i]) return;
    const frac = d >= f ? 1 : d < s ? 0 : (d.getTime() - s.getTime() + DAY) / (f.getTime() - s.getTime() + DAY);
    sum += (w[i] / total) * Math.min(1, Math.max(0, frac));
  });
  return Math.round(sum * 1000) / 10;
}

function lineActualPct(lines: DprLine[], cum: (number | null)[]): number {
  const w = lines.map((l) => (Number(l.scopeQty) > 0 ? Number(l.scopeQty) * (Number(l.rate) || 0) : 0));
  const total = w.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const sum = lines.reduce((acc, l, i) => acc + (w[i] ? (w[i] / total) * Math.min(1, (cum[i] ?? 0) / Number(l.scopeQty)) : 0), 0);
  return Math.round(sum * 1000) / 10;
}

export async function buildDprScurveTimeline(
  projectId: string,
  discipline: string,
  logDate: Date,
  currentSnap: DprSnapshot,
  manualEntries?: DprChartPoint[]
): Promise<DprScurveTimeline> {
  const today = startOfDay(logDate);
  const lines = dprSheetLines(currentSnap.lines || []);
  const keys = lines.map((l) => dprLineKey(l));

  const [history, project, register] = await Promise.all([
    prisma.dprSnapshot.findMany({
      where: { projectId, discipline, logDate: { lt: today } },
      orderBy: { logDate: "asc" },
      select: { logDate: true, linesJson: true },
    }),
    prisma.project.findUnique({ where: { id: projectId }, select: { startDate: true, endDate: true } }),
    prisma.progressScurvePoint.findMany({
      where: { projectId, discipline: { in: [discipline.toUpperCase(), "OVERALL"] } },
      orderBy: { periodDate: "asc" },
    }),
  ]);

  // Cumulative qty per line key on each DPR day (cum prev + qty today), and the opening qty of the first DPR.
  const daily = history.map((h) => {
    const map = new Map<string, { cum: number; prev: number }>();
    try {
      for (const l of JSON.parse(h.linesJson || "[]") as DprLine[]) {
        map.set(dprLineKey(l), { cum: (Number(l.cumQtyPrev) || 0) + (Number(l.qtyToday) || 0), prev: Number(l.cumQtyPrev) || 0 });
      }
    } catch {
      /* skip unreadable day */
    }
    return { date: startOfDay(h.logDate), map };
  });

  const lineStarts = lines.map((l) => validDate(l.start)).filter((d): d is Date => !!d);
  const lineEnds = lines.map((l) => validDate(l.finish)).filter((d): d is Date => !!d);
  const projectStart =
    [validDate(project?.startDate), daily[0]?.date, ...lineStarts]
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? new Date(today.getTime() - 42 * DAY);

  // 6 past dates spread from project start to yesterday, so the curve covers the whole project to date.
  const from = projectStart.getTime();
  const to = Math.max(from, today.getTime() - DAY);
  const past = Array.from({ length: 6 }, (_, i) => startOfDay(new Date(from + ((to - from) * i) / 5)));
  // 6 future dates up to the latest planned finish (contract completion), at least 6 weeks out.
  const finish = [validDate(project?.endDate), ...lineEnds]
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const end = finish && finish > today ? finish : new Date(today.getTime() + 42 * DAY);
  const future = Array.from({ length: 6 }, (_, i) => startOfDay(new Date(today.getTime() + ((end.getTime() - today.getTime()) * (i + 1)) / 6)));
  const dates = [...past, today, ...future];

  const first = daily[0];
  const cumAt = (key: string, d: Date, todayCum: number, todayPrev: number): number | null => {
    for (let i = daily.length - 1; i >= 0; i--) {
      if (daily[i].date <= d) {
        const hit = daily[i].map.get(key);
        if (hit) return hit.cum;
      }
    }
    // Before the first DPR: spread the opening quantity from project start (no records exist for those dates).
    const anchorDate = first?.date ?? today;
    const opening = first ? first.map.get(key)?.prev : todayPrev;
    if (opening == null) return null;
    const span = anchorDate.getTime() - projectStart.getTime();
    if (span <= 0) return d >= anchorDate ? todayCum : 0;
    return Math.round(opening * Math.min(1, Math.max(0, (d.getTime() - projectStart.getTime()) / span)) * 1000) / 1000;
  };
  // Capped at scope, like the DASHBOARD's MIN(done / scope, 1) — S-Curve Calc row 20 has no cap of its own.
  const pastCum = lines.map((l, i) =>
    past.map((d) => {
      const v = cumAt(keys[i], d, (Number(l.cumQtyPrev) || 0) + (Number(l.qtyToday) || 0), Number(l.cumQtyPrev) || 0);
      const scope = Number(l.scopeQty) || 0;
      return v == null ? null : scope > 0 ? Math.min(v, scope) : v;
    })
  );
  const todayCum = lines.map((l) => (Number(l.cumQtyPrev) || 0) + (Number(l.qtyToday) || 0));

  // Register: discipline points first, else OVERALL. Stored as % (MS Project import) or fractions (older UI).
  const byDisc = register.filter((p) => p.discipline === discipline.toUpperCase());
  const reg = byDisc.length ? byDisc : register.filter((p) => p.discipline === "OVERALL");
  const regScale = reg.length && Math.max(...reg.map((p) => Number(p.plannedPct) || 0)) <= 1 ? 100 : 1;
  const regPlanned = reg.map((p) => ({ t: startOfDay(p.periodDate).getTime(), v: (Number(p.plannedPct) || 0) * regScale }));

  const manual = manualEntries?.length ? manualEntries : null;
  const manualPlanned = manual?.map((p) => ({ t: startOfDay(p.date).getTime(), v: Number(p.planned) || 0 })) ?? [];
  const manualActual = manual?.filter((p) => p.actual != null).map((p) => ({ t: startOfDay(p.date).getTime(), v: Number(p.actual) || 0 })) ?? [];

  const plannedFrom: DprScurveTimeline["plannedFrom"] = manual ? "manual" : regPlanned.length ? "register" : "lines";
  const points: DprChartPoint[] = dates.map((d, i) => {
    const t = d.getTime();
    const planned =
      plannedFrom === "manual"
        ? Math.round(interpolate(manualPlanned, t) * 10) / 10
        : plannedFrom === "register"
          ? Math.round(interpolate(regPlanned, t) * 10) / 10
          : linePlannedPct(lines, d);
    const actual =
      i > 6
        ? null
        : manual && manualActual.length
          ? Math.round(interpolate(manualActual, t) * 10) / 10
          : lineActualPct(lines, i === 6 ? todayCum : pastCum.map((row) => row[i]));
    const key = dayKey(d);
    return { date: key, label: formatScurveLabel(key), planned, actual };
  });

  return { points, dates, pastCum, plannedFrom, actualFrom: manual && manualActual.length ? "manual" : "dpr" };
}

/** 13 S-curve points for the DPR Maker chart / PDF (same numbers as the Excel DASHBOARD chart). */
export async function loadDprScurveHistory(
  projectId: string,
  discipline: string,
  logDate: Date,
  currentSnap: DprSnapshot,
  manualEntries?: DprScurveEntryInput[]
): Promise<DprChartPoint[]> {
  const timeline = await buildDprScurveTimeline(projectId, discipline, logDate, currentSnap, normalizeScurveEntries(manualEntries));
  return timeline.points;
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
  const scurveSeries =
    scurve.length > 0
      ? scurve
      : [
          {
            date: (snap.header.dataDate || new Date().toISOString()).slice(0, 10),
            label: formatScurveLabel((snap.header.dataDate || new Date().toISOString()).slice(0, 10)),
            planned: Math.round(computed.kpis.plannedPct * 1000) / 10,
            actual: Math.round(computed.kpis.actualPct * 1000) / 10,
          },
        ];

  const manpower = (snap.manpower || [])
    .filter((m) => m.trade && (m.planned || m.actual))
    .slice(0, 8)
    .map((m) => ({
      label: m.trade.slice(0, 24),
      planned: Number(m.planned || 0),
      actual: Number(m.actual || 0),
    }));

  return {
    summary: mergeSummaryWithScurve(computed.kpis, scurveSeries),
    scurve: scurveSeries,
    boqProgress: boqProgressBars(computed),
    manpower,
  };
}

/** Build editable S-curve rows for DPR INPUT 125–137 (max 13 points). */
export function scurveEntriesFromChartPoints(points: DprChartPoint[]): DprScurveEntryInput[] {
  return points.slice(-13).map((p) => ({
    date: p.date,
    label: p.label,
    planned: p.planned,
    actual: p.actual,
  }));
}

/**
 * Put the timeline on the template the way it was designed:
 *  INPUT A125:A137 dates (6 past · today · 6 future); B125:B130 stay formulas reading S-Curve Calc row 20.
 *  S-Curve Calc F4:K4 past dates, F5:K19 each line's cumulative qty on those dates (L4 today, M4 next date).
 *  DASHBOARD Z5:Z17 / AA5:AA17 are overwritten only when planned / actual come from the register or manual entries.
 */
export function fillScurveTimeline(wb: ExcelJS.Workbook, t: DprScurveTimeline) {
  const input = wb.getWorksheet("INPUT");
  const calc = wb.getWorksheet("S-Curve Calc");
  const dash = wb.getWorksheet("DASHBOARD");
  if (!input) return;
  t.dates.forEach((d, i) => {
    input.getCell(`A${125 + i}`).value = d;
  });
  for (let i = 7; i < 13; i++) input.getCell(`B${125 + i}`).value = null;
  if (calc) {
    const cols = ["F", "G", "H", "I", "J", "K"];
    cols.forEach((c, j) => {
      calc.getCell(`${c}4`).value = t.dates[j];
    });
    calc.getCell("L4").value = t.dates[6];
    calc.getCell("M4").value = t.dates[7];
    for (let li = 0; li < 15; li++) {
      cols.forEach((c, j) => {
        const v = t.pastCum[li]?.[j];
        calc.getCell(`${c}${5 + li}`).value = v == null ? null : v;
      });
    }
  }
  if (t.actualFrom === "manual") {
    for (let i = 0; i < 6; i++) input.getCell(`B${125 + i}`).value = (t.points[i].actual ?? 0) / 100;
  }
  if (dash) {
    t.points.forEach((p, i) => {
      if (t.plannedFrom !== "lines") dash.getCell(`Z${5 + i}`).value = p.planned / 100;
      if (t.actualFrom === "manual") dash.getCell(`AA${5 + i}`).value = p.actual == null ? null : p.actual / 100;
      // Future slots: truly empty — the template's IF(…,"",…) returns text, which charts plot as 0.
      if (i > 6) dash.getCell(`AA${5 + i}`).value = null;
    });
  }
}

/** Inline SVG for branded PDF — planned vs actual S-curve + summary bars. */
export function dprChartsSvg(charts: DprChartPack): string {
  const pts = charts.scurve;
  const w = 520;
  const h = 160;
  const pad = 28;
  const maxY = Math.max(100, ...pts.flatMap((p) => [p.planned, p.actual ?? 0])) * 1.1;
  const step = pts.length > 1 ? (w - pad * 2) / (pts.length - 1) : 0;

  const toY = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const plannedPath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * step} ${toY(p.planned)}`)
    .join(" ");
  const actualPath = pts
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.actual != null)
    .map(({ p, i }, k) => `${k === 0 ? "M" : "L"} ${pad + i * step} ${toY(p.actual ?? 0)}`)
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
  ${(() => {
    const barTop = 40;
    const barBottom = h - pad - 20;
    const barH = Math.max(8, barBottom - barTop);
    const pH = Math.min(barH, (charts.summary.plannedPct / 100) * barH);
    const aH = Math.min(barH, (charts.summary.actualPct / 100) * barH);
    const pY = barBottom - pH;
    const aY = barBottom - aH;
    return `<rect x="${summaryX}" y="${pY}" width="${barW}" height="${pH}" fill="#2563EB" opacity="0.85"/>
  <rect x="${summaryX + 44}" y="${aY}" width="${barW}" height="${aH}" fill="#0F766E" opacity="0.85"/>`;
  })()}
  <text x="${summaryX}" y="155" fill="#5c6578" font-size="9">Planned ${charts.summary.plannedPct}%</text>
  <text x="${summaryX + 44}" y="155" fill="#5c6578" font-size="9">Actual ${charts.summary.actualPct}%</text>
  <text x="${summaryX}" y="175" fill="#1a1d26" font-size="10">SPI ${charts.summary.spi} · ${charts.summary.overallStatus}</text>
</svg>`;
}
