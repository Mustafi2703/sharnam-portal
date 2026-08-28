/**
 * CLI — seed SPDC-UAT-LIVE project (DPR week + WPR + COP → SharePoint).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "../scripts/resolve-database-url.mjs";
import { seedUatLiveProject } from "../apps/api/src/services/uatDemoProjectSeed.ts";

applyDatabaseUrl();
const prisma = new PrismaClient();

seedUatLiveProject(prisma)
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    console.log("\nOpen Finance → COP and DPR Maker / WPR Maker on", r.project.code);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
