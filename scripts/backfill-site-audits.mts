/**
 * Attach checklist rows that have no audit to audit 1, using cuid ids.
 * Keeps an existing "<projectId>-audit-demo" id when that row is already there.
 * Run this before `prisma db push` makes siteAuditId required.
 *   npx tsx scripts/backfill-site-audits.mts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const { applyDatabaseUrl } = await import("../apps/api/src/resolveDatabaseUrl.ts");
applyDatabaseUrl();
const { prisma } = await import("../apps/api/src/prisma.ts");

function cuid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

const orphans = await prisma.$queryRawUnsafe<Array<{ projectId: string; n: bigint | number }>>(
  "SELECT projectId, COUNT(*) AS n FROM AuditChecklistItem WHERE siteAuditId IS NULL GROUP BY projectId"
);

if (!orphans.length) {
  console.log("No checklist rows without an audit.");
} else {
  for (const row of orphans) {
    const projectId = row.projectId;
    const projects = await prisma.$queryRawUnsafe<Array<{ code: string }>>(
      "SELECT code FROM Project WHERE id = ?",
      projectId
    );
    const code = projects[0]?.code || "PROJECT";
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string; auditRef: string | null }>>(
      "SELECT id, auditRef FROM SiteAudit WHERE projectId = ? ORDER BY createdAt ASC LIMIT 1",
      projectId
    );
    let auditId = existing[0]?.id;
    if (!auditId) {
      auditId = `${projectId}-audit-demo`;
      const demo = await prisma.$queryRawUnsafe<Array<{ id: string }>>("SELECT id FROM SiteAudit WHERE id = ?", auditId);
      if (!demo.length) auditId = cuid();
      if (!demo.length) {
        await prisma.$executeRawUnsafe(
          "INSERT INTO SiteAudit (id, projectId, title, auditRef, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))",
          auditId,
          projectId,
          "Site document audit",
          `SA/${code}/01`,
          "In progress"
        );
      }
    } else if (!existing[0]?.auditRef || existing[0].auditRef === "AUD-IMPORT") {
      await prisma.$executeRawUnsafe("UPDATE SiteAudit SET auditRef = ? WHERE id = ? AND (auditRef IS NULL OR auditRef = 'AUD-IMPORT')", `SA/${code}/01`, auditId);
    }
    const updated = await prisma.$executeRawUnsafe(
      "UPDATE AuditChecklistItem SET siteAuditId = ? WHERE projectId = ? AND siteAuditId IS NULL",
      auditId,
      projectId
    );
    await prisma.$executeRawUnsafe(
      "UPDATE AuditFinding SET siteAuditId = ? WHERE projectId = ? AND siteAuditId IS NULL",
      auditId,
      projectId
    );
    console.log(`${code}: attached ${updated} checklist rows to ${auditId} as ${`SA/${code}/01`}`);
  }
}

await prisma.$disconnect();
