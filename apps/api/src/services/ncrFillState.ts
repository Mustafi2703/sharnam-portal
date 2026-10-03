/**
 * NCR / CAR fill-state helpers (Draft / Open / Closed) — mirrors checklist fill log.
 */
import {
  qualityNcrCloseMissingFields,
  qualityNcrMissingFields,
  type QualityNcrFormData,
} from "./ncrFormExport.js";

export type NcrFillPhase = "Draft" | "Open" | "Closed";

export function ncrFillPhase(row: {
  status?: string | null;
  description?: string;
  contractor?: string | null;
  location?: string | null;
  ncrType?: string | null;
  plannedClosure?: Date | string | null;
  actualClosure?: Date | string | null;
  formDataJson?: string | null;
}): NcrFillPhase {
  if (/close/i.test(row.status || "")) return "Closed";
  // Basics incomplete → Draft (SharePoint Drafts/). Once raise fields are filled → Open/.
  const baseMissing = qualityNcrMissingFields(row);
  if (baseMissing.length) return "Draft";
  return "Open";
}

export function ncrFillProgress(row: {
  status?: string | null;
  description?: string;
  contractor?: string | null;
  location?: string | null;
  ncrType?: string | null;
  plannedClosure?: Date | string | null;
  actualClosure?: Date | string | null;
  formDataJson?: string | null;
}): {
  phase: NcrFillPhase;
  missing: string[];
  answered: number;
  total: number;
  pct: number;
  label: string;
} {
  const phase = ncrFillPhase(row);
  const checklist = [
    "Description of non-conformance",
    "Contractor",
    "Location",
    "Type",
    "Action required to rectify",
    "Planned closure date",
    "Contractor: work carried out (compliance response)",
    "Contractor: signed name",
    "Follow-up: action effective (Yes/No)",
    "Pursue further action/costs? (Yes/No)",
    "Site set-up modification required? (Yes/No)",
    "Action required (close-out)",
    "By whom (responsible party)",
    "Actual closure date",
    "Completed (date or note)",
    "Contractor compliance — mark Acted / Not acted (office admin)",
  ];
  const missing =
    phase === "Closed"
      ? []
      : phase === "Draft" && qualityNcrMissingFields(row).length
        ? qualityNcrMissingFields(row)
        : qualityNcrCloseMissingFields(row);
  const total = checklist.length;
  const answered = Math.max(0, total - missing.length);
  const pct = Math.round((answered / total) * 100);
  return {
    phase,
    missing,
    answered,
    total,
    pct,
    label: `${answered}/${total} fields`,
  };
}

export function sharePointStatusFolder(phase: NcrFillPhase): "Drafts" | "Open" | "Closed" {
  if (phase === "Closed") return "Closed";
  if (phase === "Draft") return "Drafts";
  return "Open";
}

export function parseFormStrings(raw?: string | null): QualityNcrFormData {
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    return typeof p === "object" && p ? (p as QualityNcrFormData) : {};
  } catch {
    return {};
  }
}
