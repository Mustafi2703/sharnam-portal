/**
 * HRMS letter generator — Appointment / Relieving / Exit / Asset-Return / Offer / etc.
 *
 * User's rule: every HR document must have (a) a soft editable copy and (b) a print-ready PDF,
 * and every output page must carry the Sharnam logo. We produce:
 *   • .xlsx  — editable Annexure I companion (CTC calculator template lives at
 *              module_prompts/Sharnam_modules_docs 2/SPDC_CTC_Structure_Calculator.xlsx)
 *   • .html  — branded letter with SPDC letterhead + logo (print → Save as PDF from the browser)
 *
 * Templates live at apps/api/formats/hrms/<kind>.html (or .txt); if the format file is missing we
 * fall back to a built-in template so the workflow keeps working while HR ships the real format.
 *
 * All artefacts are written to uploads/onedrive/_HR/06_HR_AND_ADMIN/06.01_Letters/<refNo>/
 * so they surface in the DMS tree the same as project files. When SharePoint is configured we can
 * push these to the office library — that hook is left to the caller.
 */

import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import type { HrmsDocument } from "@prisma/client";
import { mockOneDrive } from "./mockOneDrive.js";
import { sharnamLogoDataUri, sharnamLogoPath } from "./brandedExport.js";

const HRMS_LETTERS_FOLDER = "06_HR_AND_ADMIN/06.01_Letters";

/** Where the HR team drops editable format files (docx/html/txt) they want to be used. */
function formatCandidates(kind: string): string[] {
  const bases = [
    path.resolve(process.cwd(), "apps/api/formats/hrms"),
    path.resolve(process.cwd(), "formats/hrms"),
    path.resolve(process.cwd(), "../../apps/api/formats/hrms"),
  ];
  const files: string[] = [];
  for (const base of bases) {
    for (const ext of [".html", ".htm", ".txt"]) {
      files.push(path.join(base, `${kind}${ext}`));
    }
  }
  return files;
}

function readFirstExisting(paths: string[]): string | null {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    } catch {
      /* next */
    }
  }
  return null;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "____________";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "____________";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

/** Merge {{token}} placeholders with the row + form data. */
function fillTemplate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m: string, key: string) => {
    let cur: unknown = ctx;
    for (const part of key.split(".")) {
      if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[part];
      else cur = "";
    }
    return cur == null ? "" : escapeHtml(cur);
  });
}

const LETTERHEAD_CSS = `
  @page { size: A4; margin: 22mm 18mm; }
  body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.55; }
  .sheet { max-width: 780px; margin: 0 auto; }
  .letterhead { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #7B4DFF; padding-bottom: 12px; margin-bottom: 20px; }
  .letterhead img { height: 60px; }
  .letterhead .brand { font-weight: 700; font-size: 16pt; color: #1a1a1a; letter-spacing: 0.5px; }
  .letterhead .brand small { display: block; font-weight: 400; font-size: 10pt; color: #555; margin-top: 4px; }
  .refline { display: flex; justify-content: space-between; font-size: 10pt; color: #444; margin-bottom: 18px; }
  h1.title { font-size: 14pt; text-align: center; letter-spacing: 1px; margin: 22px 0 8px; text-transform: uppercase; }
  h2.subtitle { font-size: 11pt; text-align: center; color: #555; font-weight: 500; margin-top: 0; margin-bottom: 22px; }
  .kv { border: 1px solid #ddd; border-collapse: collapse; width: 100%; margin: 12px 0; }
  .kv td { border: 1px solid #ddd; padding: 6px 10px; font-size: 10.5pt; }
  .kv td.k { background: #f7f6ff; font-weight: 600; width: 34%; }
  p { margin: 10px 0; text-align: justify; }
  .signblock { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
  .signblock .cell { width: 45%; }
  .signblock .cell .rule { border-top: 1px solid #555; margin-top: 46px; padding-top: 6px; font-size: 10pt; color: #444; }
  footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 9pt; color: #888; text-align: center; }
`;

