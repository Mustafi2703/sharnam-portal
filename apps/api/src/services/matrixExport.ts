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

/** BPCL Communication Matrix_BPCL (2).xlsx header slate. */
const HEADER_FILL = "FF445469";
const SECTION_FILL = "FFE8EEF8";
const THIN = { style: "thin" as const, color: { argb: "FF445469" } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const COL_WIDTHS = [11, 27, 28, 24, 25, 16, 32, 18, 34];

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
      const timer = setTimeout(() => ctrl.abort(), 2500);
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

/** Landscape BPCL-style sheet: both logos large, banner, slate header, full grid. */
export async function buildMatrixXlsx(projectId: string, matrixKind: string): Promise<Buffer> {
  const { project, rows, matrixKind: kind } = await loadMatrixBundle(projectId, matrixKind);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sharnam Portal";
  wb.created = new Date();
  const sheet = wb.addWorksheet(kind.slice(0, 31), {
    views: [{ state: "normal", showGridLines: false, zoomScale: 80 }],
    properties: { defaultRowHeight: 18 },
  });
  const spdcLogo = sharnamLogoPath();
  const clientUri = await imageDataUriFromUrl(project.clientLogoUrl);
  const clientFile = clientUri ? dataUriToTempFile(clientUri, "client-logo") : null;
  const temps = clientFile ? [clientFile.file] : [];

  const matrixDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date())
    .replace(/\//g, "-");

  COL_WIDTHS.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.4, header: 0.2, footer: 0.2 },
  };

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
    sheet.mergeCells(rowNo, 1, rowNo, 7);
    const cell = sheet.getCell(rowNo, 1);
    cell.value = line;
    cell.font = {
      bold: true,
      size: rowNo === 5 ? 14 : 12,
      name: "Calibri",
      color: { argb: "FF1E3A5F" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    sheet.getRow(rowNo).height = rowNo === 5 ? 24 : 20;
    for (let c = 1; c <= 9; c++) {
      sheet.getCell(rowNo, c).border = {
        bottom: rowNo === 6 ? { style: "medium", color: { argb: "FF1E3A5F" } } : undefined,
      };
    }
  });

  // Large logos in the top-right, spanning the banner rows (BPCL layout).
  if (spdcLogo) {
    const imgId = wb.addImage({ filename: spdcLogo, extension: "png" });
    sheet.addImage(imgId, {
      tl: { col: 7.05, row: 0.2 },
      ext: { width: 150, height: 100 },
      editAs: "oneCell",
    });
  }
  if (clientFile) {
    const imgId = wb.addImage({ filename: clientFile.file, extension: clientFile.ext });
    sheet.addImage(imgId, {
      tl: { col: 8.05, row: 0.2 },
      ext: { width: 150, height: 100 },
      editAs: "oneCell",
    });
  } else {
    const placeholder = sheet.getCell(2, 9);
    placeholder.value = project.clientName || "Client logo";
    placeholder.font = { italic: true, size: 9, color: { argb: "FF888888" }, name: "Calibri" };
    placeholder.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }

  const header = [
    "SR.NO",
    "NAME",
    "DESIGNATION",
    "NAME OF COMPANY",
    "SINGLE POINT OF CONTACT",
    "MOBILE",
    "E-MAIL",
    "GENERAL MAIL COMMUNICATION",
    "OFFICE ADD.",
  ];
  const hr = sheet.getRow(7);
  hr.height = 36;
  header.forEach((label, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 11, name: "Calibri", color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BOX;
  });

  const paint = (row: ExcelJS.Row, opts: { bold?: boolean; section?: boolean; height?: number }) => {
    row.height = opts.height ?? (opts.section ? 26 : 32);
    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.font = {
        bold: !!opts.bold || !!opts.section,
        size: 11,
        name: "Calibri",
        color: { argb: "FF111111" },
      };
      if (opts.section) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_FILL } };
      }
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: c === 1 || c === 8 ? "center" : "left",
      };
      cell.border = BOX;
    }
  };

  let sectionIdx = -1;
  let personInSection = 0;
  let lastDataRow = 7;
  for (const r of rows) {
    if (r.isSectionHeader) {
      sectionIdx += 1;
      personInSection = 0;
      const row = sheet.addRow([String.fromCharCode(65 + sectionIdx), (r.orgName || "").trim(), "", "", "", "", "", "", ""]);
      sheet.mergeCells(row.number, 2, row.number, 9);
      paint(row, { bold: true, section: true, height: 26 });
      lastDataRow = row.number;
      continue;
    }
    personInSection += 1;
    const email = (r.email || "").trim();
    const row = sheet.addRow([
      personInSection,
      r.personName || "",
      r.designation || "",
      r.company || r.orgName || "",
      r.spoc || "",
      r.mobile || "",
      email,
      r.mailRole || "",
      r.officeAddress || "",
    ]);
    if (email && email.includes("@")) {
      row.getCell(7).value = { text: email, hyperlink: `mailto:${email}` };
      row.getCell(7).font = { size: 11, name: "Calibri", color: { argb: "FF0563C1" }, underline: true };
    }
    const lines = Math.max(
      String(r.officeAddress || "").split(/\n/).length,
      String(r.spoc || "").split(/\n/).length,
      1,
    );
    paint(row, { height: Math.max(32, 14 * lines + 10) });
    lastDataRow = row.number;
  }

  sheet.addRow([]);
  const foot = sheet.addRow([SPDC_OFFICE_FOOTER]);
  sheet.mergeCells(foot.number, 1, foot.number, 9);
  foot.font = { size: 9, name: "Calibri", italic: true, color: { argb: "FF445469" } };
  foot.alignment = { horizontal: "left", vertical: "middle" };
  sheet.pageSetup.printArea = `A1:I${Math.max(lastDataRow, 7)}`;
  sheet.autoFilter = undefined;

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
  const matrixDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date())
    .replace(/\//g, "-");
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
        <td class="spoc">${esc(r.spoc)}</td>
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
    @page { size: A3 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Calibri, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 16px 20px; color: #111; background: #fff; }
    .sheet { max-width: 1400px; margin: 0 auto; }
    .head { display: grid; grid-template-columns: 180px 1fr 180px; gap: 16px; align-items: center; border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 14px; }
    .brand, .client { display: flex; align-items: center; justify-content: center; min-height: 88px; }
    .brand img, .client img { height: 84px; max-width: 170px; width: auto; object-fit: contain; }
    .banner { font-size: 13px; line-height: 1.45; color: #1e3a5f; font-weight: 700; }
    .banner .subject { font-size: 16px; letter-spacing: 0.03em; margin-top: 4px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
    th { background: #445469; color: #fff; text-align: center; padding: 10px 6px; border: 1px solid #445469; font-weight: 700; }
    td { border: 1px solid #445469; padding: 8px 6px; vertical-align: middle; word-wrap: break-word; }
    tr.section td { background: #e8eef8; font-weight: 700; }
    .mono { font-family: ui-monospace, "Courier New", monospace; font-size: 11px; text-align: center; }
    .spoc, .addr { white-space: pre-line; }
    .to { font-weight: 700; text-align: center; }
    footer { margin-top: 14px; font-size: 10px; color: #445469; border-top: 2px solid #c9a227; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="brand">${logo ? `<img src="${logo}" alt="Sharnam" />` : `<strong>SPDC</strong>`}</div>
      <div class="banner">
        <div>PROJECT : ${esc(project.name)}</div>
        <div>CLIENT: ${esc(project.clientName || "—")}</div>
        <div>DESIGN CONSULTANT : ${esc(project.designConsultant || "—")}</div>
        <div>PROJECT MANAGEMENT CONSULTANTS : ${esc(project.pmcName || SPDC_PMC_NAME)}</div>
        <div class="subject">SUBJECT : ${esc(kind)} COMMUNICATION MATRIX</div>
        <div>DATE : ${esc(matrixDate)}</div>
      </div>
      <div class="client">${clientLogo ? `<img src="${clientLogo}" alt="Client" />` : `<span style="font-size:12px;color:#888;text-align:center">${esc(project.clientName || "Client logo")}</span>`}</div>
    </div>
    <table>
      <thead><tr>
        <th style="width:5%">SR.NO</th>
        <th style="width:12%">NAME</th>
        <th style="width:12%">DESIGNATION</th>
        <th style="width:12%">NAME OF COMPANY</th>
        <th style="width:12%">SINGLE POINT OF CONTACT</th>
        <th style="width:9%">MOBILE</th>
        <th style="width:14%">E-MAIL</th>
        <th style="width:8%">GENERAL MAIL COMMUNICATION</th>
        <th style="width:16%">OFFICE ADD.</th>
      </tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="9" style="text-align:center;padding:24px;color:#888">No rows</td></tr>`}</tbody>
    </table>
    <footer>${esc(SPDC_OFFICE_FOOTER)}</footer>
  </div>
</body>
</html>`;
}
