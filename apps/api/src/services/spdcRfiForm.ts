/**
 * SPDC_RFI_Form_and_Register.xlsx — fill 01_CONTROL, 03_RFI_FORM, 04_RFI_REGISTER
 * from portal RFI records so downloads match Form No SPDC/QMS/F-RFI-01.
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import type PDFKit from "pdfkit";
import { sharnamLogoDataUri, sharnamLogoPath } from "./brandedExport.js";
import { detachSharedStyles } from "../lib/excelTemplate.js";

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
/** Columns the template calculates from the row and the control sheet. Do not overwrite them. */
const REGISTER_FORMULA_COLS = new Set([16, 17, 24, 25, 26]);
const REGISTER_DATE_COLS = new Set([14, 19, 23]);

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
    attachments:
      [form.attachments, form.extraChecklistNames, r.attachmentsJson && !r.attachmentsJson.startsWith("[") ? r.attachmentsJson : ""]
        .filter(Boolean)
        .join(", ") || "",
    pmcRemarks: form.pmcRemarks || form.remarks || "",
  };
}

function writePlain(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null | undefined) {
  const cell = ws.getCell(row, col);
  cell.value = value == null || value === "" ? null : value;
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

function excelDate(display: string): Date | null {
  const match = display.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
  if (!match) return null;
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const month = months[match[2]];
  if (month == null) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1]), 12));
}

function readingHeight(texts: Array<string | number | null | undefined>, min: number, max: number) {
  const longest = texts.reduce((n, text) => Math.max(n, String(text || "").length), 0);
  const wraps = Math.max(1, Math.ceil(longest / 48));
  return Math.min(max, Math.max(min, wraps * 15));
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
    null,
    null,
    row.responsibleParty,
    row.dateResponded || null,
    row.response,
    row.respondedBy,
    row.status,
    row.dateClosed || null,
    null,
    null,
    null,
    row.costImpact,
    row.estCost === "" ? null : Number(row.estCost) || row.estCost,
    row.timeImpact,
    row.estDelay === "" ? null : Number(row.estDelay) || row.estDelay,
    row.voRef,
    row.attachments,
    row.pmcRemarks,
  ];
  for (let i = 0; i < vals.length; i++) {
    const col = i + 1;
    if (REGISTER_FORMULA_COLS.has(col)) continue;
    const cell = ws.getCell(excelRow, col);
    const raw = vals[i];
    if (raw == null || raw === "") {
      cell.value = null;
      continue;
    }
    if (REGISTER_DATE_COLS.has(col) && typeof raw === "string") {
      cell.value = excelDate(raw) || raw;
      continue;
    }
    cell.value = raw;
  }
  ws.getRow(excelRow).height = readingHeight(
    [row.subject, row.query, row.proposedSolution, row.response, row.pmcRemarks],
    42,
    96,
  );
}

/** The form sheet looks up this number on the register. Every other cell stays a formula. */
function selectRfiOnForm(ws: ExcelJS.Worksheet, rfiNo: string, row: SpdcFilledRow) {
  ws.getCell(5, 3).value = rfiNo;
  fitBlock(ws, 24, 28, row.query);
  fitBlock(ws, 31, 34, row.proposedSolution);
  fitBlock(ws, 42, 47, row.response);
  fitBlock(ws, 55, 56, row.pmcRemarks);
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.orientation = "portrait";
  ws.pageSetup.paperSize = 9;
  ws.pageSetup.printArea = "A1:H64";
  ws.pageSetup.horizontalCentered = true;
}

function fitBlock(ws: ExcelJS.Worksheet, from: number, to: number, text: string) {
  const lines = String(text || "")
    .split(/\n/)
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 95) || 1), 0);
  const rows = to - from + 1;
  const each = Math.min(32, Math.max(15, Math.ceil((Math.max(1, lines) * 16) / rows)));
  for (let r = from; r <= to; r++) ws.getRow(r).height = each;
}

function focusSheet(wb: ExcelJS.Workbook, name: string) {
  const idx = wb.worksheets.findIndex((w) => w.name === name);
  wb.views = [{ x: 0, y: 0, width: 0, height: 0, activeTab: Math.max(0, idx), firstSheet: 0, visibility: "visible" }];
}

/** Cache raw template bytes — re-reading + detachSharedStyles on every export was timing out gateways (~180s). */
let cachedTemplateBytes: ArrayBuffer | null = null;
let cachedTemplatePath: string | null = null;

