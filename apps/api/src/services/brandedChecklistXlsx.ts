/**
 * Branded checklist XLSX — fills real SPDC client forms (ExcelJS), same approach as DPR/WPR.
 *
 * Templates (apps/api/checklist-templates + seed/data):
 *   - SPDC_Activity_Inspection_Checklist_Format.xlsx  → QI / Activity / Drawing / Site
 *   - SPDC_Request_for_Inspection_Form.xlsx           → cover IR sheet for QI
 *   - SPDC_Safety_Inspection_Request_and_Checklists.xlsx → Safety walkthrough + Safety IR
 *   - SPDC_RFI_Form_and_Register.xlsx                 → Drawing / RFI-style fills
 */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { checklistLogoPath, collectChecklistSignSlots, type SignSlot } from "./checklistSignoff.js";

type ResponseCell = { answer?: string; remarks?: string; remark?: string; value?: string };
type Item = {
  id: string;
  itemCode?: string | null;
  description?: string | null;
  instruction?: string | null;
  sortOrder?: number | null;
};

export type BrandedChecklistSubmission = {
  id?: string;
  status?: string | null;
  remarks?: string | null;
  createdAt?: Date | string | null;
  responsesJson?: string;
  revisionNumber?: string | null;
  submittedBy?: { fullName?: string | null; email?: string | null } | null;
  drawing?: { drawingNumber?: string | null; title?: string | null } | null;
  photos?: { kind?: string | null; fileUrl?: string | null; caption?: string | null }[];
  reviewedAt?: Date | string | null;
  revision?: {
    revisionNumber?: string | null;
    clientSignName?: string | null;
    clientSignUrl?: string | null;
    pmcSignName?: string | null;
    pmcSignUrl?: string | null;
    siteEngineerSignName?: string | null;
    siteEngineerSignUrl?: string | null;
    contractorSignName?: string | null;
    contractorSignUrl?: string | null;
  } | null;
  assignment?: {
    template?: {
      name?: string | null;
      checklistType?: string | null;
      category?: string | null;
      items?: Item[];
    } | null;
  } | null;
};

const NAVY = "FF1F3864";
const LABEL = "FFD9D9D9";
const INPUT = "FFFFF2CC";
const HEADER_BG = "FFF2F2F2";
const OK_BG = "FFC6EFCE";
const OK_FG = "FF006100";
const FAIL_BG = "FFFFC7CE";
const FAIL_FG = "FF9C0006";
const NA_BG = "FFFFEB9C";
const NA_FG = "FF9C5700";
const PENDING_BG = "FFDDEBF7";
const PENDING_FG = "FF1F4E79";

function resolveTemplate(fileName: string): string | null {
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

type ProjectMeta = {
  name?: string;
  code?: string;
  clientName?: string | null;
  contractorName?: string | null;
  location?: string | null;
};

function copyCellStyle(src: ExcelJS.Cell, dest: ExcelJS.Cell) {
  dest.value = src.value;
  const fill = src.fill as ExcelJS.FillPattern | undefined;
  const argb = fill?.fgColor && "argb" in fill.fgColor ? String(fill.fgColor.argb || "") : "";
  if (fill?.type === "pattern" && argb) {
    dest.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  }
  if (src.font) dest.font = { ...src.font };
  if (src.border) dest.border = JSON.parse(JSON.stringify(src.border));
  if (src.alignment) dest.alignment = { ...src.alignment };
  if (src.numFmt) dest.numFmt = src.numFmt;
}

function copyWorksheet(src: ExcelJS.Worksheet, dest: ExcelJS.Workbook, name: string) {
  const out = dest.addWorksheet(name);
  src.columns.forEach((col, idx) => {
    if (col.width) out.getColumn(idx + 1).width = col.width;
  });
  src.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const destRow = out.getRow(rowNumber);
    if (row.height) destRow.height = row.height;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      copyCellStyle(cell, destRow.getCell(colNumber));
    });
  });
  for (const merge of src.model.merges || []) {
    try {
      out.mergeCells(merge);
    } catch {
      /* already merged */
    }
  }
  return out;
}

