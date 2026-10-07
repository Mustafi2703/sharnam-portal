/** NCR / CAR form validation and branded Excel / HTML / PDF export (Safety NCR.xlsx · NCR 01 .xlsx). */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import XLSX from "../lib/xlsx.js";
import { SPDC_OFFICE_FOOTER, SPDC_PMC_NAME } from "@sharnam/shared";
import { sharnamLogoPath } from "./brandedExport.js";
import { detachSharedStyles } from "../lib/excelTemplate.js";

export type QualityNcrFormData = {
  projectName?: string;
  toParty?: string;
  fromParty?: string;
  actionResultOf?: string;
  environmentalIssues?: string;
  otherCause?: string;
  actionRequired?: string;
  workCarriedOutNote?: string;
  signedContractor?: string;
  positionContractor?: string;
  followUpEffective?: string;
  signedReviewer?: string;
  positionReviewer?: string;
  furtherAction?: string;
  pursueFurtherCosts?: string;
  siteSetupModification?: string;
  correctiveActionDetail?: string;
  actionByWhom?: string;
  actionCompleted?: string;
  contractorVendorId?: string;
  contractorEmail?: string;
  /** Office admin: Has contractor complied? Yes / No */
  contractorActed?: string;
  contractorActedAt?: string;
  contractorActedNote?: string;
  followUpCount?: string;
  lastFollowUpAt?: string;
};

export type SafetyNcrFormData = Record<string, string>;

function parseJson<T extends Record<string, string>>(raw?: string | null): T {
  if (!raw) return {} as T;
  try {
    const p = JSON.parse(raw);
    return typeof p === "object" && p ? p : ({} as T);
  } catch {
    return {} as T;
  }
}

export function parseQualityFormData(raw?: string | null): QualityNcrFormData {
  return parseJson<QualityNcrFormData>(raw);
}

export function qualityNcrMissingFields(row: {
  description?: string;
  contractor?: string | null;
  location?: string | null;
  ncrType?: string | null;
  plannedClosure?: Date | string | null;
  formDataJson?: string | null;
}): string[] {
  const f = parseQualityFormData(row.formDataJson);
  const missing: string[] = [];
  if (!row.description?.trim()) missing.push("Description of non-conformance");
  if (!row.contractor?.trim()) missing.push("Contractor");
  if (!row.location?.trim()) missing.push("Location");
  if (!row.ncrType?.trim()) missing.push("Type");
  if (!f.actionRequired?.trim()) missing.push("Action required to rectify");
  if (!row.plannedClosure) missing.push("Planned closure date");
  return missing;
}

export function qualityNcrCloseMissingFields(row: {
  description?: string;
  contractor?: string | null;
  location?: string | null;
  ncrType?: string | null;
  plannedClosure?: Date | string | null;
  actualClosure?: Date | string | null;
  formDataJson?: string | null;
}): string[] {
  const base = qualityNcrMissingFields(row);
  const f = parseQualityFormData(row.formDataJson);
  if (!f.contractorActed?.trim()) base.push("Contractor compliance — mark Acted / Not acted (office admin)");
  else if (f.contractorActed === "Yes") {
    if (!f.workCarriedOutNote?.trim()) base.push("Contractor: work carried out (compliance response)");
    if (!f.signedContractor?.trim()) base.push("Contractor: signed name");
  } else if (f.contractorActed === "No" && !f.contractorActedNote?.trim()) {
    base.push("Note why contractor did not comply (office admin)");
  }
  if (!f.followUpEffective?.trim()) base.push("Follow-up: action effective (Yes/No)");
  if (!f.pursueFurtherCosts?.trim()) base.push("Pursue further action/costs? (Yes/No)");
  if (!f.siteSetupModification?.trim()) base.push("Site set-up modification required? (Yes/No)");
  if (!f.correctiveActionDetail?.trim() && !f.furtherAction?.trim())
    base.push("Action required (close-out)");
  if (!f.actionByWhom?.trim()) base.push("By whom (responsible party)");
  if (!row.actualClosure) base.push("Actual closure date");
  if (!f.actionCompleted?.trim()) base.push("Completed (date or note)");
  return base;
}