async function loadTemplate(): Promise<ExcelJS.Workbook> {
  const file = resolveTemplate();
  if (!file) throw new Error("SPDC RFI Form template not found (SPDC_RFI_Form_and_Register.xlsx)");
  if (!cachedTemplateBytes || cachedTemplatePath !== file) {
    const buf = await fs.promises.readFile(file);
    cachedTemplateBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    cachedTemplatePath = file;
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(cachedTemplateBytes);
  detachSharedStyles(wb);
  if (wb.calcProperties) wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

function sheet(wb: ExcelJS.Workbook, name: string) {
  return wb.worksheets.find((w) => w.name === name) || null;
}

/** Kinds that belong on SPDC_RFI_Form_and_Register (Request for Information). */
export function isSpdcRfiRegisterKind(kind?: string | null) {
  return !kind || kind === "RequestForInformation" || kind === "Manual";
}

export type RfiEvidenceFile = { name: string; url?: string | null; kind?: string | null };

/** form = one RFI sheet (blank fields stay blank). register = the log only, no form. */
export type SpdcRfiScope = "form" | "register";

export function rfiEvidenceFiles(r: SpdcRfiRecord, extra?: RfiEvidenceFile[]): RfiEvidenceFile[] {
  const out: RfiEvidenceFile[] = [];
  const raw = r.attachmentsJson;
  if (raw?.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (!item || typeof item !== "object") continue;
          const row = item as { name?: string; url?: string; sharePointUrl?: string; kind?: string };
          const name = String(row.name || "").trim();
          const url = row.sharePointUrl || row.url || "";
          if (name || url) out.push({ name: name || "Evidence", url, kind: row.kind || "file" });
        }
      }
    } catch {
      /* plain text note, not a file list */
    }
  }
  for (const file of extra || []) {
    if (file?.name) out.push(file);
  }
  return out;
}

