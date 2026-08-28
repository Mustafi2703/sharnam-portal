/**
 * Create SPDC-UAT-LIVE project with daily DPR, weekly WPR, finance COP chain,
 * and upload certified COP workbooks to SharePoint / DMS.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma.js";
import { seedDprDemoDay } from "./dprDemoDaySeed.js";
import { seedWprDemoWeek } from "./wprDemoSeed.js";
import { seedFinanceRaCopDemo } from "./financeRaCopDemoSeed.js";
import { saveViatrixCopToDms } from "../modules/finance/copWorkbook.js";
import { mockOneDrive } from "./mockOneDrive.js";

export const UAT_LIVE_CODE = "SPDC-UAT-LIVE";

function snapWeekEnding(d: Date) {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export async function seedUatLiveProject(db: PrismaClient = prisma, opts?: { uploadCops?: boolean }) {
  const reporter =
    (await db.user.findFirst({ where: { email: "office@sharnam.demo" } })) ||
    (await db.user.findFirst({ where: { role: { in: ["admin", "office"] } } }));
  if (!reporter) throw new Error("No office/admin user — run base seed first");

  const enabledModules = JSON.stringify([
    "drawings", "dms", "quality", "safety", "inspection", "progress",
    "comms", "auditKpi", "cost", "finance", "reports", "closure",
  ]);

  const project = await db.project.upsert({
    where: { code: UAT_LIVE_CODE },
    create: {
      code: UAT_LIVE_CODE,
      name: "SPDC UAT Live Demo — Dormitory & External Works",
      clientName: "SPDC Infrastructure Pvt Ltd",
      location: "Ahmedabad, Gujarat",
      status: "In Progress",
      enabledModules,
      notificationEmails: "nirav@spdc.in,operations@spdc.in,hello@twinoxis.com",
      emailEnabled: true,
      emailFromName: "शरणम् Portal",
    },
    update: { enabledModules, status: "In Progress" },
  });

  await db.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: reporter.id } },
    create: { projectId: project.id, userId: reporter.id, role: "project_manager" },
    update: {},
  });

  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);
  const weekEnd = snapWeekEnding(anchor);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);

  const dprDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const result = await seedDprDemoDay(db, project.id, day, reporter.id);
    dprDays.push(result.logDate);
  }

  const wpr = await seedWprDemoWeek(db, project.id, anchor, reporter.id);
  const finance = await seedFinanceRaCopDemo(db, project.id, reporter.id);

  const copUploads: { copId: string; filename?: string; url?: string; error?: string }[] = [];
  if (opts?.uploadCops !== false) {
    for (const copId of finance.copIds) {
      try {
        const out = await saveViatrixCopToDms(copId, (code, folder, name, buf) =>
          mockOneDrive.upload(code, folder, name, buf)
        );
        copUploads.push({ copId, filename: out.filename, url: out.url ?? undefined });
      } catch (err) {
        copUploads.push({ copId, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return {
    project: { id: project.id, code: project.code, name: project.name },
    dprDays,
    wpr: { weekEnd: wpr.weekEnd.toISOString().slice(0, 10), spdcName: wpr.spdcName },
    finance: { poId: finance.poId, raCount: finance.raCount, cumulative: finance.cumulative, copCount: finance.copIds.length },
    copUploads,
  };
}
