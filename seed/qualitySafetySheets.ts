/**
 * Seed Quality / Safety / Cube / QAP / payment registers from client Excel packs.
 * Refresh-on-seed so sheet edits stay maintained when re-running db:seed.
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

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
function sheet(wb: XLSX.WorkBook, name: string | RegExp) {
  const key =
    typeof name === "string"
      ? wb.SheetNames.find((n) => n === name) || name
      : wb.SheetNames.find((n) => name.test(n));
  if (!key || !wb.Sheets[key]) return [] as unknown[][];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], { header: 1, defval: "" }) as unknown[][];
}

type ParsedQapRow = {
  srNo: string | null;
  section: string;
  description: string;
  frequency: string;
  codeOfConformance: string;
  testAgency: string;
  contractorPerformer: string;
  contractorChecker: string;
  pmcRole: string;
  clientRole: string;
  records: string;
  remarks: string;
};

function parseQapRows(rows: unknown[][], startRow = 9): ParsedQapRow[] {
  const out: ParsedQapRow[] = [];
  let section = "";
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const srRaw = s(row[0], 20);
    const act = s(row[1], 120);
    const detail = s(row[2], 400);
    if (act) section = act;
    if (!detail) continue;
    out.push({
      srNo: srRaw && /^\d+$/.test(srRaw) ? srRaw : null,
      section: section || act || "General",
      description: detail,
      frequency: s(row[3], 120),
      codeOfConformance: s(row[4], 160),
      testAgency: s(row[5], 120),
      contractorPerformer: s(row[6], 80),
      contractorChecker: s(row[7], 80),
      pmcRole: s(row[8], 80),
      clientRole: s(row[9], 80),
      records: s(row[10], 160),
      remarks: s(row[11], 120),
    });
  }
  return out;
}

async function seedQapRows(
  prisma: PrismaClient,
  projectId: string,
  rows: ParsedQapRow[],
  weekLabel: string,
  max = 500
) {
  let created = 0;
  for (const row of rows.slice(0, max)) {
    const contractorOk = !!(row.contractorPerformer || row.contractorChecker);
    const pmcOk = /review|witness|yes/i.test(row.pmcRole);
    const clientOk = /witness|random|yes/i.test(row.clientRole);
    const done = /complete|done|yes/i.test(row.remarks);
    const status = done || (pmcOk && clientOk) ? "Done" : "Open";
    const completedAt = done || (pmcOk && clientOk) ? new Date() : null;
    const legacyActivity = `${row.section} — ${row.description}`.slice(0, 400);

    try {
      await prisma.qapActivity.create({
        data: {
          projectId,
          weekLabel,
          srNo: row.srNo,
          section: row.section,
          activity: row.section,
          description: row.description,
          frequency: row.frequency || null,
          codeOfConformance: row.codeOfConformance || null,
          testAgency: row.testAgency || null,
          contractorPerformer: row.contractorPerformer || null,
          contractorChecker: row.contractorChecker || null,
          pmcRole: row.pmcRole || null,
          clientRole: row.clientRole || null,
          records: row.records || null,
          remarks: row.remarks || null,
          discipline: row.section,
          contractorOk,
          pmcOk,
          clientOk,
          status,
          completedAt,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/Unknown column|does not exist|no such column/i.test(msg)) throw err;
      await prisma.qapActivity.create({
        data: {
          projectId,
          weekLabel,
          activity: legacyActivity,
          discipline: row.section || null,
          contractorOk,
          pmcOk,
          clientOk,
          status,
          completedAt,
        },
      });
    }
    created++;
  }
  return created;
}

function parseSafetyRegisterTable(rows: unknown[][], recordType: string, source: string, reportedById: string, projectId: string) {
  const headerIdx = rows.findIndex((r) => String(r[0] ?? "").trim() === "S. No" || String(r[0] ?? "").trim() === "Sr");
  const start = headerIdx >= 0 ? headerIdx + 1 : 8;
  const out: Array<Record<string, unknown>> = [];
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const sn = n(r[0]);
    const location = s(r[1], 120);
    const description = s(r[5], 800);
    if (!sn || (!description && !location)) continue;
    if (/^total/i.test(String(r[0] ?? ""))) break;
    const statusRaw = s(r[8], 40) || "Open";
    const status = /closed/i.test(statusRaw) ? "Closed" : "Open";
    out.push({
      projectId,
      recordType,
      title: `${recordType} #${sn} — ${location || "Site"}`.slice(0, 200),
      description,
      severity: /height|pit|electrical|injury|major/i.test(description + s(r[6])) ? "High" : "Medium",
      status,
      location: location || null,
      category: s(r[6], 120) || null,
      actionTaken: s(r[7], 400) || null,
      correctiveAction: s(r[7], 400) || null,
      timeImpact: s(r[9], 40) || null,
      issuedTo: s(r[3], 120) || null,
      responsibleParty: s(r[2], 120) || null,
      occurredAt: excelDate(r[4]) || new Date(),
      closedAt: status === "Closed" ? new Date() : null,
      reportedById,
      source,
      ncrNumber: recordType === "NCR" ? `Safety-NCR-${sn}` : null,
    });
  }
  return out;
}

function parseHiraRegisterTable(rows: unknown[][], reportedById: string, projectId: string, source: string) {
  const headerIdx = rows.findIndex(
    (r) => /sr\.?\s*no/i.test(String(r[0] ?? "")) && /activity/i.test(String(r[1] ?? ""))
  );
  const start = headerIdx >= 0 ? headerIdx + 2 : 6;
  const out: Array<Record<string, unknown>> = [];
  let activity = "";
  let srNo = "";
  const headerish = (text: string) =>
    /^(sr\.?\s*no\.?|activity|risk id|hazard identification|name of project|sharnam project|id no|revision)$/i.test(
      text.trim()
    );
  const band = (score: number | null) => {
    if (score == null) return "Medium";
    if (score >= 15) return "Critical";
    if (score >= 8) return "High";
    if (score >= 4) return "Medium";
    return "Low";
  };

  for (let i = start; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const srRaw = s(r[0], 20);
    const act = s(r[1], 240);
    const riskId = s(r[2], 40);
    const hazard = s(r[3], 400);
    const consequence = s(r[4], 400);
    if (act) activity = act;
    if (srRaw && !headerish(srRaw)) srNo = srRaw;
    if (!riskId || headerish(riskId) || headerish(hazard)) continue;
    if (!hazard && !consequence) continue;
    const probability = Number.isFinite(Number(r[6])) && String(r[6] ?? "").trim() !== "" ? Number(r[6]) : null;
    const impact = Number.isFinite(Number(r[7])) && String(r[7] ?? "").trim() !== "" ? Number(r[7]) : null;
    const severityScore =
      Number.isFinite(Number(r[8])) && String(r[8] ?? "").trim() !== ""
        ? Number(r[8])
        : probability != null && impact != null
          ? probability * impact
          : null;
    const residualP = Number.isFinite(Number(r[10])) && String(r[10] ?? "").trim() !== "" ? Number(r[10]) : null;
    const residualI = Number.isFinite(Number(r[11])) && String(r[11] ?? "").trim() !== "" ? Number(r[11]) : null;
    const residualSev =
      Number.isFinite(Number(r[12])) && String(r[12] ?? "").trim() !== ""
        ? Number(r[12])
        : residualP != null && residualI != null
          ? residualP * residualI
          : null;
    const control = s(r[9], 800);
    out.push({
      projectId,
      recordType: "JHA",
      ncrNumber: riskId,
      title: `${riskId} — ${hazard}`.slice(0, 200),
      activityTask: activity || act || "General",
      category: srNo || null,
      description: [hazard, consequence].filter(Boolean).join(" · "),
      location: consequence || null,
      contributingFactors: s(r[5], 20) || null,
      rootCause:
        probability != null && impact != null && severityScore != null
          ? `P ${probability} × I ${impact} = ${severityScore}`
          : null,
      correctiveAction: control || null,
      actionTaken: control || null,
      immediateAction: control || null,
      longTermAction:
        residualP != null && residualI != null && residualSev != null
          ? `Residual P ${residualP} × I ${residualI} = ${residualSev}`
          : null,
      timeImpact: severityScore != null ? String(severityScore) : null,
      costImpact: residualSev != null ? String(residualSev) : null,
      issuedTo: s(r[13], 400) || null,
      severity: band(severityScore),
      status: "Open",
      reportedById,
      source,
    });
  }
  return out;
}

function parseObservationUnsafeActSheet(rows: unknown[][], reportedById: string, projectId: string, source: string) {
  const out: Array<Record<string, unknown>> = [];
  const location = s(rows[1]?.[2], 120) || "Site";
  const reportNo = s(rows[6]?.[2], 80);
  for (let i = 0; i < rows.length; i++) {
    const actType = s(rows[i]?.[3], 120);
    if (!actType || /others|specify|\[e\.g/i.test(actType)) continue;
    if (!/height|tool|ppe|housekeeping|electrical|scaffold|excavation/i.test(actType)) continue;
    out.push({
      projectId,
      recordType: "Observation",
      title: `Unsafe act — ${actType}`,
      description: `From Observation - Unsafe Act sheet${reportNo ? ` (${reportNo})` : ""}.`,
      category: actType,
      severity: /height|electrical/i.test(actType) ? "High" : "Low",
      status: "Open",
      location,
      reportedById,
      source,
    });
  }
  return out;
}

async function seedSafetyRecordsFromWorkbooks(
  prisma: PrismaClient,
  projectId: string,
  excelRoot: string,
  reportedById: string
) {
  const batch: Array<Record<string, unknown>> = [];

  const ncrFile = path.join(excelRoot, "Safety NCR.xlsx");
  if (fs.existsSync(ncrFile)) {
    const wb = XLSX.readFile(ncrFile);
    const ncrRows = sheet(wb, /^NCR$/i);
    const ncrNo = s(ncrRows[6]?.[2], 80) || "Safari-Safety NCR-Sharnam-001";
    const ncrDesc = s(ncrRows[9]?.[2], 800);
    const placeholder = /\[e\.g\.|\[detailed|\[detailed explanation/i.test(ncrDesc);
    batch.push({
      projectId,
      recordType: "NCR",
      ncrNumber: ncrNo,
      title: ncrNo,
      activityTask: s(ncrRows[8]?.[2], 200) || null,
      description: placeholder ? "Non-conformity logged from Safety NCR form template." : ncrDesc,
      category: s(ncrRows[10]?.[2], 120) || null,
      severity: /high/i.test(String(ncrRows[11]?.[2] ?? "")) ? "High" : "Medium",
      rootCause: s(ncrRows[15]?.[2], 400) || null,
      contributingFactors: s(ncrRows[16]?.[2], 400) || null,
      immediateAction: s(ncrRows[18]?.[2], 400) || null,
      longTermAction: s(ncrRows[19]?.[2], 400) || null,
      correctiveAction: s(ncrRows[19]?.[2], 400) || s(ncrRows[18]?.[2], 400) || null,
      responsibleParty: s(ncrRows[20]?.[2], 120) || null,
      targetCompletion: excelDate(ncrRows[21]?.[2]),
      timeImpact: s(ncrRows[23]?.[2], 80) || null,
      costImpact: s(ncrRows[24]?.[2], 80) || null,
      followUpDate: excelDate(ncrRows[26]?.[2]),
      status: "Open",
      location: s(ncrRows[1]?.[2], 120) || null,
      reportedById,
      source: "Safety NCR.xlsx",
    });

    batch.push(
      ...parseObservationUnsafeActSheet(sheet(wb, /Observation/i), reportedById, projectId, "Safety NCR.xlsx")
    );
  }

  const dashFile = path.join(excelRoot, "Safety Dashboard.xlsx");
  if (fs.existsSync(dashFile)) {
    const wb = XLSX.readFile(dashFile);
    const ncrSummary = parseSafetyRegisterTable(
      sheet(wb, /NCR Summary/i),
      "NCR",
      "Safety Dashboard.xlsx",
      reportedById,
      projectId
    );
    batch.push(...ncrSummary);

    // Enrich primary NCR form row from first summary entry when template is blank
    if (ncrSummary[0]) {
      const first = ncrSummary[0];
      const formIdx = batch.findIndex((r) => r.source === "Safety NCR.xlsx" && r.recordType === "NCR");
      if (formIdx >= 0) {
        batch[formIdx] = {
          ...batch[formIdx],
          description: String(first.description || batch[formIdx].description),
          location: first.location || batch[formIdx].location,
          category: first.category || batch[formIdx].category,
          activityTask: first.category || batch[formIdx].activityTask,
        };
      }
    }

    batch.push(
      ...parseSafetyRegisterTable(sheet(wb, /Site Instruction/i), "Site Instruction", "Safety Dashboard.xlsx", reportedById, projectId)
    );
    batch.push(
      ...parseSafetyRegisterTable(sheet(wb, /Unsafe Act Summary/i), "Observation", "Safety Dashboard.xlsx", reportedById, projectId)
    );
    batch.push(...parseHiraRegisterTable(sheet(wb, /HIRA/i), reportedById, projectId, "Safety Dashboard.xlsx"));
    batch.push(
      ...parseObservationUnsafeActSheet(sheet(wb, /Observation/i), reportedById, projectId, "Safety Dashboard.xlsx")
    );
  }

  if (batch.length === 0) {
    batch.push(
      {
        projectId,
        recordType: "Toolbox Talk",
        title: "Working at height — balcony guard rails",
        description: "Morning toolbox talk completed.",
        severity: "Medium",
        status: "Closed",
        location: "Block A — Level 2",
        correctiveAction: "Guard rails confirmed",
        reportedById,
        closedAt: new Date(),
        source: "fallback",
      },
      {
        projectId,
        recordType: "Near Miss",
        title: "Loose plank on scaffold access",
        description: "Unstable plank on tower scaffold east face.",
        severity: "High",
        status: "Open",
        location: "Block A — East scaffold",
        reportedById,
        source: "fallback",
      }
    );
  }

  for (const row of batch) {
    try {
      await prisma.safetyRecord.create({ data: row as any });
    } catch (err) {
      console.warn("Safety record seed row skipped:", row.title, err instanceof Error ? err.message : err);
    }
  }
  console.log("Safety records seeded:", batch.length, "from", excelRoot);
}

/** Refresh safety registers from Safety NCR + Safety Dashboard workbooks (all demo projects). */
export async function seedSafetyFromWorkbooksForAllDemoProjects(
  prisma: PrismaClient,
  excelRoot: string,
  projectCodes: string[] = ["SPDC-DEMO-01", "SPDC-PILOT-02"]
) {
  const reporter =
    (await prisma.user.findFirst({ where: { email: "site@sharnam.demo" } })) ||
    (await prisma.user.findFirst({ where: { email: "office@sharnam.demo" } }));
  if (!reporter) {
    console.warn("seedSafetyFromWorkbooksForAllDemoProjects: no site/office user — skip");
    return;
  }

  for (const code of projectCodes) {
    const project = await prisma.project.findUnique({ where: { code } });
    if (!project) {
      console.warn("Safety seed skip — project not found:", code);
      continue;
    }
    await prisma.safetyRecord.deleteMany({ where: { projectId: project.id } });
    await seedSafetyRecordsFromWorkbooks(prisma, project.id, excelRoot, reporter.id);
  }
}

