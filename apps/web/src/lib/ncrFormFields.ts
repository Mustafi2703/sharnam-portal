/** NCR / CAR form field helpers (mirrors API ncrFormExport validation). */

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

export function parseFormData<T extends Record<string, string>>(raw?: string | null): T {
  if (!raw) return {} as T;
  try {
    const p = JSON.parse(raw);
    return typeof p === "object" && p ? p : ({} as T);
  } catch {
    return {} as T;
  }
}

export function qualityNcrMissingFields(row: {
  description?: string;
  contractor?: string | null;
  location?: string | null;
  ncrType?: string | null;
  plannedClosure?: string | null;
  formDataJson?: string | null;
}): string[] {
  const f = parseFormData<QualityNcrFormData>(row.formDataJson);
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
  plannedClosure?: string | null;
  actualClosure?: string | null;
  formDataJson?: string | null;
}): string[] {
  const base = qualityNcrMissingFields(row);
  const f = parseFormData<QualityNcrFormData>(row.formDataJson);
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
  targetCompletion?: string | null;
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

export function openNcrFormWindow(projectId: string, scope: "quality" | "safety", recordId: string) {
  const url = `/projects/${projectId}/ncr-form/${scope}/${recordId}`;
  window.open(url, `ncr-${recordId}`, "width=980,height=860,scrollbars=yes,resizable=yes");
}
