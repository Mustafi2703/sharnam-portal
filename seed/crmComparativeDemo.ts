/**
 * Refresh CRM bid-management demo: comparative summary + all vendor discipline BOQs from R2.xlsx
 *
 * Usage: npm run db:seed-crm-comparative
 */
import { PrismaClient } from "@prisma/client";
import { seedCrmComparative } from "./crmComparativeSeed.ts";

const prisma = new PrismaClient();

async function main() {
  process.env.SEED_FORCE_CRM_BOQ = "1";
  console.log("Refreshing CRM comparative demo (R2 workbook)...");
  await seedCrmComparative(prisma);
  console.log("Done — open CRM → Bid management as office@sharnam.demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
