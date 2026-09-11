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

export type CubeGroupSpecimenInput = {
  phase?: "7d" | "28d";
  cubeWeight?: number | null;
  load7?: number | null;
  load28?: number | null;
};

export async function createSpdcCubeGroup(opts: {
  projectId: string;
  srNo?: string | null;
  castDate?: Date | null;
  description: string;
  grade?: string | null;
  testAgency?: string | null;
  testDate7?: Date | null;
  testDate28?: Date | null;
  result?: string | null;
  source?: string | null;
  specimens?: CubeGroupSpecimenInput[];
}) {
  const { applyCubeFormula } = await import("@sharnam/shared");
  const slots: CubeGroupSpecimenInput[] =
    opts.specimens && opts.specimens.length ? opts.specimens : [{}, {}, {}];
  return prisma.$transaction(
    slots.map((slot) => {
      const load7 = slot.phase === "28d" ? null : slot.load7 ?? null;
      const load28 = slot.phase === "7d" ? null : slot.load28 ?? null;
      const computed = applyCubeFormula({
        load7,
        load28,
        grade: opts.grade,
        result: opts.result || "Pending",
      });
      return prisma.cubeTest.create({
        data: {
          projectId: opts.projectId,
          srNo: opts.srNo || null,
          castDate: opts.castDate || null,
          description: opts.description,
          grade: opts.grade || "M25",
          testAgency: opts.testAgency || null,
          testDate7: opts.testDate7 || null,
          testDate28: opts.testDate28 || null,
          cubeWeight: slot.cubeWeight ?? null,
          load7,
          load28,
          strength7: computed.strength7,
          strength28: computed.strength28,
          strength: computed.strength,
          avgStrength: computed.avgStrength,
          result: computed.result,
          source: opts.source || "portal",
        },
      });
    })
  );
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
      await tx.cubeTest.deleteMany({ where: { projectId } });
    }
    const { applyCubeFormula } = await import("@sharnam/shared");
    for (const row of parsed) {
      const computed = applyCubeFormula({
        load7: row.load7,
        load28: row.load28,
        strength7: row.strength7,
        strength28: row.strength28,
        avgStrength: row.avgStrength,
        grade: row.grade,
        result: row.result || "Pending",
      });
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
          strength7: computed.strength7,
          strength28: computed.strength28,
          strength: computed.strength,
          avgStrength: computed.avgStrength ?? row.avgStrength,
          result: computed.result,
          source: "SPDC CUBE REGISTER (1).xlsx",
        },
      });
    }
  });

  const groups = new Set(parsed.map((r) => r.srNo));
  return { imported: parsed.length, groups: groups.size };
}

export async function exportCubeWorkbook(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const rows = await prisma.cubeTest.findMany({
    where: { projectId },
    orderBy: [{ srNo: "asc" }, { castDate: "asc" }, { description: "asc" }],
  });
  if (!rows.length) throw new Error("No cube rows to export");

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const sr = String(r.srNo || "").replace(/-([23])$/, "") || "—";
    const key = `${sr}|${r.castDate ? r.castDate.toISOString().slice(0, 10) : ""}|${r.description || ""}`;
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  }

  const templatePath = resolveCubeRegisterPath();
  if (templatePath && fs.existsSync(templatePath)) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.worksheets[0];
    if (ws) {
      ws.getCell("E2").value = project.name;
      ws.getCell("E3").value = project.clientName || "";
      ws.getCell("E4").value = project.designConsultant || "";
      ws.getCell("E5").value = project.pmcName || "Sharnam Project Development Consultants & Co. (SPDC)";
      ws.getCell("E6").value = project.contractorName || "";
      let excelRow = 11;
      for (const group of groups.values()) {
        const d7 = group.filter((r) => r.load7 || r.strength7 != null);
        const d28 = group.filter((r) => r.load28 || r.strength28 != null);
        const rest = group.filter((r) => !d7.includes(r) && !d28.includes(r));
        const ordered = d7.length || d28.length ? [...d7, ...d28, ...rest] : group;
        const avg7 = average(d7.map((r) => r.strength7 ?? r.strength));
        const avg28 = average(d28.map((r) => r.strength28 ?? r.strength));
        const head = ordered[0];
        ordered.forEach((r, i) => {
          const is7 = Boolean(r.load7 || r.strength7 != null) || (!r.load28 && i < 3);
          ws.getCell(excelRow, 2).value = i === 0 ? Number(head.srNo) || head.srNo || "" : "";
          ws.getCell(excelRow, 3).value = i === 0 && head.castDate ? head.castDate : "";
          ws.getCell(excelRow, 4).value = i === 0 ? head.description : "";
          ws.getCell(excelRow, 5).value = i === 0 ? head.grade || "" : "";
          ws.getCell(excelRow, 6).value = r.cubeWeight ?? "";
          ws.getCell(excelRow, 7).value = i === 0 && head.testDate7 ? head.testDate7 : "";
          ws.getCell(excelRow, 8).value = i === 0 && head.testDate28 ? head.testDate28 : "";
          ws.getCell(excelRow, 9).value = is7 ? r.load7 ?? "" : "";
          ws.getCell(excelRow, 10).value = !is7 ? r.load28 ?? "" : "";
          ws.getCell(excelRow, 11).value = (is7 ? r.strength7 : r.strength28) ?? r.strength ?? "";
          const first7 = i === 0;
          const first28 = is7 === false && ordered.findIndex((x) => x.load28 || x.strength28 != null) === i;
          ws.getCell(excelRow, 12).value = first7 ? avg7 ?? "" : first28 ? avg28 ?? "" : "";
          ws.getCell(excelRow, 13).value = first7 || first28 ? r.result || head.result || "" : "";
          excelRow += 1;
        });
      }
    }
    const buf = await wb.xlsx.writeBuffer();
    return { buffer: Buffer.from(buf), rowCount: rows.length };
  }

  const { workbookBuffer } = await import("./brandedExport.js");
  const header = [
    "Sr. No.",
    "Date of Casting",
    "Description",
    "Grade",
    "Weight of cube (kg)",
    "7-day Testing Date",
    "28-day Testing Date",
    "7-day Load (kN)",
    "28-day Load (kN)",
    "Strength (MPa)",
    "Average Strength (MPa)",
    "Result",
  ];
  const dataRows = rows.map((r) => [
    r.srNo || "",
    r.castDate ? r.castDate.toISOString().slice(0, 10) : "",
    r.description,
    r.grade || "",
    r.cubeWeight ?? "",
    r.testDate7 ? r.testDate7.toISOString().slice(0, 10) : "",
    r.testDate28 ? r.testDate28.toISOString().slice(0, 10) : "",
    r.load7 ?? "",
    r.load28 ?? "",
    r.strength7 ?? r.strength28 ?? r.strength ?? "",
    r.avgStrength ?? "",
    r.result || "Pending",
  ]);
  return {
    buffer: workbookBuffer([{ name: "Sheet1", rows: [["CUBE REGISTER"], [], header, ...dataRows] }], {
      title: "Cube Register",
      projectCode: project.code,
    }),
    rowCount: rows.length,
  };
}

function average(vals: Array<number | null | undefined>): number | null {
  const nums = vals.filter((n): n is number => n != null && Number.isFinite(n));
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}
