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

export async function syncRfiToDrive(rfiId: string): Promise<{ exports: RfiDriveExport[] }> {
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
