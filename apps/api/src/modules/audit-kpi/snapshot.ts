/**
 * KPI dashboard figures, shared by the dashboard route and the Friday trend snapshot.
 */
import { prisma } from "../../prisma.js";
import { asFraction, rollupAreas, subjectPctClosed, subjectRag } from "./scoring.js";

export function istParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

/** Friday of the current week in IST. Saturday and Sunday stay on the Friday just gone. */
export function currentWeekEndingFriday(d = new Date()) {
  const [y, m, day] = istParts(d).day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, day));
  const dow = utc.getUTCDay();
  let add = 5 - dow;
  if (dow === 6) add = -1;
  if (dow === 0) add = -2;
  const friday = new Date(utc.getTime() + add * 86400000);
  return friday.toISOString().slice(0, 10);
}

export async function computeKpiSnapshot(projectId: string) {
  const subjects = await prisma.kpiSubject.findMany({ where: { projectId }, orderBy: { srNo: "asc" } });
  const presented = subjects.map((row) => ({ ...row, pctClosed: subjectPctClosed(row), rag: subjectRag(row) }));
  const roll = rollupAreas(presented);
  const kraValues = presented.map((row) => asFraction(row.kraScore)).filter((n): n is number => n != null);
  const kraScored = kraValues.length;
  const avgKra = kraScored ? kraValues.reduce((sum, n) => sum + n, 0) / kraScored : null;
  const oldest = presented.reduce((max, row) => Math.max(max, row.oldestOpenDays || 0), 0);
  const siteOverdue = presented.filter((row) => row.custodian === "SITE" && row.overdueCount > 0).length;
  const hoOverdue = presented.filter((row) => row.custodian === "HO" && row.overdueCount > 0).length;
  const withOverdue = presented.filter((row) => row.overdueCount > 0).length;

  const trend = {
    recordsCount: roll.totals.records,
    openCount: roll.totals.open,
    closedCount: roll.totals.closed,
    pctClosed: roll.totals.pctClosed,
    overdueCount: roll.totals.overdue,
    subjectsRed: roll.totals.red,
    kraScore: avgKra,
    oldestOpenDays: oldest,
    notYetUsed: roll.totals.unused,
  };

  const kpi = {
    subjects: roll.totals.subjects,
    records: roll.totals.records,
    open: roll.totals.open,
    closed: roll.totals.closed,
    pctClosed: roll.totals.pctClosed,
    avgKra,
    kraScored,
    overdueItems: roll.totals.overdue,
    red: roll.totals.red,
    amber: roll.totals.amber,
    green: roll.totals.green,
    inUse: roll.totals.subjects - roll.totals.unused,
    unused: roll.totals.unused,
    areas: roll.areas,
    health: [
      { indicator: "Subjects with any overdue item", value: withOverdue, target: "0", source: "All subjects" },
      { indicator: "Total overdue items on the project", value: roll.totals.overdue, target: "0", source: "All subjects" },
      { indicator: "Oldest open item (days)", value: oldest, target: "<= 14", source: "All subjects" },
      { indicator: "Overall closure rate", value: roll.totals.pctClosed, target: ">= 90%", source: "All subjects" },
      {
        indicator: "Average KRA score",
        value: avgKra == null ? "Not scored" : avgKra,
        target: ">= 90%",
        source: "KRA score column",
      },
      { indicator: "Subjects red-rated", value: roll.totals.red, target: "0", source: "RAG" },
      { indicator: "SITE subjects with overdue", value: siteOverdue, target: "0", source: "Site custodian" },
      { indicator: "HO subjects with overdue", value: hoOverdue, target: "0", source: "Head office" },
      { indicator: "Subjects never used", value: roll.totals.unused, target: "Falling", source: "Adoption measure" },
    ],
  };

  return { presented, roll, trend, kpi, kraScored, avgKra };
}

export async function snapshotTrendWeek(projectId: string, opts?: { force?: boolean; today?: Date }) {
  const today = opts?.today || new Date();
  const weekEnding = currentWeekEndingFriday(today);
  const existing = await prisma.kpiTrendWeek.findUnique({ where: { projectId_weekEnding: { projectId, weekEnding } } });
  const typed = existing && existing.source !== "auto" && (existing.source === "manual" || existing.recordsCount != null);
  if (existing && typed && !opts?.force) {
    return { ok: false as const, status: 409 as const, week: existing, weekEnding };
  }
  const snap = await computeKpiSnapshot(projectId);
  const count = await prisma.kpiTrendWeek.count({ where: { projectId } });
  const data = {
    ...snap.trend,
    snapshotAt: new Date(),
    source: "auto" as const,
  };
  const week = await prisma.kpiTrendWeek.upsert({
    where: { projectId_weekEnding: { projectId, weekEnding } },
    create: { projectId, weekEnding, sortOrder: existing?.sortOrder ?? count + 1, ...data },
    update: data,
  });
  return { ok: true as const, status: 200 as const, week, weekEnding };
}
