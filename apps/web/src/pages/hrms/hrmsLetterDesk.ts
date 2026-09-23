/** Shared HR letter desk — one person picker, pack generate, preview payload. */

import { SPDC_OFFICE_ADDRESS } from "@sharnam/shared";

export const DEFAULT_LOCATION = SPDC_OFFICE_ADDRESS;

export type DocKind =
  | "Appointment"
  | "Offer"
  | "Relieving"
  | "Exit"
  | "AssetReturn"
  | "Confirmation"
  | "Promotion"
  | "Warning"
  | "Experience"
  | "NdaJoining"
  | "NdaPostEmployment";

export type DocRow = {
  id: string;
  kind: DocKind;
  refNo: string;
  employeeName: string;
  employeeUserId?: string | null;
  candidateEmail?: string | null;
  designation: string | null;
  department: string | null;
  effectiveDate: string | null;
  issueDate: string;
  status: string;
  dataJson: string;
  generatedDocxUrl: string | null;
  generatedPdfUrl: string | null;
  uploadedFileUrl: string | null;
  sharePointUrl: string | null;
  createdBy?: { fullName?: string; email?: string } | null;
};

export type StaffRow = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  profile?: {
    empCode?: string;
    designation?: string;
    department?: string;
    ctcAnnual?: number;
    joinDate?: string;
    reportingManagerId?: string;
    panNumber?: string;
    gender?: string;
    addressCurrent?: string;
    addressPermanent?: string;
    personalEmail?: string;
    personalPhone?: string;
  };
  memberships?: Array<{ project?: { name?: string } }>;
};

export type OfferRow = {
  id: string;
  status?: string;
  designation: string;
  department?: string;
  ctcAnnual?: number;
  joiningDate?: string;
  location?: string;
  reportingManager?: string;
  candidate?: { fullName: string; email?: string; id?: string };
  onboard?: { userId?: string | null };
};

export const KIND_OPTIONS: { key: DocKind; label: string; hint: string }[] = [
  { key: "Appointment", label: "Appointment letter", hint: "17-clause SPDC letter of appointment + Annexures I–III" },
  { key: "Offer", label: "Offer letter", hint: "Pre-appointment offer with fixed CTC and joining date" },
  { key: "Relieving", label: "Relieving letter", hint: "Issued on last working day after clearance" },
  { key: "Exit", label: "Exit letter", hint: "Formal separation intimation & exit checklist trigger" },
  { key: "AssetReturn", label: "Asset submission letter", hint: "IT + admin asset return acknowledgement" },
  { key: "Confirmation", label: "Confirmation letter", hint: "Post-probation confirmation of services" },
  { key: "Promotion", label: "Letter of promotion", hint: "SPDC branded promotion with revised CTC" },
  { key: "Warning", label: "Warning / concern letter", hint: "Notice of concern with corrective actions" },
  { key: "Experience", label: "Experience certificate", hint: "Tenure and role certificate on request" },
  { key: "NdaJoining", label: "NDA at joining", hint: "Confidentiality undertaking signed on appointment" },
  { key: "NdaPostEmployment", label: "NDA post-employment", hint: "Post-exit confidentiality reminder" },
];

/** Standard pack after offer accept / pre-join. */
export const ONBOARDING_LETTER_PACK: DocKind[] = ["Offer", "Appointment", "NdaJoining", "Confirmation"];

export type LetterFormState = {
  kind: DocKind;
  employeeUserId: string;
  offerId: string;
  employeeName: string;
  designation: string;
  department: string;
  candidateEmail: string;
  effectiveDate: string;
  ctcAnnual: string;
  reportingManager: string;
  location: string;
  previousDesignation: string;
  previousCtc: string;
  reason: string;
  assets: string;
  serials: string;
  empCode: string;
  pan: string;
  gender: string;
  address: string;
  mobile: string;
  projectName: string;
  issueInBrief: string;
  impact: string;
  correctiveAction: string;
};

