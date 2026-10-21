/**
 * Per-project pick-lists for the Drawings module, managed from the Master Drawing Register and used by the
 * register, the GFC upload, RFIs and design coordination, so every screen offers the same choices.
 * Stored as one JSON row in AppSetting (key `drawingPicklists:<projectId>`); anything not overridden uses the default.
 */
import { effectiveDrawingsStart, istDayKey, PICKLIST_DEFAULTS, type PicklistKey } from "@sharnam/shared";
import { prisma } from "../prisma.js";

export { PICKLIST_DEFAULTS, type PicklistKey };
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
  const raw = await readDrawingSettings(projectId);
  await writeDrawingSettings(projectId, { ...next, ...startDateEntry(raw.drawingsStartDate) }, userId);
  return loadPicklists(projectId);
}

/** Clears every custom pick-list but keeps the drawings start date. */
export async function resetPicklists(projectId: string, userId?: string) {
  const raw = await readDrawingSettings(projectId);
  await writeDrawingSettings(projectId, startDateEntry(raw.drawingsStartDate), userId);
}

const START_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function startDateEntry(value: unknown): { drawingsStartDate?: string } {
  return typeof value === "string" && START_DATE_RE.test(value) ? { drawingsStartDate: value } : {};
}

async function readDrawingSettings(projectId: string): Promise<Record<string, unknown>> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: settingKey(projectId) } });
    const parsed = row ? JSON.parse(row.value) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function writeDrawingSettings(projectId: string, value: Record<string, unknown>, userId?: string) {
  if (!Object.keys(value).length) {
    await prisma.appSetting.deleteMany({ where: { key: settingKey(projectId) } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key: settingKey(projectId) },
    create: { key: settingKey(projectId), value: JSON.stringify(value), updatedBy: userId || null },
    update: { value: JSON.stringify(value), updatedBy: userId || null },
  });
}

/** Drawings start date (yyyy-mm-dd) set in Drawing Settings, or null. */
export async function loadDrawingsStartDate(projectId: string): Promise<string | null> {
  const raw = await readDrawingSettings(projectId);
  return startDateEntry(raw.drawingsStartDate).drawingsStartDate ?? null;
}

/** Saves (or clears with null) the drawings start date without touching the pick-lists. */
export async function saveDrawingsStartDate(projectId: string, value: string | null, userId?: string) {
  if (value != null && !START_DATE_RE.test(value)) throw new Error("drawingsStartDate must be yyyy-mm-dd");
  const raw = await readDrawingSettings(projectId);
  const { drawingsStartDate: _old, ...rest } = raw;
  await writeDrawingSettings(projectId, { ...rest, ...startDateEntry(value) }, userId);
  return loadDrawingsStartDate(projectId);
}

/** Week 1 anchor for the drawings register: Drawing Settings date, else the project start date. */
export async function loadDrawingsWeekStart(projectId: string): Promise<{
  drawingsStartDate: string | null;
  projectStartDate: string | null;
  effectiveStart: string | null;
}> {
  const [drawingsStartDate, project] = await Promise.all([
    loadDrawingsStartDate(projectId),
    prisma.project.findUnique({ where: { id: projectId }, select: { startDate: true } }),
  ]);
  const projectStartDate = istDayKey(project?.startDate ?? null);
  return { drawingsStartDate, projectStartDate, effectiveStart: effectiveDrawingsStart(drawingsStartDate, projectStartDate) };
}
