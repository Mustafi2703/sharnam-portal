/**
 * Per-project pick-lists for the Drawings module — managed from the Master Drawing Register and used by the
 * register, the GFC upload, RFIs and design coordination, so every screen offers the same choices.
 * Stored as one JSON row in AppSetting (key `drawingPicklists:<projectId>`); anything not overridden uses the default.
 */
import { prisma } from "../prisma.js";

export const PICKLIST_DEFAULTS = {
  drawingTypes: ["Concept Drawings", "Schematic Drawings", "Detailed Design (DD) Drawings", "Tender Drawings", "Good For Construction (GFC)"],
  disciplines: ["Architecture", "Structural", "MEPF"],
  delayResponsibility: ["Architecture Consultant", "Structural Consultant", "MEPF Consultant", "BIM Consultant", "Contractor", "PMC"],
  issuedTo: ["Main Contractor", "PMC / Client"],
  rfiPriorities: ["CRITICAL", "HIGH", "NORMAL", "LOW"],
  rfiCategories: ["Drawing discrepancy", "Missing information", "Design clarification", "Specification conflict", "Site constraint", "Material substitution", "Statutory requirement", "Interface / coordination"],
  impactLevels: ["None", "Low", "Medium", "High"],
  coordinationPriorities: ["Low", "Medium", "High", "Critical"],
} as const;

export type PicklistKey = keyof typeof PICKLIST_DEFAULTS;
export const PICKLIST_KEYS = Object.keys(PICKLIST_DEFAULTS) as PicklistKey[];
export type Picklists = Record<PicklistKey, string[]>;

const settingKey = (projectId: string) => `drawingPicklists:${projectId}`;

function clean(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
    if (out.length >= 60) break;
  }
  return out;
}

export function defaultPicklists(): Picklists {
  return Object.fromEntries(PICKLIST_KEYS.map((k) => [k, [...PICKLIST_DEFAULTS[k]]])) as Picklists;
}

export async function loadPicklists(projectId: string): Promise<{ lists: Picklists; custom: PicklistKey[] }> {
  const lists = defaultPicklists();
  const custom: PicklistKey[] = [];
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: settingKey(projectId) } });
    const saved = row ? (JSON.parse(row.value) as Partial<Record<PicklistKey, unknown>>) : {};
    for (const k of PICKLIST_KEYS) {
      const v = clean(saved[k]);
      if (v.length) {
        lists[k] = v;
        custom.push(k);
      }
    }
  } catch {
    /* defaults */
  }
  return { lists, custom };
}

export async function savePicklists(projectId: string, input: Partial<Record<PicklistKey, unknown>>, userId?: string) {
  const current = await loadPicklists(projectId);
  const next: Partial<Record<PicklistKey, string[]>> = {};
  for (const k of PICKLIST_KEYS) {
    const given = k in input ? clean(input[k]) : null;
    // Only store a list that differs from the default; an empty list resets that one.
    const value = given === null ? (current.custom.includes(k) ? current.lists[k] : null) : given;
    if (value && value.length && JSON.stringify(value) !== JSON.stringify(PICKLIST_DEFAULTS[k])) next[k] = value;
  }
  if (!Object.keys(next).length) {
    await prisma.appSetting.deleteMany({ where: { key: settingKey(projectId) } });
  } else {
    await prisma.appSetting.upsert({
      where: { key: settingKey(projectId) },
      create: { key: settingKey(projectId), value: JSON.stringify(next), updatedBy: userId || null },
      update: { value: JSON.stringify(next), updatedBy: userId || null },
    });
  }
  return loadPicklists(projectId);
}
