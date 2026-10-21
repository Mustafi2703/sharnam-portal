/** Checks that stop a letter preview when the dates, pay, or promotion would print something untrue. */

function day(value: unknown): string {
  const raw = String(value ?? "").trim();
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : "";
}

function money(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** `letterDate` is the date printed on the letter (YYYY-MM-DD). Backdated letters for existing staff use that date, not today. */
export function hrLetterIssues(kind: string, data: Record<string, unknown>, letterDate: string): string[] {
  const issues: string[] = [];
  const joining = day(data.joinDate || data.joiningDate || (!["Relieving", "Experience", "Exit", "AssetReturn", "NdaPostEmployment"].includes(kind) ? data.effectiveDate : ""));
  const leaving = day(data.lastWorkingDate || (["Relieving", "Experience", "Exit", "NdaPostEmployment"].includes(kind) ? data.effectiveDate : ""));
  const signatory = String(data.signatoryName || "").trim();
  const employee = String(data.employeeName || data.candidateName || "").trim();

  if ((kind === "Offer" || kind === "Appointment") && day(data.offerDate) && day(data.effectiveDate) && day(data.offerDate) > day(data.effectiveDate)) {
    issues.push("Offer date cannot be after the joining date.");
  }
  if (kind === "Offer" && day(data.applicationDate) && day(data.applicationDate) > letterDate) {
    issues.push("Application date cannot be after the date printed on the letter.");
  }
  if ((kind === "Offer" || kind === "Appointment") && day(data.acceptanceDate) && day(data.effectiveDate) && day(data.acceptanceDate) > day(data.effectiveDate)) {
    issues.push("Acceptance date cannot be after the joining date.");
  }
  if (kind === "Confirmation") {
    const end = day(data.probationEndDate);
    if (!end) issues.push("Enter the probation end date. Confirmation is that date, not the joining date.");
    else if (end > letterDate) issues.push("Probation ends after the date printed on this letter. Set that date to the confirmation date.");
  }
  if (kind === "Promotion") {
    const sameRole = String(data.previousDesignation || "").trim() && String(data.previousDesignation || "").trim() === String(data.designation || data.newDesignation || "").trim();
    const oldCtc = money(data.previousCtc);
    const newCtc = money(data.newCtc || data.ctcAnnual || data.fixedCtcAnnual);
    if (sameRole && oldCtc > 0 && newCtc === oldCtc) issues.push("A promotion needs a new designation or a revised CTC.");
  }
  if (kind === "Warning" && day(data.reviewDate) && day(data.reviewDate) < letterDate) {
    issues.push("Review date cannot be before the date printed on the letter.");
  }
  if (["Relieving", "Experience", "Exit", "NdaPostEmployment"].includes(kind)) {
    if (!leaving) issues.push("Enter the last working date.");
    else if (joining && leaving < joining) issues.push("Last working date cannot be before the joining date.");
    else if (joining && leaving === joining) issues.push("Last working date is the same as the joining date.");
  }
  if (kind === "Relieving" && money(data.waivedDays) > 0 && !String(data.waiverRef || "").trim()) {
    issues.push("Waiver reference is required when notice days were waived.");
  }
  if (signatory && employee && signatory.toLowerCase() === employee.toLowerCase()) {
    issues.push("The company signatory and the employee are the same person. Choose another authorised signatory.");
  }
  return issues;
}
