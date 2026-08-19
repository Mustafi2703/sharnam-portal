/** NCR / CAR form validation and branded Excel export (Safety NCR.xlsx · NCR 01 .xlsx layouts). */
import fs from "fs";
import path from "path";
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
  if (!f.followUpEffective?.trim()) base.push("Follow-up: action effective (Yes/No)");
  if (!row.actualClosure) base.push("Actual closure date");
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
    path.join(process.cwd(), "seed", "data", name),
    path.join(process.cwd(), "Sharnam_modules_docs", name),
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", name),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