export async function seedQualitySafetyFromSheets(
  prisma: PrismaClient,
  projectId: string,
  excelRoot: string,
  reportedById: string
) {
  // Refresh sheet-backed quality/safety registers (keep live QI forms / user safety edits? — replace seeded sources)
  await prisma.cubeTest.deleteMany({ where: { projectId } });
  await prisma.qualityNcr.deleteMany({ where: { projectId } });
  await prisma.qapActivity.deleteMany({ where: { projectId } });
  await prisma.safetyRecord.deleteMany({ where: { projectId } });

  // --- Quality Dashboard.xlsx (CAR register, Cube Test, QAP Detail) ---
  {
    const file = path.join(excelRoot, "Quality Dashboard.xlsx");
    if (fs.existsSync(file)) {
      const wb = XLSX.readFile(file);
      let carCreated = 0;
      const carRows = sheet(wb, /CAR register/i);
      for (let i = 2; i < carRows.length && carCreated < 40; i++) {
        const row = carRows[i] as unknown[];
        const description = s(row[4], 2000);
        const no = s(row[0], 20);
        if (!description || !/^\d+$/.test(no)) continue;
        const number = `CAR-QD-${no}`;
        const exists = await prisma.qualityNcr.findFirst({ where: { projectId, number } });
        if (exists) continue;
        await prisma.qualityNcr.create({
          data: {
            projectId,
            number,
            issueDate: excelDate(row[1]),
            ncrType: s(row[2], 80) || "Quality",
            contractor: s(row[3], 120) || null,
            description,
            location: s(row[5], 120) || null,
            plannedClosure: excelDate(row[6]),
            actualClosure: excelDate(row[7]),
            status: s(row[8], 40) || "Open",
            source: "Quality Dashboard.xlsx · CAR register",
          },
        });
        carCreated++;
      }
      if (carCreated) console.log("Quality Dashboard CAR rows seeded:", carCreated);

      const cubeRows = sheet(wb, /Cube Test/i);
      let cubeCreated = 0;
      for (let i = 1; i < cubeRows.length && cubeCreated < 20; i++) {
        const row = cubeRows[i] as unknown[];
        const sample = s(row[0], 20);
        const strength = n(row[1]);
        const limit = n(row[2]);
        if (!sample || !/^\d+$/.test(sample) || !strength) continue;
        await prisma.cubeTest.create({
          data: {
            projectId,
            srNo: sample,
            description: `Cube sample #${sample} (7-day)`,
            strength,
            result: strength >= limit ? "Pass" : "Fail",
            source: "Quality Dashboard.xlsx · Cube Test",
          },
        });
        cubeCreated++;
      }
      if (cubeCreated) console.log("Quality Dashboard cube rows seeded:", cubeCreated);

      // QAP Detail sheet skipped — full Week 50 workbook is authoritative
    }
  }

  // --- Quality NCR REGISTER ---
  {
    const file = path.join(excelRoot, "NCR 01 .xlsx");
    if (fs.existsSync(file)) {
      const wb = XLSX.readFile(file);
      const rows = sheet(wb, /NCR REGISTER/i);
      let created = 0;
      for (let i = 4; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const description = s(row[4], 2000);
        const no = s(row[0], 20);
        if (!description || !/^\d+$/.test(no)) continue;
        await prisma.qualityNcr.create({
          data: {
            projectId,
            number: `NCR-${no}`,
            issueDate: excelDate(row[1]),
            ncrType: s(row[2], 80) || "General",
            contractor: s(row[3], 120) || null,
            description,
            location: s(row[5], 120) || null,
            plannedClosure: excelDate(row[6]),
            actualClosure: excelDate(row[7]),
            status: s(row[8], 40) || "Open",
            source: "NCR 01 .xlsx",
          },
        });
        created++;
      }
      console.log("Quality NCRs seeded:", created);
    }
  }

  // --- Monthly CAR register (extra rows if present) ---
  {
    const monthly = fs.existsSync(path.join(excelRoot, "Monthly Progress Dashboard (1).xlsx"))
      ? "Monthly Progress Dashboard (1).xlsx"
      : "Monthly Progress Dashboard.xlsx";
    const file = path.join(excelRoot, monthly);
    if (fs.existsSync(file)) {
      const wb = XLSX.readFile(file);
      const rows = sheet(wb, /CAR register/i);
      let created = 0;
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const description = s(row[4], 2000);
        const no = s(row[0], 20);
        if (!description || !/^\d+$/.test(no)) continue;
        const number = `CAR-${no}`;
        const exists = await prisma.qualityNcr.findFirst({ where: { projectId, number } });
        if (exists) continue;
        await prisma.qualityNcr.create({
          data: {
            projectId,
            number,
            issueDate: excelDate(row[1]),
            ncrType: s(row[2], 80) || "Quality",
            contractor: s(row[3], 120) || null,
            description,
            location: s(row[5], 120) || null,
            plannedClosure: excelDate(row[6]),
            actualClosure: excelDate(row[7]),
            status: s(row[8], 40) || "Open",
            source: monthly,
          },
        });
        created++;
      }
      if (created) console.log("CAR register rows seeded:", created);
    }
  }

  // --- Cube register (SPDC grouped specimens) ---
  {
    const file = path.join(excelRoot, "SPDC CUBE REGISTER (1).xlsx");
    if (fs.existsSync(file)) {
      const { importCubeRegisterWorkbook } = await import("../apps/api/src/services/cubeRegisterImport.ts");
      const out = await importCubeRegisterWorkbook(projectId, fs.readFileSync(file), false);
      console.log("Cube tests seeded:", out.imported, "specimens in", out.groups, "groups");
    }
  }

  // --- QAP from Week 50 (full sheet — all rows + daily checks) ---
  {
    const qapFile = path.join(excelRoot, "Quality Assurance Plan Week 50.xlsx");
    let created = 0;
    if (fs.existsSync(qapFile)) {
      const { importQapWorkbook } = await import("../apps/api/src/services/qapImportExport.ts");
      await prisma.qapActivity.deleteMany({
        where: { projectId, weekLabel: { in: ["W50", "Week 50", "Detail"] } },
      });
      const out = await importQapWorkbook(projectId, fs.readFileSync(qapFile), false);
      created = out.imported;
      console.log("QAP Week 50 seeded:", created, "weekLabel:", out.weekLabel);
    }
    const monthly = path.join(
      excelRoot,
      fs.existsSync(path.join(excelRoot, "Monthly Progress Dashboard (1).xlsx"))
        ? "Monthly Progress Dashboard (1).xlsx"
        : "Monthly Progress Dashboard.xlsx"
    );
    if (fs.existsSync(monthly) && created < 20) {
      const wb = XLSX.readFile(monthly);
      const rows = sheet(wb, /Quality Assurance Plan/i);
      let activity = "";
      for (let i = 9; i < Math.min(rows.length, 80) && created < 60; i++) {
        const row = rows[i] as unknown[];
        const act = s(row[1], 120);
        const detail = s(row[2], 300);
        const remarks = s(row[11], 80);
        if (act) activity = act;
        if (!detail) continue;
        await prisma.qapActivity.create({
          data: {
            projectId,
            weekLabel: "Monthly",
            activity: `${activity} — ${detail}`.slice(0, 400),
            discipline: activity || null,
            contractorOk: true,
            pmcOk: /complete|done|yes/i.test(remarks),
            clientOk: /complete|done/i.test(remarks),
            status: /complete|done/i.test(remarks) ? "Done" : "Open",
            completedAt: /complete|done/i.test(remarks) ? new Date() : null,
          },
        });
        created++;
      }
    }
    console.log("QAP activities seeded:", created);
  }

  await seedSafetyRecordsFromWorkbooks(prisma, projectId, excelRoot, reportedById);

  // --- Payment summary → vendor bills ---
  {
    const file = path.join(excelRoot, "Payment Summary - VIATRIX - Copy.xlsx");
    if (fs.existsSync(file)) {
      const existing = await prisma.vendorBill.count({ where: { projectId } });
      if (existing === 0) {
        const wb = XLSX.readFile(file);
        const rows = sheet(wb, /Summary Civil/i);
        let created = 0;
        for (let i = 7; i < Math.min(rows.length, 20); i++) {
          const row = rows[i] as unknown[];
          const desc = s(row[1], 200);
          const amount = n(row[5]) || n(row[4]) || n(row[3]);
          if (!desc || !amount) continue;
          await prisma.vendorBill.create({
            data: {
              projectId,
              vendorName: "NK Infra",
              billNo: `RA-CIV-${s(row[0], 10) || created + 1}`,
              amount,
              status: "Certified",
              description: desc,
              copNo: "RA-7",
            },
          });
          created++;
        }
        console.log("Vendor bills from Payment Summary:", created);
      }
    }
  }
}

