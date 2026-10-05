/**
 * Safety numbers from what is logged in the portal: the daily safety log (manpower, hours,
 * toolbox talks, inductions, permits) plus safety records (unsafe acts, incidents, NCR, …).
 * Used by the Safety dashboard, the DPR safety block and the WPR HSE indicators.
 */
import { prisma } from "../prisma.js";

export const SAFETY_RECORD_TYPES = [
  "Observation",
  "Near Miss",
  "First Aid",
  "Incident",
  "LTI",
  "Toolbox Talk",
  "JHA",
  "NCR",
  "Site Instruction",
] as const;

/** Calendar day key → stored date (UTC midnight of that day, independent of server timezone). */
export function dayFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}
export function keyFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function istDayKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const isType = (re: RegExp) => (r: { recordType: string; title?: string | null }) => re.test(r.recordType);
const isUnsafeAct = isType(/observation|unsafe/i);
const isNearMiss = isType(/near/i);
const isFirstAid = isType(/first aid/i);
const isIncident = isType(/^incident$/i);
const isLti = (r: { recordType: string; title?: string | null }) => /^lti$|lost time/i.test(r.recordType) || /\blti\b|lost time/i.test(r.title || "");
const isNcr = isType(/ncr/i);
const isSi = isType(/site instruction/i);
const isTbtRecord = (r: { recordType: string; title?: string | null }) => /toolbox|tbt/i.test(`${r.recordType} ${r.title || ""}`);
const isClosed = (s?: string | null) => /clos|complete|done|resolved/i.test(s || "");

export type SafetyDay = {
  date: string;
  manpower: number;
  hoursPerHead: number;
  safeManHours: number;
  toolboxTalks: number;
  tbtTopics: string | null;
  inductions: number;
  permitsIssued: number;
  ppeCompliancePct: number | null;
  lostTimeInjury: boolean;
  majorIncident: string | null;
  remarks: string | null;
  logged: boolean;
};

/** Daily log rows between two day keys (inclusive), with empty rows for days not yet logged. */
export async function safetyDays(projectId: string, fromKey: string, toKey: string): Promise<SafetyDay[]> {
  const rows = await prisma.safetyDailyLog.findMany({
    where: { projectId, date: { gte: dayFromKey(fromKey), lte: dayFromKey(toKey) } },
    orderBy: { date: "asc" },
  });
  const byKey = new Map(rows.map((r) => [keyFromDate(r.date), r]));
  const out: SafetyDay[] = [];
  for (let d = dayFromKey(fromKey); d <= dayFromKey(toKey); d = new Date(d.getTime() + 86400000)) {
    const k = keyFromDate(d);
    const r = byKey.get(k);
    out.push(
      r
        ? {
            date: k,
            manpower: r.manpower,
            hoursPerHead: r.hoursPerHead,
            safeManHours: r.safeManHours,
            toolboxTalks: r.toolboxTalks,
            tbtTopics: r.tbtTopics,
            inductions: r.inductions,
            permitsIssued: r.permitsIssued,
            ppeCompliancePct: r.ppeCompliancePct,
            lostTimeInjury: r.lostTimeInjury,
            majorIncident: r.majorIncident,
            remarks: r.remarks,
            logged: true,
          }
        : {
            date: k,
            manpower: 0,
            hoursPerHead: 8,
            safeManHours: 0,
            toolboxTalks: 0,
            tbtTopics: null,
            inductions: 0,
            permitsIssued: 0,
            ppeCompliancePct: null,
            lostTimeInjury: false,
            majorIncident: null,
            remarks: null,
            logged: false,
          },
    );
  }
  return out;
}

