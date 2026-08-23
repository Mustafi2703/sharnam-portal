/** SPDC inspection / RFI reference layouts (client workbooks). */

export type InspectionRfiKind =
  | "QualityInspection"
  | "SafetyChecklist"
  | "QualityIR"
  | "SafetyIR"
  | "ActivityInspection"
  | "RequestForInformation";

export type InspectionRegisterTab = "quality-ir" | "safety-ir" | "activity-checklist" | "hse-register";

/** Common QAP sign-off abbreviations (Excel Week 50) — use in dropdowns, not free-text reformatting. */
export const QAP_SIGN_CONTRACTOR = ["", "Performer", "Checker", "Yes", "Review", "Witness", "Approve"];
export const QAP_SIGN_PMC = ["", "Review", "Witness", "Approve", "Yes", "TPC", "Random"];
export const QAP_SIGN_CLIENT = ["", "Witness", "Random", "Approve", "Yes", "Review"];

export const QAP_LEGENDS: [string, string][] = [
  ["BBS", "Bar Bending Schedule"],
  ["MTC", "Material Test Certificate"],
  ["RCC", "Reinforced Cement Concrete"],
  ["CUM", "Cubic Meter"],
  ["PCC", "Plain Cement Concrete"],
  ["SQM", "Square Meter"],
  ["HSE", "Health Safety & Environment"],
  ["QA", "Quality Assurance"],
  ["TBM", "Temporary Bench Mark"],
  ["IS", "Indian Standard"],
  ["QC", "Quality Control"],
  ["TPC", "Third Party Confirmation"],
];

export type SpdcFormField = { key: string; label: string; placeholder: string; section?: string; wide?: boolean };

export type InspectionFormRef = {
  docNo: string;
  workbook: string;
  title: string;
  subtitle: string;
  rfiKind: InspectionRfiKind;
  prefix: string;
  fields: SpdcFormField[];
  subjectHint: string;
  bodyTemplate: string;
  registerColumns: string[];
};

export const SPDC_FORM_DEFAULTS: Record<string, string> = {
  pmcEngineer: "SPDC",
};

export const QUALITY_IR_FORM: InspectionFormRef = {
  docNo: "SPDC/QA/F-01",
  workbook: "SPDC_Request_for_Inspection_Form.xlsx",
  title: "Request for Inspection (RIA)",
  subtitle: "Site activity — all disciplines. Drawing reference is text only; attach signed checklist separately.",
  rfiKind: "QualityIR",
  prefix: "IR",
  registerColumns: [
    "IR No.",
    "Date raised",
    "Discipline",
    "Activity",
    "Location / grid",
    "Quantity",
    "ITP / control point",
    "Status",
    "Assignee",
  ],
  fields: [
    { key: "projectFacility", label: "Project / facility", placeholder: "SPDC-DEMO-01", section: "1. Project particulars" },
    { key: "employerClient", label: "Employer / client", placeholder: "Client name", section: "1. Project particulars" },
    { key: "contractorAgency", label: "Contractor / agency", placeholder: "Main contractor", section: "1. Project particulars" },
    { key: "pmcEngineer", label: "PMC / engineer", placeholder: "SPDC", section: "1. Project particulars" },
    { key: "irNumber", label: "IR no.", placeholder: "IR/CIV/024", section: "1. Project particulars" },
    { key: "dateRaised", label: "Date of raising", placeholder: "YYYY-MM-DD", section: "1. Project particulars" },
    { key: "packageWoNo", label: "Package / WO no.", placeholder: "Optional", section: "1. Project particulars" },
    { key: "discipline", label: "Discipline", placeholder: "Civil / Structural", section: "1. Project particulars" },
    { key: "activityDescription", label: "Description of activity", placeholder: "RCC column casting — C104", section: "2. Activity offered", wide: true },
    { key: "location", label: "Location / grid / level", placeholder: "Grid C4 / Lvl +0.00", section: "2. Activity offered", wide: true },
    { key: "quantityUnit", label: "Quantity offered / unit", placeholder: "3.2 cum", section: "2. Activity offered" },
    { key: "stageOfWork", label: "Stage of work", placeholder: "Pre-pour hold point", section: "2. Activity offered" },
    { key: "itpRef", label: "ITP ref. / activity code", placeholder: "ITP-STR-05", section: "2. Activity offered" },
    { key: "controlPoint", label: "Control point", placeholder: "H — Hold point", section: "2. Activity offered" },
    { key: "drawingRef", label: "Drawing no. & rev. (reference only)", placeholder: "SPDC-STR-104 Rev. 2", section: "References" },
    { key: "checklistRef", label: "Linked activity checklist no.", placeholder: "CL/CIV/104", section: "References" },
  ],
  subjectHint: "IR — Quality inspection: [activity]",
  bodyTemplate: [
    "REQUEST FOR INSPECTION (RIA) — SPDC/QA/F-01",
    "",
    "Project / facility: ",
    "Employer / client: ",
    "Contractor / agency: ",
    "PMC / engineer: ",
    "IR no.: ",
    "Date of raising: ",
    "Package / WO no.: ",
    "Discipline: ",
    "",
    "Description of activity: ",
    "Location / grid / level: ",
    "Quantity offered / unit: ",
    "Stage of work: ",
    "ITP ref. / activity code: ",
    "Control point: ",
    "Drawing no. & rev. (text ref): ",
    "Linked activity checklist no.: ",
    "",
    "Signed activity checklist to be enclosed with this IR.",
  ].join("\n"),
};

