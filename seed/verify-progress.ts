/**
 * CLI: verify Progress DB against Excel packs
 *   npm run db:verify-progress
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { code: "SPDC-DEMO-01" } });
  if (!project) {
    console.error("Demo project SPDC-DEMO-01 not found — run npm run db:seed first");
    process.exit(1);
  }

  const { verifyProgressProject, readProgressExcelExpectations } = await import(
    "../apps/api/src/services/progressVerify.ts"
  );
  const exp = readProgressExcelExpectations();
  const report = await verifyProgressProject(project.id);

  console.log("\n=== Progress data verification ===");
  console.log(`Project: ${project.code} · ${project.name}`);
  console.log(`Excel root: ${report.excelRoot}`);
  console.log(`Expected counts:`, exp.counts);
  console.log(`Result: ${report.ok ? "PASS" : "FAIL"} (${report.summary.passed}/${report.summary.total} checks)`);
  console.log("");
  for (const c of report.checks) {
    console.log(
      `${c.ok ? "✓" : "✗"} ${c.label}: expected=${c.expected} actual=${c.actual}${
        c.detail && !c.ok ? ` — ${c.detail}` : ""
      }`
    );
  }
  if (!report.ok) {
    console.error("\nFix seed / re-run npm run db:seed, then verify again.");
    process.exit(1);
  }
  console.log("\nAll tracked Progress registers match Excel source packs.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
