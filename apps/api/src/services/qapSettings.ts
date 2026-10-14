/**
 * Per-project QAP settings: the library (activity → checks with frequency / code / test agency) and the pick-lists for
 * the responsibility and record columns. Stored in AppSetting — same idea as quality/safety checklist masters:
 * each project gets a persisted copy of Week 50 activities they can edit and extend.
 */
import { QAP_PICKERS, type QapPickerKey } from "@sharnam/shared";
import fs from "fs";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import {
  loadQapLibrary,
  libraryFromPlanRows,
  mergeQapLibraries,
  parseQapLibraryRows,
  parseQapMasterLibraryFromWorkbook,
  resolveQapMasterWorkbookPath,
  type QapLibraryActivity,
} from "./qapLibrary.js";
import type { QapDetailRow } from "./qualityDashboardSheets.js";

const libKey = (p: string) => `qapLibrary:${p}`;
const pickKey = (p: string) => `qapPickers:${p}`;
const t = (v: unknown, max = 200) => String(v ?? "").replace(/^[\s●•\-]+/, "").replace(/\s+/g, " ").trim().slice(0, max);

export const QAP_PICKER_EDITABLE: QapPickerKey[] = [
  "section",
  "frequency",
  "codeOfConformance",
  "testAgency",
  "contractorPerformer",
  "contractorChecker",
  "pmcRole",
  "clientRole",
  "records",
  "remarks",
];

export async function getQapLibrary(projectId: string): Promise<{ library: QapLibraryActivity[]; custom: boolean }> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: libKey(projectId) } });
    if (row) {
      const lib = JSON.parse(row.value) as QapLibraryActivity[];
      if (Array.isArray(lib) && lib.length) return { library: lib, custom: true };
    }
  } catch {
    /* standard */
  }
  return { library: loadQapLibrary(), custom: false };
}

export function cleanLibrary(input: unknown): QapLibraryActivity[] {
  if (!Array.isArray(input)) return [];
  const out: QapLibraryActivity[] = [];
  for (const a of input as { activity?: unknown; items?: unknown }[]) {
    const activity = t(a?.activity, 120);
    if (!activity) continue;
    const items = (Array.isArray(a?.items) ? a.items : [])
      .map((i: { description?: unknown; frequency?: unknown; codeOfConformance?: unknown; testAgency?: unknown }) => ({
        description: t(i?.description, 300),
        frequency: t(i?.frequency),
        codeOfConformance: t(i?.codeOfConformance),
        testAgency: t(i?.testAgency),
      }))
      .filter((i: { description: string }) => i.description);
    out.push({ activity, items });
  }
  return out;
}

export async function saveQapLibrary(projectId: string, input: unknown, userId?: string) {
  const library = cleanLibrary(input);
  if (!library.length) throw new Error("The library needs at least one activity.");
  await prisma.appSetting.upsert({
    where: { key: libKey(projectId) },
    create: { key: libKey(projectId), value: JSON.stringify(library), updatedBy: userId || null },
    update: { value: JSON.stringify(library), updatedBy: userId || null },
  });
  return library;
}

/**
 * Parse a library-only Excel (Sheet2 layout) or a full Week 50 workbook (Sheet1 + Sheet2).
 * `strict` prefers a dedicated library sheet when present.
 */
export function parseQapLibraryWorkbook(buffer: Buffer, opts?: { strict?: boolean }): QapLibraryActivity[] {
  const master = parseQapMasterLibraryFromWorkbook(buffer);
  if (master.library.length) return master.library;

  const wb = XLSX.read(buffer, { type: "buffer" });
  const name =
    wb.SheetNames.find((n) => /^sheet2$|library/i.test(n)) ||
    wb.SheetNames.find((n) => {
      const top = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: "" }).slice(0, 8) as unknown[][];
      return top.some((r) => /activity/i.test(`${r?.[0] ?? ""} ${r?.[1] ?? ""}`) && /description/i.test(`${r?.[1] ?? ""} ${r?.[2] ?? ""}`));
    }) ||
    (opts?.strict ? "" : wb.SheetNames[0]);
  if (!name) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][];
  return parseQapLibraryRows(rows);
}

/** Merge standard pickers with values seen in the plan rows + library (project master lists). */
export function buildQapPickersFromMaster(
  library: QapLibraryActivity[],
  planRows: Array<Partial<QapDetailRow & { section?: string | null }>> = [],
): Record<string, string[]> {
  const out: Record<string, string[]> = Object.fromEntries(
    QAP_PICKER_EDITABLE.map((k) => [k, [...(QAP_PICKERS[k] as readonly string[])]]),
  );
  const add = (key: QapPickerKey, raw: unknown) => {
    const v = t(raw, 120);
    if (!v || !out[key]) return;
    if (!out[key].includes(v)) out[key].push(v);
  };
  for (const a of library) {
    add("section", a.activity);
    for (const i of a.items) {
      add("frequency", i.frequency);
      add("codeOfConformance", i.codeOfConformance);
      add("testAgency", i.testAgency);
    }
  }
  for (const r of planRows) {
    add("section", r.section);
    add("frequency", r.frequency);
    add("codeOfConformance", r.codeOfConformance);
    add("testAgency", r.testAgency);
    add("contractorPerformer", r.contractorPerformer);
    add("contractorChecker", r.contractorChecker);
    add("pmcRole", r.pmcRole);
    add("clientRole", r.clientRole);
    add("records", r.records);
    add("remarks", r.remarks);
  }
  return out;
}

