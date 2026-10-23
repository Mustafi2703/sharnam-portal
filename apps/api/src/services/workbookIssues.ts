/**
 * Excel error cells and external links found in an uploaded workbook.
 * Cached values from a linked file can be stale, so the link path is named.
 */
import XLSX from "../lib/xlsx.js";

export type WorkbookCellError = { tab: string; cell: string; error: string };

export type WorkbookIssues = {
  errors: WorkbookCellError[];
  externalLinks: string[];
};

function partText(part: { content?: Buffer | string } | Buffer | string | undefined): string {
  if (!part) return "";
  if (Buffer.isBuffer(part)) return part.toString("utf8");
  if (typeof part === "string") return part;
  const content = part.content;
  if (Buffer.isBuffer(content)) return content.toString("utf8");
  return content ? String(content) : "";
}

export function parseWorkbookIssues(buffer: Buffer): WorkbookIssues {
  const wb = XLSX.read(buffer, { type: "buffer", cellFormula: true, bookFiles: true }) as {
    SheetNames: string[];
    Sheets: Record<string, Record<string, { t?: string; v?: unknown; w?: unknown; f?: string }>>;
    files?: Record<string, { content?: Buffer | string } | Buffer | string>;
  };
  const errors: WorkbookCellError[] = [];
  const links = new Set<string>();

  for (const name of wb.SheetNames || []) {
    const sheet = wb.Sheets[name] || {};
    for (const addr of Object.keys(sheet)) {
      if (addr.startsWith("!")) continue;
      const cell = sheet[addr];
      if (!cell) continue;
      const text = String(cell.w ?? cell.v ?? "").trim();
      if (cell.t === "e" || /^#(REF!|DIV\/0!|VALUE!|N\/A|NAME\?)/i.test(text)) {
        errors.push({ tab: name, cell: addr, error: text || "#ERR" });
      }
      const formula = String(cell.f || "");
      const file = formula.match(/\[[^\]]+\.xls[x]?\]/i) || formula.match(/[A-Za-z]:\\[^'"\]]+\.xls[x]?/i);
      if (file) links.add(file[0]);
    }
  }

  for (const [path, part] of Object.entries(wb.files || {})) {
    if (!/externalLinks\/_rels\//i.test(path)) continue;
    const xml = partText(part);
    for (const match of xml.matchAll(/Target="([^"]+)"/g)) {
      const target = decodeURIComponent(match[1] || "").replace(/^file:\/\/\//, "");
      if (target && !/externalLinkPath/i.test(target)) links.add(target);
    }
  }

  return { errors, externalLinks: [...links] };
}
