import { INTERVIEW_PARAMS, INTERVIEW_ROLES } from "./interviewFramework.js";

export { INTERVIEW_PARAMS, INTERVIEW_ROLES };

export const INTERVIEW_ROUNDS = [
  { id: "R1", label: "R1 – HR Screening", weight: 0.2 },
  { id: "R2", label: "R2 – Technical", weight: 0.5 },
  { id: "R3", label: "R3 – Management", weight: 0.3 },
] as const;

export type ScorecardInput = {
  position: string;
  round: string;
  /** Parameter code → panel scores 1–5. */
  scores: Record<string, number[]>;
};

export type ScorecardResult = {
  position: string;
  round: string;
  percent: number;
  grade: "A" | "B" | "C" | "D";
  decision: string;
  knockout: boolean;
  lines: { code: string; parameter: string; category: string; weight: number; average: number; weighted: number }[];
};

function clampScore(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function gradeFromPercent(percent: number, knockout: boolean): { grade: ScorecardResult["grade"]; decision: string } {
  if (knockout || percent < 65) return { grade: "D", decision: "Not Recommended" };
  if (percent >= 85) return { grade: "A", decision: "Strongly Recommended – Select" };
  if (percent >= 75) return { grade: "B", decision: "Recommended" };
  return { grade: "C", decision: "Hold / Consider for lower grade" };
}

/** SPDC/HR/F-INT-01 — weighted 1–5 scorecard for one round. */
export function scoreInterviewRound(input: ScorecardInput): ScorecardResult {
  const position = INTERVIEW_ROLES.includes(input.position as (typeof INTERVIEW_ROLES)[number])
    ? input.position
    : INTERVIEW_ROLES[0];
  const lines = INTERVIEW_PARAMS.map((p) => {
    const weight = p.weights[position] || 0;
    const raw = (input.scores[p.code] || []).map(clampScore).filter((n) => n > 0);
    const average = raw.length ? raw.reduce((a, b) => a + b, 0) / raw.length : 0;
    return {
      code: p.code,
      parameter: p.parameter,
      category: p.category,
      weight,
      average,
      weighted: weight ? (average / 5) * weight : 0,
    };
  }).filter((l) => l.weight > 0);

  const weightSum = lines.reduce((a, l) => a + l.weight, 0) || 1;
  const percent = (lines.reduce((a, l) => a + l.weighted, 0) / weightSum) * 100;
  const knockout = lines.some((l) => (l.weight >= 10 || l.code === "B6") && l.average > 0 && l.average < 2.5);
  const graded = gradeFromPercent(percent, knockout);
  return {
    position,
    round: input.round,
    percent: Math.round(percent * 10) / 10,
    grade: graded.grade,
    decision: graded.decision,
    knockout,
    lines,
  };
}

export function compositePercent(rounds: { round: string; percent: number }[]) {
  const byId = new Map(INTERVIEW_ROUNDS.map((r) => [r.id, r.weight]));
  let acc = 0;
  let w = 0;
  for (const row of rounds) {
    const key = row.round.startsWith("R1") ? "R1" : row.round.startsWith("R3") ? "R3" : "R2";
    const weight = byId.get(key as "R1") || 0;
    if (!Number.isFinite(row.percent) || !weight) continue;
    acc += (row.percent / 100) * weight;
    w += weight;
  }
  if (!w) return 0;
  return Math.round((acc / w) * 1000) / 10;
}
