/**
 * SAP-style tax invoice and purchase order.
 * PDF is drawn with pdfkit (same approach as the COP certificate) and filed under the ISO folder.
 */
import { createRequire } from "node:module";
import { MODULE_TO_ISO_FOLDER } from "../../services/graph.js";
import { amountInWordsInr } from "./copWorkbook.js";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit") as typeof import("pdfkit");
type Doc = InstanceType<typeof PDFDocument>;

const COMPANY = "Sharnam Project Development Consultants & Co.";

export const SAP_KINDS = ["TAX_INVOICE", "PURCHASE_ORDER"] as const;
export type SapKind = (typeof SAP_KINDS)[number];

export type SapLine = {
  code?: string;
  description?: string;
  detail?: string;
  qty?: number;
  unit?: string;
  rate?: number;
  discountPct?: number;
  cgstPct?: number;
  sgstPct?: number;
  hsn?: string;
  deliveryDate?: string;
};

export type SapForm = {
  kind: SapKind;
  number: string;
  docDate?: string;
  partyName: string;
  partyAddress?: string;
  partyGstin?: string;
  partyPan?: string;
  partyAttn?: string;
  partyRef?: string;
  reference?: string;
  projectSite?: string;
  siteAddress?: string;
  placeOfSupply?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTerms?: string;
  dueOrIncoterms?: string;
  billingType?: string;
  period?: string;
  reverseCharge?: string;
  lines: SapLine[];
  preparedBy?: string;
  checkedBy?: string;
  signatory?: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  spdcGstin?: string;
  spdcPan?: string;
  officeAddress?: string;
};

export function sapFolder(kind: SapKind) {
  if (kind === "PURCHASE_ORDER") return `${MODULE_TO_ISO_FOLDER.procurement}/Purchase_Orders`;
  return `${MODULE_TO_ISO_FOLDER.finance}/Tax_Invoices`;
}

export function sapKindLabel(kind: SapKind) {
  return kind === "PURCHASE_ORDER" ? "Purchase order" : "Tax invoice";
}

export function sapRegisterFile(kind: SapKind) {
  return kind === "PURCHASE_ORDER" ? "Purchase_Order_Register.xlsx" : "Tax_Invoice_Register.xlsx";
}

/** One sheet only. Tax invoices and purchase orders are not mixed on the same register. */
export async function sapRegisterWorkbook(kind: SapKind, rows: Array<SapForm & { docDate?: string }>): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const isPo = kind === "PURCHASE_ORDER";
  const ws = wb.addWorksheet(isPo ? "Purchase order register" : "Tax invoice register");
  const head = isPo
    ? ["Date", "PO number", "Vendor", "Vendor no.", "Quotation", "Taxable INR", "CGST", "SGST", "Order value INR"]
    : ["Date", "Invoice number", "Client", "Customer no.", "Client PO / WO", "Period", "Taxable INR", "CGST", "SGST", "Total INR"];
  ws.addRow(head);
  ws.getRow(1).font = { bold: true, color: { argb: "FF08505B" } };
  for (const form of rows) {
    const totals = sapTotals(form);
    const date = fmtDate(form.docDate);
    ws.addRow(
      isPo
        ? [date, form.number, form.partyName, form.partyRef || "", form.reference || "", round2(totals.taxable), round2(totals.cgst), round2(totals.sgst), round2(totals.total)]
        : [date, form.number, form.partyName, form.partyRef || "", form.reference || "", form.period || "", round2(totals.taxable), round2(totals.cgst), round2(totals.sgst), round2(totals.total)],
    );
  }
  ws.columns.forEach((col) => {
    col.width = 18;
  });
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const money = (v: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round(v * 100) / 100);

