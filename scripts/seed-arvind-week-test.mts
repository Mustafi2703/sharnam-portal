/**
 * Structured Arvind week test for both jobs.
 *
 *   npm run db:seed-arvind-week-test
 *
 * Does not run full seed/seed.ts. Requires an office/admin user
 * (npm run db:seed once, or an existing Hostinger DB).
 */
import "dotenv/config";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import { PrismaClient } from "@prisma/client";
import { runArvindWeekTest } from "../apps/api/src/services/arvindWeekTest.ts";

applyDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const out = await runArvindWeekTest(prisma);
  console.log("\n=== Sheet audit ===");
  console.log(JSON.stringify(out.audit.counts, null, 2));
  console.log("\nBudget health");
  for (const [k, b] of Object.entries(out.audit.budget)) {
    console.log(`  ${k}: ${b.name} full=${b.fullSpdcWorkbook} costSource=${b.costSource} — ${b.detail}`);
  }
  console.log("\n=== NTX ===");
  console.log(JSON.stringify({ ...out.ntx, pack: out.ntx.pack.summary }, null, 2));
  console.log("\n=== Dorm ===");
  console.log(JSON.stringify({ ...out.dorm, pack: out.dorm.pack.summary }, null, 2));
  console.log("\n=== Leftovers for real-project upload ===");
  for (const line of out.leftovers) console.log(`  - ${line}`);
  if (!out.ok) {
    const errs = [...out.ntx.errors, ...out.dorm.errors];
    console.error("\nWeek test failed:\n", errs.join("\n"));
    process.exit(1);
  }
  console.log("\nArvind week test passed for SPDC-ARVIND-NTX and SPDC-ARVIND-01.\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
