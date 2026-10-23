/** Shared HR letter desk — one person picker, pack generate, preview payload. */

import { HR_LETTER_TABLES, SPDC_OFFICE_ADDRESS, hrLetterIssues, parseHrLetterTable, type HrLetterTable } from "@sharnam/shared";

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
    /** Grade on the employee profile. Interview scorecard JSON is not on this payload. */
    grade?: string;
  };
  memberships?: Array<{ project?: { name?: string } }>;
};

export type OfferRow = {
  id: string;
  status?: string;
  offerNo?: string;
  designation: string;
  department?: string;
  ctcAnnual?: number;
  joiningDate?: string;
  probationMonths?: number | null;
  location?: string;
  reportingManager?: string;
  createdAt?: string;
  sentAt?: string | null;
  acceptedAt?: string | null;
  offerLetterDocId?: string | null;
  /** Extra letter fields saved with the offer (address, phone, project, notices, grade). */
  letterFieldsJson?: string | null;
  empCode?: string | null;
  candidate?: { fullName: string; email?: string; phone?: string; location?: string; id?: string };
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
  { key: "Appointment", label: "Appointment letter", hint: "", stage: "Joining" },
  { key: "NdaJoining", label: "NDA at joining", hint: "Confidentiality undertaking signed on appointment", stage: "Joining" },
  { key: "Confirmation", label: "Confirmation letter", hint: "", stage: "During employment" },
  { key: "Promotion", label: "Letter of promotion", hint: "", stage: "During employment" },
  { key: "Warning", label: "Warning / concern letter", hint: "", stage: "During employment" },
  { key: "AssetReturn", label: "Asset submission letter", hint: "", stage: "Exit" },
  { key: "Exit", label: "Exit letter", hint: "", stage: "Exit" },
  { key: "Relieving", label: "Relieving letter", hint: "", stage: "Exit" },
  { key: "Experience", label: "Experience certificate", hint: "", stage: "Exit" },
  { key: "NdaPostEmployment", label: "NDA post-employment", hint: "", stage: "Exit" },
];

export function letterKindLabel(kind: string): string {
  return KIND_OPTIONS.find((k) => k.key === kind)?.label || kind;
}

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
  signatoryName: string;
  /** Date printed in the letter header. Existing staff use their original date, not today. */
  issueDate: string;
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
    signatoryName: "Nirav Parekh",
    issueDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
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
  if (!key) return { ...prev, employeeUserId: "", offerId: "", mobile: "", address: "", projectName: "", previousDesignation: "", previousCtc: "", pan: "", gender: "", empCode: "", sheet: {} };
  const cleared = { ...prev, mobile: "", address: "", projectName: "", previousDesignation: "", previousCtc: "", pan: "", gender: "", empCode: "", sheet: {} };
  if (key.startsWith("staff:")) {
    const id = key.slice(6);
    const emp = staff.find((s) => s.id === id);
    if (!emp) return prev;
    return bindLetterFromPerson(applyStaff(emp, staff, { ...cleared, employeeUserId: id, offerId: "" }), staff, offers);
  }
  if (key.startsWith("offer:")) {
    const id = key.slice(6);
    const o = offers.find((x) => x.id === id);
    if (!o) return prev;
    const linkedUserId = o.onboard?.userId || "";
    const base = {
      ...cleared,
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
      empCode: o.empCode || "",
    };
    if (linkedUserId) {
      const emp = staff.find((s) => s.id === linkedUserId);
      if (emp) return bindLetterFromPerson(applyStaff(emp, staff, base), staff, offers);
    }
    return bindLetterFromPerson(base, staff, offers);
  }
  return prev;
}

