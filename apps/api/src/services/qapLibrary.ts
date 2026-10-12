/**
 * The client's QAP library — "Quality Assurance Plan Week 50.xlsx", Sheet2: for each activity, the checks with their
 * frequency, code of conformance and test agency. Used to add QAP lines in the exact plan wording.
 */
import XLSX from "../lib/xlsx.js";
import { findWorkbook } from "../lib/excelRoot.js";

export type QapLibraryItem = { description: string; frequency: string; codeOfConformance: string; testAgency: string };
export type QapLibraryActivity = { activity: string; items: QapLibraryItem[] };

let cache: QapLibraryActivity[] | null = null;

const clean = (v: unknown) => String(v ?? "").replace(/^[\s●•\-]+/, "").replace(/\s+/g, " ").trim();

export function loadQapLibrary(): QapLibraryActivity[] {
  if (cache) return cache;
  const file = findWorkbook(["Quality Assurance Plan Week 50.xlsx"]);
  if (!file) return [];
  const wb = XLSX.readFile(file);
  const name = wb.SheetNames.find((n) => /^sheet2$/i.test(n)) || wb.SheetNames[1];
  if (!name) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][];
  const out: QapLibraryActivity[] = [];
  let current: QapLibraryActivity | null = null;
  for (const r of rows.slice(1)) {
    const activity = clean(r[0]);
    const description = clean(r[1]);
    if (activity) {
      current = { activity, items: [] };
      out.push(current);
    }
    if (!current || !description) continue;
    current.items.push({ description, frequency: clean(r[2]), codeOfConformance: clean(r[3]), testAgency: clean(r[4]) });
  }
  cache = out.filter((a) => a.items.length);
  return cache;
}
