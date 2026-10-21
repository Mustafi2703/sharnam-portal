/**
 * One portal register per KPI subject code (the workbook file name before the first space).
 * Each loader queries a single model. Subjects that are not in this map stay typed.
 */
import { prisma } from "../../prisma.js";
import { findingTiming, subjectPctClosed, subjectRag } from "./scoring.js";

export type SubjectCounts = {
  records: number;
  open: number;
  closed: number;
  overdue: number;
  oldestOpenDays: number | null;
};

export type SubjectSource = {
  code: string;
  model: string;
  load: (projectId: string, today: Date) => Promise<SubjectCounts>;
};

type OpenRow = { open: boolean; openedAt: Date | null; dueAt: Date | null };

export function subjectCodeFromFile(workbookFileName: string | null | undefined): string | null {
  const code = (workbookFileName || "").trim().split(/\s+/)[0] || "";
  return /^\d{2}\.\d{2}_/.test(code) ? code : null;
}

function istKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dayNumber(d: Date) {
  const [y, m, day] = istKey(d).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, day) / 86400000);
}

function closedStatus(status: string | null | undefined, pattern: RegExp) {
  return pattern.test((status || "").trim());
}

function tally(rows: OpenRow[], today: Date): SubjectCounts {
  const openRows = rows.filter((r) => r.open);
  const todayN = dayNumber(today);
  let oldest: number | null = null;
  let overdue = 0;
  for (const row of openRows) {
    if (row.dueAt && dayNumber(row.dueAt) < todayN) overdue++;
    if (!row.openedAt) continue;
    const age = Math.max(0, todayN - dayNumber(row.openedAt));
    oldest = oldest == null ? age : Math.max(oldest, age);
  }
  return {
    records: rows.length,
    open: openRows.length,
    closed: rows.length - openRows.length,
    overdue,
    oldestOpenDays: oldest,
  };
}

function emptyCounts(records = 0): SubjectCounts {
  return { records, open: 0, closed: records, overdue: 0, oldestOpenDays: null };
}

async function projectAnchor(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { startDate: true, createdAt: true },
  });
  return project?.startDate || project?.createdAt || null;
}

function missingWorkingDays(start: Date, today: Date, logged: Set<string>) {
  const startN = dayNumber(start);
  const todayN = dayNumber(today);
  let count = 0;
  let oldest: number | null = null;
  for (let n = startN; n <= todayN; n++) {
    const dt = new Date(n * 86400000);
    const wd = dt.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const key = dt.toISOString().slice(0, 10);
    if (logged.has(key)) continue;
    count++;
    const age = todayN - n;
    oldest = oldest == null ? age : Math.max(oldest, age);
  }
  return { count, oldest };
}

function fridayKeys(start: Date, today: Date) {
  const keys: string[] = [];
  const startN = dayNumber(start);
  const todayN = dayNumber(today);
  for (let n = startN; n <= todayN; n++) {
    const dt = new Date(n * 86400000);
    if (dt.getUTCDay() === 5) keys.push(dt.toISOString().slice(0, 10));
  }
  return keys;
}

const CLOSED_WORD = /^(closed|completed|complete|resolved|done|approved|received|granted|achieved|retired)$/i;

async function loadFindings(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.auditFinding.findMany({
    where: { projectId },
    select: { status: true, dueDate: true, closedAt: true, createdAt: true },
  });
  return tally(
    rows.map((row) => {
      const open = row.status !== "Closed";
      const timing = findingTiming(row, today);
      return {
        open,
        openedAt: row.createdAt,
        dueAt: open && timing.overdue === "Yes" ? new Date(today.getTime() - 86400000) : null,
      };
    }),
    today
  );
}

async function loadProgramme(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.progressScheduleTask.findMany({
    where: { projectId, summary: false },
    select: { pctComplete: true, actualFinish: true, finish: true, baselineFinish: true, start: true, createdAt: true },
  });
  return tally(
    rows.map((row) => {
      const open = !row.actualFinish && row.pctComplete < 0.999;
      return {
        open,
        openedAt: row.start || row.createdAt,
        dueAt: row.finish || row.baselineFinish,
      };
    }),
    today
  );
}

async function loadMilestones(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.progressMilestone.findMany({
    where: { projectId },
    select: { status: true, actualEnd: true, plannedEnd: true, plannedStart: true, pctComplete: true, createdAt: true },
  });
  return tally(
    rows.map((row) => {
      const open = !row.actualEnd && row.pctComplete < 100 && !closedStatus(row.status, CLOSED_WORD);
      return { open, openedAt: row.plannedStart || row.createdAt, dueAt: row.plannedEnd };
    }),
    today
  );
}

