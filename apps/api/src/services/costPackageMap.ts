/**
 * Map MB / BBS package names (Excel tab suffix) → BOQ monitoring package names.
 * Mirrors seed/costFromBudget.ts sheet → packageName mapping.
 */
export const MB_TO_MONITORING_PACKAGE: Record<string, string> = {
  "Dormitory Civil": "Civil Dormitory",
  Electric: "Electric",
  Plumbing: "Plumbing",
  UGWT: "UGWT",
  "Septic Tank": "Septic Tank",
  "Compound Wall": "External Development",
  "Road & Paving": "External Development",
  Windows: "Windows",
  Furniture: "Furniture",
  "WPC Door": "WPC Door",
  "Fire Fighting": "Fire Fighting",
  "Fire Alarm": "Fire Fighting",
  "Gas Line": "Gas Line",
  "External Electric": "External Electric",
};

export const BBS_TO_MONITORING_PACKAGE: Record<string, string> = {
  "Dormitory BBS": "Civil Dormitory",
  "Compound Wall BBS": "External Development",
  "Septic Tank BBS": "Septic Tank",
  "Road BBS": "External Development",
  "UGWT BBS": "UGWT",
};

export function monitoringPackageForMb(mbPackage: string): string {
  return MB_TO_MONITORING_PACKAGE[mbPackage] || mbPackage;
}

export function monitoringPackageForBbs(bbsPackage: string): string {
  return BBS_TO_MONITORING_PACKAGE[bbsPackage] || mbPackageFallback(bbsPackage);
}

function mbPackageFallback(name: string): string {
  return name.replace(/\s+BBS$/i, "").replace(/^Dormitory/i, "Civil Dormitory") || name;
}
