/**
 * SPDC_Budget_Arvind 49.xls — canonical tab list (36 sheets).
 * Single source for seed, upload parsers, and verify.
 */

/** Budget WBS — first data row is Excel row 8 (0-based index 7). XLSX drops empty col A: [0]=Sr, [1]=Desc. */
export const SPDC_BUDGET_DATA_START_ROW = 7;

export const SPDC_MONITORING_SHEETS: [string, string][] = [
  ["Monitoring Combined", "Combined"],
  ["Monitoring Civil Dormitory", "Civil Dormitory"],
  ["Monitoring Electric", "Electric"],
  ["Monitoring Plumbing", "Plumbing"],
  ["Monitoring UGWT", "UGWT"],
  ["Monitoring Septic Tank", "Septic Tank"],
  ["Monitoring External Dev", "External Development"],
  ["Monitoring Windows", "Windows"],
  ["Monitoring Furniture ", "Furniture"],
  ["Monitoring WPC Door", "WPC Door"],
  ["Monitoring Fire Fighting", "Fire Fighting"],
  ["Monitoring Gas", "Gas Line"],
  ["Monitoring External Electric", "External Electric"],
];

export const SPDC_MB_SHEETS: [string, string][] = [
  ["DORMITORY MB", "Dormitory Civil"],
  ["Electric MB", "Electric"],
  ["Plumbing MB", "Plumbing"],
  ["UGWT MB", "UGWT"],
  ["Septic Tank", "Septic Tank"],
  ["Compound Wall", "Compound Wall"],
  ["Road & Paving", "Road & Paving"],
  ["Windows ", "Windows"],
  ["Furniture", "Furniture"],
  ["WPC Door", "WPC Door"],
  ["Fire Fighting", "Fire Fighting"],
  ["Fire Alarm", "Fire Alarm"],
  ["Gas Line", "Gas Line"],
  ["External Electric", "External Electric"],
];

export const SPDC_BBS_SHEETS: [string, string][] = [
  ["DORMITORY BBS", "Dormitory BBS"],
  ["Compound Wall BBS", "Compound Wall BBS"],
  ["Septic Tank BBS", "Septic Tank BBS"],
  ["Road BBS", "Road BBS"],
  ["UGWT BBS", "UGWT BBS"],
];

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
