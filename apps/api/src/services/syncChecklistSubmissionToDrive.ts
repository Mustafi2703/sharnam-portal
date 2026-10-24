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

export type ChecklistDriveExport = { kind: "xlsx" | "html" | "pdf"; path: string; url?: string | null };

async function buildChecklistPdfBuffer(
  submission: {
    status: string;
    responsesJson: string;
    revisionNumber?: string | null;
    submittedBy?: { fullName?: string | null } | null;
    assignment: { template: { name?: string | null; items?: { id: string; label?: string | null; question?: string | null }[] } };
  },
  project: { name?: string | null; code?: string | null },
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const { sharnamLogoPath } = await import("./brandedExport.js");
  const logo = sharnamLogoPath();
  let responses: Record<string, { answer?: string; remark?: string }> = {};
  try {
    responses = JSON.parse(submission.responsesJson || "{}");
  } catch {
    responses = {};
  }
  const items = submission.assignment.template.items || [];
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    if (logo) {
      try {
        doc.image(logo, 36, 28, { fit: [84, 34] });
      } catch {
        /* logo optional */
      }
    }
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1e3a5f").text("SHARNAM PROJECT DEVELOPMENT CONSULTANTS & CO.", 130, 30, { width: 420 });
    doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(project.name || project.code || "Project", 130, 50);
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#1e3a5f").text(submission.assignment.template.name || "Checklist", 36, 78);
    doc.font("Helvetica").fontSize(9).fillColor("#334155").text(
      `${submission.status} · ${submission.submittedBy?.fullName || "Filler"}${submission.revisionNumber ? ` · ${submission.revisionNumber}` : ""}`,
      36,
      98,
    );
    let y = 122;
    const lines = items.length ? items : Object.keys(responses).map((id) => ({ id, label: id, question: "" }));
    for (const item of lines.slice(0, 40)) {
      if (y > 760) {
        doc.addPage();
        y = 40;
      }
      const answer = responses[item.id]?.answer || "—";
      doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(item.label || item.question || "Line", 36, y, { width: 520 });
      y = doc.y + 1;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a").text(String(answer), 36, y, { width: 520 });
      y = doc.y + 8;
    }
    doc.end();
  });
}

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
  const folders = [folder];
  if (besideFolder) folders.push(besideFolder);
  if (checklistType === "DrawingCheck") folders.push(`${MODULE_TO_ISO_FOLDER.drawings}/Filed-Checklists`);

  async function put(name: string, body: Buffer, mime: string, kind: ChecklistDriveExport["kind"]) {
    for (const target of folders) {
      const up = await mockOneDrive.upload(project.code, target, name, body, mime, { replace: true });
      exports.push({ kind, path: up.sharePointPath || up.path, url: up.sharePointUrl || up.url });
    }
  }

  let dirSigns: Awaited<ReturnType<typeof import("./directorySignatures.js").getDirectorySignMap>> | undefined;
  if (project.id) {
    const { getDirectorySignMap } = await import("./directorySignatures.js");
    dirSigns = await getDirectorySignMap(prisma, project.id);
  }

  try {
    const xlsxBuf = await buildBrandedChecklistXlsxBuffer(submission as any, project);
    await put(base + ".xlsx", xlsxBuf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
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
    await put(base + ".html", Buffer.from(html, "utf8"), "text/html", "html");
  } catch (err) {
    console.warn("[checklist] HTML drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const pdf = await buildChecklistPdfBuffer(submission as any, project);
    await put(base + ".pdf", pdf, "application/pdf", "pdf");
  } catch (err) {
    console.warn("[checklist] PDF drive sync failed:", err instanceof Error ? err.message : err);
  }

  return { exports };
}

export function extraChecklistIdsFromBody(body: { extraChecklistIds?: unknown } | null | undefined) {
  const raw = body?.extraChecklistIds;
  if (Array.isArray(raw)) return raw.map((id) => String(id).trim()).filter(Boolean);
  const text = String(raw || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((id) => String(id).trim()).filter(Boolean);
  } catch {
    /* comma separated */
  }
  return text.split(",").map((id) => id.trim()).filter(Boolean);
}

/** Link extra filled checklists (including a custom template) onto a drawing revision and file them. */
export async function attachFilledChecklistsToRevision(opts: {
  projectId: string;
  drawingId: string;
  revisionId: string;
  revisionNumber: string;
  assignmentIds: string[];
}) {
  const ids = [...new Set(opts.assignmentIds.map((id) => id.trim()).filter(Boolean))];
  for (const assignmentId of ids) {
    const assignment = await prisma.checklistAssignment.findFirst({
      where: { id: assignmentId, projectId: opts.projectId },
      select: { id: true },
    });
    if (!assignment) continue;
    const latest = await prisma.checklistSubmission.findFirst({
      where: { assignmentId },
      orderBy: { updatedAt: "desc" },
    });
    if (!latest) continue;
    await prisma.checklistSubmission.update({
      where: { id: latest.id },
      data: {
        drawingId: opts.drawingId,
        revisionId: opts.revisionId,
        revisionNumber: opts.revisionNumber,
      },
    });
    await syncChecklistSubmissionToDrive(latest.id);
  }
}