/** Totals from the start of the project up to (and including) a day. */
export async function safetyCumulative(projectId: string, toKey: string) {
  const agg = await prisma.safetyDailyLog.aggregate({
    where: { projectId, date: { lte: dayFromKey(toKey) } },
    _sum: { safeManHours: true, toolboxTalks: true, inductions: true, permitsIssued: true, manpower: true },
    _count: { _all: true },
  });
  const lastLtiLog = await prisma.safetyDailyLog.findFirst({
    where: { projectId, lostTimeInjury: true, date: { lte: dayFromKey(toKey) } },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ltiRecords = await prisma.safetyRecord.findMany({
    where: { projectId, occurredAt: { lte: new Date(dayFromKey(toKey).getTime() + 86399999) } },
    select: { recordType: true, title: true, occurredAt: true },
  });
  const lastLtiRecord = ltiRecords.filter(isLti).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];
  const firstLog = await prisma.safetyDailyLog.findFirst({ where: { projectId }, orderBy: { date: "asc" }, select: { date: true } });
  const lastLti = [lastLtiLog?.date, lastLtiRecord?.occurredAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] || null;
  const since = lastLti || firstLog?.date || null;
  const daysWithoutLti = since ? Math.max(0, Math.floor((dayFromKey(toKey).getTime() - dayFromKey(keyFromDate(since)).getTime()) / 86400000) + (lastLti ? 0 : 1)) : 0;
  return {
    safeManHours: agg._sum.safeManHours || 0,
    toolboxTalks: agg._sum.toolboxTalks || 0,
    inductions: agg._sum.inductions || 0,
    permitsIssued: agg._sum.permitsIssued || 0,
    manDays: agg._sum.manpower || 0,
    daysLogged: agg._count._all,
    daysWithoutLti,
    lastLti: lastLti ? keyFromDate(lastLti) : null,
  };
}

function mondayOf(key: string): string {
  const d = dayFromKey(key);
  const dow = (d.getUTCDay() + 6) % 7;
  return keyFromDate(new Date(d.getTime() - dow * 86400000));
}

/** Weekly Safety Dashboard (Safety Dashboard.xlsx One Pager) for the week holding `anyDayKey`. */
export async function safetyWeekReport(projectId: string, fromKey?: string, toKey?: string) {
  const from = fromKey || mondayOf(istDayKey());
  const to = toKey || keyFromDate(new Date(dayFromKey(from).getTime() + 6 * 86400000));
  const prevFrom = keyFromDate(new Date(dayFromKey(from).getTime() - 7 * 86400000));
  const prevTo = keyFromDate(new Date(dayFromKey(from).getTime() - 86400000));
  const start = dayFromKey(from);
  const end = new Date(dayFromKey(to).getTime() + 86399999);
  const [days, records, cumulative, prevDays] = await Promise.all([
    safetyDays(projectId, from, to),
    prisma.safetyRecord.findMany({
      where: { projectId },
      select: { id: true, recordType: true, title: true, severity: true, status: true, category: true, occurredAt: true, closedAt: true, location: true },
    }),
    safetyCumulative(projectId, to),
    safetyDays(projectId, prevFrom, prevTo),
  ]);
  const inWeek = (d: Date) => d >= start && d <= end;
  const week = records.filter((r) => inWeek(r.occurredAt));
  const upTo = records.filter((r) => r.occurredAt <= end);
  const sum = (arr: SafetyDay[], k: keyof SafetyDay) => arr.reduce((n, d) => n + (Number(d[k]) || 0), 0);
  const tbtWeek = sum(days, "toolboxTalks") + week.filter(isTbtRecord).length;
  const weekSafeHours = sum(days, "safeManHours");
  const major =
    week
      .filter((r) => isIncident(r) || isLti(r) || isFirstAid(r))
      .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))[0] || null;
  const types = ["Observation", "Near Miss", "First Aid", "Incident", "LTI", "NCR", "Site Instruction"];
  const typeLabel = (t: string) => (t === "Observation" ? "Unsafe act" : t);
  const byType = types
    .map((t) => {
      const rows = week.filter((r) => (t === "Observation" ? isUnsafeAct(r) : t === "LTI" ? isLti(r) : r.recordType === t));
      return { label: typeLabel(t), open: rows.filter((r) => !isClosed(r.status)).length, closed: rows.filter((r) => isClosed(r.status)).length };
    })
    .filter((r) => r.open + r.closed > 0);
  const cat: Record<string, number> = {};
  for (const r of week.filter(isUnsafeAct)) cat[r.category || r.location || "Other"] = (cat[r.category || r.location || "Other"] || 0) + 1;
  const sev: Record<string, number> = {};
  for (const r of week) sev[r.severity || "Low"] = (sev[r.severity || "Low"] || 0) + 1;

  return {
    from,
    to,
    days,
    kpis: {
      totalIncidents: upTo.filter((r) => isIncident(r) || isLti(r)).length,
      totalUnsafeActs: upTo.filter(isUnsafeAct).length,
      totalNcrs: upTo.filter(isNcr).length,
      weeklySafeHours: weekSafeHours,
      cumulativeSafeHours: cumulative.safeManHours,
      toolboxTalksWeek: tbtWeek,
      inductionsWeek: sum(days, "inductions"),
      permitsWeek: sum(days, "permitsIssued"),
      daysWithoutLti: cumulative.daysWithoutLti,
      unsafeActsWeek: week.filter(isUnsafeAct).length,
      nearMissWeek: week.filter(isNearMiss).length,
      firstAidWeek: week.filter(isFirstAid).length,
      incidentsWeek: week.filter((r) => isIncident(r) || isLti(r)).length,
      ncrWeek: week.filter(isNcr).length,
      siteInstructionsWeek: week.filter(isSi).length,
      openItems: records.filter((r) => !isClosed(r.status)).length,
      daysLogged: days.filter((d) => d.logged).length,
      majorIncident: major ? `${major.recordType}: ${major.title}` : days.find((d) => d.majorIncident)?.majorIncident || null,
    },
    previousWeek: {
      safeHours: sum(prevDays, "safeManHours"),
      toolboxTalks: sum(prevDays, "toolboxTalks"),
      inductions: sum(prevDays, "inductions"),
    },
    cumulative,
    charts: {
      byTypeOpenClosed: byType,
      dailySafeHours: days.map((d) => ({ label: dayLabel(d.date), value: d.safeManHours })),
      dailyManpower: days.map((d) => ({ label: dayLabel(d.date), value: d.manpower })),
      unsafeActsByCategory: Object.entries(cat).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      bySeverity: Object.entries(sev).map(([label, value]) => ({ label, value })),
    },
  };
}

