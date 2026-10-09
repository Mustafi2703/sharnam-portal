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
    // KPI value row under Dashboard labels (template R7) — every cell from this project, none from the sample sheet.
    const weekEnd = new Date();
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000);
    const dprWeek = await prisma.dprSnapshot.findMany({
      where: { projectId, logDate: { gte: weekStart, lte: weekEnd } },
      select: { linesJson: true },
    });
    let concreteM3 = 0;
    for (const sn of dprWeek) {
      let lines: { description?: string; unit?: string; qtyToday?: number }[] = [];
      try {
        lines = JSON.parse(sn.linesJson || "[]");
      } catch {
        lines = [];
      }
      for (const l of lines) {
        if (/cum|cmt|m3|m³|cu\.?\s?m/i.test(l.unit || "") && /concret|rcc|pcc|pour|slab|column|footing|raft|beam/i.test(l.description || "")) concreteM3 += Number(l.qtyToday) || 0;
      }
    }
    const lastWeekCubes = cubes.filter((c) => c.castDate && c.castDate >= weekStart && c.castDate <= weekEnd);
    const pass7Week = lastWeekCubes.filter((c) => c.strength7 != null && /pass/i.test(c.result || "")).length;
    const fail7n = lastWeekCubes.filter((c) => c.strength7 != null && c.result && /fail/i.test(c.result)).length;
    const fail28n = cubes.filter((c) => c.strength28 != null && c.result && /fail/i.test(c.result)).length;
    dash.getCell("A7").value = `${Math.round(concreteM3 * 10) / 10} m3`;
    dash.getCell("G7").value = lastWeekCubes.length;
    dash.getCell("L7").value = pass7Week;
    dash.getCell("Q7").value = fail7n ? `${fail7n} sample(s) cast last week have not passed the 7-day strength — PMC to review.` : "No 7-day failures among the samples cast last week.";
    dash.getCell("V7").value = fail28n;
    // Quality performance index: average closure rate of site observations, instructions and NCRs.
    const closureOf = (open: number, total: number) => (total > 0 ? (total - open) / total : null);
    const obsAll = siteRecords.filter((r) => !/instruct/i.test(`${r.recordType || ""} ${r.title || ""}`));
    const insAll = siteRecords.filter((r) => /instruct/i.test(`${r.recordType || ""} ${r.title || ""}`));
    const isOpen = (r: { status?: string | null }) => !/close|closed|done/i.test(r.status || "");
    const rates = [
      closureOf(obsAll.filter(isOpen).length, obsAll.length),
      closureOf(insAll.filter(isOpen).length, insAll.length),
      closureOf(ncrs.filter((n) => !/close/i.test(n.status || "")).length, ncrs.length),
    ].filter((v): v is number => v != null);
    const wk = (() => {
      const t = new Date(Date.UTC(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate()));
      t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
      return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
    })();
    dash.getCell("A25").value = wk ? `QPI Week ${wk}` : "QPI this week";
    dash.getCell("E25").value = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100 : null;
    for (const r of [26, 27]) {
      dash.getCell(`A${r}`).value = null;
      dash.getCell(`E${r}`).value = null;
    }
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

  // Checklist summary (pivot): filled QI checklists by discipline / category — replaces the client's sample counts.
  const sheet2 = wb.worksheets.find((x) => x.name === "Sheet2");
  if (sheet2) {
    const filled = await prisma.checklistSubmission.findMany({
      where: { assignment: { projectId, template: { checklistType: { in: ["QualityInspection", "SiteExecution", "Safety"] } } }, status: { in: ["Submitted", "Approved", "Reviewed"] } },
      select: { assignment: { select: { template: { select: { category: true } } } } },
    });
    const byCat = new Map<string, number>();
    for (const f of filled) {
      const c = (f.assignment?.template?.category || "Other").trim() || "Other";
      byCat.set(c, (byCat.get(c) || 0) + 1);
    }
    for (let r = 2; r <= 40; r++) {
      sheet2.getCell(r, 1).value = null;
      sheet2.getCell(r, 2).value = null;
    }
    let r = 2;
    for (const [cat, n] of [...byCat.entries()].sort()) {
      sheet2.getCell(r, 1).value = cat;
      sheet2.getCell(r, 2).value = n;
      r++;
    }
    sheet2.getCell(r, 1).value = "Grand Total";
    sheet2.getCell(r, 2).value = filled.length;
  }

  // QAP detail: project header and this project's activity lines (never the client's sample plan).
  const qapSheet = wb.worksheets.find((x) => /quality assurance plan/i.test(x.name));
  if (qapSheet) {
    qapSheet.getCell("C2").value = project.name;
    qapSheet.getCell("C3").value = project.clientName || "";
    qapSheet.getCell("C4").value = (project as { designConsultant?: string | null }).designConsultant || "";
    qapSheet.getCell("C5").value = project.pmcName || SPDC_PMC_NAME;
    qapSheet.getCell("C6").value = (project as { contractorName?: string | null }).contractorName || "";
    for (const m of [...((qapSheet.model as unknown as { merges?: string[] }).merges || [])]) {
      const top = Number(m.match(/\d+/)?.[0] || 0);
      if (top >= 10) qapSheet.unMergeCells(m);
    }
    const last = Math.max(qapSheet.rowCount, 12);
    for (let r = 10; r <= last; r++) for (let c = 1; c <= 12; c++) qapSheet.getCell(r, c).value = null;
    const qapRows = await prisma.qapActivity.findMany({ where: { projectId }, orderBy: [{ weekLabel: "desc" }, { section: "asc" }, { srNo: "asc" }] });
    const latestWeek = qapRows[0]?.weekLabel;
    qapRows
      .filter((q) => q.weekLabel === latestWeek)
      .forEach((q, i) => {
        const r = 10 + i;
        qapSheet.getCell(r, 1).value = q.srNo || "";
        qapSheet.getCell(r, 2).value = q.section || q.activity || "";
        qapSheet.getCell(r, 3).value = q.description || "";
        qapSheet.getCell(r, 4).value = q.frequency || "";
        qapSheet.getCell(r, 5).value = q.codeOfConformance || "";
        qapSheet.getCell(r, 6).value = q.testAgency || "";
        qapSheet.getCell(r, 7).value = q.contractorPerformer || "";
        qapSheet.getCell(r, 8).value = q.contractorChecker || "";
        qapSheet.getCell(r, 9).value = q.pmcRole || "";
        qapSheet.getCell(r, 10).value = q.clientRole || "";
        qapSheet.getCell(r, 11).value = q.records || "";
        qapSheet.getCell(r, 12).value = q.remarks || "";
      });
  }

  const buf = await restoreTemplateCharts(fs.readFileSync(tpl), Buffer.from(await wb.xlsx.writeBuffer()));
  return {
    buffer: buf,
    counts: { ncrs: ncrs.length, siteRecords: siteRecords.length, cubes: cubes.length, qapCount, qiFills },
  };
}
