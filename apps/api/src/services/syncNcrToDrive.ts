/**
 * Push branded NCR / CAR XLSX + HTML + PDF to project SharePoint (ISO 08.06).
 */
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

function safeName(s: string) {
  return String(s || "NCR").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 72);
}

export type NcrDriveExport = { kind: "xlsx" | "html" | "pdf"; path: string; url?: string | null };

export async function syncQualityNcrToDrive(
  project: { code: string; name?: string; clientName?: string | null },
  row: Parameters<typeof buildQualityNcrXlsxFromTemplate>[0]
): Promise<{ exports: NcrDriveExport[] }> {
  const exports: NcrDriveExport[] = [];
  const stamp = new Date().toISOString().slice(0, 10);
  const statusFolder = row.status === "Closed" ? "Closed" : "Open";
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
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    exports.push({ kind: "xlsx", path: xlsx.sharePointPath || xlsx.path, url: xlsx.sharePointUrl || xlsx.url });
  } catch (err) {
    console.warn("[ncr] Quality XLSX drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const html = buildQualityNcrHtml(row, project, `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`);
    const htmlFile = await mockOneDrive.upload(project.code, folder, `${base}.html`, Buffer.from(html, "utf8"), "text/html");
    exports.push({ kind: "html", path: htmlFile.sharePointPath || htmlFile.path, url: htmlFile.sharePointUrl || htmlFile.url });
  } catch (err) {
    console.warn("[ncr] Quality HTML drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const pdfBuf = await buildQualityNcrPdf(row, project);
    const pdf = await mockOneDrive.upload(project.code, folder, `${base}.pdf`, pdfBuf, "application/pdf");
    exports.push({ kind: "pdf", path: pdf.sharePointPath || pdf.path, url: pdf.sharePointUrl || pdf.url });
  } catch (err) {
    console.warn("[ncr] Quality PDF drive sync failed:", err instanceof Error ? err.message : err);
  }

  return { exports };
}

export async function syncSafetyNcrToDrive(
  project: { code: string; name?: string; clientName?: string | null },
  row: Parameters<typeof buildSafetyNcrXlsxFromTemplate>[0]
): Promise<{ exports: NcrDriveExport[] }> {
  const exports: NcrDriveExport[] = [];
  const stamp = new Date().toISOString().slice(0, 10);
  const statusFolder = row.status === "Closed" ? "Closed" : "Open";
  const folder = `${MODULE_TO_ISO_FOLDER.safetyNcr}/Safety/${statusFolder}`;
  const base = `${safeName(row.ncrNumber || row.title || "Safety-NCR")}_${stamp}`;
  const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";

  try {
    const raw = await buildSafetyNcrXlsxFromTemplate(row, project);
    const xlsxBuf = await stampSpdcWorkbookLogo(raw);
    const xlsx = await mockOneDrive.upload(
      project.code,
      folder,
      `${base}.xlsx`,
      xlsxBuf,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    exports.push({ kind: "xlsx", path: xlsx.sharePointPath || xlsx.path, url: xlsx.sharePointUrl || xlsx.url });
  } catch (err) {
    console.warn("[ncr] Safety XLSX drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const html = buildSafetyNcrHtml(row, project, `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`);
    const htmlFile = await mockOneDrive.upload(project.code, folder, `${base}.html`, Buffer.from(html, "utf8"), "text/html");
    exports.push({ kind: "html", path: htmlFile.sharePointPath || htmlFile.path, url: htmlFile.sharePointUrl || htmlFile.url });
  } catch (err) {
    console.warn("[ncr] Safety HTML drive sync failed:", err instanceof Error ? err.message : err);
  }

  try {
    const pdfBuf = await buildSafetyNcrPdf(row, project);
    const pdf = await mockOneDrive.upload(project.code, folder, `${base}.pdf`, pdfBuf, "application/pdf");
    exports.push({ kind: "pdf", path: pdf.sharePointPath || pdf.path, url: pdf.sharePointUrl || pdf.url });
  } catch (err) {
    console.warn("[ncr] Safety PDF drive sync failed:", err instanceof Error ? err.message : err);
  }

  return { exports };
}
