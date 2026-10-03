/**
 * Push branded NCR / CAR XLSX + HTML + PDF to project SharePoint (ISO 08.06).
 * Drafts → Drafts/ · ready Open → Open/ · Closed → Closed/
 * Also publishes the live NCR REGISTER workbook.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import {
  buildQualityNcrHtml,
  buildQualityNcrPdf,
  buildQualityNcrXlsxFromTemplate,
  buildSafetyNcrHtml,
  buildSafetyNcrPdf,
  buildSafetyNcrXlsxFromTemplate,
} from "./ncrFormExport.js";
import { stampSpdcWorkbookLogo } from "./brandedExport.js";
import { ncrFillPhase, sharePointStatusFolder } from "./ncrFillState.js";
import { drawingRegisterWeekStamp } from "./drawingRegisterDrive.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function safeName(s: string) {
  return String(s || "NCR").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 72);
}

function day(d?: Date | string | null) {
  if (!d) return "";
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export type NcrDriveExport = { kind: "xlsx" | "html" | "pdf" | "register"; path: string; url?: string | null };

export async function syncQualityNcrToDrive(
  project: { code: string; name?: string; clientName?: string | null },
  row: Parameters<typeof buildQualityNcrXlsxFromTemplate>[0]
): Promise<{ exports: NcrDriveExport[]; folder: string; phase: string }> {
  const exports: NcrDriveExport[] = [];
  const stamp = new Date().toISOString().slice(0, 10);
  const phase = ncrFillPhase(row);
  const statusFolder = sharePointStatusFolder(phase);
  const folder = `${MODULE_TO_ISO_FOLDER.ncr}/Quality/${statusFolder}`;
  const base = `${safeName(row.number || "NCR")}_${stamp}`;
  const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";

  try {
    const raw = await buildQualityNcrXlsxFromTemplate(row, project);
    const xlsxBuf = await stampSpdcWorkbookLogo(raw);
    const xlsx = await mockOneDrive.upload(
      project.code,
      folder,
      `${base}.xlsx`,
      xlsxBuf,
      XLSX_MIME,
      { replace: true }
    );
    exports.push({ kind: "xlsx", path: xlsx.sharePointPath || xlsx.path, url: xlsx.sharePointUrl || xlsx.url });
  } catch (err) {
    console.warn("[ncr] Quality XLSX drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const html = buildQualityNcrHtml(row, project, `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`);
    const htmlFile = await mockOneDrive.upload(
      project.code,
      folder,
      `${base}.html`,
      Buffer.from(html, "utf8"),
      "text/html",
      { replace: true }
    );
    exports.push({ kind: "html", path: htmlFile.sharePointPath || htmlFile.path, url: htmlFile.sharePointUrl || htmlFile.url });
  } catch (err) {
    console.warn("[ncr] Quality HTML drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const pdfBuf = await buildQualityNcrPdf(row, project);
    const pdf = await mockOneDrive.upload(project.code, folder, `${base}.pdf`, pdfBuf, "application/pdf", {
      replace: true,
    });
    exports.push({ kind: "pdf", path: pdf.sharePointPath || pdf.path, url: pdf.sharePointUrl || pdf.url });
  } catch (err) {
    console.warn("[ncr] Quality PDF drive sync failed:", err instanceof Error ? err.message : err);
  }

  return { exports, folder, phase };
}

/** Live NCR REGISTER (NCR 01 columns) + weekly snapshot. */
export async function publishQualityNcrRegisterToDrive(projectId: string): Promise<NcrDriveExport[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, code: true, name: true, clientName: true },
  });
  if (!project?.code) return [];

  const ncrs = await prisma.qualityNcr.findMany({
    where: { projectId },
    orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }],
  });

  const XLSX = (await import("../lib/xlsx.js")).default;
  const rows: (string | number)[][] = [
    ["NON CONFORMANCE AND CORRECTIVE ACTION REQUEST (CAR) REGISTER"],
    [],
    [
      "No.",
      "NCR Issue Date",
      "Type",
      "Contractor",
      "Brief Description of Non Conformance",
      "Location",
      "Planned Closure Date",
      "Actual Closure Date",
      "Status",
      "Fill phase",
    ],
  ];
  for (const n of ncrs) {
    const phase = ncrFillPhase(n);
    rows.push([
      n.number || "",
      day(n.issueDate || n.createdAt),
      n.ncrType || (/^CAR/i.test(n.number || "") ? "Corrective Action" : "General"),
      n.contractor || "",
      n.description || "",
      n.location || "",
      day(n.plannedClosure),
      day(n.actualClosure),
      n.status || "Open",
      phase,
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 48 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "NCR REGISTER");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const stamped = await stampSpdcWorkbookLogo(buf);

  const liveFolder = `${MODULE_TO_ISO_FOLDER.ncr}/Quality/_Registers`;
  const week = drawingRegisterWeekStamp();
  const weekFolder = `${liveFolder}/Weekly/${week}`;
  const exports: NcrDriveExport[] = [];

  const live = await mockOneDrive.upload(
    project.code,
    liveFolder,
    "SPDC_NCR_CAR_Register.xlsx",
    stamped,
    XLSX_MIME,
    { replace: true }
  );
  exports.push({ kind: "register", path: live.sharePointPath || live.path, url: live.sharePointUrl || live.url });

  const weekFile = await mockOneDrive.upload(
    project.code,
    weekFolder,
    "SPDC_NCR_CAR_Register.xlsx",
    stamped,
    XLSX_MIME,
    { replace: true }
  );
  exports.push({
    kind: "register",
    path: weekFile.sharePointPath || weekFile.path,
    url: weekFile.sharePointUrl || weekFile.url,
  });

  return exports;
}

/** Sync every quality NCR/CAR form + the live register (used by Sync button + nightly job). */
export async function syncAllQualityNcrsForProject(projectId: string): Promise<{
  synced: number;
  register: NcrDriveExport[];
  forms: { id: string; number: string | null; phase: string; exports: NcrDriveExport[] }[];
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { code: true, name: true, clientName: true },
  });
  if (!project?.code) return { synced: 0, register: [], forms: [] };

  const ncrs = await prisma.qualityNcr.findMany({
    where: { projectId },
    orderBy: { issueDate: "desc" },
  });

  const forms: { id: string; number: string | null; phase: string; exports: NcrDriveExport[] }[] = [];
  for (const ncr of ncrs) {
    const out = await syncQualityNcrToDrive(project, ncr).catch((err) => {
      console.warn("[ncr] sync failed", ncr.number, err instanceof Error ? err.message : err);
      return { exports: [] as NcrDriveExport[], folder: "", phase: ncrFillPhase(ncr) };
    });
    forms.push({ id: ncr.id, number: ncr.number, phase: out.phase, exports: out.exports });
  }

  const register = await publishQualityNcrRegisterToDrive(projectId).catch(() => []);
  return { synced: forms.length, register, forms };
}

