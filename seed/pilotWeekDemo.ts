/**
 * SPDC-PILOT-02 — week-long demo project for multi-user UAT (no Comms / RFI seed).
 *
 *   npm run db:seed-pilot-week
 *   PILOT_WEEK_END=2026-08-16 npm run db:seed-pilot-week
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { portalForRole } from "../packages/shared/src/index.ts";
import { seedDprDemoDay } from "../apps/api/src/services/dprDemoDaySeed.ts";
import { buildWprWorkbook, type WprHeader, type WprSections } from "../apps/api/src/services/wprXlsx.ts";
import { buildWprPptx } from "../apps/api/src/services/wprPptx.ts";

const prisma = new PrismaClient();
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Demo@1234";
const PILOT_CODE = "SPDC-PILOT-02";

function weekEndDate(): Date {
  const raw = process.env.PILOT_WEEK_END || "2026-08-16";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid PILOT_WEEK_END: ${raw}`);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function ensureUser(email: string, fullName: string, role: "office" | "site_employee" | "client") {
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    create: { email, fullName, role, portal: portalForRole(role), passwordHash: hash, isActive: true },
    update: { fullName, isActive: true },
  });
}

async function cloneRows<T extends { id: string; projectId: string }>(
  label: string,
  fromId: string,
  toId: string,
  find: () => Promise<T[]>,
  insert: (data: Omit<T, "id" | "projectId">) => Promise<unknown>
) {
  const rows = await find();
  if (!rows.length) {
    console.log(`  skip ${label}`);
    return;
  }
  for (const row of rows) {
    const { id: _id, projectId: _pid, ...rest } = row;
    await insert(rest as Omit<T, "id" | "projectId">);
  }
  console.log(`  cloned ${label}: ${rows.length}`);
}

async function main() {
  const weekEnd = weekEndDate();
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const demo = await prisma.project.findUnique({ where: { code: "SPDC-DEMO-01" } });
  if (!demo) {
    console.error("Run npm run db:seed first (needs SPDC-DEMO-01).");
    process.exit(1);
  }

  const office = await ensureUser("office@sharnam.demo", "SPDC Office Lead", "office");
  await ensureUser("site.pilot@sharnam.demo", "Rajesh Site Engineer", "site_employee");
  await ensureUser("site2.pilot@sharnam.demo", "Priya Site QC", "site_employee");
  await ensureUser("client.pilot@sharnam.demo", "Client PM — Pilot", "client");

  const project = await prisma.project.upsert({
    where: { code: PILOT_CODE },
    create: {
      code: PILOT_CODE,
      name: "SPDC Pilot — Week Demo Site",
      clientName: "Pilot Client Ltd",
      location: "Ahmedabad, Gujarat",
      status: "In Progress",
      contractorName: "M/s Bhavna Infra",
      designConsultant: "SPDC PMC Team",
      endDate: new Date("2027-03-31"),
      notificationEmails: "office@sharnam.demo,client.pilot@sharnam.demo",
      emailEnabled: true,
    },
    update: { contractorName: "M/s Bhavna Infra", designConsultant: "SPDC PMC Team" },
  });

  for (const [userId, role] of [
    [office.id, "office"],
    [(await prisma.user.findUniqueOrThrow({ where: { email: "site.pilot@sharnam.demo" } })).id, "site_employee"],
    [(await prisma.user.findUniqueOrThrow({ where: { email: "site2.pilot@sharnam.demo" } })).id, "site_employee"],
    [(await prisma.user.findUniqueOrThrow({ where: { email: "client.pilot@sharnam.demo" } })).id, "client"],
  ] as const) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      create: { projectId: project.id, userId, role },
      update: { role },
    });
  }

  fs.mkdirSync(path.join(process.cwd(), "uploads", "onedrive", project.code), { recursive: true });

  console.log(`\nCloning ${demo.code} → ${project.code} (Cost · Progress · Quality · Safety — no Comms/RFI)…\n`);

  await prisma.progressActivityLine.deleteMany({ where: { projectId: project.id } });
  await prisma.progressManpower.deleteMany({ where: { projectId: project.id } });
  await prisma.progressPlannedActual.deleteMany({ where: { projectId: project.id } });
  await prisma.progressMilestone.deleteMany({ where: { projectId: project.id } });
  await prisma.progressHindrance.deleteMany({ where: { projectId: project.id } });
  await prisma.costMonitoringLine.deleteMany({ where: { projectId: project.id } });
  await prisma.costMbLine.deleteMany({ where: { projectId: project.id } });
  await prisma.costBbsLine.deleteMany({ where: { projectId: project.id } });
  await prisma.qualityNcr.deleteMany({ where: { projectId: project.id } });
  await prisma.cubeTest.deleteMany({ where: { projectId: project.id } });

  await cloneRows("activity lines", demo.id, project.id, () => prisma.progressActivityLine.findMany({ where: { projectId: demo.id } }), (d) =>
    prisma.progressActivityLine.create({ data: { ...d, projectId: project.id } })
  );
  await cloneRows("manpower", demo.id, project.id, () => prisma.progressManpower.findMany({ where: { projectId: demo.id } }), (d) =>
    prisma.progressManpower.create({ data: { ...d, projectId: project.id } })
  );
  await cloneRows("planned vs actual", demo.id, project.id, () => prisma.progressPlannedActual.findMany({ where: { projectId: demo.id } }), (d) =>
    prisma.progressPlannedActual.create({ data: { ...d, projectId: project.id } })
  );
  await cloneRows("milestones", demo.id, project.id, () => prisma.progressMilestone.findMany({ where: { projectId: demo.id }, take: 40 }), (d) =>
    prisma.progressMilestone.create({ data: { ...d, projectId: project.id } })
  );
  await cloneRows("hindrances", demo.id, project.id, () => prisma.progressHindrance.findMany({ where: { projectId: demo.id }, take: 20 }), (d) =>
    prisma.progressHindrance.create({ data: { ...d, projectId: project.id } })
  );
  await cloneRows("BOQ monitoring", demo.id, project.id, () => prisma.costMonitoringLine.findMany({ where: { projectId: demo.id } }), (d) =>
    prisma.costMonitoringLine.create({ data: { ...d, projectId: project.id } })
  );
  await cloneRows("MB", demo.id, project.id, () => prisma.costMbLine.findMany({ where: { projectId: demo.id } }), (d) =>
    prisma.costMbLine.create({ data: { ...d, projectId: project.id } })
  );
  await cloneRows("BBS", demo.id, project.id, () => prisma.costBbsLine.findMany({ where: { projectId: demo.id } }), (d) =>
    prisma.costBbsLine.create({ data: { ...d, projectId: project.id } })
  );
  await cloneRows("NCR", demo.id, project.id, () => prisma.qualityNcr.findMany({ where: { projectId: demo.id }, take: 15 }), (d) =>
    prisma.qualityNcr.create({ data: { ...d, projectId: project.id } })
  );
  await cloneRows("cube tests", demo.id, project.id, () => prisma.cubeTest.findMany({ where: { projectId: demo.id }, take: 20 }), (d) =>
    prisma.cubeTest.create({ data: { ...d, projectId: project.id } })
  );

  console.log(`\nSeeding 7 published DPR days…\n`);
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    day.setHours(0, 0, 0, 0);
    const result = await seedDprDemoDay(prisma, project.id, day, office.id);
    console.log(`  ✓ ${result.logDate} · ${result.disciplines.length} disciplines`);
  }

  const demoWpr = await prisma.wprSnapshot.findFirst({
    where: { projectId: demo.id },
    orderBy: { weekEnding: "desc" },
  });
  const sections: WprSections = demoWpr ? JSON.parse(demoWpr.sectionsJson || "{}") : ({} as WprSections);

  const header: WprHeader = {
    projectName: project.name,
    projectCode: project.code,
    reportNumber: 50,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    clientName: project.clientName || "",
    designConsultant: project.designConsultant || "",
    contractorName: project.contractorName || "",
    location: project.location || "",
    pmc: "Sharnam Project Development Consultants & Co.",
  };

  await prisma.wprSnapshot.upsert({
    where: { projectId_weekEnding: { projectId: project.id, weekEnding: weekEnd } },
    create: {
      projectId: project.id,
      weekEnding: weekEnd,
      reportNumber: 50,
      sectionsJson: JSON.stringify(sections),
      status: "Published",
      publishedAt: new Date(),
      createdById: office.id,
    },
    update: {
      sectionsJson: JSON.stringify(sections),
      status: "Published",
      publishedAt: new Date(),
    },
  });

  const wprFolder = "07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve/WPR";
  const wprRoot = path.join(process.cwd(), "uploads", "onedrive", project.code, wprFolder);
  fs.mkdirSync(wprRoot, { recursive: true });
  const endStr = weekEnd.toISOString().slice(0, 10);
  fs.writeFileSync(path.join(wprRoot, `WPR-${project.code}-${endStr}.xlsx`), await buildWprWorkbook({ header, sections }));
  fs.writeFileSync(path.join(wprRoot, `WPR-${project.code}-${endStr}.pptx`), await buildWprPptx({ header, sections }));

  console.log(`
Done — ${PILOT_CODE}
Password for all: ${SEED_PASSWORD}

  office@sharnam.demo
  site.pilot@sharnam.demo
  site2.pilot@sharnam.demo
  client.pilot@sharnam.demo

WPR week ending ${endStr} · PPTX on disk
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
