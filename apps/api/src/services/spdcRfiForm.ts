/**
 * SPDC_RFI_Form_and_Register.xlsx — fill 01_CONTROL, 03_RFI_FORM, 04_RFI_REGISTER
 * from portal RFI records so downloads match Form No SPDC/QMS/F-RFI-01.
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { sharnamLogoDataUri, sharnamLogoPath } from "./brandedExport.js";

const INPUT = "FFFFF2CC";
const PMC_NAME = "Sharnam Project Development Consultants & Co., Vadodara";
const FORM_NO = "SPDC/QMS/F-RFI-01";
const FORM_REV = "R0";

const SLA_DAYS: Record<string, number> = {
  CRITICAL: 3,
  HIGH: 7,
  NORMAL: 14,
  LOW: 21,
};

const REGISTER_START = 5;
const REGISTER_SAMPLE_END = 12;

export type SpdcRfiProject = {
  id: string;
  code: string;
  name: string;
  clientName?: string | null;
  contractorName?: string | null;
  location?: string | null;
};

export type SpdcRfiRecord = {
  id: string;
  number: string;
  subject: string;
  question: string;
  status: string;
  rfiKind: string;
  createdAt: Date | string;
  dueDate?: Date | string | null;
  closedAt?: Date | string | null;
  scheduleImpact?: string | null;
  costImpact?: string | null;
  specSectionLink?: string | null;
  attachmentsJson?: string | null;
  formDataJson?: string | null;
  assignedTo?: { fullName: string } | null;
  createdBy?: { fullName: string } | null;
  vendor?: { name: string } | null;
  drawing?: { drawingNumber: string; title?: string | null; currentRev?: string | null } | null;
  responses?: {
    responseText: string;
    isOfficialResponse?: boolean;
    createdAt: Date | string;
    respondedBy?: { fullName: string } | null;
  }[];
};

type FormMap = Record<string, string>;

function resolveTemplate(): string | null {
  const fileName = "SPDC_RFI_Form_and_Register.xlsx";
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT ? path.join(process.env.SHARNAM_EXCEL_ROOT, fileName) : "",
    path.join(process.cwd(), "apps", "api", "checklist-templates", fileName),
    path.join(process.cwd(), "checklist-templates", fileName),
    path.join(process.cwd(), "seed", "data", fileName),
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", fileName),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function parseForm(raw?: string | null): FormMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: FormMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v == null || v === "") continue;
      out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

function fmtDate(d?: Date | string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

function officialResponse(r: SpdcRfiRecord) {
  const list = r.responses || [];
  const official = list.filter((x) => x.isOfficialResponse);
  return official.length ? official[official.length - 1] : list[list.length - 1] || null;
}

function priorityOf(form: FormMap, r: SpdcRfiRecord) {
  const p = (form.priority || "").trim().toUpperCase();
  if (p === "CRITICAL" || p === "HIGH" || p === "NORMAL" || p === "LOW") return p;
  if (r.dueDate && r.createdAt) {
    const days = daysBetween(new Date(r.createdAt), new Date(r.dueDate));
    if (days <= 3) return "CRITICAL";
    if (days <= 7) return "HIGH";
  }
  return "NORMAL";
}

function slaDaysOf(priority: string) {
  return SLA_DAYS[priority] ?? 14;
}

function yesNo(formVal: string | undefined, portal?: string | null) {
  if (/^yes$/i.test(formVal || "")) return "Yes";
  if (/^no$/i.test(formVal || "")) return "No";
  if (portal && portal !== "None") return "Yes";
  return "No";
}

function excelStatus(r: SpdcRfiRecord) {
  if (r.status === "Closed") return "Closed";
  if (r.status === "Answered") return "Answered";
  const resp = officialResponse(r);
  if (resp) return "Answered";
  if ((r.responses || []).length) return "Under review";
  return "Open";
}

function slaStatus(r: SpdcRfiRecord, form: FormMap, priority: string) {
  const raised = new Date(r.createdAt);
  const replyBy = r.dueDate
    ? new Date(r.dueDate)
    : new Date(raised.getTime() + slaDaysOf(priority) * 86400000);
  const resp = officialResponse(r);
  if (r.status === "Closed" || resp) {
    if (resp) {
      const responded = new Date(resp.createdAt);
      return responded.getTime() <= replyBy.getTime() + 86400000 ? "Answered on time" : "Answered late";
    }
    return "Closed";
  }
  if (Date.now() > replyBy.getTime()) return "OVERDUE";
  return "Within SLA";
}

function ageBucket(r: SpdcRfiRecord) {
  if (r.status === "Closed" || officialResponse(r)) return "";
  const age = daysBetween(new Date(r.createdAt), new Date());
  if (age <= 7) return "0-7 d";
  if (age <= 14) return "8-14 d";
  if (age <= 30) return "15-30 d";
  return "over 30 d";
}

function daysTaken(r: SpdcRfiRecord) {
  const resp = officialResponse(r);
  if (!resp) return "";
  return String(daysBetween(new Date(r.createdAt), new Date(resp.createdAt)));
}

export type SpdcFilledRow = {
  number: string;
  rev: string;
  package: string;
  discipline: string;
  category: string;
  subject: string;
  location: string;
  drawingRef: string;
  drawingRev: string;
  specClause: string;
  query: string;
  proposedSolution: string;
  originator: string;
  dateRaised: string;
  priority: string;
  slaDays: string;
  replyRequiredBy: string;
  responsibleParty: string;
  dateResponded: string;
  response: string;
  respondedBy: string;
  status: string;
  dateClosed: string;
  daysTaken: string;
  slaStatus: string;
  ageBucket: string;
  costImpact: string;
  estCost: string;
  timeImpact: string;
  estDelay: string;
  voRef: string;
  attachments: string;
  pmcRemarks: string;
};

export function fillSpdcRfiRow(r: SpdcRfiRecord): SpdcFilledRow {
  const form = parseForm(r.formDataJson);
  const resp = officialResponse(r);
  const priority = priorityOf(form, r);
  const slaDays = String(form.slaDays || slaDaysOf(priority));
  const raised = new Date(r.createdAt);
  const replyBy = r.dueDate
    ? fmtDate(r.dueDate)
    : form.replyRequiredBy ||
      fmtDate(new Date(raised.getTime() + slaDaysOf(priority) * 86400000));

  return {
    number: r.number,
    rev: form.revision || form.rev || "0",
    package: form.package || form.projectPackage || "",
    discipline: form.discipline || "",
    category: form.category || "",
    subject: r.subject,
    location: form.location || form.locationGrid || "",
    drawingRef: form.drawingRef || form.dwgRef || r.drawing?.drawingNumber || "",
    drawingRev: form.drawingRev || form.dwgRev || r.drawing?.currentRev || "",
    specClause: form.specClause || r.specSectionLink || "",
    query: form.queryRaised || r.question,
    proposedSolution: form.contractorSolution || form.proposedSolution || "",
    originator: form.originator || r.createdBy?.fullName || "",
    dateRaised: fmtDate(r.createdAt),
    priority,
    slaDays,
    replyRequiredBy: replyBy,
    responsibleParty: form.responsibleParty || r.assignedTo?.fullName || r.vendor?.name || "",
    dateResponded: resp ? fmtDate(resp.createdAt) : "",
    response: resp?.responseText || "",
    respondedBy: resp?.respondedBy?.fullName || form.respondedBy || "",
    status: excelStatus(r),
    dateClosed: r.closedAt ? fmtDate(r.closedAt) : "",
    daysTaken: daysTaken(r),
    slaStatus: slaStatus(r, form, priority),
    ageBucket: ageBucket(r),
    costImpact: yesNo(form.costImpact, r.costImpact),
    estCost: form.estCostInr || form.estCost || "0",
    timeImpact: yesNo(form.timeImpact, r.scheduleImpact),
    estDelay: form.estDelayDays || "0",
    voRef: form.changeVoRef || form.voRef || "",
    attachments: form.attachments || (r.attachmentsJson && !r.attachmentsJson.startsWith("[") ? r.attachmentsJson : "") || "",
    pmcRemarks: form.pmcRemarks || form.remarks || "",
  };
}

function paint(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null | undefined) {
  const cell = ws.getCell(row, col);
  cell.value = value == null || value === "" ? null : value;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT } };
  cell.font = { ...(cell.font || {}), color: { argb: "FF000000" }, size: cell.font?.size || 10 };
  cell.alignment = { ...(cell.alignment || {}), wrapText: true, vertical: "top" };
}

function writePlain(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null | undefined) {
  const cell = ws.getCell(row, col);
  cell.value = value == null || value === "" ? null : value;
}

function embedLogo(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  const logoFile = sharnamLogoPath();
  if (!logoFile) return;
  try {
    const imgId = wb.addImage({
      base64: fs.readFileSync(logoFile).toString("base64"),
      extension: "png",
    });
    try {
      ws.unMergeCells("A1:H1");
    } catch {
      /* already split */
    }
    try {
      ws.mergeCells("B1:H1");
    } catch {
      /* already merged */
    }
    const title = ws.getCell("B1");
    title.value = "SHARNAM PROJECT DEVELOPMENT CONSULTANTS & CO.";
    title.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    title.font = { ...(title.font || {}), bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).height = 42;
    ws.addImage(imgId, {
      tl: { col: 0.12, row: 0.12 },
      ext: { width: 118, height: 38 },
      editAs: "oneCell",
    });
  } catch {
    /* logo optional */
  }
}