export const SAFETY_IR_FORM: InspectionFormRef = {
  docNo: "SPDC/HSE/F-01",
  workbook: "SPDC_Safety_Inspection_Request_and_Checklists.xlsx",
  title: "Safety Inspection & Clearance Request",
  subtitle: "High-risk activity pre-start clearance. Links to quality IR when applicable — no drawing file attachment.",
  rfiKind: "SafetyIR",
  prefix: "HSE-IR",
  registerColumns: [
    "Ref. no.",
    "Date raised",
    "Type",
    "Area / location",
    "Activity / finding",
    "Risk rating",
    "Clearance result",
    "Status",
  ],
  fields: [
    { key: "projectFacility", label: "Project / facility", placeholder: "SPDC-DEMO-01", section: "1. Particulars" },
    { key: "employerClient", label: "Employer / client", placeholder: "Client name", section: "1. Particulars" },
    { key: "contractorAgency", label: "Contractor / agency", placeholder: "Main contractor", section: "1. Particulars" },
    { key: "pmcEngineer", label: "PMC / engineer", placeholder: "SPDC", section: "1. Particulars" },
    { key: "irNumber", label: "Safety IR no.", placeholder: "HSE/IR/012", section: "1. Particulars" },
    { key: "dateRaised", label: "Date of raising", placeholder: "YYYY-MM-DD", section: "1. Particulars" },
    { key: "packageWoNo", label: "Package / WO no.", placeholder: "Optional", section: "1. Particulars" },
    { key: "linkedQualityIrNo", label: "Linked quality IR no.", placeholder: "IR/CIV/024", section: "1. Particulars" },
    { key: "highRiskType", label: "High-risk activity type", placeholder: "Work at height / scaffold handover", section: "2. Activity offered" },
    { key: "activityDescription", label: "Description of work", placeholder: "Purlin fixing at 9 m", section: "2. Activity offered", wide: true },
    { key: "location", label: "Exact location / grid / level", placeholder: "Zone 2 / Shed roof", section: "2. Activity offered", wide: true },
    { key: "clearanceSoughtFrom", label: "Clearance sought from", placeholder: "Date / shift", section: "2. Activity offered" },
    { key: "validUpTo", label: "Valid up to", placeholder: "End of shift", section: "2. Activity offered" },
    { key: "riskRating", label: "Risk rating", placeholder: "High / Medium / Low", section: "Clearance" },
    { key: "clearanceResult", label: "Result code (S1–S4)", placeholder: "S1 — Cleared", section: "Clearance" },
    { key: "actionRequired", label: "Action required / conditions", placeholder: "Horizontal lifeline to be certified", section: "Clearance", wide: true },
  ],
  subjectHint: "Safety IR — clearance: [activity]",
  bodyTemplate: [
    "SAFETY INSPECTION & CLEARANCE REQUEST — SPDC/HSE/F-01",
    "",
    "Project / facility: ",
    "Employer / client: ",
    "Contractor / agency: ",
    "PMC / engineer: ",
    "Safety IR no.: ",
    "Date of raising: ",
    "Linked quality IR no.: ",
    "",
    "High-risk activity type: ",
    "Description of work: ",
    "Exact location / grid / level: ",
    "Clearance sought from: ",
    "Valid up to: ",
    "Risk rating: ",
    "Result code: ",
    "Action required: ",
  ].join("\n"),
};

