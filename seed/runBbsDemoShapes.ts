import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedBbsDemoShapes } from "./bbsDemoShapes.ts";

const prisma = new PrismaClient();

async function main() {
  const code = process.env.PROJECT_CODE || "SPDC-DEMO-01";
  const project = await prisma.project.findUnique({ where: { code } });
  if (!project) {
    console.error("Project not found:", code);
    process.exit(1);
  }
  const n = await seedBbsDemoShapes(prisma, project.id, project.code, { force: true });
  console.log(`Done — ${n} demo bend diagrams on ${code}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
