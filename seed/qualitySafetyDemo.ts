/**
 * Seed realistic quality / safety / checklist demo for DPR + WPR.
 *
 *   npm run db:seed-quality-safety-demo
 *   DPR_DEMO_DATE=2026-08-14 npm run db:seed-quality-safety-demo
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedQualitySafetyDemoForDpr } from "./qualitySafetySheets.ts";

const prisma = new PrismaClient();

async function main() {
  const raw = process.env.DPR_DEMO_DATE || "2026-08-14";
  const logDate = new Date(raw);
  if (Number.isNaN(logDate.getTime())) throw new Error(`Invalid DPR_DEMO_DATE: ${raw}`);
  logDate.setHours(0, 0, 0, 0);

  const project = await prisma.project.findUnique({ where: { code: "SPDC-DEMO-01" } });
  if (!project) {
    console.error("Run npm run db:seed first (needs SPDC-DEMO-01).");
    process.exit(1);
  }
  const user = await prisma.user.findFirst({ where: { email: "office@sharnam.demo" } });
  if (!user) {
    console.error("User office@sharnam.demo not found.");
    process.exit(1);
  }

  await seedQualitySafetyDemoForDpr(prisma, project.id, logDate, user.id, { weekDays: 7 });
  console.log(`\nDone. Open DPR Maker → ${raw} → CIVIL — quality + HSE blocks should show NCR, cubes, checklists.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
