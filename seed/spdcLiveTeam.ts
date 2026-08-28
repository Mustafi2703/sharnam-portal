/**
 * CLI wrapper — logic lives in apps/api/src/services/spdcLiveTeamSeed.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "../scripts/resolve-database-url.mjs";
import { seedSpdcLiveTeam, LIVE_TEAM } from "../apps/api/src/services/spdcLiveTeamSeed.ts";

applyDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const result = await seedSpdcLiveTeam(prisma);
  console.log("SPDC live team seeded on", result.project.code);
  console.log("Users (password:", result.password, "):");
  for (const t of LIVE_TEAM) console.log(" ", t.email, "→", t.role);
  console.log("Notification DL:", result.notify);
  console.log("Meeting:", result.meeting?.title);
  console.log("RFI:", result.rfi?.number);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

export { seedSpdcLiveTeam, LIVE_TEAM };
