/**
 * Week-by-week rollups for the WPR, built only from data dated on or before the week end
 * so any past week regenerates with the figures it had, and each week continues the last.
 *
 *   activityWeekRollup — DPR lines → executed this week / till date per activity (running cumulative)
 *   qualityWeekStats   — Site Observation / Site Instruction / NCR raised, open and closed as of week end
 *   nextReportNumber   — report number continues from the latest earlier WPR
 */
import type { PrismaClient } from "@prisma/client";

export function normActivity(s: string | null | undefined): string {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type ActivityWeekQty = {
  description: string;
  unit?: string;
  /** Sum of DPR qty today inside the week. */
  weekQty: number;
  /** Running cumulative from the last DPR on or before the week end (cum prev + qty today). */
  tillDate: number;
};

/**
 * Per-activity quantities from DPR snapshots (all disciplines) up to the week end.
 * Running cumulative follows each discipline's DPR chain, then sums across disciplines.
 * Returns null when the project has no DPR up to the week end (register-only / imported history).
 */
export async function activityWeekRollup(
  prisma: PrismaClient,
  projectId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<Map<string, ActivityWeekQty> | null> {
  const snaps = await prisma.dprSnapshot.findMany({
    where: { projectId, logDate: { lte: weekEnd } },
    orderBy: { logDate: "asc" },
    select: { logDate: true, discipline: true, linesJson: true },
  });
  if (!snaps.length) return null;

  const lastCum = new Map<string, number>(); // discipline|activity → running cumulative
  const out = new Map<string, ActivityWeekQty>();
  for (const snap of snaps) {
    const inWeek = snap.logDate >= weekStart;
    let lines: { description?: string; unit?: string; cumQtyPrev?: number; qtyToday?: number }[] = [];
    try {
      lines = JSON.parse(snap.linesJson || "[]");
    } catch {
      continue;
    }
    for (const ln of lines) {
      const key = normActivity(ln.description);
      if (!key) continue;
      const today = Number(ln.qtyToday) || 0;
      lastCum.set(`${snap.discipline}|${key}`, (Number(ln.cumQtyPrev) || 0) + today);
      const row = out.get(key) || { description: String(ln.description), unit: ln.unit, weekQty: 0, tillDate: 0 };
      if (inWeek) row.weekQty += today;
      if (!row.unit && ln.unit) row.unit = ln.unit;
      out.set(key, row);
    }
  }
  for (const [k, cum] of lastCum) {
    const row = out.get(k.slice(k.indexOf("|") + 1));
    if (row) row.tillDate += cum;
  }
  for (const row of out.values()) {
    row.weekQty = round3(row.weekQty);
    row.tillDate = round3(row.tillDate);
  }
  return out;
}

export type QualityWeekRow = {
  label: string;
  raisedThisWeek: number;
  total: number;
  open: number;
  closed: number;
};

const isClosedStatus = (st?: string | null) => /clos|complete|done|resolved/i.test(st || "");

/**
 * Site Observation / Site Instruction / NCR from the live registers as of the week end.
 * An item counts as closed when its closure date is on or before the week end
 * (or it is marked closed with no date). Returns [] when nothing has been recorded yet.
 */
export async function qualityWeekStats(
  prisma: PrismaClient,
  projectId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<QualityWeekRow[]> {
  const [records, ncrs] = await Promise.all([
    prisma.qualitySiteRecord.findMany({
      where: { projectId, occurredAt: { lte: weekEnd } },
      select: { recordType: true, status: true, occurredAt: true, closedAt: true },
    }),
    prisma.qualityNcr.findMany({
      where: { projectId, OR: [{ issueDate: { lte: weekEnd } }, { issueDate: null, createdAt: { lte: weekEnd } }] },
      select: { ncrType: true, status: true, issueDate: true, createdAt: true, actualClosure: true },
    }),
  ]);
  const rows = new Map<string, QualityWeekRow>();
  const bump = (label: string, raised: Date, closedAt: Date | null, status: string | null) => {
    const r = rows.get(label) || { label, raisedThisWeek: 0, total: 0, open: 0, closed: 0 };
    r.total++;
    if (raised >= weekStart) r.raisedThisWeek++;
    const closed = closedAt ? closedAt <= weekEnd : isClosedStatus(status);
    if (closed) r.closed++;
    else r.open++;
    rows.set(label, r);
  };
  for (const r of records) bump(r.recordType || "Site Observation", r.occurredAt, r.closedAt, r.status);
  for (const n of ncrs) bump(n.ncrType ? n.ncrType.toUpperCase() : "NCR", n.issueDate || n.createdAt, n.actualClosure, n.status);

  const order = ["Site Observation", "Site Instruction", "NCR"];
  return [...rows.values()].sort((a, b) => {
    const ia = order.indexOf(a.label);
    const ib = order.indexOf(b.label);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.label.localeCompare(b.label);
  });
}

/**
 * Report number for a week with none saved: latest earlier WPR's number + weeks elapsed.
 * Undefined when no earlier WPR carries a number (first report is entered by hand).
 */
export async function nextReportNumber(
  prisma: PrismaClient,
  projectId: string,
  weekEnd: Date
): Promise<number | undefined> {
  const prev = await prisma.wprSnapshot.findFirst({
    where: { projectId, weekEnding: { lt: weekEnd }, reportNumber: { not: null } },
    orderBy: { weekEnding: "desc" },
    select: { weekEnding: true, reportNumber: true },
  });
  if (!prev?.reportNumber) return undefined;
  const weeks = Math.max(1, Math.round((weekEnd.getTime() - prev.weekEnding.getTime()) / (7 * 86400000)));
  return prev.reportNumber + weeks;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
