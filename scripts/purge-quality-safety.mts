/**
 * Clear Quality + Safety transactional data for one project.
 * Keeps drawings, cost, progress, finance, members, vendors, communication matrix.
 *
 * Usage:
 *   npx tsx scripts/purge-quality-safety.mts --code "SHAR/SNT/26-27/Voltamp Transformers Ltd."
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { purgeQualitySafetyModuleData } from "../apps/api/src/services/purgeProject.js";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const codeIdx = args.indexOf("--code");
  const code = codeIdx >= 0 ? args[codeIdx + 1] : "";
  if (!code) {
    console.error('Pass --code "PROJECT-CODE"');
    process.exit(1);
  }

  const project = await prisma.project.findFirst({
    where: { code: { equals: code } },
    select: { id: true, code: true, name: true },
  });
  if (!project) {
    console.error(`Project not found for code: ${code}`);
    process.exit(1);
  }

  console.log(`Purging Quality + Safety: ${project.code} (${project.name})`);
  await prisma.$transaction(
    async (tx) => {
      await purgeQualitySafetyModuleData(tx, project.id);
    },
    { timeout: 120_000, maxWait: 10_000 }
  );
  const { clearQualitySafetyDriveFiles } = await import("../apps/api/src/services/clearQualitySafetyDrive.js");
  const driveCleared = await clearQualitySafetyDriveFiles(project.code);
  console.log(`  ✓ Quality / Safety cleared (drawings & setup kept) · drive files removed: ${driveCleared}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
