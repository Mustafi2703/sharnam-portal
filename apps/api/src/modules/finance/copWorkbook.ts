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
  return null;
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
  if (value === "" || value === null || value === undefined) return;
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

/** Fill one worksheet (Viatrix layout) from COP + linked RA/PO. */
function fillViatrixSheet(ws: WorkSheet, cop: CopBundle) {
  const po = cop.purchaseOrder;
  const ra = cop.raBill;
  const contractor = cop.contractor || po?.vendorName || "Contractor";
  const workTrade = cop.workTrade || po?.workTrade || "Civil Packages";
  const certType =
    cop.certificateType ||
    (ra ? `Against - ${ra.raNumber}` : "Against - RA");
  const poText =
    cop.poNumberDate ||
    (po ? `${po.poNumber}${po.poDate ? ` dt ${fmtInvoiceDate(po.poDate)}` : ""}` : "");
  const invoiceText =
    cop.invoiceNoDate ||
    (ra
      ? `${ra.invoiceNumber || ra.raNumber}${ra.invoiceDate ? ` , ${fmtInvoiceDate(ra.invoiceDate)}` : ""}`
      : "");

  const against = ra?.againstBillRaised ?? cop.amountCertified;
  const priceVar = ra?.priceVariation ?? 0;
  const totalWithoutGst = ra?.totalInvoiceWithoutGst ?? cop.amountCertified;
  const advanceAdj = ra?.advanceAdjusted ?? 0;
  const withGst = ra?.totalInvoiceWithGst ?? cop.amountCertified + cop.gstAmount;
  const retention = ra?.retentionAmount ?? cop.retentionAmount;
  const gst = ra?.gstAmount ?? cop.gstAmount;
  const netPayable = ra?.netAmountPayable ?? cop.amountPayable;
  const prevCum = ra?.previousBillTotal ?? 0;
  const cum = ra?.cumulativeBillTotal ?? totalWithoutGst;
  const certifiedAfterRec = totalWithoutGst;
  const afterRetention = Math.max(0, certifiedAfterRec - retention);
  const totalWithGst = afterRetention + gst;

  setCell(ws, "C6", contractor);
  setCell(ws, "F6", workTrade);
  setCell(ws, "C7", certType);
  setCell(ws, "F7", cop.certificateNumber);
  setCell(ws, "C8", cop.budgetCode || "-");
  setCell(ws, "F8", dateToExcelSerial(cop.certificateDate));
  setCell(ws, "C9", poText);
  setCell(ws, "F9", cop.payableTo || contractor);
  setCell(ws, "C10", cop.originalWoValue || po?.originalValue || 0);
  setCell(ws, "F10", cop.panNumber || po?.panNumber || "");
  setCell(ws, "C11", cop.amendmentNo || po?.amendmentNo || "-");
  setCell(ws, "F11", cop.gstNumber || po?.gstNumber || "");
  setCell(ws, "C12", cop.amendedWoValue || po?.amendedValue || "-");
  setCell(ws, "F12", invoiceText);

  setCell(ws, "C14", netPayable);
  setCell(ws, "C15", netPayable);

  // Section A — amount raised
  setCell(ws, "E17", against);
  setCell(ws, "F17", against);

  // Section B — certified
  setCell(ws, "E21", against);
  setCell(ws, "F21", against);
  setCell(ws, "E24", priceVar);
  setCell(ws, "F25", totalWithoutGst);

  // Section C — recoveries / advance
  setCell(ws, "E30", advanceAdj);
  setCell(ws, "F32", advanceAdj);

  // D = B - C
  setCell(ws, "E35", certifiedAfterRec);
  setCell(ws, "F35", certifiedAfterRec);

  // E retention
  setCell(ws, "E37", retention);
  setCell(ws, "F39", retention);

  // F after retention
  setCell(ws, "E41", afterRetention);
  setCell(ws, "F41", afterRetention);

  // G GST
  setCell(ws, "E43", gst);
  setCell(ws, "F44", gst);

  // H net payable
  setCell(ws, "E47", netPayable);
  setCell(ws, "F47", netPayable);

  setCell(ws, "B48", amountInWordsInr(netPayable));
}

/**
 * Overlay Sharnam PMC letterhead on the Viatrix template header.
 * Strips any embedded template images, clears the top merge, writes a fresh
 * 5-row masthead:
 *   R1  · Sharnam logo (image, spans A1:B2)   + PMC name (merged C1:H2)
 *   R3  · Address / consultancy tagline (merged A3:H3)
 *   R4  · Document title "CERTIFICATE OF PAYMENT" (merged A4:H4)
 *   R5  · Certificate number + issue date band (merged A5:H5)
 */
async function applySharnamLetterhead(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, cop: CopBundle) {
  // exceljs stores anchored images on ws._media (internal, untyped). Wipe it so
  // the exported COP has no Viatrix template imagery left behind.
  const internal = ws as unknown as { _media?: unknown[] };
  if (Array.isArray(internal._media)) internal._media.length = 0;

  const clearMergesInRange = (top: number, bottom: number) => {
    // ExcelJS API for un-merge is limited; the safe path is to overwrite values
    // in the target rows since our merges below will absorb the same cells.
    for (let r = top; r <= bottom; r++) {
      const row = ws.getRow(r);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.value = null;
      });
    }
  };
  clearMergesInRange(1, 5);

  const logoPath = sharnamLogoPath();
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      const id = wb.addImage({ filename: logoPath, extension: "png" });
      ws.addImage(id, { tl: { col: 0.15, row: 0.15 }, ext: { width: 96, height: 44 } });
    } catch {
      /* logo optional */
    }
  }

  try {
    ws.mergeCells("C1:H2");
  } catch {
    /* already merged from template */
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

  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 14;
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 16;

  // Sharnam footer band (row 50) — signatory stamp
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
  fillViatrixSheet(proxy, cop);
  for (const key of Object.keys(proxy)) {
    if (key.startsWith("!")) continue;
    const cell = proxy[key] as { t?: string; v?: string | number };
    if (cell?.v !== undefined && cell?.v !== null) {
      const target = ws.getCell(key);
      target.value = typeof cell.v === "number" ? cell.v : String(cell.v);
    }
  }

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
