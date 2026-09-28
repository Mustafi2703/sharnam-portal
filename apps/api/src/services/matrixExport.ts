import ExcelJS from "exceljs";
import fs from "fs";
import os from "os";
import path from "path";
import { prisma } from "../prisma.js";
import { SPDC_OFFICE_FOOTER, SPDC_PMC_NAME } from "@sharnam/shared";
import { sharnamLogoDataUri, sharnamLogoPath } from "./brandedExport.js";

type MatrixRow = {
  id: string;
  orgSection?: string | null;
  orgName?: string | null;
  isSectionHeader?: boolean;
  personName?: string | null;
  designation?: string | null;
  company?: string | null;
  spoc?: string | null;
  mobile?: string | null;
  email?: string | null;
  mailRole?: string | null;
  officeAddress?: string | null;
};

const NAVY = "FF1E3A5F";
const GOLD = "FFC9A227";

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

async function imageDataUriFromUrl(raw: string | null | undefined): Promise<string> {
  const url = String(raw || "").trim();
  if (!url) return "";
  if (url.startsWith("data:image/")) return url;

  const localMarker = "/uploads/onedrive/";
  const idx = url.indexOf(localMarker);
  if (idx >= 0) {
    const rel = decodeURIComponent(url.slice(idx + "/uploads/".length));
    const file = path.join(UPLOAD_ROOT, rel);
    if (fs.existsSync(file)) {
      const ext = path.extname(file).toLowerCase() === ".jpg" || path.extname(file).toLowerCase() === ".jpeg" ? "jpeg" : "png";
      return `data:image/${ext};base64,${fs.readFileSync(file).toString("base64")}`;
    }
  }

  if (/^https?:\/\//i.test(url)) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return "";
      const buf = Buffer.from(await res.arrayBuffer());
      const type = (res.headers.get("content-type") || "image/png").split(";")[0];
      if (!type.startsWith("image/")) return "";
      return `data:${type};base64,${buf.toString("base64")}`;
    } catch {
      return "";
    }
  }
  return "";
}

function dataUriToTempFile(dataUri: string, name: string): { file: string; ext: "png" | "jpeg" } | null {
  const m = dataUri.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!m) return null;
  const ext = m[1].toLowerCase() === "png" ? "png" : "jpeg";
  const file = path.join(os.tmpdir(), `${name}-${Date.now()}.${ext === "png" ? "png" : "jpg"}`);
  fs.writeFileSync(file, Buffer.from(m[2], "base64"));
  return { file, ext };
}

