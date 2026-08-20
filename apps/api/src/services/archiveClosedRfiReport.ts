/**
 * Archive closed RFI + linked checklist fill as branded XLSX into SharePoint ISO folders.
 * Called on RFI Close and on checklist Approve + closeRfi.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import { buildBrandedChecklistXlsxBuffer } from "./brandedChecklistXlsx.js";

function safeName(s: string) {
  return String(s || "file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

export async function archiveClosedRfiReport(opts: {
  projectId: string;
  rfiId: string;
}): Promise<{ uploaded: Array<{ kind: string; path: string; url?: string | null }> }> {
  const project = await prisma.project.findUnique({ where: { id: opts.projectId } });
  if (!project) return { uploaded: [] };

  const rfi = await prisma.rfi.findUnique({ where: { id: opts.rfiId } });
  if (!rfi) return { uploaded: [] };

  const uploaded: Array<{ kind: string; path: string; url?: string | null }> = [];
  const stamp = new Date().toISOString().slice(0, 10);
  const folder = `${MODULE_TO_ISO_FOLDER.rfiInformation}/Closed`;

  /** Minimal RFI closure register row (always) */
  const registerCsv = [
    "Number,Subject,Kind,Status,ClosedAt,LinkedAssignment",
    [
      rfi.number,
      JSON.stringify(rfi.subject || ""),
      rfi.rfiKind || "",
      rfi.status,
      rfi.closedAt?.toISOString() || new Date().toISOString(),
      rfi.linkedAssignmentId || "",
    ].join(","),
  ].join("\n");

  const reg = await mockOneDrive.upload(
    project.code,
    folder,
    `${safeName(rfi.number)}_CLOSED_${stamp}.csv`,
    Buffer.from(registerCsv, "utf8"),
    "text/csv"
  );
  uploaded.push({ kind: "rfi-register", path: reg.sharePointPath || reg.path, url: reg.sharePointUrl || reg.url });

  if (!rfi.linkedAssignmentId) return { uploaded };

  const submission = await prisma.checklistSubmission.findFirst({
    where: {
      assignmentId: rfi.linkedAssignmentId,
      status: { in: ["Submitted", "Approved", "Reviewed"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      photos: true,
      assignment: {
        include: {
          template: { include: { items: { orderBy: { sortOrder: "asc" } } } },
          project: true,
        },
      },
    },
  });

  if (!submission?.assignment?.template) return { uploaded };

  const buf = await buildBrandedChecklistXlsxBuffer(submission as any, {
    name: project.name,
    code: project.code,
    clientName: project.clientName,
    contractorName: project.contractorName,
    location: project.location,
  });

  const checklistFolder = `${MODULE_TO_ISO_FOLDER.qualityChecklist}/Closed_RFI`;
  const xlsx = await mockOneDrive.upload(
    project.code,
    checklistFolder,
    `${safeName(rfi.number)}_${safeName(submission.assignment.template.name)}_${stamp}.xlsx`,
    buf,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  uploaded.push({
    kind: "branded-checklist",
    path: xlsx.sharePointPath || xlsx.path,
    url: xlsx.sharePointUrl || xlsx.url,
  });

  return { uploaded };
}
