import fs from "fs";
import path from "path";
import { INTERVIEW_PARAMS, INTERVIEW_ROLES } from "./interviewFramework.js";
import { detachSharedStyles, keepOnlySheets } from "../lib/excelTemplate.js";

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
    ws.getCell(`M${5 + i}`).value = panel[i];
  }
  const byCode = new Map(result.lines.map((l) => [l.code, l]));
  for (let row = 14; row <= 36; row++) {
    const code = cellText(ws.getCell(`A${row}`).value);
    if (!code || code === "TOTAL") continue;
    const line = byCode.get(code);
    const mark = line && line.average > 0 ? Math.round(line.average * 10) / 10 : null;
    if (line) ws.getCell(`E${row}`).value = line.weight;
    ws.getCell(`F${row}`).value = mark;
    ws.getCell(`G${row}`).value = null;
    ws.getCell(`H${row}`).value = null;
    ws.getCell(`I${row}`).value = mark;
    ws.getCell(`J${row}`).value = line && line.weighted ? Math.round(line.weighted * 10000) / 10000 : null;
  }
  ws.getCell("C40").value = result.lines.length;
  ws.getCell("C41").value = result.lines.filter((l) => l.average > 0).length;
  ws.getCell("C43").value = result.percent / 100;
  ws.getCell("C44").value = result.knockout ? 1 : 0;
  ws.getCell("C47").value = result.grade;
  ws.getCell("C48").value = result.decision;
  // Drop lookups into the guide, framework, and rating scale so the filed file is only this scorecard.
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      if (v && typeof v === "object" && "formula" in v) cell.value = null;
    });
  });
  keepOnlySheets(wb, ["Scorecard"]);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export type SelectionMatrixRow = {
  name: string;
  position: string;
  date?: Date | string | null;
  r1?: number | null;
  r2?: number | null;
  r3?: number | null;
  composite?: number | null;
  knockout?: boolean;
  grade?: string;
  decision?: string;
};

function ascii(value: string) {
  return String(value || "").replace(/[^\x20-\x7E]/g, " ").trim();
}

function fmtDay(value?: Date | string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

/** One-sheet register. The guide and the blank sample rows are not included. */
export async function selectionMatrixWorkbook(rows: SelectionMatrixRow[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Selection matrix");
  ws.addRow(["S.No", "Candidate name", "Position", "Date", "R1 HR %", "R2 Tech %", "R3 Mgmt %", "Composite %", "Knock-out", "Grade", "Decision"]);
  ws.getRow(1).font = { bold: true };
  rows.forEach((row, i) => {
    ws.addRow([
      i + 1,
      row.name,
      row.position,
      fmtDay(row.date),
      row.r1 ?? "",
      row.r2 ?? "",
      row.r3 ?? "",
      row.composite ?? "",
      row.knockout ? "Y" : "N",
      row.grade || "",
      row.decision || "",
    ]);
  });
  ws.columns.forEach((col) => {
    col.width = 18;
  });
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

async function pdfDoc() {
  const { createRequire } = await import("node:module");
  const PDFDocument = createRequire(import.meta.url)("pdfkit") as typeof import("pdfkit");
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  return { doc, done };
}

/** Print of one round, same columns as the scorecard sheet. Filed beside the workbook. */
export async function buildScorecardPdf(
  candidateName: string,
  result: ScorecardResult,
  meta?: { interviewDate?: Date | string | null; panelists?: string[] },
): Promise<Buffer> {
  const { doc, done } = await pdfDoc();
  const name = String(candidateName || "Candidate").replace(/[^\x20-\x7E]/g, " ");
  try {
    const { sharnamLogoPath } = await import("./brandedExport.js");
    const logo = sharnamLogoPath();
    if (logo && fs.existsSync(logo)) doc.image(logo, 36, 28, { fit: [88, 30] });
  } catch {
    /* logo is optional */
  }
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(14).text("Candidate Interview Scorecard", 136, 32, { width: 420 });
  let y = 72;
  const facts: [string, string][] = [
    ["Candidate", name],
    ["Position", ascii(result.position)],
    ["Round", ascii(ROUND_LABEL[scorecardRoundId(result.round)] || result.round)],
    ["Date", fmtDay(meta?.interviewDate) || "-"],
  ];
  if (meta?.panelists?.length) facts.push(["Panel", ascii(meta.panelists.join(", "))]);
  doc.fontSize(9);
  for (const [label, value] of facts) {
    doc.font("Helvetica-Bold").text(label, 36, y, { width: 78 });
    doc.font("Helvetica").text(value || "-", 118, y, { width: 440 });
    y += 14;
  }
  y += 8;
  const widths = [300, 70, 70, 83];
  const tableW = widths.reduce((sum, w) => sum + w, 0);
  const headers = ["Parameter", "Weight", "Score", "Weighted"];
  const paintHead = () => {
    doc.rect(36, y, tableW, 16).fill("#445469");
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(8);
    let x = 40;
    headers.forEach((header, i) => {
      doc.text(header, x, y + 4, { width: widths[i] - 8 });
      x += widths[i];
    });
    y += 16;
  };
  paintHead();
  const lines = result.lines.filter((line) => line.weight > 0);
  lines.forEach((line, index) => {
    if (y > 760) {
      doc.addPage();
      y = 36;
      paintHead();
    }
    const rowH = 16;
    if (index % 2 === 0) doc.rect(36, y, tableW, rowH).fill("#f4f7fb");
    const score = line.average ? `${Math.round(line.average * 10) / 10} / 5` : "-";
    const weight = `${Math.round(line.weight * 1000) / 10}%`;
    const weighted = line.weighted ? String(Math.round(line.weighted * 1000) / 10) : "-";
    const cells = [ascii(line.parameter).slice(0, 72), weight, score, weighted];
    doc.fillColor("#111").font("Helvetica").fontSize(8);
    let x = 40;
    cells.forEach((cell, i) => {
      doc.text(cell, x, y + 4, { width: widths[i] - 8 });
      x += widths[i];
    });
    y += rowH;
  });
  y += 14;
  doc.fillColor("#111").font("Helvetica-Bold").fontSize(10);
  doc.text(`Overall Score: ${result.percent}%`, 36, y, { width: 180 });
  doc.text(`Grade: ${result.grade || "-"}`, 230, y, { width: 120 });
  doc.text(`Decision: ${result.decision || "-"}`, 360, y, { width: 180 });
  y += 16;
  doc.font("Helvetica").fontSize(9).text(result.knockout ? "Knock-out: Yes" : "Knock-out: No", 36, y);
  doc.end();
  return done;
}

export async function buildSelectionMatrixPdf(rows: SelectionMatrixRow[]): Promise<Buffer> {
  const { doc, done } = await pdfDoc();
  doc.font("Helvetica-Bold").fontSize(13).text("Candidate selection matrix");
  doc.moveDown(0.5);
  doc.font("Helvetica").fontSize(8);
  if (!rows.length) doc.text("No scored rounds yet.");
  for (const row of rows) {
    const scores = [`R1 ${row.r1 ?? "-"}`, `R2 ${row.r2 ?? "-"}`, `R3 ${row.r3 ?? "-"}`, `Composite ${row.composite ?? "-"}`].join("   ");
    doc.font("Helvetica-Bold").text(`${row.name}  ·  ${row.position}`);
    doc.font("Helvetica").text(`${fmtDay(row.date) || "No date"}   ${scores}`);
    doc.text(`${row.knockout ? "Knock-out" : "No knock-out"}   ${row.grade || ""}   ${row.decision || ""}`);
    doc.moveDown(0.35);
  }
  doc.end();
  return done;
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
