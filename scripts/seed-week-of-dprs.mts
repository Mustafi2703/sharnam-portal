/**
 * Seed a full week of published DPRs (all disciplines) + one WPR snapshot for
 * any existing project — designed for demos, UAT walk-throughs, and Bugbot
 * regression runs where you need "yesterday", "day-before", etc. to already
 * be populated.
 *
 * Usage:
 *   npx tsx scripts/seed-week-of-dprs.mts                    # SPDC-DEMO-01, week ending today
 *   npx tsx scripts/seed-week-of-dprs.mts --code SPDC-004    # target another project
 *   npx tsx scripts/seed-week-of-dprs.mts --end 2026-08-16   # explicit week-ending date
 *   npx tsx scripts/seed-week-of-dprs.mts --code SPDC-004 --end 2026-08-16 --user office@sharnam.demo
 *
 * Idempotent per (project × logDate × discipline) — re-runs update in place.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDprDemoDay } from "../apps/api/src/services/dprDemoDaySeed.ts";
import { seedQualitySafetyDemoForDpr } from "../seed/qualitySafetySheets.ts";
import { buildWprWorkbook, type WprHeader, type WprSections } from "../apps/api/src/services/wprXlsx.ts";
import fs from "node:fs";
import path from "node:path";

type Args = {
  projectCode: string;
  weekEnd: Date;
  userEmail: string;
};

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const flag = (name: string) => {
    const i = raw.indexOf(`--${name}`);
    return i >= 0 && raw[i + 1] ? String(raw[i + 1]) : undefined;
  };

  const projectCode = flag("code") || process.env.SEED_PROJECT_CODE || "SPDC-DEMO-01";
  const rawEnd = flag("end") || process.env.SEED_WEEK_END;
  const userEmail = flag("user") || process.env.SEED_USER_EMAIL || "office@sharnam.demo";

  const weekEnd = rawEnd ? new Date(rawEnd) : new Date();
  if (Number.isNaN(weekEnd.getTime())) {
    throw new Error(`Invalid --end date: ${rawEnd}`);
  }
  weekEnd.setHours(23, 59, 59, 999);
  return { projectCode, weekEnd, userEmail };
}

async function main() {
  const { projectCode, weekEnd, userEmail } = parseArgs();
  const prisma = new PrismaClient();

  try {
    const project = await prisma.project.findUnique({ where: { code: projectCode } });
    if (!project) {
      console.error(`\n✗ Project '${projectCode}' not found. Create it first (Modules → Projects → New) or run npm run db:seed.\n`);
      process.exit(1);
    }

    const user = await prisma.user.findFirst({ where: { email: userEmail } });
    if (!user) {
      console.error(`\n✗ User '${userEmail}' not found. Pass --user someone@example.com or run npm run db:seed.\n`);
      process.exit(1);
    }

    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    console.log(`\n=== Seeding week for ${project.code} ===`);
    console.log(`  Range     : ${weekStartStr} → ${weekEndStr}`);
    console.log(`  Author    : ${user.email}\n`);

    // Quality / safety underpinnings so DPRs cite real inspections and NCRs.
    await seedQualitySafetyDemoForDpr(prisma, project.id, weekEnd, user.id, { weekDays: 7 });

    // Seven published DPRs, one per day, all disciplines.
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      day.setHours(0, 0, 0, 0);

      const result = await seedDprDemoDay(prisma, project.id, day, user.id);
      const dayStr = day.toISOString().slice(0, 10);
      console.log(
        `  ✓ DPR ${dayStr} · ${result.disciplines.length} disciplines · ` +
          `${result.disciplines.reduce((sum, d) => sum + d.lineCount, 0)} lines`
      );
    }

    // One WPR snapshot for the week — status Published so it appears in the register.
    // Sections are copied from the newest existing WPR on this project (if any)
    // so the demo shows the same layout the client already reviewed; otherwise
    // an empty scaffold is written and the WPR maker can be opened to fill in.
    const lastWpr = await prisma.wprSnapshot.findFirst({
      where: { projectId: project.id },
      orderBy: { weekEnding: "desc" },
    });
    const sections: WprSections = lastWpr ? JSON.parse(lastWpr.sectionsJson || "{}") : ({} as WprSections);

    const nextReportNumber = ((lastWpr?.reportNumber ?? 0) as number) + 1 || 1;

    await prisma.wprSnapshot.upsert({
      where: { projectId_weekEnding: { projectId: project.id, weekEnding: weekEnd } },
      create: {
        projectId: project.id,
        weekEnding: weekEnd,
        reportNumber: nextReportNumber,
        sectionsJson: JSON.stringify(sections),
        status: "Published",
        publishedAt: new Date(),
        createdById: user.id,
      },
      update: {
        sectionsJson: JSON.stringify(sections),
        status: "Published",
        publishedAt: new Date(),
      },
    });
    console.log(`  ✓ WPR ${weekEndStr} · report #${nextReportNumber} · Published`);

    // Sharnam-branded WPR XLSX on disk under the project OneDrive folder so the
    // client can open the file directly (matches production distribution path).
    const header: WprHeader = {
      projectName: project.name,
      projectCode: project.code,
      reportNumber: nextReportNumber,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      clientName: project.clientName || "",
      designConsultant: project.designConsultant || "",
      contractorName: project.contractorName || "",
      location: project.location || "",
      pmc: "Sharnam Project Development Consultants & Co.",
    };
    const wprFolder = path.join(
      process.cwd(),
      "uploads",
      "onedrive",
      project.code,
      "07_EXECUTION_AND_DELIVERY",
      "07.08_Progress_Measurement_SCurve",
      "WPR"
    );
    fs.mkdirSync(wprFolder, { recursive: true });
    const xlsxPath = path.join(wprFolder, `WPR-${project.code}-${weekEndStr}.xlsx`);
    fs.writeFileSync(xlsxPath, await buildWprWorkbook({ header, sections }));
    console.log(`  ✓ WPR .xlsx → ${xlsxPath}`);

    console.log(`\n✓ Week seeded. Open Progress → DPR Maker (any day) or Progress → WPR Maker to review.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