function applyStaff(emp: StaffRow, staff: StaffRow[], form: LetterFormState): LetterFormState {
  const mgr = emp.profile?.reportingManagerId
    ? staff.find((s) => s.id === emp.profile!.reportingManagerId)?.fullName || form.reportingManager
    : form.reportingManager;
  // Project / client site is the offer project name, not the first portal membership.
  const joined = emp.profile?.joinDate ? String(emp.profile.joinDate).slice(0, 10) : "";
  const leaving = isLeavingLetter(form.kind);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const printed = joined && joined < today ? joined : form.issueDate || today;
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
    effectiveDate: !leaving && form.kind !== "Confirmation" && joined ? joined : form.effectiveDate,
    reportingManager: mgr,
    empCode: emp.profile?.empCode || form.empCode,
    pan: emp.profile?.panNumber || form.pan,
    gender: normalGender(emp.profile?.gender || form.gender),
    issueDate: form.kind === "Confirmation" ? form.issueDate || today : printed,
    sheet: {
      ...(leaving && joined && !form.sheet.joinDate ? { ...form.sheet, joinDate: joined } : form.sheet),
      officialEmail: form.sheet.officialEmail || emp.email || "",
      personalEmail: form.sheet.personalEmail || emp.profile?.personalEmail || emp.email || "",
      joinDate: form.sheet.joinDate || joined,
    },
  };
}

type OfferLetterBits = {
  gender?: string;
  address?: string;
  phone?: string;
  grade?: string;
  projectName?: string;
  workingHours?: string;
  reportingTime?: string;
  reportingAddress?: string;
  probationNotice?: string;
  employeeNotice?: string;
  companyNotice?: string;
  clDays?: string;
  slDays?: string;
  interviewDates?: string;
};

const OFFER_LETTER_KEYS: (keyof OfferLetterBits)[] = [
  "gender",
  "address",
  "phone",
  "grade",
  "projectName",
  "workingHours",
  "reportingTime",
  "reportingAddress",
  "probationNotice",
  "employeeNotice",
  "companyNotice",
  "clDays",
  "slDays",
  "interviewDates",
];

