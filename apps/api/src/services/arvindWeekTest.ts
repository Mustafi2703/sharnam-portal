/**
 * Structured Arvind week test: audit sheets → onboard both jobs →
 * fills → 7 DPRs → WPR → pack completeness + leftover gaps.
 */
import type { PrismaClient } from "@prisma/client";
import { auditArvindWorkbooks } from "./sheetWorkbookAudit.js";
import { seedArvindSitePack, ARVIND_DORM_CODE, ARVIND_NTX_CODE } from "./arvindSiteSeed.js";
import { verifyPackCompleteness } from "./packCompleteness.js";
import { preferredBudgetFileName, resolveBudgetWorkbookPath } from "./budgetWorkbookImport.js";
import path from "path";

export type WeekTestJobReport = {
  code: string;
  projectId: string;
  week: string;
  budgetExpected: string;
  budgetResolved: string | null;
  budgetOk: boolean;
  dprDays: number;
  dprSnapshots: number;
  wpr: number;
  fills: { qi: number; safety: number; drawing: number; total: number };
  pack: Awaited<ReturnType<typeof verifyPackCompleteness>>;
  ok: boolean;
  errors: string[];
};

async function countFills(db: PrismaClient, projectId: string, start: Date, end: Date) {
  const rows = await db.checklistSubmission.findMany({
    where: {
      status: { in: ["Submitted", "Approved"] },
      createdAt: { gte: start, lte: end },
      assignment: { projectId },
    },
    include: { assignment: { include: { template: { select: { checklistType: true } } } } },
  });
  return {
    qi: rows.filter((r) => r.assignment.template.checklistType === "QualityInspection").length,
    safety: rows.filter((r) => r.assignment.template.checklistType === "Safety").length,
    drawing: rows.filter((r) => r.assignment.template.checklistType === "DrawingCheck").length,
    total: rows.length,
  };
}

async function jobReport(
  db: PrismaClient,
  code: string,
  weekStart: Date,
  weekEnd: Date,
  weekLabel: string
): Promise<WeekTestJobReport> {
  const project = await db.project.findUnique({ where: { code } });
  const errors: string[] = [];
  if (!project) {
    throw new Error(`Project ${code} not found after Arvind site pack`);
  }

  const budgetExpected = preferredBudgetFileName(code);
  const budgetResolved = resolveBudgetWorkbookPath({ projectCode: code });
  const budgetName = budgetResolved ? path.basename(budgetResolved) : null;
  const budgetOk = budgetName === budgetExpected;
  if (!budgetOk) errors.push(`Budget pin failed: expected ${budgetExpected}, got ${budgetName || "none"}`);
  if (code === ARVIND_NTX_CODE && budgetName && /52/.test(budgetName)) {
    errors.push("NTX must not load SPDC_Budget_Arvind 52.xls");
  }

  const snaps = await db.dprSnapshot.findMany({
    where: {
      projectId: project.id,
      status: "Published",
      logDate: { gte: weekStart, lte: weekEnd },
    },
    select: { logDate: true },
  });
  const dprDays = new Set(snaps.map((s) => s.logDate.toISOString().slice(0, 10))).size;
  const wpr = await db.wprSnapshot.count({ where: { projectId: project.id } });
  const fills = await countFills(db, project.id, weekStart, weekEnd);
  const pack = await verifyPackCompleteness(project.id, { logDate: weekStart });

  if (dprDays < 7) errors.push(`Expected 7 DPR days, got ${dprDays}`);
  if (wpr < 1) errors.push("No WPR snapshot");
  if (fills.total < 1) errors.push("No checklist fills in the week window");
  if (!pack.summary.readyForDpr) errors.push("Pack not readyForDpr");
  if (!pack.summary.readyForWpr) errors.push("Pack not readyForWpr");

  return {
    code,
    projectId: project.id,
    week: weekLabel,
    budgetExpected,
    budgetResolved: budgetName,
    budgetOk,
    dprDays,
    dprSnapshots: snaps.length,
    wpr,
    fills,
    pack,
    ok: errors.length === 0,
    errors,
  };
}

export async function runArvindWeekTest(db: PrismaClient) {
  const audit = auditArvindWorkbooks();
  const seed = await seedArvindSitePack(db);

  const ntx = await jobReport(
    db,
    ARVIND_NTX_CODE,
    new Date("2026-09-01T00:00:00"),
    new Date("2026-09-07T23:59:59"),
    "1–7 Sep 2026"
  );
  const dorm = await jobReport(
    db,
    ARVIND_DORM_CODE,
    new Date("2026-07-23T00:00:00"),
    new Date("2026-07-29T23:59:59"),
    "23–29 Jul 2026"
  );

  return {
    audit,
    seed,
    ntx,
    dorm,
    leftovers: audit.leftovers,
    ok: ntx.ok && dorm.ok && audit.counts.parse_fail === 0,
  };
}
