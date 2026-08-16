/**
 * Seed Safety module from Safety NCR.xlsx + Safety Dashboard.xlsx for all demo projects.
 *
 * Usage: npm run db:seed-safety-sheets
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { seedSafetyFromWorkbooksForAllDemoProjects } from "./qualitySafetySheets.ts";

const prisma = new PrismaClient();

function resolveExcelRoot(): string {
  if (process.env.SHARNAM_EXCEL_ROOT) return path.resolve(process.env.SHARNAM_EXCEL_ROOT);
  const bundled = path.resolve(process.cwd(), "seed/data");
  if (fs.existsSync(bundled)) return bundled;
  return process.cwd();
}

async function main() {
  const root = resolveExcelRoot();
  console.log("Safety sheet root:", root);
  const need = ["Safety NCR.xlsx", "Safety Dashboard.xlsx"];
  for (const f of need) {
    if (!fs.existsSync(path.join(root, f))) {
      console.error("Missing:", path.join(root, f));
      console.error("Run: node scripts/sync-reference-sheets.mjs");
      process.exit(1);
    }
  }
  await seedSafetyFromWorkbooksForAllDemoProjects(prisma, root);
  console.log("Done — open Project → Safety on SPDC-DEMO-01 or SPDC-PILOT-02");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