function writeValue(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null | undefined) {
  const cell = ws.getCell(row, col);
  cell.value = value == null || value === "" ? null : value;
}

function paintInput(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null | undefined) {
  const cell = ws.getCell(row, col);
  cell.value = value == null || value === "" ? null : value;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT } };
  cell.font = { ...(cell.font || {}), color: { argb: "FF000000" }, size: cell.font?.size || 10 };
}

function thinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };
}

function normalizeAnswer(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function classifyAnswer(answer: string): "ok" | "fail" | "na" | "pending" | "other" {
  const a = normalizeAnswer(answer).toLowerCase();
  if (!a || a === "—" || a === "-") return "pending";
  if (/^(n\/?a|na|not applicable)$/i.test(a)) return "na";
  if (/^(ok|yes|y|pass|passed|compliant|satisfactory|cleared|s1|good|true|✓|✔)$/i.test(a)) return "ok";
  if (
    /^(not\s*ok|nok|no|n|fail|failed|non[- ]?compliant|unsatisfactory|reject|rejected|s3|s4|false|✗|✘)$/i.test(a)
  )
    return "fail";
  if (/pending|open|partial|hold|s2|conditional/i.test(a)) return "pending";
  return "other";
}

function statusFill(kind: ReturnType<typeof classifyAnswer>): { bg: string; fg: string } {
  switch (kind) {
    case "ok":
      return { bg: OK_BG, fg: OK_FG };
    case "fail":
      return { bg: FAIL_BG, fg: FAIL_FG };
    case "na":
      return { bg: NA_BG, fg: NA_FG };
    case "pending":
      return { bg: PENDING_BG, fg: PENDING_FG };
    default:
      return { bg: INPUT, fg: "FF000000" };
  }
}

function parseResponses(responsesJson?: string): Record<string, ResponseCell | string> {
  try {
    if (!responsesJson) return {};
    return typeof responsesJson === "string" ? JSON.parse(responsesJson || "{}") : (responsesJson as any) || {};
  } catch {
    return {};
  }
}

function parseFillMetaFromResponses(responsesJson?: string) {
  const all = parseResponses(responsesJson);
  const raw = all._meta;
  if (!raw || typeof raw !== "object") return {};
  const m = raw as Record<string, unknown>;
  return {
    reportNo: String(m.reportNo || "").trim(),
    location: String(m.location || "").trim(),
    refDrawing: String(m.refDrawing || "").trim(),
    quantity: String(m.quantity || "").trim(),
  };
}

function getAnswer(
  responses: Record<string, ResponseCell | string>,
  item: Item
): { answer: string; remark: string } {
  const ans = responses[item.id] || responses[item.itemCode || ""] || {};
  if (typeof ans === "string") return { answer: ans, remark: "" };
  return {
    answer: String(ans.answer || ans.value || ""),
    remark: String(ans.remarks || ans.remark || ""),
  };
}

function familyOf(type?: string | null): "activity" | "safety" | "rfi" | "ir" {
  const t = String(type || "").toLowerCase();
  if (t === "safety" || t.includes("safety")) return "safety";
  if (t === "qualityinspection" || t.includes("qualityir")) return "ir";
  if (t === "activityinspection") return "activity";
  if (t === "siteexecution") return "activity";
  if (t === "drawingcheck" || t.includes("drawing")) return "rfi";
  if (t.includes("rfi") || t.includes("information")) return "rfi";
  return "activity";
}

function fmtDate(d?: Date | string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtDateTime(d?: Date | string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("en-GB");
}

function drawingLabel(submission: BrandedChecklistSubmission) {
  if (!submission.drawing) return "";
  const n = submission.drawing.drawingNumber || "";
  const t = submission.drawing.title || "";
  const revNo = submission.revisionNumber || submission.revision?.revisionNumber;
  const rev = revNo ? ` Rev. ${revNo}` : "";
  return `${n}${t ? ` — ${t}` : ""}${rev}`.trim();
}

function embedLogo(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  const logo = checklistLogoPath();
  if (!logo) return;
  try {
    const imgId = wb.addImage({ filename: logo, extension: "png" });
    ws.getRow(1).height = Math.max(ws.getRow(1).height || 18, 36);
    ws.addImage(imgId, {
      tl: { col: 0.15, row: 0.1 },
      ext: { width: 118, height: 38 },
      editAs: "oneCell",
    });
  } catch {
    /* logo optional */
  }
}

function applySignoff(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  startRow: number,
  submission: BrandedChecklistSubmission,
  cols: number[]
) {
  let r = startRow;
  sectionBand(ws, r, cols, "8.  SIGNATURES");
  r += 1;
  const signs = collectChecklistSignSlots(submission);
  const colStart = cols[0];
  const width = Math.max(1, Math.floor(cols.length / Math.max(signs.length, 1)));
  const roleRow = r;
  const imgRow = r + 1;
  const nameRow = r + 2;
  const dateRow = r + 3;
  ws.getRow(imgRow).height = 42;
  signs.forEach((s: SignSlot, i: number) => {
    const c0 = colStart + i * width;
    const c1 = i === signs.length - 1 ? cols[cols.length - 1] : c0 + width - 1;
    try {
      ws.mergeCells(roleRow, c0, roleRow, c1);
      ws.mergeCells(imgRow, c0, imgRow, c1);
      ws.mergeCells(nameRow, c0, nameRow, c1);
      ws.mergeCells(dateRow, c0, dateRow, c1);
    } catch {
      /* already merged */
    }
    const roleCell = ws.getCell(roleRow, c0);
    roleCell.value = s.role;
    roleCell.font = { bold: true, size: 8, color: { argb: "FF1F3864" } };
    roleCell.alignment = { wrapText: true, vertical: "middle" };
    const nameCell = ws.getCell(nameRow, c0);
    nameCell.value = s.name;
    nameCell.font = { size: 9, bold: true };
    const dateCell = ws.getCell(dateRow, c0);
    dateCell.value = s.date || "Name / Signature / Date";
    dateCell.font = { size: 8, italic: true, color: { argb: "FF666666" } };
    for (const row of [roleRow, imgRow, nameRow, dateRow]) {
      for (let c = c0; c <= c1; c++) thinBorder(ws.getCell(row, c));
    }
    if (s.buffer) {
      try {
        const imgId = wb.addImage({
          base64: s.buffer.toString("base64"),
          extension: "png",
        });
        ws.addImage(imgId, {
          tl: { col: c0 - 1 + 0.12, row: imgRow - 1 + 0.08 },
          ext: { width: 118, height: 34 },
          editAs: "oneCell",
        });
      } catch {
        /* image optional */
      }
    }
  });
  return dateRow + 1;
}

function keepOnlySheets(wb: ExcelJS.Workbook, names: string[]) {
  const keep = new Set(names.map((n) => n.toLowerCase()));
  for (const ws of [...wb.worksheets]) {
    if (!keep.has(ws.name.toLowerCase())) wb.removeWorksheet(ws.id);
  }
}

function sectionBand(ws: ExcelJS.Worksheet, row: number, cols: number[], title: string) {
  for (const c of cols) {
    const cell = ws.getCell(row, c);
    cell.value = c === cols[0] ? title : "";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    thinBorder(cell);
  }
  try {
    ws.mergeCells(row, cols[0], row, cols[cols.length - 1]);
  } catch {
    /* already merged */
  }
}

function unmergeFromRow(ws: ExcelJS.Worksheet, fromRow: number) {
  const merges = [...(ws.model.merges || [])];
  for (const m of merges) {
    const start = Number(String(m).match(/\d+/)?.[0] || 0);
    if (start >= fromRow) {
      try {
        ws.unMergeCells(m);
      } catch {
        /* ignore */
      }
    }
  }
}

function clearBodyRows(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, fromCol: number, toCol: number) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c);
      cell.value = null;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      cell.font = { size: 10, color: { argb: "FF000000" }, bold: false };
      thinBorder(cell);
    }
  }
}

