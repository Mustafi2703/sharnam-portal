/**
 * Safety Dashboard.xlsx · HIRA sheet — Hazard Identification & Risk Assessment.
 * Parses every risk row (A1–O5 on the client workbook), not only first-per-activity.
 */
import fs from "fs";
import path from "path";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";

function s(v: unknown, max = 800) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

function n(v: unknown): number | null {
  const x = Number(v);
  return Number.isFinite(x) && String(v ?? "").trim() !== "" ? x : null;
}

export type ParsedHiraRow = {
  srNo: string;
  activity: string;
  riskId: string;
  hazard: string;
  consequence: string;
  legalConcern: string;
  probability: number | null;
  impact: number | null;
  severityScore: number | null;
  controlMeasure: string;
  residualProbability: number | null;
  residualImpact: number | null;
  residualSeverity: number | null;
  remarks: string;
};

function isHeaderish(text: string) {
  return /^(sr\.?\s*no\.?|activity|risk id|hazard identification|name of project|sharnam project|id no|revision)$/i.test(
    text.trim()
  );
}

function severityBand(score: number | null): "Low" | "Medium" | "High" | "Critical" {
  if (score == null) return "Medium";
  if (score >= 15) return "Critical";
  if (score >= 8) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

export function parseHiraRegisterRows(rows: unknown[][]): ParsedHiraRow[] {
  const headerIdx = rows.findIndex((r) => /sr\.?\s*no/i.test(String(r[0] ?? "")) && /activity/i.test(String(r[1] ?? "")));
  const start = headerIdx >= 0 ? headerIdx + 2 : 6;
  const out: ParsedHiraRow[] = [];
  let activity = "";
  let srNo = "";

  for (let i = start; i < rows.length; i++) {
    const r = (rows[i] as unknown[]) || [];
    const srRaw = s(r[0], 20);
    const act = s(r[1], 240);
    const riskId = s(r[2], 40);
    const hazard = s(r[3], 400);
    const consequence = s(r[4], 400);
    if (act) activity = act;
    if (srRaw && !isHeaderish(srRaw)) srNo = srRaw;
    if (!riskId || isHeaderish(riskId) || isHeaderish(hazard)) continue;
    if (!/^[A-Z]\d+$/i.test(riskId) && !hazard && !consequence) continue;
    if (!hazard && !consequence) continue;

    const probability = n(r[6]);
    const impact = n(r[7]);
    const severityScore = n(r[8]) ?? (probability != null && impact != null ? probability * impact : null);
    const residualProbability = n(r[10]);
    const residualImpact = n(r[11]);
    const residualSeverity =
      n(r[12]) ??
      (residualProbability != null && residualImpact != null ? residualProbability * residualImpact : null);

    out.push({
      srNo,
      activity: activity || act || "General",
      riskId,
      hazard,
      consequence,
      legalConcern: s(r[5], 20),
      probability,
      impact,
      severityScore,
      controlMeasure: s(r[9], 800),
      residualProbability,
      residualImpact,
      residualSeverity,
      remarks: s(r[13], 400),
    });
  }
  return out;
}

export function hiraToSafetyRecord(row: ParsedHiraRow, projectId: string, reportedById: string, source: string) {
  return {
    projectId,
    recordType: "JHA",
    ncrNumber: row.riskId,
    title: `${row.riskId} — ${row.hazard}`.slice(0, 200),
    activityTask: row.activity,
    category: row.srNo || null,
    description: [row.hazard, row.consequence].filter(Boolean).join(" · "),
    location: row.consequence || null,
    contributingFactors: row.legalConcern || null,
    rootCause: [row.probability, row.impact, row.severityScore].every((v) => v != null)
      ? `P ${row.probability} × I ${row.impact} = ${row.severityScore}`
      : null,
    correctiveAction: row.controlMeasure || null,
    actionTaken: row.controlMeasure || null,
    immediateAction: row.controlMeasure || null,
    longTermAction:
      [row.residualProbability, row.residualImpact, row.residualSeverity].every((v) => v != null)
        ? `Residual P ${row.residualProbability} × I ${row.residualImpact} = ${row.residualSeverity}`
        : null,
    timeImpact: row.severityScore != null ? String(row.severityScore) : null,
    costImpact: row.residualSeverity != null ? String(row.residualSeverity) : null,
    severity: severityBand(row.severityScore),
    status: "Open",
    issuedTo: row.remarks || null,
    reportedById,
    source,
  };
}

function resolveSafetyDashboardPath(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT ? path.join(process.env.SHARNAM_EXCEL_ROOT, "Safety Dashboard.xlsx") : "",
    path.join(process.cwd(), "seed", "data", "Safety Dashboard.xlsx"),
    path.join(process.cwd(), "Sharnam_modules_docs", "Safety Dashboard.xlsx"),
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", "Safety Dashboard.xlsx"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function loadHiraRowsFromWorkbook(file?: string): ParsedHiraRow[] {
  const pathTo = file || resolveSafetyDashboardPath();
  if (!pathTo) return [];
  const wb = XLSX.readFile(pathTo);
  const key = wb.SheetNames.find((n: string) => /hira/i.test(n));
  if (!key || !wb.Sheets[key]) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], { header: 1, defval: "" }) as unknown[][];
  return parseHiraRegisterRows(rows);
}

export async function syncHiraFromTemplate(projectId: string, reportedById: string) {
  const file = resolveSafetyDashboardPath();
  if (!file) throw new Error("Safety Dashboard.xlsx not found — set SHARNAM_EXCEL_ROOT or seed/data.");
  const parsed = loadHiraRowsFromWorkbook(file);
  await prisma.safetyRecord.deleteMany({
    where: { projectId, recordType: "JHA", source: { contains: "Safety Dashboard" } },
  });
  for (const row of parsed) {
    await prisma.safetyRecord.create({
      data: hiraToSafetyRecord(row, projectId, reportedById, "Safety Dashboard.xlsx"),
    });
  }
  return { imported: parsed.length, source: path.basename(file) };
}
