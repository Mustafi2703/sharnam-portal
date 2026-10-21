/** F-01 quality IR rules shared by the API and the register. */

export const QUALITY_DECLARATIONS: { key: string; text: string }[] = [
  { key: "declA", text: "a) Work is complete in all respects and ready for inspection as per approved drawings and specifications." },
  { key: "declB", text: "b) Preceding activity / stage has been inspected and cleared (previous IR no. quoted above where applicable)." },
  { key: "declC", text: "c) Self-check carried out and signed pre-inspection checklist (Annexure) is enclosed." },
  { key: "declD", text: "d) Materials used are from approved sources; MTCs / test reports are available at site." },
  { key: "declE", text: "e) Calibrated instruments, levels, access, lighting and measuring tapes are available at the point of inspection." },
  { key: "declF", text: "f) Area is safe for inspection - barricading, edge protection, scaffold tags and PTW are in place." },
  { key: "declG", text: "g) Housekeeping completed; area cleared of debris, shuttering material and loose items." },
];

export const QUALITY_ENCLOSURE_OPTIONS = [
  "Checklist",
  "Pour Card",
  "Test Reports",
  "Survey / Level Sheet",
  "MTC",
  "Calibration Cert.",
  "Photographs",
  "Other",
] as const;

export const QUALITY_RESULTS = [
  { code: "A", label: "A - APPROVED, may proceed" },
  { code: "B", label: "B - APPROVED WITH OBSERVATIONS, proceed and rectify" },
  { code: "C", label: "C - REJECTED, rectify and re-offer" },
  { code: "D", label: "D - NOT INSPECTED / DEFERRED" },
] as const;

export type QualityResultCode = "A" | "B" | "C" | "D";

export const SAFETY_FORM_PATCH_KEYS = [
  "clearanceResult",
  "validUpTo",
  "actionRequired",
  "riskRating",
  "clearanceSoughtFrom",
  "inspectedBy",
  "inspectedAt",
] as const;

export const QUALITY_CONTRACTOR_PATCH_KEYS = [
  "declA",
  "declB",
  "declC",
  "declD",
  "declE",
  "declF",
  "declG",
  "enclosures",
  "enclosuresOther",
  "raisedBy",
  "raisedAt",
  "verifiedBy",
  "verifiedAt",
  "elementOrLot",
  "source",
  "actionTaken",
  "shortNoticeReason",
  "waivers",
  "onBehalf",
  "onBehalfReason",
  "unlinkedReason",
] as const;

export const QUALITY_SPDC_PATCH_KEYS = [
  "inspectedOn",
  "result",
  "ncrNo",
  "ncrId",
  "reinspectionBy",
  "observations",
  "inspectedBy",
  "inspectedAt",
  "thirdPartyBy",
  "thirdPartyAt",
  "closedBy",
  "closedAt",
  "waivers",
] as const;

export const QUALITY_CLIENT_PATCH_KEYS = ["witnessedBy", "witnessedAt"] as const;

export function irTypeForPmcRole(pmcRole: string | null | undefined): "Document review" | "Site inspection" {
  return /\breview\b/i.test(String(pmcRole || "")) ? "Document review" : "Site inspection";
}

export function clientSignoffRequired(clientRole: string | null | undefined): boolean {
  const t = String(clientRole || "");
  if (/\b(witness|approve)\b/i.test(t)) return true;
  return false;
}

export function isHoldOrThirdParty(line: { pmcRole?: string | null; testAgency?: string | null }): boolean {
  if (/\b(witness|hold)\b/i.test(String(line.pmcRole || ""))) return true;
  return /third|external|nabl|statutory/i.test(String(line.testAgency || ""));
}

/** Hours of notice required. 0 means the check does not apply (document review). */
export function noticeHours(line: { pmcRole?: string | null; testAgency?: string | null; irType?: string | null }): number {
  if (/\breview\b/i.test(String(line.pmcRole || "")) || /document/i.test(String(line.irType || ""))) return 0;
  return isHoldOrThirdParty(line) ? 48 : 24;
}

export function truthyFlag(value: unknown): boolean {
  return value === true || value === "true" || value === "yes" || value === "X" || value === "x" || value === 1;
}

export function declarationsComplete(form: Record<string, unknown>): boolean {
  return QUALITY_DECLARATIONS.every((d) => truthyFlag(form[d.key]));
}

export type QualityResultDecision = { status: string; closed: boolean; final: boolean };

export function statusForQualityResult(opts: {
  result: QualityResultCode;
  clientRequired: boolean;
  clientSigned: boolean;
  section5Closed: boolean;
  openNcr: boolean;
}): QualityResultDecision {
  if (opts.result === "D") return { status: "Deferred", closed: false, final: false };
  if (opts.result === "C") return { status: "Rejected", closed: false, final: false };
  if (opts.openNcr && opts.result === "A") {
    return { status: "Awaiting NCR closure", closed: false, final: false };
  }
  if (opts.clientRequired && !opts.clientSigned && (opts.result === "A" || opts.result === "B")) {
    return { status: "Awaiting client", closed: false, final: false };
  }
  if (opts.result === "A") return { status: "Approved", closed: true, final: true };
  if (!opts.section5Closed) return { status: "Approved - observations open", closed: false, final: false };
  if (opts.openNcr) return { status: "Awaiting NCR closure", closed: false, final: false };
  return { status: "Approved", closed: true, final: true };
}

export function resultCode(value: unknown): QualityResultCode | null {
  const c = String(value || "").trim().charAt(0).toUpperCase();
  return c === "A" || c === "B" || c === "C" || c === "D" ? c : null;
}
