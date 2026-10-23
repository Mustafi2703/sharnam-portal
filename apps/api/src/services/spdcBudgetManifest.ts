/**
 * SPDC_Budget_Arvind 49.xls — canonical tab list (36 sheets).
 * Tab names live in packages/shared. This file re-exports them for seed and parsers.
 */
import { SPDC_BBS_SHEETS, SPDC_MB_SHEETS, SPDC_MONITORING_SHEETS } from "@sharnam/shared";

export { SPDC_BBS_SHEETS, SPDC_MB_SHEETS, SPDC_MONITORING_SHEETS };

/** Budget WBS — first data row is Excel row 8 (0-based index 7). XLSX drops empty col A: [0]=Sr, [1]=Desc. */
export const SPDC_BUDGET_DATA_START_ROW = 7;

/** MB package → linked BBS tab (SPDC sheet flow). */
export const SPDC_MB_TO_BBS_PACKAGE: Record<string, string> = {
  "Dormitory Civil": "Dormitory BBS",
  "Compound Wall": "Compound Wall BBS",
  "Septic Tank": "Septic Tank BBS",
  "Road & Paving": "Road BBS",
  UGWT: "UGWT BBS",
};

export function linkedBbsPackage(mbPackage: string): string {
  return SPDC_MB_TO_BBS_PACKAGE[mbPackage] ?? mbPackage;
}

export function linkedMbPackage(bbsPackage: string): string | undefined {
  for (const [mb, bbs] of Object.entries(SPDC_MB_TO_BBS_PACKAGE)) {
    if (bbs === bbsPackage) return mb;
  }
  return undefined;
}

export const SPDC_RATE_SHEETS = [
  { sheet: "STEEL RATE DIFFRENCE", material: "Steel" as const },
  { sheet: "CEMENT RATE DIFFRENCE", material: "Cement" as const },
  { sheet: "Tiles Rate Difference", material: "Tiles" as const },
];

/** All 36 workbook tabs in sheet order */
export const SPDC_WORKBOOK_SHEET_NAMES = [
  "Budget",
  ...SPDC_MONITORING_SHEETS.map(([s]) => s),
  ...SPDC_MB_SHEETS.map(([s]) => s),
  ...SPDC_BBS_SHEETS.map(([s]) => s),
  ...SPDC_RATE_SHEETS.map((r) => r.sheet),
] as const;

export const COST_SHEET_TOOLS = {
  cashflow: [
    { id: "chart", label: "Cash Flow Chart", source: "Cashflow - Dashboard.xlsx" },
    { id: "forecast", label: "Cash Flow Forecast", source: "Cashflow - Dashboard.xlsx" },
    { id: "tracking", label: "Tracking", source: "Cashflow - Dashboard.xlsx" },
  ],
  monitoringPackages: SPDC_MONITORING_SHEETS.map(([, pkg]) => pkg),
  mbPackages: SPDC_MB_SHEETS.map(([, pkg]) => pkg),
  bbsPackages: SPDC_BBS_SHEETS.map(([, pkg]) => pkg),
};
