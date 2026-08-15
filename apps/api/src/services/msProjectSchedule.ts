/**
 * MS Project XML (MSPDI) import, demo seed, and S-curve generation.
 * Feeds Progress → Planned vs Actual → DPR/WPR charts (no Project Online license required).
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";

export type MsProjectTask = {
  uid: number;
  id: string;
  name: string;
  outlineLevel: number;
  summary: boolean;
  start: Date | null;
  finish: Date | null;
  baselineStart: Date | null;
  baselineFinish: Date | null;
  durationDays: number;
  percentComplete: number;
  wbs: string;
};

export type ScurvePoint = {
  periodLabel: string;
  date: string;
  plannedPct: number;
  actualPct: number;
};

const MS_PROJECT_FOLDER = "07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve/MS_Project";
const MS_SOURCE = "MS Project XML";
const SCURVE_PACKAGE = "MS Project S-curve";

function tagValue(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

function parseMsDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse ISO 8601 duration PT8H0M0S → days (8h = 1 day in MS Project convention). */
function parseDurationDays(raw: string): number {
  if (!raw) return 0;
  const dayMatch = raw.match(/P(\d+)D/i);
  if (dayMatch) return Number(dayMatch[1]) || 0;
  const hourMatch = raw.match(/PT(\d+)H/i);
  if (hourMatch) return Math.max(0.125, Number(hourMatch[1]) / 8);
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function pct(n: number, digits = 1) {
  return Math.round(n * 10 ** digits) / 10 ** digits;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function weekLabel(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function taskFractionComplete(start: Date | null, finish: Date | null, asOf: Date): number {
  if (!start || !finish || finish <= start) return 0;
  if (asOf <= start) return 0;
  if (asOf >= finish) return 1;
  return (asOf.getTime() - start.getTime()) / (finish.getTime() - start.getTime());
}

export function parseMsProjectXml(buffer: Buffer): { projectName: string; tasks: MsProjectTask[] } {
  const xml = buffer.toString("utf8");
  const projectName = tagValue(xml, "Name") || tagValue(xml, "Title") || "Project Schedule";
  const blocks = xml.match(/<Task>[\s\S]*?<\/Task>/gi) || [];
  const tasks: MsProjectTask[] = [];

  for (const block of blocks) {
    const uid = Number(tagValue(block, "UID"));
    if (!uid || uid === 0) continue;
    const name = tagValue(block, "Name");
    if (!name) continue;
    const summary = /^1|true$/i.test(tagValue(block, "Summary"));
    const outlineLevel = Number(tagValue(block, "OutlineLevel") || "1");
    const start = parseMsDate(tagValue(block, "Start"));
    const finish = parseMsDate(tagValue(block, "Finish"));
    const baselineStart = parseMsDate(tagValue(block, "BaselineStart")) || start;
    const baselineFinish = parseMsDate(tagValue(block, "BaselineFinish")) || finish;
    const durationDays = parseDurationDays(tagValue(block, "Duration")) || parseDurationDays(tagValue(block, "Work"));
    const percentComplete = Math.min(100, Math.max(0, Number(tagValue(block, "PercentComplete") || "0")));
    const wbs = tagValue(block, "WBS") || tagValue(block, "OutlineNumber") || String(uid);

    tasks.push({
      uid,
      id: tagValue(block, "ID") || String(uid),
      name,
      outlineLevel,
      summary,
      start,
      finish,
      baselineStart,
      baselineFinish,
      durationDays: durationDays || (start && finish ? Math.max(1, (finish.getTime() - start.getTime()) / 86400000) : 0),
      percentComplete,
      wbs,
    });
  }

  return { projectName, tasks };
}

/** Weighted planned vs actual cumulative % — one point per week. */
export function buildScurveFromTasks(tasks: MsProjectTask[], asOf = new Date()): ScurvePoint[] {
  const workTasks = tasks.filter((t) => !t.summary && t.durationDays > 0 && t.start && t.finish);
  if (!workTasks.length) return [];

  const totalWork = workTasks.reduce((s, t) => s + t.durationDays, 0);
  const rangeStart = workTasks.reduce(
    (min, t) => (t.baselineStart && t.baselineStart < min ? t.baselineStart : min),
    workTasks[0].baselineStart || workTasks[0].start!
  );
  const rangeEnd = workTasks.reduce(
    (max, t) => (t.baselineFinish && t.baselineFinish > max ? t.baselineFinish : max),
    workTasks[0].baselineFinish || workTasks[0].finish!
  );

  const points: ScurvePoint[] = [];
  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(23, 59, 59, 999);
  const today = new Date(asOf);
  today.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    let plannedWork = 0;
    let actualWork = 0;

    for (const t of workTasks) {
      const planStart = t.baselineStart || t.start!;
      const planFinish = t.baselineFinish || t.finish!;
      plannedWork += taskFractionComplete(planStart, planFinish, weekEnd) * t.durationDays;

      const evalDate = weekEnd <= today ? weekEnd : today;
      if (evalDate >= (t.start || planStart)) {
        const timeFrac = taskFractionComplete(t.start, t.finish, evalDate);
        const reported = (t.percentComplete / 100) * t.durationDays;
        actualWork += Math.min(reported, timeFrac * t.durationDays + reported * 0.15);
      }
    }

    points.push({
      periodLabel: weekLabel(cursor),
      date: isoDate(weekEnd),
      plannedPct: pct((plannedWork / totalWork) * 100),
      actualPct: pct(Math.min(100, (actualWork / totalWork) * 100)),
    });

    cursor.setDate(cursor.getDate() + 7);
    if (points.length > 104) break;
  }

  return points;
}

/** Demo MSPDI — SPDC-style civil schedule (export-compatible XML). */
export function generateDemoMsProjectXml(projectCode: string, projectName: string, anchor = new Date("2025-06-01")): Buffer {
  const start = new Date(anchor);
  start.setHours(8, 0, 0, 0);

  type DemoTask = { uid: number; name: string; level: number; summary: boolean; offsetDays: number; duration: number; pct: number };
  const demoTasks: DemoTask[] = [
    { uid: 1, name: `${projectName} — Master Schedule`, level: 1, summary: true, offsetDays: 0, duration: 540, pct: 42 },
    { uid: 2, name: "Site mobilisation & temp works", level: 2, summary: false, offsetDays: 0, duration: 21, pct: 100 },
    { uid: 3, name: "Excavation & earthwork", level: 2, summary: false, offsetDays: 14, duration: 45, pct: 100 },
    { uid: 4, name: "Foundation & pile cap", level: 2, summary: false, offsetDays: 45, duration: 60, pct: 88 },
    { uid: 5, name: "Sub-structure (columns, shear wall)", level: 2, summary: false, offsetDays: 90, duration: 75, pct: 72 },
    { uid: 6, name: "Super-structure slab cycle", level: 2, summary: false, offsetDays: 150, duration: 120, pct: 55 },
    { uid: 7, name: "Masonry & plaster", level: 2, summary: false, offsetDays: 220, duration: 90, pct: 38 },
    { uid: 8, name: "Electrical — DB & cabling", level: 2, summary: false, offsetDays: 260, duration: 75, pct: 28 },
    { uid: 9, name: "Plumbing — risers & fixtures", level: 2, summary: false, offsetDays: 270, duration: 70, pct: 22 },
    { uid: 10, name: "Fire fighting & alarm", level: 2, summary: false, offsetDays: 290, duration: 60, pct: 15 },
    { uid: 11, name: "External development & paving", level: 2, summary: false, offsetDays: 320, duration: 55, pct: 8 },
    { uid: 12, name: "Testing, commissioning & handover", level: 2, summary: false, offsetDays: 380, duration: 45, pct: 0 },
  ];

  const taskXml = demoTasks
    .map((t) => {
      const s = new Date(start);
      s.setDate(s.getDate() + t.offsetDays);
      const f = new Date(s);
      f.setDate(f.getDate() + t.duration);
      const dur = `PT${Math.round(t.duration * 8)}H0M0S`;
      return `<Task>
  <UID>${t.uid}</UID>
  <ID>${t.uid}</ID>
  <Name>${t.name}</Name>
  <OutlineLevel>${t.level}</OutlineLevel>
  <Summary>${t.summary ? 1 : 0}</Summary>
  <WBS>${t.uid}</WBS>
  <Start>${s.toISOString()}</Start>
  <Finish>${f.toISOString()}</Finish>
  <BaselineStart>${s.toISOString()}</BaselineStart>
  <BaselineFinish>${f.toISOString()}</BaselineFinish>
  <Duration>${dur}</Duration>
  <PercentComplete>${t.pct}</PercentComplete>
</Task>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${projectName}</Name>
  <Title>${projectCode} Schedule</Title>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${start.toISOString()}</StartDate>
  <Tasks>${taskXml}</Tasks>
</Project>`;

  return Buffer.from(xml, "utf8");
}

async function clearMsProjectRows(projectId: string) {
  await prisma.progressMilestone.deleteMany({ where: { projectId, category: MS_SOURCE } });
  await prisma.progressPlannedActual.deleteMany({ where: { projectId, packageName: SCURVE_PACKAGE } });
  await prisma.progressActivityLine.deleteMany({ where: { projectId, status: MS_SOURCE } });
}

export async function importMsProjectToProgress(
  projectId: string,
  xmlBuffer: Buffer,
  opts?: { fileName?: string; projectCode?: string }
): Promise<{
  projectName: string;
  taskCount: number;
  scurvePoints: number;
  filePath: string;
  fileUrl: string;
  scurve: ScurvePoint[];
  tasks: MsProjectTask[];
}> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const { projectName, tasks } = parseMsProjectXml(xmlBuffer);
  const scurve = buildScurveFromTasks(tasks);
  const fileName = opts?.fileName || `${project.code}-Schedule.xml`;

  await clearMsProjectRows(projectId);

  const leafTasks = tasks.filter((t) => !t.summary && t.name);
  let sr = 1;
  for (const t of leafTasks.slice(0, 80)) {
    await prisma.progressMilestone.create({
      data: {
        projectId,
        code: `MSP-${t.uid}`,
        category: MS_SOURCE,
        activity: t.name,
        plannedStart: t.baselineStart || t.start,
        plannedEnd: t.baselineFinish || t.finish,
        plannedDays: t.durationDays,
        pctComplete: t.percentComplete / 100,
        weightage: t.durationDays,
        status: t.percentComplete >= 100 ? "Complete" : t.percentComplete > 0 ? "In Progress" : "Planned",
      },
    });

    await prisma.progressActivityLine.create({
      data: {
        projectId,
        srNo: sr++,
        tower: "Schedule",
        activity: t.name,
        unit: "Task",
        plannedStart: t.baselineStart || t.start,
        plannedEnd: t.baselineFinish || t.finish,
        boqQty: 100,
        gfcQty: 100,
        executedQty: t.percentComplete,
        balanceQty: Math.max(0, 100 - t.percentComplete),
        pctComplete: t.percentComplete / 100,
        status: MS_SOURCE,
      },
    });
  }

  for (const p of scurve) {
    await prisma.progressPlannedActual.create({
      data: {
        projectId,
        periodLabel: p.periodLabel,
        packageName: SCURVE_PACKAGE,
        plannedPct: p.plannedPct / 100,
        actualPct: p.actualPct / 100,
        plannedAmount: p.plannedPct,
        actualAmount: p.actualPct,
      },
    });
  }

  const saved = await mockOneDrive.upload(project.code, MS_PROJECT_FOLDER, fileName, xmlBuffer);

  return {
    projectName,
    taskCount: leafTasks.length,
    scurvePoints: scurve.length,
    filePath: saved.path,
    fileUrl: saved.url,
    scurve,
    tasks: leafTasks,
  };
}

export async function seedDemoMsProject(projectId: string): Promise<Awaited<ReturnType<typeof importMsProjectToProgress>>> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const xml = generateDemoMsProjectXml(project.code, project.name);
  return importMsProjectToProgress(projectId, xml, {
    fileName: `${project.code}-Demo-Schedule.xml`,
    projectCode: project.code,
  });
}

export async function loadMsProjectSummary(projectId: string) {
  const [milestones, scurveRows, activityLines, project] = await Promise.all([
    prisma.progressMilestone.findMany({
      where: { projectId, category: MS_SOURCE },
      orderBy: { code: "asc" },
    }),
    prisma.progressPlannedActual.findMany({
      where: { projectId, packageName: SCURVE_PACKAGE },
      orderBy: { createdAt: "asc" },
    }),
    prisma.progressActivityLine.findMany({
      where: { projectId, status: MS_SOURCE },
      orderBy: { srNo: "asc" },
    }),
    prisma.project.findUnique({ where: { id: projectId } }),
  ]);

  const scurve: ScurvePoint[] = scurveRows.map((r) => ({
    periodLabel: r.periodLabel,
    date: r.createdAt.toISOString().slice(0, 10),
    plannedPct: pct((r.plannedPct || 0) * 100),
    actualPct: pct((r.actualPct || 0) * 100),
  }));

  const tasks: MsProjectTask[] = milestones.map((m) => ({
    uid: Number(String(m.code || "").replace(/\D/g, "")) || 0,
    id: m.code || "",
    name: m.activity,
    outlineLevel: 2,
    summary: false,
    start: m.plannedStart,
    finish: m.plannedEnd,
    baselineStart: m.plannedStart,
    baselineFinish: m.plannedEnd,
    durationDays: m.plannedDays || 0,
    percentComplete: (m.pctComplete || 0) * 100,
    wbs: m.code || "",
  }));

  const fileName = project ? `${project.code}-Demo-Schedule.xml` : "Schedule.xml";
  const fileUrl = project ? mockOneDrive.getDownloadUrl(project.code, `${MS_PROJECT_FOLDER}/${fileName}`) : null;

  return {
    connected: scurve.length > 0,
    taskCount: milestones.length,
    scurvePoints: scurve.length,
    fileFolder: MS_PROJECT_FOLDER,
    fileName,
    fileUrl,
    scurve,
    tasks,
    activityLines: activityLines.length,
  };
}