function letterhead(): string {
  const logo = sharnamLogoDataUri();
  const img = logo
    ? `<img src="${logo}" alt="Sharnam" />`
    : `<div style="height:60px; width:60px; background:#7B4DFF; color:#fff; display:flex; align-items:center; justify-content:center; border-radius:8px; font-weight:700; font-size:20pt;">श</div>`;
  return `
    <header class="letterhead">
      ${img}
      <div class="brand">
        Sharnam Project Development Consultants &amp; Co.
        <small>Corporate Office · Vadodara, Gujarat · SPDC/HR</small>
      </div>
    </header>
  `;
}

function refBlock(refNo: string, issueDate: Date | string): string {
  return `
    <div class="refline">
      <span><strong>Ref:</strong> ${escapeHtml(refNo)}</span>
      <span><strong>Date:</strong> ${escapeHtml(fmtDate(issueDate))}</span>
    </div>
  `;
}

function pageFooter(): string {
  return `<footer>SPDC · issued via Sharnam portal · this document is authenticated by system reference <code>${escapeHtml("Ref above")}</code></footer>`;
}

/** Built-in letter bodies used when no format file exists yet. Match the tone of the client-shared
 *  SPDC_Letter_of_Appointment.docx we already read from module_prompts. */
function defaultBody(kind: string, ctx: Record<string, unknown>): string {
  const name = escapeHtml(ctx.employeeName || "____________");
  const designation = escapeHtml(ctx.designation || "____________");
  const department = escapeHtml(ctx.department || "____________");
  const location = escapeHtml(ctx.location || "SPDC Corporate Office, Vadodara");
  const effective = escapeHtml(fmtDate(ctx.effectiveDate as Date | string | null));
  const ctc = escapeHtml(ctx.ctcAnnual || ctx.ctc || "____________");
  const reason = escapeHtml(ctx.reason || "");

  switch (kind) {
    case "Appointment":
      return `
        <h1 class="title">Letter of Appointment</h1>
        <h2 class="subtitle">${designation} · ${department} · ${location}</h2>
        <p>Dear ${name},</p>
        <p>Further to the selection process concluded on your interview date, we are pleased to confirm your appointment
           with <strong>Sharnam Project Development Consultants &amp; Co.</strong> (&ldquo;SPDC&rdquo;, &ldquo;the Firm&rdquo;) as
           <strong>${designation}</strong> in the <strong>${department}</strong> function, with effect from ${effective}.</p>
        <table class="kv">
          <tr><td class="k">Designation</td><td>${designation}</td></tr>
          <tr><td class="k">Function / Discipline</td><td>${department}</td></tr>
          <tr><td class="k">Base Location</td><td>${location}</td></tr>
          <tr><td class="k">Date of Joining</td><td>${effective}</td></tr>
          <tr><td class="k">Fixed CTC (per annum)</td><td>INR ${ctc}</td></tr>
        </table>
        <p>The detailed terms and conditions are governed by the SPDC Letter of Appointment (17 clauses, Annexures I–III)
           and by the policies of the Firm as notified from time to time. Annexure I containing the compensation structure
           is issued alongside this letter.</p>
      `;
    case "Offer":
      return `
        <h1 class="title">Offer of Employment</h1>
        <h2 class="subtitle">${designation}</h2>
        <p>Dear ${name},</p>
        <p>With reference to your recent discussions with our HR team, we are pleased to offer you the role of
           <strong>${designation}</strong> at Sharnam Project Development Consultants &amp; Co., based at ${location}.
           Your Fixed Cost to Company will be <strong>INR ${ctc}</strong> per annum, with the joining date on or before
           ${effective}. Kindly signify your acceptance within seven (7) days of the date of this letter.</p>
      `;
    case "Relieving":
      return `
        <h1 class="title">Relieving Letter</h1>
        <p>Dear ${name},</p>
        <p>This is to certify that you were employed with Sharnam Project Development Consultants &amp; Co. as
           <strong>${designation}</strong> in the ${department} function until ${effective}. Your resignation has been
           accepted and you are relieved from the services of the Firm with effect from the close of business on ${effective}.</p>
        <p>We take this opportunity to place on record our appreciation of your services and wish you the very best in your future endeavours.</p>
      `;
    case "Exit":
      return `
        <h1 class="title">Exit Letter</h1>
        <p>Dear ${name},</p>
        <p>This has reference to your separation from Sharnam Project Development Consultants &amp; Co. effective ${effective}.
           You are requested to complete the exit formalities set out in the SPDC exit checklist, including handover of active work,
           return of Firm assets and clearance from all departments. Your full and final settlement will be processed within
           forty-five (45) days of your last working day.</p>
        ${reason ? `<p><strong>Remarks:</strong> ${reason}</p>` : ""}
      `;
    case "AssetReturn":
      return `
        <h1 class="title">Asset Submission &amp; Acknowledgement</h1>
        <p>This acknowledges that <strong>${name}</strong>, ${designation}, has returned the following Firm assets on
           ${effective} in the presence of HR &amp; IT. The assets have been inspected and accepted:</p>
        <table class="kv">
          <tr><td class="k">Asset(s) returned</td><td>${escapeHtml(ctx.assets || "____________")}</td></tr>
          <tr><td class="k">Serial numbers / tags</td><td>${escapeHtml(ctx.serials || "____________")}</td></tr>
          <tr><td class="k">Condition</td><td>${escapeHtml(ctx.condition || "Good working condition")}</td></tr>
          <tr><td class="k">Remarks</td><td>${escapeHtml(ctx.notes || "—")}</td></tr>
        </table>
        <p>No pending liability with respect to the above assets remains against the employee.</p>
      `;
    case "Confirmation":
      return `
        <h1 class="title">Letter of Confirmation</h1>
        <p>Dear ${name},</p>
        <p>We are pleased to confirm your services with Sharnam Project Development Consultants &amp; Co. as
           <strong>${designation}</strong> in the ${department} function, with effect from ${effective}. Your performance
           during the probationary period has been noted as satisfactory. All other terms of your employment shall remain
           as per your Letter of Appointment.</p>
      `;
    case "Warning":
      return `
        <h1 class="title">Notice of Concern</h1>
        <p>Dear ${name},</p>
        <p>This is with reference to the observation recorded on ${effective}. The following concerns have been noted and
           you are advised to address them within the timelines communicated to you.</p>
        <p>${reason || "Details of the concern are set out in the accompanying note."}</p>
      `;
    case "Experience":
      return `
        <h1 class="title">Experience Certificate</h1>
        <p>This is to certify that <strong>${name}</strong> was employed with Sharnam Project Development Consultants &amp; Co.
           from ${escapeHtml(fmtDate(ctx.joiningDate as Date | string | null))} until ${effective}, holding the position of
           <strong>${designation}</strong> in the ${department} function. During the tenure the employee's conduct and
           performance were found to be satisfactory.</p>
      `;
    default:
      return `
        <h1 class="title">${escapeHtml(kind)}</h1>
        <p>Dear ${name},</p>
        <p>${reason || "This letter records the details as per the SPDC template."}</p>
      `;
  }
}