async function fillActivityChecklist(
  submission: BrandedChecklistSubmission,
  project?: ProjectMeta
): Promise<ExcelJS.Workbook> {
  const file = resolveTemplate("SPDC_Activity_Inspection_Checklist_Format.xlsx");
  if (!file) throw new Error("SPDC Activity Inspection Checklist template not found");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  keepOnlySheets(wb, ["Checklist Format (Blank)"]);
  const ws = wb.worksheets[0];
  ws.name = "Activity Checklist";
  embedLogo(wb, ws);

  const template = submission.assignment?.template;
  const items = [...(template?.items || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const responses = parseResponses(submission.responsesJson);
  const fillMeta = parseFillMetaFromResponses(submission.responsesJson);
  const checklistNo = fillMeta.reportNo || (submission.id || "").slice(0, 10).toUpperCase() || "CL-PORTAL";

  paintInput(ws, 6, 5, project?.name || project?.code || "");
  paintInput(ws, 6, 9, checklistNo);
  paintInput(ws, 7, 5, project?.clientName || "");
  paintInput(ws, 7, 9, fmtDate(submission.createdAt));
  paintInput(ws, 8, 5, project?.contractorName || "");
  paintInput(ws, 8, 9, "");
  paintInput(ws, 9, 5, template?.name || "");
  paintInput(ws, 9, 9, template?.category || template?.checklistType || "");
  paintInput(ws, 10, 5, fillMeta.location || project?.location || "");
  paintInput(ws, 10, 9, "");
  paintInput(ws, 11, 5, fillMeta.refDrawing || drawingLabel(submission));
  paintInput(ws, 11, 9, "");
  paintInput(ws, 12, 5, fillMeta.quantity || "");
  paintInput(ws, 12, 9, submission.status || "");

  // Replace blank A–H skeleton with live filled lines (preserve header styling).
  unmergeFromRow(ws, 15);
  const lastRow = Math.max(ws.rowCount || 64, 64);
  clearBodyRows(ws, 15, lastRow, 2, 9);

  let r = 15;
  sectionBand(ws, r, [2, 3, 4, 5, 6, 7, 8, 9], "CHECK POINTS — FILLED FROM PORTAL");
  r += 1;

  let ok = 0;
  let fail = 0;
  let na = 0;
  let pending = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const { answer, remark } = getAnswer(responses, it);
    const kind = classifyAnswer(answer);
    if (kind === "ok") ok += 1;
    else if (kind === "fail") fail += 1;
    else if (kind === "na") na += 1;
    else pending += 1;

    const vals: Array<string | number> = [
      i + 1,
      it.description || it.itemCode || "",
      it.instruction || "",
      "",
      it.itemCode || "",
      normalizeAnswer(answer) || "",
      remark || "",
      submission.remarks && i === 0 ? String(submission.remarks) : "",
    ];
    // cols B..I = 2..9
    for (let c = 0; c < 8; c++) {
      const cell = ws.getCell(r, c + 2);
      cell.value = vals[c] === "" ? null : vals[c];
      cell.font = { size: 9, color: { argb: "FF000000" } };
      cell.alignment = { wrapText: true, vertical: "top" };
      thinBorder(cell);
      if (c === 5) {
        const { bg, fg } = statusFill(kind);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { bold: true, size: 9, color: { argb: fg } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      }
    }
    ws.getRow(r).height = Math.min(48, 16 + Math.ceil(String(vals[1]).length / 42) * 10);
    r += 1;
  }

  if (!items.length) {
    for (let c = 2; c <= 9; c++) {
      const cell = ws.getCell(r, c);
      cell.value = c === 3 ? "No line items on this fill" : null;
      thinBorder(cell);
    }
    r += 1;
  }

  r += 1;
  sectionBand(ws, r, [2, 3, 4, 5, 6, 7, 8, 9], "SUMMARY");
  r += 1;
  const summary = [
    ["Filled by", submission.submittedBy?.fullName || "—"],
    ["Submitted", fmtDateTime(submission.createdAt)],
    ["Overall status", submission.status || "—"],
    ["OK / Yes", ok],
    ["Not OK / No", fail],
    ["NA", na],
    ["Pending / other", pending],
    ["Overall remarks", submission.remarks || ""],
  ];
  for (const [label, value] of summary) {
    writeValue(ws, r, 2, label);
    ws.getCell(r, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LABEL } };
    ws.getCell(r, 2).font = { bold: true, size: 9 };
    paintInput(ws, r, 3, value as any);
    for (let c = 2; c <= 5; c++) thinBorder(ws.getCell(r, c));
    if (label === "OK / Yes") {
      ws.getCell(r, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OK_BG } };
      ws.getCell(r, 3).font = { bold: true, color: { argb: OK_FG } };
    }
    if (label === "Not OK / No") {
      ws.getCell(r, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FAIL_BG } };
      ws.getCell(r, 3).font = { bold: true, color: { argb: FAIL_FG } };
    }
    if (label === "NA") {
      ws.getCell(r, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NA_BG } };
      ws.getCell(r, 3).font = { bold: true, color: { argb: NA_FG } };
    }
    r += 1;
  }

  // Signature block (navy band like SPDC forms)
  r += 1;
  applySignoff(wb, ws, r, submission, [2, 3, 4, 5, 6, 7, 8, 9]);

  return wb;
}