export function safetyNcrMissingFields(row: {
  recordType?: string;
  description?: string | null;
  activityTask?: string | null;
  category?: string | null;
  severity?: string | null;
  rootCause?: string | null;
  immediateAction?: string | null;
  longTermAction?: string | null;
  responsibleParty?: string | null;
  targetCompletion?: Date | string | null;
  location?: string | null;
}): string[] {
  if (row.recordType !== "NCR") return [];
  const missing: string[] = [];
  if (!row.activityTask?.trim()) missing.push("Activity / task");
  if (!row.description?.trim()) missing.push("Non-conformity description");
  if (!row.category?.trim()) missing.push("Category");
  if (!row.severity?.trim()) missing.push("Observed risk level");
  if (!row.rootCause?.trim()) missing.push("Root cause");
  if (!row.immediateAction?.trim()) missing.push("Immediate action taken");
  if (!row.longTermAction?.trim()) missing.push("Long-term corrective action");
  if (!row.responsibleParty?.trim()) missing.push("Responsible party");
  if (!row.targetCompletion) missing.push("Target completion date");
  if (!row.location?.trim()) missing.push("Location");
  return missing;
}

function fmtDate(d?: Date | string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}

function formRows(pairs: [string, string][], title: string): (string | number)[][] {
  const rows: (string | number)[][] = [
    ["शरणम् — Sharnam PMC Portal"],
    [title],
    [],
  ];
  for (const [label, val] of pairs) {
    rows.push([label, "", val || "—"]);
  }
  return rows;
}

