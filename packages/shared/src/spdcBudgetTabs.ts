/**
 * SPDC_Budget_Arvind workbook tab names. Trim and case-fold before matching.
 * Anything else is ignored and listed as a skipped tab.
 */

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

export function foldTabName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function packageForTab(name: string, sheets: [string, string][]): string | null {
  const folded = foldTabName(name);
  for (const [sheet, pkg] of sheets) {
    if (foldTabName(sheet) === folded) return pkg;
  }
  return null;
}
