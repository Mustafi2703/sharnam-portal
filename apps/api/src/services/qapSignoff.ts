/**
 * Who may raise, declare, result and sign a quality IR.
 * Callers load the role map and pass it in. Unit-tested without the database.
 */
import {
  clientSignoffRequired,
  declarationsComplete,
  irTypeForPmcRole,
  noticeHours,
  resultCode,
  statusForQualityResult,
  truthyFlag,
  type QualityResultCode,
} from "@sharnam/shared";

export type QapRoleRow = {
  roleLabel: string;
  party: string;
  userId?: string | null;
  vendorId?: string | null;
};

export type SignUser = {
  id: string;
  role: string;
  vendorId?: string | null;
};

export type SignLine = {
  isHeader?: boolean;
  pmcRole?: string | null;
  clientRole?: string | null;
  contractorPerformer?: string | null;
  contractorChecker?: string | null;
  testAgency?: string | null;
};

const SPDC_ROLES = new Set(["admin", "office", "employee", "site_employee"]);

export function isSpdcUser(role: string | null | undefined): boolean {
  return SPDC_ROLES.has(String(role || ""));
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}

function labelMatch(assignments: QapRoleRow[], party: string, label: string | null | undefined): QapRoleRow[] {
  const lab = String(label || "").trim().toLowerCase();
  if (!lab) return [];
  return assignments.filter((a) => a.party === party && a.roleLabel.trim().toLowerCase() === lab);
}

function userOn(rows: QapRoleRow[], user: SignUser): boolean {
  return rows.some((a) => a.userId === user.id || (!!user.vendorId && a.vendorId === user.vendorId));
}

export function canRaiseQualityIr(input: {
  user: SignUser;
  line: SignLine | null;
  assignments: QapRoleRow[];
  onBehalf: boolean;
  unlinkedReason?: string | null;
}): { ok: boolean; error?: string } {
  if (!input.line) {
    if (isAdmin(input.user.role) && String(input.unlinkedReason || "").trim()) return { ok: true };
    if (isAdmin(input.user.role)) return { ok: false, error: "An IR without a QAP line needs a reason." };
    return { ok: false, error: "Pick a QAP line before raising this IR." };
  }
  if (input.line.isHeader) return { ok: false, error: "Header rows cannot have an inspection request." };
  if (isAdmin(input.user.role)) return { ok: true };
  if (input.onBehalf && isSpdcUser(input.user.role)) return { ok: true };
  if (input.user.role === "vendor") {
    const rows = labelMatch(input.assignments, "Contractor", input.line.contractorPerformer);
    if (!rows.length) return { ok: false, error: "Map the contractor role on Quality > QAP Master > Roles before raising this IR." };
    if (!userOn(rows, input.user)) return { ok: false, error: "Only the mapped contractor can raise this IR." };
    return { ok: true };
  }
  return { ok: false, error: "Only the mapped contractor, or SPDC on behalf of the contractor, can raise this IR." };
}

export function canEditDeclaration(input: { user: SignUser; line: SignLine; assignments: QapRoleRow[]; onBehalf: boolean }): boolean {
  if (isAdmin(input.user.role)) return true;
  if (input.onBehalf && isSpdcUser(input.user.role)) return true;
  if (input.user.role !== "vendor") return false;
  const rows = labelMatch(input.assignments, "Contractor", input.line.contractorPerformer);
  if (!rows.length) return true;
  return userOn(rows, input.user);
}

export function canSetResult(input: { user: SignUser; line: SignLine; assignments: QapRoleRow[] }): { ok: boolean; error?: string } {
  if (isAdmin(input.user.role)) return { ok: true };
  if (!isSpdcUser(input.user.role)) return { ok: false, error: "Only SPDC can record the inspection result." };
  const rows = labelMatch(input.assignments, "PMC", input.line.pmcRole);
  if (!rows.length) return { ok: false, error: "Map the PMC role on Quality > QAP Master > Roles before recording a result." };
  if (!userOn(rows, input.user)) return { ok: false, error: "Only the SPDC user mapped to this PMC role can record the result." };
  return { ok: true };
}

