/**
 * Write the client SPDC RFI workbook + print HTML (Save as PDF) to SharePoint
 * whenever an RFI is raised, answered, or closed.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import { buildSpdcRfiXlsxBuffer, renderSpdcRfiFormHtml } from "./spdcRfiForm.js";

export type RfiDriveExport = { kind: "xlsx" | "html"; path: string; url?: string | null };

function safeName(s: string) {
  return String(s || "RFI").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 72);
}

const rfiInclude = {
  assignedTo: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  drawing: { select: { id: true, drawingNumber: true, title: true, currentRev: true } },
  vendor: { select: { id: true, name: true } },
  responses: { include: { respondedBy: { select: { fullName: true } } }, orderBy: { createdAt: "asc" as const } },
};

const INSPECTION_KINDS = ["QualityIR", "SafetyIR", "ActivityInspection"];
/** Fill requests: the filled checklist itself is filed when it is submitted (no RFI form). */
const CHECKLIST_FILL_KINDS = ["DrawingChecklist", "QualityInspection", "SafetyChecklist", "SiteExecution"];

/** Request for Inspection (SPDC/QA/F-01) — filed under Quality (or Safety for Safety IR), never on the RFI register. */
async function syncInspectionRequestToDrive(rfiId: string): Promise<{ exports: RfiDriveExport[] }> {
  const rfi = await prisma.rfi.findUnique({ where: { id: rfiId } });
  if (!rfi) return { exports: [] };
  const project = await prisma.project.findUnique({ where: { id: rfi.projectId } });
  if (!project) return { exports: [] };
  const linkedAssignment = rfi.linkedAssignmentId
    ? await prisma.checklistAssignment.findUnique({
        where: { id: rfi.linkedAssignmentId },
        include: { template: { select: { name: true } } },
      })
    : null;
  const { buildInspectionIrXlsx, renderInspectionIrHtml, safeInspectionIrFilename } = await import("./spdcInspectionIr.js");
  const root = rfi.rfiKind === "SafetyIR" ? MODULE_TO_ISO_FOLDER.safety : MODULE_TO_ISO_FOLDER.qualityChecklist;
  const closed = /closed|approved|rejected/i.test(rfi.status);
  const folder = `${root}/Inspection_Requests/${closed ? "Closed" : "Open"}`;
  const exports: RfiDriveExport[] = [];
  try {
    const buf = await buildInspectionIrXlsx({ ...rfi, linkedAssignment } as never, project as never);
    const up = await mockOneDrive.upload(
      project.code,
      folder,
      safeInspectionIrFilename(rfi.number, "xlsx"),
      buf,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    exports.push({ kind: "xlsx", path: up.sharePointPath || up.path, url: up.sharePointUrl || up.url });
  } catch (err) {
    console.warn("[ir] XLSX drive sync failed:", err instanceof Error ? err.message : err);
  }
  try {
    const html = renderInspectionIrHtml({ ...rfi, linkedAssignment } as never, project as never);
    const up = await mockOneDrive.upload(project.code, folder, safeInspectionIrFilename(rfi.number, "html"), Buffer.from(html, "utf8"), "text/html");
    exports.push({ kind: "html", path: up.sharePointPath || up.path, url: up.sharePointUrl || up.url });
  } catch (err) {
    console.warn("[ir] HTML drive sync failed:", err instanceof Error ? err.message : err);
  }
  return { exports };
}

export async function syncRfiToDrive(rfiId: string): Promise<{ exports: RfiDriveExport[] }> {
  const head = await prisma.rfi.findUnique({ where: { id: rfiId }, select: { rfiKind: true } });
  if (!head) return { exports: [] };
  if (INSPECTION_KINDS.includes(head.rfiKind)) return syncInspectionRequestToDrive(rfiId);
  if (CHECKLIST_FILL_KINDS.includes(head.rfiKind)) return { exports: [] };

  const rfi = await prisma.rfi.findUnique({ where: { id: rfiId }, include: rfiInclude });
  if (!rfi) return { exports: [] };
  const project = await prisma.project.findUnique({ where: { id: rfi.projectId } });
  if (!project) return { exports: [] };
  const rfis = await prisma.rfi.findMany({
    where: { projectId: rfi.projectId },
    include: rfiInclude,
    orderBy: { createdAt: "asc" },
  });

  const exports: RfiDriveExport[] = [];
  const stamp = new Date().toISOString().slice(0, 10);
  const closed = /closed|answered/i.test(rfi.status);
  const folder = `${MODULE_TO_ISO_FOLDER.rfiInformation}/${closed ? "Closed" : "Open"}`;
  const base = `${safeName(rfi.number)}_${stamp}`;

  try {
    const xlsxBuf = await buildSpdcRfiXlsxBuffer({ project, rfis, selectRfiId: rfi.id });
    const xlsx = await mockOneDrive.upload(
      project.code,
      folder,
      `${base}.xlsx`,
      xlsxBuf,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    exports.push({ kind: "xlsx", path: xlsx.sharePointPath || xlsx.path, url: xlsx.sharePointUrl || xlsx.url });
  } catch (err) {
    console.warn("[rfi] XLSX drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const html = renderSpdcRfiFormHtml({ project, rfi });
    const htmlFile = await mockOneDrive.upload(
      project.code,
      folder,
      `${base}.html`,
      Buffer.from(html, "utf8"),
      "text/html"
    );
    exports.push({ kind: "html", path: htmlFile.sharePointPath || htmlFile.path, url: htmlFile.sharePointUrl || htmlFile.url });
  } catch (err) {
    console.warn("[rfi] HTML/PDF drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const registerBuf = await buildSpdcRfiXlsxBuffer({ project, rfis });
    const live = await mockOneDrive.upload(
      project.code,
      `${MODULE_TO_ISO_FOLDER.rfiInformation}/_Registers`,
      "SPDC_RFI_Form_and_Register.xlsx",
      registerBuf,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    exports.push({ kind: "xlsx", path: live.sharePointPath || live.path, url: live.sharePointUrl || live.url });
  } catch (err) {
    console.warn("[rfi] Register drive sync failed:", err instanceof Error ? err.message : err);
  }

  return { exports };
}

/** Rewrite only the live RFI register (e.g. after an RFI is deleted). Per-RFI files are left for manual cleanup. */
export async function refreshRfiRegisterOnDrive(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return;
  const rfis = await prisma.rfi.findMany({ where: { projectId }, include: rfiInclude, orderBy: { createdAt: "asc" } });
  const registerBuf = await buildSpdcRfiXlsxBuffer({ project, rfis });
  await mockOneDrive.upload(
    project.code,
    `${MODULE_TO_ISO_FOLDER.rfiInformation}/_Registers`,
    "SPDC_RFI_Form_and_Register.xlsx",
    registerBuf,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}