async function fillSafetyChecklist(
  submission: BrandedChecklistSubmission,
  project?: ProjectMeta
): Promise<ExcelJS.Workbook> {
  const file = resolveTemplate("SPDC_Safety_Inspection_Request_and_Checklists.xlsx");
  if (!file) throw new Error("SPDC Safety Inspection checklist template not found");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);

  // Keep walkthrough + IR cover; drop activity-specific / register for a clean fill pack.
  keepOnlySheets(wb, ["Safety Checklist (General)", "Safety IR Form", "Procedure & Legend"]);

  const ws = wb.getWorksheet("Safety Checklist (General)") || wb.worksheets[0];
  embedLogo(wb, ws);
  const template = submission.assignment?.template;
  const items = [...(template?.items || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const responses = parseResponses(submission.responsesJson);
  const inspNo = (submission.id || "").slice(0, 10).toUpperCase() || "HSE-PORTAL";

  paintInput(ws, 5, 5, project?.name || project?.code || "");
  paintInput(ws, 5, 8, inspNo);
  paintInput(ws, 6, 5, project?.contractorName || "");
  paintInput(ws, 6, 8, fmtDateTime(submission.createdAt));
  paintInput(ws, 7, 5, template?.name || project?.location || "");
  paintInput(ws, 7, 8, submission.submittedBy?.fullName || "");
  paintInput(ws, 8, 5, "");
  paintInput(ws, 8, 8, "");

  unmergeFromRow(ws, 11);
  const lastRow = Math.max(ws.rowCount || 100, 100);
  clearBodyRows(ws, 11, lastRow, 2, 8);

  // Column headers again (cleared above if we wiped 10 — keep row 10 as-is from template)
  // Ensure header row present:
  const headers = ["Sr.", "Inspection Point", "Status", "Risk Rating", "Observation / Action Required", "Responsibility", "Target Date"];
  for (let i = 0; i < headers.length; i++) {
    const cell = ws.getCell(10, i + 2);
    cell.value = headers[i];
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LABEL } };
    cell.font = { bold: true, size: 9 };
    thinBorder(cell);
  }

  let r = 11;
  sectionBand(ws, r, [2, 3, 4, 5, 6, 7, 8], "A.  PORTAL SAFETY CHECK POINTS");
  r += 1;

  let yes = 0;
  let no = 0;
  let na = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const { answer, remark } = getAnswer(responses, it);
    const kind = classifyAnswer(answer);
    if (kind === "ok") yes += 1;
    else if (kind === "fail") no += 1;
    else if (kind === "na") na += 1;

    const risk =
      kind === "fail" ? "High" : kind === "pending" ? "Medium" : kind === "ok" ? "Low" : "";

    const vals = [
      i + 1,
      it.description || it.itemCode || "",
      normalizeAnswer(answer) || "",
      risk,
      remark || it.instruction || "",
      "",
      "",
    ];
    for (let c = 0; c < 7; c++) {
      const cell = ws.getCell(r, c + 2);
      cell.value = vals[c] === "" ? null : vals[c];
      cell.font = { size: 9 };
      cell.alignment = { wrapText: true, vertical: "top" };
      thinBorder(cell);
      if (c === 2) {
        const { bg, fg } = statusFill(kind);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { bold: true, size: 9, color: { argb: fg } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
      if (c === 3 && risk === "High") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FAIL_BG } };
        cell.font = { bold: true, color: { argb: FAIL_FG }, size: 9 };
      } else if (c === 3 && risk === "Medium") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NA_BG } };
        cell.font = { bold: true, color: { argb: NA_FG }, size: 9 };
      } else if (c === 3 && risk === "Low") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: OK_BG } };
        cell.font = { bold: true, color: { argb: OK_FG }, size: 9 };
      }
    }
    r += 1;
  }

  r += 1;
  const denom = yes + no;
  const score = denom > 0 ? Math.round((yes / denom) * 1000) / 10 : 0;
  const band = score >= 95 ? "Satisfactory" : score >= 85 ? "Needs Improvement" : denom ? "Unsatisfactory" : "—";
  const summaryRows: Array<[string, string | number]> = [
    ["Yes (OK)", yes],
    ["No (Not OK)", no],
    ["NA (excluded from score)", na],
    ["Compliance score %", denom ? score : "—"],
    ["Rating", band],
    ["Overall remarks", submission.remarks || ""],
    ["Filled by", submission.submittedBy?.fullName || "—"],
  ];
  sectionBand(ws, r, [2, 3, 4, 5, 6, 7, 8], "COMPLIANCE SUMMARY");
  r += 1;
  for (const [label, value] of summaryRows) {
    writeValue(ws, r, 2, label);
    ws.getCell(r, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LABEL } };
    paintInput(ws, r, 3, value as any);
    for (let c = 2; c <= 4; c++) thinBorder(ws.getCell(r, c));
    if (label === "Yes (OK)") {
      ws.getCell(r, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OK_BG } };
      ws.getCell(r, 3).font = { bold: true, color: { argb: OK_FG } };
    }
    if (label === "No (Not OK)") {
      ws.getCell(r, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FAIL_BG } };
      ws.getCell(r, 3).font = { bold: true, color: { argb: FAIL_FG } };
    }
    if (label === "Rating") {
      const band = String(value);
      if (band === "Satisfactory") {
        ws.getCell(r, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: OK_BG } };
        ws.getCell(r, 3).font = { bold: true, color: { argb: OK_FG } };
      } else if (band === "Needs Improvement") {
        ws.getCell(r, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: NA_BG } };
        ws.getCell(r, 3).font = { bold: true, color: { argb: NA_FG } };
      } else if (band === "Unsatisfactory") {
        ws.getCell(r, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FAIL_BG } };
        ws.getCell(r, 3).font = { bold: true, color: { argb: FAIL_FG } };
      }
    }
    r += 1;
  }

  r += 1;
  applySignoff(wb, ws, r, submission, [2, 3, 4, 5, 6, 7, 8]);

  // Safety IR cover particulars
  const ir = wb.getWorksheet("Safety IR Form");
  if (ir) {
    paintInput(ir, 6, 5, project?.name || project?.code || "");
    paintInput(ir, 6, 11, inspNo);
    paintInput(ir, 7, 5, project?.clientName || "");
    paintInput(ir, 7, 11, fmtDate(submission.createdAt));
    paintInput(ir, 9, 4, "SPDC");
    paintInput(ir, 13, 5, template?.name || "");
    paintInput(ir, 14, 5, drawingLabel(submission));
    paintInput(ir, 18, 5, submission.submittedBy?.fullName || "");
    paintInput(ir, 19, 5, submission.remarks || "");
    embedLogo(wb, ir);
    applySignoff(wb, ir, Math.max(ir.rowCount || 22, 22) + 1, submission, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  }

  return wb;
}

