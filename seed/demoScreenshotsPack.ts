/**
 * Seed every workbook-backed module for demo screenshots (both SPDC-DEMO-01 + SPDC-PILOT-02).
 *
 * Usage: npm run db:seed-demo-screenshots
 * Requires base seed (users/projects): npm run db:seed first if DB is empty.
 */
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "../scripts/resolve-database-url.mjs";
import { seedCrmComparative } from "./crmComparativeSeed.ts";
import {
  seedChecklistFillsForReports,
  seedQualitySafetyDemoForDpr,
  seedQualitySafetyFromSheets,
} from "./qualitySafetySheets.ts";
import { seedClosureDrawingsForDemoProjects } from "./closureDrawingsSeed.ts";
import { seedDprDemoDay } from "../apps/api/src/services/dprDemoDaySeed.ts";
import { seedWprDemoWeek, snapWeekEnding } from "../apps/api/src/services/wprDemoSeed.ts";

export const DEMO_PROJECT_CODES = ["SPDC-DEMO-01", "SPDC-PILOT-02"] as const;

const ALL_MODULES = [
  "drawings",
  "dms",
  "quality",
  "safety",
  "progress",
  "comms",
  "field",
  "cost",
  "finance",
  "reports",
  "closure",
];

export async function linkDrawingRegisterToGfc(prisma: PrismaClient, projectId: string) {
  const lines = await prisma.drawingRegisterLine.findMany({ where: { projectId } });
  let linked = 0;
  for (const line of lines) {
    const drawing = await prisma.drawing.findFirst({
      where: { projectId, drawingNumber: line.drawingNumber },
    });
    if (drawing && line.drawingId !== drawing.id) {
      await prisma.drawingRegisterLine.update({
        where: { id: line.id },
        data: { drawingId: drawing.id },
      });
      linked++;
    }
  }
  if (linked) console.log("  Drawing register ↔ GFC links:", linked);
}

export async function seedAllDemoSheetModules(prisma: PrismaClient) {
  const excelRoot = process.env.SHARNAM_EXCEL_ROOT || path.join(process.cwd(), "seed", "data");
  const reporter =
    (await prisma.user.findFirst({ where: { email: "site@sharnam.demo" } })) ||
    (await prisma.user.findFirst({ where: { email: "office@sharnam.demo" } }));
  if (!reporter) {
    throw new Error("Demo users missing — run npm run db:seed first.");
  }

  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);

  console.log("\n==> Drawing register · Snaglist · Lessons · Closure report · GFC links");
  await seedClosureDrawingsForDemoProjects(prisma, reporter.id);

  for (const code of DEMO_PROJECT_CODES) {
    const project = await prisma.project.findUnique({ where: { code } });
    if (!project) {
      console.warn("Skip — project not found:", code);
      continue;
    }

    let modules: string[] = [];
    try {
      modules = JSON.parse(project.enabledModules || "[]");
    } catch {
      modules = [];
    }
    await prisma.project.update({
      where: { id: project.id },
      data: { enabledModules: JSON.stringify([...new Set([...modules, ...ALL_MODULES])]) },
    });

    console.log(`\n==> Quality · Safety · checklists — ${code}`);
    await seedQualitySafetyFromSheets(prisma, project.id, excelRoot, reporter.id);
    await seedChecklistFillsForReports(prisma, project.id, reporter.id);
    await seedQualitySafetyDemoForDpr(prisma, project.id, anchor, reporter.id, { weekDays: 7, skipIfSheetData: true });
    await linkDrawingRegisterToGfc(prisma, project.id);
  }

  const demoProject = await prisma.project.findUnique({ where: { code: "SPDC-DEMO-01" } });
  if (demoProject) {
    const weekEnd = snapWeekEnding(anchor);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    console.log("\n==> Published DPR demo week (7 days) — SPDC-DEMO-01");
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      day.setHours(12, 0, 0, 0);
      const result = await seedDprDemoDay(prisma, demoProject.id, day, reporter.id);
      console.log(`  ✓ ${result.logDate} · ${result.disciplines.length} disciplines`);
    }

    console.log("\n==> Published WPR week (SPDC pack + client workbook) — SPDC-DEMO-01");
    const wpr = await seedWprDemoWeek(prisma, demoProject.id, anchor, reporter.id);
    console.log(`  ✓ Week ending ${wpr.weekEnd.toISOString().slice(0, 10)} · ${wpr.spdcName} · ${wpr.clientName}`);
  }

  console.log("\n==> CRM comparative (R2 workbook)");
  try {
    process.env.SEED_FORCE_CRM_BOQ = "1";
    await seedCrmComparative(prisma);
  } catch (e) {
    console.warn("CRM comparative seed skipped:", e instanceof Error ? e.message : e);
  }

  console.log("\n✓ Demo screenshot pack ready on SPDC-DEMO-01 and SPDC-PILOT-02");
  console.log("  Drawing register · GFC links · Quality · Safety · DPR week · WPR week + client pack");
}

async function main() {
  applyDatabaseUrl();
  if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
    throw new Error("DATABASE_URL not set — configure MYSQL_* in .env or run on Hostinger.");
  }
  const prisma = new PrismaClient();
  try {
    await seedAllDemoSheetModules(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const invoked =
  process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