async function loadIssues(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.progressHindrance.findMany({
    where: { projectId },
    select: { status: true, resolvedAt: true, occurredAt: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !row.resolvedAt && !closedStatus(row.status, CLOSED_WORD),
      openedAt: row.occurredAt || row.createdAt,
      dueAt: null,
    })),
    today
  );
}

async function loadRisks(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.progressRisk.findMany({
    where: { projectId },
    select: { status: true, targetDate: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !closedStatus(row.status, CLOSED_WORD),
      openedAt: row.createdAt,
      dueAt: row.targetDate,
    })),
    today
  );
}

async function loadCorrespondence(projectId: string): Promise<SubjectCounts> {
  const records = await prisma.communicationLog.count({ where: { projectId } });
  return emptyCounts(records);
}

async function loadMeetings(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.meetingItem.findMany({
    where: { meeting: { projectId }, category: { in: ["Action", "Follow-up"] } },
    select: { resolutionStatus: true, dueDate: true, meeting: { select: { meetingDate: true } } },
  });
  return tally(
    rows.map((row) => ({
      open: !closedStatus(row.resolutionStatus, CLOSED_WORD),
      openedAt: row.meeting.meetingDate,
      dueAt: row.dueDate,
    })),
    today
  );
}

async function loadDrawings(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.drawingRegisterLine.findMany({
    where: { projectId },
    select: { actualSubmissionDate: true, issueDate: true, plannedSubmissionDate: true, createdAt: true },
  });
  return tally(
    rows.map((row) => {
      const submitted = Boolean(row.actualSubmissionDate || row.issueDate);
      return {
        open: !submitted,
        openedAt: row.plannedSubmissionDate || row.createdAt,
        dueAt: row.actualSubmissionDate ? null : row.plannedSubmissionDate,
      };
    }),
    today
  );
}

async function loadDesignReview(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.rfi.findMany({
    where: { projectId, rfiKind: "RequestForInformation" },
    select: { status: true, closedAt: true, dueDate: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: row.status !== "Closed" && !row.closedAt,
      openedAt: row.createdAt,
      dueAt: row.dueDate,
    })),
    today
  );
}

async function loadClash(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.designCoordinationIssue.findMany({
    where: { projectId },
    select: { status: true, dueDate: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !closedStatus(row.status, CLOSED_WORD),
      openedAt: row.createdAt,
      dueAt: row.dueDate,
    })),
    today
  );
}

function isShopDrawing(submittalType: string) {
  return /shop/i.test(submittalType);
}

function isMaterialApproval(submittalType: string) {
  return !isShopDrawing(submittalType) && /material|vendor|product data|sample/i.test(submittalType);
}

async function loadSubmittals(projectId: string, today: Date, match: (type: string) => boolean): Promise<SubjectCounts> {
  const rows = await prisma.submittal.findMany({
    where: { projectId },
    select: { submittalType: true, status: true, dueDate: true, createdAt: true },
  });
  return tally(
    rows.filter((row) => match(row.submittalType || "")).map((row) => ({
      open: !/approved|rejected|closed/i.test(row.status || ""),
      openedAt: row.createdAt,
      dueAt: row.dueDate,
    })),
    today
  );
}

async function loadStatutory(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.progressLegalApproval.findMany({
    where: { projectId },
    select: { status: true, receivedDate: true, requiredBy: true, submissionDate: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !row.receivedDate && !closedStatus(row.status, CLOSED_WORD),
      openedAt: row.submissionDate || row.createdAt,
      dueAt: row.requiredBy,
    })),
    today
  );
}

async function loadDpr(projectId: string, today: Date): Promise<SubjectCounts> {
  const [logs, anchor] = await Promise.all([
    prisma.dailyLog.findMany({ where: { projectId }, select: { logDate: true } }),
    projectAnchor(projectId),
  ]);
  const logged = new Set(logs.map((row) => istKey(row.logDate)));
  const missing = anchor ? missingWorkingDays(anchor, today, logged) : { count: 0, oldest: null };
  return {
    records: logs.length,
    open: 0,
    closed: logs.length,
    overdue: missing.count,
    oldestOpenDays: missing.oldest,
  };
}

async function loadItp(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.qapActivity.findMany({
    where: { projectId },
    select: { status: true, completedAt: true, dueDate: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !row.completedAt && !closedStatus(row.status, CLOSED_WORD),
      openedAt: row.createdAt,
      dueAt: row.dueDate,
    })),
    today
  );
}

