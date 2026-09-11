/**
 * Seed Arvind NTX (week 3) + dormitory (23–29 Jul) from the week dashboards.
 *
 *   npm run db:seed-arvind
 */
import "dotenv/config";
import { applyDatabaseUrl } from "../scripts/resolve-database-url.mjs";
import { PrismaClient } from "@prisma/client";
import { seedArvindSitePack } from "../apps/api/src/services/arvindSiteSeed.ts";

applyDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const out = await seedArvindSitePack(prisma);
  console.log("Arvind site pack ready");
  console.log("Checklist fills (Quality Dashboard Sheet2):", JSON.stringify(out.checklistCatalog, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
