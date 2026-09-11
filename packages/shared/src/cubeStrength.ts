/**
 * IS 516 cube crushing strength — 150 mm specimen.
 * fck (MPa) = P(N) / A(mm²) = load_kN × 1000 / 22500 = load_kN / 22.5
 */

export const CUBE_SIZE_MM = 150;

export function cubeStrengthFromLoadKN(loadKN: number | null | undefined, sizeMm = CUBE_SIZE_MM): number | null {
  if (loadKN == null || !Number.isFinite(Number(loadKN)) || Number(loadKN) <= 0) return null;
  const area = sizeMm * sizeMm;
  return Math.round((Number(loadKN) * 1000 / area) * 100) / 100;
}

export function gradeTargetMPa(grade: string | null | undefined): number | null {
  const m = /M\s*(\d+(?:\.\d+)?)/i.exec(String(grade || ""));
  return m ? Number(m[1]) : null;
}

export function cubeResultFromStrengths(opts: {
  grade?: string | null;
  strength7?: number | null;
  strength28?: number | null;
  avgStrength?: number | null;
}): string {
  const target = gradeTargetMPa(opts.grade);
  const s28 = opts.strength28 ?? null;
  if (s28 == null || target == null) return "Pending";
  return s28 + 1e-9 >= target ? "PASS" : "FAIL";
}

export function applyCubeFormula(input: {
  load7?: number | null;
  load28?: number | null;
  strength7?: number | null;
  strength28?: number | null;
  avgStrength?: number | null;
  grade?: string | null;
  result?: string | null;
}) {
  const s7 = input.strength7 != null && Number.isFinite(Number(input.strength7))
    ? Number(input.strength7)
    : cubeStrengthFromLoadKN(input.load7);
  const s28 = input.strength28 != null && Number.isFinite(Number(input.strength28))
    ? Number(input.strength28)
    : cubeStrengthFromLoadKN(input.load28);
  let avg = input.avgStrength != null && Number.isFinite(Number(input.avgStrength))
    ? Number(input.avgStrength)
    : null;
  if (avg == null) {
    if (s7 != null && s28 != null) avg = Math.round(((s7 + s28) / 2) * 100) / 100;
    else avg = s28 ?? s7 ?? null;
  }
  const result =
    input.result && input.result !== "Pending"
      ? String(input.result)
      : cubeResultFromStrengths({ grade: input.grade, strength7: s7, strength28: s28, avgStrength: avg });
  return {
    strength7: s7,
    strength28: s28,
    strength: s28 ?? s7 ?? null,
    avgStrength: avg,
    result,
  };
}

export function isPourCardTemplate(name?: string | null, checklistType?: string | null): boolean {
  return /pour/i.test(`${name || ""} ${checklistType || ""}`);
}

/** Strip leftover "-2" / "-3" suffixes so three specimens stay one register entry. */
export function normalizeCubeSr(sr?: string | null): string {
  return String(sr || "").replace(/-([23])$/, "") || "—";
}

export function cubeGroupKey(row: {
  srNo?: string | null;
  castDate?: Date | string | null;
  description?: string | null;
}): string {
  const cast = row.castDate ? String(row.castDate).slice(0, 10) : "";
  return `${normalizeCubeSr(row.srNo)}|${cast}|${row.description || ""}`;
}
