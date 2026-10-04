/**
 * End-of-day reconcile: rewrite SharePoint registers from the database.
 * One live GFC log, one live drawing register, one live RFI register,
 * plus a week folder that is not overwritten by the next week.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import { drawingRegisterWeekStamp, publishDrawingRegistersToDrive } from "./drawingRegisterDrive.js";
import { buildSpdcRfiXlsxBuffer } from "./spdcRfiForm.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function reconcileProjectSharePoint(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, code: true, name: true },
  });
  if (!project) throw new Error("Project not found");

  await publishDrawingRegistersToDrive(projectId);

  const week = drawingRegisterWeekStamp();
  try {
    const { publishQualityPackToDrive } = await import("./registerWorkbookPublish.js");
    await publishQualityPackToDrive(projectId, "system-reconcile");
  } catch (err) {
    console.warn("[sharepoint] quality pack reconcile skipped:", err instanceof Error ? err.message : err);
  }

  try {
    const { syncAllQualityNcrsForProject } = await import("./syncNcrToDrive.js");
    const ncrSync = await syncAllQualityNcrsForProject(projectId);
    console.log(
      `[sharepoint] NCR/CAR sync ${project.code}: ${ncrSync.synced} forms + register (${ncrSync.register.length} files)`
    );
  } catch (err) {
    console.warn("[sharepoint] NCR/CAR reconcile skipped:", err instanceof Error ? err.message : err);
  }

  // SPDC RFI register holds design queries only; inspection / checklist requests are separate registers.
  const rfis = await prisma.rfi.findMany({
    where: { projectId, rfiKind: { in: ["RequestForInformation", "Manual"] } },
    include: {
      assignedTo: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
      drawing: { select: { id: true, drawingNumber: true, title: true, currentRev: true } },
      vendor: { select: { id: true, name: true } },
      responses: { include: { respondedBy: { select: { fullName: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  const full = await prisma.project.findUnique({ where: { id: projectId } });
  if (full) {
    const registerBuf = await buildSpdcRfiXlsxBuffer({ project: full, rfis });
    const liveFolder = `${MODULE_TO_ISO_FOLDER.rfiInformation}/_Registers`;
    const weekFolder = `${liveFolder}/Weekly/${week}`;
    await mockOneDrive.upload(project.code, liveFolder, "SPDC_RFI_Form_and_Register.xlsx", registerBuf, XLSX_MIME, {
      replace: true,
    });
    await mockOneDrive.upload(project.code, weekFolder, "SPDC_RFI_Form_and_Register.xlsx", registerBuf, XLSX_MIME, {
      replace: true,
    });
  }

  return {
    projectCode: project.code,
    week,
    files: [
      "04.02/DRAWING-REGISTER-01.xlsx",
      "04.02/DRAWING-REGISTER-Dashboard.pdf",
      "04.02/Approval-GFC-Drawing-Log.xlsx",
      "04.02/Approval-GFC-Drawing-Log.pdf",
      "04.02/Master-Drawing-Register.pdf",
      "04.02/Design-Coordination-Register.xlsx",
      "04.02/Design-Coordination-Register.pdf",
      `04.02/Weekly/${week}/`,
      "08.01 Quality Assurance Plan + Weekly/",
      "08.03 Cube register + Weekly/",
      "08.01 Quality Dashboard + Weekly/",
      "08.06 Quality NCR/CAR forms (Drafts/Open/Closed) + _Registers/SPDC_NCR_CAR_Register.xlsx",
      "03.06/_Registers/SPDC_RFI_Form_and_Register.xlsx",
      `03.06/_Registers/Weekly/${week}/SPDC_RFI_Form_and_Register.xlsx`,
    ],
  };
}

export async function reconcileAllActiveProjects() {
  const projects = await prisma.project.findMany({
    where: { status: { notIn: ["Archived", "Lost", "Closed"] } },
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });
  const results: { code: string; ok: boolean; week?: string; error?: string }[] = [];
  for (const project of projects) {
    try {
      const out = await reconcileProjectSharePoint(project.id);
      results.push({ code: project.code, ok: true, week: out.week });
      console.log(`[sharepoint] day close ${project.code} → ${out.week}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ code: project.code, ok: false, error });
      console.warn(`[sharepoint] day close ${project.code} failed:`, error);
    }
  }
  return { at: new Date().toISOString(), projects: results };
}

let lastRunKey = "";

function kolkataParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

/** Once per working day, after 19:00 IST, rewrite every active project's sheets. */
export function startSharePointDayClose() {
  const hour = Number(process.env.SHAREPOINT_SYNC_HOUR || 19);
  setInterval(() => {
    const now = kolkataParts();
    if (now.hour !== hour || now.minute > 1) return;
    if (lastRunKey === now.day) return;
    lastRunKey = now.day;
    console.log(`[sharepoint] end of working day ${now.day} — reconciling registers`);
    void reconcileAllActiveProjects().catch((err) =>
      console.warn("[sharepoint] day close failed:", err instanceof Error ? err.message : err),
    );
  }, 60_000);
  console.log(`[sharepoint] day-close scheduled at ${hour}:00 Asia/Kolkata`);
}
