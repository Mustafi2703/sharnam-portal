/**
 * Score and RAG formulas taken from SITE_AUDIT_Pack and MASTER_KPI_DASHBOARD.
 * A blank or N/A score is not counted. 2 = fully met, 1 = partly, 0 = not met.
 * RAG is never invented: it is derived from records, overdue, oldest open, and KRA score.
 */

export const WALK_SECTIONS: { title: string; from: number; to: number }[] = [
  { title: "1.  SITE OFFICE — DRAWING CONTROL", from: 1, to: 5 },
  { title: "2.  WORKFACE — DRAWINGS AND METHOD", from: 6, to: 10 },
  { title: "3.  WORKFACE — PERMITS AND SAFETY", from: 11, to: 16 },
  { title: "4.  QUALITY AT THE WORKFACE", from: 17, to: 22 },
  { title: "5.  INDUSTRIAL WORKFACE", from: 23, to: 28 },
  { title: "6.  STORES AND MATERIAL", from: 29, to: 34 },
  { title: "7.  HSE AND WELFARE", from: 35, to: 39 },
  { title: "8.  DOCUMENT CONTROL PHYSICAL", from: 40, to: 44 },
];

export const ISO_AREAS = [
  "01_CONTEXT_AND_GOVERNANCE",
  "02_PLANNING",
  "03_SUPPORT_AND_RESOURCES",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT",
  "05_PROCUREMENT_AND_CONTRACTS",
  "06_STATUTORY_AND_LAND",
  "07_EXECUTION_AND_DELIVERY",
  "08_QUALITY_HSE_AND_ENVIRONMENT",
  "09_COMMERCIAL_AND_CHANGE",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT",
] as const;

export type ScoreCounts = {
  rows: number;
  scored: number;
  met: number;
  partly: number;
  notMet: number;
  /** (2×fully met + partly) / (scored × 2). 0 when nothing is scored. */
  score: number;
};

export function tallyScores(scores: Array<number | null | undefined>): ScoreCounts {
  let met = 0;
  let partly = 0;
  let notMet = 0;
  for (const raw of scores) {
    if (raw === 2) met++;
    else if (raw === 1) partly++;
    else if (raw === 0) notMet++;
  }
  const scored = met + partly + notMet;
  const score = scored === 0 ? 0 : (met * 2 + partly) / (scored * 2);
  return { rows: scores.length, scored, met, partly, notMet, score };
}

export function auditVerdict(overall: number, criticalFindings: number): "PASS" | "PASS WITH ACTIONS" | "FAIL" {
  if (criticalFindings > 0) return "FAIL";
  if (overall >= 0.9) return "PASS";
  if (overall >= 0.75) return "PASS WITH ACTIONS";
  return "FAIL";
}

/** KRA / % closed cells in the workbook are fractions. Values above 1 are percents. */
export function asFraction(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value > 1 ? value / 100 : value;
}

export type SubjectFigures = {
  recordsCount: number;
  openCount: number;
  closedCount: number;
  overdueCount: number;
  oldestOpenDays: number | null;
  kraScore: number | null;
};

/**
 * 03_SUBJECT_DATA column P:
 * IF(records=0,"UNUSED", IF(overdue>0,"RED", IF(oldest>30,"RED", IF(OR(oldest>14, kra<0.75),"AMBER","GREEN"))))
 * Excel compares a blank KRA as 0, which forces AMBER. The portal leaves KRA blank until
 * someone scores it (refresh does not write a KRA), so a blank KRA is "not scored" and is skipped.
 */
export function subjectRag(s: SubjectFigures): "UNUSED" | "RED" | "AMBER" | "GREEN" {
  if (!s.recordsCount) return "UNUSED";
  if (s.overdueCount > 0) return "RED";
  const oldest = s.oldestOpenDays ?? 0;
  if (oldest > 30) return "RED";
  if (oldest > 14) return "AMBER";
  const kra = asFraction(s.kraScore);
  if (kra != null && kra < 0.75) return "AMBER";
  return "GREEN";
}

/** Site walk rows the sheet treats as critical on their own when scored 0. */
export const CRITICAL_WALK_ITEMS = new Set([2, 6, 11, 12, 17]);

export type RoleKraOutcome = {
  kraAverage: number | null;
  kraScored: number;
  kraLines: number;
  result: "PASS" | "FAIL" | "INCOMPLETE";
};

/**
 * 06_ROLE_KRA footer: score each KRA 1 to 5; the role passes at an average of 3.5.
 * The reviewer score is the one that counts. Incomplete until every KRA line has one.
 */
