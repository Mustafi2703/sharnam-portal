/**
 * Custom Sheet Maker — cell model + formula helpers for portal edit and Excel export.
 */

export type SheetCell = {
  /** User-entered value or formula (e.g. "=SUM(A2:A10)") */
  raw: string;
  /** Cached result from import or in-portal evaluation */
  computed?: string | number | null;
};

export function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function colIndex(letters: string): number {
  const u = letters.toUpperCase();
  let n = 0;
  for (let i = 0; i < u.length; i++) {
    n = n * 26 + (u.charCodeAt(i) - 64);
  }
  return n - 1;
}

export function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!m) return null;
  return { col: colIndex(m[1]), row: Number(m[2]) };
}

export function isFormula(raw: string): boolean {
  return typeof raw === "string" && raw.trim().startsWith("=");
}

export function normalizeCell(cell: unknown): SheetCell {
  if (cell && typeof cell === "object" && "raw" in cell) {
    const c = cell as SheetCell;
    return { raw: String(c.raw ?? ""), computed: c.computed ?? undefined };
  }
  if (cell == null) return { raw: "" };
  return { raw: String(cell) };
}

export function migrateRows(rows: unknown[][]): SheetCell[][] {
  return (rows || []).map((row) => (row || []).map((cell) => normalizeCell(cell)));
}

export function cellEditValue(cell: SheetCell): string {
  return cell.raw ?? "";
}

export function cellPreview(cell: SheetCell): string {
  if (isFormula(cell.raw)) {
    if (cell.computed != null && cell.computed !== "") return String(cell.computed);
    return "…";
  }
  return cell.raw;
}

type Grid = SheetCell[][];

function cellAt(grid: Grid, col: number, excelRow: number): SheetCell | null {
  const dataRow = excelRow - 2;
  if (dataRow < 0 || dataRow >= grid.length) return null;
  const row = grid[dataRow];
  if (!row || col < 0 || col >= row.length) return null;
  return row[col];
}

