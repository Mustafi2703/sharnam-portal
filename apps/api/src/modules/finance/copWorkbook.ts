/**
 * Viatrix_RA BILL_COP.xlsm — fill client COP certificate layout from Finance records.
 */
import fs from "fs";
import path from "path";
import XLSX, { type WorkBook, type WorkSheet } from "../../lib/xlsx.js";
import { prisma } from "../../prisma.js";

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

export async function buildViatrixCopWorkbook(copId: string): Promise<{ buffer: Buffer; filename: string; cop: CopBundle }> {
  const cop = await loadCopBundle(copId);
  const templatePath = resolveViatrixCopTemplatePath();
  let wb: WorkBook;

  if (templatePath) {
    const tpl = XLSX.read(fs.readFileSync(templatePath), { type: "buffer", cellDates: true });
    const srcName = tpl.SheetNames.find((n) => n === "02") || tpl.SheetNames[0];
    const ws = JSON.parse(JSON.stringify(tpl.Sheets[srcName])) as WorkSheet;
    fillViatrixSheet(ws, cop);
    wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "COP");
  } else {
    wb = XLSX.utils.book_new();
    const ws: WorkSheet = {};
    fillViatrixSheet(ws, cop);
    ws["!ref"] = "A1:H49";
    XLSX.utils.book_append_sheet(wb, ws, "COP");
  }

  const safeCert = cop.certificateNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `Viatrix-COP-${safeCert}.xlsx`;
  const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
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
