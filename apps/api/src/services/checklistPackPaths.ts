/**
 * Client checklist pack — New folder + Final Index.xlsx (171 checklists).
 * Matches Quality Dashboard.xlsx Sheet1 catalog.
 */
import fs from "fs";
import path from "path";
import XLSX from "../lib/xlsx.js";

export function resolveChecklistPackRoot(): string | null {
  const candidates = [
    process.env.SHARNAM_CHECKLIST_PACK_ROOT?.trim(),
    path.join(process.cwd(), "seed", "checklist-pack"),
    path.join(
      process.cwd(),
      "module_prompts",
      "Sharnam_modules_docs 2",
      "modules",
      "files (2)",
      "New folder"
    ),
    path.join(process.cwd(), "docs", "checklist-pack"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) return p;
  }
  return null;
}

export function resolveFinalIndexPath(): string | null {
  const root = resolveChecklistPackRoot();
  const candidates = [
    root ? path.join(root, "Final Index.xlsx") : "",
    path.join(process.cwd(), "seed", "checklist-pack", "Final Index.xlsx"),
    path.join(process.cwd(), "seed", "data", "Quality Dashboard.xlsx"),
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", "Quality Dashboard.xlsx"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Walk New folder subdirs and index xlsx checklist workbooks by file name (without ext). */
export function indexChecklistWorkbooks(): Map<string, string> {
  const root = resolveChecklistPackRoot();
  const map = new Map<string, string>();
  if (!root) return map;

  function walk(dir: string) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.xlsx$/i.test(ent.name)) {
        const base = ent.name.replace(/\.xlsx$/i, "");
        map.set(base, full);
        // Also index without "Checklist For " prefix for fuzzy match
        const short = base.replace(/^Checklist For\s+/i, "").trim();
        if (short !== base) map.set(short, full);
      }
    }
  }
  walk(root);
  return map;
}

export function findChecklistWorkbook(catalogName: string): string | null {
  const index = indexChecklistWorkbooks();
  const key = catalogName.trim();
  const norm = key
    .replace(/\u00fb/g, "-")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^Checklist For\s+/i, "")
    .trim();
  const candidates = [key, norm, `Checklist For ${norm}`, key.replace(/^PD\s+/i, ""), key.replace(/^PC\s+/i, "")];
  for (const c of candidates) {
    const hit = index.get(c);
    if (hit) return hit;
  }
  return null;
}

export type ChecklistPackFolder = { name: string; fileCount: number };
export type ChecklistPackInventory = {
  packRoot: string | null;
  finalIndexPath: string | null;
  catalogRows: number;
  workbookFiles: number;
  matchedToCatalog: number;
  folders: ChecklistPackFolder[];
};

export function loadChecklistPackInventory(): ChecklistPackInventory {
  const packRoot = resolveChecklistPackRoot();
  const finalIndexPath = resolveFinalIndexPath();
  const index = indexChecklistWorkbooks();
  let catalogRows = 0;
  let matchedToCatalog = 0;

  if (finalIndexPath) {
    try {
      const wb = XLSX.readFile(finalIndexPath);
      const sheet = wb.SheetNames.find((n: string) => /sheet/i.test(n)) || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheet], { header: 1, defval: "" });
      for (const r of rows) {
        const name = String(r[1] ?? "").trim();
        const sr = Number(r[0]);
        if (!sr || !name || /file name/i.test(name)) continue;
        catalogRows++;
        if (findChecklistWorkbook(name)) matchedToCatalog++;
      }
    } catch {
      /* ignore parse errors */
    }
  }

  const folders: ChecklistPackFolder[] = [];
  if (packRoot) {
    for (const ent of fs.readdirSync(packRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const sub = path.join(packRoot, ent.name);
      let fileCount = 0;
      const stack = [sub];
      while (stack.length) {
        const d = stack.pop()!;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const f = path.join(d, e.name);
          if (e.isDirectory()) stack.push(f);
          else if (/\.xlsx$/i.test(e.name)) fileCount++;
        }
      }
      folders.push({ name: ent.name, fileCount });
    }
  }

  return {
    packRoot,
    finalIndexPath,
    catalogRows,
    workbookFiles: index.size,
    matchedToCatalog,
    folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
