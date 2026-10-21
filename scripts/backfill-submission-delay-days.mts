/**
 * Recompute DrawingRegisterLine.submissionDelayDays for every existing row with the shared rule
 * (packages/shared/src/drawingDelay.ts delayDays, IST calendar days):
 *   planned missing                 -> null
 *   actual present                  -> max(0, actual - planned)
 *   actual missing, today > planned -> today - planned (running)
 *   otherwise                       -> 0
 * Safe to run more than once. Without --apply it only reports what would change.
 *
 * Usage:
 *   npx tsx scripts/backfill-submission-delay-days.mts            (dry run)
 *   npx tsx scripts/backfill-submission-delay-days.mts --apply    (write changes)
 *   add --project <projectId> to limit to one project
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import { delayDays } from "../packages/shared/src/drawingDelay.js";

applyDatabaseUrl();
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const projectIdx = args.indexOf("--project");
const projectId = projectIdx >= 0 ? args[projectIdx + 1] : undefined;

async function main() {
  const today = new Date();
  const rows = await prisma.drawingRegisterLine.findMany({
    where: projectId ? { projectId } : {},
    select: { id: true, projectId: true, drawingNumber: true, plannedSubmissionDate: true, actualSubmissionDate: true, submissionDelayDays: true },
  });
  let changed = 0;
  for (const row of rows) {
    const next = delayDays(row.plannedSubmissionDate, row.actualSubmissionDate, today);
    if (next === row.submissionDelayDays) continue;
    changed += 1;
    if (changed <= 50) console.log(`  ${row.projectId} ${row.drawingNumber}: ${row.submissionDelayDays ?? "null"} -> ${next ?? "null"}`);
    if (apply) {
      await prisma.drawingRegisterLine.update({ where: { id: row.id }, data: { submissionDelayDays: next } });
    }
  }
  if (changed > 50) console.log(`  ... and ${changed - 50} more`);
  console.log(`${rows.length} register lines checked, ${changed} ${apply ? "updated" : "would change (dry run, pass --apply to write)"}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