/**
 * Demo checklist fills (today / this week) so DPR/WPR Progress Reports show typed activity.
 * Mapping:
 *  DrawingCheck → Drawing / GFC gate fills
 *  QualityInspection → Quality module + WPR Quality section
 *  Safety → Safety module + WPR Safety section
 *  SiteExecution → DPR daily checklist / site progress
 */
export async function seedChecklistFillsForReports(
  prisma: PrismaClient,
  projectId: string,
  submittedById: string
) {
  const types = ["DrawingCheck", "QualityInspection", "Safety", "SiteExecution"] as const;
  const today = new Date();
  today.setHours(10, 0, 0, 0);

  for (const checklistType of types) {
    const assignment = await prisma.checklistAssignment.findFirst({
      where: { projectId, template: { checklistType } },
      include: { template: true },
    });
    if (!assignment) continue;

    const already = await prisma.checklistSubmission.findFirst({
      where: {
        assignmentId: assignment.id,
        purpose: "Fill",
        remarks: { contains: "seed-report" },
      },
    });
    if (already) {
      await prisma.checklistSubmission.update({
        where: { id: already.id },
        data: { createdAt: today, status: checklistType === "Safety" ? "Submitted" : "Approved" },
      });
      continue;
    }

    await prisma.checklistSubmission.create({
      data: {
        assignmentId: assignment.id,
        submittedById,
        status: checklistType === "Safety" ? "Submitted" : "Approved",
        purpose: "Fill",
        remarks: `seed-report:${checklistType}`,
        responsesJson: JSON.stringify({ note: `Demo ${checklistType} fill for Progress Reports` }),
        createdAt: today,
        reviewedAt: checklistType === "Safety" ? null : today,
      },
    });
  }
  console.log("Checklist fills seeded for Progress Reports (Drawing / QI / Safety / Site)");
}