function parseFunctionArgs(inner: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      current += ch;
      if (ch === quote && inner[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function rangeCells(grid: Grid, start: string, end: string): SheetCell[] {
  const a = parseCellRef(start);
  const b = parseCellRef(end);
  if (!a || !b) return [];
  const out: SheetCell[] = [];
  const c0 = Math.min(a.col, b.col);
  const c1 = Math.max(a.col, b.col);
  const r0 = Math.min(a.row, b.row);
  const r1 = Math.max(a.row, b.row);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const cell = cellAt(grid, c, r);
      if (cell) out.push(cell);
    }
  }
  return out;
}

function cellRawValue(cell: SheetCell | null): string | number {
  if (!cell) return "";
  const raw = cell.raw.trim();
  if (!raw) return "";
  if (isFormula(raw)) {
    if (cell.computed != null && cell.computed !== "") return cell.computed;
    return "";
  }
  const n = Number(raw);
  if (raw !== "" && !Number.isNaN(n)) return n;
  return raw;
}

function numericValue(cell: SheetCell | null, grid: Grid, evaluating: Set<string>): number {
  if (!cell) return 0;
  const raw = cell.raw.trim();
  if (!raw) return 0;
  if (isFormula(raw)) {
    const key = raw;
    if (evaluating.has(key)) return 0;
    evaluating.add(key);
    const v = evaluateFormula(raw, grid, evaluating);
    evaluating.delete(key);
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) return Number(v);
    return 0;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? 0 : n;
}

function cellNumeric(grid: Grid, ref: string, evaluating: Set<string>): number {
  const parsed = parseCellRef(ref);
  if (!parsed) return 0;
  return numericValue(cellAt(grid, parsed.col, parsed.row), grid, evaluating);
}

function substituteRefs(expr: string, grid: Grid, evaluating: Set<string>, asString = false): string {
  return expr.replace(/([A-Za-z]+\d+)/g, (ref) => {
    const parsed = parseCellRef(ref);
    if (!parsed) return ref;
    const cell = cellAt(grid, parsed.col, parsed.row);
    if (asString) {
      const v = cellRawValue(cell);
      return `"${String(v).replace(/"/g, '""')}"`;
    }
    return String(cellNumeric(grid, ref, evaluating));
  });
}

function evalCondition(cond: string, grid: Grid, evaluating: Set<string>): boolean {
  let c = cond.trim();
  for (const op of [">=", "<=", "<>", "!=", ">", "<", "="]) {
    const idx = c.indexOf(op);
    if (idx > 0) {
      const left = substituteRefs(c.slice(0, idx).trim(), grid, evaluating, true);
      const right = substituteRefs(c.slice(idx + op.length).trim(), grid, evaluating, true);
      try {
        if (op === "=" || op === "==") return Function(`"use strict"; return (${left} == ${right});`)();
        if (op === "<>" || op === "!=") return Function(`"use strict"; return (${left} != ${right});`)();
        return Function(`"use strict"; return (${left} ${op} ${right});`)();
      } catch {
        return false;
      }
    }
  }
  const n = Number(substituteRefs(c, grid, evaluating));
  return Boolean(n);
}

function evalRangeAggregate(
  fn: "SUM" | "AVERAGE" | "MIN" | "MAX" | "COUNT" | "COUNTA" | "PRODUCT",
  argsInner: string,
  grid: Grid,
  evaluating: Set<string>
): number {
  const parts = parseFunctionArgs(argsInner);
  const cells: SheetCell[] = [];
  for (const part of parts) {
    const range = /^([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)$/i.exec(part.trim());
    if (range) {
      cells.push(...rangeCells(grid, range[1], range[2]));
      continue;
    }
    const ref = parseCellRef(part.trim());
    if (ref) {
      const cell = cellAt(grid, ref.col, ref.row);
      if (cell) cells.push(cell);
    }
  }
  if (fn === "COUNTA") return cells.filter((c) => String(cellRawValue(c)).trim() !== "").length;
  if (fn === "COUNT") return cells.filter((c) => numericValue(c, grid, new Set(evaluating)) !== 0 || /^-?\d/.test(c.raw.trim())).length;
  const vals = cells.map((c) => numericValue(c, grid, new Set(evaluating)));
  if (!vals.length) return 0;
  switch (fn) {
    case "SUM":
      return vals.reduce((a, b) => a + b, 0);
    case "PRODUCT":
      return vals.reduce((a, b) => a * b, 1);
    case "AVERAGE":
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "MIN":
      return Math.min(...vals);
    case "MAX":
      return Math.max(...vals);
    default:
      return 0;
  }
}

export function evaluateFormula(
  formula: string,
  grid: Grid,
  evaluating: Set<string> = new Set()
): string | number | null {
  let expr = formula.trim();
  if (expr.startsWith("=")) expr = expr.slice(1).trim();
  if (!expr) return null;

  const fnMatch = /^([A-Z]+)\s*\(([\s\S]+)\)\s*$/i.exec(expr);
  if (fnMatch) {
    const name = fnMatch[1].toUpperCase();
    const inner = fnMatch[2];
    if (["SUM", "AVERAGE", "MIN", "MAX", "COUNT", "COUNTA", "PRODUCT"].includes(name)) {
      return evalRangeAggregate(name as "SUM", inner, grid, evaluating);
    }
    if (name === "IF") {
      const args = parseFunctionArgs(inner);
      if (args.length >= 3) {
        const pass = evalCondition(args[0], grid, evaluating);
        const branch = pass ? args[1] : args[2];
        if (/^[A-Za-z]+\d+$/.test(branch.trim())) return cellNumeric(grid, branch.trim(), evaluating);
        if (/^["']/.test(branch.trim())) return branch.trim().slice(1, -1);
        return evaluateFormula(branch.startsWith("=") ? branch : `=${branch}`, grid, evaluating);
      }
    }
    if (name === "ROUND") {
      const args = parseFunctionArgs(inner);
      if (args.length >= 1) {
        const n = Number(substituteRefs(args[0], grid, evaluating));
        const d = args[1] ? Number(substituteRefs(args[1], grid, evaluating)) : 0;
        const f = 10 ** d;
        return Math.round(n * f) / f;
      }
    }
    if (name === "ABS") {
      const args = parseFunctionArgs(inner);
      if (args[0]) return Math.abs(Number(substituteRefs(args[0], grid, evaluating)));
    }
  }

  if (/^[A-Za-z]+\d+$/.test(expr)) return cellNumeric(grid, expr, evaluating);

  let resolved = substituteRefs(expr, grid, evaluating);
  if (!/^[\d\s+\-*/().]+$/.test(resolved)) {
    if (resolved.startsWith('"') && resolved.endsWith('"')) return resolved.slice(1, -1);
    return expr;
  }

  try {
    const result = Function(`"use strict"; return (${resolved});`)();
    if (typeof result === "number" && Number.isFinite(result)) {
      return Math.round(result * 1e10) / 1e10;
    }
    return result != null ? String(result) : null;
  } catch {
    return expr;
  }
}

export function evaluateAllRows(rows: SheetCell[][]): SheetCell[][] {
  return rows.map((row) =>
    row.map((cell) => {
      if (!isFormula(cell.raw)) return cell;
      const computed = evaluateFormula(cell.raw, rows);
      return { ...cell, computed };
    })
  );
}

/** Build xlsx worksheet cells — formulas written with `f` field for Excel recalc. */
export function sheetCellsToAoa(headers: string[], rows: SheetCell[][]): {
  data: (string | number)[][];
  formulas: Record<string, string>;
} {
  const formulas: Record<string, string> = {};
  const data: (string | number)[][] = [headers];

  rows.forEach((row, ri) => {
    const line: (string | number)[] = [];
    row.forEach((cell, ci) => {
      const normalized = normalizeCell(cell);
      const addr = `${colLetter(ci)}${ri + 2}`;
      if (isFormula(normalized.raw)) {
        const f = normalized.raw.trim().startsWith("=") ? normalized.raw.trim().slice(1) : normalized.raw.trim();
        formulas[addr] = f;
        const cv = normalized.computed;
        if (typeof cv === "number") line.push(cv);
        else if (cv != null && cv !== "") line.push(String(cv));
        else line.push(0);
      } else {
        const n = Number(normalized.raw);
        if (normalized.raw !== "" && !Number.isNaN(n)) line.push(n);
        else line.push(normalized.raw);
      }
    });
    data.push(line);
  });

  return { data, formulas };
}

export function applyFormulasToWorksheet(
  ws: Record<string, unknown>,
  formulas: Record<string, string>
): void {
  for (const [addr, f] of Object.entries(formulas)) {
    const existing = (ws[addr] as { t?: string; v?: unknown }) || { t: "n", v: 0 };
    ws[addr] = { ...existing, f };
  }
}

export const SUPPORTED_FORMULAS = [
  "SUM",
  "AVERAGE",
  "MIN",
  "MAX",
  "COUNT",
  "COUNTA",
  "PRODUCT",
  "IF",
  "ROUND",
  "ABS",
  "+ − × ÷",
  "Cell refs (A2, B10)",
];
