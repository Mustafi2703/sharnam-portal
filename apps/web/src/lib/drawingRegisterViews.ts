/** DRAWING REGISTER - 01.xlsx — sheet tabs for Drawings module */
export type DrawingRegisterSheetKey = "" | "master" | "client" | "site";

export const DRAWING_REGISTER_SHEET_VIEWS = [
  { key: "" as DrawingRegisterSheetKey, label: "Dashboard", sheet: "DRAWING REGISTER - 01.xlsx · Dashboard" },
  { key: "master" as DrawingRegisterSheetKey, label: "Master register", sheet: "Master Drawing Register" },
  { key: "client" as DrawingRegisterSheetKey, label: "Client register", sheet: "Drawing Register - Client" },
  { key: "site" as DrawingRegisterSheetKey, label: "Site register", sheet: "Site Drawing Register" },
];

export function drawingRegisterSheetFromParams(searchParams: URLSearchParams) {
  const key = (searchParams.get("sheet") || "") as DrawingRegisterSheetKey;
  return DRAWING_REGISTER_SHEET_VIEWS.find((s) => s.key === key) || DRAWING_REGISTER_SHEET_VIEWS[0];
}
