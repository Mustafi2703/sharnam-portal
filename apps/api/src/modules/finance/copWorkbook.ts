/**
 * Certificate of Payment workbook — Viatrix layout, Sharnam-branded.
 *
 * The Viatrix template (`Viatrix_RA BILL_COP.xlsm`) is loaded as the row/column
 * skeleton (contractor block, sections A → H, amount in words at row 48).  We
 * then strip the Viatrix images / letterhead from rows 1-5 and inject a
 * Sharnam PMC letterhead (logo + name + address + document title).  The
 * downloaded file is `Sharnam-COP-<cert>.xlsx` and the client sees Sharnam
 * branding on every certificate.  If the template is missing we still emit a
 * plain Sharnam-branded COP so nothing crashes on a fresh server.
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { type WorkSheet } from "../../lib/xlsx.js";
import { prisma } from "../../prisma.js";
import { sharnamLogoPath } from "../../services/brandedExport.js";
import { detachSharedStyles } from "../../lib/excelTemplate.js";
import { findWorkbook } from "../../lib/excelRoot.js";
import { copDefaultsForRa, copLineHistory, panFromGstin, type CopDefaults, type CopLines } from "./copDefaults.js";

const ISO_COP_FOLDER = "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification";

export function resolveViatrixCopTemplatePath(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT
      ? path.join(process.env.SHARNAM_EXCEL_ROOT, "Viatrix_RA BILL_COP.xlsm")
      : "",
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", "Viatrix_RA BILL_COP.xlsm"),
    path.join(process.cwd(), "seed", "data", "Viatrix_RA BILL_COP.xlsm"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Same search as every other client workbook, independent of the working directory.
  return findWorkbook(["Viatrix_RA BILL_COP.xlsm", "Viatrix_RA BILL_COP.xlsx"]);
}

function dateToExcelSerial(d: Date | null | undefined): number | "" {
  if (!d || Number.isNaN(d.getTime())) return "";
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return Math.floor((d.getTime() - epoch.getTime()) / 86400000);
}

function fmtInvoiceDate(d: Date | null | undefined) {
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function setCell(ws: WorkSheet, addr: string, value: string | number) {
  if (value === null || value === undefined) return;
  ws[addr] = { t: typeof value === "number" ? "n" : "s", v: value };
}

/** Indian rupees in words (simplified — lakhs/crores). */
export function amountInWordsInr(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function two(n: number): string {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`.trim();
  }

  function three(n: number): string {
    if (n < 100) return two(n);
    return `${ones[Math.floor(n / 100)]} hundred${n % 100 ? ` ${two(n % 100)}` : ""}`.trim();
  }

  let n = Math.round(amount);
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${three(crore)} crore`);
  if (lakh) parts.push(`${two(lakh)} lakh`);
  if (thousand) parts.push(`${two(thousand)} thousand`);
  if (n) parts.push(three(n));
  const words = parts.join(" ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Zero";
}

type CopBundle = Awaited<ReturnType<typeof loadCopBundle>>;

async function loadCopBundle(copId: string) {
  const cop = await prisma.certificateOfPayment.findUnique({
    where: { id: copId },
    include: {
      purchaseOrder: true,
      raBill: true,
      project: { select: { id: true, code: true, name: true, clientName: true } },
    },
  });
  if (!cop) throw new Error("COP not found");
  return cop;
}

type CopHistory = Awaited<ReturnType<typeof copLineHistory>>;

/**
 * Fill the Viatrix certificate (sheet "02"). Labels sit in B:C and F; values in D (merged D:E) and G.
 * Amount rows: E = previous bills, F = this bill, G = cumulative; D = remarks. Totals are written as
 * values (not left as template formulas) so every viewer shows them without recalculating.
 */
function fillViatrixSheet(ws: WorkSheet, cop: CopBundle, d: CopDefaults | null, h: CopHistory) {
  const po = cop.purchaseOrder;
  const ra = cop.raBill;
  const contractor = cop.contractor || d?.contractor || po?.vendorName || "Contractor";
  const poText =
    cop.poNumberDate ||
    (po ? `${po.poNumber}${po.poDate ? ` dt ${fmtInvoiceDate(po.poDate)}` : ""}` : d?.poNumberDate || "");
  const invoiceText =
    cop.invoiceNoDate && cop.invoiceNoDate !== ra?.invoiceNumber ? cop.invoiceNoDate : d?.invoiceNoDate || cop.invoiceNoDate || "";
  const gstNo = cop.gstNumber || po?.gstNumber || d?.gstNumber || "";

  setCell(ws, "D6", contractor);
  setCell(ws, "G6", cop.workTrade || d?.workTrade || po?.workTrade || "-");
  const certType = cop.certificateType && !(ra && /^against\s*-\s*ra$/i.test(cop.certificateType.trim())) ? cop.certificateType : null;
  setCell(ws, "D7", certType || d?.certificateType || (ra ? `Against - ${ra.raNumber}` : "Against - RA"));
  setCell(ws, "G7", cop.certificateNumber);
  setCell(ws, "D8", cop.budgetCode || po?.budgetCode || d?.budgetCode || "-");
  setCell(ws, "G8", dateToExcelSerial(cop.certificateDate || cop.createdAt));
  setCell(ws, "D9", poText || "-");
  setCell(ws, "G9", cop.payableTo || po?.payableTo || d?.payableTo || contractor);
  setCell(ws, "D10", cop.originalWoValue || po?.originalValue || d?.originalWoValue || "-");
  setCell(ws, "G10", cop.panNumber || po?.panNumber || d?.panNumber || panFromGstin(gstNo) || "-");
  setCell(ws, "D11", cop.amendmentNo || po?.amendmentNo || d?.amendmentNo || "-");
  setCell(ws, "G11", gstNo || "-");
  setCell(ws, "D12", cop.amendedWoValue || po?.amendedValue || d?.amendedWoValue || "-");
  setCell(ws, "G12", invoiceText || "-");

  // Certified to date (excl. GST, after recoveries) — previous, now, total.
  setCell(ws, "D13", h.previous.totalB);
  setCell(ws, "D14", h.current.totalB);
  setCell(ws, "D15", h.cumulative.totalB);

  const rows: [number, keyof CopLines][] = [
    [17, "raised"],
    [18, "raised"],
    [21, "against"],
    [22, "extra"],
    [23, "securedAdvance"],
    [24, "priceVariation"],
    [25, "totalB"],
    [28, "recoveries"],
    [29, "mobilisationAdvance"],
    [30, "adhoc"],
    [31, "other"],
    [32, "totalC"],
    [35, "totalD"],
    [37, "retention"],
    [39, "totalE"],
    [41, "totalF"],
    [43, "gst"],
    [44, "totalG"],
    [47, "totalH"],
  ];
  for (const [r, k] of rows) {
    setCell(ws, `E${r}`, h.previous[k]);
    setCell(ws, `F${r}`, h.current[k]);
    setCell(ws, `G${r}`, h.cumulative[k]);
  }
  const base = h.current.totalB;
  const pct = (n: number) => (base ? `${Math.round((n / base) * 1000) / 10}% of certified` : "");
  setCell(ws, "D17", ra ? `Raised · ${ra.raNumber}` : "Raised");
  setCell(ws, "D30", "");
  setCell(ws, "D37", pct(h.current.retention));
  setCell(ws, "D43", pct(h.current.gst));
  setCell(ws, "D48", amountInWordsInr(h.current.totalH));
}

/**
 * Overlay Sharnam PMC letterhead on the Viatrix template header.
 * Clears conflicting template merges/images in rows 1–5 before writing masthead.
 */
function unmergeRowsInRange(ws: ExcelJS.Worksheet, top: number, bottom: number) {
  const model = ws as unknown as { model?: { merges?: string[] } };
  const merges = [...(model.model?.merges || [])];
  for (const range of merges) {
    const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!m) continue;
    const r1 = parseInt(m[2], 10);
    const r2 = parseInt(m[4], 10);
    if (r2 >= top && r1 <= bottom) {
      try {
        ws.unMergeCells(range);
      } catch {
        /* ignore */
      }
    }
  }
}

