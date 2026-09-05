/**
 * Push branded NCR / CAR XLSX (+ HTML for print/PDF) to project SharePoint.
 */
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import {
  buildQualityNcrHtml,
  buildQualityNcrXlsxFromTemplate,
  buildSafetyNcrHtml,
  buildSafetyNcrXlsxFromTemplate,
} from "./ncrFormExport.js";

function safeName(s: string) {
  return String(s || "NCR").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 72);
}

export type NcrDriveExport = { kind: "xlsx" | "html"; path: string; url?: string | null };

export async function syncQualityNcrToDrive(
  project: { code: string; name?: string; clientName?: string | null },
  row: Parameters<typeof buildQualityNcrXlsxFromTemplate>[0]
): Promise<{ exports: NcrDriveExport[] }> {
  const exports: NcrDriveExport[] = [];
  const stamp = new Date().toISOString().slice(0, 10);
  const statusFolder = row.status === "Closed" ? "Closed" : "Open";
  const folder = `${MODULE_TO_ISO_FOLDER.ncr}/Quality/${statusFolder}`;
  const base = `${safeName(row.number || "NCR")}_${stamp}`;

  try {
    const xlsxBuf = await buildQualityNcrXlsxFromTemplate(row, project);
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
    const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";
    const html = buildQualityNcrHtml(row, project, `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`);
    const htmlFile = await mockOneDrive.upload(project.code, folder, `${base}.html`, Buffer.from(html, "utf8"), "text/html");
    exports.push({ kind: "html", path: htmlFile.sharePointPath || htmlFile.path, url: htmlFile.sharePointUrl || htmlFile.url });
  } catch (err) {
    console.warn("[ncr] Quality HTML drive sync failed:", err instanceof Error ? err.message : err);
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

  try {
    const xlsxBuf = await buildSafetyNcrXlsxFromTemplate(row, project);
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
    const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";
    const html = buildSafetyNcrHtml(row, project, `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`);
    const htmlFile = await mockOneDrive.upload(project.code, folder, `${base}.html`, Buffer.from(html, "utf8"), "text/html");
    exports.push({ kind: "html", path: htmlFile.sharePointPath || htmlFile.path, url: htmlFile.sharePointUrl || htmlFile.url });
  } catch (err) {
    console.warn("[ncr] Safety HTML drive sync failed:", err instanceof Error ? err.message : err);
  }

  return { exports };
}
