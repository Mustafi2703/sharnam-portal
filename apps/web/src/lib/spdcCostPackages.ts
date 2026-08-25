/** MB package → linked BBS tab (matches apps/api spdcBudgetManifest). */
export const SPDC_MB_TO_BBS_PACKAGE: Record<string, string> = {
  "Dormitory Civil": "Dormitory BBS",
  "Compound Wall": "Compound Wall BBS",
  "Septic Tank": "Septic Tank BBS",
  "Road & Paving": "Road BBS",
  UGWT: "UGWT BBS",
};

/** BOQ monitoring package → MB sheet package. */
export const MONITORING_TO_MB_PACKAGE: Record<string, string> = {
  "Civil Dormitory": "Dormitory Civil",
  "External Development": "Compound Wall",
  Electric: "Electric",
  Plumbing: "Plumbing",
  UGWT: "UGWT",
  "Septic Tank": "Septic Tank",
  Windows: "Windows",
  Furniture: "Furniture",
  "WPC Door": "WPC Door",
  "Fire Fighting": "Fire Fighting",
  "Gas Line": "Gas Line",
  "External Electric": "External Electric",
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

export function mbPackageForSelection(selectedPackage: string): string {
  return linkedMbPackage(selectedPackage) ?? MONITORING_TO_MB_PACKAGE[selectedPackage] ?? selectedPackage;
}

/** Resolve API package filter for MB / BBS / monitoring flow tab. */
export function flowPackageForTab(tab: "mb" | "bbs" | "monitoring", selectedPackage: string): string {
  if (!selectedPackage || selectedPackage === "All") return selectedPackage;
  const mbPkg = mbPackageForSelection(selectedPackage);
  if (tab === "bbs") return linkedBbsPackage(mbPkg);
  if (tab === "mb") return mbPkg;
  return selectedPackage;
}
