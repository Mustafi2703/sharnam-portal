/**
 * Arvind site pack — week dashboards → registers → checklists → DPR → WPR.
 *
 *   SPDC-ARVIND-NTX  Week 3 (01–07 Sep 2026) from module_prompts/*.xlsx
 *   SPDC-ARVIND-01   Dormitory Santej 23–29 Jul 2026 from untitled folder
 */
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { findWorkbook } from "../lib/excelRoot.js";
import XLSX from "../lib/xlsx.js";
import { completeProjectSetup } from "./completeProjectSetup.js";
import { provisionProjectSheetPack } from "./projectSheetPack.js";
import { seedArvindCommsMatrix } from "./commsMatrixSeed.js";
import { ensureMatrixScaffold, syncCommsContactsFromDirectory } from "./syncCommsFromDirectory.js";
import { syncDrawingRegisterToProject, syncDciArvindDrawings } from "./drawingRegisterSheets.js";
import { upsertScurveRegisterPoints } from "./msProjectSchedule.js";
import { seedDprDemoDay } from "./dprDemoDaySeed.js";
import { seedWprSections } from "./wprSeedSections.js";
import { snapWeekEnding } from "./wprDemoSeed.js";
import { buildJulyWprPack } from "./wprJulyWorkbook.js";
import { importWprTrackerPack, importPrInvoiceFromWorkbook } from "./wprTrackerPackImport.js";
import { seedChecklistFillsFromDashboard, checklistFillSummary } from "./qualityChecklistFills.js";

const JULY_SOURCE = "WPR 23–29 July";

export const ARVIND_NTX_CODE = "SPDC-ARVIND-NTX";
export const ARVIND_DORM_CODE = "SPDC-ARVIND-01";

const PARTIES = [
  {
    name: "Arvind Limited",
    partyType: "Client",
    trade: "Client / Owner",
    email: "projects@arvind.demo",
    primaryContactName: "Client PM",
    city: "Santej",
    state: "Gujarat",
  },
  {
    name: "AK Consultant",
    partyType: "Consultant",
    trade: "Project Consultant",
    email: "ak@consultant.demo",
    primaryContactName: "A. Kumar",
    city: "Ahmedabad",
    state: "Gujarat",
  },
  {
    name: "Sharnam Project Development Consultants & Co.",
    partyType: "PMC",
    trade: "PMC",
    email: "office@sharnam.demo",
    primaryContactName: "Office Coordinator",
    city: "Ahmedabad",
    state: "Gujarat",
  },
  {
    name: "Bhavana Infra",
    partyType: "Contractor",
    trade: "Civil contractor",
    email: "site@bhavanainfra.demo",
    primaryContactName: "Site In-charge",
    city: "Santej",
    state: "Gujarat",
  },
] as const;

const ENABLED_MODULES =
  '["drawings","dms","quality","safety","inspection","progress","comms","auditKpi","cost","finance","reports","closure"]';

function excelSerialDate(v: unknown): Date | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 30000) return null;
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
}

async function upsertVendor(db: PrismaClient, def: (typeof PARTIES)[number]) {
  const existing = await db.vendor.findFirst({ where: { name: def.name } });
  if (existing) {
    return db.vendor.update({
      where: { id: existing.id },
      data: {
        partyType: def.partyType,
        trade: def.trade,
        email: def.email,
        primaryContactName: def.primaryContactName,
      },
    });
  }
  return db.vendor.create({
    data: { ...def, country: "India", createdVia: "Arvind site pack" },
  });
}

async function assignPeople(db: PrismaClient, projectId: string, userIds: string[]) {
  for (const userId of userIds) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) continue;
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, role: user.role === "admin" ? "office" : user.role },
      update: {},
    });
  }
}

async function importCashflowScurve(projectId: string) {
  const file = findWorkbook(["Cashflow - Dashboard (3).xlsx", "Cashflow - Dashboard.xlsx"]);
  if (!file) return 0;
  const wb = XLSX.readFile(file);
  const name = wb.SheetNames.find((n) => /cash flow chart/i.test(n));
  if (!name) return 0;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][];
  const months = (rows[1] || []).slice(1).filter((c) => c !== "" && c !== "Total");
  const plannedCum = (rows[3] || []).slice(1);
  const actual = (rows[4] || []).slice(1);
  const points = [];
  let a = 0;
  const pTot = Number(plannedCum[months.length - 1]) || 0;
  for (let i = 0; i < months.length; i++) {
    const d = excelSerialDate(months[i]);
    if (!d) continue;
    a += Number(actual[i]) || 0;
    const planned = Number(plannedCum[i]) || 0;
    points.push({
      periodLabel: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      date: d.toISOString().slice(0, 10),
      plannedPct: pTot ? Math.round((planned / pTot) * 1000) / 10 : 0,
      actualPct: pTot ? Math.round((a / pTot) * 1000) / 10 : 0,
    });
  }
  if (!points.length) return 0;
  await upsertScurveRegisterPoints(projectId, points, "Cashflow Dashboard", "OVERALL");
  return points.length;
}