function fillControl(ws: ExcelJS.Worksheet, project: SpdcRfiProject, form: FormMap) {
  writePlain(ws, 5, 2, project.name || project.code);
  writePlain(ws, 6, 2, form.employerClient || project.clientName || "");
  writePlain(ws, 7, 2, form.contractNo || project.code);
  writePlain(ws, 8, 2, form.pmcName || PMC_NAME);
  writePlain(ws, 9, 2, FORM_NO);
  writePlain(ws, 10, 2, FORM_REV);
  writePlain(ws, 11, 2, "SPDC-RFI");
}

function clearRegisterSample(ws: ExcelJS.Worksheet) {
  for (let r = REGISTER_START; r <= REGISTER_SAMPLE_END; r++) {
    for (let c = 1; c <= 33; c++) {
      if (c === 16 || c === 17 || c === 24 || c === 25 || c === 26) continue;
      const cell = ws.getCell(r, c);
      if (c <= 15 || c === 18 || c === 19 || c === 20 || c === 21 || c === 22 || c === 23 || c >= 27) {
        cell.value = null;
      }
    }
  }
}

function writeRegisterRow(ws: ExcelJS.Worksheet, excelRow: number, row: SpdcFilledRow) {
  const vals: (string | number | null)[] = [
    row.number,
    row.rev,
    row.package,
    row.discipline,
    row.category,
    row.subject,
    row.location,
    row.drawingRef,
    row.drawingRev,
    row.specClause,
    row.query,
    row.proposedSolution,
    row.originator,
    row.dateRaised,
    row.priority,
    Number(row.slaDays) || slaDaysOf(row.priority),
    row.replyRequiredBy,
    row.responsibleParty,
    row.dateResponded || null,
    row.response,
    row.respondedBy,
    row.status,
    row.dateClosed || null,
    row.daysTaken ? Number(row.daysTaken) : null,
    row.slaStatus,
    row.ageBucket,
    row.costImpact,
    row.estCost === "" ? null : Number(row.estCost) || row.estCost,
    row.timeImpact,
    row.estDelay === "" ? null : Number(row.estDelay) || row.estDelay,
    row.voRef,
    row.attachments,
    row.pmcRemarks,
  ];
  for (let i = 0; i < vals.length; i++) {
    const cell = ws.getCell(excelRow, i + 1);
    cell.value = vals[i] == null || vals[i] === "" ? null : vals[i];
    if (i === 5 || i === 10 || i === 11 || i === 19) {
      cell.alignment = { ...(cell.alignment || {}), wrapText: true, vertical: "top" };
    }
  }
}

