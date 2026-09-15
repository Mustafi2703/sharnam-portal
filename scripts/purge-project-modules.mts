/**
 * Clear module transactional data for one or all projects.
 * Keeps project card, directory, vendors, and communication matrix.
 *
 * Usage:
 *   npx tsx scripts/purge-project-modules.mts --code "SHAR/SNT/26-27/Voltamp Transformers Ltd."
 *   npx tsx scripts/purge-project-modules.mts --all
 */
import { PrismaClient } from "@prisma/client";
import { purgeProjectModuleData } from "../apps/api/src/services/purgeProject.js";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const codeIdx = args.indexOf("--code");
  const code = codeIdx >= 0 ? args[codeIdx + 1] : "";

  let projects: { id: string; code: string; name: string }[] = [];
  if (all) {
    projects = await prisma.project.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } });
  } else if (code) {
    const p = await prisma.project.findFirst({
      where: { code: { equals: code } },
      select: { id: true, code: true, name: true },
    });
    if (!p) {
      console.error(`Project not found for code: ${code}`);
      process.exit(1);
    }
    projects = [p];
  } else {
    console.error("Pass --code \"PROJECT-CODE\" or --all");
    process.exit(1);
  }

  for (const project of projects) {
    console.log(`Purging module data: ${project.code} (${project.name})`);
    await prisma.$transaction(async (tx) => {
      await purgeProjectModuleData(tx, project.id);
    }, { timeout: 120_000, maxWait: 10_000 });
    console.log(`  ✓ cleared`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
