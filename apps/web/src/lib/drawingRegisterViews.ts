/** DRAWING REGISTER - 01.xlsx — sheet tabs for Drawings module */
export type DrawingRegisterSheetKey = "" | "master" | "site";

export const DRAWING_REGISTER_SHEET_VIEWS = [
  { key: "" as DrawingRegisterSheetKey, label: "Dashboard", sheet: "DRAWING REGISTER - 01.xlsx · Dashboard" },
  {
    key: "master" as DrawingRegisterSheetKey,
    label: "Master register",
    sheet: "Master Drawing Register",
  },
  { key: "site" as DrawingRegisterSheetKey, label: "Site register", sheet: "Site Drawing Register" },
];

export function drawingRegisterSheetFromParams(searchParams: URLSearchParams) {
  const raw = searchParams.get("sheet") || "";
  // Legacy client tab — merged into master (all client columns included there)
  const key = (raw === "client" ? "master" : raw) as DrawingRegisterSheetKey;
  return DRAWING_REGISTER_SHEET_VIEWS.find((s) => s.key === key) || DRAWING_REGISTER_SHEET_VIEWS[0];
}
