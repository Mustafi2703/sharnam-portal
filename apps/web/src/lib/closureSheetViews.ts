/** Project closure module sheet tabs */
export type ClosureSheetKey = "" | "snaglist" | "lessons" | "closure-report";

export const CLOSURE_SHEET_VIEWS = [
  { key: "" as ClosureSheetKey, label: "Overview", sheet: "Project closure hub" },
  { key: "snaglist" as ClosureSheetKey, label: "Snaglist", sheet: "Snaglist - Sharnam PMC.xlsx" },
  { key: "lessons" as ClosureSheetKey, label: "Lessons learnt", sheet: "Lessons Learnt - Sharnam PMC.xls" },
  { key: "closure-report" as ClosureSheetKey, label: "Closure report", sheet: "Project Closure Report.docx" },
];

export function closureSheetFromParams(searchParams: URLSearchParams) {
  const key = (searchParams.get("sheet") || "") as ClosureSheetKey;
  return CLOSURE_SHEET_VIEWS.find((s) => s.key === key) || CLOSURE_SHEET_VIEWS[0];
}