const DEMO_SOURCE = "demo-week-seed";

function dayAt(d: Date, hour = 9) {
  const x = new Date(d);
  x.setHours(hour, 0, 0, 0);
  return x;
}

async function buildChecklistResponses(prisma: PrismaClient, templateId: string, answers: string[]) {
  const items = await prisma.checklistItem.findMany({
    where: { templateId },
    orderBy: { sortOrder: "asc" },
    take: 40,
  });
  const responses: Record<string, { answer: string; remarks: string }> = {};
  items.forEach((item, i) => {
    responses[item.id] = {
      answer: answers[i % answers.length] || "Yes",
      remarks: item.section ? `${item.section} — verified on site` : "Verified",
    };
  });
  return responses;
}

/**
 * Realistic quality / safety / checklist demo for DPR + WPR auto-fill.
 * Idempotent per project — re-run safe before DPR demo day or pilot week.
 */
export async function seedQualitySafetyDemoForDpr(
  prisma: PrismaClient,
  projectId: string,
  anchorDate: Date,
  reportedById: string,
  opts?: { weekDays?: number; skipIfSheetData?: boolean }
) {
  const days = Math.max(1, Math.min(14, opts?.weekDays ?? 1));
  const weekLabel = `Demo-W${anchorDate.toISOString().slice(5, 7)}`;
  const skipIfSheetData = opts?.skipIfSheetData !== false;

  await prisma.qualityNcr.deleteMany({ where: { projectId, source: DEMO_SOURCE } });
  await prisma.cubeTest.deleteMany({ where: { projectId, source: DEMO_SOURCE } });
  await prisma.qapActivity.deleteMany({ where: { projectId, weekLabel: { startsWith: "Demo-" } } });
  await prisma.safetyRecord.deleteMany({ where: { projectId, title: { startsWith: "Demo ·" } } });
  await prisma.checklistSubmission.deleteMany({
    where: { assignment: { projectId }, remarks: { contains: DEMO_SOURCE } },
  });

  const [sheetNcrCount, sheetQapCount, sheetSafetyCount] = await Promise.all([
    prisma.qualityNcr.count({ where: { projectId, NOT: { source: DEMO_SOURCE } } }),
    prisma.qapActivity.count({ where: { projectId, NOT: { weekLabel: { startsWith: "Demo-" } } } }),
    prisma.safetyRecord.count({ where: { projectId, NOT: { title: { startsWith: "Demo ·" } } } }),
  ]);

  const useSheetNcrs = skipIfSheetData && sheetNcrCount > 0;
  const useSheetQap = skipIfSheetData && sheetQapCount > 0;
  const useSheetSafety = skipIfSheetData && sheetSafetyCount > 5;

  const ncrs = [
    {
      number: "NCR-101",
      ncrType: "Workmanship",
      description: "Honeycomb observed at column C-12 lift 2 — rectification before next pour.",
      location: "Block A — Grid C-12",
      status: "Open",
    },
    {
      number: "NCR-102",
      ncrType: "Material",
      description: "Mill test certificate pending for Fe 500D batch delivered 12-Aug.",
      location: "Site store — rebar yard",
      status: "Open",
    },
    {
      number: "CAR-08",
      ncrType: "Corrective Action",
      description: "CAR for repeated cover block spacing non-compliance on slab SOG-03.",
      location: "SOG-03",
      status: "Open",
    },
    {
      number: "NCR-099",
      ncrType: "Documentation",
      description: "Pour card sign-off missing for raft PCC — closed after resubmission.",
      location: "Raft foundation Zone 1",
      status: "Closed",
      actualClosure: anchorDate,
    },
    {
      number: "CAR-07",
      ncrType: "Corrective Action",
      description: "CAR closed — shuttering oil contamination on soffit cleaned and approved.",
      location: "Level 1 slab",
      status: "Closed",
      actualClosure: anchorDate,
    },
  ];

  if (!useSheetNcrs) {
    for (const n of ncrs) {
      await prisma.qualityNcr.create({
        data: {
          projectId,
          number: n.number,
          issueDate: dayAt(anchorDate, 8),
          ncrType: n.ncrType,
          contractor: "NK Infra",
          description: n.description,
          location: n.location,
          plannedClosure: new Date(anchorDate.getTime() + 7 * 86400000),
          actualClosure: n.actualClosure ? dayAt(n.actualClosure, 17) : null,
          status: n.status,
          source: DEMO_SOURCE,
        },
      });
    }
  }

  for (let d = 0; d < days; d++) {
    const day = new Date(anchorDate);
    day.setDate(anchorDate.getDate() - (days - 1 - d));
    const dayEndSlice = new Date(day);
    dayEndSlice.setDate(day.getDate() + 1);
    dayEndSlice.setHours(0, 0, 0, 0);
    day.setHours(0, 0, 0, 0);

    const cubeOnDay = await prisma.cubeTest.count({
      where: { projectId, castDate: { gte: day, lt: dayEndSlice } },
    });
    if (!cubeOnDay) {
      await prisma.cubeTest.create({
        data: {
          projectId,
          srNo: String(240 + d),
          castDate: dayAt(day, 14),
          description: `M30 raft / column pour — Set ${d + 1}`,
          grade: "M30",
          cubeWeight: 8.1,
          testDate7: new Date(day.getTime() + 7 * 86400000),
          testDate28: new Date(day.getTime() + 28 * 86400000),
          strength: d === days - 1 ? 0 : 28.4,
          result: d === days - 1 ? "Pending" : "Pass",
          source: DEMO_SOURCE,
        },
      });
    }

    if (!useSheetSafety) {
      await prisma.safetyRecord.create({
        data: {
          projectId,
          recordType: "Toolbox Talk",
          title: `Demo · Toolbox — working at height & PPE`,
          description: "Morning toolbox on guard rails, harness anchor points, and housekeeping.",
          severity: "Medium",
          status: "Closed",
          location: "Block A — muster point",
          correctiveAction: "PPE compliance confirmed",
          occurredAt: dayAt(day, 7),
          closedAt: dayAt(day, 8),
          reportedById,
        },
      });
    }
  }

  if (!useSheetSafety) {
    await prisma.safetyRecord.create({
      data: {
        projectId,
        recordType: "Near Miss",
        title: "Demo · Loose plank on scaffold access",
        description: "Unstable plank on east face tower scaffold — barricaded and replaced.",
        severity: "High",
        status: "Open",
        location: "Block A — East scaffold",
        occurredAt: dayAt(anchorDate, 11),
        reportedById,
      },
    });
  }

  const qapRows = [
    { activity: "Reinforcement — cover & spacing check", discipline: "Civil", done: true },
    { activity: "Shuttering — oil & alignment before pour", discipline: "Civil", done: true },
    { activity: "Cube casting & slump — M30 raft", discipline: "Civil", done: false },
    { activity: "DB termination — torque check sample", discipline: "Electrical", done: false },
    { activity: "Fire hydrant line pressure test witness", discipline: "Fire", done: false },
  ];

  if (!useSheetQap) {
    for (const q of qapRows) {
      await prisma.qapActivity.create({
        data: {
          projectId,
          weekLabel,
          activity: q.activity,
          discipline: q.discipline,
          contractorOk: true,
          pmcOk: q.done,
          clientOk: q.done,
          status: q.done ? "Done" : "Open",
          completedAt: q.done ? dayAt(anchorDate, 16) : null,
        },
      });
    }
  }

  const qiAssignment = await prisma.checklistAssignment.findFirst({
    where: { projectId, template: { checklistType: "QualityInspection" } },
    include: { template: true },
  });
  const safetyAssignment = await prisma.checklistAssignment.findFirst({
    where: { projectId, template: { checklistType: "Safety" } },
  });

  if (qiAssignment) {
    const responses = await buildChecklistResponses(prisma, qiAssignment.templateId, [
      "Yes",
      "Yes",
      "NA",
      "Yes",
    ]);
    await prisma.checklistSubmission.create({
      data: {
        assignmentId: qiAssignment.id,
        submittedById: reportedById,
        status: "Approved",
        purpose: "Fill",
        remarks: `${DEMO_SOURCE}:QI pour inspection`,
        responsesJson: JSON.stringify(responses),
        createdAt: dayAt(anchorDate, 10),
        reviewedAt: dayAt(anchorDate, 11),
      },
    });
  }

  if (safetyAssignment) {
    const responses = await buildChecklistResponses(prisma, safetyAssignment.templateId, [
      "Yes",
      "Yes",
      "Yes",
    ]);
    await prisma.checklistSubmission.create({
      data: {
        assignmentId: safetyAssignment.id,
        submittedById: reportedById,
        status: "Submitted",
        purpose: "Fill",
        remarks: `${DEMO_SOURCE}:Safety site walk`,
        responsesJson: JSON.stringify(responses),
        createdAt: dayAt(anchorDate, 9),
      },
    });
  }

  console.log(
    `Quality/Safety demo seeded — NCR ${useSheetNcrs ? `(sheet ${sheetNcrCount})` : ncrs.length} · cubes anchor week · QAP ${useSheetQap ? `(sheet ${sheetQapCount})` : qapRows.length} · checklists ${qiAssignment ? 1 : 0}+${safetyAssignment ? 1 : 0}`
  );
}