function fillFormSheet(ws: ExcelJS.Worksheet, project: SpdcRfiProject, row: SpdcFilledRow, form: FormMap) {
  paint(ws, 5, 3, row.number);

  paint(ws, 8, 3, project.name || project.code);
  paint(ws, 9, 3, form.employerClient || project.clientName || "");
  paint(ws, 9, 7, form.contractNo || project.code);
  paint(ws, 10, 3, form.pmcName || PMC_NAME);
  paint(ws, 10, 7, row.package);

  paint(ws, 13, 3, row.number);
  paint(ws, 13, 7, row.rev);
  paint(ws, 14, 3, row.dateRaised);
  paint(ws, 14, 7, row.priority);
  paint(ws, 15, 3, row.replyRequiredBy);
  paint(ws, 15, 7, row.slaDays);
  paint(ws, 16, 3, row.originator);
  paint(ws, 16, 7, row.discipline);
  paint(ws, 17, 3, row.category);
  paint(ws, 17, 7, row.responsibleParty);
  paint(ws, 18, 3, row.subject);
  paint(ws, 19, 3, row.location);
  paint(ws, 20, 3, row.drawingRef);
  paint(ws, 20, 7, row.drawingRev);
  paint(ws, 21, 3, row.specClause);

  paint(ws, 24, 1, row.query);
  paint(ws, 31, 1, row.proposedSolution);

  paint(ws, 37, 3, row.costImpact);
  paint(ws, 37, 7, row.estCost);
  paint(ws, 38, 3, row.timeImpact);
  paint(ws, 38, 7, row.estDelay);

  paint(ws, 42, 1, row.response);
  paint(ws, 49, 3, row.respondedBy);
  paint(ws, 49, 7, row.dateResponded);

  paint(ws, 52, 3, row.status);
  paint(ws, 52, 7, row.dateClosed);
  paint(ws, 53, 3, row.daysTaken);
  paint(ws, 53, 7, row.slaStatus);
  paint(ws, 54, 3, row.voRef);
  paint(ws, 54, 7, row.attachments);
  paint(ws, 55, 3, row.pmcRemarks);

  paint(ws, 60, 1, row.originator ? `${row.originator}\n${row.dateRaised}` : "");
  paint(ws, 60, 3, "SPDC PMC");
  paint(ws, 60, 5, row.respondedBy ? `${row.respondedBy}\n${row.dateResponded}` : "");
  paint(ws, 60, 7, row.status === "Closed" ? `SPDC PMC\n${row.dateClosed}` : "");
}

