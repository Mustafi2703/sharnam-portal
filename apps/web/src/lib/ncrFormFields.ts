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
  /** NCR 01 close-out — pursue further costs against contractor */
  pursueFurtherCosts?: string;
  /** Site set-up system modification required? */
  siteSetupModification?: string;
  /** Action required (close-out section) */
  correctiveActionDetail?: string;
  actionByWhom?: string;
  actionCompleted?: string;
  contractorVendorId?: string;
  contractorEmail?: string;
  /** Office admin: contractor complied with notice? */
  contractorActed?: string;
  contractorActedAt?: string;
  contractorActedNote?: string;
  followUpCount?: string;
  lastFollowUpAt?: string;
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

export function ncrComplianceSummary(formDataJson?: string | null): {
  label: string;
  tone: "ok" | "warn" | "danger" | "neutral";
  followUpCount: number;
} {
  const f = parseFormData<QualityNcrFormData>(formDataJson);
  const followUpCount = Number(f.followUpCount || 0);
  if (f.contractorActed === "Yes") return { label: "Complied", tone: "ok", followUpCount };
  if (f.contractorActed === "No") return { label: "Not complied", tone: "danger", followUpCount };
  return { label: "Pending", tone: followUpCount > 0 ? "warn" : "neutral", followUpCount };
}

export function openNcrFormWindow(projectId: string, scope: "quality" | "safety", recordId: string) {
  const url = `/projects/${projectId}/ncr-form/${scope}/${recordId}`;
  window.open(url, `ncr-${recordId}`, "width=980,height=860,scrollbars=yes,resizable=yes");
}

/** Open branded NCR HTML for Print → Save as PDF */
export async function openNcrPrintPdf(
  path: string,
  token: string | null,
  filename = "NCR.html"
) {
  const API_BASE = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Print failed"));
  const html = await res.text();
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const w = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (w) {
    w.addEventListener("load", () => {
      try {
        w.print();
      } catch {
        /* manual */
      }
    });
  }
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