export const ACTIVITY_CHECKLIST_FORM: InspectionFormRef = {
  docNo: "SPDC/QA/F-02",
  workbook: "SPDC_Activity_Inspection_Checklist_Format.xlsx",
  title: "Activity Inspection Checklist",
  subtitle: "One activity, one checklist — drawing no. & rev. as text reference only (not a file attachment).",
  rfiKind: "ActivityInspection",
  prefix: "CL",
  registerColumns: [
    "Checklist no.",
    "Date of check",
    "Linked IR no.",
    "Activity checked",
    "Discipline",
    "Location",
    "Drawing no. & rev.",
    "ITP / control point",
    "Status",
  ],
  fields: [
    { key: "projectFacility", label: "Project / facility", placeholder: "SPDC-DEMO-01", section: "Particulars" },
    { key: "employerClient", label: "Employer / client", placeholder: "Client name", section: "Particulars" },
    { key: "contractorAgency", label: "Contractor / agency", placeholder: "Main contractor", section: "Particulars" },
    { key: "checklistNo", label: "Checklist no.", placeholder: "CL/CIV/104", section: "Particulars" },
    { key: "dateRaised", label: "Date of check", placeholder: "YYYY-MM-DD", section: "Particulars" },
    { key: "linkedIrNo", label: "Linked IR no.", placeholder: "IR/CIV/024", section: "Particulars" },
    { key: "activityDescription", label: "Activity checked", placeholder: "RCC column casting — C104", section: "Particulars", wide: true },
    { key: "discipline", label: "Discipline", placeholder: "Civil / Structural", section: "Particulars" },
    { key: "location", label: "Location / grid / level", placeholder: "Grid C4 / Lvl +0.00", section: "Particulars" },
    { key: "quantityUnit", label: "Quantity / unit", placeholder: "3.2 cum", section: "Particulars" },
    { key: "drawingRef", label: "Drawing no. & rev.", placeholder: "SPDC-STR-104 Rev. 2", section: "References" },
    { key: "specClause", label: "Specification clause", placeholder: "Sec. 5.3 — RCC works", section: "References" },
    { key: "methodStmtNo", label: "Approved method stmt. no.", placeholder: "MS-STR-07 Rev. 1", section: "References" },
    { key: "itpRef", label: "ITP ref. / control point", placeholder: "ITP-STR-05 / H — Hold point", section: "References" },
  ],
  subjectHint: "Activity checklist: [activity]",
  bodyTemplate: [
    "ACTIVITY INSPECTION CHECKLIST — SPDC/QA/F-02",
    "",
    "Project / facility: ",
    "Employer / client: ",
    "Contractor / agency: ",
    "Checklist no.: ",
    "Date of check: ",
    "Linked IR no.: ",
    "Activity checked: ",
    "Discipline: ",
    "Location / grid / level: ",
    "Quantity / unit: ",
    "Drawing no. & rev.: ",
    "Specification clause: ",
    "Approved method stmt. no.: ",
    "ITP ref. / control point: ",
    "",
    "Checklist sections A–H to be filled on site and enclosed with the quality IR.",
  ].join("\n"),
};

/** Legacy QI / safety checklist fill RFIs (assignee completes checklist). */
export const QUALITY_INSPECTION_FORM: InspectionFormRef = {
  ...QUALITY_IR_FORM,
  docNo: "SPDC/QA/F-01",
  title: "Request QI checklist fill",
  subtitle: "Notify assignee to complete a quality inspection checklist.",
  rfiKind: "QualityInspection",
  prefix: "QI-RFI",
  fields: [
    { key: "location", label: "Location / grid / level", placeholder: "e.g. Grid A–B / Level 2 slab" },
    { key: "activity", label: "Activity / work description", placeholder: "e.g. Reinforcement — column C1–C4" },
    { key: "drawingRef", label: "Drawing / revision (text)", placeholder: "e.g. STR-COL-R0" },
    { key: "requestedDate", label: "Requested inspection date", placeholder: "YYYY-MM-DD or shift" },
    { key: "contractorRep", label: "Contractor representative", placeholder: "Site engineer / QC" },
    { key: "checklistRef", label: "Checklist / QAP line", placeholder: "Linked QI checklist or QAP activity" },
  ],
  subjectHint: "RFI — Quality inspection: [activity]",
  bodyTemplate: [
    "Request for quality site inspection per SPDC Request for Inspection form.",
    "",
    "Location / grid: ",
    "Activity / work: ",
    "Drawing reference: ",
    "Requested date / time: ",
    "Contractor rep: ",
    "Checklist / QAP reference: ",
    "",
    "Please inspect and record witness / review on linked checklist.",
  ].join("\n"),
  registerColumns: QUALITY_IR_FORM.registerColumns,
};