export function roleKraResult(scores: Array<number | null | undefined>): RoleKraOutcome {
  const kraLines = scores.length;
  const set = scores.filter((n): n is number => n != null && Number.isFinite(n));
  const kraScored = set.length;
  const kraAverage = kraScored ? set.reduce((a, n) => a + n, 0) / kraScored : null;
  let result: RoleKraOutcome["result"] = "INCOMPLETE";
  if (kraLines > 0 && kraScored === kraLines && kraAverage != null) {
    result = kraAverage >= 3.5 ? "PASS" : "FAIL";
  }
  return { kraAverage, kraScored, kraLines, result };
}

/** Targets on 06_ROLE_KRA that stay typed. Compared case-insensitively. */
const TYPED_KPI_TARGETS = new Set([
  "falling",
  "rising then stable",
  "within contingency",
  "weekly",
  "divergence < 5%",
]);

function percentPoints(raw: string): number | null {
  const hasPct = raw.includes("%");
  const n = Number(raw.replace(/%/g, "").trim());
  if (!Number.isFinite(n)) return null;
  if (hasPct || (n > 0 && n <= 1)) return hasPct ? n : n * 100;
  return n;
}

/**
 * RAG for a KPI line from its Target string and Actual this period.
 * Returns null when the target is qualitative (keep the typed RAG) or actual is blank.
 * Bands follow the sheet targets in MASTER_KPI_DASHBOARD.xlsx 06_ROLE_KRA:
 *   ">= 95%" (and ">= 80%", ">= 90%", ">= 100%") -> GREEN at the threshold, AMBER within 10 points, else RED
 *   "100%" -> GREEN only at 100, AMBER from 90, else RED
 *   "0" -> GREEN at 0, else RED
 *   "<= 14" -> GREEN at or under the limit, AMBER up to limit + 7, else RED
 */
export function kpiRag(
  target: string | null | undefined,
  actual: string | null | undefined
): "GREEN" | "AMBER" | "RED" | null {
  const t = (target || "").trim();
  if (!t || TYPED_KPI_TARGETS.has(t.toLowerCase())) return null;
  const actualRaw = (actual || "").trim();
  if (!actualRaw) return null;

  const gte = t.match(/^>=\s*(\d+(?:\.\d+)?)\s*%$/);
  if (gte) {
    const n = Number(gte[1]);
    const a = percentPoints(actualRaw);
    if (a == null) return null;
    if (a >= n) return "GREEN";
    if (a >= n - 10) return "AMBER";
    return "RED";
  }
  const exactPct = t.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (exactPct) {
    const n = Number(exactPct[1]);
    const a = percentPoints(actualRaw);
    if (a == null) return null;
    if (a >= n) return "GREEN";
    if (n === 100 ? a >= 90 : a >= n - 10) return "AMBER";
    return "RED";
  }
  if (t === "0") {
    const a = Number(actualRaw.replace(/%/g, "").trim());
    if (!Number.isFinite(a)) return null;
    return a === 0 ? "GREEN" : "RED";
  }
  const lte = t.match(/^<=\s*(\d+(?:\.\d+)?)$/);
  if (lte) {
    const n = Number(lte[1]);
    const a = Number(actualRaw.replace(/%/g, "").trim());
    if (!Number.isFinite(a)) return null;
    if (a <= n) return "GREEN";
    if (a <= n + 7) return "AMBER";
    return "RED";
  }
  return null;
}

/** Column M: IFERROR(closed/records, blank). */
export function subjectPctClosed(s: Pick<SubjectFigures, "recordsCount" | "closedCount">): number | null {
  if (!s.recordsCount) return null;
  return s.closedCount / s.recordsCount;
}

export type AreaRollup = {
  isoArea: string;
  folders: number;
  subjects: number;
  records: number;
  open: number;
  closed: number;
  overdue: number;
  pctClosed: number;
  kraScore: number;
  red: number;
  rag: "RED" | "AMBER" | "GREEN";
};

/**
 * 02_ISO_AREA_ROLLUP. Folder count is the distinct folders on the subject register
 * (the workbook types a constant that matches the ISO map when all subjects are loaded).
 * KRA is AVERAGE of entered scores only. Area RAG: RED if any subject is RED,
 * else AMBER if any overdue or closure below 75%, else GREEN.
 */
