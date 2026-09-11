import fs from "fs";
import path from "path";

/** Folders that hold client week dashboards and reference packs. */
export function workbookSearchRoots(): string[] {
  const cwd = process.cwd();
  const parents = [cwd, path.resolve(cwd, ".."), path.resolve(cwd, "../..")];
  const rels = [
    ["module_prompts"],
    ["module_prompts", "untitled folder"],
    ["module_prompts", "Sharnam_modules_docs 2"],
    ["seed", "data"],
    ["templates", "wpr-client"],
    ["templates"],
    [],
  ];
  const out: string[] = [];
  if (process.env.SHARNAM_EXCEL_ROOT) out.push(path.resolve(process.env.SHARNAM_EXCEL_ROOT));
  for (const root of parents) {
    for (const rel of rels) {
      const p = path.join(root, ...rel);
      if (fs.existsSync(p) && !out.includes(p)) out.push(p);
    }
  }
  return out;
}

/** Same resolution as `seed/seed.ts` — bundled workbooks under seed/data when env unset. */
export function resolveExcelRoot(): string {
  if (process.env.SHARNAM_EXCEL_ROOT) return path.resolve(process.env.SHARNAM_EXCEL_ROOT);
  const roots = workbookSearchRoots();
  const prefer = roots.find((r) => /module_prompts$/.test(r) || /untitled folder/.test(r));
  if (prefer) return prefer;
  const bundled = roots.find((r) => /seed[/\\]data$/.test(r));
  if (bundled) return bundled;
  return roots[0] || process.cwd();
}

/** First existing workbook among name variants across all known roots. */
export function findWorkbook(names: string[]): string | null {
  for (const root of workbookSearchRoots()) {
    for (const name of names) {
      const p = path.join(root, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}