export const SAFETY_INSPECTION_FORM: InspectionFormRef = {
  ...SAFETY_IR_FORM,
  docNo: "SPDC/HSE/F-02",
  title: "Safety checklist fill request",
  subtitle: "Request safety checklist fill — hazard area, permit, checklist type.",
  rfiKind: "SafetyChecklist",
  prefix: "SAF-RFI",
  fields: [
    { key: "location", label: "Work area / location", placeholder: "e.g. Scaffolding Bay 3" },
    { key: "activity", label: "Activity / task", placeholder: "e.g. Working at height — façade" },
    { key: "hazard", label: "Hazard / category", placeholder: "e.g. Fall from height, PPE" },
    { key: "permitRef", label: "Work permit / JSA ref", placeholder: "Optional permit number" },
    { key: "requestedDate", label: "Requested inspection date", placeholder: "YYYY-MM-DD" },
    { key: "checklistRef", label: "Safety checklist", placeholder: "Linked safety checklist master" },
  ],
  subjectHint: "Safety RFI — inspection: [activity]",
  bodyTemplate: [
    "Request for safety inspection per SPDC Safety Inspection Request & Checklists.",
    "",
    "Work area: ",
    "Activity / task: ",
    "Hazard category: ",
    "Work permit / JSA: ",
    "Requested date: ",
    "Checklist: ",
    "",
    "Assignee to complete safety checklist fill and close observation if any.",
  ].join("\n"),
  registerColumns: SAFETY_IR_FORM.registerColumns,
};

export const HSE_REGISTER_REF = {
  workbook: "SPDC_Safety_Inspection_Request_and_Checklists.xlsx",
  sheet: "HSE Register",
  title: "HSE register",
  columns: ["Sr.", "Ref. no.", "Date raised", "Type", "Area / location", "Activity / finding", "Risk rating", "Action required", "Status"],
};

export const RFI_REGISTER_REF = {
  workbook: "SPDC_RFI_Form_and_Register.xlsx",
  sheet: "04_RFI_REGISTER",
  title: "RFI register format",
  columns: [
    "RFI NO",
    "REV",
    "PACKAGE",
    "DISCIPLINE",
    "CATEGORY",
    "SUBJECT",
    "LOCATION / GRID",
    "DWG REF",
    "DWG REV",
    "SPEC CLAUSE",
    "QUERY RAISED",
    "CONTRACTOR'S PROPOSED SOLUTION",
    "ORIGINATOR",
    "DATE RAISED",
    "PRIORITY",
    "SLA DAYS",
    "REPLY REQUIRED BY",
    "RESPONSIBLE PARTY",
    "DATE RESPONDED",
    "RESPONSE",
    "RESPONDED BY",
    "STATUS",
    "DATE CLOSED",
    "DAYS TAKEN",
    "SLA STATUS",
    "AGE BUCKET",
    "COST IMPACT",
    "EST. COST (INR)",
    "TIME IMPACT",
    "EST. DELAY (d)",
    "CHANGE / VO REF",
    "ATTACHMENTS",
    "PMC REMARKS",
  ],
};

export const INSPECTION_REGISTER_FORMS: InspectionFormRef[] = [
  QUALITY_IR_FORM,
  SAFETY_IR_FORM,
  ACTIVITY_CHECKLIST_FORM,
];

export const INSPECTION_KINDS: InspectionRfiKind[] = ["QualityIR", "SafetyIR", "ActivityInspection"];

export function inspectionFormForKind(kind: string): InspectionFormRef | null {
  if (kind === "QualityIR") return QUALITY_IR_FORM;
  if (kind === "SafetyIR") return SAFETY_IR_FORM;
  if (kind === "ActivityInspection") return ACTIVITY_CHECKLIST_FORM;
  if (kind === "QualityInspection") return QUALITY_INSPECTION_FORM;
  if (kind === "SafetyChecklist") return SAFETY_INSPECTION_FORM;
  return null;
}

export function registerTabForKind(kind: string): InspectionRegisterTab {
  if (kind === "SafetyIR") return "safety-ir";
  if (kind === "ActivityInspection") return "activity-checklist";
  return "quality-ir";
}

export function kindForRegisterTab(tab: InspectionRegisterTab): InspectionRfiKind {
  if (tab === "safety-ir") return "SafetyIR";
  if (tab === "activity-checklist") return "ActivityInspection";
  return "QualityIR";
}

