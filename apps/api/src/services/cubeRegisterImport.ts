/**
 * SPDC CUBE REGISTER — parse grouped footing rows (7-day + 28-day specimens per Sr. No.)
 */
import fs from "fs";
import path from "path";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function s(v: unknown, max = 500) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && v > 20000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(v));
    return epoch;
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ParsedCubeSpecimen = {
  srNo: string;
  castDate: Date | null;
  description: string;
  grade: string | null;
  cubeWeight: number | null;
  testDate7: Date | null;
  testDate28: Date | null;
  load7: number | null;
  load28: number | null;
  strength7: number | null;
  strength28: number | null;
  avgStrength: number | null;
  result: string | null;
};

export function parseCubeRegisterRows(rows: unknown[][]): ParsedCubeSpecimen[] {
  let headerIdx = rows.findIndex((r) => /sr\.?\s*no/i.test(String(r[0] ?? "")));
  if (headerIdx < 0) headerIdx = 8;
  const start = headerIdx + 2; // skip 7-day / 28-day sub-header row

  const out: ParsedCubeSpecimen[] = [];
  let lastSr = "";
  let lastCast: Date | null = null;
  let lastDesc = "";
  let lastGrade: string | null = null;
  let lastTest7: Date | null = null;
  let lastTest28: Date | null = null;

  for (let i = start; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const srRaw = s(row[0], 20);
    const desc = s(row[2], 300);
    const grade = s(row[3], 40);

    if (srRaw && /^\d+$/.test(srRaw)) {
      lastSr = srRaw;
      lastCast = excelDate(row[1]);
      if (desc) lastDesc = desc;
      if (grade) lastGrade = grade;
      const t7 = excelDate(row[5]);
      const t28 = excelDate(row[6]);
      if (t7) lastTest7 = t7;
      if (t28) lastTest28 = t28;
    }

    const weight = n(row[4]) || null;
    const load7 = n(row[7]) || null;
    const load28 = n(row[8]) || null;
    const strengthVal = n(row[9]) || null;
    const avgStrength = n(row[10]) || null;
    const result = s(row[11], 40) || null;

    if (!lastSr || (!weight && !load7 && !load28 && !strengthVal)) continue;

    const test7 = excelDate(row[5]) || lastTest7;
    const test28 = excelDate(row[6]) || lastTest28;

    out.push({
      srNo: lastSr,
      castDate: lastCast,
      description: lastDesc || desc || `Cube group ${lastSr}`,
      grade: grade || lastGrade,
      cubeWeight: weight,
      testDate7: test7,
      testDate28: test28,
      load7: load7 || null,
      load28: load28 || null,
      strength7: load7 && strengthVal ? strengthVal : null,
      strength28: load28 && strengthVal ? strengthVal : null,
      avgStrength: avgStrength || null,
      result: result || null,
    });
  }

  return out;
}

export function parseCubeRegisterWorkbook(buffer: Buffer): ParsedCubeSpecimen[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames.find((n) => /sheet1/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
  }) as unknown[][];
  return parseCubeRegisterRows(rows);
}

export function resolveCubeRegisterPath(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT
      ? path.join(process.env.SHARNAM_EXCEL_ROOT, "SPDC CUBE REGISTER (1).xlsx")
      : "",
    path.join(process.cwd(), "seed", "data", "SPDC CUBE REGISTER (1).xlsx"),
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", "SPDC CUBE REGISTER (1).xlsx"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function importCubeRegisterWorkbook(projectId: string, buffer: Buffer, replace = true) {
  const parsed = parseCubeRegisterWorkbook(buffer);
  if (!parsed.length) throw new Error("No cube rows found — use SPDC CUBE REGISTER layout");

  await prisma.$transaction(async (tx) => {
    if (replace) {
      await tx.cubeTest.deleteMany({
        where: { projectId, source: { in: ["SPDC CUBE REGISTER (1).xlsx", "portal-cube-template"] } },
      });
    }
    for (const row of parsed) {
      await tx.cubeTest.create({
        data: {
          projectId,
          srNo: row.srNo,
          castDate: row.castDate,
          description: row.description,
          grade: row.grade,
          cubeWeight: row.cubeWeight,
          testDate7: row.testDate7,
          testDate28: row.testDate28,
          load7: row.load7,
          load28: row.load28,
          strength7: row.strength7,
          strength28: row.strength28,
          strength: row.strength7 ?? row.strength28 ?? null,
          avgStrength: row.avgStrength,
          result: row.result || (row.avgStrength ? "PASS" : "Pending"),
          source: "SPDC CUBE REGISTER (1).xlsx",
        },
      });
    }
  });

  const groups = new Set(parsed.map((r) => r.srNo));
  return { imported: parsed.length, groups: groups.size };
}
