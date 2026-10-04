import fs from "fs";
import path from "path";
import { INTERVIEW_PARAMS, INTERVIEW_ROLES } from "./interviewFramework.js";
import { detachSharedStyles } from "../lib/excelTemplate.js";

export { INTERVIEW_PARAMS, INTERVIEW_ROLES };

export const INTERVIEW_ROUNDS = [
  { id: "R1", label: "R1 – HR Screening", weight: 0.2 },
  { id: "R2", label: "R2 – Technical", weight: 0.5 },
  { id: "R3", label: "R3 – Management", weight: 0.3 },
] as const;

/** Which competencies that round scores. R2 is the full role-weighted sheet. */
export const ROUND_FOCUS: Record<"R1" | "R2" | "R3", string[] | null> = {
  R1: ["B2", "B6", "F1", "F2", "F3"],
  R2: null,
  R3: ["L1", "L2", "C1", "C2", "C3", "C4", "B3", "F2"],
};

export const ROUND_NOTE: Record<"R1" | "R2" | "R3", string> = {
  R1: "HR screening — score Communication, Integrity, and Fit only.",
  R2: "Technical — score every competency that has a weight for this position.",
  R3: "Management — score Leadership, Commercial, client handling, and culture fit.",
};

export function scorecardRoundId(round: string | null | undefined): "R1" | "R2" | "R3" {
  const raw = String(round || "");
  if (/^R1\b/i.test(raw) || /hr|screen/i.test(raw)) return "R1";
  if (/^R3\b/i.test(raw) || /manag/i.test(raw)) return "R3";
  return "R2";
}

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
  const focus = ROUND_FOCUS[scorecardRoundId(input.round)];
  const lines = INTERVIEW_PARAMS.map((p) => {
    const inRound = !focus || focus.includes(p.code);
    const weight = inRound ? p.weights[position] || 0 : 0;
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

  const scoredLines = lines.filter((l) => l.average > 0);
  const weightSum = scoredLines.reduce((a, l) => a + l.weight, 0) || 1;
  const percent = scoredLines.length ? (scoredLines.reduce((a, l) => a + l.weighted, 0) / weightSum) * 100 : 0;
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

const ROUND_LABEL: Record<string, string> = {
  R1: "R1 – HR Screening",
  R2: "R2 – Technical",
  R3: "R3 – Management",
};

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object" && "result" in value) {
    const result = (value as { result?: unknown }).result;
    return result == null ? "" : String(result).trim();
  }
  return "";
}

function scorecardTemplatePath(): string | null {
  const candidates = [
    path.join(process.cwd(), "apps/api/formats/hrms/SPDC_Interview_Assessment_Scoring_System.xlsx"),
    path.join(process.cwd(), "formats/hrms/SPDC_Interview_Assessment_Scoring_System.xlsx"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/** Official SPDC scorecard workbook. Blank parameter rows stay blank so a half-filled save is still their Excel file. */
export async function scorecardWorkbook(
  candidateName: string,
  result: ScorecardResult,
  meta?: {
    interviewDate?: Date | string | null;
    experienceYears?: number | null;
    source?: string | null;
    panelists?: string[];
  },
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const template = scorecardTemplatePath();
  if (!template) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Scorecard");
    ws.addRow(["SPDC interview scorecard"]);
    ws.addRow(["Candidate", candidateName]);
    ws.addRow(["Position", result.position]);
    ws.addRow(["Round", result.round]);
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(template);
  detachSharedStyles(wb);
  const ws = wb.getWorksheet("Scorecard");
  if (!ws) {
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
  }
  const roundKey = scorecardRoundId(result.round);
  const scored = new Map(result.lines.filter((l) => l.average > 0).map((l) => [l.code, l.average]));
  const name = String(candidateName || "").trim() || "Candidate";
  ws.getCell("C5").value = name;
  ws.getCell("D5").value = name;
  ws.getCell("C6").value = result.position;
  ws.getCell("D6").value = result.position;
  const roundLabel = ROUND_LABEL[roundKey] || result.round;
  ws.getCell("C7").value = roundLabel;
  ws.getCell("D7").value = roundLabel;
  if (meta?.interviewDate) {
    const d = new Date(meta.interviewDate);
    if (!Number.isNaN(d.getTime())) {
      ws.getCell("C8").value = d;
      ws.getCell("D8").value = d;
    }
  }
  const years = meta?.experienceYears;
  ws.getCell("C9").value = years != null && Number.isFinite(Number(years)) ? Number(years) : "";
  ws.getCell("D9").value = years != null && Number.isFinite(Number(years)) ? Number(years) : "";
  const source = String(meta?.source || "").trim();
  ws.getCell("C10").value = source;
  ws.getCell("D10").value = source;
  const panel = (meta?.panelists || []).map((p) => String(p || "").trim()).filter(Boolean).slice(0, 3);
  for (let i = 0; i < panel.length; i++) {
    const row = 5 + i;
    ws.getCell(`I${row}`).value = panel[i];
    ws.getCell(`J${row}`).value = panel[i];
  }
  for (let row = 14; row <= 36; row++) {
    const code = cellText(ws.getCell(`A${row}`).value);
    if (!code || code === "TOTAL") continue;
    const mark = scored.get(code);
    ws.getCell(`F${row}`).value = mark ? Math.round(mark * 10) / 10 : null;
    ws.getCell(`G${row}`).value = null;
    ws.getCell(`H${row}`).value = null;
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
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
