/** MB package → linked BBS tab (matches apps/api spdcBudgetManifest). */
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

/** Resolve API package filter for MB / BBS / monitoring flow tab. */
export function flowPackageForTab(tab: "mb" | "bbs" | "monitoring", selectedPackage: string): string {
  if (!selectedPackage || selectedPackage === "All") return selectedPackage;
  if (tab === "bbs") return linkedBbsPackage(selectedPackage);
  if (tab === "mb") return linkedMbPackage(selectedPackage) ?? selectedPackage;
  return selectedPackage;
}
