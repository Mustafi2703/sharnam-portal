/**
 * Set ChecklistTemplate.discipline on existing Drawing Check templates, by template name:
 *   ARCHITECTURAL ...                 -> Architecture
 *   CIVIL & STRUCTURAL ...            -> Structural
 *   MEPF ...                          -> MEPF
 *   PEB ...                           -> PEB
 *   INFRASTRUCTURE ...                -> Infrastructure
 *   MULTI-DISCIPLINE ... CLASH ...    -> Multi-discipline
 * Only fills rows where discipline is null, so it is safe to run more than once.
 * Run "prisma db push" first so the discipline column exists.
 *
 * Usage:
 *   npx tsx scripts/backfill-drawing-check-disciplines.mts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import { backfillDrawingCheckDisciplines } from "../apps/api/src/services/drawingCheckRouting.js";

applyDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const out = await backfillDrawingCheckDisciplines(prisma);
  if (out.skipped.length) {
    console.log("Set these by hand in Checklist Manager:");
    for (const name of out.skipped) console.log(`  - ${name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
