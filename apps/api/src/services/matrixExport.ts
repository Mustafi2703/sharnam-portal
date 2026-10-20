import ExcelJS from "exceljs";
import fs from "fs";
import { prisma } from "../prisma.js";
import { SPDC_OFFICE_FOOTER, SPDC_PMC_NAME } from "@sharnam/shared";
import { sharnamLogoPath } from "./brandedExport.js";
import { clientLogoForProject, imagePixelSize, sniffLogoExt, type LogoExt } from "./clientLogo.js";

export type MatrixRow = {
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

export type MatrixProject = {
  id: string;
  name: string;
  clientName: string | null;
  designConsultant: string | null;
  pmcName: string | null;
  clientLogoUrl?: string | null;
};

export type MatrixBundle = { project: MatrixProject; rows: MatrixRow[]; matrixKind: string };

export type MatrixLogo = { buffer: Buffer; ext: LogoExt; width: number; height: number };
export type MatrixLogos = { sharnam: MatrixLogo | null; client: MatrixLogo | null };

/** BPCL Communication Matrix_BPCL (2).xlsx header slate. */
const HEADER_FILL = "FF445469";
const SECTION_FILL = "FFE8EEF8";
const BANNER_INK = "FF1E3A5F";
const THIN = { style: "thin" as const, color: { argb: "FF445469" } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
/** Column widths of the BPCL TECHNICAL / COMMERCIAL sheets (A–I). */
const COL_WIDTHS = [10.8, 27.1, 27.8, 23.3, 24.3, 25.3, 37.7, 31, 30.3];
const BANNER_ROW_PT = 17.25;
const HEADER_ROW_PT = 31;
const SECTION_ROW_PT = 25.4;
const HEADERS = [
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

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function matrixDate(at = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(at)
    .replace(/\//g, "-");
}

function bannerLines(project: MatrixProject, kind: string, date: string) {
  return [
    `PROJECT : ${project.name}`,
    `CLIENT: ${project.clientName || "—"}`,
    `DESIGN CONSULTANT : ${project.designConsultant || "—"}`,
    `PROJECT MANAGEMENT CONSULTANTS : ${project.pmcName || SPDC_PMC_NAME}`,
    `SUBJECT : ${kind} COMMUNICATION MATRIX`,
    `DATE : ${date}`,
  ];
}

export function matrixLogoFromBuffer(buffer: Buffer | null | undefined): MatrixLogo | null {
  const ext = sniffLogoExt(buffer);
  const size = buffer && ext ? imagePixelSize(buffer) : null;
  if (!buffer || !ext || !size || !size.width || !size.height) return null;
  return { buffer, ext, ...size };
}

function sharnamMatrixLogo(): MatrixLogo | null {
  const file = sharnamLogoPath();
  if (!file) return null;
  try {
    return matrixLogoFromBuffer(fs.readFileSync(file));
  } catch {
    return null;
  }
}

export async function loadMatrixLogos(projectId: string): Promise<MatrixLogos> {
  const client = await clientLogoForProject(projectId);
  return { sharnam: sharnamMatrixLogo(), client: matrixLogoFromBuffer(client?.buffer) };
}

const dataUri = (logo: MatrixLogo) => `data:image/${logo.ext};base64,${logo.buffer.toString("base64")}`;

/** Largest size that fits `boxW × boxH` with the logo's aspect ratio. */
function fitInto(logo: MatrixLogo, boxW: number, boxH: number) {
  const scale = Math.min(boxW / logo.width, boxH / logo.height);
  return { width: Math.max(1, Math.round(logo.width * scale)), height: Math.max(1, Math.round(logo.height * scale)) };
}

export async function loadMatrixBundle(projectId: string, matrixKind: string): Promise<MatrixBundle> {
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

const EMU_PER_PX = 9525;
const colPx = (width: number) => Math.round(width * 7);
const rowPx = (pt: number) => Math.round((pt * 4) / 3);

/**
 * Centre an image in the box starting at column `col0` / row 0. Native EMU offsets — ExcelJS scales fractional
 * `tl.col` by `width × 10000` EMU, which is several times too small for custom-width columns.
 */
function placeInBox(
  sheet: ExcelJS.Worksheet,
  imageId: number,
  logo: MatrixLogo,
  col0: number,
  cols: number,
  rows: number,
) {
  const widths = COL_WIDTHS.slice(col0, col0 + cols).map(colPx);
  const boxW = widths.reduce((a, b) => a + b, 0);
  const rowH = rowPx(BANNER_ROW_PT);
  const boxH = rowH * rows;
  const pad = 6;
  const size = fitInto(logo, boxW - pad * 2, boxH - pad * 2);
  let dx = Math.round((boxW - size.width) / 2);
  let col = col0;
  for (const w of widths) {
    if (dx < w) break;
    dx -= w;
    col += 1;
  }
  const dy = Math.round((boxH - size.height) / 2);
  const tl = {
    nativeCol: col,
    nativeColOff: dx * EMU_PER_PX,
    nativeRow: Math.floor(dy / rowH),
    nativeRowOff: (dy % rowH) * EMU_PER_PX,
  };
  sheet.addImage(imageId, {
    tl: tl as unknown as { col: number; row: number },
    ext: size,
    editAs: "oneCell",
  });
}

/** Both matrix sheets of one workbook share the same embedded logo files. */
const workbookImageIds = new WeakMap<ExcelJS.Workbook, Map<Buffer, number>>();

/** Landscape BPCL sheet on an existing workbook: Sharnam logo A1:B6, banner C1:H6, client logo I1:I6. */
export function paintMatrixSheet(wb: ExcelJS.Workbook, bundle: MatrixBundle, logos: MatrixLogos, at = new Date()): void {
  const { project, rows, matrixKind: kind } = bundle;
  const sheetName = kind.slice(0, 31);
  const prior = wb.getWorksheet(sheetName);
  if (prior) wb.removeWorksheet(prior.id);
  const sheet = wb.addWorksheet(sheetName, {
    views: [{ state: "normal", showGridLines: false, zoomScale: 80 }],
    properties: { defaultRowHeight: 18 },
  });

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

  bannerLines(project, kind, matrixDate(at)).forEach((line, i) => {
    const rowNo = i + 1;
    sheet.getRow(rowNo).height = BANNER_ROW_PT;
    sheet.mergeCells(rowNo, 3, rowNo, 8);
    const cell = sheet.getCell(rowNo, 3);
    cell.value = line;
    cell.font = { bold: true, size: 12, name: "Calibri", color: { argb: BANNER_INK } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    if (rowNo === 6) {
      for (let c = 1; c <= 9; c++) sheet.getCell(rowNo, c).border = { bottom: { style: "medium", color: { argb: BANNER_INK } } };
    }
  });
  sheet.mergeCells(1, 1, 6, 2);
  sheet.mergeCells(1, 9, 6, 9);

  const ids = workbookImageIds.get(wb) ?? new Map<Buffer, number>();
  workbookImageIds.set(wb, ids);
  const imageId = (logo: MatrixLogo) => {
    let id = ids.get(logo.buffer);
    if (id === undefined) {
      id = wb.addImage({ buffer: logo.buffer as unknown as ExcelJS.Buffer, extension: logo.ext });
      ids.set(logo.buffer, id);
    }
    return id;
  };
  if (logos.sharnam) {
    placeInBox(sheet, imageId(logos.sharnam), logos.sharnam, 0, 2, 6);
  } else {
    const brand = sheet.getCell(1, 1);
    brand.value = "SPDC";
    brand.font = { bold: true, size: 16, name: "Calibri", color: { argb: BANNER_INK } };
    brand.alignment = { vertical: "middle", horizontal: "center" };
  }
  if (logos.client) {
    placeInBox(sheet, imageId(logos.client), logos.client, 8, 1, 6);
  } else {
    const placeholder = sheet.getCell(1, 9);
    placeholder.value = project.clientName || "Client logo";
    placeholder.font = { italic: true, size: 10, color: { argb: "FF888888" }, name: "Calibri" };
    placeholder.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }

  const hr = sheet.getRow(7);
  hr.height = HEADER_ROW_PT;
  HEADERS.forEach((label, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 11, name: "Calibri", color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BOX;
  });

  const paint = (row: ExcelJS.Row, opts: { bold?: boolean; section?: boolean; height?: number }) => {
    row.height = opts.height ?? (opts.section ? SECTION_ROW_PT : 32);
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
      paint(row, { bold: true, section: true, height: SECTION_ROW_PT });
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
    }
    const lines = Math.max(
      String(r.officeAddress || "").split(/\n/).length,
      String(r.spoc || "").split(/\n/).length,
      1,
    );
    paint(row, { height: Math.max(32, 14 * lines + 10) });
    if (email && email.includes("@")) {
      row.getCell(7).font = { size: 11, name: "Calibri", color: { argb: "FF0563C1" }, underline: true };
    }
    lastDataRow = row.number;
  }

  sheet.addRow([]);
  const foot = sheet.addRow([SPDC_OFFICE_FOOTER]);
  sheet.mergeCells(foot.number, 1, foot.number, 9);
  foot.font = { size: 9, name: "Calibri", italic: true, color: { argb: "FF445469" } };
  foot.alignment = { horizontal: "left", vertical: "middle" };
  sheet.pageSetup.printArea = `A1:I${Math.max(lastDataRow, 7)}`;
  sheet.pageSetup.printTitlesRow = "1:7";
  sheet.autoFilter = undefined;
}

/** Workbook with one BPCL sheet per bundle. */
export async function renderMatrixXlsx(bundles: MatrixBundle[], logos: MatrixLogos, at = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sharnam Portal";
  wb.created = at;
  for (const bundle of bundles) paintMatrixSheet(wb, bundle, logos, at);
  const ab = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return Buffer.from(ab);
}

/** Landscape BPCL-style sheet: Sharnam logo left, client logo right, banner, slate header, full grid. */
export async function buildMatrixXlsx(projectId: string, matrixKind: string): Promise<Buffer> {
  const bundle = await loadMatrixBundle(projectId, matrixKind);
  return renderMatrixXlsx([bundle], await loadMatrixLogos(projectId));
}

/**
 * Add the full branded TECHNICAL and COMMERCIAL matrices (section bands, logos, every contact)
 * onto a workbook that was already built. Returns the same buffer when the project has no contacts.
 */
export async function appendBrandedMatrixSheets(buffer: Buffer, projectId: string): Promise<Buffer> {
  const kinds = ["TECHNICAL", "COMMERCIAL"] as const;
  const bundles: MatrixBundle[] = [];
  for (const kind of kinds) {
    const bundle = await loadMatrixBundle(projectId, kind);
    if (bundle.rows.length) bundles.push(bundle);
  }
  if (!bundles.length) return buffer;

  const logos = await loadMatrixLogos(projectId);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  for (const bundle of bundles) paintMatrixSheet(wb, bundle, logos);
  const ab = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return Buffer.from(ab);
}

export function renderMatrixHtml(bundle: MatrixBundle, logos: MatrixLogos, at = new Date()): string {
  const { project, rows, matrixKind: kind } = bundle;
  const date = matrixDate(at);
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
  const [projectLine, clientLine, designLine, pmcLine, subjectLine, dateLine] = bannerLines(project, kind, date);
  const colPct = COL_WIDTHS.map((w) => ((w / COL_WIDTHS.reduce((a, b) => a + b, 0)) * 100).toFixed(1));

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
    .head { display: grid; grid-template-columns: auto 1fr auto; gap: 20px; align-items: center; border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 14px; }
    .logo { width: 140px; height: 70px; display: flex; align-items: center; justify-content: center; }
    .logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .logo .fallback { font-size: 12px; color: #888; text-align: center; line-height: 1.3; }
    .banner { font-size: 13px; line-height: 1.45; color: #1e3a5f; font-weight: 700; min-width: 0; }
    .banner .subject { font-size: 15px; letter-spacing: 0.03em; text-transform: uppercase; }
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
      <div class="logo brand">${logos.sharnam ? `<img src="${dataUri(logos.sharnam)}" alt="Sharnam" />` : `<strong>SPDC</strong>`}</div>
      <div class="banner">
        <div>${esc(projectLine)}</div>
        <div>${esc(clientLine)}</div>
        <div>${esc(designLine)}</div>
        <div>${esc(pmcLine)}</div>
        <div class="subject">${esc(subjectLine)}</div>
        <div>${esc(dateLine)}</div>
      </div>
      <div class="logo client">${logos.client ? `<img src="${dataUri(logos.client)}" alt="Client" />` : `<span class="fallback">${esc(project.clientName || "Client logo")}</span>`}</div>
    </div>
    <table>
      <thead><tr>
        ${HEADERS.map((h, i) => `<th style="width:${colPct[i]}%">${esc(h)}</th>`).join("\n        ")}
      </tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="9" style="text-align:center;padding:24px;color:#888">No rows</td></tr>`}</tbody>
    </table>
    <footer>${esc(SPDC_OFFICE_FOOTER)}</footer>
  </div>
</body>
</html>`;
}

export async function buildMatrixHtml(projectId: string, matrixKind: string): Promise<string> {
  const bundle = await loadMatrixBundle(projectId, matrixKind);
  return renderMatrixHtml(bundle, await loadMatrixLogos(projectId));
}

/** A3 landscape PDF: Sharnam logo left, client logo right, banner between; logo row and header repeat per page. */
export async function renderMatrixPdf(bundle: MatrixBundle, logos: MatrixLogos, at = new Date()): Promise<Buffer> {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const PDFDocument = require("pdfkit") as typeof import("pdfkit");
  const { project, rows, matrixKind: kind } = bundle;
  const banner = bannerLines(project, kind, matrixDate(at));

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A3",
      layout: "landscape",
      margin: 28,
      info: { Title: `${kind} Communication Matrix — ${project.name}`, Author: "Sharnam Portal" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 28;
    const right = doc.page.width - 28;
    const logoBox: [number, number] = [110, 72];
    const totalW = COL_WIDTHS.reduce((a, b) => a + b, 0);
    const cols = [left];
    for (const w of COL_WIDTHS) cols.push(cols[cols.length - 1] + ((right - left) * w) / totalW);
    cols[cols.length - 1] = right;
    const cellW = (i: number) => cols[i + 1] - cols[i] - 6;

    const drawLogo = (logo: MatrixLogo | null, x: number, fallback: string) => {
      if (logo) {
        try {
          doc.image(logo.buffer, x, 24, { fit: logoBox, align: "center", valign: "center" });
          return;
        } catch {
          /* fall through to text */
        }
      }
      doc.fillColor("#888888").font("Helvetica-Oblique").fontSize(9);
      doc.text(fallback, x, 24 + logoBox[1] / 2 - 6, { width: logoBox[0], align: "center" });
    };

    const drawHead = () => {
      drawLogo(logos.sharnam, left, "SPDC");
      drawLogo(logos.client, right - logoBox[0], project.clientName || "Client logo");
      const bannerX = left + logoBox[0] + 16;
      const bannerW = right - left - 2 * (logoBox[0] + 16);
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(10);
      let y = 26;
      for (const line of banner) {
        doc.text(line, bannerX, y, { width: bannerW, lineBreak: false, ellipsis: true });
        y += line.startsWith("SUBJECT") ? 14 : 12;
      }
      y = Math.max(y, 24 + logoBox[1]) + 6;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(1.5).stroke("#1e3a5f").lineWidth(1);
      y += 6;
      const headH = 28;
      doc.rect(left, y, right - left, headH).fill("#445469");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
      HEADERS.forEach((h, i) => {
        const textH = doc.heightOfString(h, { width: cellW(i) });
        doc.text(h, cols[i] + 3, y + Math.max(2, (headH - textH) / 2), { width: cellW(i), align: "center" });
      });
      return y + headH;
    };

    let y = drawHead();
    let sectionIdx = -1;
    let personInSection = 0;

    const drawRow = (cells: string[], section: boolean) => {
      doc.font(section ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      const height = section
        ? 20
        : Math.max(22, ...cells.map((cell, i) => doc.heightOfString(cell || "", { width: cellW(i) }) + 8));
      if (y + height > doc.page.height - 40) {
        doc.addPage();
        y = drawHead();
        doc.font(section ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      }
      if (section) doc.rect(left, y, right - left, height).fill("#e8eef8");
      doc.rect(left, y, right - left, height).stroke("#445469");
      const dividers = section ? [1] : cols.slice(1, -1).map((_, i) => i + 1);
      for (const i of dividers) doc.moveTo(cols[i], y).lineTo(cols[i], y + height).stroke("#445469");
      doc.fillColor("#111111");
      if (section) {
        doc.text(cells[0], cols[0] + 3, y + 6, { width: cellW(0), align: "center" });
        doc.text(cells[1], cols[1] + 3, y + 6, { width: right - cols[1] - 6 });
      } else {
        cells.forEach((cell, i) => {
          doc.text(cell || "", cols[i] + 3, y + 4, {
            width: cellW(i),
            height: height - 6,
            align: i === 0 || i === 7 ? "center" : "left",
          });
        });
      }
      y += height;
    };

    for (const r of rows) {
      if (r.isSectionHeader) {
        sectionIdx += 1;
        personInSection = 0;
        drawRow([String.fromCharCode(65 + sectionIdx), (r.orgName || "").trim()], true);
        continue;
      }
      personInSection += 1;
      drawRow(
        [
          String(personInSection),
          r.personName || "",
          r.designation || "",
          r.company || r.orgName || "",
          r.spoc || "",
          r.mobile || "",
          r.email || "",
          r.mailRole || "",
          r.officeAddress || "",
        ],
        false,
      );
    }

    y += 10;
    doc.fillColor("#445469").font("Helvetica-Oblique").fontSize(8).text(SPDC_OFFICE_FOOTER, left, y, { width: right - left });
    doc.end();
  });
}

/** Landscape PDF of the matrix — filed next to the Excel on SharePoint (no Graph Office convert). */
export async function buildMatrixPdf(projectId: string, matrixKind: string): Promise<Buffer> {
  const bundle = await loadMatrixBundle(projectId, matrixKind);
  return renderMatrixPdf(bundle, await loadMatrixLogos(projectId));
}
