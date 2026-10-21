import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import {
  buildApprovalGfcLogPdf,
  buildApprovalGfcLogXlsx,
  buildDesignCoordinationRegisterPdf,
  buildDesignCoordinationRegisterXlsx,
  buildDrawingRegisterDashboardPdf,
  buildDrawingRegisterWorkbookXlsx,
  buildMasterRegisterPdf,
} from "./drawingRegisterExport.js";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function day(value: Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME = "application/pdf";

/** Live drawing registers — Excel + PDF on project SharePoint (DRAWING REGISTER - 01 + Approval & GFC log). */
export async function publishDrawingRegistersToDrive(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
  if (!project) return;
  const folder = MODULE_TO_ISO_FOLDER.drawings;

  const [registerXlsx, gfcXlsx, dashboardPdf, masterPdf, gfcPdf] = await Promise.all([
    buildDrawingRegisterWorkbookXlsx(projectId),
    buildApprovalGfcLogXlsx(projectId),
    buildDrawingRegisterDashboardPdf(projectId),
    buildMasterRegisterPdf(projectId),
    buildApprovalGfcLogPdf(projectId),
  ]);

  await mockOneDrive.upload(project.code, folder, "Master-Drawing-Register.pdf", masterPdf, PDF_MIME, { replace: true });
  await mockOneDrive.upload(project.code, folder, "Approval-GFC-Drawing-Log.pdf", gfcPdf, PDF_MIME, { replace: true });
  await publishCoordinationRegisterToDrive(projectId);

  await mockOneDrive.upload(project.code, folder, "DRAWING-REGISTER-01.xlsx", registerXlsx, XLSX_MIME, {
    replace: true,
  });
  await mockOneDrive.upload(project.code, folder, "DRAWING-REGISTER-Dashboard.pdf", dashboardPdf, PDF_MIME, {
    replace: true,
  });
  await mockOneDrive.upload(project.code, folder, "Approval-GFC-Drawing-Log.xlsx", gfcXlsx, XLSX_MIME, {
    replace: true,
  });

  // Lightweight CSV log for drawing-check fills (audit trail)
  const lines = await prisma.drawingRegisterLine.findMany({
    where: { projectId },
    orderBy: [{ srNo: "asc" }, { drawingNumber: "asc" }],
  });
  const registerCsv = csv([
    [
      "Sr",
      "Package",
      "Building",
      "Discipline",
      "Drawing No",
      "Title",
      "Type",
      "Consultant",
      "Revision",
      "Planned",
      "Actual",
      "Delay days",
      "Critical",
    ],
    ...lines.map((line) => [
      line.srNo ?? "",
      line.projectPackage ?? "",
      line.building ?? "",
      line.discipline ?? "",
      line.drawingNumber,
      line.drawingTitle,
      line.drawingType ?? "",
      line.consultantName ?? "",
      line.revisionNumber ?? "",
      day(line.plannedSubmissionDate),
      day(line.actualSubmissionDate),
      line.submissionDelayDays ?? "",
      line.criticalDrawing ?? "",
    ]),
  ]);

  const checks = await prisma.checklistSubmission.findMany({
    where: { assignment: { projectId, template: { checklistType: "DrawingCheck" } } },
    include: { assignment: { include: { template: { select: { name: true } } } } },
    orderBy: { updatedAt: "desc" },
    take: 400,
  });
  const checkCsv = csv([
    ["Template", "Status", "Revision", "Purpose", "Updated"],
    ...checks.map((row) => [
      row.assignment.template.name,
      row.status,
      row.revisionNumber || "",
      row.purpose,
      day(row.updatedAt),
    ]),
  ]);

  await mockOneDrive.upload(project.code, folder, "DRAWING-REGISTER.csv", Buffer.from(registerCsv, "utf8"), "text/csv", {
    replace: true,
  });
  await mockOneDrive.upload(
    project.code,
    folder,
    "Drawing-Check-Master-Log.csv",
    Buffer.from(checkCsv, "utf8"),
    "text/csv",
    { replace: true },
  );

  const weekFolder = `${folder}/Weekly/${drawingRegisterWeekStamp()}`;
  await mockOneDrive.upload(project.code, weekFolder, "DRAWING-REGISTER-01.xlsx", registerXlsx, XLSX_MIME, {
    replace: true,
  });
  await mockOneDrive.upload(project.code, weekFolder, "DRAWING-REGISTER-Dashboard.pdf", dashboardPdf, PDF_MIME, {
    replace: true,
  });
  await mockOneDrive.upload(project.code, weekFolder, "Approval-GFC-Drawing-Log.xlsx", gfcXlsx, XLSX_MIME, {
    replace: true,
  });
  await mockOneDrive.upload(project.code, weekFolder, "Master-Drawing-Register.pdf", masterPdf, PDF_MIME, { replace: true });
  await mockOneDrive.upload(project.code, weekFolder, "Approval-GFC-Drawing-Log.pdf", gfcPdf, PDF_MIME, { replace: true });
}

export function drawingRegisterWeekStamp(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}


/** Design Coordination Register (Excel + PDF) — live copy in the design coordination ISO folder. */
export async function publishCoordinationRegisterToDrive(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
  if (!project) return;
  const folder = `${MODULE_TO_ISO_FOLDER.designCoordination}/_Registers`;
  const [xlsx, pdf] = await Promise.all([
    buildDesignCoordinationRegisterXlsx(projectId),
    buildDesignCoordinationRegisterPdf(projectId),
  ]);
  await mockOneDrive.upload(project.code, folder, "Design-Coordination-Register.xlsx", xlsx, XLSX_MIME, { replace: true });
  await mockOneDrive.upload(project.code, folder, "Design-Coordination-Register.pdf", pdf, PDF_MIME, { replace: true });
}

function htmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** One HTML sheet per issue, so the issue itself has a folder under 04.04. */
export async function publishCoordinationIssueToDrive(issueId: string) {
  const issue = await prisma.designCoordinationIssue.findUnique({
    where: { id: issueId },
    include: { project: { select: { code: true, name: true } } },
  });
  if (!issue) return;
  const { coordinationIssueFolder, coordinationIssueRef } = await import("./drawingMarkup.js");
  const ref = coordinationIssueRef(issue.id);
  const drawing = issue.linkedDrawingId
    ? await prisma.drawing.findUnique({ where: { id: issue.linkedDrawingId }, select: { drawingNumber: true, title: true } })
    : null;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${htmlEscape(ref)}</title></head><body>
<h1>${htmlEscape(ref)} — ${htmlEscape(issue.title)}</h1>
<p>${htmlEscape(issue.project.code)} — ${htmlEscape(issue.project.name)}</p>
<p>Status: ${htmlEscape(issue.status)} · Priority: ${htmlEscape(issue.priority)} · Discipline: ${htmlEscape(issue.discipline || "—")}</p>
<p>Location: ${htmlEscape(issue.location || "—")}</p>
<p>Assignee: ${htmlEscape(issue.assignedToName || issue.assignedToEmail || "—")}</p>
<p>Drawing: ${htmlEscape(drawing ? `${drawing.drawingNumber} — ${drawing.title}` : "—")}</p>
<p>${htmlEscape(issue.description || "")}</p>
</body></html>`;
  await mockOneDrive.upload(
    issue.project.code,
    coordinationIssueFolder(issue.id),
    `${ref}.html`,
    Buffer.from(html, "utf8"),
    "text/html",
    { replace: true },
  );
}