function fillIrParticulars(
  ws: ExcelJS.Worksheet,
  submission: BrandedChecklistSubmission,
  project?: ProjectMeta
) {
  const template = submission.assignment?.template;
  const irNo = (submission.id || "").slice(0, 10).toUpperCase() || "IR-PORTAL";
  paintInput(ws, 5, 5, project?.name || project?.code || "");
  paintInput(ws, 5, 11, irNo);
  paintInput(ws, 6, 5, project?.clientName || "");
  paintInput(ws, 6, 11, fmtDate(submission.createdAt));
  paintInput(ws, 7, 5, project?.contractorName || "");
  paintInput(ws, 8, 4, "SPDC");
  paintInput(ws, 8, 11, template?.category || template?.checklistType || "");
  paintInput(ws, 11, 5, template?.name || "");
  paintInput(ws, 12, 5, project?.location || drawingLabel(submission));
  paintInput(ws, 15, 5, drawingLabel(submission));
  paintInput(ws, 16, 4, fmtDate(submission.createdAt));
}

async function fillInspectionRequest(
  submission: BrandedChecklistSubmission,
  project?: ProjectMeta
): Promise<ExcelJS.Workbook> {
  const file = resolveTemplate("SPDC_Request_for_Inspection_Form.xlsx");
  if (!file) throw new Error("SPDC Request for Inspection Form template not found");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  embedLogo(wb, ws);
  const template = submission.assignment?.template;
  fillIrParticulars(ws, submission, project);

  // Append a compact checklist annex after the form body
  const items = [...(template?.items || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const responses = parseResponses(submission.responsesJson);
  let r = Math.max(ws.rowCount + 2, 50);
  for (let c = 2; c <= 11; c++) {
    const cell = ws.getCell(r, c);
    cell.value = c === 2 ? "ANNEX — CHECKLIST FILL (from portal)" : "";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    thinBorder(cell);
  }
  r += 1;
  const hdr = ["Sr", "Item", "Instruction", "Status", "Remarks"];
  for (let i = 0; i < hdr.length; i++) {
    const cell = ws.getCell(r, i + 2);
    cell.value = hdr[i];
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LABEL } };
    cell.font = { bold: true, size: 9 };
    thinBorder(cell);
  }
  r += 1;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const { answer, remark } = getAnswer(responses, it);
    const kind = classifyAnswer(answer);
    const vals = [i + 1, it.description || "", it.instruction || "", normalizeAnswer(answer), remark];
    for (let c = 0; c < vals.length; c++) {
      const cell = ws.getCell(r, c + 2);
      cell.value = vals[c] === "" ? null : vals[c];
      thinBorder(cell);
      cell.alignment = { wrapText: true, vertical: "top" };
      if (c === 3) {
        const { bg, fg } = statusFill(kind);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { bold: true, color: { argb: fg }, size: 9 };
      }
    }
    r += 1;
  }
  r += 1;
  applySignoff(wb, ws, r, submission, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  return wb;
}

