/** DRAWING REGISTER - 01.xlsx — sheet tabs for Drawings module */
export type DrawingRegisterSheetKey = "" | "master";

export const DRAWING_REGISTER_SHEET_VIEWS = [
  { key: "" as DrawingRegisterSheetKey, label: "Dashboard", sheet: "DRAWING REGISTER - 01.xlsx · Dashboard" },
  {
    key: "master" as DrawingRegisterSheetKey,
    label: "Master register",
    sheet: "Master Drawing Register",
  },
];

export function drawingRegisterSheetFromParams(searchParams: URLSearchParams) {
  const raw = searchParams.get("sheet") || "";
  // Legacy client / site tabs — merged into master (client columns included there)
  const key = (raw === "client" || raw === "site" ? "master" : raw) as DrawingRegisterSheetKey;
  return DRAWING_REGISTER_SHEET_VIEWS.find((s) => s.key === key) || DRAWING_REGISTER_SHEET_VIEWS[0];
}