export function buildQualityNcrXlsxBuffer(
  row: {
    number?: string | null;
    issueDate?: Date | string | null;
    ncrType?: string | null;
    contractor?: string | null;
    description: string;
    location?: string | null;
    plannedClosure?: Date | string | null;
    actualClosure?: Date | string | null;
    status?: string | null;
    formDataJson?: string | null;
  },
  project?: { name?: string; code?: string; clientName?: string | null }
) {
  const f = parseQualityFormData(row.formDataJson);
  const isCar = /^CAR/i.test(row.number || "");
  const pairs: [string, string][] = [
    ["Project", f.projectName || project?.name || project?.code || ""],
    ["NCR / CAR No.", row.number || ""],
    ["Date", fmtDate(row.issueDate)],
    ["To", f.toParty || ""],
    ["From", f.fromParty || ""],
    ["Type", row.ncrType || ""],
    ["Contractor", row.contractor || ""],
    ["Location", row.location || ""],
    ["Action required as result of", f.actionResultOf || f.otherCause || ""],
    ["Environmental issues", f.environmentalIssues || "—"],
    ["Description of problem", row.description],
    ["Action required to rectify", f.actionRequired || ""],
    ["Date by which action must be completed", fmtDate(row.plannedClosure)],
    ["Work carried out note", f.workCarriedOutNote || ""],
    ["Signed (contractor)", f.signedContractor || ""],
    ["Position (contractor)", f.positionContractor || ""],
    ["Follow-up: action effective?", f.followUpEffective || ""],
    ["Signed (reviewer)", f.signedReviewer || ""],
    ["Position (reviewer)", f.positionReviewer || ""],
    ["Further action required", f.furtherAction || ""],
    ["Actual closure date", fmtDate(row.actualClosure)],
    ["Status", row.status || "Open"],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(
    formRows(pairs, isCar ? "Non-Conformance / Corrective Action Request (NCR 01)" : "Non-Conformance Report (NCR 01)")
  );
  ws["!cols"] = [{ wch: 42 }, { wch: 4 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, ws, isCar ? "NCR CAR" : "NCR");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildSafetyNcrXlsxBuffer(
  row: {
    ncrNumber?: string | null;
    title?: string;
    description?: string | null;
    activityTask?: string | null;
    category?: string | null;
    severity?: string | null;
    location?: string | null;
    rootCause?: string | null;
    contributingFactors?: string | null;
    immediateAction?: string | null;
    longTermAction?: string | null;
    responsibleParty?: string | null;
    targetCompletion?: Date | string | null;
    timeImpact?: string | null;
    costImpact?: string | null;
    followUpDate?: Date | string | null;
    status?: string | null;
    issuedTo?: string | null;
    occurredAt?: Date | string | null;
    recordType?: string | null;
    correctiveAction?: string | null;
  },
  project?: { name?: string; code?: string; clientName?: string | null }
) {
  const pairs: [string, string][] = [
    ["Name of project", project?.name || project?.code || ""],
    ["Name of client", project?.clientName || ""],
    ["PMC", "Sharnam Project Development Consultant"],
    ["Vendor / contractor", row.issuedTo || ""],
    ["NCR no.", row.ncrNumber || row.title || ""],
    ["Activity / task", row.activityTask || ""],
    ["Non-conformity description", row.description || ""],
    ["Category", row.category || ""],
    ["Observed risk level", row.severity || ""],
    ["Location", row.location || ""],
    ["Root cause", row.rootCause || ""],
    ["Contributing factors", row.contributingFactors || ""],
    ["Immediate action taken", row.immediateAction || ""],
    ["Long-term corrective action", row.longTermAction || ""],
    ["Responsible party", row.responsibleParty || ""],
    ["Target completion date", fmtDate(row.targetCompletion)],
    ["Time impact", row.timeImpact || ""],
    ["Cost impact", row.costImpact || ""],
    ["Follow-up date", fmtDate(row.followUpDate)],
    ["Date raised", fmtDate(row.occurredAt)],
    ["Status", row.status || "Open"],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(formRows(pairs, "Site Safety Non Conformity Report"));
  ws["!cols"] = [{ wch: 36 }, { wch: 4 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, "NCR");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function resolveNcrTemplatePath(name: string): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT ? path.join(process.env.SHARNAM_EXCEL_ROOT, name) : "",
    path.join(process.cwd(), "apps", "api", "checklist-templates", name),
    path.join(process.cwd(), "checklist-templates", name),
    path.join(process.cwd(), "seed", "data", name),
    path.join(process.cwd(), "Sharnam_modules_docs", name),
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", name),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function setMergedRow(ws: ExcelJS.Worksheet, row: number, value: string) {
  const text = value || "";
  ws.getCell(`A${row}`).value = text;
  try {
    ws.getCell(`B${row}`).value = text;
  } catch {
    /* merged */
  }
}

/** Fill the client's "Site Unsafe Act Report" (Safety NCR.xlsx sheet 2): value cells in column C, tick boxes in C beside options in D. */
function fillUnsafeActSheet(
  ws: ExcelJS.Worksheet,
  row: Parameters<typeof buildSafetyNcrXlsxBuffer>[0],
  project?: Parameters<typeof buildSafetyNcrXlsxBuffer>[1]
) {
  const put = (r: number, v: string) => setSafetyValue(ws, r, v);
  const tick = (from: number, to: number, value: string | null | undefined, fallbackRow?: number) => {
    const want = String(value || "").toLowerCase();
    let hit = false;
    for (let r = from; r <= to; r++) {
      const label = String(ws.getRow(r).getCell(4).value ?? "").toLowerCase();
      const on = !!want && !!label && (want.includes(label.split(":")[0].trim()) || label.includes(want));
      ws.getRow(r).getCell(3).value = on;
      hit ||= on;
    }
    if (!hit && fallbackRow && want) ws.getRow(fallbackRow).getCell(3).value = true;
  };
  put(2, project?.name || project?.code || "");
  put(3, project?.clientName || "");
  put(4, SPDC_PMC_NAME);
  put(5, SPDC_PMC_NAME);
  put(6, row.issuedTo || row.responsibleParty || "");
  put(7, row.ncrNumber || row.title || "");
  tick(10, 15, row.category || row.activityTask, 15);
  put(16, row.description || row.title || "");
  put(17, row.location || "");
  put(19, row.immediateAction || row.correctiveAction || "");
  put(20, row.responsibleParty || "");
  put(21, "");
  put(22, "");
  tick(24, 26, row.severity);
  put(27, [row.timeImpact, row.costImpact].filter(Boolean).join(" · "));
  put(28, row.longTermAction || row.correctiveAction || "");
  put(29, row.responsibleParty || "");
  put(30, fmtDate(row.targetCompletion));
  put(32, fmtDate(row.followUpDate));
  tick(33, 35, row.status || "Open");
}

function setSafetyValue(ws: ExcelJS.Worksheet, row: number, value: string) {
  const text = value || "";
  for (let c = 3; c <= 8; c++) {
    ws.getRow(row).getCell(c).value = text;
  }
}

/** Fill SPDC NCR 01 .xlsx template (Quality Dashboard). */
export async function buildQualityNcrXlsxFromTemplate(
  row: Parameters<typeof buildQualityNcrXlsxBuffer>[0],
  project?: Parameters<typeof buildQualityNcrXlsxBuffer>[1]
): Promise<Buffer> {
  const tpl = resolveNcrTemplatePath("NCR 01 .xlsx");
  if (!tpl) return buildQualityNcrXlsxBuffer(row, project);

  const f = parseQualityFormData(row.formDataJson);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tpl);
  detachSharedStyles(wb);
  const ws = wb.worksheets[0];

  ws.getCell("B3").value = f.projectName || project?.name || project?.code || "";
  ws.getCell("B4").value = row.number || "";
  ws.getCell("B6").value = fmtDate(row.issueDate);
  ws.getCell("B7").value = f.toParty || row.contractor || "";
  ws.getCell("B8").value = f.fromParty || SPDC_PMC_NAME;
  ws.getCell("B11").value = f.environmentalIssues || "—";
  ws.getCell("B12").value = f.otherCause || f.actionResultOf || row.ncrType || "";
  setMergedRow(ws, 14, row.description || "");
  setMergedRow(ws, 16, f.actionRequired || "");
  setMergedRow(
    ws,
    17,
    `Date by which action must be completed: ${fmtDate(row.plannedClosure)}${row.location ? `\nLocation: ${row.location}` : ""}`
  );
  setMergedRow(ws, 18, f.workCarriedOutNote || "");
  setMergedRow(
    ws,
    19,
    `Signed: ${f.signedContractor || ""}    Position: ${f.positionContractor || ""}    Date: ${fmtDate(row.issueDate)}`
  );
  const effective =
    f.followUpEffective === "Yes" ? "Yes" : f.followUpEffective === "No" ? "No" : "";
  setMergedRow(ws, 21, `Has the Action taken been effective?        ${effective}         No  (If No, a new Notice may be required)`);
  setMergedRow(
    ws,
    23,
    `Signed: ${f.signedReviewer || ""}    Position: ${f.positionReviewer || ""}    Date: ${fmtDate(row.actualClosure || row.plannedClosure)}`
  );
  const pursueYes = f.pursueFurtherCosts === "Yes" ? "Yes" : f.pursueFurtherCosts === "No" ? "No" : "";
  setMergedRow(
    ws,
    25,
    `Should further action and/or costs be pursued against the company on which this notice is served?  ${pursueYes}    

(If YES, then send a copy of this notice to the Project Manager for further action).`
  );
  const siteMod = f.siteSetupModification === "Yes" ? "Yes" : f.siteSetupModification === "No" ? "No" : "";
  setMergedRow(ws, 26, `Does the Project Site Set Up System require modification to prevent a recurrence?       ${siteMod}`);
  const actionDetail = f.correctiveActionDetail || f.furtherAction || "";
  if (actionDetail) setMergedRow(ws, 27, `Action required:\n${actionDetail}`);
  ws.getCell("A31").value = f.actionByWhom ? `By Whom: ${f.actionByWhom}` : "By Whom:";
  ws.getCell("B31").value =
    f.actionCompleted || (row.status === "Closed" ? fmtDate(row.actualClosure) : "") || "Completed:";

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellText(ws: ExcelJS.Worksheet, addr: string): string {
  const v = ws.getCell(addr).value;
  if (v == null) return "";
  if (typeof v === "object" && v && "text" in v) return String((v as { text?: string }).text || "").trim();
  if (typeof v === "object" && v && "result" in v) return String((v as { result?: unknown }).result ?? "").trim();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function rowText(ws: ExcelJS.Worksheet, row: number): string {
  const a = cellText(ws, `A${row}`);
  const b = cellText(ws, `B${row}`);
  if (a && b && a !== b) return `${a}\n${b}`.trim();
  return (a || b).trim();
}

function parseSignedLine(line: string): { signed?: string; position?: string } {
  const signed = line.match(/Signed:\s*(.+?)(?:\s{2,}|\s+Position:|$)/i)?.[1]?.trim();
  const position = line.match(/Position:\s*(.+?)(?:\s{2,}|\s+Date:|$)/i)?.[1]?.trim();
  return {
    signed: signed && !/^_{2,}$/.test(signed) ? signed : undefined,
    position: position && !/^_{2,}$/.test(position) ? position : undefined,
  };
}

function yesNoFromText(text: string): string {
  if (/\bYes\b/i.test(text) && !/\bNo\b/i.test(text.replace(/\(If No[^)]*\)/i, ""))) return "Yes";
  if (/\bYes\b/i.test(text) && /\bNo\b/i.test(text)) {
    // Prefer explicit Yes when both appear in template wording — look for selected token after ?
    const after = text.split("?")[1] || text;
    if (/Yes\s*$/i.test(after.trim()) || /been effective\?\s*Yes/i.test(text)) return "Yes";
    if (/No\s*$/i.test(after.trim()) || /been effective\?\s*No/i.test(text)) return "No";
  }
  if (/\bNo\b/i.test(text) && !/\bYes\b/i.test(text.replace(/\(If YES[^)]*\)/i, ""))) return "No";
  return "";
}

function extractIsoDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const dmy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const named = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/i);
  if (named) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mm = months[named[2].slice(0, 3).toLowerCase()];
    if (mm) return `${named[3]}-${mm}-${named[1].padStart(2, "0")}`;
  }
  return null;
}

/** Parse a filled NCR 01.xlsx (NCR CAR sheet) back into register + form fields. */
export async function parseQualityNcrFilledXlsx(buf: Buffer): Promise<{
  description?: string;
  contractor?: string;
  location?: string;
  ncrType?: string;
  issueDate?: string;
  plannedClosure?: string | null;
  formPatch: Partial<QualityNcrFormData>;
}> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  detachSharedStyles(wb);
  const ws = wb.getWorksheet("NCR CAR") || wb.worksheets[0];
  if (!ws) throw new Error("No worksheet found in uploaded NCR / CAR file");

  const toParty = cellText(ws, "B7");
  const fromParty = cellText(ws, "B8");
  const environmentalIssues = cellText(ws, "B11");
  const otherCause = cellText(ws, "B12");
  const description = rowText(ws, 14);
  const actionRequired = rowText(ws, 16).replace(/^Action Required[^\n]*\n?/i, "").trim() || rowText(ws, 16);
  const plannedLine = rowText(ws, 17);
  const plannedClosure = extractIsoDate(plannedLine);
  const locationMatch = plannedLine.match(/Location:\s*(.+)$/im);
  const workCarriedOutNote = rowText(ws, 18);
  const signedLine = rowText(ws, 19);
  const signed = parseSignedLine(signedLine);
  const followLine = rowText(ws, 21);
  const followUpEffective = yesNoFromText(followLine);
  const reviewerLine = rowText(ws, 23);
  const reviewer = parseSignedLine(reviewerLine);
  const pursueLine = rowText(ws, 25);
  const pursueFurtherCosts = yesNoFromText(pursueLine);
  const siteLine = rowText(ws, 26);
  const siteSetupModification = yesNoFromText(siteLine);
  const actionBlock = rowText(ws, 27).replace(/^Action required:\s*/i, "").trim();
  const byWhomRaw = cellText(ws, "A31").replace(/^By Whom:\s*/i, "").trim();
  const completedRaw = cellText(ws, "B31").replace(/^Completed:\s*/i, "").trim();
  const issueRaw = cellText(ws, "B6");
  const issueDate = /^\d{4}-\d{2}-\d{2}/.test(issueRaw)
    ? issueRaw.slice(0, 10)
    : extractIsoDate(issueRaw) || undefined;

  return {
    description: description || undefined,
    contractor: toParty || undefined,
    location: locationMatch?.[1]?.trim() || undefined,
    ncrType: otherCause || undefined,
    issueDate,
    plannedClosure: plannedClosure || null,
    formPatch: {
      projectName: cellText(ws, "B3") || undefined,
      toParty: toParty || undefined,
      fromParty: fromParty || undefined,
      environmentalIssues: environmentalIssues || undefined,
      otherCause: otherCause || undefined,
      actionRequired: actionRequired || undefined,
      workCarriedOutNote: workCarriedOutNote || undefined,
      signedContractor: signed.signed,
      positionContractor: signed.position,
      followUpEffective: followUpEffective || undefined,
      signedReviewer: reviewer.signed,
      positionReviewer: reviewer.position,
      pursueFurtherCosts: pursueFurtherCosts || undefined,
      siteSetupModification: siteSetupModification || undefined,
      correctiveActionDetail: actionBlock || undefined,
      actionByWhom: byWhomRaw || undefined,
      actionCompleted: completedRaw && completedRaw !== "Completed:" ? completedRaw : undefined,
    },
  };
}

