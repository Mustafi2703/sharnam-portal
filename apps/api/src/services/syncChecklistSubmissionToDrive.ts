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
            select: { name: true, code: true, clientName: true, contractorName: true, location: true },
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
  const folder = `${MODULE_TO_ISO_FOLDER.qualityChecklist}/${statusFolder}`;
  const base = `${safeName(templateName)}_${safeName(submission.submittedBy?.fullName || "filler")}_${stamp}`;

  const exports: ChecklistDriveExport[] = [];

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
  } catch (err) {
    console.warn("[checklist] XLSX drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";
    const html = buildBrandedChecklistHtml(submission as any, `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`);
    const htmlFile = await mockOneDrive.upload(project.code, folder, `${base}.html`, Buffer.from(html, "utf8"), "text/html");
    exports.push({
      kind: "html",
      path: htmlFile.sharePointPath || htmlFile.path,
      url: htmlFile.sharePointUrl || htmlFile.url,
    });
  } catch (err) {
    console.warn("[checklist] HTML drive sync failed:", err instanceof Error ? err.message : err);
  }

  return { exports };
}