async function seedWeekDprs(
  db: PrismaClient,
  projectId: string,
  userId: string,
  weekStart: Date,
  days: number
) {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    day.setHours(12, 0, 0, 0);
    const out = await seedDprDemoDay(db, projectId, day, userId);
    dates.push(out.logDate);
  }
  return dates;
}

async function saveWprSnapshot(
  db: PrismaClient,
  projectId: string,
  userId: string,
  weekEndRaw: Date,
  sections: Record<string, unknown>,
  reportNumber?: number
) {
  const weekEnd = snapWeekEnding(weekEndRaw);
  return db.wprSnapshot.upsert({
    where: { projectId_weekEnding: { projectId, weekEnding: weekEnd } },
    create: {
      projectId,
      weekEnding: weekEnd,
      reportNumber: reportNumber ?? null,
      sectionsJson: JSON.stringify(sections),
      status: "Draft",
      createdById: userId,
    },
    update: {
      reportNumber: reportNumber ?? undefined,
      sectionsJson: JSON.stringify(sections),
      status: "Draft",
    },
  });
}

export async function seedArvindSitePack(db: PrismaClient) {
  const office =
    (await db.user.findFirst({ where: { email: "office@sharnam.demo" } })) ||
    (await db.user.findFirst({ where: { role: { in: ["admin", "office"] } } }));
  if (!office) throw new Error("No office/admin user — run npm run db:seed first");

  const extras = await db.user.findMany({
    where: {
      email: {
        in: [
          "admin@sharnam.demo",
          "office@sharnam.demo",
          "site@sharnam.demo",
          "client@sharnam.demo",
          "employee@sharnam.demo",
          "vendor@sharnam.demo",
        ],
      },
    },
  });
  const userIds = [...new Set([office.id, ...extras.map((u) => u.id)])];

  const vendors = [];
  for (const def of PARTIES) vendors.push(await upsertVendor(db, def));

  const ntx = await db.project.upsert({
    where: { code: ARVIND_NTX_CODE },
    create: {
      code: ARVIND_NTX_CODE,
      name: "Construction of New NTX Building — Arvind Limited",
      clientName: "Arvind Limited",
      clientContactName: "Client PM",
      clientEmail: "projects@arvind.demo",
      location: "Santej, Gujarat",
      clientAddress: "Santej, Gujarat",
      designConsultant: "AK Consultant",
      contractorName: "Bhavana Infra",
      pmcName: "Sharnam Project Development Consultants & Co.",
      status: "In Progress",
      startDate: new Date("2026-08-01T00:00:00"),
      enabledModules: ENABLED_MODULES,
      notificationEmails: "office@sharnam.demo,projects@arvind.demo",
      emailEnabled: true,
      emailFromName: "शरणम् Portal",
    },
    update: {
      name: "Construction of New NTX Building — Arvind Limited",
      clientName: "Arvind Limited",
      location: "Santej, Gujarat",
      designConsultant: "AK Consultant",
      contractorName: "Bhavana Infra",
      status: "In Progress",
      enabledModules: ENABLED_MODULES,
    },
  });

  const dorm = await db.project.upsert({
    where: { code: ARVIND_DORM_CODE },
    create: {
      code: ARVIND_DORM_CODE,
      name: "Construction of Worker Dormitory — Arvind Limited, Santej",
      clientName: "Arvind Limited",
      clientContactName: "Client PM",
      clientEmail: "projects@arvind.demo",
      location: "Santej, Gujarat",
      clientAddress: "Santej, Gujarat",
      designConsultant: "AK Consultant",
      contractorName: "Bhavana Infra",
      pmcName: "Sharnam Project Development Consultants & Co.",
      status: "In Progress",
      enabledModules: ENABLED_MODULES,
      notificationEmails: "office@sharnam.demo,projects@arvind.demo",
      emailEnabled: true,
    },
    update: {
      name: "Construction of Worker Dormitory — Arvind Limited, Santej",
      clientName: "Arvind Limited",
      contractorName: "Bhavana Infra",
      designConsultant: "AK Consultant",
      status: "In Progress",
    },
  });

  for (const project of [ntx, dorm]) {
    for (const v of vendors) {
      await db.projectVendor.upsert({
        where: { projectId_vendorId: { projectId: project.id, vendorId: v.id } },
        create: { projectId: project.id, vendorId: v.id, tradeRole: v.trade, assignedVia: "Arvind site pack" },
        update: { tradeRole: v.trade },
      });
    }
    await assignPeople(db, project.id, userIds);
    await seedArvindCommsMatrix(project.id);
    await ensureMatrixScaffold(project.id);
    await syncCommsContactsFromDirectory(project.id);
  }

  const ntxSetup = await completeProjectSetup(ntx.id, office.id);
  await provisionProjectSheetPack(ntx.id, office.id, { force: true });
  const ntxDrawings = await syncDrawingRegisterToProject(ntx.id, office.id);
  const ntxScurve = await importCashflowScurve(ntx.id);

  try {
    const { syncQualityChecklistCatalog } = await import("./qualityChecklistCatalog.js");
    await syncQualityChecklistCatalog(ntx.id);
  } catch (err) {
    console.warn("NTX quality catalog:", err instanceof Error ? err.message : err);
  }
  const ntxWeekStart = new Date("2026-09-01T00:00:00");
  const ntxDprs = await seedWeekDprs(db, ntx.id, office.id, ntxWeekStart, 7);
  const ntxWeekEnd = new Date("2026-09-07T12:00:00");
  const ntxSections = await seedWprSections(db, ntx.id, ntxWeekStart, ntxWeekEnd);
  await saveWprSnapshot(db, ntx.id, office.id, ntxWeekEnd, ntxSections, 3);

  const dormSetup = await completeProjectSetup(dorm.id, office.id);
  let dormTrackers = null as Awaited<ReturnType<typeof importWprTrackerPack>> | null;
  try {
    dormTrackers = await importWprTrackerPack(db, dorm.id);
    const pr = await importPrInvoiceFromWorkbook(db, dorm.id);
    console.log("Dormitory July trackers", dormTrackers, pr);
  } catch (err) {
    console.warn("Dormitory tracker import:", err instanceof Error ? err.message : err);
  }
  try {
    const { syncBudgetWorkbookTemplate } = await import("./budgetWorkbookImport.js");
    await syncBudgetWorkbookTemplate(dorm.id);
  } catch (err) {
    console.warn("Dormitory budget 52:", err instanceof Error ? err.message : err);
  }

  const dormDrawings = await syncDciArvindDrawings(dorm.id, office.id);
  const dormWeekStart = new Date("2026-07-23T00:00:00");
  const published = await db.drawing.findFirst({
    where: { projectId: dorm.id, isPublished: true },
    include: { revisions: { where: { published: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });

  let dormCatalog = { catalog: 0, assigned: 0 };
  try {
    const { syncQualityChecklistCatalog } = await import("./qualityChecklistCatalog.js");
    dormCatalog = await syncQualityChecklistCatalog(dorm.id);
  } catch (err) {
    console.warn("Dormitory checklists:", err instanceof Error ? err.message : err);
  }

  let dormQap = 0;
  try {
    const qapFile = findWorkbook(["Quality Assurance Plan Week 50.xlsx"]);
    if (qapFile) {
      const { importQapWorkbook } = await import("./qapImportExport.js");
      const out = await importQapWorkbook(dorm.id, fs.readFileSync(qapFile), true);
      dormQap = out.imported;
    }
  } catch (err) {
    console.warn("Dormitory QAP:", err instanceof Error ? err.message : err);
  }

  const dormQuality = await seedJulyQualityRegisters(db, dorm.id, dormWeekStart);
  const dormHse = await seedJulyHseRegisters(db, dorm.id, office.id, dormWeekStart);

  const dormFills = await seedChecklistFillsFromDashboard(db, dorm.id, office.id, dormWeekStart, {
    drawingId: published?.id,
    revisionId: published?.revisions[0]?.id,
    revisionNumber: published?.revisions[0]?.revisionNumber,
  });

  const ntxPublished = await db.drawing.findFirst({
    where: { projectId: ntx.id, isPublished: true },
    include: { revisions: { where: { published: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const ntxFills = await seedChecklistFillsFromDashboard(db, ntx.id, office.id, ntxWeekStart, {
    drawingId: ntxPublished?.id,
    revisionId: ntxPublished?.revisions[0]?.id,
    revisionNumber: ntxPublished?.revisions[0]?.revisionNumber,
  });

  const dormDprs = await seedWeekDprs(db, dorm.id, office.id, dormWeekStart, 7);
  try {
    const pack = buildJulyWprPack();
    await saveWprSnapshot(db, dorm.id, office.id, new Date("2026-07-29T12:00:00"), pack.sections, 52);
  } catch (err) {
    console.warn("July WPR pack:", err instanceof Error ? err.message : err);
    const secs = await seedWprSections(db, dorm.id, dormWeekStart, new Date("2026-07-29T12:00:00"));
    await saveWprSnapshot(db, dorm.id, office.id, new Date("2026-07-29T12:00:00"), secs, 52);
  }

  const mpp = findWorkbook([
    "As per Bhavana Infra - Final Construction Work of Dormitory for Workers ,  Arvind Limited.mpp",
  ]);

  return {
    checklistCatalog: checklistFillSummary(),
    ntx: {
      id: ntx.id,
      code: ntx.code,
      setup: { folders: ntxSetup.folders.count, comms: ntxSetup.comms },
      drawings: ntxDrawings,
      scurvePoints: ntxScurve,
      checklists: ntxFills,
      dprDays: ntxDprs,
    },
    dormitory: {
      id: dorm.id,
      code: dorm.code,
      setup: { folders: dormSetup.folders.count, comms: dormSetup.comms },
      drawings: dormDrawings,
      catalog: dormCatalog,
      qap: dormQap,
      trackers: dormTrackers,
      quality: dormQuality,
      hse: dormHse,
      checklists: dormFills,
      dprDays: dormDprs,
      wpr: { week: "23–29 Jul 2026", reportNumber: 52 },
    },
    mpp: mpp ? path.basename(mpp) : null,
    note: mpp
      ? "MPP is on file — convert to MS Project XML later to replace the cashflow S-curve."
      : "S-curve currently from Cashflow Dashboard planned vs actual.",
  };
}

async function seedJulyQualityRegisters(
  db: PrismaClient,
  projectId: string,
  weekStart: Date
) {
  await db.qualityNcr.deleteMany({ where: { projectId, source: JULY_SOURCE } });
  await db.qualitySiteRecord.deleteMany({ where: { projectId, source: JULY_SOURCE } });

  const ncrTexts = [
    "Honeycomb at staircase wall — patched and accepted.",
    "Cover-block spacing on GF slab — rectified before pour.",
    "Cube mould oil contamination — batch recast and passed.",
    "Pour-card sign missing on lift-2 column — closed after resubmission.",
  ];
  for (let i = 0; i < ncrTexts.length; i++) {
    const closed = new Date(weekStart);
    closed.setDate(weekStart.getDate() + i);
    closed.setHours(16, 0, 0, 0);
    await db.qualityNcr.create({
      data: {
        projectId,
        number: `NCR-JUL-0${i + 1}`,
        issueDate: new Date(weekStart.getTime() - (14 - i) * 86400000),
        ncrType: "Workmanship",
        contractor: "Bhavana Infra",
        description: ncrTexts[i],
        location: "Worker dormitory — Santej",
        plannedClosure: closed,
        actualClosure: closed,
        status: "Closed",
        source: JULY_SOURCE,
      },
    });
  }

  const sor = await db.progressSorStat.findMany({ where: { projectId } });
  return {
    sor: sor.map((s) => ({
      observation: s.observation,
      total: s.total,
      open: s.openCount,
      closed: s.closedCount,
    })),
    ncrs: ncrTexts.length,
    cubes: await db.cubeTest.count({ where: { projectId } }),
  };
}

async function seedJulyHseRegisters(
  db: PrismaClient,
  projectId: string,
  reportedById: string,
  weekStart: Date
) {
  await db.safetyRecord.deleteMany({ where: { projectId, source: JULY_SOURCE } });

  const prior = (offset: number) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() - 1 - (offset % 40));
    d.setHours(8, 0, 0, 0);
    return d;
  };

  const specs: Array<{ type: string; title: string; count: number; status?: string; severity?: string }> = [
    { type: "Toolbox Talk", title: "Toolbox talk — height / PPE / housekeeping", count: 64 },
    { type: "HSE induction", title: "HSE induction — new workmen", count: 17 },
    { type: "HSE training", title: "HSE training — scaffold / electrical", count: 4 },
    { type: "Near Miss", title: "Near miss — access plank / vehicle", count: 2, status: "Closed", severity: "High" },
    { type: "NCN", title: "NCN raised — site HSE", count: 4, status: "Closed" },
    { type: "Unsafe act", title: "Unsafe act — closed", count: 23, status: "Closed" },
    { type: "Unsafe condition", title: "Unsafe condition — closed", count: 17, status: "Closed" },
  ];

  let created = 0;
  for (const spec of specs) {
    const rows = Array.from({ length: spec.count }, (_, i) => ({
      projectId,
      recordType: spec.type,
      title: `${spec.title} #${i + 1}`,
      description: `July WPR HSE register — ${spec.type} (PW cumulative).`,
      severity: spec.severity || "Medium",
      status: spec.status || "Closed",
      location: "Worker dormitory — Santej",
      occurredAt: prior(i),
      closedAt: prior(i),
      reportedById,
      source: JULY_SOURCE,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const out = await db.safetyRecord.createMany({ data: chunk });
      created += out.count;
    }
  }

  return {
    records: created,
    indicators: {
      toolboxTalk: 64,
      induction: 17,
      trainings: 4,
      nearMiss: 2,
      ncn: 4,
      unsafeAct: 23,
      unsafeCondition: 17,
      safeManhours: 255848,
    },
  };
}