export function emptyLetterForm(kind: DocKind = "Appointment"): LetterFormState {
  return {
    kind,
    employeeUserId: "",
    offerId: "",
    employeeName: "",
    designation: "",
    department: "",
    candidateEmail: "",
    effectiveDate: "",
    ctcAnnual: "",
    reportingManager: "",
    location: DEFAULT_LOCATION,
    previousDesignation: "",
    previousCtc: "",
    reason: "",
    assets: "",
    serials: "",
    empCode: "",
    pan: "",
    gender: "",
    address: "",
    mobile: "",
    projectName: "",
    issueInBrief: "",
    impact: "",
    correctiveAction: "",
  };
}

export function subjectKeyFromForm(form: Pick<LetterFormState, "employeeUserId" | "offerId">): string {
  if (form.employeeUserId) return `staff:${form.employeeUserId}`;
  if (form.offerId) return `offer:${form.offerId}`;
  return "";
}

export function buildSubjectOptions(staff: StaffRow[], offers: OfferRow[]) {
  const staffOpts = staff.map((s) => ({
    key: `staff:${s.id}`,
    label: `${s.fullName}${s.profile?.empCode ? ` · ${s.profile.empCode}` : ""} · Staff`,
  }));
  const offerOpts = offers
    .filter((o) => !["Rejected", "Withdrawn"].includes(String(o.status || "")))
    .map((o) => ({
      key: `offer:${o.id}`,
      label: `${o.candidate?.fullName || "Candidate"} · ${o.designation} · ${o.status || "Offer"}`,
    }));
  return [...offerOpts, ...staffOpts];
}

export function applySubjectKey(
  key: string,
  staff: StaffRow[],
  offers: OfferRow[],
  prev: LetterFormState,
): LetterFormState {
  if (!key) return { ...prev, employeeUserId: "", offerId: "" };
  if (key.startsWith("staff:")) {
    const id = key.slice(6);
    const emp = staff.find((s) => s.id === id);
    if (!emp) return prev;
    return applyStaff(emp, staff, { ...prev, employeeUserId: id, offerId: "" });
  }
  if (key.startsWith("offer:")) {
    const id = key.slice(6);
    const o = offers.find((x) => x.id === id);
    if (!o) return prev;
    const linkedUserId = o.onboard?.userId || "";
    const base = {
      ...prev,
      offerId: id,
      employeeUserId: linkedUserId,
      employeeName: o.candidate?.fullName || prev.employeeName,
      candidateEmail: o.candidate?.email || prev.candidateEmail,
      designation: o.designation || prev.designation,
      department: o.department || prev.department,
      ctcAnnual: o.ctcAnnual ? String(o.ctcAnnual) : prev.ctcAnnual,
      effectiveDate: o.joiningDate ? String(o.joiningDate).slice(0, 10) : prev.effectiveDate,
      location: o.location || prev.location || DEFAULT_LOCATION,
      reportingManager: o.reportingManager || prev.reportingManager,
    };
    if (linkedUserId) {
      const emp = staff.find((s) => s.id === linkedUserId);
      if (emp) return applyStaff(emp, staff, base);
    }
    return base;
  }
  return prev;
}

function applyStaff(emp: StaffRow, staff: StaffRow[], form: LetterFormState): LetterFormState {
  const mgr = emp.profile?.reportingManagerId
    ? staff.find((s) => s.id === emp.profile!.reportingManagerId)?.fullName || form.reportingManager
    : form.reportingManager;
  const project = emp.memberships?.[0]?.project?.name || form.projectName;
  return {
    ...form,
    employeeUserId: emp.id,
    employeeName: emp.fullName || form.employeeName,
    candidateEmail: emp.email || emp.profile?.personalEmail || form.candidateEmail,
    designation: emp.profile?.designation || form.designation,
    previousDesignation: emp.profile?.designation || form.previousDesignation,
    department: emp.profile?.department || form.department,
    ctcAnnual: emp.profile?.ctcAnnual ? String(emp.profile.ctcAnnual) : form.ctcAnnual,
    previousCtc: emp.profile?.ctcAnnual ? String(emp.profile.ctcAnnual) : form.previousCtc,
    effectiveDate: emp.profile?.joinDate ? String(emp.profile.joinDate).slice(0, 10) : form.effectiveDate,
    reportingManager: mgr,
    empCode: emp.profile?.empCode || form.empCode,
    pan: emp.profile?.panNumber || form.pan,
    gender: emp.profile?.gender || form.gender,
    address: emp.profile?.addressCurrent || emp.profile?.addressPermanent || form.address,
    mobile: emp.phone || emp.profile?.personalPhone || form.mobile,
    projectName: project,
  };
}

