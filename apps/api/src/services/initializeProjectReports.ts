/**
 * Create the first system DPR + WPR drafts from live project data (idempotent).
 */
import { prisma } from "../prisma.js";
import { buildDprAutoFill } from "./dprIntegrations.js";
import { seedWprSections } from "./wprSeedSections.js";
import { snapWeekEnding } from "./wprDemoSeed.js";

function startOfDay(d = new Date()) {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day;
}

export type InitReportsResult = {
  dpr: { created: boolean; id: string; logDate: string; discipline: string; status: string };
  wpr: { created: boolean; id: string; weekEnding: string; status: string };
};

export async function initializeProjectReports(projectId: string, userId: string): Promise<InitReportsResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  const logDate = startOfDay();
  const discipline = "CIVIL";

  let dpr = await prisma.dprSnapshot.findUnique({
    where: { projectId_logDate_discipline: { projectId, logDate, discipline } },
  });
  let dprCreated = false;
  if (!dpr) {
    const auto = await buildDprAutoFill(projectId, logDate, discipline);
    const extras = {
      manpower: auto.manpower,
      equipment: [],
      materials: auto.materials,
      qualityTests: auto.qualityTests,
      safetyRows: auto.safetyRows,
      safety: auto.safety,
      delays: auto.delays,
      approvals: auto.approvals,
      issues: auto.issues,
      highlights: [] as string[],
      nextDayPlan: [] as string[],
      decisions: [] as string[],
      photos: [] as unknown[],
      attachments: [] as unknown[],
      signatures: [] as unknown[],
    };
    const header = {
      projectName: project.name,
      projectManager: project.designConsultant || "",
      contractor: project.contractorName || "",
      location: project.location || "",
      contractRef: project.code,
      contractCompletion: project.endDate ? project.endDate.toISOString() : null,
      calendarHours: "6 Days / Week – 8 hrs",
      shiftHours: 8,
      weather: "",
      reportDate: logDate.toISOString(),
      dataDate: logDate.toISOString(),
      reportNumber: `DPR/CIV-${project.code}`,
      acCertifiedToDate: auto.header.acCertifiedToDate ?? 0,
      cumManDaysPrev: auto.header.cumManDaysPrev ?? 0,
      cumSafeManHoursPrev: auto.header.cumSafeManHoursPrev ?? 0,
      dateOfLastLti: null,
      preparedBy: "Site Engineer – SPDC (PMC)",
      _extras: extras,
    };
    dpr = await prisma.dprSnapshot.create({
      data: {
        projectId,
        logDate,
        discipline,
        headerJson: JSON.stringify(header),
        linesJson: JSON.stringify(auto.lines || []),
        status: "Draft",
        createdById: userId,
      },
    });
    dprCreated = true;
  }

  const weekEnd = snapWeekEnding(new Date());
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  let wpr = await prisma.wprSnapshot.findUnique({
    where: { projectId_weekEnding: { projectId, weekEnding: weekEnd } },
  });
  let wprCreated = false;
  if (!wpr) {
    const sections = await seedWprSections(prisma, projectId, weekStart, weekEnd);
    wpr = await prisma.wprSnapshot.create({
      data: {
        projectId,
        weekEnding: weekEnd,
        reportNumber: 1,
        sectionsJson: JSON.stringify(sections),
        status: "Draft",
        createdById: userId,
      },
    });
    wprCreated = true;
  }

  return {
    dpr: {
      created: dprCreated,
      id: dpr.id,
      logDate: logDate.toISOString().slice(0, 10),
      discipline,
      status: dpr.status,
    },
    wpr: {
      created: wprCreated,
      id: wpr.id,
      weekEnding: weekEnd.toISOString().slice(0, 10),
      status: wpr.status,
    },
  };
}
