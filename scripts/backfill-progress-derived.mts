/**
 * Recompute milestone, risk, hindrance and legal derived fields.
 * Prints rows whose stored status would change. Dry run unless --apply.
 *
 *   npx tsx scripts/backfill-progress-derived.mts
 *   npx tsx scripts/backfill-progress-derived.mts --apply
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import {
  calendarSpanDays,
  defaultProbabilityPct,
  deriveMilestone,
  hindranceStatus,
  legalDelayDays,
  legalStatus,
  riskRating,
  riskSeverity,
  usableProjectDate,
} from "../packages/shared/src/progressDerive.ts";

applyDatabaseUrl();
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, code: true, startDate: true, workdaysPerWeek: true } });
  for (const project of projects) {
    const milestones = await prisma.progressMilestone.findMany({ where: { projectId: project.id } });
    const changed: string[] = [];
    for (const row of milestones) {
      const derived = deriveMilestone({
        plannedStart: row.plannedStart,
        plannedEnd: row.plannedEnd,
        actualStart: row.actualStart,
        actualEnd: row.actualEnd,
        pctComplete: row.pctComplete,
        daysPerWeek: project.workdaysPerWeek || 6,
        projectStart: project.startDate,
      });
      const badStart = row.actualStart && !usableProjectDate(row.actualStart);
      if (row.status !== derived.status || badStart) {
        changed.push(`${row.code || row.id} stored ${row.status} derived ${derived.status}${badStart ? " (actual start before 1990)" : ""}`);
      }
      if (!apply) continue;
      await prisma.progressMilestone.update({
        where: { id: row.id },
        data: {
          ...derived,
          actualStart: badStart ? null : row.actualStart,
        },
      });
    }
    const risks = await prisma.progressRisk.findMany({ where: { projectId: project.id } });
    for (const row of risks) {
      const severity = riskSeverity(row.probability, row.consequence);
      const rating = riskRating(severity);
      if (row.severity !== severity) changed.push(`risk ${row.name} severity ${row.severity} -> ${severity} ${rating}`);
      if (!apply) continue;
      await prisma.progressRisk.update({
        where: { id: row.id },
        data: {
          severity,
          rating,
          probabilityPct: row.probabilityPct > 0 ? row.probabilityPct : defaultProbabilityPct(row.probability),
        },
      });
    }
    const hindrances = await prisma.progressHindrance.findMany({ where: { projectId: project.id } });
    for (const row of hindrances) {
      const status = hindranceStatus(row.resolvedAt);
      const days = calendarSpanDays(row.occurredAt, row.resolvedAt);
      if (row.status !== status || Math.round(row.daysImpacted) !== days) {
        changed.push(`hindrance ${row.id} ${row.status}/${row.daysImpacted} -> ${status}/${days}`);
      }
      if (!apply) continue;
      await prisma.progressHindrance.update({ where: { id: row.id }, data: { status, daysImpacted: days } });
    }
    const legal = await prisma.progressLegalApproval.findMany({ where: { projectId: project.id } });
    for (const row of legal) {
      const status = legalStatus(row.receivedDate, row.status);
      const delayDays = legalDelayDays(row.requiredBy, row.receivedDate);
      if (row.status !== status || Math.round(row.delayDays) !== delayDays) {
        changed.push(`legal ${row.approvalId} ${row.status}/${row.delayDays} -> ${status}/${delayDays}`);
      }
      if (!apply) continue;
      await prisma.progressLegalApproval.update({ where: { id: row.id }, data: { status, delayDays } });
    }
    console.log(`${project.code}: ${changed.length} rows ${apply ? "updated" : "would change"}`);
    for (const line of changed.slice(0, 30)) console.log("  " + line);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
