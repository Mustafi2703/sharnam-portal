/** SPDC inspection / RFI reference layouts (client workbooks). */

export type InspectionRfiKind = "QualityInspection" | "SafetyChecklist" | "RequestForInformation";

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

export type InspectionFormRef = {
  workbook: string;
  title: string;
  subtitle: string;
  fields: { key: string; label: string; placeholder: string }[];
  subjectHint: string;
  bodyTemplate: string;
};

export const QUALITY_INSPECTION_FORM: InspectionFormRef = {
  workbook: "SPDC_Request_for_Inspection_Form.xlsx",
  title: "Request for Inspection — Quality",
  subtitle: "Site quality inspection request aligned to SPDC QI form (location, activity, drawing ref, requested date).",
  fields: [
    { key: "location", label: "Location / grid / level", placeholder: "e.g. Grid A–B / Level 2 slab" },
    { key: "activity", label: "Activity / work description", placeholder: "e.g. Reinforcement — column C1–C4" },
    { key: "drawingRef", label: "Drawing / revision", placeholder: "e.g. STR-COL-R0" },
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
};

export const SAFETY_INSPECTION_FORM: InspectionFormRef = {
  workbook: "SPDC_Safety_Inspection_Request_and_Checklists.xlsx",
  title: "Safety Inspection Request",
  subtitle: "Safety checklist RFI — hazard area, permit, and checklist type per SPDC safety workbook.",
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
};

export const RFI_REGISTER_REF = {
  workbook: "SPDC_RFI_Form_and_Register.xlsx",
  title: "RFI register format",
  columns: [
    "RFI No",
    "Date raised",
    "Subject",
    "Question / description",
    "Drawing ref",
    "Assigned to",
    "Status",
    "Schedule impact",
    "Cost impact",
    "Closed date",
  ],
};

export function inspectionFormForKind(kind: string): InspectionFormRef | null {
  if (kind === "QualityInspection") return QUALITY_INSPECTION_FORM;
  if (kind === "SafetyChecklist") return SAFETY_INSPECTION_FORM;
  return null;
}

export function remarksTone(remarks?: string | null): "ok" | "warn" | "neutral" {
  if (/completed/i.test(remarks || "")) return "ok";
  if (/pending/i.test(remarks || "")) return "warn";
  return "neutral";
}

export function remarksCellClass(remarks?: string | null): string {
  const tone = remarksTone(remarks);
  if (tone === "ok") return "bg-emerald-50 text-emerald-900 font-medium";
  if (tone === "warn") return "bg-amber-50 text-amber-900 font-medium";
  return "";
}