export function canClientSign(input: { user: SignUser; line: SignLine; assignments: QapRoleRow[] }): { ok: boolean; error?: string } {
  if (!clientSignoffRequired(input.line.clientRole) && input.user.role !== "client" && !isAdmin(input.user.role)) {
    return { ok: false, error: "This QAP line does not ask for a client sign-off." };
  }
  const rows = labelMatch(input.assignments, "Client", input.line.clientRole);
  if (isAdmin(input.user.role) && !rows.length) return { ok: false, error: "Map the client role before recording a client sign-off." };
  if (input.user.role !== "client" && !isAdmin(input.user.role)) {
    return { ok: false, error: "Only the mapped client user can sign this IR." };
  }
  if (!rows.length) return { ok: false, error: "Map the client role on Quality > QAP Master > Roles." };
  if (!userOn(rows, input.user) && !isAdmin(input.user.role)) {
    return { ok: false, error: "Only the mapped client user can sign this IR." };
  }
  if (isAdmin(input.user.role) && !userOn(rows, input.user)) {
    return { ok: false, error: "Only the mapped client user can sign this IR." };
  }
  return { ok: true };
}

export function canVerifyCloseout(input: { user: SignUser; line: SignLine; assignments: QapRoleRow[] }): boolean {
  return canSetResult(input).ok;
}

export type SubmitCheck = { ok: boolean; error?: string; shortNotice?: boolean };

export function checkQualitySubmit(input: {
  line: SignLine;
  form: Record<string, unknown>;
  submittedAt: Date;
  hasChecklist: boolean;
  attachedRecordKeys: string[];
  requiredRecordKeys: string[];
}): SubmitCheck {
  const irType = String(input.form.irType || irTypeForPmcRole(input.line.pmcRole));
  const site = !/document/i.test(irType);
  if (site && !declarationsComplete(input.form)) {
    return { ok: false, error: "Tick all seven contractor declarations before submitting a site inspection." };
  }
  if (site && !String(input.form.verifiedBy || "").trim()) {
    return { ok: false, error: "Contractor QA/QC must fill Verified by before submit." };
  }
  const waived = new Set(
    (Array.isArray(input.form.waivers) ? input.form.waivers : [])
      .map((w) => (w && typeof w === "object" ? String((w as { key?: string }).key || "") : ""))
      .filter(Boolean)
  );
  const attached = new Set(input.attachedRecordKeys);
  if (input.hasChecklist) attached.add("checklist");
  const missing = input.requiredRecordKeys.filter((k) => !attached.has(k) && !waived.has(k));
  if (missing.length) {
    return { ok: false, error: `Attach the records this QAP line names before submit (${missing.join(", ")}).` };
  }
  if (!site && input.requiredRecordKeys.includes("checklist") && !input.hasChecklist && !waived.has("checklist")) {
    return { ok: false, error: "Link the activity checklist fill before submit." };
  }
  const hours = noticeHours({ ...input.line, irType });
  if (!hours) return { ok: true, shortNotice: false };
  const when = combineDateTime(input.form.requiredDate, input.form.requiredTime);
  if (!when) return { ok: false, error: "Enter the inspection date and time." };
  const need = hours * 3600000;
  if (when.getTime() - input.submittedAt.getTime() + 60_000 < need) {
    if (!String(input.form.shortNoticeReason || "").trim()) {
      return { ok: false, error: `This inspection needs ${hours} hours notice, or a short notice reason.` };
    }
    return { ok: true, shortNotice: true };
  }
  return { ok: true, shortNotice: false };
}

function combineDateTime(date: unknown, time: unknown): Date | null {
  const d = String(date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return null;
  const tm = String(time || "00:00").trim();
  const iso = `${d.slice(0, 10)}T${/^\d{2}:\d{2}/.test(tm) ? tm.slice(0, 5) : "00:00"}:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function decideQualityResult(input: {
  result: QualityResultCode;
  line: SignLine;
  form: Record<string, unknown>;
  openNcr: boolean;
}): { status: string; closed: boolean; final: boolean } {
  const clientSigned = !!String(input.form.witnessedBy || "").trim() || truthyFlag(input.form.clientSigned);
  const section5Closed = !!String(input.form.closedBy || "").trim() && !!String(input.form.actionTaken || "").trim();
  return statusForQualityResult({
    result: input.result,
    clientRequired: clientSignoffRequired(input.line.clientRole),
    clientSigned,
    section5Closed,
    openNcr: input.openNcr,
  });
}

export function lineIrType(line: SignLine): "Document review" | "Site inspection" {
  return irTypeForPmcRole(line.pmcRole);
}

export { resultCode };
