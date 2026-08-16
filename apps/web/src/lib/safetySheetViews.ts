/** Safety Dashboard.xlsx + Safety NCR.xlsx — sheet tabs for Safety module UI */
export type SafetySheetKey =
  | ""
  | "site-instruction"
  | "unsafe-act-summary"
  | "ncr-summary"
  | "ncr-form"
  | "observation"
  | "hira"
  | "safety-hours";

export type SafetyRecordRow = {
  id?: string;
  recordType?: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  category?: string | null;
  status?: string;
  source?: string | null;
  ncrNumber?: string | null;
  timeImpact?: string | null;
  occurredAt?: string;
};

export const SAFETY_SHEET_VIEWS: {
  key: SafetySheetKey;
  label: string;
  sheet: string;
  kpiOnly?: boolean;
  filter?: (r: SafetyRecordRow) => boolean;
}[] = [
  {
    key: "",
    label: "One Pager",
    sheet: "Safety Dashboard.xlsx · One Pager",
  },
  {
    key: "site-instruction",
    label: "Site Instruction",
    sheet: "Site Instruction",
    filter: (r) => r.recordType === "Site Instruction",
  },
  {
    key: "unsafe-act-summary",
    label: "Unsafe Act Summary",
    sheet: "Unsafe Act Summary",
    filter: (r) =>
      r.recordType === "Observation" &&
      r.source === "Safety Dashboard.xlsx" &&
      /^Observation #/i.test(r.title || ""),
  },
  {
    key: "ncr-summary",
    label: "NCR Summary",
    sheet: "NCR Summary",
    filter: (r) => r.recordType === "NCR" && r.source === "Safety Dashboard.xlsx",
  },
  {
    key: "ncr-form",
    label: "NCR Form",
    sheet: "Safety NCR.xlsx · NCR",
    filter: (r) => r.recordType === "NCR" && r.source === "Safety NCR.xlsx",
  },
  {
    key: "observation",
    label: "Observation — Unsafe Act",
    sheet: "Observation - Unsafe Act",
    filter: (r) => (r.title || "").startsWith("Unsafe act"),
  },
  {
    key: "hira",
    label: "HIRA",
    sheet: "HIRA",
    filter: (r) => r.recordType === "JHA",
  },
  {
    key: "safety-hours",
    label: "Safety Hours",
    sheet: "Safety Hours",
    kpiOnly: true,
  },
];

export function safetySheetFromParams(searchParams: URLSearchParams): (typeof SAFETY_SHEET_VIEWS)[number] {
  if (searchParams.get("view") === "ncr") {
    return SAFETY_SHEET_VIEWS.find((s) => s.key === "ncr-summary") || SAFETY_SHEET_VIEWS[0];
  }
  const key = (searchParams.get("sheet") || "") as SafetySheetKey;
  return SAFETY_SHEET_VIEWS.find((s) => s.key === key) || SAFETY_SHEET_VIEWS[0];
}