export function letterDataPayload(form: LetterFormState) {
  return {
    candidateName: form.employeeName,
    joinDate: form.effectiveDate,
    fixedCtcAnnual: form.ctcAnnual,
    ctcAnnual: form.ctcAnnual,
    location: form.location,
    reportingManager: form.reportingManager,
    previousDesignation: form.previousDesignation,
    previousCtc: form.previousCtc,
    newDesignation: form.designation,
    newCtc: form.ctcAnnual,
    reason: form.reason,
    assets: form.assets,
    serials: form.serials,
    empCode: form.empCode,
    pan: form.pan,
    panNumber: form.pan,
    gender: form.gender,
    address: form.address,
    addressAsPerRecords: form.address,
    candidateAddress: form.address,
    permanentAddress: form.address,
    phone: form.mobile,
    mobile: form.mobile,
    projectName: form.projectName,
    project: form.projectName,
    issueInBrief: form.issueInBrief || form.reason,
    impact: form.impact,
    correctiveAction: form.correctiveAction,
    facts: form.issueInBrief || form.reason,
    separationReason: form.reason || "resignation",
    natureOfWork: "site supervision, planning, quality control and billing verification",
    period: form.effectiveDate ? `${form.effectiveDate} to ${form.effectiveDate}` : "",
  };
}

export function docMatchesSubject(row: DocRow, form: Pick<LetterFormState, "employeeUserId" | "employeeName" | "candidateEmail">) {
  if (form.employeeUserId && row.employeeUserId === form.employeeUserId) return true;
  const name = form.employeeName.trim().toLowerCase();
  if (name && row.employeeName.trim().toLowerCase() === name) {
    if (!form.candidateEmail || !row.candidateEmail) return true;
    return row.candidateEmail.toLowerCase() === form.candidateEmail.toLowerCase();
  }
  return false;
}

export function annexureXlsxUrl(row: DocRow): string | null {
  try {
    const data = row.dataJson ? (JSON.parse(row.dataJson) as { annexureXlsxUrl?: string }) : {};
    if (data.annexureXlsxUrl) return data.annexureXlsxUrl;
  } catch {
    /* fall through */
  }
  const legacy = row.generatedDocxUrl || "";
  return legacy.toLowerCase().includes(".xlsx") ? legacy : null;
}

export function editableDocxUrl(row: DocRow): string | null {
  const url = row.generatedDocxUrl || "";
  if (!url || url.toLowerCase().includes(".xlsx")) return null;
  return url;
}

export function createBodyFromForm(form: LetterFormState) {
  return {
    kind: form.kind,
    employeeUserId: form.employeeUserId || null,
    employeeName: form.employeeName,
    designation: form.designation,
    department: form.department,
    candidateEmail: form.candidateEmail,
    effectiveDate: form.effectiveDate || null,
    data: letterDataPayload(form),
  };
}

/** Fields shown in the letter desk form — maps to {{tokens}} in SPDC .docx templates. */
export function letterFormUsesCtc(kind: DocKind): boolean {
  return kind === "Appointment" || kind === "Offer" || kind === "Promotion";
}

export function letterFormUsesPromotionExtras(kind: DocKind): boolean {
  return kind === "Promotion";
}

export function letterFormUsesWarningExtras(kind: DocKind): boolean {
  return kind === "Warning";
}

export function letterFormUsesAssetExtras(kind: DocKind): boolean {
  return kind === "AssetReturn";
}

export function letterFormUsesSeparationReason(kind: DocKind): boolean {
  return kind === "Warning" || kind === "Exit" || kind === "Relieving";
}
