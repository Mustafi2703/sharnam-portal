import { CRM_BID_DISCIPLINES } from "./crmBidDisciplines";

const R2_BID_LABELS = new Set(CRM_BID_DISCIPLINES.map((d) => d.label.toLowerCase()));

export function isBidDisciplinePackageName(name: string) {
  return R2_BID_LABELS.has(name.trim().toLowerCase());
}

/** Strip R2 comparative bid sheet names from project work-package lists. */
export function sanitizeProjectWorkPackages(raw: unknown): string[] {
  const list = parseWorkPackagesField(raw);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of list) {
    if (isBidDisciplinePackageName(p)) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.sort();
}

export function parseWorkPackagesField(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String).map((s) => s.trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}