function sevRank(s?: string | null) {
  return /crit/i.test(s || "") ? 4 : /high/i.test(s || "") ? 3 : /med/i.test(s || "") ? 2 : 1;
}
function dayLabel(key: string) {
  return dayFromKey(key).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", timeZone: "UTC" });
}

/** Branded Excel for one safety week: One Pager KPIs, daily safety log and that week's records. */
export async function safetyWeekWorkbook(projectId: string, fromKey?: string, toKey?: string) {
  const rep = await safetyWeekReport(projectId, fromKey, toKey);
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { code: true, name: true, clientName: true, contractorName: true } });
  const start = dayFromKey(rep.from);
  const end = new Date(dayFromKey(rep.to).getTime() + 86399999);
  const records = await prisma.safetyRecord.findMany({
    where: { projectId, occurredAt: { gte: start, lte: end } },
    orderBy: { occurredAt: "asc" },
    select: { recordType: true, title: true, location: true, severity: true, category: true, status: true, correctiveAction: true, responsibleParty: true, occurredAt: true, closedAt: true },
  });
  const k = rep.kpis;
  const { workbookBuffer } = await import("./brandedExport.js");
  const label = `Week ${isoWeekNo(rep.from)} (${rep.from} to ${rep.to})`;
  const buffer = await workbookBuffer(
    [
      {
        name: "One Pager",
        rows: [
          ["Safety Dashboard", label],
          ["Project", `${project.code} — ${project.name}`],
          ["Client", project.clientName || ""],
          ["Contractor", project.contractorName || ""],
          [],
          ["Indicator", "This week", "Project to date"],
          ["Incidents", k.incidentsWeek, k.totalIncidents],
          ["Unsafe acts", k.unsafeActsWeek, k.totalUnsafeActs],
          ["NCR", k.ncrWeek, k.totalNcrs],
          ["Near miss", k.nearMissWeek, ""],
          ["First aid", k.firstAidWeek, ""],
          ["Site instructions", k.siteInstructionsWeek, ""],
          ["Safe man-hours", k.weeklySafeHours, k.cumulativeSafeHours],
          ["Toolbox talks", k.toolboxTalksWeek, rep.cumulative.toolboxTalks],
          ["HSE inductions", k.inductionsWeek, rep.cumulative.inductions],
          ["Permits to work", k.permitsWeek, rep.cumulative.permitsIssued],
          ["Days without LTI", "", k.daysWithoutLti],
          ["Major safety incident this week", k.majorIncident || "None reported", ""],
        ],
      },
      {
        name: "Daily Safety Log",
        rows: [
          ["Date", "Manpower", "Hours / head", "Safe man-hours", "Toolbox talks", "TBT topics", "Inductions", "Permits", "PPE %", "LTI", "Major incident", "Remarks"],
          ...rep.days.map((d) => [
            d.date,
            d.logged ? d.manpower : "",
            d.logged ? d.hoursPerHead : "",
            d.logged ? d.safeManHours : "",
            d.logged ? d.toolboxTalks : "",
            d.tbtTopics || "",
            d.logged ? d.inductions : "",
            d.logged ? d.permitsIssued : "",
            d.ppeCompliancePct ?? "",
            d.lostTimeInjury ? "Yes" : d.logged ? "No" : "",
            d.majorIncident || "",
            d.remarks || (d.logged ? "" : "Not logged"),
          ]),
        ],
      },
      {
        name: "Records This Week",
        rows: [
          ["Date", "Type", "Title", "Location", "Category", "Severity", "Status", "Corrective action", "Responsible", "Closed on"],
          ...records.map((r) => [
            keyFromDate(r.occurredAt),
            r.recordType === "Observation" ? "Unsafe act" : r.recordType,
            r.title,
            r.location || "",
            r.category || "",
            r.severity || "",
            r.status,
            r.correctiveAction || "",
            r.responsibleParty || "",
            r.closedAt ? keyFromDate(r.closedAt) : "",
          ]),
        ],
      },
    ],
    { title: `Safety Dashboard — ${label}`, projectCode: project.code },
  );
  return { buffer, label, from: rep.from, to: rep.to, projectCode: project.code };
}

function isoWeekNo(key: string) {
  const t = dayFromKey(key);
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