export type QapMasterOnboardResult = {
  libraryActivities: number;
  libraryChecks: number;
  pickersCustom: string[];
  fromSheet1: number;
  fromSheet2: number;
  persisted: boolean;
  skipped?: boolean;
};

/**
 * Persist Week 50 (or upload) activity master + pick-lists onto a project — same role as
 * syncQualityChecklistCatalog for quality/safety checklist types.
 */
export async function onboardQapMasterForProject(
  projectId: string,
  buffer: Buffer | null,
  planRows: Array<Partial<QapDetailRow & { section?: string | null }>> = [],
  userId?: string,
  opts?: { force?: boolean },
): Promise<QapMasterOnboardResult> {
  if (!opts?.force) {
    const existing = await getQapLibrary(projectId);
    if (existing.custom && existing.library.length >= 10) {
      const pickers = await getQapPickers(projectId);
      return {
        libraryActivities: existing.library.length,
        libraryChecks: existing.library.reduce((n, a) => n + a.items.length, 0),
        pickersCustom: pickers.custom,
        fromSheet1: 0,
        fromSheet2: 0,
        persisted: true,
        skipped: true,
      };
    }
  }

  let library: QapLibraryActivity[] = [];
  let fromSheet1 = 0;
  let fromSheet2 = 0;

  if (buffer?.length) {
    const master = parseQapMasterLibraryFromWorkbook(buffer);
    library = master.library;
    fromSheet1 = master.fromSheet1;
    fromSheet2 = master.fromSheet2;
  }

  if (planRows.length) {
    library = mergeQapLibraries(libraryFromPlanRows(planRows), library);
  }

  if (!library.length) {
    library = loadQapLibrary();
    fromSheet1 = library.length;
  }

  if (library.length) await saveQapLibrary(projectId, library, userId);
  const pickers = buildQapPickersFromMaster(library, planRows);
  const saved = await saveQapPickers(projectId, pickers, userId);
  return {
    libraryActivities: library.length,
    libraryChecks: library.reduce((n, a) => n + a.items.length, 0),
    pickersCustom: saved.custom,
    fromSheet1,
    fromSheet2,
    persisted: library.length > 0,
  };
}

/** Load bundled Week 50 into this project's QAP master (library + pickers). Idempotent unless force. */
export async function syncQapMasterForProject(
  projectId: string,
  userId?: string,
  opts?: { force?: boolean },
): Promise<QapMasterOnboardResult & { source: string | null }> {
  const file = resolveQapMasterWorkbookPath();
  const buffer = file ? fs.readFileSync(file) : null;
  const out = await onboardQapMasterForProject(projectId, buffer, [], userId, opts);
  return { ...out, source: file };
}

/** Onboard QAP master activities + pickers for every project (like checklist catalog assignment). */
export async function syncQapMasterForAllProjects(
  userId?: string,
  opts?: { force?: boolean },
): Promise<{ projects: number; results: Array<{ projectId: string; code: string } & QapMasterOnboardResult> }> {
  const projects = await prisma.project.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } });
  const results: Array<{ projectId: string; code: string } & QapMasterOnboardResult> = [];
  for (const p of projects) {
    const out = await syncQapMasterForProject(p.id, userId, opts);
    results.push({ projectId: p.id, code: p.code, ...out });
  }
  return { projects: projects.length, results };
}

/** Ensure this project has a persisted library before the master UI / Add-from-library opens. */
export async function ensureQapMasterForProject(projectId: string, userId?: string): Promise<QapMasterOnboardResult> {
  return syncQapMasterForProject(projectId, userId, { force: false });
}

export async function getQapPickers(projectId: string): Promise<{ lists: Record<string, string[]>; custom: string[] }> {
  const lists: Record<string, string[]> = Object.fromEntries(Object.entries(QAP_PICKERS).map(([k, v]) => [k, [...(v as readonly string[])]]));
  const custom: string[] = [];
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: pickKey(projectId) } });
    const saved = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
    for (const k of QAP_PICKER_EDITABLE) {
      const v = Array.isArray(saved[k]) ? (saved[k] as unknown[]).map((x) => t(x, 120)).filter(Boolean) : [];
      if (v.length) {
        lists[k] = [...new Set(v)];
        custom.push(k);
      }
    }
  } catch {
    /* standard */
  }
  return { lists, custom };
}

export async function saveQapPickers(projectId: string, input: Record<string, unknown>, userId?: string) {
  const next: Record<string, string[]> = {};
  for (const k of QAP_PICKER_EDITABLE) {
    const v = Array.isArray(input?.[k])
      ? [...new Set((input[k] as unknown[]).map((x) => t(x, 120)).filter(Boolean))]
      : [];
    const std = [...(QAP_PICKERS[k] as readonly string[])];
    const same =
      v.length === std.length && v.every((x) => std.includes(x)) && std.every((x) => v.includes(x));
    if (v.length && !same) next[k] = v;
  }
  if (!Object.keys(next).length) await prisma.appSetting.deleteMany({ where: { key: pickKey(projectId) } });
  else
    await prisma.appSetting.upsert({
      where: { key: pickKey(projectId) },
      create: { key: pickKey(projectId), value: JSON.stringify(next), updatedBy: userId || null },
      update: { value: JSON.stringify(next), updatedBy: userId || null },
    });
  return getQapPickers(projectId);
}

export async function resetQapSettings(projectId: string, what: "library" | "pickers" | "all") {
  const keys = what === "library" ? [libKey(projectId)] : what === "pickers" ? [pickKey(projectId)] : [libKey(projectId), pickKey(projectId)];
  await prisma.appSetting.deleteMany({ where: { key: { in: keys } } });
}
