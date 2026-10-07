/**
 * S-curve register (ProgressScurvePoint) inputs: planned baseline and actual, per discipline or OVERALL.
 * Values are stored as percentages (0–100). Older rows saved as fractions (0–1) are scaled on read.
 *
 *   readScurvePoints      — register rows as percentages
 *   importScurveBaseline  — Excel / CSV: Date | Planned % | Actual % (optional)
 *   generateScurveBaseline — monthly planned % from the activity register's planned dates (BOQ-value weighted),
 *                            actual % from the DPR history
 */
import type { PrismaClient } from "@prisma/client";
import XLSX from "../lib/xlsx.js";
import { dprLineKey, type DprLine } from "./dprXlsx.js";

const DAY = 86400000;
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const norm = (s: string | null | undefined) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const monthLabel = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

export type ScurveRow = { id?: string; periodDate: Date; periodLabel: string | null; plannedPct: number; actualPct: number; source?: string | null };

/** Register rows for a discipline, as percentages. */
export async function readScurvePoints(prisma: PrismaClient, projectId: string, discipline: string): Promise<ScurveRow[]> {
  const rows = await prisma.progressScurvePoint.findMany({
    where: { projectId, discipline: discipline.toUpperCase() },
    orderBy: { periodDate: "asc" },
  });
  const fraction = rows.length > 0 && rows.every((r) => (Number(r.plannedPct) || 0) <= 1 && (Number(r.actualPct) || 0) <= 1);
  const k = fraction ? 100 : 1;
  return rows.map((r) => ({
    id: r.id,
    periodDate: r.periodDate,
    periodLabel: r.periodLabel,
    plannedPct: Math.round((Number(r.plannedPct) || 0) * k * 10) / 10,
    actualPct: Math.round((Number(r.actualPct) || 0) * k * 10) / 10,
    source: r.source,
  }));
}

async function replaceRows(prisma: PrismaClient, projectId: string, discipline: string, rows: ScurveRow[], source: string) {
  const disc = discipline.toUpperCase();
  await prisma.$transaction([
    prisma.progressScurvePoint.deleteMany({ where: { projectId, discipline: disc } }),
    ...rows.map((r) =>
      prisma.progressScurvePoint.create({
        data: {
          projectId,
          discipline: disc,
          periodDate: startOfDay(r.periodDate),
          periodLabel: r.periodLabel,
          plannedPct: r.plannedPct,
          actualPct: r.actualPct,
          source,
        },
      })
    ),
  ]);
  return rows.length;
}

function cellDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" && v > 30000 && v < 60000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DAY);
  const s = String(v ?? "").trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) return new Date(Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function cellPct(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[%,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Excel / CSV with a date column and a planned % column (actual % optional). The header row is found by name
 * ("date", "planned", "actual"); without headers the first three columns are used. Fractions (≤ 1) become %.
 */
export async function importScurveBaseline(prisma: PrismaClient, projectId: string, discipline: string, buf: Buffer) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  let headerRow = grid.findIndex((r) => r.some((c) => /date|week|month|period/i.test(String(c))) && r.some((c) => /plan/i.test(String(c))));
  let dateCol = 0;
  let planCol = 1;
  let actCol = 2;
  if (headerRow >= 0) {
    const h = grid[headerRow].map((c) => String(c));
    dateCol = h.findIndex((c) => /date|week|month|period/i.test(c));
    planCol = h.findIndex((c) => /plan/i.test(c));
    actCol = h.findIndex((c) => /actual/i.test(c));
  } else {
    headerRow = -1;
  }
  const raw = grid
    .slice(headerRow + 1)
    .map((r) => ({ d: cellDate(r[dateCol]), p: cellPct(r[planCol]), a: actCol >= 0 ? cellPct(r[actCol]) : null }))
    .filter((r): r is { d: Date; p: number; a: number | null } => !!r.d && r.p != null);
  if (!raw.length) throw new Error("No rows found — expected columns: Date, Planned %, Actual % (optional).");
  const fraction = raw.every((r) => r.p <= 1 && (r.a ?? 0) <= 1);
  const k = fraction ? 100 : 1;
  const rows: ScurveRow[] = raw
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map((r) => ({
      periodDate: r.d,
      periodLabel: monthLabel(r.d),
      plannedPct: Math.round(r.p * k * 10) / 10,
      actualPct: Math.round((r.a ?? 0) * k * 10) / 10,
    }));
  return replaceRows(prisma, projectId, discipline, rows, "upload");
}

/** Value-weighted actual % of a discipline's DPR lines on each date (latest DPR on or before it). */
async function dprActualAt(prisma: PrismaClient, projectId: string, discipline: string, dates: Date[]): Promise<(number | null)[]> {
  const snaps = await prisma.dprSnapshot.findMany({
    where: { projectId, ...(discipline === "OVERALL" ? {} : { discipline }) },
    orderBy: { logDate: "asc" },
    select: { logDate: true, discipline: true, linesJson: true },
  });
  return dates.map((d) => {
    // Latest DPR per discipline on or before the date, then value-weighted completion across them.
    const latest = new Map<string, DprLine[]>();
    for (const s of snaps) {
      if (s.logDate > d) break;
      try {
        latest.set(s.discipline, JSON.parse(s.linesJson || "[]"));
      } catch {
        /* skip */
      }
    }
    if (!latest.size) return null;
    let value = 0;
    let done = 0;
    for (const lines of latest.values()) {
      const seen = new Set<string>();
      for (const l of lines) {
        const scope = Number(l.scopeQty) || 0;
        const rate = Number(l.rate) || 0;
        const key = dprLineKey(l);
        if (!scope || !rate || seen.has(key)) continue;
        seen.add(key);
        value += scope * rate;
        done += Math.min(scope, (Number(l.cumQtyPrev) || 0) + (Number(l.qtyToday) || 0)) * rate;
      }
    }
    return value ? Math.round((done / value) * 1000) / 10 : null;
  });
}

/**
 * Monthly planned % from the activity register (planned start → end, linear within each activity), each activity
 * weighted by its BOQ value (GFC qty × rate of the linked or same-named Cost monitoring line; median value when
 * unknown). Actual % for months to date from the DPR history. Replaces the discipline's register rows.
 */
export async function generateScurveBaseline(prisma: PrismaClient, projectId: string, discipline: string) {
  const disc = discipline.toUpperCase();
  const [project, activities, monitoring] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { startDate: true, endDate: true } }),
    prisma.progressActivityLine.findMany({ where: { projectId, plannedStart: { not: null }, plannedEnd: { not: null } } }),
    prisma.costMonitoringLine.findMany({ where: { projectId }, select: { id: true, description: true, rate: true, gfcQty: true, boqQty: true } }),
  ]);
  const scoped =
    disc === "OVERALL"
      ? activities
      : activities.filter((a) => norm(a.discipline || a.packageName).includes(norm(disc).replace(/_/g, " "))).length
        ? activities.filter((a) => norm(a.discipline || a.packageName).includes(norm(disc).replace(/_/g, " ")))
        : activities;
  if (!scoped.length) throw new Error("No activities with planned start / end — add them under Progress → Planned vs Actual, or upload a baseline.");

  const byId = new Map(monitoring.map((m) => [m.id, m]));
  const byDesc = new Map(monitoring.map((m) => [norm(m.description), m]));
  const rawValue = scoped.map((a) => {
    const m = (a.costMonitoringLineId && byId.get(a.costMonitoringLineId)) || byDesc.get(norm(a.activity));
    const qty = Number(a.gfcQty || a.boqQty || m?.gfcQty || m?.boqQty || 0);
    return m?.rate && qty ? qty * Number(m.rate) : 0;
  });
  const known = rawValue.filter((v) => v > 0).sort((a, b) => a - b);
  const median = known.length ? known[Math.floor(known.length / 2)] : 1;
  const weight = rawValue.map((v) => (v > 0 ? v : median));
  const total = weight.reduce((a, b) => a + b, 0) || 1;

  const starts = scoped.map((a) => startOfDay(a.plannedStart!).getTime());
  const ends = scoped.map((a) => startOfDay(a.plannedEnd!).getTime());
  const from = new Date(Math.min(project?.startDate ? startOfDay(project.startDate).getTime() : Infinity, ...starts));
  const to = new Date(Math.max(...ends, project?.endDate ? startOfDay(project.endDate).getTime() : 0));
  // Month ends from the first planned month to the last, plus the finish date itself.
  const dates: Date[] = [];
  for (let d = new Date(from.getFullYear(), from.getMonth() + 1, 0); d < to; d = new Date(d.getFullYear(), d.getMonth() + 2, 0)) dates.push(d);
  dates.push(to);

  const planned = dates.map((d) => {
    const t = d.getTime();
    let sum = 0;
    scoped.forEach((_, i) => {
      const frac = t >= ends[i] ? 1 : t < starts[i] ? 0 : (t - starts[i] + DAY) / (ends[i] - starts[i] + DAY);
      sum += (weight[i] / total) * frac;
    });
    return Math.round(sum * 1000) / 10;
  });
  const today = startOfDay(new Date());
  const actual = await dprActualAt(prisma, projectId, disc, dates.map((d) => (d > today ? today : d)));
  const rows: ScurveRow[] = dates.map((d, i) => ({
    periodDate: d,
    periodLabel: monthLabel(d),
    plannedPct: planned[i],
    actualPct: d <= today ? actual[i] ?? 0 : 0,
  }));
  const count = await replaceRows(prisma, projectId, disc, rows, "activity schedule");
  return { points: count, activities: scoped.length, from, to };
}