function parseOfferLetterFields(raw?: string | null): OfferLetterBits {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: OfferLetterBits = {};
    for (const key of OFFER_LETTER_KEYS) {
      const value = String(obj[key] ?? "").trim();
      if (value) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function offerForForm(form: LetterFormState, offers: OfferRow[]): OfferRow | undefined {
  if (form.offerId) return offers.find((o) => o.id === form.offerId);
  if (form.employeeUserId) {
    const byUser = offers.find((o) => o.onboard?.userId === form.employeeUserId);
    if (byUser) return byUser;
  }
  const email = form.candidateEmail.trim().toLowerCase();
  if (!email) return undefined;
  return offers.find((o) => (o.candidate?.email || "").toLowerCase() === email);
}

function firstText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

/**
 * Mobile, address, project, reporting manager, and appointment terms come from the loaded offer and person.
 * Candidate has no address or permanentAddress column on the offers list.
 * Address uses offer letterFields.address, then EmployeeProfile.addressCurrent / addressPermanent.
 * noOfCheques is not on the offer or candidate payload.
 * kraNote is not on the offer or candidate payload.
 * Interview scorecard JSON is not on the employee or offer payload. Current Grade uses EmployeeProfile.grade when present.
 */
export function bindLetterFromPerson(
  form: LetterFormState,
  staff: StaffRow[],
  offers: OfferRow[],
  docs: DocRow[] = [],
): LetterFormState {
  const offer = offerForForm(form, offers);
  const emp = form.employeeUserId ? staff.find((s) => s.id === form.employeeUserId) : undefined;
  const fields = parseOfferLetterFields(offer?.letterFieldsJson);
  const mgrFromStaff = emp?.profile?.reportingManagerId
    ? staff.find((s) => s.id === emp.profile!.reportingManagerId)?.fullName || ""
    : "";
  const mobile = firstText(emp?.phone, emp?.profile?.personalPhone, offer?.candidate?.phone, fields.phone) || form.mobile;
  const address = firstText(fields.address, emp?.profile?.addressCurrent, emp?.profile?.addressPermanent) || form.address;
  const projectName = fields.projectName || form.projectName;
  const reportingManager = firstText(offer?.reportingManager, mgrFromStaff) || form.reportingManager;
  const profileGrade = emp?.profile?.grade || "";
  const permanent = firstText(fields.address, emp?.profile?.addressPermanent);
  const sheet: Record<string, string> = { ...form.sheet };
  if (permanent) sheet.permanentAddress = permanent;
  if (projectName) sheet.clientProject = projectName;
  if (offer?.probationMonths != null) sheet.probationMonths = String(offer.probationMonths);
  for (const key of ["probationNotice", "employeeNotice", "companyNotice", "clDays", "slDays", "workingHours", "reportingTime", "reportingAddress", "interviewDates"] as const) {
    if (fields[key]) sheet[key] = fields[key]!;
  }
  if (fields.grade) sheet.grade = fields.grade;
  else if (profileGrade && !sheet.grade) sheet.grade = profileGrade;
  if (profileGrade && !sheet.previousGrade) sheet.previousGrade = profileGrade;
  else if (!sheet.previousGrade && fields.grade) sheet.previousGrade = fields.grade;
  if (!sheet.previousDepartment && form.department) sheet.previousDepartment = form.department;
  const offerDoc =
    docs.find((row) => row.kind === "Offer" && row.status !== "Cancelled" && docMatchesSubject(row, form)) ||
    (offer?.offerLetterDocId ? docs.find((row) => row.id === offer.offerLetterDocId) : undefined);
  if (offerDoc?.refNo) sheet.offerRefNo = offerDoc.refNo;
  else if (!sheet.offerRefNo && offer?.offerNo) sheet.offerRefNo = offer.offerNo;
  if (offerDoc?.issueDate) sheet.offerDate = String(offerDoc.issueDate).slice(0, 10);
  else if (!sheet.offerDate) {
    const raw = offer?.sentAt || offer?.createdAt;
    if (raw) sheet.offerDate = String(raw).slice(0, 10);
  }
  return {
    ...form,
    mobile,
    address,
    projectName,
    reportingManager,
    empCode: form.empCode || offer?.empCode || "",
    gender: form.gender || normalGender(fields.gender || ""),
    previousDesignation: form.previousDesignation || form.designation,
    previousCtc: form.previousCtc || (form.ctcAnnual && form.kind === "Promotion" ? form.ctcAnnual : form.previousCtc),
    sheet,
  };
}

/** Re-apply offer and person autofill after a letter on the register is copied into the composer. */
export function withLetterAutofill(form: LetterFormState, staff: StaffRow[], offers: OfferRow[], docs: DocRow[]): LetterFormState {
  return bindLetterFromPerson(form, staff, offers, docs);
}

function normalGender(value: string): string {
  const g = value.trim().toLowerCase();
  if (g.startsWith("f")) return "Female";
  if (g.startsWith("m")) return "Male";
  return value;
}

/** Exit-stage letters: the effective date is the leaving date, so joining is its own field. */
export function isLeavingLetter(kind: DocKind) {
  return kind === "AssetReturn" || kind === "Exit" || kind === "Relieving" || kind === "Experience" || kind === "NdaPostEmployment";
}

export function letterDataPayload(form: LetterFormState) {
  const payload: Record<string, string> = {
    candidateName: form.employeeName,
    joinDate: isLeavingLetter(form.kind) ? "" : form.effectiveDate,
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
    permanentAddress: form.sheet.permanentAddress || form.address,
    phone: form.mobile,
    mobile: form.mobile,
    projectName: form.projectName,
    project: form.projectName,
    clientProject: form.projectName || form.sheet.clientProject || "",
    signatoryName: form.signatoryName,
    separationBasis: form.sheet.separationBasis || "",
    issueInBrief: form.issueInBrief || form.reason,
    impact: form.impact,
    correctiveAction: form.correctiveAction,
    facts: form.issueInBrief || form.reason,
    separationReason: form.reason || "resignation",
    natureOfWork: form.sheet.natureOfWork || "site supervision, planning, quality control and billing verification",
    ...filledSheet(form),
  };
  if (form.kind === "Promotion") {
    const previousRm = form.reportingManager;
    const nextRm = (form.sheet.newReportingManager || "").trim();
    if (form.previousDesignation || form.designation) payload.previousDesignation = form.previousDesignation || form.designation;
    if (form.sheet.previousDepartment || form.department) payload.previousDepartment = form.sheet.previousDepartment || form.department;
    if (form.previousCtc) payload.previousCtc = form.previousCtc;
    if (previousRm) {
      payload.previousReportingManager = previousRm;
      if (!payload.previousReporting) payload.previousReporting = previousRm;
    }
    if (nextRm) {
      payload.newReportingManager = nextRm;
      payload.reportingManager = nextRm;
    }
  }
  if (payload.severity) payload.severity = normalizeSeverity(String(payload.severity));
  return payload;
}

export function normalizeSeverity(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "major") return "Major";
  if (v === "gross") return "Gross";
  if (v === "minor") return "Minor";
  return value.trim();
}

function filledSheet(form: LetterFormState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of LETTER_VARIABLES[form.kind] || []) {
    const v = (form.sheet[field.key] || field.default || "").trim();
    if (v) out[field.key] = v;
  }
  for (const spec of letterTables(form.kind)) {
    const rows = letterTableRows(form, spec).filter((r) => r.some((c) => c.trim()));
    if (rows.length) out[spec.key] = JSON.stringify(rows);
  }
  return out;
}

