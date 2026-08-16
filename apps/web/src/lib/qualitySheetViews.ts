/** Quality Dashboard.xlsx — sheet tabs for Quality module UI */
export type QualitySheetKey =
  | ""
  | "sor-log"
  | "checklist-summary"
  | "car-register"
  | "cube-test"
  | "qap-detail"
  | "qi";

export const QUALITY_SHEET_VIEWS: {
  key: QualitySheetKey;
  label: string;
  sheet: string;
  kpiOnly?: boolean;
}[] = [
  {
    key: "",
    label: "Dashboard",
    sheet: "Quality Dashboard.xlsx · Dashboard",
    kpiOnly: true,
  },
  {
    key: "sor-log",
    label: "SOR Log",
    sheet: "SOR Log",
    kpiOnly: true,
  },
  {
    key: "checklist-summary",
    label: "Checklist summary",
    sheet: "Sheet1 / Sheet2",
    kpiOnly: true,
  },
  {
    key: "car-register",
    label: "CAR / NCR register",
    sheet: "CAR register · NCR 01",
  },
  {
    key: "cube-test",
    label: "Cube Test",
    sheet: "Cube Test · SPDC Cube Register",
  },
  {
    key: "qap-detail",
    label: "QAP Detail",
    sheet: "Quality Assurance Plan - Detail",
  },
  {
    key: "qi",
    label: "QI & checklist fills",
    sheet: "Procore QI + QI fills → DPR Quality section",
  },
];

export function qualitySheetFromParams(searchParams: URLSearchParams): (typeof QUALITY_SHEET_VIEWS)[number] {
  const legacy = searchParams.get("view");
  if (legacy === "ncr") {
    return QUALITY_SHEET_VIEWS.find((s) => s.key === "car-register") || QUALITY_SHEET_VIEWS[0];
  }
  if (legacy === "cube") {
    return QUALITY_SHEET_VIEWS.find((s) => s.key === "cube-test") || QUALITY_SHEET_VIEWS[0];
  }
  if (legacy === "qi") {
    return QUALITY_SHEET_VIEWS.find((s) => s.key === "qi") || QUALITY_SHEET_VIEWS[6];
  }
  const key = (searchParams.get("sheet") || "") as QualitySheetKey;
  return QUALITY_SHEET_VIEWS.find((s) => s.key === key) || QUALITY_SHEET_VIEWS[0];
}
