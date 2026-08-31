/** CRM bid BOQ disciplines — mirrors Comparative Statement R2 sheets. */
export const CRM_BID_DISCIPLINES = [
  { key: "CCV", label: "Civil & Structural (CCV)", sheetName: "BOQ-CCV", tradeHints: ["civil", "structural", "ccv", "main contractor"] },
  { key: "ELE_LAB", label: "Electrical Lab", sheetName: "BOQ ELE. LAB", tradeHints: ["electrical", "ele", "lab"] },
  { key: "ADMIN", label: "Admin Building", sheetName: "BOQ-ADMIN", tradeHints: ["admin", "building"] },
  { key: "SECURITY", label: "Security", sheetName: "BOQ -SECURITY", tradeHints: ["security", "cctv"] },
  { key: "COOLING_TOWER", label: "Cooling Tower", sheetName: "BOQ -COOLING TOWER", tradeHints: ["cooling", "tower", "hvac"] },
  { key: "WEIGH_BRIDGE", label: "Weigh Bridge", sheetName: "BOQ -WEIGH BRIDGE", tradeHints: ["weigh", "bridge"] },
  { key: "UG_TANK", label: "U.G Tank + Pump Room", sheetName: "BOQ -U.G TANK WITH PUMP ROOM", tradeHints: ["tank", "ug", "pump"] },
  { key: "ENTRANCE_GATE", label: "Entrance Gate", sheetName: "BOQ -ENTRANCE GATE", tradeHints: ["gate", "entrance", "peb"] },
] as const;

export type CrmBidDisciplineKey = (typeof CRM_BID_DISCIPLINES)[number]["key"];

/** Parse comma-separated discipline keys or labels stored in vendor.trade */
export function parseVendorBidDisciplines(trade?: string | null): string[] {
  if (!trade?.trim()) return [];
  const parts = trade.split(/[,;|/]+/).map((p) => p.trim()).filter(Boolean);
  const keys = new Set<string>();
  for (const part of parts) {
    const upper = part.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    const byKey = CRM_BID_DISCIPLINES.find((d) => d.key === upper || d.key === part);
    if (byKey) {
      keys.add(byKey.key);
      continue;
    }
    const byLabel = CRM_BID_DISCIPLINES.find(
      (d) => d.label.toLowerCase() === part.toLowerCase() || d.sheetName.toLowerCase() === part.toLowerCase()
    );
    if (byLabel) keys.add(byLabel.key);
  }
  return [...keys];
}

export function vendorMatchesBidDisciplines(
  vendor: { trade?: string | null; partyType?: string | null },
  disciplineKeys: string[]
): boolean {
  if (!disciplineKeys.length) return true;
  const tagged = parseVendorBidDisciplines(vendor.trade);
  if (tagged.length) return disciplineKeys.some((k) => tagged.includes(k));
  const trade = (vendor.trade || "").toLowerCase();
  if (!trade) return vendor.partyType === "Contractor";
  return disciplineKeys.some((key) => {
    const def = CRM_BID_DISCIPLINES.find((d) => d.key === key);
    if (!def) return false;
    return def.tradeHints.some((h) => trade.includes(h));
  });
}

export function formatVendorBidDisciplines(keys: string[]): string {
  return keys
    .map((k) => CRM_BID_DISCIPLINES.find((d) => d.key === k)?.label || k)
    .join(", ");
}
