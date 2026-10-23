/**
 * Push branded checklist XLSX (+ HTML for print/PDF) to project SharePoint on draft or submit.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import { buildBrandedChecklistXlsxBuffer } from "./brandedChecklistXlsx.js";
import { buildBrandedChecklistHtml } from "./brandedChecklistHtml.js";

const BRANDED_REVISION_SELECT = {
  revisionNumber: true,
  clientSignName: true,
  clientSignUrl: true,
  pmcSignName: true,
  pmcSignUrl: true,
  siteEngineerSignName: true,
  siteEngineerSignUrl: true,
  contractorSignName: true,
  contractorSignUrl: true,
} as const;

function safeName(s: string) {
  return String(s || "file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 72);
}

/** Same folder the PDF and DWG use, under Checklist, so the filled revision check sits with the drawing. */
export function drawingRevisionChecklistFolder(drawingNumber: string, revisionNumber: string, discipline?: string | null) {
  const disc = String(discipline || "Architecture").replace(/[\\/:*?"<>|#%]+/g, "-").replace(/\s*-\s*/g, "-").trim() || "Architecture";
  const seg = (value: string) => String(value || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${MODULE_TO_ISO_FOLDER.drawings}/${disc}/${seg(drawingNumber)}/${seg(revisionNumber)}/Checklist`;
}

export type ChecklistDriveExport = { kind: "xlsx" | "html"; path: string; url?: string | null };

export async function syncChecklistSubmissionToDrive(
  submissionId: string
): Promise<{ exports: ChecklistDriveExport[] }> {
  const submission = await prisma.checklistSubmission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          project: {
            select: { id: true, name: true, code: true, clientName: true, contractorName: true, location: true },
          },
          template: { include: { items: { orderBy: { sortOrder: "asc" } } } },
        },
      },
      submittedBy: { select: { fullName: true, email: true } },
      drawing: true,
      photos: true,
      revision: { select: BRANDED_REVISION_SELECT },
    },
  });
  if (!submission?.assignment?.project?.code || !submission.assignment.template) {
    return { exports: [] };
  }

  const project = submission.assignment.project;
  const templateName = submission.assignment.template.name || "checklist";
  const stamp = new Date().toISOString().slice(0, 10);
  const statusFolder = submission.status === "Draft" ? "Drafts" : "Submitted";
  const checklistType = submission.assignment.template.checklistType || "";
  // Drawing Check → 04.04 Design Coordination; Safety → 08.07 HSE; Quality/Site/Activity → 08.02
  const baseFolder =
    checklistType === "DrawingCheck"
      ? MODULE_TO_ISO_FOLDER.drawingChecklist
      : checklistType === "Safety"
        ? `${MODULE_TO_ISO_FOLDER.safety}/Checklists`
        : MODULE_TO_ISO_FOLDER.qualityChecklist;
  const folder = `${baseFolder}/${statusFolder}`;
  const revisionNo = submission.revision?.revisionNumber || submission.revisionNumber || "";
  const besideFolder =
    checklistType === "DrawingCheck" && submission.drawing?.drawingNumber && revisionNo
      ? drawingRevisionChecklistFolder(submission.drawing.drawingNumber, revisionNo, submission.drawing.discipline)
      : "";
  const base = `${safeName(templateName)}_${safeName(submission.submittedBy?.fullName || "filler")}_${stamp}`;

  const exports: ChecklistDriveExport[] = [];

  let dirSigns: Awaited<ReturnType<typeof import("./directorySignatures.js").getDirectorySignMap>> | undefined;
  if (project.id) {
    const { getDirectorySignMap } = await import("./directorySignatures.js");
    dirSigns = await getDirectorySignMap(prisma, project.id);
  }

  try {
    const xlsxBuf = await buildBrandedChecklistXlsxBuffer(submission as any, project);
    const xlsx = await mockOneDrive.upload(
      project.code,
      folder,
      `${base}.xlsx`,
      xlsxBuf,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    exports.push({ kind: "xlsx", path: xlsx.sharePointPath || xlsx.path, url: xlsx.sharePointUrl || xlsx.url });
    if (besideFolder) {
      const beside = await mockOneDrive.upload(
        project.code,
        besideFolder,
        `${base}.xlsx`,
        xlsxBuf,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        { replace: true }
      );
      exports.push({ kind: "xlsx", path: beside.sharePointPath || beside.path, url: beside.sharePointUrl || beside.url });
    }
  } catch (err) {
    console.warn("[checklist] XLSX drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";
    const html = buildBrandedChecklistHtml(
      submission as any,
      `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`,
      dirSigns
    );
    const htmlFile = await mockOneDrive.upload(project.code, folder, `${base}.html`, Buffer.from(html, "utf8"), "text/html");
    exports.push({
      kind: "html",
      path: htmlFile.sharePointPath || htmlFile.path,
      url: htmlFile.sharePointUrl || htmlFile.url,
    });
    if (besideFolder) {
      const besideHtml = await mockOneDrive.upload(
        project.code,
        besideFolder,
        `${base}.html`,
        Buffer.from(html, "utf8"),
        "text/html",
        { replace: true }
      );
      exports.push({
        kind: "html",
        path: besideHtml.sharePointPath || besideHtml.path,
        url: besideHtml.sharePointUrl || besideHtml.url,
      });
    }
  } catch (err) {
    console.warn("[checklist] HTML drive sync failed:", err instanceof Error ? err.message : err);
  }

  return { exports };
}