export function rollupAreas(
  subjects: Array<SubjectFigures & { isoArea: string; folder: string; rag?: string }>
): { areas: AreaRollup[]; totals: Omit<AreaRollup, "isoArea" | "rag" | "red"> & { red: number; amber: number; green: number; unused: number; avgKra: number } } {
  const byArea = new Map<string, Array<SubjectFigures & { isoArea: string; folder: string }>>();
  for (const area of ISO_AREAS) byArea.set(area, []);
  for (const s of subjects) {
    const list = byArea.get(s.isoArea) || [];
    list.push(s);
    byArea.set(s.isoArea, list);
  }

  const areas: AreaRollup[] = [];
  for (const [isoArea, rows] of byArea) {
    if (!rows.length && !ISO_AREAS.includes(isoArea as (typeof ISO_AREAS)[number])) continue;
    const folders = new Set(rows.map((r) => r.folder).filter(Boolean)).size;
    const records = rows.reduce((a, r) => a + (r.recordsCount || 0), 0);
    const open = rows.reduce((a, r) => a + (r.openCount || 0), 0);
    const closed = rows.reduce((a, r) => a + (r.closedCount || 0), 0);
    const overdue = rows.reduce((a, r) => a + (r.overdueCount || 0), 0);
    const pctClosed = records ? closed / records : 0;
    const kraValues = rows.map((r) => asFraction(r.kraScore)).filter((n): n is number => n != null);
    const kraScore = kraValues.length ? kraValues.reduce((a, n) => a + n, 0) / kraValues.length : 0;
    const red = rows.filter((r) => subjectRag(r) === "RED").length;
    const rag: AreaRollup["rag"] = red > 0 ? "RED" : overdue > 0 || pctClosed < 0.75 ? "AMBER" : "GREEN";
    areas.push({ isoArea, folders, subjects: rows.length, records, open, closed, overdue, pctClosed, kraScore, red, rag });
  }

  const records = subjects.reduce((a, r) => a + (r.recordsCount || 0), 0);
  const closed = subjects.reduce((a, r) => a + (r.closedCount || 0), 0);
  const kraValues = subjects.map((r) => asFraction(r.kraScore)).filter((n): n is number => n != null);
  const ragCounts = { RED: 0, AMBER: 0, GREEN: 0, UNUSED: 0 };
  for (const s of subjects) ragCounts[subjectRag(s)]++;

  return {
    areas: areas.filter((a) => a.subjects > 0 || ISO_AREAS.includes(a.isoArea as (typeof ISO_AREAS)[number])),
    totals: {
      folders: areas.reduce((a, r) => a + r.folders, 0),
      subjects: subjects.length,
      records,
      open: subjects.reduce((a, r) => a + (r.openCount || 0), 0),
      closed,
      overdue: subjects.reduce((a, r) => a + (r.overdueCount || 0), 0),
      pctClosed: records ? closed / records : 0,
      kraScore: kraValues.length ? kraValues.reduce((a, n) => a + n, 0) / kraValues.length : 0,
      avgKra: kraValues.length ? kraValues.reduce((a, n) => a + n, 0) / kraValues.length : 0,
      red: ragCounts.RED,
      amber: ragCounts.AMBER,
      green: ragCounts.GREEN,
      unused: ragCounts.UNUSED,
    },
  };
}

export function startOfDay(d: Date) {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * FINDINGS columns O and P.
 * Days open = closed-on (or today) minus target date. Blank when there is no target date.
 * Overdue is Yes only when a target date is set, status is not Closed, and today is past the target.
 */
export function findingTiming(row: { dueDate: Date | null; closedAt: Date | null; status: string }, today = new Date()) {
  if (!row.dueDate) return { daysOpen: null as number | null, overdue: "" };
  const end = row.closedAt ? startOfDay(new Date(row.closedAt)) : startOfDay(today);
  const target = startOfDay(new Date(row.dueDate));
  const daysOpen = Math.round((end - target) / 86400000);
  if (row.status === "Closed") return { daysOpen, overdue: "" };
  return { daysOpen, overdue: startOfDay(today) > target ? "Yes" : "No" };
}

export function findingsOpen(statuses: string[]) {
  return statuses.filter((s) => s === "Open" || s === "Under Rectification").length;
}

export type DetailMap = Record<string, string>;

export function parseDetail(raw: string | null | undefined): DetailMap {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: DetailMap = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val == null) continue;
      out[k] = String(val);
    }
    return out;
  } catch {
    return {};
  }
}

/** Template text from the workbook may refresh. Scores and what the auditor wrote stay. */
const USER_DETAIL_KEYS = [
  "sampled",
  "defects",
  "findingRef",
  "answer",
  "evidenceShown",
  "followUp",
  "done",
  "notes",
  "photoNote",
  "recordsInLog",
] as const;

export function mergeDetail(existing: string | null | undefined, template: DetailMap): string {
  const prev = parseDetail(existing);
  const next: DetailMap = { ...template };
  for (const key of USER_DETAIL_KEYS) {
    if (prev[key]) next[key] = prev[key];
  }
  return JSON.stringify(next);
}

export function mergeDetailPatch(existing: string | null | undefined, patch: DetailMap): string {
  const prev = parseDetail(existing);
  const next = { ...prev };
  for (const [k, v] of Object.entries(patch)) {
    if (v === "") delete next[k];
    else next[k] = v;
  }
  return JSON.stringify(next);
}

export const AUDIT_DRIVE_FOLDER =
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.18_Management_Review_and_Audit_Programme";

export const SITE_WALK_EVIDENCE_FOLDER = `${AUDIT_DRIVE_FOLDER}/Site_Walk`;