export async function loadMatrixBundle(projectId: string, matrixKind: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      code: true,
      name: true,
      clientName: true,
      clientLogoUrl: true,
      designConsultant: true,
      pmcName: true,
      clientAddress: true,
    },
  });
  if (!project) throw new Error("Project not found");
  const rows = await prisma.communicationContact.findMany({
    where: { projectId, matrixKind },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return { project, rows: rows as MatrixRow[], matrixKind };
}

export async function buildMatrixXlsx(projectId: string, matrixKind: string): Promise<Buffer> {
  const { project, rows, matrixKind: kind } = await loadMatrixBundle(projectId, matrixKind);
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(`${kind} Matrix`.slice(0, 31));
  const spdcLogo = sharnamLogoPath();
  const clientUri = await imageDataUriFromUrl(project.clientLogoUrl);
  const clientFile = clientUri ? dataUriToTempFile(clientUri, "client-logo") : null;
  const temps = clientFile ? [clientFile.file] : [];

  const today = new Date();
  const matrixDate = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
  const banner = [
    `PROJECT : ${project.name}`,
    `CLIENT: ${project.clientName || "—"}`,
    `DESIGN CONSULTANT : ${project.designConsultant || "—"}`,
    `PROJECT MANAGEMENT CONSULTANTS : ${project.pmcName || SPDC_PMC_NAME}`,
    `SUBJECT : ${kind} COMMUNICATION MATRIX`,
    `DATE : ${matrixDate}`,
  ];
  banner.forEach((line, i) => {
    const rowNo = i + 1;
    sheet.mergeCells(`A${rowNo}:G${rowNo}`);
    const cell = sheet.getCell(`A${rowNo}`);
    cell.value = line;
    cell.font = { bold: true, size: rowNo === 5 ? 14 : 11, color: { argb: NAVY }, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(rowNo).height = 18;
  });

  if (spdcLogo) {
    const imgId = wb.addImage({ filename: spdcLogo, extension: "png" });
    sheet.addImage(imgId, { tl: { col: 7.1, row: 0.15 }, ext: { width: 90, height: 36 }, editAs: "oneCell" });
  }
  if (clientFile) {
    const imgId = wb.addImage({ filename: clientFile.file, extension: clientFile.ext });
    sheet.addImage(imgId, { tl: { col: 8.1, row: 0.15 }, ext: { width: 90, height: 36 }, editAs: "oneCell" });
  }

  const header = ["SR.NO", "NAME", "DESIGNATION", "NAME OF COMPANY", "SINGLE POINT OF CONTACT", "MOBILE", "E-MAIL", "GENERAL MAIL COMMUNICATION", "OFFICE ADD."];
  sheet.addRow(header);
  const hr = sheet.lastRow!;
  hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  hr.alignment = { vertical: "middle", wrapText: true };

  let sectionIdx = -1;
  let personInSection = 0;
  for (const r of rows) {
    if (r.isSectionHeader) {
      sectionIdx += 1;
      personInSection = 0;
      const row = sheet.addRow([String.fromCharCode(65 + sectionIdx), r.orgName || "", "", "", "", "", "", "", ""]);
      sheet.mergeCells(`B${row.number}:I${row.number}`);
      row.font = { bold: true, name: "Calibri" };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E3F0" } };
      continue;
    }
    personInSection += 1;
    sheet.addRow([
      personInSection,
      r.personName || "",
      r.designation || "",
      r.company || r.orgName || "",
      r.spoc || "",
      r.mobile || "",
      r.email || "",
      r.mailRole || "",
      r.officeAddress || "",
    ]);
  }

  sheet.columns.forEach((col, i) => {
    col.width = i === 8 ? 36 : i === 6 ? 28 : 16;
  });
  sheet.addRow([]);
  sheet.addRow([SPDC_OFFICE_FOOTER]);
  try {
    const ab = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    return Buffer.from(ab);
  } finally {
    for (const f of temps) {
      try {
        fs.unlinkSync(f);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function buildMatrixHtml(projectId: string, matrixKind: string): Promise<string> {
  const { project, rows, matrixKind: kind } = await loadMatrixBundle(projectId, matrixKind);
  const logo = sharnamLogoDataUri();
  const clientLogo = await imageDataUriFromUrl(project.clientLogoUrl);
  let sectionIdx = -1;
  let personInSection = 0;
  const bodyRows = rows
    .map((r) => {
      if (r.isSectionHeader) {
        sectionIdx += 1;
        personInSection = 0;
        return `<tr class="section"><td class="mono">${String.fromCharCode(65 + sectionIdx)}</td><td colspan="8"><strong>${esc(r.orgName)}</strong></td></tr>`;
      }
      personInSection += 1;
      return `<tr>
        <td class="mono">${personInSection}</td>
        <td>${esc(r.personName)}</td>
        <td>${esc(r.designation)}</td>
        <td>${esc(r.company || r.orgName)}</td>
        <td>${esc(r.spoc)}</td>
        <td class="mono">${esc(r.mobile)}</td>
        <td>${esc(r.email)}</td>
        <td class="to">${esc(r.mailRole)}</td>
        <td class="addr">${esc(r.officeAddress)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(kind)} Communication Matrix · ${esc(project.name)}</title>
  <style>
    @page { size: A3 landscape; margin: 12mm; }
    body { font-family: "Segoe UI", Calibri, system-ui, sans-serif; margin: 16px; color: #1a1a1a; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 4px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 12px; }
    .brand { display: flex; align-items: center; gap: 12px; min-width: 180px; }
    .brand img, .client img { height: 56px; max-width: 160px; object-fit: contain; }
    .client { min-width: 180px; display: flex; justify-content: flex-end; }
    .center { text-align: center; flex: 1; }
    .title { font-size: 22px; font-weight: 800; letter-spacing: 0.04em; color: #1e3a5f; text-transform: uppercase; }
    .sub { font-size: 12px; color: #444; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #1e3a5f; color: #fff; text-align: left; padding: 8px 6px; border: 1px solid #1e3a5f; }
    td { border: 1px solid #d6dbe3; padding: 6px; vertical-align: top; }
    tr.section td { background: #e8eef8; font-weight: 700; }
    .mono { font-family: ui-monospace, monospace; font-size: 10px; }
    .addr { max-width: 220px; white-space: pre-line; }
    .to { font-weight: 700; text-align: center; }
    footer { margin-top: 16px; font-size: 10px; color: #555; border-top: 2px solid #c9a227; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="head">
    <div class="brand">${logo ? `<img src="${logo}" alt="SPDC" />` : `<strong>SPDC</strong>`}</div>
    <div class="center">
      <div class="title">Subject : ${esc(kind)} Communication Matrix</div>
      <div class="sub">Project : ${esc(project.name)}</div>
      <div class="sub">Client: ${esc(project.clientName || "—")}</div>
      <div class="sub">Design consultant : ${esc(project.designConsultant || "—")}</div>
      <div class="sub">Project management consultants : ${esc(project.pmcName || SPDC_PMC_NAME)}</div>
    </div>
    <div class="client">${clientLogo ? `<img src="${clientLogo}" alt="Client" />` : `<span style="font-size:11px;color:#888">${esc(project.clientName || "Client logo")}</span>`}</div>
  </div>
  <table>
    <thead><tr>
      <th>SR.NO</th><th>NAME</th><th>DESIGNATION</th><th>NAME OF COMPANY</th><th>SINGLE POINT OF CONTACT</th><th>MOBILE</th><th>E-MAIL</th><th>GENERAL MAIL COMMUNICATION</th><th>OFFICE ADD.</th>
    </tr></thead>
    <tbody>${bodyRows || `<tr><td colspan="9" style="text-align:center;padding:24px;color:#888">No rows</td></tr>`}</tbody>
  </table>
  <footer>${esc(SPDC_OFFICE_FOOTER)}</footer>
</body>
</html>`;
}
