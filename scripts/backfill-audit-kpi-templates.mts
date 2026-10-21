/**
 * Load audit and KPI template rows for projects that are missing them.
 * Does not change scores or typed figures.
 *   npx tsx scripts/backfill-audit-kpi-templates.mts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const { applyDatabaseUrl } = await import("../apps/api/src/resolveDatabaseUrl.ts");
applyDatabaseUrl();
const { prisma } = await import("../apps/api/src/prisma.ts");
const { seedAuditKpiFromSheets } = await import("../apps/api/src/modules/audit-kpi/seedFromSheets.ts");

const projects = await prisma.project.findMany({
  select: { id: true, code: true, _count: { select: { kpiSubjects: true, auditChecklistItems: true } } },
  orderBy: { code: "asc" },
});

for (const project of projects) {
  if (project._count.kpiSubjects > 0 && project._count.auditChecklistItems > 0) {
    const dc = await prisma.auditChecklistItem.count({ where: { projectId: project.id, section: "DcInterview" } });
    if (dc > 0) {
      console.log(`${project.code}: already has subjects and checklist rows`);
      continue;
    }
  }
  const stats = await seedAuditKpiFromSheets(prisma, project.id, { missingOnly: true });
  console.log(
    `${project.code}: added checklist ${stats.checklistAdded}, subjects ${stats.subjectsAdded}, roles ${stats.krasAdded}`
  );
}

await prisma.$disconnect();
