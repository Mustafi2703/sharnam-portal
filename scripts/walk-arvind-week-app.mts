/**
 * Simulate the Arvind week the way testers click the app.
 *
 *   npm run db:walk-arvind-week
 *
 * Seeds both jobs, publishes WPR files, then optionally walks HTTP
 * if PORTAL_API_URL or http://127.0.0.1:4000 is up.
 */
import "dotenv/config";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import { PrismaClient } from "@prisma/client";
import { runArvindWeekAppWalk } from "../apps/api/src/services/arvindWeekAppWalk.ts";

applyDatabaseUrl();
const prisma = new PrismaClient();

async function detectApi(): Promise<string | undefined> {
  const hinted = process.env.PORTAL_API_URL || process.env.VITE_API_URL;
  const candidates = [hinted, "http://127.0.0.1:4000", "http://127.0.0.1:3001"].filter(Boolean) as string[];
  for (const base of candidates) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/api/health`);
      if (res.ok) return base.replace(/\/$/, "");
    } catch {
      /* try next */
    }
  }
  return undefined;
}

async function main() {
  const apiBase = await detectApi();
  if (apiBase) console.log("Walking live API", apiBase);
  else console.log("API not running — database walk only. Start npm run dev then re-run for HTTP clicks.");

  const out = await runArvindWeekAppWalk(prisma, apiBase);
  console.log("\n=== DB / UI data ===");
  for (const s of out.dbSteps) {
    console.log(`${s.ok ? "PASS" : "FAIL"} | ${s.role} | ${s.step} | ${s.screen} | ${s.detail}`);
  }
  if (out.httpSteps.length) {
    console.log("\n=== HTTP as the app ===");
    for (const s of out.httpSteps) {
      console.log(`${s.ok ? "PASS" : "FAIL"} | ${s.role} | ${s.step} | ${s.screen} | ${s.detail}`);
    }
  }
  console.log("\nReport", out.outDir);
  if (!out.ok) {
    console.error("\nWeek app walk failed.");
    process.exit(1);
  }
  console.log("\nWeek app walk passed. Testers can download WPR/DPR from the maker screens.\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