async function applySharnamLetterhead(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, cop: CopBundle) {
  const internal = ws as unknown as { _media?: unknown[] };
  if (Array.isArray(internal._media)) internal._media.length = 0;

  unmergeRowsInRange(ws, 1, 5);
  unmergeRowsInRange(ws, 50, 50);

  for (let r = 1; r <= 5; r++) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.value = null;
      cell.style = {};
    });
  }

  ws.getRow(1).height = 18;
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 14;
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 16;

  const logoPath = sharnamLogoPath();
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      const id = wb.addImage({ filename: logoPath, extension: "png" });
      ws.addImage(id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 64, height: 30 } });
    } catch {
      /* logo optional */
    }
  }

  try {
    ws.mergeCells("A1:B2");
  } catch {
    /* ignore */
  }
  try {
    ws.mergeCells("C1:H2");
  } catch {
    /* ignore */
  }
  const nameCell = ws.getCell("C1");
  nameCell.value = "Sharnam Project Development Consultants & Co.";
  nameCell.font = { name: "Calibri", size: 15, bold: true, color: { argb: "FFB28C3C" } };
  nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

  try {
    ws.mergeCells("A3:H3");
  } catch {
    /* ignore */
  }
  const addr = ws.getCell("A3");
  addr.value =
    "Project management consultancy · Ahmedabad, India · info@sharnamgroup.com · www.sharnamgroup.com";
  addr.font = { name: "Calibri", size: 9.5, italic: true, color: { argb: "FF444444" } };
  addr.alignment = { vertical: "middle", horizontal: "center" };

  try {
    ws.mergeCells("A4:H4");
  } catch {
    /* ignore */
  }
  const title = ws.getCell("A4");
  title.value = "CERTIFICATE OF PAYMENT";
  title.font = { name: "Calibri", size: 13, bold: true, color: { argb: "FF4A3A12" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  title.border = { top: { style: "thick", color: { argb: "FFB28C3C" } } };

  try {
    ws.mergeCells("A5:H5");
  } catch {
    /* ignore */
  }
  const band = ws.getCell("A5");
  const certDate = cop.certificateDate
    ? new Date(cop.certificateDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  band.value = `Ref · ${cop.certificateNumber}    ·    Date · ${certDate}    ·    Project · ${cop.project.code} — ${cop.project.name}`;
  band.font = { name: "Calibri", size: 10, color: { argb: "FF6B5A2E" } };
  band.alignment = { vertical: "middle", horizontal: "center" };
  band.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF6E3" } };
  band.border = { bottom: { style: "thin", color: { argb: "FFB28C3C" } } };

  // Sharnam footer band — below amount-in-words (row 48)
  try {
    ws.mergeCells("A50:H50");
  } catch {
    /* ignore */
  }
  const footer = ws.getCell("A50");
  footer.value =
    "Sharnam PMC controlled document · Prepared by Sharnam · Certified by Client Representative · Received by Contractor";
  footer.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF6B5A2E" } };
  footer.alignment = { horizontal: "center" };
  footer.border = { top: { style: "thin", color: { argb: "FFB28C3C" } } };
}

export async function buildViatrixCopWorkbook(copId: string): Promise<{ buffer: Buffer; filename: string; cop: CopBundle }> {
  const cop = await loadCopBundle(copId);
  const templatePath = resolveViatrixCopTemplatePath();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sharnam PMC Portal";
  wb.created = new Date();

  if (templatePath && fs.existsSync(templatePath)) {
    await wb.xlsx.readFile(templatePath);
    detachSharedStyles(wb);
    // Keep only sheet "02" (single COP page) — remove the other sample tabs.
    const keep = wb.getWorksheet("02") || wb.worksheets[0];
    if (keep) {
      for (const s of [...wb.worksheets]) {
        if (s.id !== keep.id) wb.removeWorksheet(s.id);
      }
      keep.name = "Certificate of Payment";
    }
  } else {
    wb.addWorksheet("Certificate of Payment");
  }

  const ws = wb.worksheets[0];

  // Fill the data cells the Viatrix template expects (rows 6+) via the
  // existing xlsx.js filler by building a tiny XLSX proxy sheet, copying its
  // values into ExcelJS.  This preserves the original layout without having
  // to duplicate every setCell mapping in ExcelJS terms.
  const proxy: WorkSheet = {};
  const defaults = cop.raBillId ? await copDefaultsForRa(prisma, cop.projectId, cop.raBillId) : null;
  fillViatrixSheet(proxy, cop, defaults, await copLineHistory(prisma, cop));
  for (const key of Object.keys(proxy)) {
    if (key.startsWith("!")) continue;
    const cell = proxy[key] as { t?: string; v?: string | number };
    if (cell?.v !== undefined && cell?.v !== null) {
      const target = ws.getCell(key);
      target.value = typeof cell.v === "number" ? cell.v : String(cell.v) || null;
    }
  }

  // Certificate date is written as an Excel serial — show it as a date.
  ws.getCell("G8").numFmt = "dd-mmm-yyyy";
  ws.getCell("H32").value = null; // template scratch formula beside the certificate
  // Template sample cells carry their own fonts / alignment — match the other value cells.
  const valueStyle = ws.getCell("D8");
  ws.getCell("D9").font = { ...valueStyle.font };
  ws.getCell("D9").alignment = { ...valueStyle.alignment };
  for (const addr of ["D37", "D43"]) ws.getCell(addr).font = { ...valueStyle.font, italic: true };
  const amountFont = ws.getCell("E21").font;
  for (let r = 17; r <= 47; r++) {
    if (ws.getCell(`E${r}`).value == null) continue;
    const bold = [18, 25, 32, 35, 39, 41, 44, 47].includes(r);
    for (const c of ["E", "F", "G"]) {
      ws.getCell(`${c}${r}`).font = { ...amountFont, bold };
      ws.getCell(`${c}${r}`).alignment = { horizontal: "right", vertical: "middle" };
    }
  }
  for (const addr of ["D10", "D12", "D13", "D14", "D15"]) ws.getCell(addr).numFmt = "#,##,##0.00";
  for (let r = 17; r <= 47; r++) for (const c of ["E", "F", "G"]) if (ws.getCell(`${c}${r}`).value != null) ws.getCell(`${c}${r}`).numFmt = "#,##,##0.00";

  await applySharnamLetterhead(wb, ws, cop);

  const safeCert = cop.certificateNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `Sharnam-COP-${safeCert}.xlsx`;
  const ab = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(ab as ArrayBuffer);
  return { buffer, filename, cop };
}

export async function saveViatrixCopToDms(
  copId: string,
  uploadFn: (projectCode: string, folder: string, name: string, buf: Buffer) => Promise<{ url?: string; path?: string }>
) {
  const { buffer, filename, cop } = await buildViatrixCopWorkbook(copId);
  const saved = await uploadFn(cop.project.code, ISO_COP_FOLDER, filename, buffer);
  await prisma.certificateOfPayment.update({
    where: { id: copId },
    data: { attachmentUrl: saved.url || cop.attachmentUrl },
  });
  return { filename, folder: ISO_COP_FOLDER, url: saved.url, path: saved.path };
}

export { ISO_COP_FOLDER };