const RETIRED_TABLE_HINTS = new Set([
  "Fill only the rows that apply. Use Y / N for returned.",
  "One row per incident. Empty uses the issue in brief.",
  "One row per project. Empty uses the project above.",
  "One row per designation, oldest first. Empty uses the designation and dates above.",
  "One row per project. Empty uses the project, client and period above.",
]);

const TABLE_LABELS: Record<string, string> = {
  undertakingRows: "Undertakings",
  priorInfoRows: "Prior Information Declared",
  kraRows: "Key Result Areas",
};

const COLUMN_LABELS: Record<string, string> = {
  "Client / project": "Client / Project",
  "Undertaking ref. / date": "Undertaking Ref. / Date",
  "Valid until": "Valid Until",
  "Description of prior information": "Description Of Prior Information",
  "Evidence of prior ownership": "Evidence Of Prior Ownership",
  "Key result area": "Key Result Area",
  "Target / measure": "Target / Measure",
};

export function letterTables(kind: DocKind): HrLetterTable[] {
  return (HR_LETTER_TABLES[kind] || []).map((spec) => ({
    ...spec,
    label: TABLE_LABELS[spec.key] || spec.label,
    hint: spec.hint && RETIRED_TABLE_HINTS.has(spec.hint) ? undefined : spec.hint,
    columns: spec.columns.map((col) => ({ ...col, label: COLUMN_LABELS[col.label] || col.label })),
  }));
}

const KRA_DEFAULTS: string[][] = [
  ["Deliver assigned projects to approved schedule", "SPI ≥ 0.95"],
  ["Client satisfaction and stakeholder communication", "No escalations; feedback ≥ 4/5"],
  ["Cost control and billing accuracy", ""],
  ["HSE performance and compliance", "Zero reportable incidents"],
  ["Team development and mentoring", ""],
];

/** Starting rows before HR edits a table — built from the fields above and older single-field letters. */
function seedTableRows(form: LetterFormState, spec: HrLetterTable): string[][] {
  const s = form.sheet;
  const blank = () => spec.columns.map(() => "");
  if (spec.fixedRows) return spec.fixedRows.map(blank);
  switch (spec.key) {
    case "designationRows": {
      const rows = [[form.designation, s.from1 || s.joinDate || "", s.to1 || (s.designation2 ? "" : form.effectiveDate)]];
      if (s.designation2) rows.push([s.designation2, s.from2 || "", s.to2 || form.effectiveDate]);
      return rows;
    }
    case "projectRows": {
      const site = /samanvay|corporate office/i.test(form.location) ? s.projectLocation || "" : s.projectLocation || form.location;
      const rows = [[s.project1 || form.projectName, site, s.period || ""]];
      if (s.project2) rows.push([s.project2, "", ""]);
      return rows;
    }
    case "kraRows":
      return KRA_DEFAULTS.map(([kra, target], i) => [s[`kra${i + 1}`] || kra, target]);
    case "chequeRows":
      return s.bank || s.last4 || s.chqNo ? [[s.bank || "", s.last4 || "", s.chqNo || "", ""]] : [blank()];
    case "incidentRows":
      return [["", s.facts || form.issueInBrief, s.evidence || "DPR, email records"]];
    case "projectAccessRows":
      return [[form.projectName, s.clientName || "", s.fromTo || "", s.confidentialItems || "drawings, BOQ, rates, RA bills, claims"]];
    default:
      return [blank()];
  }
}