function addRfiChartSheet(wb: ExcelJS.Workbook, rows: SpdcFilledRow[]) {
  const ws = wb.addWorksheet("Charts", { properties: { tabColor: { argb: "FF1E3A5F" } } });
  const logo = sharnamLogoPath();
  if (logo) {
    try {
      const imgId = wb.addImage({ filename: logo, extension: "png" });
      ws.addImage(imgId, { tl: { col: 0.15, row: 0.1 }, ext: { width: 110, height: 34 }, editAs: "oneCell" });
    } catch {
      /* logo optional */
    }
  }
  ws.getCell(1, 2).value = "Sharnam · RFI summary";
  ws.getCell(1, 2).font = { bold: true, size: 16, color: { argb: "FF1E3A5F" } };
  ws.getRow(1).height = 24;
  ws.getCell(3, 2).value = "Common RFI log";
  ws.getCell(3, 2).font = { bold: true, size: 12, color: { argb: "FF1E3A5F" } };
  const tally = (key: keyof SpdcFilledRow) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const label = String(row[key] || "—");
      map.set(label, (map.get(label) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  let rowNo = 5;
  for (const [title, pairs] of [
    ["By status", tally("status")],
    ["By priority", tally("priority")],
    ["By discipline", tally("discipline")],
  ] as const) {
    ws.getCell(rowNo, 2).value = title;
    ws.getCell(rowNo, 2).font = { bold: true, size: 12, color: { argb: "FF1E3A5F" } };
    rowNo += 1;
    const start = rowNo;
    if (!pairs.length) {
      ws.getCell(rowNo, 2).value = "None yet";
      rowNo += 2;
      continue;
    }
    pairs.forEach(([label, count]) => {
      ws.getCell(rowNo, 2).value = label;
      ws.getCell(rowNo, 3).value = count;
      ws.getCell(rowNo, 3).font = { bold: true };
      rowNo += 1;
    });
    try {
      ws.addConditionalFormatting({
        ref: `C${start}:C${rowNo - 1}`,
        rules: [
          {
            type: "dataBar",
            cfvo: [
              { type: "num", value: 0 },
              { type: "max" },
            ],
            color: { argb: "FF0B6A78" },
            showValue: true,
            gradient: false,
          } as any,
        ],
      });
    } catch {
      /* bars are optional */
    }
    rowNo += 2;
  }
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 16;
}

function addEvidenceSheet(wb: ExcelJS.Workbook, files: RfiEvidenceFile[]) {
  if (!files.length) return;
  const ws = wb.addWorksheet("Evidence", { properties: { tabColor: { argb: "FF0B6A78" } } });
  ws.getCell(1, 1).value = "Evidence filed with this RFI";
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.getCell(2, 1).value = "Kind";
  ws.getCell(2, 2).value = "File";
  ws.getRow(2).font = { bold: true };
  files.forEach((file, i) => {
    ws.getCell(i + 3, 1).value = file.kind || "file";
    const cell = ws.getCell(i + 3, 2);
    if (file.url) cell.value = { text: file.name, hyperlink: file.url };
    else cell.value = file.name;
  });
  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 72;
}

export async function buildSpdcRfiWorkbook(opts: {
  project: SpdcRfiProject;
  rfis: SpdcRfiRecord[];
  selectRfiId?: string | null;
  scope?: SpdcRfiScope;
  evidence?: RfiEvidenceFile[];
}): Promise<ExcelJS.Workbook> {
  const wb = await loadTemplate();
  const scope: SpdcRfiScope = opts.scope || (opts.selectRfiId ? "form" : "register");
  const control = sheet(wb, "01_CONTROL");
  const formSheet = sheet(wb, "03_RFI_FORM");
  const register = sheet(wb, "04_RFI_REGISTER");
  if (!control || !formSheet || !register) {
    throw new Error("SPDC RFI workbook is missing CONTROL / FORM / REGISTER sheets");
  }

  const selected =
    (opts.selectRfiId && opts.rfis.find((r) => r.id === opts.selectRfiId)) ||
    (scope === "form" ? opts.rfis[0] : null);
  const selectedForm = selected ? parseForm(selected.formDataJson) : {};
  const evidence = selected ? rfiEvidenceFiles(selected, opts.evidence) : opts.evidence || [];

  fillControl(control, opts.project, selectedForm);

  const registerRows = (scope === "register" ? opts.rfis.filter((r) => isSpdcRfiRegisterKind(r.rfiKind)) : selected && isSpdcRfiRegisterKind(selected.rfiKind) ? [selected] : [])
    .map(fillSpdcRfiRow);
  if (selected && evidence.length) {
    const hit = registerRows.find((row) => row.number === selected.number);
    if (hit) hit.attachments = [hit.attachments, evidence.map((f) => f.name).join(", ")].filter(Boolean).join(", ");
  }
  clearRegisterSample(register);
  registerRows.forEach((row, i) => writeRegisterRow(register, REGISTER_START + i, row));
  const shown = (selected && registerRows.find((row) => row.number === selected.number)) || registerRows[registerRows.length - 1];
  if (shown) selectRfiOnForm(formSheet, shown.number, shown);

  register.pageSetup.orientation = "landscape";
  register.pageSetup.fitToPage = true;
  register.pageSetup.fitToWidth = 1;
  register.pageSetup.fitToHeight = 0;
  register.pageSetup.paperSize = 9;
  register.pageSetup.printTitlesRow = "1:4";
  const lastRow = Math.max(REGISTER_START, REGISTER_START + registerRows.length - 1);
  register.pageSetup.printArea = `A1:AG${lastRow}`;

  const readMe = sheet(wb, "00_READ_ME");
  if (readMe) readMe.state = "hidden";
  addRfiChartSheet(wb, registerRows);
  if (wb.calcProperties) wb.calcProperties.fullCalcOnLoad = true;
  focusSheet(wb, scope === "register" ? "04_RFI_REGISTER" : "03_RFI_FORM");
  addEvidenceSheet(wb, evidence);
  return wb;
}

export async function buildSpdcRfiXlsxBuffer(opts: {
  project: SpdcRfiProject;
  rfis: SpdcRfiRecord[];
  selectRfiId?: string | null;
  scope?: SpdcRfiScope;
  evidence?: RfiEvidenceFile[];
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
  evidence?: RfiEvidenceFile[];
}): string {
  const evidence = rfiEvidenceFiles(opts.rfi, opts.evidence);
  const row = fillSpdcRfiRow(opts.rfi);
  if (evidence.length) row.attachments = evidence.map((f) => f.name).join(", ");
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
    ${
      evidence.length
        ? block(
            "Evidence",
            `<ul>${evidence
              .map((f) =>
                f.url
                  ? `<li><a href="${esc(f.url)}">${esc(f.name)}</a></li>`
                  : `<li>${esc(f.name)}</li>`
              )
              .join("")}</ul>`
          )
        : ""
    }
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

function pdfLine(doc: PDFKit.PDFDocument, label: string, value: string, y: number) {
  if (y > 760) {
    doc.addPage();
    y = 40;
  }
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#1e3a5f").text(label, 40, y, { width: 140 });
  doc.font("Helvetica").fontSize(9).fillColor("#0f172a").text(value || "—", 190, y, { width: 360 });
  return doc.y + 8;
}

/** Branded one-page RFI, including the official answer, for the SharePoint file. */
export async function buildSpdcRfiPdfBuffer(opts: {
  project: SpdcRfiProject;
  rfi: SpdcRfiRecord;
  evidence?: RfiEvidenceFile[];
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const evidence = rfiEvidenceFiles(opts.rfi, opts.evidence);
  const row = fillSpdcRfiRow(opts.rfi);
  if (evidence.length) {
    row.attachments = [row.attachments, evidence.map((file) => file.name).join(", ")].filter(Boolean).join(", ");
  }
  const logo = sharnamLogoPath();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    if (logo) {
      try {
        doc.image(logo, 40, 32, { fit: [88, 36] });
      } catch {
        /* logo optional */
      }
    }
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1e3a5f").text("SHARNAM PROJECT DEVELOPMENT CONSULTANTS & CO.", 140, 34, { width: 410 });
    doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(`Request for Information · ${FORM_NO}`, 140, 54);
    let y = 92;
    const lines: [string, string][] = [
      ["Project", opts.project.name || opts.project.code],
      ["RFI number", row.number],
      ["Subject", row.subject],
      ["Responsible party", row.responsibleParty],
      ["Priority", `${row.priority} · ${row.slaDays} days`],
      ["Status", row.status],
      ["Query", row.query],
      ["Proposed solution", row.proposedSolution],
      ["Official response", row.response || "Waiting for the responsible party"],
      ["Responded by", [row.respondedBy, row.dateResponded].filter(Boolean).join(" · ")],
      ["Checklists", row.attachments],
    ];
    for (const [label, value] of lines) y = pdfLine(doc, label, value, y);
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(
      "Sharnam Project Development Consultants & Co. · File this copy with the common RFI log.",
      40,
      800,
      { width: 520 },
    );
    doc.end();
  });
}

/** Branded common-log PDF stored next to the RFI register workbook. */
export async function buildSpdcRfiRegisterPdfBuffer(opts: {
  project: SpdcRfiProject;
  rfis: SpdcRfiRecord[];
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const rows = opts.rfis.filter((rfi) => isSpdcRfiRegisterKind(rfi.rfiKind)).map(fillSpdcRfiRow);
  const logo = sharnamLogoPath();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    if (logo) {
      try {
        doc.image(logo, 32, 24, { fit: [80, 32] });
      } catch {
        /* logo optional */
      }
    }
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#1e3a5f").text("Common RFI Log", 124, 28);
    doc.font("Helvetica").fontSize(9).fillColor("#64748b").text(`${opts.project.name} · ${PMC_NAME}`, 124, 48);
    let y = 72;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
    doc.rect(32, y, 778, 16).fill("#1e3a5f");
    doc.fillColor("#ffffff").text("Number", 36, y + 4, { width: 70 });
    doc.text("Subject", 110, y + 4, { width: 220 });
    doc.text("Responsible", 336, y + 4, { width: 120 });
    doc.text("Status", 462, y + 4, { width: 70 });
    doc.text("Official response", 538, y + 4, { width: 260 });
    y += 20;
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8);
    for (const row of rows) {
      if (y > 540) {
        doc.addPage();
        y = 36;
      }
      doc.text(row.number, 36, y, { width: 70 });
      doc.text(row.subject, 110, y, { width: 220 });
      doc.text(row.responsibleParty || "—", 336, y, { width: 120 });
      doc.text(row.status, 462, y, { width: 70 });
      doc.text((row.response || "Waiting").slice(0, 180), 538, y, { width: 260 });
      y = Math.max(doc.y, y + 14) + 4;
    }
    if (!rows.length) doc.text("No RFIs on this log yet.", 36, y);
    doc.end();
  });
}