async function loadPourChecklists(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.checklistSubmission.findMany({
    where: {
      assignment: { projectId, template: { checklistType: { in: ["QualityInspection", "SiteExecution"] } } },
    },
    select: { status: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !/^(submitted|approved|reviewed|rejected|closed)$/i.test(row.status || ""),
      openedAt: row.createdAt,
      dueAt: null,
    })),
    today
  );
}

async function loadCubeTests(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.cubeTest.findMany({
    where: { projectId },
    select: { castDate: true, testDate28: true, strength28: true, result: true, createdAt: true },
  });
  return tally(
    rows.map((row) => {
      const reported = row.strength28 != null || Boolean((row.result || "").trim());
      return {
        open: !reported,
        openedAt: row.castDate || row.createdAt,
        dueAt: reported ? null : row.testDate28,
      };
    }),
    today
  );
}

async function loadNcr(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.qualityNcr.findMany({
    where: { projectId },
    select: { status: true, actualClosure: true, plannedClosure: true, issueDate: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !row.actualClosure && !closedStatus(row.status, /^closed$/i),
      openedAt: row.issueDate || row.createdAt,
      dueAt: row.plannedClosure,
    })),
    today
  );
}

async function loadSafety(projectId: string, today: Date, match: (recordType: string) => boolean): Promise<SubjectCounts> {
  const rows = await prisma.safetyRecord.findMany({
    where: { projectId },
    select: { recordType: true, status: true, closedAt: true, targetCompletion: true, occurredAt: true, createdAt: true },
  });
  return tally(
    rows.filter((row) => match(row.recordType || "")).map((row) => ({
      open: !row.closedAt && !closedStatus(row.status, CLOSED_WORD),
      openedAt: row.occurredAt || row.createdAt,
      dueAt: row.targetCompletion,
    })),
    today
  );
}

async function loadRaBills(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.raBill.findMany({
    where: { projectId },
    select: { status: true, invoiceDate: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !/^(certified|paid)$/i.test(row.status || ""),
      openedAt: row.invoiceDate || row.createdAt,
      dueAt: null,
    })),
    today
  );
}

async function loadCommitments(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.purchaseOrder.findMany({
    where: { projectId },
    select: { status: true, poDate: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !/closed|complete|cancel|settled/i.test(row.status || ""),
      openedAt: row.poDate || row.createdAt,
      dueAt: null,
    })),
    today
  );
}

async function loadWpr(projectId: string, today: Date): Promise<SubjectCounts> {
  const [rows, anchor] = await Promise.all([
    prisma.wprSnapshot.findMany({
      where: { projectId },
      select: { weekEnding: true, status: true, publishedAt: true, createdAt: true },
    }),
    projectAnchor(projectId),
  ]);
  const filed = new Set(rows.map((row) => istKey(row.weekEnding)));
  const missing = anchor ? fridayKeys(anchor, today).filter((key) => !filed.has(key)) : [];
  const todayN = dayNumber(today);
  let oldest: number | null = null;
  for (const key of missing) {
    const age = todayN - dayNumber(new Date(`${key}T00:00:00Z`));
    oldest = oldest == null ? age : Math.max(oldest, age);
  }
  const openRows = rows.filter((row) => !row.publishedAt && !/^published$/i.test(row.status || ""));
  return {
    records: rows.length,
    open: openRows.length,
    closed: rows.length - openRows.length,
    overdue: missing.length,
    oldestOpenDays: oldest,
  };
}

async function loadSnags(projectId: string, today: Date): Promise<SubjectCounts> {
  const rows = await prisma.snagItem.findMany({
    where: { projectId },
    select: { status: true, closedAt: true, targetCompletionDate: true, raisedOn: true, createdAt: true },
  });
  return tally(
    rows.map((row) => ({
      open: !row.closedAt && !closedStatus(row.status, CLOSED_WORD),
      openedAt: row.raisedOn || row.createdAt,
      dueAt: row.targetCompletionDate,
    })),
    today
  );
}

async function loadLessons(projectId: string): Promise<SubjectCounts> {
  const records = await prisma.lessonLearnt.count({ where: { projectId } });
  return emptyCounts(records);
}

