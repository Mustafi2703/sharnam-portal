/**
 * IS 516 cube crushing strength — 150 mm specimen (SPDC CUBE REGISTER).
 * fck (MPa) = P(N) / A(mm²) = load_kN × 1000 / 22500 = load_kN / 22.5
 *
 * Client sheet layout: 3×7-day specimens + 3×28-day specimens per footing group.
 * Avg Strength = AVERAGE of the three specimens in that phase.
 * Result: 28-day avg vs grade fck; 7-day-only uses early limit (~17 MPa for M25, matching SPDC IF(L>17)).
 */

export const CUBE_SIZE_MM = 150;
export const CUBE_LOAD_TO_MPA = 22.5;

/** Common concrete grades for pickers (stored as M25). */
export const CUBE_GRADE_OPTIONS = ["M15", "M20", "M25", "M30", "M35", "M40", "M45", "M50"] as const;

export const CUBE_AGENCY_OPTIONS = [
  "NABL lab",
  "Site lab",
  "Third party lab",
  "Approved external agency",
  "Manufacturer",
] as const;

export const CUBE_RESULT_OPTIONS = ["Pending", "PASS", "FAIL"] as const;

export function cubeStrengthFromLoadKN(loadKN: number | null | undefined, sizeMm = CUBE_SIZE_MM): number | null {
  if (loadKN == null || !Number.isFinite(Number(loadKN)) || Number(loadKN) <= 0) return null;
  const area = sizeMm * sizeMm;
  return Math.round(((Number(loadKN) * 1000) / area) * 100) / 100;
}

/** Parse M25 / M:25 / M-25 / M 25 → 25 */
export function gradeTargetMPa(grade: string | null | undefined): number | null {
  const m = /M\s*[:\-]?\s*(\d+(?:\.\d+)?)/i.exec(String(grade || ""));
  return m ? Number(m[1]) : null;
}

/** Normalize display/storage to M25 (no colon). */
export function normalizeCubeGrade(grade: string | null | undefined): string | null {
  const t = gradeTargetMPa(grade);
  return t != null ? `M${t}` : grade ? String(grade).trim() || null : null;
}

/** SPDC sheet early check — ~17 MPa for M25 (≈0.67×fck). */
export function earlyStrengthLimitMPa(grade: string | null | undefined): number | null {
  const fck = gradeTargetMPa(grade);
  if (fck == null) return 17;
  return Math.round(fck * 0.67 * 100) / 100;
}

export function cubeResultFromStrengths(opts: {
  grade?: string | null;
  strength7?: number | null;
  strength28?: number | null;
  avgStrength?: number | null;
  /** Prefer phase average when judging PASS/FAIL */
  avg7?: number | null;
  avg28?: number | null;
}): string {
  const target = gradeTargetMPa(opts.grade);
  const avg28 = opts.avg28 ?? (opts.strength28 != null ? opts.avgStrength ?? opts.strength28 : null);
  if (avg28 != null && target != null) {
    return avg28 + 1e-9 >= target ? "PASS" : "FAIL";
  }
  if (avg28 != null && target == null) {
    return avg28 + 1e-9 >= 17 ? "PASS" : "FAIL";
  }
  const avg7 = opts.avg7 ?? opts.strength7 ?? null;
  if (avg7 != null) {
    const early = earlyStrengthLimitMPa(opts.grade) ?? 17;
    return avg7 + 1e-9 >= early ? "PASS" : "FAIL";
  }
  return "Pending";
}

/**
 * Per-specimen formula. When load is present, strength is always load/22.5 (IS 516).
 * Entered strength is only used when load is missing (lab reported MPa only).
 */
export function applyCubeFormula(input: {
  load7?: number | null;
  load28?: number | null;
  strength7?: number | null;
  strength28?: number | null;
  avgStrength?: number | null;
  grade?: string | null;
  result?: string | null;
}) {
  const fromLoad7 = cubeStrengthFromLoadKN(input.load7);
  const fromLoad28 = cubeStrengthFromLoadKN(input.load28);
  const s7 =
    fromLoad7 != null
      ? fromLoad7
      : input.strength7 != null && Number.isFinite(Number(input.strength7))
        ? Number(input.strength7)
        : null;
  const s28 =
    fromLoad28 != null
      ? fromLoad28
      : input.strength28 != null && Number.isFinite(Number(input.strength28))
        ? Number(input.strength28)
        : null;

  // Per-specimen avg: only same-phase value (do not blend 7d+28d on one row)
  let avg = input.avgStrength != null && Number.isFinite(Number(input.avgStrength)) ? Number(input.avgStrength) : null;
  if (avg == null) {
    avg = s28 ?? s7 ?? null;
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
    grade: normalizeCubeGrade(input.grade) || input.grade || null,
  };
}

export function averageStrengths(vals: Array<number | null | undefined>): number | null {
  const nums = vals.filter((n): n is number => n != null && Number.isFinite(n));
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

/** Apply phase averages + PASS/FAIL onto a footing group (mutates copies). */
export function applyCubeGroupPhaseStats<
  T extends {
    load7?: number | null;
    load28?: number | null;
    strength7?: number | null;
    strength28?: number | null;
    strength?: number | null;
    avgStrength?: number | null;
    result?: string | null;
    grade?: string | null;
  },
>(rows: T[]): T[] {
  if (!rows.length) return rows;
  const grade = rows[0].grade;
  const withFormula = rows.map((r) => {
    const c = applyCubeFormula(r);
    return { ...r, ...c, grade: c.grade || r.grade };
  });
  const is7 = (r: T) => Boolean(r.load7 || r.strength7 != null) && !r.load28 && r.strength28 == null;
  const is28 = (r: T) => Boolean(r.load28 || r.strength28 != null);
  const d7 = withFormula.filter(is7);
  const d28 = withFormula.filter(is28);
  const avg7 = averageStrengths(d7.map((r) => r.strength7 ?? r.strength));
  const avg28 = averageStrengths(d28.map((r) => r.strength28 ?? r.strength));
  const groupResult = cubeResultFromStrengths({ grade, avg7, avg28 });

  return withFormula.map((r) => {
    const phase7 = is7(r);
    const phase28 = is28(r);
    return {
      ...r,
      avgStrength: phase28 ? avg28 : phase7 ? avg7 : avg28 ?? avg7 ?? r.avgStrength,
      result: groupResult,
    };
  });
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
