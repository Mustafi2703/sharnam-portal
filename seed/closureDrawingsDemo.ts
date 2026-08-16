/**
 * Seed Drawing Register + Project Closure (snag, lessons, report) for demo projects.
 *
 * Usage: npm run db:seed-closure-drawings
 */
import "dotenv/config";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { seedClosureDrawingsForDemoProjects } from "./closureDrawingsSeed.ts";

const prisma = new PrismaClient();

async function main() {
  await seedClosureDrawingsForDemoProjects(prisma);
  console.log("Closure + drawing register seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
