/**
 * Seed one published DPR day for SPDC-DEMO-01 — all 7 disciplines.
 *
 * Usage:
 *   npm run db:seed-dpr-demo
 *   DPR_DEMO_DATE=2026-08-14 npm run db:seed-dpr-demo
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDprDemoDay } from "../apps/api/src/services/dprDemoDaySeed.ts";

const prisma = new PrismaClient();

function parseDemoDate(): Date {
  const raw = process.env.DPR_DEMO_DATE || "2026-08-14";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid DPR_DEMO_DATE: ${raw}`);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const logDate = parseDemoDate();
  const project = await prisma.project.findUnique({ where: { code: "SPDC-DEMO-01" } });
  if (!project) {
    console.error("Project SPDC-DEMO-01 not found — run npm run db:seed first.");
    process.exit(1);
  }
  const officeUser = await prisma.user.findFirst({ where: { email: "office@sharnam.demo" } });
  if (!officeUser) {
    console.error("User office@sharnam.demo not found — run npm run db:seed first.");
    process.exit(1);
  }

  console.log(`\nSeeding DPR demo day: ${logDate.toISOString().slice(0, 10)} · project ${project.code}\n`);

  await seedQualitySafetyDemoForDpr(prisma, project.id, logDate, officeUser.id, { weekDays: 7 });

  const result = await seedDprDemoDay(prisma, project.id, logDate, officeUser.id);

  for (const row of result.disciplines) {
    console.log(
      `  ✓ ${row.discipline.padEnd(14)} · ${row.lineCount} lines · qty ${row.qtyToday.toFixed(1)} · ${row.signatures} signatures`
    );
    console.log(`    XLSX: ${row.publishedPath}`);
    console.log(`    PDF:  ${row.htmlPath} (Print → Save as PDF)`);
    console.log(`    sources: ${row.sources.join(", ") || "(activity fallback)"}`);
  }

  console.log(`\nDone. Open DPR Maker → ${result.logDate} → any discipline → Download XLSX / PDF.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
