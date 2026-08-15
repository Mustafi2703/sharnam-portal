/**
 * Re-run full client demo pack only (DPR day + pilot week).
 * Base project/users must exist — run npm run db:seed first if empty.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedFullDemoPack } from "./fullDemoPack.ts";

const prisma = new PrismaClient();

async function main() {
  await seedFullDemoPack(prisma);
  console.log("\nFull demo pack complete.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
