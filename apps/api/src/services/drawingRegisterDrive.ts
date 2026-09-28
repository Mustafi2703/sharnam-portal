import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";

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

/** Live drawing register, GFC log, and drawing-check fills — filed on the project SharePoint drawings folder. */
export async function publishDrawingRegistersToDrive(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
  if (!project) return;
  const folder = MODULE_TO_ISO_FOLDER.drawings;
  const lines = await prisma.drawingRegisterLine.findMany({
    where: { projectId },
    orderBy: [{ srNo: "asc" }, { drawingNumber: "asc" }],
  });
  const register = csv([
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
      "Revision date",
      "Latest",
      "Planned",
      "Actual",
      "Delay days",
      "Delay responsibility",
      "Issued to",
      "Issue date",
      "Copies",
      "Critical",
      "Remarks",
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
      day(line.revisionDate),
      line.latestRevision ?? "",
      day(line.plannedSubmissionDate),
      day(line.actualSubmissionDate),
      line.submissionDelayDays ?? "",
      line.delayResponsibility ?? "",
      line.issuedTo ?? "",
      day(line.issueDate),
      line.copiesCount ?? "",
      line.criticalDrawing ?? "",
      line.remarks ?? "",
    ]),
  ]);

  const drawings = await prisma.drawing.findMany({
    where: { projectId },
    include: { revisions: { orderBy: { createdAt: "asc" } } },
    orderBy: { drawingNumber: "asc" },
  });
  const gfc = csv([
    ["Discipline", "Building", "Drawing No", "Title", "Current rev", "Published", "Revisions"],
    ...drawings.map((d) => [
      d.discipline || "",
      d.buildingArea || "",
      d.drawingNumber,
      d.title,
      d.currentRev || "",
      d.isPublished ? "Yes" : "No",
      d.revisions.map((r) => r.revisionNumber).join(" "),
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

  const mime = "text/csv";
  await mockOneDrive.upload(project.code, folder, "DRAWING-REGISTER.csv", Buffer.from(register, "utf8"), mime, { replace: true });
  await mockOneDrive.upload(project.code, folder, "Approval-GFC-Drawing-Log.csv", Buffer.from(gfc, "utf8"), mime, { replace: true });
  await mockOneDrive.upload(project.code, folder, "Drawing-Check-Master-Log.csv", Buffer.from(checkCsv, "utf8"), mime, { replace: true });
}
