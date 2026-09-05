/** NCR / CAR form validation and branded Excel export (Safety NCR.xlsx · NCR 01 .xlsx layouts). */
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import XLSX from "../lib/xlsx.js";

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
  const ws = wb.worksheets[0];

  ws.getCell("B3").value = f.projectName || project?.name || project?.code || "";
  ws.getCell("B4").value = row.number || "";
  ws.getCell("B6").value = fmtDate(row.issueDate);
  ws.getCell("B7").value = f.toParty || row.contractor || "";
  ws.getCell("B8").value = f.fromParty || "Sharnam Project Development Consultant";
  ws.getCell("B11").value = f.environmentalIssues || "—";
  ws.getCell("B12").value = row.ncrType || f.otherCause || f.actionResultOf || "";
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

/** Fill SPDC Safety NCR.xlsx template. */
export async function buildSafetyNcrXlsxFromTemplate(
  row: Parameters<typeof buildSafetyNcrXlsxBuffer>[0],
  project?: Parameters<typeof buildSafetyNcrXlsxBuffer>[1]
): Promise<Buffer> {
  const tpl = resolveNcrTemplatePath("Safety NCR.xlsx");
  if (!tpl) return buildSafetyNcrXlsxBuffer(row, project);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tpl);
  const ws = wb.worksheets[0];

  setSafetyValue(ws, 2, project?.name || project?.code || "");
  setSafetyValue(ws, 3, project?.clientName || "");
  setSafetyValue(ws, 4, "Sharnam Project Development Consultant");
  setSafetyValue(ws, 5, "Sharnam Project Development Consultant");
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

function ncrHtmlShell(title: string, logoUrl: string, bodyRows: [string, string][], status: string) {
  const rows = bodyRows
    .map(
      ([k, v]) =>
        `<tr><th style="text-align:left;padding:8px;border:1px solid #ccc;background:#f2f2f2;width:34%">${escapeHtml(k)}</th><td style="padding:8px;border:1px solid #ccc;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>@media print{body{margin:0}} body{font-family:system-ui,sans-serif;color:#1a1a1a;padding:24px;max-width:920px;margin:0 auto}
.header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1F3864;padding-bottom:12px;margin-bottom:20px}
.badge{display:inline-block;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:700;background:${status === "Closed" ? "#c6efce" : "#fff2cc"};color:#1a1a1a}
table{width:100%;border-collapse:collapse;font-size:13px}</style></head><body>
<div class="header"><img src="${escapeHtml(logoUrl)}" alt="Sharnam" height="48"/><div><div style="font-size:11px;color:#666">शरणम् · Sharnam PMC Portal</div><h1 style="margin:4px 0 0;font-size:20px">${escapeHtml(title)}</h1><span class="badge">${escapeHtml(status)}</span></div></div>
<table>${rows}</table>
<p style="margin-top:24px;font-size:11px;color:#666">Generated from Sharnam portal · use browser Print → Save as PDF</p>
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
    ["From", f.fromParty || "Sharnam PMC"],
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
  const title = /^CAR/i.test(row.number || "") ? "Corrective Action Request (NCR 01)" : "Non-Conformance Report (NCR 01)";
  return ncrHtmlShell(title, logoUrl, pairs, row.status || "Open");
}

export function buildSafetyNcrHtml(
  row: Parameters<typeof buildSafetyNcrXlsxBuffer>[0],
  project?: Parameters<typeof buildSafetyNcrXlsxBuffer>[1],
  logoUrl = "/logo-transparent.png"
) {
  const pairs: [string, string][] = [
    ["Project", project?.name || project?.code || ""],
    ["Client", project?.clientName || ""],
    ["PMC", "Sharnam Project Development Consultant"],
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
  return ncrHtmlShell("Site Safety Non Conformity Report", logoUrl, pairs, row.status || "Open");
}
