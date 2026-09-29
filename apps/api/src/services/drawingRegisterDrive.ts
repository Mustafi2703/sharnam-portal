import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import {
  buildApprovalGfcLogXlsx,
  buildDrawingRegisterDashboardPdf,
  buildDrawingRegisterWorkbookXlsx,
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

  const [registerXlsx, gfcXlsx, dashboardPdf] = await Promise.all([
    buildDrawingRegisterWorkbookXlsx(projectId),
    buildApprovalGfcLogXlsx(projectId),
    buildDrawingRegisterDashboardPdf(projectId),
  ]);

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
}
