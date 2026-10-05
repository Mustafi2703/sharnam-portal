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
  storagePath?: string | null;
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

export type LetterStage = "Pre-joining" | "Joining" | "During employment" | "Exit";

/** Stages shown as tabs on the letters desk, in the order a person moves through them. */
export const LETTER_STAGES: { key: LetterStage; label: string; hint: string; accent: string }[] = [
  { key: "Pre-joining", label: "Pre-joining", hint: "Offer before the person joins", accent: "#2563EB" },
  { key: "Joining", label: "On joining", hint: "Appointment and joining NDA", accent: "#0F766E" },
  { key: "During employment", label: "During employment", hint: "Confirmation, promotion, warnings", accent: "#B45309" },
  { key: "Exit", label: "Exit", hint: "Assets, exit, relieving, experience", accent: "#9F1239" },
];

/** Ordered by when HR issues them — the letter list is grouped by stage. */
export const KIND_OPTIONS: { key: DocKind; label: string; hint: string; stage: LetterStage }[] = [
  { key: "Offer", label: "Offer letter", hint: "Pre-appointment offer with fixed CTC and joining date", stage: "Pre-joining" },
  { key: "Appointment", label: "Appointment letter", hint: "17-clause SPDC letter of appointment + Annexures I–III", stage: "Joining" },
  { key: "NdaJoining", label: "NDA at joining", hint: "Confidentiality undertaking signed on appointment", stage: "Joining" },
  { key: "Confirmation", label: "Confirmation letter", hint: "Post-probation confirmation of services", stage: "During employment" },
  { key: "Promotion", label: "Letter of promotion", hint: "SPDC branded promotion with revised CTC", stage: "During employment" },
  { key: "Warning", label: "Warning / concern letter", hint: "Notice of concern with corrective actions", stage: "During employment" },
  { key: "AssetReturn", label: "Asset submission letter", hint: "IT + admin asset return acknowledgement", stage: "Exit" },
  { key: "Exit", label: "Exit letter", hint: "Formal separation intimation & exit checklist trigger", stage: "Exit" },
  { key: "Relieving", label: "Relieving letter", hint: "Issued on last working day after clearance", stage: "Exit" },
  { key: "Experience", label: "Experience certificate", hint: "Tenure and role certificate on request", stage: "Exit" },
  { key: "NdaPostEmployment", label: "NDA post-employment", hint: "Post-exit confidentiality reminder", stage: "Exit" },
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
  sheet: Record<string, string>;
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
    sheet: {},
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
    natureOfWork: form.sheet.natureOfWork || "site supervision, planning, quality control and billing verification",
    period: form.sheet.period || (form.effectiveDate ? `${form.effectiveDate} to ${form.effectiveDate}` : ""),
    ...filledSheet(form),
  };
}

function filledSheet(form: LetterFormState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of LETTER_VARIABLES[form.kind] || []) {
    const v = (form.sheet[field.key] || field.default || "").trim();
    if (v) out[field.key] = v;
  }
  return out;
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