const BODY_LINE_MAP: Record<string, string> = {
  "Project / facility: ": "projectFacility",
  "Employer / client: ": "employerClient",
  "Contractor / agency: ": "contractorAgency",
  "PMC / engineer: ": "pmcEngineer",
  "IR no.: ": "irNumber",
  "Safety IR no.: ": "irNumber",
  "Date of raising: ": "dateRaised",
  "Date of check: ": "dateRaised",
  "Package / WO no.: ": "packageWoNo",
  "Discipline: ": "discipline",
  "Description of activity: ": "activityDescription",
  "Description of work: ": "activityDescription",
  "Activity checked: ": "activityDescription",
  "Location / grid / level: ": "location",
  "Exact location / grid / level: ": "location",
  "Quantity offered / unit: ": "quantityUnit",
  "Quantity / unit: ": "quantityUnit",
  "Stage of work: ": "stageOfWork",
  "ITP ref. / activity code: ": "itpRef",
  "ITP ref. / control point: ": "itpRef",
  "Control point: ": "controlPoint",
  "Drawing no. & rev. (text ref): ": "drawingRef",
  "Drawing no. & rev.: ": "drawingRef",
  "Linked activity checklist no.: ": "checklistRef",
  "Linked quality IR no.: ": "linkedQualityIrNo",
  "High-risk activity type: ": "highRiskType",
  "Clearance sought from: ": "clearanceSoughtFrom",
  "Valid up to: ": "validUpTo",
  "Risk rating: ": "riskRating",
  "Result code: ": "clearanceResult",
  "Action required: ": "actionRequired",
  "Checklist no.: ": "checklistNo",
  "Linked IR no.: ": "linkedIrNo",
  "Specification clause: ": "specClause",
  "Approved method stmt. no.: ": "methodStmtNo",
  "Location / grid: ": "location",
  "Activity / work: ": "activity",
  "Drawing reference: ": "drawingRef",
  "Requested date / time: ": "requestedDate",
  "Requested date: ": "requestedDate",
  "Contractor rep: ": "contractorRep",
  "Checklist / QAP reference: ": "checklistRef",
  "Work area: ": "location",
  "Activity / task: ": "activity",
  "Hazard category: ": "hazard",
  "Work permit / JSA: ": "permitRef",
  "Checklist: ": "checklistRef",
};

export function buildSpdcSubject(ref: InspectionFormRef, draft: Record<string, string>): string {
  const act = (draft.activityDescription || draft.activity || "").trim();
  if (act) return ref.subjectHint.replace("[activity]", act);
  return ref.subjectHint.replace(" [activity]", "").replace("[activity]", "");
}

export function buildSpdcBody(ref: InspectionFormRef, draft: Record<string, string>): string {
  const merged = { ...SPDC_FORM_DEFAULTS, ...draft };
  return ref.bodyTemplate
    .split("\n")
    .map((line) => {
      const key = BODY_LINE_MAP[line];
      if (key) return `${line}${merged[key] || ""}`;
      return line;
    })
    .join("\n");
}

export function parseFormDataJson(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function rfiUsesDrawingLink(kind: string): boolean {
  return kind === "RequestForInformation" || kind === "DrawingChecklist";
}

export function remarksTone(remarks?: string | null): "ok" | "warn" | "neutral" {
  if (/completed|cleared|s1/i.test(remarks || "")) return "ok";
  if (/pending|s2|condition/i.test(remarks || "")) return "warn";
  return "neutral";
}

export function remarksCellClass(remarks?: string | null): string {
  const tone = remarksTone(remarks);
  if (tone === "ok") return "bg-emerald-50 text-emerald-900 font-medium";
  if (tone === "warn") return "bg-amber-50 text-amber-900 font-medium";
  return "";
}

/** PMC / CLIENT checker role chips — matches client QAP colour language. */
export function qapRoleCellClass(role?: string | null): string {
  const r = (role || "").trim().toLowerCase();
  if (!r || r === "·" || r === "—") return "qap-role-empty";
  if (/approve/.test(r)) return "qap-role-approve";
  if (/review/.test(r)) return "qap-role-review";
  if (/witness/.test(r)) return "qap-role-witness";
  if (/random/.test(r)) return "qap-role-random";
  return "qap-role-neutral";
}

export function qapStatusRowClass(status?: string | null): string {
  if (status === "Done") return "qap-row-done";
  return "qap-row-open";
}

export function cubeResultRowClass(result?: string | null): string {
  const r = (result || "Pending").toLowerCase();
  if (/pass/.test(r)) return "cube-row-pass";
  if (/fail/.test(r)) return "cube-row-fail";
  return "cube-row-pending";
}

export function fmtRegisterNum(value?: number | null, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
