/**
 * Per-project QAP settings: the library (activity → checks with frequency / code / test agency) and the pick-lists for
 * the responsibility and record columns. Stored in AppSetting; anything not customised uses the SPDC standard.
 */
import { QAP_PICKERS, type QapPickerKey } from "@sharnam/shared";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { loadQapLibrary, type QapLibraryActivity } from "./qapLibrary.js";

const libKey = (p: string) => `qapLibrary:${p}`;
const pickKey = (p: string) => `qapPickers:${p}`;
const t = (v: unknown, max = 200) => String(v ?? "").replace(/^[\s●•\-]+/, "").replace(/\s+/g, " ").trim().slice(0, max);

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

/** A library sheet in the client's Sheet2 layout: Activity · Description · Frequency · Code of Conformance · Test agency. */
export function parseQapLibraryWorkbook(buffer: Buffer): QapLibraryActivity[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const name =
    wb.SheetNames.find((n) => /^sheet2$|library/i.test(n)) ||
    wb.SheetNames.find((n) => {
      const top = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: "" }).slice(0, 6) as unknown[][];
      return top.some((r) => /activity/i.test(String(r[0] ?? "")) && /description/i.test(String(r[1] ?? "")));
    }) ||
    wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][];
  const out: QapLibraryActivity[] = [];
  let cur: QapLibraryActivity | null = null;
  const headerAt = rows.findIndex((r) => /activity/i.test(String(r[0] ?? "")) && /description/i.test(String(r[1] ?? "")));
  for (const r of rows.slice(headerAt >= 0 ? headerAt + 1 : 1)) {
    const activity = t(r[0], 120);
    const description = t(r[1], 300);
    if (activity) {
      cur = { activity, items: [] };
      out.push(cur);
    }
    if (cur && description) cur.items.push({ description, frequency: t(r[2]), codeOfConformance: t(r[3]), testAgency: t(r[4]) });
  }
  return out.filter((a) => a.items.length);
}

export const QAP_PICKER_EDITABLE: QapPickerKey[] = ["section", "frequency", "codeOfConformance", "testAgency", "contractorPerformer", "contractorChecker", "pmcRole", "clientRole", "records", "remarks"];

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
    const v = Array.isArray(input?.[k]) ? (input[k] as unknown[]).map((x) => t(x, 120)).filter(Boolean) : [];
    const std = QAP_PICKERS[k] as readonly string[];
    if (v.length && JSON.stringify(v) !== JSON.stringify(std)) next[k] = [...new Set(v)];
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