/** Real SharePoint web link only. Portal /uploads/onedrive copies are not SharePoint. */
export function letterSharePointLink(row: DocRow): string | null {
  const u = row.sharePointUrl?.trim() || "";
  return /sharepoint\.com/i.test(u) ? u : null;
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

/** Reload register row fields into the composer (edit before preview / regenerate). */
export function hydrateLetterFormFromDoc(row: DocRow, form: LetterFormState): LetterFormState {
  let data: Record<string, unknown> = {};
  try {
    data = row.dataJson ? (JSON.parse(row.dataJson) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  const str = (k: string, fallback = "") => {
    const v = data[k];
    return v != null && String(v).trim() ? String(v) : fallback;
  };
  return {
    ...form,
    kind: row.kind as DocKind,
    employeeUserId: row.employeeUserId || form.employeeUserId,
    employeeName: row.employeeName || form.employeeName,
    candidateEmail: row.candidateEmail || form.candidateEmail,
    designation: row.designation || form.designation,
    department: row.department || form.department,
    effectiveDate: row.effectiveDate ? String(row.effectiveDate).slice(0, 10) : form.effectiveDate,
    ctcAnnual: str("fixedCtcAnnual", str("ctcAnnual", form.ctcAnnual)),
    previousCtc: str("previousCtc", form.previousCtc),
    previousDesignation: str("previousDesignation", str("newDesignation", form.previousDesignation)),
    reportingManager: str("reportingManager", form.reportingManager),
    location: str("location", form.location),
    reason: str("reason", str("separationReason", form.reason)),
    assets: str("assets", form.assets),
    serials: str("serials", form.serials),
    empCode: str("empCode", form.empCode),
    pan: str("pan", str("panNumber", form.pan)),
    gender: str("gender", form.gender),
    address: str("address", str("addressAsPerRecords", form.address)),
    mobile: str("mobile", str("phone", form.mobile)),
    projectName: str("projectName", str("project", form.projectName)),
    issueInBrief: str("issueInBrief", form.issueInBrief),
    impact: str("impact", form.impact),
    correctiveAction: str("correctiveAction", form.correctiveAction),
    sheet: sheetFromData(data, form.sheet),
  };
}

function sheetFromData(data: Record<string, unknown>, prev: Record<string, string>): Record<string, string> {
  const sheet = { ...prev };
  const keys = new Set(Object.values(LETTER_VARIABLES).flat().map((f) => f.key));
  for (const key of keys) {
    const v = data[key];
    if (v != null && String(v).trim()) sheet[key] = String(v);
  }
  return sheet;
}

/** Copy a filled offer (and later appointment / NDA) into the letter being composed so the next letter is not blank. */
export function applyPriorLetters(form: LetterFormState, docs: DocRow[]): LetterFormState {
  const kind = form.kind;
  const mine = docs.filter((r) => docMatchesSubject(r, form) && r.status !== "Cancelled");
  const offer = mine.find((r) => r.kind === "Offer");
  const appointment = mine.find((r) => r.kind === "Appointment");
  const nda = mine.find((r) => r.kind === "NdaJoining");
  let next = form;
  if (kind === "Offer" && offer) {
    next = hydrateLetterFormFromDoc(offer, form);
  } else if (offer) {
    const hydrated = hydrateLetterFormFromDoc(offer, form);
    next = {
      ...hydrated,
      kind,
      sheet: {
        ...hydrated.sheet,
        offerRefNo: hydrated.sheet.offerRefNo || offer.refNo,
        offerDate: hydrated.sheet.offerDate || String(offer.issueDate || "").slice(0, 10),
      },
    };
  }
  if (appointment && kind !== "Offer" && kind !== "Appointment") {
    next = {
      ...next,
      sheet: {
        ...next.sheet,
        appointmentRefNo: next.sheet.appointmentRefNo || appointment.refNo,
        appointmentDate: next.sheet.appointmentDate || String(appointment.issueDate || "").slice(0, 10),
      },
    };
  }
  if (nda && kind === "NdaPostEmployment") {
    next = {
      ...next,
      sheet: {
        ...next.sheet,
        ndaJoiningRef: next.sheet.ndaJoiningRef || nda.refNo,
        ndaJoiningDate: next.sheet.ndaJoiningDate || String(nda.issueDate || "").slice(0, 10),
      },
    };
  }
  return next;
}

export function letterFormFingerprint(form: LetterFormState): string {
  return JSON.stringify(createBodyFromForm(form));
}

/** Fields shown in the letter desk form — maps to {{tokens}} in SPDC .docx templates. */
export function letterFormUsesCtc(kind: DocKind): boolean {
  return kind === "Appointment" || kind === "Offer" || kind === "Promotion";
}

export function letterFormUsesPromotionExtras(kind: DocKind): boolean {
  return kind === "Promotion";
}

/** Fields that must be typed before the full-screen letter preview. Defaults on the template do not count as missing. */
export function missingLetterFields(form: LetterFormState): string[] {
  const missing: string[] = [];
  if (!form.employeeName.trim()) missing.push("Employee name");
  if (!form.designation.trim()) missing.push("Designation");
  if (!form.department.trim()) missing.push("Department");
  if (!form.effectiveDate.trim()) missing.push("Effective date");
  for (const field of LETTER_VARIABLES[form.kind] || []) {
    if (field.default) continue;
    const value = (form.sheet[field.key] || "").trim();
    if (!value) missing.push(field.label);
  }
  if (letterFormUsesWarningExtras(form.kind)) {
    if (!form.issueInBrief.trim()) missing.push("Issue in brief");
    if (!form.impact.trim()) missing.push("Impact");
    if (!form.correctiveAction.trim()) missing.push("Corrective action required");
  }
  return missing;
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

export type LetterVar = {
  key: string;
  label: string;
  hint?: string;
  type?: "text" | "date" | "textarea";
  wide?: boolean;
  default?: string;
};

const TERMS: LetterVar[] = [
  { key: "probationMonths", label: "Probation (months)", default: "6" },
  { key: "probationNotice", label: "Probation notice (days)", default: "15" },
  { key: "employeeNotice", label: "Employee notice (days)", default: "60" },
  { key: "companyNotice", label: "Company notice (days)", default: "30" },
  { key: "clDays", label: "Casual leave (days)", default: "12" },
  { key: "slDays", label: "Sick leave (days)", default: "6" },
  { key: "workingHours", label: "Working hours", default: "9:00 AM to 6:30 PM", wide: true },
  { key: "grade", label: "Grade", default: "As per SPDC Grade Structure" },
];

/** Variable sheet for each SPDC letter. Salary lines on offer, appointment and promotion come from the CTC figure. */
export const LETTER_VARIABLES: Record<DocKind, LetterVar[]> = {
  Offer: [
    { key: "applicationDate", label: "Application date", type: "date" },
    { key: "interviewDates", label: "Interview dates" },
    ...TERMS,
    { key: "reportingTime", label: "Reporting time", default: "9:30 AM" },
    { key: "reportingAddress", label: "Reporting address", wide: true },
    { key: "acceptanceDate", label: "Acceptance date", type: "date" },
    { key: "disclosure", label: "Disclosure", default: "None", wide: true },
    { key: "kraNote", label: "Role KRAs", default: "KRAs as per SPDC role master for this designation", type: "textarea", wide: true },
  ],
  Appointment: [
    { key: "offerRefNo", label: "Offer reference no." },
    { key: "offerDate", label: "Offer date", type: "date" },
    ...TERMS,
    { key: "lateMarks", label: "Late marks allowed", default: "3" },
    { key: "payDay", label: "Pay day", default: "7th" },
    { key: "giftLimit", label: "Gift limit (INR)", default: "1,000" },
    { key: "trainingThreshold", label: "Training threshold (INR)", default: "10,000" },
    { key: "retirementAge", label: "Retirement age", default: "58" },
    { key: "noOfCheques", label: "Number of security cheques" },
    { key: "bank", label: "Bank" },
    { key: "last4", label: "Account last 4" },
    { key: "chqNo", label: "Cheque numbers" },
    { key: "kraNote", label: "Role KRAs", default: "KRAs as per SPDC role master for this designation", type: "textarea", wide: true },
  ],
  Confirmation: [
    { key: "appointmentRefNo", label: "Appointment reference no." },
    { key: "appointmentDate", label: "Appointment date", type: "date" },
    { key: "probationEndDate", label: "Probation end date", type: "date" },
    { key: "employeeNotice", label: "Employee notice (days)", default: "60" },
    { key: "companyNotice", label: "Company notice (days)", default: "30" },
    { key: "revisedCtc", label: "Revised CTC, or No change", default: "No change" },
    { key: "focusArea1", label: "Focus area 1", default: "Timely delivery of assigned work", wide: true },
    { key: "focusArea2", label: "Focus area 2", default: "Client communication and documentation", wide: true },
    { key: "focusArea3", label: "Focus area 3", default: "HSE and quality compliance", wide: true },
  ],
  AssetReturn: [
    { key: "submissionDate", label: "Submission date", type: "date" },
    { key: "reason", label: "Reason for return", default: "your separation", wide: true },
    { key: "otherItem", label: "Other item" },
    { key: "officialEmail", label: "Official email" },
    { key: "forwardTo", label: "Forward to", default: "HR & Admin" },
    { key: "recoveryAmount", label: "Recovery amount", default: "Nil" },
    { key: "inspectionDays", label: "Inspection days", default: "7" },
    { key: "remarks", label: "Remarks", type: "textarea", wide: true },
  ],
  Relieving: [
    { key: "resignationDate", label: "Resignation date", type: "date" },
    { key: "exitLetterRef", label: "Exit letter reference" },
    { key: "noticeServed", label: "Notice served" },
    { key: "noticeRequired", label: "Notice required", default: "60" },
    { key: "waiverRef", label: "Waiver reference" },
    { key: "successorName", label: "Successor name" },
    { key: "assetLetterRef", label: "Asset letter reference" },
    { key: "fnfStatus", label: "Full and final status", default: "Pending clearance", wide: true },
  ],
  Exit: [
    { key: "resignationDate", label: "Resignation date", type: "date" },
    { key: "lastWorkingDate", label: "Last working date", type: "date" },
    { key: "noticeRequired", label: "Notice required", default: "60" },
    { key: "noticeServed", label: "Notice served" },
    { key: "shortfall", label: "Notice shortfall", default: "Nil" },
    { key: "waivedDays", label: "Days waived", default: "0" },
    { key: "approver", label: "Approver" },
    { key: "successorName", label: "Successor name" },
    { key: "successorDesignation", label: "Successor designation" },
    { key: "handoverDate", label: "Handover date", type: "date" },
    { key: "clientName", label: "Client name" },
    { key: "postExitAddress", label: "Address after exit", wide: true },
    { key: "personalEmail", label: "Personal email" },
    { key: "newEmployer", label: "New employer" },
    { key: "separationReason", label: "Separation", default: "resignation" },
  ],
  Promotion: [
    { key: "achievement", label: "Achievement", wide: true },
    { key: "reviewCycle", label: "Review cycle", default: "Half-yearly" },
    { key: "reviewMonths", label: "Review after (months)", default: "6" },
    { key: "previousGrade", label: "Current grade" },
    { key: "newGrade", label: "New grade" },
    { key: "previousDepartment", label: "Current department" },
    { key: "currentTeam", label: "Current team" },
    { key: "newTeam", label: "New team" },
    { key: "previousReporting", label: "Current reporting" },
    { key: "currentNotice", label: "Current notice (days)", default: "60" },
    { key: "newNotice", label: "New notice (days)", default: "60" },
    { key: "currentLimit", label: "Current authority limit" },
    { key: "newLimit", label: "New authority limit" },
    { key: "kra1", label: "KRA 1", default: "Deliver assigned projects to approved schedule", wide: true },
    { key: "kra2", label: "KRA 2", default: "Client satisfaction and stakeholder communication", wide: true },
    { key: "kra3", label: "KRA 3", default: "Cost control and billing accuracy", wide: true },
    { key: "kra4", label: "KRA 4", default: "HSE performance and compliance", wide: true },
    { key: "kra5", label: "KRA 5", default: "Team development and mentoring", wide: true },
  ],
  Warning: [
    { key: "letterType", label: "Letter type", default: "Concern" },
    { key: "severity", label: "Severity", default: "minor" },
    { key: "facts", label: "Facts (what, where, who reported)", type: "textarea", wide: true },
    { key: "evidence", label: "Evidence", default: "DPR, email records", wide: true },
    { key: "clausePolicy", label: "Clause / policy", default: "Clause 14 of your Appointment Letter", wide: true },
    { key: "previousWarnings", label: "Previous warnings", default: "None", wide: true },
    { key: "replyHours", label: "Reply within (hours)", default: "72" },
    { key: "dutyAuthority", label: "Duty / authority" },
    { key: "reviewDate", label: "Review date", type: "date" },
    { key: "reviewer", label: "Reviewer" },
  ],
  Experience: [
    { key: "from1", label: "Role 1 from", type: "date" },
    { key: "to1", label: "Role 1 to", type: "date" },
    { key: "designation2", label: "Later designation (if promoted)" },
    { key: "from2", label: "Role 2 from", type: "date" },
    { key: "to2", label: "Role 2 to", type: "date" },
    { key: "project1", label: "Project 1", wide: true },
    { key: "project2", label: "Project 2" },
    { key: "period", label: "Period of service", wide: true },
    { key: "natureOfWork", label: "Nature of work", default: "site supervision, planning, quality control and billing verification", type: "textarea", wide: true },
    { key: "exitMode", label: "Issued", default: "on resignation" },
  ],
  NdaJoining: [
    { key: "fatherOrSpouseName", label: "Father or spouse name" },
    { key: "age", label: "Age" },
    { key: "permanentAddress", label: "Permanent address", type: "textarea", wide: true },
    { key: "appointmentRefNo", label: "Appointment reference no." },
    { key: "appointmentDate", label: "Appointment date", type: "date" },
    { key: "clientProject", label: "Client / project", wide: true },
  ],
  NdaPostEmployment: [
    { key: "fatherOrSpouseName", label: "Father or spouse name" },
    { key: "age", label: "Age" },
    { key: "permanentAddress", label: "Permanent address", type: "textarea", wide: true },
    { key: "appointmentRefNo", label: "Appointment reference no." },
    { key: "ndaJoiningRef", label: "Joining NDA reference" },
    { key: "ndaJoiningDate", label: "Joining NDA date", type: "date" },
    { key: "lastWorkingDate", label: "Last working date", type: "date" },
    { key: "separationReason", label: "Separation", default: "resignation" },
    { key: "assetLetterRef", label: "Asset letter reference" },
    { key: "exitLetterRef", label: "Exit letter reference" },
    { key: "clientName", label: "Client" },
    { key: "fromTo", label: "Project period (from–to)" },
    { key: "confidentialItems", label: "Confidential items", default: "drawings, BOQ, rates, RA bills, claims", wide: true },
    { key: "postExitAddress", label: "Address after exit", wide: true },
    { key: "personalEmail", label: "Personal email" },
    { key: "newEmployer", label: "New employer" },
  ],
};
