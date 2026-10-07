/**
 * Quality Dashboard.xlsx — stamp project branding and rewrite live tabs from DB.
 * Keeps the client layout (Dashboard, SOR, Cube, Org chart, CAR, QAP detail).
 */
import fs from "fs";
import ExcelJS from "exceljs";
import { prisma } from "../prisma.js";
import { findWorkbook } from "../lib/excelRoot.js";
import { SPDC_PMC_NAME } from "@sharnam/shared";
import { drawingRegisterWeekStamp } from "./drawingRegisterDrive.js";
import { detachSharedStyles } from "../lib/excelTemplate.js";
import { restoreTemplateCharts } from "../lib/xlsxCharts.js";

function day(v?: Date | null) {
  if (!v) return "";
  return v.toISOString().slice(0, 10);
}

export async function exportQualityDashboardWorkbook(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const tpl = findWorkbook(["Quality Dashboard.xlsx", "Quality Dashboard (1).xlsx"]);
  if (!tpl || !fs.existsSync(tpl)) {
    throw new Error("Quality Dashboard.xlsx template not found under SHARNAM_EXCEL_ROOT / seed/data");
  }

  const [ncrs, siteRecords, cubes, qapCount, qiFills] = await Promise.all([
    prisma.qualityNcr.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.qualitySiteRecord.findMany({ where: { projectId } }),
    prisma.cubeTest.findMany({ where: { projectId }, orderBy: [{ castDate: "asc" }, { srNo: "asc" }] }),
    prisma.qapActivity.count({ where: { projectId } }),
    prisma.checklistSubmission.count({
      where: {
        assignment: { projectId, template: { checklistType: "QualityInspection" } },
        status: { in: ["Submitted", "Approved"] },
      },
    }),
  ]);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tpl);

  detachSharedStyles(wb);
  const pass7 = cubes.filter((c) => c.strength7 != null && /pass/i.test(c.result || "")).length;
  const samples = cubes.filter((c) => c.strength7 != null || c.strength28 != null || c.strength != null).length;

  const dash = wb.worksheets.find((s) => /dashboard/i.test(s.name)) || wb.worksheets[0];
  if (dash) {
    for (const row of dash.getRows(1, 40) || []) {
      row.eachCell((cell) => {
        const v = String(cell.value ?? "");
        if (/^project$/i.test(v.trim()) || /project\s*:/i.test(v)) {
          const next = dash.getCell(row.number, cell.col + 1);
          if (!String(next.value || "").trim() || /safari|halol|dormitory|santej|burckhardt/i.test(String(next.value))) {
            next.value = project.name;
          }
        }
        if (/^client$/i.test(v.trim())) {
          const next = dash.getCell(row.number, cell.col + 1);
          if (project.clientName) next.value = project.clientName;
        }
        if (/pm\s*consultant|pmc/i.test(v) && !/logo/i.test(v)) {
          const next = dash.getCell(row.number, cell.col + 1);
          next.value = project.pmcName || SPDC_PMC_NAME;
        }
      });
    }
    // KPI value row under Dashboard labels (template R7)
    dash.getCell("G7").value = samples;
    dash.getCell("L7").value = pass7 || samples;
    dash.getCell("A1").value = `Quality Performance Report — ${project.name}`;
    dash.getCell("A1").note = `Portal sync ${drawingRegisterWeekStamp()} · QI fills ${qiFills} · QAP lines ${qapCount} · Cubes ${cubes.length} · NCR ${ncrs.length}`;
  }

  // CAR register — client header on row 2, data from row 3
  const car =
    wb.worksheets.find((s) => /car\s*register/i.test(s.name)) ||
    wb.addWorksheet("CAR register");
  const carHeaderRow = 2;
  const carStart = 3;
  if (car.rowCount >= carStart) {
    car.spliceRows(carStart, Math.max(0, car.rowCount - carStart + 1));
  }
  car.getCell(1, 1).value = "NON CONFORMANCE AND CORRECTIVE ACTION REGISTER";
  car.getCell(carHeaderRow, 1).value = "No.";
  car.getCell(carHeaderRow, 2).value = "NCR / CAR Issue Date";
  car.getCell(carHeaderRow, 3).value = "Type";
  car.getCell(carHeaderRow, 4).value = "Contractor";
  car.getCell(carHeaderRow, 5).value = "Brief Description of Non Conformance";
  car.getCell(carHeaderRow, 6).value = "Location";
  car.getCell(carHeaderRow, 7).value = "Planned Closure Date";
  car.getCell(carHeaderRow, 8).value = "Actual Closure Date";
  car.getCell(carHeaderRow, 9).value = "Status";
  for (let c = 1; c <= 9; c++) {
    car.getCell(carHeaderRow, c).font = { bold: true, color: { argb: "FFFFFFFF" } };
    car.getCell(carHeaderRow, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  }
  ncrs.forEach((n, i) => {
    const r = carStart + i;
    car.getCell(r, 1).value = n.number || `NCR-${i + 1}`;
    car.getCell(r, 2).value = day(n.issueDate || n.createdAt);
    car.getCell(r, 3).value = n.ncrType || (/^CAR/i.test(n.number || "") ? "CAR" : "Quality");
    car.getCell(r, 4).value = n.contractor || "";
    car.getCell(r, 5).value = n.description;
    car.getCell(r, 6).value = n.location || "";
    car.getCell(r, 7).value = day(n.plannedClosure);
    car.getCell(r, 8).value = day(n.actualClosure);
    car.getCell(r, 9).value = n.status;
  });

  const sor = wb.worksheets.find((s) => /sor\s*log/i.test(s.name));
  if (sor) {
    const obs = siteRecords.filter((r) => /observ/i.test(r.recordType || "") || /observation/i.test(r.title || ""));
    const instr = siteRecords.filter((r) => /instruct/i.test(r.recordType || "") || /instruction/i.test(r.title || ""));
    const fallbackObs = obs.length || siteRecords.filter((r) => !/instruct/i.test(`${r.recordType || ""} ${r.title || ""}`)).length;
    const fallbackInstr = instr.length || Math.max(0, siteRecords.length - fallbackObs);
    const openOf = (rows: typeof siteRecords) => rows.filter((r) => !/close|closed|done/i.test(r.status || "")).length;
    const obsRows = obs.length ? obs : siteRecords.slice(0, fallbackObs);
    const instrRows = instr.length ? instr : siteRecords.slice(fallbackObs);
    // Template summary: R2 Site Observation, R3 Site Instruction, R4 NCR
    sor.getCell("C2").value = obsRows.length || fallbackObs;
    sor.getCell("D2").value = openOf(obsRows.length ? obsRows : siteRecords);
    sor.getCell("C3").value = instrRows.length || fallbackInstr;
    sor.getCell("D3").value = openOf(instrRows.length ? instrRows : []);
    sor.getCell("C4").value = ncrs.length;
    sor.getCell("D4").value = ncrs.filter((n) => !/close/i.test(n.status || "")).length;
    sor.getCell("A1").note = `Portal SOR ${siteRecords.length} · NCR ${ncrs.length} · ${drawingRegisterWeekStamp()}`;
  }

  const cubeSheet = wb.worksheets.find((s) => /cube\s*test/i.test(s.name));
  if (cubeSheet) {
    // Clear sample strength rows (template starts ~R4 under Sample # header)
    for (let r = 4; r <= Math.max(cubeSheet.rowCount, 40); r++) {
      cubeSheet.getCell(r, 1).value = null;
      cubeSheet.getCell(r, 2).value = null;
      cubeSheet.getCell(r, 3).value = null;
    }
    cubeSheet.getCell(3, 1).value = "Sample #";
    cubeSheet.getCell(3, 2).value = "Compressive strength at 7 days";
    cubeSheet.getCell(3, 3).value = "IS code lower limit";
    const with7 = cubes.filter((c) => c.strength7 != null || (c.strength != null && c.load7));
    const source = with7.length ? with7 : cubes.filter((c) => c.strength != null || c.strength28 != null).slice(0, 40);
    source.slice(0, 80).forEach((c, i) => {
      const r = 4 + i;
      cubeSheet.getCell(r, 1).value = i + 1;
      cubeSheet.getCell(r, 2).value = c.strength7 ?? c.strength ?? c.strength28 ?? "";
      cubeSheet.getCell(r, 3).value = 17;
    });
  }

  const buf = await restoreTemplateCharts(fs.readFileSync(tpl), Buffer.from(await wb.xlsx.writeBuffer()));
  return {
    buffer: buf,
    counts: { ncrs: ncrs.length, siteRecords: siteRecords.length, cubes: cubes.length, qapCount, qiFills },
  };
}