export function letterTableRows(form: LetterFormState, spec: HrLetterTable): string[][] {
  const stored = form.sheet[spec.key];
  if (stored != null) {
    const rows = parseHrLetterTable(stored);
    if (spec.fixedRows) return spec.fixedRows.map((_, i) => spec.columns.map((_, j) => rows[i]?.[j] ?? ""));
    return rows.length ? rows.map((r) => spec.columns.map((_, j) => r[j] ?? "")) : [spec.columns.map(() => "")];
  }
  return seedTableRows(form, spec);
}

export function setLetterTableRows(form: LetterFormState, spec: HrLetterTable, rows: string[][]): LetterFormState {
  return { ...form, sheet: { ...form.sheet, [spec.key]: JSON.stringify(rows) } };
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
    issueDate: form.issueDate || null,
    data: letterDataPayload(form),
  };
}

/** Fills offer and appointment dates from the joining date so an existing employee can be filed in one pass. */
export function prepareExistingStaffPack(form: LetterFormState): LetterFormState {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const joining = form.effectiveDate;
  const printed = form.issueDate || (joining && joining < today ? joining : today);
  const stamp = joining && joining <= printed ? joining : printed;
  const sheet = { ...form.sheet };
  if (!sheet.offerDate && stamp) sheet.offerDate = stamp;
  if (!sheet.applicationDate && stamp) sheet.applicationDate = stamp;
  if (!sheet.interviewDates && stamp) sheet.interviewDates = stamp;
  if (!sheet.acceptanceDate && stamp) sheet.acceptanceDate = stamp;
  if (!sheet.appointmentDate && stamp) sheet.appointmentDate = stamp;
  if (!sheet.probationEndDate && joining) {
    const end = new Date(`${joining}T12:00:00+05:30`);
    end.setMonth(end.getMonth() + 6);
    const endKey = end.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (endKey <= today) sheet.probationEndDate = endKey;
  }
  return { ...form, issueDate: printed, sheet };
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
    issueDate: row.issueDate ? String(row.issueDate).slice(0, 10) : form.issueDate,
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

/** Single fields older letters used for table rows; read once to seed the table. */
const LEGACY_TABLE_FIELDS = [
  "from1", "to1", "designation2", "from2", "to2", "project1", "project2",
  "kra1", "kra2", "kra3", "kra4", "kra5", "bank", "last4", "chqNo", "facts", "evidence",
];

function sheetFromData(data: Record<string, unknown>, prev: Record<string, string>): Record<string, string> {
  const sheet = { ...prev };
  const keys = new Set([
    ...Object.values(LETTER_VARIABLES).flat().map((f) => f.key),
    ...Object.values(HR_LETTER_TABLES).flat().map((t) => t.key),
    ...LEGACY_TABLE_FIELDS,
  ]);
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
  if ((form.kind === "Offer" || form.kind === "Appointment") && !(Number(String(form.ctcAnnual).replace(/[^\d.]/g, "")) > 0)) {
    missing.push("Fixed CTC");
  }
  for (const field of LETTER_VARIABLES[form.kind] || []) {
    if (field.hidden || field.default || field.optional) continue;
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

export function letterContentProblems(form: LetterFormState): string[] {
  const letterDate = form.issueDate || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return hrLetterIssues(
    form.kind,
    {
      ...letterDataPayload(form),
      employeeName: form.employeeName,
      designation: form.designation,
      effectiveDate: form.effectiveDate,
      signatoryName: form.signatoryName,
    },
    letterDate,
  );
}

export function letterFormUsesWarningExtras(kind: DocKind): boolean {
  return kind === "Warning";
}

export function letterFormUsesAssetExtras(kind: DocKind): boolean {
  return kind === "AssetReturn";
}

/** None of the SPDC templates has a free reason line: Warning uses issue / facts, Asset uses its own reason field. */
export function letterFormUsesSeparationReason(_kind: DocKind): boolean {
  return false;
}

export type LetterVar = {
  key: string;
  label: string;
  hint?: string;
  type?: "text" | "date" | "textarea" | "role" | "select";
  options?: string[];
  wide?: boolean;
  default?: string;
  optional?: boolean;
  /** Kept on the generate payload, not shown as a box. */
  hidden?: boolean;
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
    { key: "interviewDates", label: "Interview date", type: "date" },
    ...TERMS,
    { key: "reportingTime", label: "Reporting time", default: "9:30 AM" },
    { key: "reportingAddress", label: "Reporting address", wide: true },
    { key: "acceptanceDate", label: "Acceptance date", type: "date" },
    { key: "disclosure", label: "Disclosure", default: "None", wide: true },
    { key: "kraNote", label: "Role KRAs", default: "KRAs as per SPDC role master for this designation", type: "textarea", wide: true },
  ],
  Appointment: [
    { key: "offerRefNo", label: "Offer Reference No.", hidden: true },
    { key: "offerDate", label: "Offer Date", type: "date", hidden: true },
    ...TERMS.map((field) => ({ ...field, hidden: true })),
    { key: "lateMarks", label: "Late Marks Allowed", default: "3" },
    { key: "payDay", label: "Pay Day", default: "7th" },
    { key: "retirementAge", label: "Retirement Age", default: "58" },
    // noOfCheques is not on the offer or candidate payload.
    // kraNote is not on the offer or candidate payload.
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
    { key: "officialEmail", label: "Official email", optional: true },
    { key: "forwardTo", label: "Forward to", default: "HR & Admin" },
    { key: "recoveryAmount", label: "Recovery amount", default: "Nil" },
    { key: "inspectionDays", label: "Inspection days", default: "7" },
    { key: "remarks", label: "Remarks", type: "textarea", wide: true },
  ],
  Relieving: [
    { key: "joinDate", label: "Joining date", type: "date" },
    { key: "resignationDate", label: "Resignation date", type: "date" },
    { key: "exitLetterRef", label: "Exit letter reference" },
    { key: "noticeServed", label: "Notice served" },
    { key: "noticeRequired", label: "Notice required", default: "60" },
    { key: "waiverRef", label: "Waiver reference", optional: true, hint: "Required only when days were waived" },
    { key: "successorName", label: "Successor name" },
    { key: "assetLetterRef", label: "Asset letter reference" },
    { key: "fnfStatus", label: "Full and final status", default: "Pending clearance", wide: true },
  ],
  Exit: [
    { key: "separationBasis", label: "Separation basis", type: "select", options: ["Resignation", "Termination", "Termination during probation", "Fixed-term completion", "Abandonment", "Retirement"] },
    { key: "resignationDate", label: "Resignation date", type: "date", optional: true },
    { key: "noticeRequired", label: "Notice required", default: "60" },
    { key: "noticeServed", label: "Notice served" },
    { key: "shortfall", label: "Notice shortfall", default: "Nil" },
    { key: "waivedDays", label: "Days waived", default: "0" },
    { key: "approver", label: "Approver" },
    { key: "successorName", label: "Successor name" },
    { key: "successorDesignation", label: "Successor designation", type: "role" },
    { key: "handoverDate", label: "Handover date", type: "date" },
    { key: "clientName", label: "Client name" },
    { key: "postExitAddress", label: "Address after exit", wide: true },
    { key: "personalEmail", label: "Personal email" },
    { key: "newEmployer", label: "New employer (optional)", optional: true },
  ],
  Promotion: [
    { key: "previousDepartment", label: "Previous Department", hidden: true },
    { key: "newReportingManager", label: "New Reporting Manager", hidden: true },
    { key: "achievement", label: "Achievement", wide: true },
    { key: "reviewCycle", label: "Review Cycle", default: "Half-yearly" },
    { key: "reviewMonths", label: "Review After (Months)", default: "6" },
    { key: "previousGrade", label: "Current Grade" },
    { key: "newGrade", label: "New Grade" },
    { key: "currentTeam", label: "Current Team" },
    { key: "newTeam", label: "New Team" },
    { key: "previousReporting", label: "Current Reporting" },
    { key: "currentNotice", label: "Current Notice (Days)", default: "60" },
    { key: "newNotice", label: "New Notice (Days)", default: "60" },
    { key: "currentLimit", label: "Current Authority Limit" },
    { key: "newLimit", label: "New Authority Limit" },
  ],
  Warning: [
    { key: "letterType", label: "Letter Type", type: "select", options: ["Concern", "First warning", "Final warning", "Show-cause notice"], default: "Concern" },
    { key: "severity", label: "Severity", type: "select", options: ["Minor", "Major", "Gross"], default: "Minor" },
    { key: "clausePolicy", label: "Clause / policy", default: "Clause 14 of your Appointment Letter", wide: true },
    { key: "previousWarnings", label: "Previous warnings", default: "None", wide: true },
    { key: "replyHours", label: "Reply within (hours)", default: "72" },
    { key: "dutyAuthority", label: "Duty / authority" },
    { key: "reviewDate", label: "Review date", type: "date" },
    { key: "reviewer", label: "Reviewer" },
  ],
  Experience: [
    { key: "joinDate", label: "Joining date", type: "date" },
    { key: "projectLocation", label: "Project location", hint: "Site, not the head office", optional: true },
    { key: "natureOfWork", label: "Nature of work", default: "site supervision, planning, quality control and billing verification", type: "textarea", wide: true },
    { key: "exitMode", label: "Issued", default: "on resignation" },
  ],
  NdaJoining: [
    { key: "fatherOrSpouseName", label: "Father Or Spouse Name" },
    { key: "age", label: "Age" },
    // Candidate.permanentAddress is not on the offers list. Filled from letterFields.address, else EmployeeProfile.addressPermanent.
    { key: "permanentAddress", label: "Permanent Address", type: "textarea", wide: true, hidden: true },
    { key: "appointmentRefNo", label: "Appointment Reference No." },
    { key: "appointmentDate", label: "Appointment Date", type: "date" },
  ],
  NdaPostEmployment: [
    { key: "fatherOrSpouseName", label: "Father Or Spouse Name" },
    { key: "age", label: "Age" },
    // Candidate.permanentAddress is not on the offers list. Filled from letterFields.address, else EmployeeProfile.addressPermanent.
    { key: "permanentAddress", label: "Permanent Address", type: "textarea", wide: true, hidden: true },
    { key: "joinDate", label: "Joining date", type: "date" },
    { key: "appointmentRefNo", label: "Appointment reference no." },
    { key: "ndaJoiningRef", label: "Joining NDA reference" },
    { key: "ndaJoiningDate", label: "Joining NDA date", type: "date" },
    { key: "separationReason", label: "Separation", default: "resignation" },
    { key: "assetLetterRef", label: "Asset letter reference" },
    { key: "exitLetterRef", label: "Exit letter reference" },
    { key: "clientName", label: "Client" },
    { key: "fromTo", label: "Project period (from–to)" },
    { key: "confidentialItems", label: "Confidential items", default: "drawings, BOQ, rates, RA bills, claims", wide: true },
    { key: "postExitAddress", label: "Address after exit", wide: true },
    { key: "personalEmail", label: "Personal email" },
    { key: "newEmployer", label: "New employer (optional)", optional: true },
  ],
};