async function fillRfiForm(
  submission: BrandedChecklistSubmission,
  project?: ProjectMeta
): Promise<ExcelJS.Workbook> {
  const file = resolveTemplate("SPDC_RFI_Form_and_Register.xlsx");
  if (!file) throw new Error("SPDC RFI Form template not found");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  keepOnlySheets(wb, ["03_RFI_FORM"]);
  const ws = wb.worksheets[0];
  ws.name = "RFI Form";
  embedLogo(wb, ws);

  const template = submission.assignment?.template;
  const rfiNo = `SPDC-RFI-${(submission.id || "PORTAL").slice(0, 6).toUpperCase()}`;
  const responses = parseResponses(submission.responsesJson);
  const items = [...(template?.items || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Yellow SELECT cell + overwrite formula-driven fields with concrete values for a printable snapshot.
  paintInput(ws, 5, 3, rfiNo);
  paintInput(ws, 8, 3, project?.name || project?.code || "");
  paintInput(ws, 9, 3, project?.clientName || "");
  paintInput(ws, 9, 7, project?.code || "");
  paintInput(ws, 10, 3, "Sharnam Project Development Consultants & Co., Vadodara");
  paintInput(ws, 13, 3, rfiNo);
  paintInput(ws, 14, 3, fmtDate(submission.createdAt));
  paintInput(ws, 14, 7, submission.status || "Open");
  paintInput(ws, 16, 3, submission.submittedBy?.fullName || "");
  paintInput(ws, 16, 7, template?.category || "Drawing");
  paintInput(ws, 18, 3, template?.name || "Checklist-linked query");
  paintInput(ws, 19, 3, drawingLabel(submission) || "");
  paintInput(ws, 20, 3, submission.drawing?.drawingNumber || "");
  paintInput(ws, 20, 7, submission.revisionNumber || "");

  // Body: concatenate answers as query / proposed solution when present
  const bodyLines = items.slice(0, 12).map((it) => {
    const { answer, remark } = getAnswer(responses, it);
    return `${it.description || it.itemCode || ""} → ${normalizeAnswer(answer) || "—"}${remark ? ` (${remark})` : ""}`;
  });
  paintInput(ws, 24, 2, bodyLines.join("\n") || submission.remarks || "");
  if (submission.remarks) paintInput(ws, 31, 2, submission.remarks);

  applySignoff(wb, ws, Math.max(ws.rowCount || 40, 40) + 1, submission, [2, 3, 4, 5, 6, 7, 8]);

  return wb;
}

async function withIrCover(
  filled: ExcelJS.Workbook,
  submission: BrandedChecklistSubmission,
  project?: ProjectMeta
): Promise<ExcelJS.Workbook> {
  const file = resolveTemplate("SPDC_Request_for_Inspection_Form.xlsx");
  if (!file) return filled;
  const irWb = new ExcelJS.Workbook();
  await irWb.xlsx.readFile(file);
  fillIrParticulars(irWb.worksheets[0], submission, project);
  const out = new ExcelJS.Workbook();
  copyWorksheet(irWb.worksheets[0], out, "IR Form");
  for (const ws of filled.worksheets) copyWorksheet(ws, out, ws.name);
  return out;
}

/**
 * Build branded SPDC-format XLSX for a checklist submission fill.
 */
export async function buildBrandedChecklistXlsxBuffer(
  submission: BrandedChecklistSubmission,
  project?: ProjectMeta
): Promise<Buffer> {
  const type = submission.assignment?.template?.checklistType || "";
  const family = familyOf(type);

  let wb: ExcelJS.Workbook;
  if (family === "safety") {
    wb = await fillSafetyChecklist(submission, project);
  } else if (family === "rfi") {
    wb = await fillRfiForm(submission, project);
  } else if (family === "ir") {
    wb = await fillInspectionRequest(submission, project);
  } else {
    wb = await fillActivityChecklist(submission, project);
    const isDrawingFill = String(type || "").toLowerCase().includes("drawing");
    if (!isDrawingFill) {
      try {
        wb = await withIrCover(wb, submission, project);
        const act = wb.getWorksheet("Activity Checklist") || wb.worksheets[wb.worksheets.length - 1];
        if (act) {
          embedLogo(wb, act);
          applySignoff(wb, act, Math.max(act.rowCount || 20, 20) + 1, submission, [2, 3, 4, 5, 6, 7, 8, 9]);
        }
        const ir = wb.getWorksheet("IR Form");
        if (ir) {
          embedLogo(wb, ir);
          applySignoff(wb, ir, Math.max(ir.rowCount || 22, 22) + 1, submission, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        }
      } catch {
        /* IR cover is best-effort */
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