function signBlock(kind: string): string {
  const authority = kind === "Appointment" || kind === "Offer" || kind === "Confirmation"
    ? "For Sharnam Project Development Consultants &amp; Co."
    : "For SPDC — Human Resources";
  return `
    <div class="signblock">
      <div class="cell"><div class="rule">${authority}</div></div>
      <div class="cell"><div class="rule">Employee acknowledgement (signature &amp; date)</div></div>
    </div>
  `;
}

function assembleHtml(row: HrmsDocument, ctx: Record<string, unknown>): string {
  const templateSrc = readFirstExisting(formatCandidates(row.kind));
  const body = templateSrc ? fillTemplate(templateSrc, ctx) : defaultBody(row.kind, ctx);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(row.kind)} · ${escapeHtml(row.refNo)}</title>
  <style>${LETTERHEAD_CSS}</style>
</head>
<body>
  <div class="sheet">
    ${letterhead()}
    ${refBlock(row.refNo, row.issueDate)}
    ${body}
    ${signBlock(row.kind)}
    ${pageFooter()}
  </div>
</body>
</html>`;
}

async function buildAnnexureXlsx(row: HrmsDocument, ctx: Record<string, unknown>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SPDC HRMS";
  const sheet = wb.addWorksheet("Letter data", { pageSetup: { paperSize: 9, orientation: "portrait" } });
  const logoPath = sharnamLogoPath();
  if (logoPath) {
    try {
      const id = wb.addImage({ filename: logoPath, extension: "png" });
      sheet.addImage(id, { tl: { col: 0, row: 0 } as ExcelJS.Anchor, ext: { width: 96, height: 96 } });
    } catch {
      /* logo optional */
    }
  }
  sheet.mergeCells("B1:E1");
  sheet.getCell("B1").value = "Sharnam Project Development Consultants & Co.";
  sheet.getCell("B1").font = { bold: true, size: 14 };
  sheet.mergeCells("B2:E2");
  sheet.getCell("B2").value = `${row.kind} · ${row.refNo}`;
  sheet.getCell("B2").font = { italic: true, size: 11, color: { argb: "FF555555" } };

  const rows: Array<[string, string]> = [
    ["Ref no", row.refNo],
    ["Kind", row.kind],
    ["Issue date", fmtDate(row.issueDate)],
    ["Effective date", fmtDate(row.effectiveDate)],
    ["Employee name", String(row.employeeName || "")],
    ["Designation", String(row.designation || "")],
    ["Department", String(row.department || "")],
    ["Candidate email", String(row.candidateEmail || "")],
  ];
  for (const [k, v] of Object.entries(ctx)) {
    if (["employeeName", "designation", "department", "effectiveDate"].includes(k)) continue;
    rows.push([k, typeof v === "object" ? JSON.stringify(v) : String(v ?? "")]);
  }
  let r = 6;
  for (const [k, v] of rows) {
    const kc = sheet.getCell(`A${r}`);
    const vc = sheet.getCell(`B${r}`);
    kc.value = k;
    vc.value = v;
    kc.font = { bold: true };
    kc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F0FF" } };
    sheet.mergeCells(`B${r}:E${r}`);
    r++;
  }
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 32;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 20;
  const ab = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return Buffer.from(ab);
}

export async function generateHrmsLetter(row: HrmsDocument) {
  let ctx: Record<string, unknown> = {};
  try {
    ctx = row.dataJson ? JSON.parse(row.dataJson) : {};
  } catch {
    ctx = {};
  }
  const merged: Record<string, unknown> = {
    ...ctx,
    employeeName: row.employeeName,
    designation: row.designation,
    department: row.department,
    effectiveDate: row.effectiveDate,
    refNo: row.refNo,
    kind: row.kind,
    issueDate: row.issueDate,
  };

  const safeRef = row.refNo.replace(/[^a-zA-Z0-9._-]/g, "_");
  const html = assembleHtml(row, merged);
  const htmlSaved = await mockOneDrive.upload(
    "_HR",
    HRMS_LETTERS_FOLDER,
    `${row.kind}-${safeRef}.html`,
    Buffer.from(html, "utf8"),
    "text/html; charset=utf-8"
  );
  const xlsxBuf = await buildAnnexureXlsx(row, merged);
  const xlsxSaved = await mockOneDrive.upload(
    "_HR",
    HRMS_LETTERS_FOLDER,
    `${row.kind}-${safeRef}.xlsx`,
    xlsxBuf,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  return {
    docxUrl: xlsxSaved.url || `/uploads/onedrive/_HR/${xlsxSaved.path}`,
    pdfUrl: htmlSaved.url || `/uploads/onedrive/_HR/${htmlSaved.path}`,
    storagePath: htmlSaved.path,
    sharePointUrl: htmlSaved.sharePointUrl || htmlSaved.url || null,
  };
}