async function loadTemplate(): Promise<ExcelJS.Workbook> {
  const file = resolveTemplate();
  if (!file) throw new Error("SPDC RFI Form template not found (SPDC_RFI_Form_and_Register.xlsx)");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

function sheet(wb: ExcelJS.Workbook, name: string) {
  return wb.worksheets.find((w) => w.name === name) || null;
}

export async function buildSpdcRfiWorkbook(opts: {
  project: SpdcRfiProject;
  rfis: SpdcRfiRecord[];
  selectRfiId?: string | null;
}): Promise<ExcelJS.Workbook> {
  const wb = await loadTemplate();
  const control = sheet(wb, "01_CONTROL");
  const formSheet = sheet(wb, "03_RFI_FORM");
  const register = sheet(wb, "04_RFI_REGISTER");
  if (!control || !formSheet || !register) {
    throw new Error("SPDC RFI workbook is missing CONTROL / FORM / REGISTER sheets");
  }

  const selected =
    (opts.selectRfiId && opts.rfis.find((r) => r.id === opts.selectRfiId)) || opts.rfis[0] || null;
  const selectedForm = selected ? parseForm(selected.formDataJson) : {};

  fillControl(control, opts.project, selectedForm);
  if (register) {
    clearRegisterSample(register);
    const filled = opts.rfis.map(fillSpdcRfiRow);
    filled.forEach((row, i) => writeRegisterRow(register, REGISTER_START + i, row));
  }

  if (selected) {
    const row = fillSpdcRfiRow(selected);
    fillFormSheet(formSheet, opts.project, row, selectedForm);
  }
  embedLogo(wb, formSheet);
  return wb;
}

export async function buildSpdcRfiXlsxBuffer(opts: {
  project: SpdcRfiProject;
  rfis: SpdcRfiRecord[];
  selectRfiId?: string | null;
}): Promise<Buffer> {
  const wb = await buildSpdcRfiWorkbook(opts);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kv(label: string, value: string, wide = false) {
  return `<div class="kv${wide ? " wide" : ""}"><span class="k">${esc(label)}</span><span class="v">${esc(value || "—")}</span></div>`;
}

function block(title: string, inner: string) {
  return `<section><h2>${esc(title)}</h2>${inner}</section>`;
}

export function renderSpdcRfiFormHtml(opts: {
  project: SpdcRfiProject;
  rfi: SpdcRfiRecord;
}): string {
  const row = fillSpdcRfiRow(opts.rfi);
  const form = parseForm(opts.rfi.formDataJson);
  const logo = sharnamLogoDataUri();
  const p = opts.project;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(row.number)} — Request for Information · Sharnam</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body{font-family:"Source Sans 3","Segoe UI",Helvetica,Arial,sans-serif;color:#1a1d26;margin:0;background:#eef1f4}
    .actions{text-align:center;padding:14px}
    .actions button{background:#0b6a78;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer}
    .sheet{max-width:820px;margin:0 auto 28px;background:#fff;border:1px solid #cfd6de;box-shadow:0 10px 28px rgba(26,29,38,.08)}
    .hero{background:#1a1d26;color:#fff;padding:14px 20px;display:flex;gap:16px;align-items:center}
    .hero img{height:52px;width:auto;background:#fff;border-radius:8px;padding:6px 10px}
    .hero .co{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#99f6e4}
    .hero h1{margin:4px 0 0;font-size:20px;letter-spacing:.02em}
    .meta{padding:8px 20px;border-bottom:1px solid #e2e5eb;font-size:12px;color:#5c6578;display:flex;justify-content:space-between;gap:12px}
    section{padding:12px 20px 4px;border-bottom:1px solid #eef1f4}
    h2{margin:0 0 8px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:#0b6a78;padding:6px 10px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
    .kv{display:grid;grid-template-columns:42% 1fr;border:1px solid #e2e5eb;min-height:34px}
    .kv.wide{grid-column:1 / -1;grid-template-columns:21% 1fr}
    .k{background:#f4f6f8;padding:7px 10px;font-size:11px;color:#5c6578;font-weight:600}
    .v{padding:7px 10px;font-size:13px;white-space:pre-wrap}
    .body{border:1px solid #e2e5eb;min-height:72px;padding:10px 12px;font-size:13px;white-space:pre-wrap;background:#fffef6}
    .note{font-size:11px;color:#5c6578;padding:6px 0 10px}
    .sigs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding-bottom:12px}
    .sig{border:1px solid #e2e5eb;min-height:88px;padding:8px;font-size:11px}
    .sig b{display:block;margin-bottom:18px}
    .foot{padding:10px 20px 16px;font-size:10px;color:#5c6578;line-height:1.45}
    @media print{ .actions{display:none} body{background:#fff} .sheet{box-shadow:none;border:0} }
  </style>
</head>
<body>
  <div class="actions"><button type="button" onclick="window.print()">Print / Save PDF</button></div>
  <div class="sheet">
    <div class="hero">
      ${logo ? `<img src="${logo}" alt="Sharnam"/>` : ""}
      <div>
        <div class="co">Sharnam Project Development Consultants &amp; Co.</div>
        <h1>REQUEST FOR INFORMATION (RFI)</h1>
      </div>
    </div>
    <div class="meta">
      <span>Form No: ${esc(FORM_NO)}</span>
      <span>Form Rev: ${esc(FORM_REV)}</span>
      <span>${esc(row.number)}</span>
    </div>
    ${block(
      "1. Project particulars",
      `<div class="grid">
        ${kv("Project", p.name || p.code, true)}
        ${kv("Employer / Client", form.employerClient || p.clientName || "")}
        ${kv("Contract No", form.contractNo || p.code)}
        ${kv("Project Management", form.pmcName || PMC_NAME)}
        ${kv("Package", row.package)}
      </div>`
    )}
    ${block(
      "2. RFI particulars",
      `<div class="grid">
        ${kv("RFI No", row.number)}
        ${kv("Revision", row.rev)}
        ${kv("Date raised", row.dateRaised)}
        ${kv("Priority", row.priority)}
        ${kv("Reply required by", row.replyRequiredBy)}
        ${kv("Response time (days)", row.slaDays)}
        ${kv("Originator", row.originator)}
        ${kv("Discipline", row.discipline)}
        ${kv("Category", row.category)}
        ${kv("Responsible party", row.responsibleParty)}
        ${kv("Subject", row.subject, true)}
        ${kv("Location / grid / level", row.location, true)}
        ${kv("Drawing ref", row.drawingRef)}
        ${kv("Drawing rev", row.drawingRev)}
        ${kv("Specification clause", row.specClause, true)}
      </div>`
    )}
    ${block("3. Query raised", `<div class="body">${esc(row.query)}</div>`)}
    ${block(
      "4. Solution proposed by originator (an RFI without this is returned unanswered)",
      `<div class="body">${esc(row.proposedSolution)}</div>`
    )}
    ${block(
      "5. Impact claimed by originator",
      `<div class="grid">
        ${kv("Cost impact claimed", row.costImpact)}
        ${kv("Estimated amount (INR)", row.estCost)}
        ${kv("Time impact claimed", row.timeImpact)}
        ${kv("Estimated delay (days)", row.estDelay)}
      </div><p class="note">A claimed impact does not create an entitlement. If the response changes scope, a change notice is raised separately.</p>`
    )}
    ${block(
      "6. Response",
      `<div class="body">${esc(row.response)}</div>
      <div class="grid" style="margin-top:8px">
        ${kv("Responded by", row.respondedBy)}
        ${kv("Date of response", row.dateResponded)}
      </div>`
    )}
    ${block(
      "7. PMC review & close-out",
      `<div class="grid">
        ${kv("Status", row.status)}
        ${kv("Date closed", row.dateClosed)}
        ${kv("Days taken", row.daysTaken)}
        ${kv("SLA status", row.slaStatus)}
        ${kv("Change / VO reference", row.voRef)}
        ${kv("Attachments", row.attachments)}
        ${kv("PMC remarks", row.pmcRemarks, true)}
      </div>`
    )}
    ${block(
      "8. Signatures",
      `<div class="sigs">
        <div class="sig"><b>Raised by (Contractor)</b>${esc(row.originator)}<br/>${esc(row.dateRaised)}</div>
        <div class="sig"><b>Reviewed by (SPDC PMC)</b>Name / Signature / Date</div>
        <div class="sig"><b>Responded by (Consultant)</b>${esc(row.respondedBy)}<br/>${esc(row.dateResponded)}</div>
        <div class="sig"><b>Accepted &amp; closed by (SPDC PMC)</b>${esc(row.dateClosed)}</div>
      </div>`
    )}
    <div class="foot">Distribution: Contractor / Design Consultant / Employer's Representative / SPDC Document Control. This form is a controlled record — file the signed copy against the RFI number in the project document register.</div>
  </div>
</body>
</html>`;
}

export function safeRfiFilename(number: string, ext: string) {
  return `${String(number || "RFI").replace(/[^\w.-]+/g, "_")}-RFI-Form.${ext}`;
}
