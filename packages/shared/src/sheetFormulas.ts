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

export function evaluateFormula(
  formula: string,
  grid: Grid,
  evaluating: Set<string> = new Set()
): string | number | null {
  let expr = formula.trim();
  if (expr.startsWith("=")) expr = expr.slice(1).trim();
  if (!expr) return null;

  const upper = expr.toUpperCase();

  const sumMatch = /^SUM\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)$/i.exec(expr);
  if (sumMatch) {
    return rangeCells(grid, sumMatch[1], sumMatch[2]).reduce(
      (acc, cell) => acc + numericValue(cell, grid, new Set(evaluating)),
      0
    );
  }

  const avgMatch = /^AVERAGE\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)$/i.exec(expr);
  if (avgMatch) {
    const cells = rangeCells(grid, avgMatch[1], avgMatch[2]);
    if (!cells.length) return 0;
    const total = cells.reduce((acc, cell) => acc + numericValue(cell, grid, new Set(evaluating)), 0);
    return total / cells.length;
  }

  const minMatch = /^MIN\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)$/i.exec(expr);
  if (minMatch) {
    const vals = rangeCells(grid, minMatch[1], minMatch[2]).map((c) => numericValue(c, grid, new Set(evaluating)));
    return vals.length ? Math.min(...vals) : 0;
  }

  const maxMatch = /^MAX\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)$/i.exec(expr);
  if (maxMatch) {
    const vals = rangeCells(grid, maxMatch[1], maxMatch[2]).map((c) => numericValue(c, grid, new Set(evaluating)));
    return vals.length ? Math.max(...vals) : 0;
  }

  if (upper.startsWith("IF(")) return expr;

  let resolved = expr.replace(/([A-Za-z]+\d+)/g, (ref) => {
    const n = cellNumeric(grid, ref, evaluating);
    return String(n);
  });

  if (!/^[\d\s+\-*/().]+$/.test(resolved)) return expr;

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
