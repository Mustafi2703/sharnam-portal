/**
 * Client QAP activity master — Quality Assurance Plan Week 50.xlsx:
 * - Sheet1 = full activity → checks library (Site Survey, Excavation, Concreting…)
 * - Sheet2 = materials / lab supplement (Reinforcement, Cement, Aggregate…)
 * Projects get a persisted copy so they can edit like checklist masters.
 */
import fs from "fs";
import XLSX from "../lib/xlsx.js";
import { findWorkbook } from "../lib/excelRoot.js";

export type QapLibraryItem = { description: string; frequency: string; codeOfConformance: string; testAgency: string };
export type QapLibraryActivity = { activity: string; items: QapLibraryItem[] };

let cache: QapLibraryActivity[] | null = null;

const clean = (v: unknown) => String(v ?? "").replace(/^[\s●•\-]+/, "").replace(/\s+/g, " ").trim();

/** Week 50 Sheet2 is often Activity | (blank) | Description | Frequency | Code | Test agency. */
export function detectQapLibraryColumns(header: unknown[]): {
  activity: number;
  description: number;
  frequency: number;
  code: number;
  agency: number;
} {
  const h = (i: number) => String(header?.[i] ?? "").toLowerCase();
  if (/activity/.test(h(0)) && !/description/.test(h(1)) && /description/.test(h(2))) {
    return { activity: 0, description: 2, frequency: 3, code: 4, agency: 5 };
  }
  /** Sheet1 plan: Sr.No | Activity | Description | Frequency | Code | Test agency */
  if (/sr\.?\s*no/.test(h(0)) && /activity/.test(h(1)) && /description/.test(h(2))) {
    return { activity: 1, description: 2, frequency: 3, code: 4, agency: 5 };
  }
  return { activity: 0, description: 1, frequency: 2, code: 3, agency: 4 };
}

export function parseQapLibraryRows(rows: unknown[][]): QapLibraryActivity[] {
  if (!rows.length) return [];
  const headerAt = rows.findIndex((r) => {
    const a = String(r?.[0] ?? "");
    const b = String(r?.[1] ?? "");
    const c = String(r?.[2] ?? "");
    const joined = `${a} ${b} ${c}`;
    return /activity/i.test(joined) && /description/i.test(joined);
  });
  const start = headerAt >= 0 ? headerAt : 0;
  const cols = detectQapLibraryColumns(rows[start] || []);
  const out: QapLibraryActivity[] = [];
  let current: QapLibraryActivity | null = null;
  for (const r of rows.slice(start + 1)) {
    const activity = clean(r?.[cols.activity]);
    const description = clean(r?.[cols.description]);
    if (activity) {
      current = out.find((a) => a.activity.toLowerCase() === activity.toLowerCase()) || null;
      if (!current) {
        current = { activity, items: [] };
        out.push(current);
      }
    }
    if (!current || !description) continue;
    if (current.items.some((i) => i.description.toLowerCase() === description.toLowerCase())) continue;
    current.items.push({
      description,
      frequency: clean(r?.[cols.frequency]),
      codeOfConformance: clean(r?.[cols.code]),
      testAgency: clean(r?.[cols.agency]),
    });
  }
  return out.filter((a) => a.items.length);
}

/** Merge secondary activities/checks into primary (primary order wins; new activities append). */
export function mergeQapLibraries(primary: QapLibraryActivity[], secondary: QapLibraryActivity[]): QapLibraryActivity[] {
  const out = primary.map((a) => ({ activity: a.activity, items: a.items.map((i) => ({ ...i })) }));
  const byName = new Map(out.map((a) => [a.activity.toLowerCase(), a]));
  for (const a of secondary) {
    const key = a.activity.toLowerCase();
    let cur = byName.get(key);
    if (!cur) {
      cur = { activity: a.activity, items: [] };
      out.push(cur);
      byName.set(key, cur);
    }
    for (const item of a.items) {
      if (!cur.items.some((i) => i.description.toLowerCase() === item.description.toLowerCase())) {
        cur.items.push({ ...item });
      }
    }
  }
  return out.filter((a) => a.items.length);
}

export function libraryFromPlanRows(
  rows: Array<{
    section?: string | null;
    description?: string | null;
    frequency?: string | null;
    codeOfConformance?: string | null;
    testAgency?: string | null;
  }>,
): QapLibraryActivity[] {
  const out: QapLibraryActivity[] = [];
  const byName = new Map<string, QapLibraryActivity>();
  for (const r of rows) {
    const activity = clean(r.section);
    const description = clean(r.description);
    if (!activity || !description) continue;
    let cur = byName.get(activity.toLowerCase());
    if (!cur) {
      cur = { activity, items: [] };
      out.push(cur);
      byName.set(activity.toLowerCase(), cur);
    }
    if (cur.items.some((i) => i.description.toLowerCase() === description.toLowerCase())) continue;
    cur.items.push({
      description,
      frequency: clean(r.frequency),
      codeOfConformance: clean(r.codeOfConformance),
      testAgency: clean(r.testAgency),
    });
  }
  return out.filter((a) => a.items.length);
}

/** Parse Week 50 (or similar): Sheet1 plan first, then merge Sheet2 materials library. */
export function parseQapMasterLibraryFromWorkbook(buffer: Buffer): {
  library: QapLibraryActivity[];
  fromSheet1: number;
  fromSheet2: number;
  sheetNames: string[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = wb.SheetNames || [];
  let fromSheet1: QapLibraryActivity[] = [];
  let fromSheet2: QapLibraryActivity[] = [];

  const sheet1Name =
    sheetNames.find((n) => /^sheet1$/i.test(n)) ||
    sheetNames.find((n) => /detail|quality assurance plan/i.test(n) && !/sheet2|library/i.test(n));
  if (sheet1Name) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet1Name], { header: 1, defval: "" }) as unknown[][];
    fromSheet1 = parseQapLibraryRows(rows);
  }

  const sheet2Name = sheetNames.find((n) => /^sheet2$|library/i.test(n));
  if (sheet2Name) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet2Name], { header: 1, defval: "" }) as unknown[][];
    fromSheet2 = parseQapLibraryRows(rows);
  }

  /** Prefer the richer sheet as base (Sheet1 ~295 checks vs Sheet2 ~41). */
  let library: QapLibraryActivity[];
  if (fromSheet1.length && fromSheet2.length) {
    library =
      fromSheet1.reduce((n, a) => n + a.items.length, 0) >= fromSheet2.reduce((n, a) => n + a.items.length, 0)
        ? mergeQapLibraries(fromSheet1, fromSheet2)
        : mergeQapLibraries(fromSheet2, fromSheet1);
  } else {
    library = fromSheet1.length ? fromSheet1 : fromSheet2;
  }

  return {
    library,
    fromSheet1: fromSheet1.length,
    fromSheet2: fromSheet2.length,
    sheetNames,
  };
}

export function resolveQapMasterWorkbookPath(): string | null {
  return findWorkbook(["Quality Assurance Plan Week 50.xlsx"]);
}

export function loadQapLibrary(): QapLibraryActivity[] {
  if (cache) return cache;
  const file = resolveQapMasterWorkbookPath();
  if (!file) return [];
  const parsed = parseQapMasterLibraryFromWorkbook(fs.readFileSync(file));
  cache = parsed.library;
  return cache;
}

/** Clear cached Sheet1/Sheet2 parse (tests / after replacing the master file). */
export function clearQapLibraryCache() {
  cache = null;
}
