import fs from "fs";
import path from "path";
import { sharnamLogoDataUri } from "./brandedExport.js";

export type QuotationRow = { description: string; unit: string; qty: number; rate: number; amount: number };
export type QuotationSection = { title: string; note?: string; rows: QuotationRow[] };

export type QuotationDoc = {
  quotationNo: string;
  clientName: string;
  clientAddress?: string | null;
  clientGst?: string | null;
  scopeSummary?: string | null;
  validityDays: number;
  quotationDate: Date | string;
  currency?: string;
  status?: string;
  referenceNo?: string | null;
  preparedFor?: string | null;
  preparedBy?: string | null;
  sections: QuotationSection[];
  totalValue?: number;
};

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function money(n: number, currency = "INR") {
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
      n || 0
    );
  }
  return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function parseSections(raw: string | null | undefined): QuotationSection[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function quotationFromRecord(row: {
  quotationNo: string;
  clientName: string;
  clientAddress?: string | null;
  clientGst?: string | null;
  scopeSummary?: string | null;
  validityDays: number;
  quotationDate: Date;
  currency?: string;
  status?: string;
  totalValue?: number;
  sectionsJson?: string | null;
}): QuotationDoc {
  const sections = parseSections(row.sectionsJson);
  return {
    ...row,
    referenceNo: row.quotationNo,
    preparedFor: row.clientName,
    preparedBy: "Sharnam Project Development Consultants & Co.",
    sections,
    totalValue:
      row.totalValue ??
      sections.reduce((s, sec) => s + sec.rows.reduce((r, row) => r + Number(row.amount || 0), 0), 0),
  };
}

function sectionsHtml(sections: QuotationSection[], currency: string) {
  return sections
    .map((sec) => {
      const note = sec.note ? `<p class="note">${esc(sec.note)}</p>` : "";
      const rows =
        sec.rows.length > 0
          ? `<table><thead><tr><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>${sec.rows
              .map(
                (r) =>
                  `<tr><td>${esc(r.description)}</td><td>${esc(r.unit)}</td><td class="num">${esc(r.qty)}</td><td class="num">${esc(money(r.rate, currency))}</td><td class="num">${esc(money(r.amount, currency))}</td></tr>`
              )
              .join("")}</tbody></table>`
          : "";
      return `<section><h2>${esc(sec.title)}</h2>${note}${rows}</section>`;
    })
    .join("");
}

const sharedStyles = `
  body{font-family:"Source Sans 3","Segoe UI",Helvetica,Arial,sans-serif;color:#1a1d26;margin:0;background:#f0f2f5;line-height:1.45}
  .actions{text-align:center;padding:16px}.actions button{background:#0b6a78;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:600;cursor:pointer}
  .sheet{max-width:920px;margin:0 auto 24px;background:#fff;border:1px solid #d5dadd;box-shadow:0 12px 36px rgba(11,106,120,.08);overflow:hidden}
  .hero{background:linear-gradient(135deg,#085560 0%,#0b6a78 55%,#126e82 100%);color:#fff;padding:22px 28px;display:flex;gap:18px;align-items:center}
  .hero img{height:48px;width:auto;filter:brightness(1.05)}
  .hero .tag{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#99f6e4;margin-bottom:6px}
  .hero h1{margin:0;font-size:22px;letter-spacing:-.02em}
  .hero .sub{opacity:.9;font-size:13px;margin-top:6px;max-width:640px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:14px 28px;border-bottom:1px solid #e2e5eb;font-size:13px}
  .meta b{color:#5c6578;font-weight:600;display:inline-block;min-width:110px}
  .letter{padding:18px 28px;border-bottom:1px solid #e2e5eb;font-size:13px;white-space:pre-wrap}
  section{padding:16px 28px;border-bottom:1px solid #eef0f3}
  section h2{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#0b6a78;border-bottom:2px solid #0b6a78;padding-bottom:6px;margin:0 0 10px}
  .note{font-size:12px;color:#5c6578;margin:0 0 10px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
  th,td{border:1px solid #e2e5eb;padding:8px 10px;text-align:left;vertical-align:top}
  th{background:#e6f4f6;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#085560}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  th.num{text-align:right}
  .total{padding:16px 28px;text-align:right;background:#f7f8fa}
  .total .label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#5c6578}
  .total .value{font-size:24px;font-weight:700;color:#0b6a78;margin-top:4px}
  .foot{padding:14px 28px 22px;font-size:11px;color:#5c6578;display:flex;justify-content:space-between;gap:12px}
  @media print{.actions{display:none} body{background:#fff}.sheet{box-shadow:none;border:0;margin:0}}
`;

export function renderQuotationHtml(doc: QuotationDoc): string {
  const logo = sharnamLogoDataUri();
  const currency = doc.currency || "INR";
  const total =
    doc.totalValue ??
    doc.sections.reduce((s, sec) => s + sec.rows.reduce((r, row) => r + Number(row.amount || 0), 0), 0);

  const letter = doc.scopeSummary
    ? `<div class="letter"><strong>Scope summary</strong>\n\n${esc(doc.scopeSummary)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(doc.quotationNo)} — ${esc(doc.clientName)} · Sharnam PMC Proposal</title>
  <style>@page{margin:14mm}${sharedStyles}</style>
</head>
<body>
  <div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
  <div class="sheet">
    <div class="hero">
      ${logo ? `<img src="${logo}" alt="Sharnam"/>` : ""}
      <div>
        <div class="tag">— Assured Progress — · PMC Proposal</div>
        <h1>Project Management Consultancy Proposal</h1>
        <div class="sub">Prepared for ${esc(doc.clientName)} · Ref ${esc(doc.referenceNo || doc.quotationNo)}</div>
      </div>
    </div>
    <div class="meta">
      <div><b>Reference</b> ${esc(doc.referenceNo || doc.quotationNo)}</div>
      <div><b>Date</b> ${esc(fmtDate(doc.quotationDate))}</div>
      <div><b>Client</b> ${esc(doc.clientName)}</div>
      <div><b>GST</b> ${esc(doc.clientGst || "—")}</div>
      <div><b>Address</b> ${esc(doc.clientAddress || "—")}</div>
      <div><b>Validity</b> ${esc(doc.validityDays)} days</div>
      <div><b>Prepared by</b> ${esc(doc.preparedBy || "Sharnam PMC")}</div>
      <div><b>Status</b> ${esc(doc.status || "Draft")}</div>
    </div>
    ${letter}
    ${sectionsHtml(doc.sections, currency)}
    <div class="total">
      <div class="label">Indicative total (ex GST)</div>
      <div class="value">${esc(money(total, currency))}</div>
    </div>
    <div class="foot">
      <span>Confidential — Commercial · Sharnam Project Development Consultants &amp; Co.</span>
      <span>First Floor, Status Plaza, Vadodara · +91 81607 57201</span>
    </div>
  </div>
</body>
</html>`;
}

/** Word-compatible HTML — opens editable in Microsoft Word */
export function renderQuotationDoc(doc: QuotationDoc): string {
  const html = renderQuotationHtml(doc);
  return html.replace(
    "<html lang=\"en\">",
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="en">`
  ).replace(
    "<head>",
    `<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->`
  );
}

export function quotationExportPaths(quotationNo: string) {
  const safe = quotationNo.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const dir = path.join(process.cwd(), "uploads", "crm", "quotations");
  fs.mkdirSync(dir, { recursive: true });
  return {
    dir,
    htmlPath: path.join(dir, `${safe}.html`),
    docPath: path.join(dir, `${safe}.doc`),
    htmlUrl: `/uploads/crm/quotations/${safe}.html`,
    docUrl: `/uploads/crm/quotations/${safe}.doc`,
  };
}

export function writeQuotationFiles(doc: QuotationDoc) {
  const paths = quotationExportPaths(doc.quotationNo);
  fs.writeFileSync(paths.htmlPath, renderQuotationHtml(doc), "utf8");
  fs.writeFileSync(paths.docPath, renderQuotationDoc(doc), "utf8");
  return paths;
}