export async function syncSafetyNcrToDrive(
  project: { code: string; name?: string; clientName?: string | null },
  row: Parameters<typeof buildSafetyNcrXlsxFromTemplate>[0]
): Promise<{ exports: NcrDriveExport[] }> {
  const exports: NcrDriveExport[] = [];
  const stamp = new Date().toISOString().slice(0, 10);
  const statusFolder = row.status === "Closed" ? "Closed" : /draft/i.test(row.status || "") ? "Drafts" : "Open";
  const folder = `${MODULE_TO_ISO_FOLDER.safetyNcr}/Safety/${statusFolder}`;
  const base = `${safeName(row.ncrNumber || row.title || "Safety-NCR")}_${stamp}`;
  const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";

  try {
    const raw = await buildSafetyNcrXlsxFromTemplate(row, project);
    const xlsxBuf = await stampSpdcWorkbookLogo(raw);
    const xlsx = await mockOneDrive.upload(project.code, folder, `${base}.xlsx`, xlsxBuf, XLSX_MIME, {
      replace: true,
    });
    exports.push({ kind: "xlsx", path: xlsx.sharePointPath || xlsx.path, url: xlsx.sharePointUrl || xlsx.url });
  } catch (err) {
    console.warn("[ncr] Safety XLSX drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const html = buildSafetyNcrHtml(row, project, `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`);
    const htmlFile = await mockOneDrive.upload(
      project.code,
      folder,
      `${base}.html`,
      Buffer.from(html, "utf8"),
      "text/html",
      { replace: true }
    );
    exports.push({ kind: "html", path: htmlFile.sharePointPath || htmlFile.path, url: htmlFile.sharePointUrl || htmlFile.url });
  } catch (err) {
    console.warn("[ncr] Safety HTML drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const pdfBuf = await buildSafetyNcrPdf(row, project);
    const pdf = await mockOneDrive.upload(project.code, folder, `${base}.pdf`, pdfBuf, "application/pdf", {
      replace: true,
    });
    exports.push({ kind: "pdf", path: pdf.sharePointPath || pdf.path, url: pdf.sharePointUrl || pdf.url });
  } catch (err) {
    console.warn("[ncr] Safety PDF drive sync failed:", err instanceof Error ? err.message : err);
  }

  return { exports };
}