const safe = (v: unknown) =>
  String(v ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return safe(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export type SapTotals = {
  lines: Array<SapLine & { gross: number; discount: number; taxable: number; cgst: number; sgst: number }>;
  taxable: number;
  cgst: number;
  sgst: number;
  total: number;
  byHsn: Array<{ hsn: string; taxable: number; cgstPct: number; cgst: number; sgstPct: number; sgst: number }>;
};

export function sapTotals(form: SapForm): SapTotals {
  const lines = (form.lines || []).filter((l) => safe(l.description) || safe(l.code)).map((l) => {
    const gross = n(l.qty) * n(l.rate);
    const discount = gross * (n(l.discountPct) / 100);
    const taxable = gross - discount;
    const cgst = taxable * (n(l.cgstPct) / 100);
    const sgst = taxable * (n(l.sgstPct) / 100);
    return { ...l, gross, discount, taxable, cgst, sgst };
  });
  const taxable = lines.reduce((s, l) => s + l.taxable, 0);
  const cgst = lines.reduce((s, l) => s + l.cgst, 0);
  const sgst = lines.reduce((s, l) => s + l.sgst, 0);
  const groups = new Map<string, SapTotals["byHsn"][number]>();
  for (const l of lines) {
    const key = `${safe(l.hsn) || "-"}|${n(l.cgstPct)}|${n(l.sgstPct)}`;
    const row = groups.get(key) || { hsn: safe(l.hsn) || "-", taxable: 0, cgstPct: n(l.cgstPct), cgst: 0, sgstPct: n(l.sgstPct), sgst: 0 };
    row.taxable += l.taxable;
    row.cgst += l.cgst;
    row.sgst += l.sgst;
    groups.set(key, row);
  }
  return { lines, taxable, cgst, sgst, total: taxable + cgst + sgst, byHsn: [...groups.values()] };
}

const INVOICE_TERMS = [
  "Payment by NEFT / RTGS to the bank account stated on this invoice, on or before the due date.",
  "Interest at 18% p.a. is chargeable on payments received after the due date.",
  "TDS deducted, if any, may please be deposited in time and the TDS certificate shared with us.",
  "Any discrepancy in this invoice must be reported in writing within 7 days of receipt; otherwise it is deemed accepted.",
  "Subject to Vadodara jurisdiction.",
];

const PO_TERMS = [
  "Prices are firm till completion of this order. GST as per the tax code; no other charges unless added by a PO amendment.",
  "Deliver on or before each item date at the delivery address, between 09:00 and 18:00 hrs.",
  "Each consignment must carry a tax invoice, delivery challan, e-way bill where applicable, and test certificates, quoting this PO and item number.",
  "Material is accepted only after inspection and goods receipt at site. Rejected material is replaced free of cost.",
  "Payment follows these terms after matching of PO, goods receipt and invoice. Quantities above the PO are not paid.",
  "Any change in quantity, price or delivery date is valid only through a written PO amendment.",
  "Delay beyond the delivery date attracts liquidated damages at 0.5% of the delayed value per week, maximum 5% of the order value.",
  "Vendor personnel and vehicles at site follow site safety rules and carry valid documents and PPE.",
  "Please return a signed copy of this order as acceptance within 2 working days.",
  "Subject to Vadodara jurisdiction.",
];

function words(amount: number) {
  const w = amountInWordsInr(Math.abs(amount));
  return `Indian Rupees ${w} Only`;
}

export function buildSapPdf(form: SapForm): Promise<Buffer> {
  const totals = sapTotals(form);
  const isPo = form.kind === "PURCHASE_ORDER";
  const title = isPo ? "Purchase Order" : "Tax Invoice";
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 28, info: { Title: `${title} ${form.number}`, Author: COMPANY } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 28;
    const width = 539;
    let y = 28;

    doc.rect(left, y, width, 4).fill("#0b6a78");
    y += 12;
    doc.fillColor("#0b6a78").font("Helvetica-Bold").fontSize(9).text(COMPANY, left, y, { width: 340 });
    doc.fillColor("#1d2327").font("Helvetica-Bold").fontSize(16).text(title, left + 300, y - 2, { width: 239, align: "right" });
    y += 16;
    doc.fillColor("#5b6770").font("Helvetica").fontSize(8).text(safe(form.officeAddress) || "Vadodara, Gujarat, India", left, y, { width: 340 });
    doc.fillColor("#08505b").font("Helvetica-Bold").fontSize(11).text(safe(form.number), left + 300, y - 2, { width: 239, align: "right" });
    y += 18;

    doc.fillColor("#1d2327").font("Helvetica").fontSize(8);
    const meta = isPo
      ? [
          ["PO number", form.number],
          ["PO date", fmtDate(form.docDate)],
          ["Document type", form.billingType || "NB - Standard PO"],
          ["Your quotation", form.reference || ""],
          ["Place of supply", form.placeOfSupply || "Gujarat (24)"],
          ["Currency", "INR"],
        ]
      : [
          ["Invoice number", form.number],
          ["Invoice date", fmtDate(form.docDate)],
          ["Billing type", form.billingType || "F2 - Invoice"],
          ["Your PO / WO", form.reference || ""],
          ["Period of service", form.period || ""],
          ["Place of supply", form.placeOfSupply || "Gujarat (24)"],
          ["Reverse charge", form.reverseCharge || "No"],
          ["Currency", "INR"],
        ];

    const partyLines = [
      form.partyName,
      form.partyAddress,
      form.partyGstin ? `GSTIN ${form.partyGstin}` : "",
      form.partyPan ? `PAN ${form.partyPan}` : "",
      form.partyAttn ? `Attn. ${form.partyAttn}` : "",
      form.partyRef ? (isPo ? `Vendor no. ${form.partyRef}` : `Customer no. ${form.partyRef}`) : "",
    ].filter(Boolean);

    doc.font("Helvetica-Bold").fontSize(8).text(isPo ? "Vendor" : "Bill to", left, y);
    doc.font("Helvetica").text(partyLines.map(safe).join("\n") || "-", left, y + 12, { width: 250 });
    let my = y;
    for (const [k, v] of meta) {
      doc.font("Helvetica").fillColor("#5b6770").text(k, left + 270, my, { width: 90 });
      doc.fillColor("#1d2327").text(safe(v) || "-", left + 360, my, { width: 170 });
      my += 12;
    }
    y = Math.max(y + 12 + partyLines.length * 11, my) + 8;

    doc.font("Helvetica-Bold").text(isPo ? "Deliver to" : "Place of service / Ship-to", left, y);
    doc.font("Helvetica").text(
      [form.projectSite, form.siteAddress, form.contactName, [form.contactPhone, form.contactEmail].filter(Boolean).join(" / ")]
        .map(safe)
        .filter(Boolean)
        .join("\n") || "-",
      left,
      y + 12,
      { width: 520 },
    );
    y += 48;
    doc.font("Helvetica").fontSize(8).text(
      `Terms of payment: ${safe(form.paymentTerms) || (isPo ? "Within 30 days due net" : "Within 15 days due net")}    ${isPo ? "Incoterms" : "Due date"}: ${safe(form.dueOrIncoterms) || "-"}`,
      left,
      y,
      { width },
    );
    y += 16;

    const cols = isPo
      ? [
          { h: "Item", w: 36 },
          { h: "Description", w: 170 },
          { h: "Qty", w: 52 },
          { h: "Unit", w: 36 },
          { h: "Rate", w: 70 },
          { h: "Amount INR", w: 75 },
          { h: "HSN", w: 50 },
          { h: "Delivery", w: 50 },
        ]
      : [
          { h: "Item", w: 36 },
          { h: "Description", w: 200 },
          { h: "Qty", w: 52 },
          { h: "Unit", w: 40 },
          { h: "Rate", w: 70 },
          { h: "Amount INR", w: 80 },
          { h: "SAC/HSN", w: 61 },
        ];

    function header() {
      doc.rect(left, y, width, 16).fill("#e7f1f2");
      let x = left + 3;
      doc.fillColor("#08505b").font("Helvetica-Bold").fontSize(7);
      for (const c of cols) {
        doc.text(c.h, x, y + 4, { width: c.w - 4 });
        x += c.w;
      }
      y += 18;
      doc.fillColor("#1d2327").font("Helvetica").fontSize(7);
    }
    header();

    totals.lines.forEach((l, i) => {
      if (y > 720) {
        doc.addPage();
        y = 36;
        header();
      }
      const cells = isPo
        ? [
            String(i + 1).padStart(5, "0"),
            [l.description, l.detail, l.discount ? `Discount ${n(l.discountPct)}%` : "", `CGST ${n(l.cgstPct)}% + SGST ${n(l.sgstPct)}%  ${money(l.cgst + l.sgst)}`]
              .map(safe)
              .filter(Boolean)
              .join("\n"),
            money(n(l.qty)),
            safe(l.unit),
            money(n(l.rate)),
            money(l.taxable),
            safe(l.hsn),
            fmtDate(l.deliveryDate),
          ]
        : [
            String(i + 1).padStart(5, "0"),
            [l.code, l.description, l.detail, l.discount ? `Discount ${n(l.discountPct)}%` : "", `CGST ${n(l.cgstPct)}% + SGST ${n(l.sgstPct)}%  ${money(l.cgst + l.sgst)}`]
              .map(safe)
              .filter(Boolean)
              .join("\n"),
            money(n(l.qty)),
            safe(l.unit),
            money(n(l.rate)),
            money(l.taxable),
            safe(l.hsn),
          ];
      const h = Math.max(28, doc.heightOfString(cells[1], { width: cols[1].w - 4 }));
      let x = left + 3;
      cells.forEach((cell, ci) => {
        doc.text(cell, x, y, { width: cols[ci].w - 4 });
        x += cols[ci].w;
      });
      y += h + 4;
      doc.moveTo(left, y - 2).lineTo(left + width, y - 2).strokeColor("#c9d3d6").stroke();
    });

    y += 6;
    const sumRows: [string, string][] = isPo
      ? [
          ["Total net value excl. tax", money(totals.taxable)],
          ["CGST", money(totals.cgst)],
          ["SGST", money(totals.sgst)],
          ["Total order value INR", money(totals.total)],
        ]
      : [
          ["Total taxable value", money(totals.taxable)],
          ["CGST", money(totals.cgst)],
          ["SGST", money(totals.sgst)],
          ["Total amount INR", money(totals.total)],
        ];
    for (const [k, v] of sumRows) {
      doc.font("Helvetica-Bold").text(k, left + 280, y, { width: 160 });
      doc.text(v, left + 440, y, { width: 120, align: "right" });
      y += 12;
    }
    y += 4;
    doc.font("Helvetica").fontSize(8).text(`Amount in words: ${words(totals.total)}`, left, y, { width });
    y += 12;
    doc.text(`Tax amount in words: ${words(totals.cgst + totals.sgst)}`, left, y, { width });
    y += 16;

    doc.font("Helvetica-Bold").text("Tax summary", left, y);
    y += 12;
    doc.font("Helvetica").fontSize(7);
    doc.text("HSN/SAC", left, y, { width: 70 });
    doc.text("Taxable", left + 80, y, { width: 80 });
    doc.text("CGST %", left + 170, y, { width: 50 });
    doc.text("CGST", left + 220, y, { width: 70 });
    doc.text("SGST %", left + 300, y, { width: 50 });
    doc.text("SGST", left + 360, y, { width: 70 });
    y += 11;
    for (const row of totals.byHsn) {
      doc.text(row.hsn, left, y, { width: 70 });
      doc.text(money(row.taxable), left + 80, y, { width: 80 });
      doc.text(money(row.cgstPct), left + 170, y, { width: 50 });
      doc.text(money(row.cgst), left + 220, y, { width: 70 });
      doc.text(money(row.sgstPct), left + 300, y, { width: 50 });
      doc.text(money(row.sgst), left + 360, y, { width: 70 });
      y += 11;
    }
    y += 8;

    if (y > 680) {
      doc.addPage();
      y = 36;
    }
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#1d2327").text(isPo ? "Terms and conditions" : "Declaration", left, y);
    y += 12;
    doc.font("Helvetica").fontSize(7);
    if (!isPo) {
      doc.text("We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.", left, y, { width });
      y += 18;
      doc.font("Helvetica-Bold").fontSize(8).text("Terms", left, y);
      y += 12;
      doc.font("Helvetica").fontSize(7);
    }
    (isPo ? PO_TERMS : INVOICE_TERMS).forEach((t, i) => {
      doc.text(`${i + 1}. ${t}`, left, y, { width });
      y += doc.heightOfString(`${i + 1}. ${t}`, { width }) + 2;
    });
    y += 10;
    doc.font("Helvetica").fontSize(8).text(isPo ? "Order acceptance by vendor" : "Received by (customer)", left, y, { width: 240 });
    doc.text(`For ${COMPANY}`, left + 280, y, { width: 250 });
    y += 28;
    doc.text("Signature, seal and date", left, y, { width: 240 });
    doc.text(
      [form.preparedBy ? `Prepared: ${form.preparedBy}` : "", form.checkedBy ? `Checked: ${form.checkedBy}` : "", form.signatory || "Authorised signatory"]
        .filter(Boolean)
        .join("  "),
      left + 280,
      y,
      { width: 250 },
    );
    y += 22;
    doc.fontSize(7).fillColor("#5b6770").text(
      [
        COMPANY,
        safe(form.officeAddress),
        form.bankName ? `Bank: ${form.bankName}` : "",
        form.accountNo ? `A/c: ${form.accountNo}` : "",
        form.ifsc ? `IFSC: ${form.ifsc}` : "",
        form.spdcGstin ? `GSTIN: ${form.spdcGstin}` : "",
        form.spdcPan ? `PAN: ${form.spdcPan}` : "",
        `Please quote ${isPo ? "PO" : "invoice"} no. ${form.number}`,
      ]
        .filter(Boolean)
        .join("   "),
      left,
      y,
      { width },
    );

    doc.end();
  });
}
