/**
 * Full client demo pack — runs after base `seed/seed.ts` (needs SPDC-DEMO-01).
 *
 *   npm run db:seed-full-demo
 *
 * Also invoked automatically from seed.ts when RUN_SEED=1 / deploy seed runs.
 */
import type { PrismaClient } from "@prisma/client";
import { seedDprDemoDay } from "../apps/api/src/services/dprDemoDaySeed.ts";
import { seedQualitySafetyDemoForDpr } from "./qualitySafetySheets.ts";
import { seedPilotWeekDemo } from "./pilotWeekDemo.ts";

export type FullDemoPackOpts = {
  /** ISO date for SPDC-DEMO-01 DPR day (default 2026-08-14) */
  dprDemoDate?: string;
  /** Week ending for SPDC-PILOT-02 (default 2026-08-16) */
  pilotWeekEnd?: string;
  /** Skip second pilot project (faster local seed) */
  skipPilot?: boolean;
  /** Skip single DPR day on SPDC-DEMO-01 (demo screenshot pack seeds the full week) */
  skipDemoDay?: boolean;
};

function parseDemoDate(raw: string): Date {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid DPR_DEMO_DATE: ${raw}`);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Quality/safety fills + published DPR day on SPDC-DEMO-01 */
export async function seedDemoDayPack(
  prisma: PrismaClient,
  opts: Pick<FullDemoPackOpts, "dprDemoDate"> = {}
) {
  const logDate = parseDemoDate(opts.dprDemoDate || process.env.DPR_DEMO_DATE || "2026-08-14");
  const project = await prisma.project.findUnique({ where: { code: "SPDC-DEMO-01" } });
  if (!project) {
    console.warn("seedDemoDayPack: SPDC-DEMO-01 not found — skip");
    return;
  }
  const officeUser = await prisma.user.findFirst({ where: { email: "office@sharnam.demo" } });
  if (!officeUser) {
    console.warn("seedDemoDayPack: office@sharnam.demo not found — skip");
    return;
  }

  console.log(`\n==> Demo pack: quality/safety + DPR day (${logDate.toISOString().slice(0, 10)}) on ${project.code}`);

  await seedQualitySafetyDemoForDpr(prisma, project.id, logDate, officeUser.id, { weekDays: 7 });

  const result = await seedDprDemoDay(prisma, project.id, logDate, officeUser.id);
  for (const row of result.disciplines) {
    console.log(`  ✓ DPR ${row.discipline.padEnd(14)} · ${row.lineCount} lines · qty ${row.qtyToday.toFixed(1)}`);
  }
}

/** Everything needed for client walkthrough after base seed */
export async function seedFullDemoPack(prisma: PrismaClient, opts: FullDemoPackOpts = {}) {
  if (opts.skipDemoDay) {
    console.log("==> Skipping SPDC-DEMO-01 single DPR day (demo screenshot pack seeds full week + WPR)");
  } else {
    await seedDemoDayPack(prisma, opts);
  }

  if (opts.skipPilot || process.env.SKIP_PILOT_SEED === "1") {
    console.log("==> Skipping SPDC-PILOT-02 (SKIP_PILOT_SEED=1)");
    return;
  }

  console.log("\n==> Demo pack: pilot week project SPDC-PILOT-02");
  await seedPilotWeekDemo(prisma, { weekEnd: opts.pilotWeekEnd || process.env.PILOT_WEEK_END });
}