export const SUBJECT_SOURCES: Record<string, SubjectSource> = {
  "01.04_AUDIT": { code: "01.04_AUDIT", model: "AuditFinding", load: loadFindings },
  "02.02_PROGRAMME": { code: "02.02_PROGRAMME", model: "ProgressScheduleTask", load: loadProgramme },
  "02.03_MILESTONE": { code: "02.03_MILESTONE", model: "ProgressMilestone", load: loadMilestones },
  "02.08_ISSUE": { code: "02.08_ISSUE", model: "ProgressHindrance", load: loadIssues },
  "02.08_RISK": { code: "02.08_RISK", model: "ProgressRisk", load: loadRisks },
  "03.06_CORRESPONDENCE": { code: "03.06_CORRESPONDENCE", model: "CommunicationLog", load: (id) => loadCorrespondence(id) },
  "03.08_MEETING": { code: "03.08_MEETING", model: "MeetingItem", load: loadMeetings },
  "04.02_DRAWING": { code: "04.02_DRAWING", model: "DrawingRegisterLine", load: loadDrawings },
  "04.03_DESIGN_REVIEW": { code: "04.03_DESIGN_REVIEW", model: "Rfi", load: loadDesignReview },
  "04.04_CLASH": { code: "04.04_CLASH", model: "DesignCoordinationIssue", load: loadClash },
  "04.08_SHOP_DRAWING": { code: "04.08_SHOP_DRAWING", model: "Submittal", load: (id, today) => loadSubmittals(id, today, isShopDrawing) },
  "04.08_MATERIAL_APPROVAL": {
    code: "04.08_MATERIAL_APPROVAL",
    model: "Submittal",
    load: (id, today) => loadSubmittals(id, today, isMaterialApproval),
  },
  "06.02_APPROVAL_STATUTORY": { code: "06.02_APPROVAL_STATUTORY", model: "ProgressLegalApproval", load: loadStatutory },
  "07.02_DPR": { code: "07.02_DPR", model: "DailyLog", load: loadDpr },
  "08.01_ITP": { code: "08.01_ITP", model: "QapActivity", load: loadItp },
  "08.02_CHECKLIST_POUR": { code: "08.02_CHECKLIST_POUR", model: "ChecklistSubmission", load: loadPourChecklists },
  "08.03_TEST_REPORT": { code: "08.03_TEST_REPORT", model: "CubeTest", load: loadCubeTests },
  "08.06_NCR": { code: "08.06_NCR", model: "QualityNcr", load: loadNcr },
  "08.08_PTW": { code: "08.08_PTW", model: "SafetyRecord", load: (id, today) => loadSafety(id, today, (t) => /permit/i.test(t)) },
  "08.09_TBT": { code: "08.09_TBT", model: "SafetyRecord", load: (id, today) => loadSafety(id, today, (t) => /toolbox/i.test(t)) },
  "08.10_INCIDENT": {
    code: "08.10_INCIDENT",
    model: "SafetyRecord",
    load: (id, today) => loadSafety(id, today, (t) => /incident|near miss|^lti$/i.test(t)),
  },
  "09.01_RA_BILL": { code: "09.01_RA_BILL", model: "RaBill", load: loadRaBills },
  "09.03_COMMITMENT": { code: "09.03_COMMITMENT", model: "PurchaseOrder", load: loadCommitments },
  "10.01_REPORT_ISSUE": { code: "10.01_REPORT_ISSUE", model: "WprSnapshot", load: loadWpr },
  "10.05_SNAG": { code: "10.05_SNAG", model: "SnagItem", load: loadSnags },
  "10.14_LESSONS": { code: "10.14_LESSONS", model: "LessonLearnt", load: (id) => loadLessons(id) },
};

export function portalSourceLabel(dataSource: string | null | undefined) {
  if (dataSource?.startsWith("portal:")) return `Portal - ${dataSource.slice("portal:".length)}`;
  return "Typed";
}

/** Write portal figures onto mapped subjects. Unmapped subjects keep their typed figures. */
export async function refreshProjectSubjects(projectId: string, today = new Date()) {
  const subjects = await prisma.kpiSubject.findMany({ where: { projectId } });
  let updated = 0;
  const refreshedAt = new Date();
  for (const subject of subjects) {
    const code = subjectCodeFromFile(subject.workbookFileName);
    const source = code ? SUBJECT_SOURCES[code] : undefined;
    if (!source) {
      if (!subject.dataSource || subject.dataSource.startsWith("portal:")) {
        await prisma.kpiSubject.update({ where: { id: subject.id }, data: { dataSource: "manual" } });
      }
      continue;
    }
    const counts = await source.load(projectId, today);
    const figures = {
      recordsCount: counts.records,
      openCount: counts.open,
      closedCount: counts.closed,
      overdueCount: counts.overdue,
      oldestOpenDays: counts.oldestOpenDays,
      kraScore: subject.kraScore,
    };
    await prisma.kpiSubject.update({
      where: { id: subject.id },
      data: {
        ...figures,
        pctClosed: subjectPctClosed(figures),
        rag: subjectRag(figures),
        lastRefreshedAt: refreshedAt,
        dataSource: `portal:${source.model}`,
      },
    });
    updated++;
  }
  return { subjects: subjects.length, updated, manual: subjects.length - updated, refreshedAt };
}
