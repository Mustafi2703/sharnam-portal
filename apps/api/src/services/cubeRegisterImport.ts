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
      await tx.cubeTest.deleteMany({ where: { projectId } });
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

export async function exportCubeWorkbook(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const rows = await prisma.cubeTest.findMany({
    where: { projectId },
    orderBy: [{ srNo: "asc" }, { castDate: "asc" }, { description: "asc" }],
  });
  if (!rows.length) throw new Error("No cube rows to export");

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
    "Test agency",
  ];

  const fmtDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

  const dataRows = rows.map((r) => [
    r.srNo || "",
    fmtDay(r.castDate),
    r.description,
    r.grade || "",
    r.cubeWeight ?? "",
    fmtDay(r.testDate7),
    fmtDay(r.testDate28),
    r.load7 ?? "",
    r.load28 ?? "",
    r.strength7 ?? r.strength28 ?? r.strength ?? "",
    r.avgStrength ?? "",
    r.result || "Pending",
    r.testAgency || "",
  ]);

  const templatePath = resolveCubeRegisterPath();
  if (templatePath && fs.existsSync(templatePath)) {
    const wb = XLSX.read(fs.readFileSync(templatePath), { type: "buffer" });
    const sheetName = wb.SheetNames.find((n) => /sheet1/i.test(n)) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const metaRows: [string, string][] = [
      ["Project", project.name],
      ["Client", project.clientName || ""],
      ["Design Consultant", project.designConsultant || ""],
      ["PM Consultant", "Sharnam Project Management Consultants"],
      ["Contractor", project.contractorName || ""],
    ];
    for (let i = 0; i < metaRows.length; i++) {
      const cellA = XLSX.utils.encode_cell({ r: i, c: 0 });
      const cellB = XLSX.utils.encode_cell({ r: i, c: 1 });
      if (!ws[cellA]) ws[cellA] = { t: "s", v: metaRows[i][0] };
      else ws[cellA].v = metaRows[i][0];
      if (!ws[cellB]) ws[cellB] = { t: "s", v: metaRows[i][1] };
      else ws[cellB].v = metaRows[i][1];
    }
    const startRow = 10;
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      for (let c = 0; c < row.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: startRow + i, c });
        const val = row[c];
        ws[addr] = { t: typeof val === "number" ? "n" : "s", v: val ?? "" };
      }
    }
    return {
      buffer: Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })),
      rowCount: rows.length,
    };
  }

  const { workbookBuffer } = await import("./brandedExport.js");
  const coverRows: (string | number)[][] = [
    ["SPDC Cube Register"],
    ["Project", project.name],
    ["Client", project.clientName || ""],
    ["Design Consultant", project.designConsultant || ""],
    ["PM Consultant", "Sharnam Project Management Consultants"],
    ["Contractor", project.contractorName || ""],
    [],
    header,
    ...dataRows,
  ];
  return {
    buffer: workbookBuffer([{ name: "Sheet1", rows: coverRows }], { title: "Cube Register", projectCode: project.code }),
    rowCount: rows.length,
  };
}