/** Fill SPDC Safety NCR.xlsx template. */
export async function buildSafetyNcrXlsxFromTemplate(
  row: Parameters<typeof buildSafetyNcrXlsxBuffer>[0],
  project?: Parameters<typeof buildSafetyNcrXlsxBuffer>[1]
): Promise<Buffer> {
  const tpl = resolveNcrTemplatePath("Safety NCR.xlsx");
  if (!tpl) return buildSafetyNcrXlsxBuffer(row, project);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tpl);
  detachSharedStyles(wb);
  // The template carries two forms: NCR (sheet 1) and "Observation - Unsafe Act" (sheet 2, with the client's
  // sample report filled in). Keep only the form this record is, so no sample text reaches the export.
  const unsafeSheet = wb.worksheets.find((w) => /unsafe/i.test(w.name));
  if (unsafeSheet && /unsafe|observation/i.test(row.recordType || "")) {
    fillUnsafeActSheet(unsafeSheet, row, project);
    for (const w of [...wb.worksheets]) if (w !== unsafeSheet) wb.removeWorksheet(w.id);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  if (unsafeSheet) wb.removeWorksheet(unsafeSheet.id);
  const ws = wb.worksheets[0];

  setSafetyValue(ws, 2, project?.name || project?.code || "");
  setSafetyValue(ws, 3, project?.clientName || "");
  setSafetyValue(ws, 4, SPDC_PMC_NAME);
  setSafetyValue(ws, 5, SPDC_PMC_NAME);
  setSafetyValue(ws, 6, row.issuedTo || row.responsibleParty || "");
  setSafetyValue(ws, 7, row.ncrNumber || row.title || "");
  setSafetyValue(ws, 9, row.activityTask || "");
  setSafetyValue(ws, 10, row.description || "");
  setSafetyValue(ws, 11, row.category || "");
  setSafetyValue(ws, 12, row.severity || "");
  setSafetyValue(ws, 16, row.rootCause || "");
  setSafetyValue(ws, 17, row.contributingFactors || "");
  setSafetyValue(ws, 19, row.immediateAction || "");
  setSafetyValue(ws, 20, row.longTermAction || "");
  setSafetyValue(ws, 21, row.responsibleParty || "");
  setSafetyValue(ws, 22, fmtDate(row.targetCompletion));
  setSafetyValue(ws, 24, row.timeImpact || "");
  setSafetyValue(ws, 25, row.costImpact || "");
  setSafetyValue(ws, 27, fmtDate(row.followUpDate));
  setSafetyValue(ws, 28, row.status || "Open");

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ncrHtmlShell(
  title: string,
  logoUrl: string,
  bodyRows: [string, string][],
  status: string,
  meta?: { projectName?: string; clientName?: string; docNo?: string }
) {
  const projectLine = meta?.projectName ? escapeHtml(meta.projectName) : "";
  const clientLine = meta?.clientName ? escapeHtml(meta.clientName) : "";
  const docNo = escapeHtml(meta?.docNo || "SPDC/QA/NCR-01");
  const rows = bodyRows
    .map(
      ([k, v]) =>
        `<tr><th style="text-align:left;padding:8px;border:1px solid #ccc;background:#f2f2f2;width:34%">${escapeHtml(k)}</th><td style="padding:8px;border:1px solid #ccc;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>@media print{body{margin:12mm}.no-print{display:none}} body{font-family:"Segoe UI",system-ui,sans-serif;color:#1a1a1a;padding:28px;max-width:920px;margin:0 auto}
.band{background:#1e3a5f;color:#fff;padding:10px 14px;font-size:11px;letter-spacing:.04em;margin:-28px -28px 18px}
.header{display:flex;align-items:flex-start;gap:16px;border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:18px}
.meta{font-size:12px;color:#334155;line-height:1.45;margin-top:6px}
.badge{display:inline-block;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:700;background:${status === "Closed" ? "#c6efce" : "#fff2cc"};color:#1a1a1a}
table{width:100%;border-collapse:collapse;font-size:13px}
th{width:32%;background:#eef2f7;color:#1e3a5f;font-weight:600}
.foot{margin-top:28px;padding-top:12px;border-top:1px solid #cbd5e1;font-size:10px;color:#64748b}</style></head><body>
<div class="band">शरणम् · ${escapeHtml(SPDC_PMC_NAME)} · Doc ${docNo}</div>
<div class="header"><img src="${escapeHtml(logoUrl)}" alt="Sharnam" height="52"/><div>
<h1 style="margin:0;font-size:20px;color:#1e3a5f">${escapeHtml(title)}</h1>
<div class="meta">${projectLine ? `<div><strong>Project:</strong> ${projectLine}</div>` : ""}${clientLine ? `<div><strong>Client:</strong> ${clientLine}</div>` : ""}<div><strong>PMC:</strong> ${escapeHtml(SPDC_PMC_NAME)}</div></div>
<span class="badge" style="margin-top:8px">${escapeHtml(status)}</span>
</div></div>
<table>${rows}</table>
<p class="foot">${escapeHtml(SPDC_OFFICE_FOOTER)} · Branded NCR 01 from Sharnam portal · Print → Save as PDF</p>
</body></html>`;
}

export function buildQualityNcrHtml(
  row: Parameters<typeof buildQualityNcrXlsxBuffer>[0],
  project?: Parameters<typeof buildQualityNcrXlsxBuffer>[1],
  logoUrl = "/logo-transparent.png"
) {
  const f = parseQualityFormData(row.formDataJson);
  const pairs: [string, string][] = [
    ["Project", f.projectName || project?.name || project?.code || ""],
    ["NCR / CAR No.", row.number || ""],
    ["Date", fmtDate(row.issueDate)],
    ["To", f.toParty || ""],
    ["From", f.fromParty || SPDC_PMC_NAME],
    ["Type", row.ncrType || ""],
    ["Contractor", row.contractor || ""],
    ["Location", row.location || ""],
    ["Description", row.description],
    ["Action required", f.actionRequired || ""],
    ["Planned closure", fmtDate(row.plannedClosure)],
    ["Work carried out", f.workCarriedOutNote || ""],
    ["Follow-up effective", f.followUpEffective || ""],
    ["Pursue further costs?", f.pursueFurtherCosts || ""],
    ["Site set-up modification?", f.siteSetupModification || ""],
    ["Action required (close-out)", f.correctiveActionDetail || f.furtherAction || ""],
    ["By whom", f.actionByWhom || ""],
    ["Completed", f.actionCompleted || ""],
    ["Actual closure", fmtDate(row.actualClosure)],
    ["Status", row.status || "Open"],
  ];
  const isCar = /^CAR/i.test(row.number || "");
  const title = isCar ? "Corrective Action Request (NCR 01)" : "Non-Conformance Report (NCR 01)";
  return ncrHtmlShell(title, logoUrl, pairs, row.status || "Open", {
    projectName: f.projectName || project?.name || project?.code || "",
    clientName: project?.clientName || "",
    docNo: isCar ? "SPDC/QA/CAR-01" : "SPDC/QA/NCR-01",
  });
}

export function buildSafetyNcrHtml(
  row: Parameters<typeof buildSafetyNcrXlsxBuffer>[0],
  project?: Parameters<typeof buildSafetyNcrXlsxBuffer>[1],
  logoUrl = "/logo-transparent.png"
) {
  const pairs: [string, string][] = [
    ["Project", project?.name || project?.code || ""],
    ["Client", project?.clientName || ""],
    ["PMC", SPDC_PMC_NAME],
    ["NCR No.", row.ncrNumber || row.title || ""],
    ["Activity / task", row.activityTask || ""],
    ["Description", row.description || ""],
    ["Category", row.category || ""],
    ["Risk level", row.severity || ""],
    ["Location", row.location || ""],
    ["Root cause", row.rootCause || ""],
    ["Immediate action", row.immediateAction || ""],
    ["Long-term action", row.longTermAction || ""],
    ["Responsible party", row.responsibleParty || ""],
    ["Target completion", fmtDate(row.targetCompletion)],
    ["Status", row.status || "Open"],
  ];
  return ncrHtmlShell("Site Safety Non Conformity Report", logoUrl, pairs, row.status || "Open", {
    projectName: project?.name || project?.code || "",
    clientName: project?.clientName || "",
    docNo: "SPDC/HSE/NCR-01",
  });
}

type QualityNcrRow = Parameters<typeof buildQualityNcrXlsxBuffer>[0];
type QualityNcrProject = Parameters<typeof buildQualityNcrXlsxBuffer>[1];

/** Branded A4 PDF for Quality NCR / CAR (SPDC NCR 01). */
export async function buildQualityNcrPdf(row: QualityNcrRow, project?: QualityNcrProject): Promise<Buffer> {
  const f = parseQualityFormData(row.formDataJson);
  const isCar = /^CAR/i.test(row.number || "");
  const title = isCar ? "Corrective Action Request (NCR 01)" : "Non-Conformance Report (NCR 01)";
  const pairs: [string, string][] = [
    ["Project", f.projectName || project?.name || project?.code || ""],
    ["Client", project?.clientName || ""],
    ["PMC", SPDC_PMC_NAME],
    ["NCR / CAR No.", row.number || ""],
    ["Date", fmtDate(row.issueDate)],
    ["To", f.toParty || ""],
    ["From", f.fromParty || SPDC_PMC_NAME],
    ["Type", row.ncrType || ""],
    ["Contractor", row.contractor || ""],
    ["Location", row.location || ""],
    ["Description", row.description || ""],
    ["Action required", f.actionRequired || ""],
    ["Planned closure", fmtDate(row.plannedClosure)],
    ["Work carried out", f.workCarriedOutNote || ""],
    ["Follow-up effective", f.followUpEffective || ""],
    ["Pursue further costs?", f.pursueFurtherCosts || ""],
    ["Site set-up modification?", f.siteSetupModification || ""],
    ["Close-out action", f.correctiveActionDetail || f.furtherAction || ""],
    ["By whom", f.actionByWhom || ""],
    ["Completed", f.actionCompleted || ""],
    ["Actual closure", fmtDate(row.actualClosure)],
    ["Status", row.status || "Open"],
  ];
  return renderNcrPdf({
    title,
    docNo: isCar ? "SPDC/QA/CAR-01" : "SPDC/QA/NCR-01",
    status: row.status || "Open",
    pairs,
  });
}

export async function buildSafetyNcrPdf(
  row: Parameters<typeof buildSafetyNcrXlsxBuffer>[0],
  project?: Parameters<typeof buildSafetyNcrXlsxBuffer>[1]
): Promise<Buffer> {
  const pairs: [string, string][] = [
    ["Project", project?.name || project?.code || ""],
    ["Client", project?.clientName || ""],
    ["PMC", SPDC_PMC_NAME],
    ["NCR No.", row.ncrNumber || row.title || ""],
    ["Activity / task", row.activityTask || ""],
    ["Description", row.description || ""],
    ["Category", row.category || ""],
    ["Risk level", row.severity || ""],
    ["Location", row.location || ""],
    ["Root cause", row.rootCause || ""],
    ["Immediate action", row.immediateAction || ""],
    ["Long-term action", row.longTermAction || ""],
    ["Responsible party", row.responsibleParty || ""],
    ["Target completion", fmtDate(row.targetCompletion)],
    ["Status", row.status || "Open"],
  ];
  return renderNcrPdf({
    title: "Site Safety Non Conformity Report",
    docNo: "SPDC/HSE/NCR-01",
    status: row.status || "Open",
    pairs,
  });
}

async function renderNcrPdf(opts: {
  title: string;
  docNo: string;
  status: string;
  pairs: [string, string][];
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: { Title: opts.title, Author: SPDC_PMC_NAME },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    doc.rect(0, 0, pageW, 36).fill("#1e3a5f");
    doc.fillColor("#ffffff").font("Helvetica").fontSize(9);
    doc.text(`शरणम् · ${SPDC_PMC_NAME} · ${opts.docNo}`, 48, 12, { width: pageW - 96 });

    let y = 52;
    const logo = sharnamLogoPath();
    if (logo) {
      try {
        doc.image(logo, 48, y, { fit: [120, 40] });
      } catch {
        /* optional */
      }
    }
    doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(14);
    doc.text(opts.title, 180, y + 4, { width: pageW - 228 });
    doc.font("Helvetica").fontSize(10).fillColor("#334155");
    doc.text(`Status: ${opts.status}`, 180, y + 24, { width: pageW - 228 });
    y = 110;
    doc.moveTo(48, y).lineTo(pageW - 48, y).strokeColor("#1e3a5f").lineWidth(2).stroke();
    y += 14;

    for (const [label, value] of opts.pairs) {
      if (!String(value || "").trim()) continue;
      const text = String(value);
      const h = Math.max(22, doc.heightOfString(text, { width: pageW - 220 }) + 10);
      if (y + h > doc.page.height - 64) {
        doc.addPage();
        y = 48;
      }
      doc.rect(48, y, pageW - 96, h).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
      doc.fillColor("#1e3a5f").font("Helvetica-Bold").fontSize(9);
      doc.text(label, 54, y + 6, { width: 150 });
      doc.fillColor("#1a1a1a").font("Helvetica").fontSize(9);
      doc.text(text, 210, y + 6, { width: pageW - 270 });
      y += h;
    }

    doc.fillColor("#64748b").font("Helvetica").fontSize(8);
    doc.text(SPDC_OFFICE_FOOTER, 48, doc.page.height - 40, { width: pageW - 96, align: "center" });
    doc.end();
  });
}
