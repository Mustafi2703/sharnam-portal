/**
 * Fill project setup from the shared Arvind / July 2026 pack, then write a WPR.
 *
 *   npx tsx scripts/setup-arvind-from-shared.mts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import { PrismaClient } from "@prisma/client";
import { completeProjectSetup } from "../apps/api/src/services/completeProjectSetup.ts";
import { buildJulyWprPack } from "../apps/api/src/services/wprJulyWorkbook.ts";
import { buildWprPptx } from "../apps/api/src/services/wprPptx.ts";
import { buildWprWorkbook } from "../apps/api/src/services/wprXlsx.ts";

applyDatabaseUrl();
const prisma = new PrismaClient();

const PARTIES = [
  {
    name: "Arvind Limited",
    partyType: "Client",
    trade: "Client / Owner",
    email: "projects@arvind.demo",
    primaryContactName: "Client PM",
    city: "Santej",
    state: "Gujarat",
  },
  {
    name: "AK Consultant",
    partyType: "Consultant",
    trade: "Project Consultant",
    email: "ak@consultant.demo",
    primaryContactName: "A. Kumar",
    city: "Ahmedabad",
    state: "Gujarat",
  },
  {
    name: "Sharnam Project Development Consultants & Co.",
    partyType: "PMC",
    trade: "PMC",
    email: "office@sharnam.demo",
    primaryContactName: "Office Coordinator",
    city: "Ahmedabad",
    state: "Gujarat",
  },
  {
    name: "Bhavana Infra",
    partyType: "Contractor",
    trade: "Civil — Worker Dormitory",
    email: "site@bhavanainfra.demo",
    primaryContactName: "Site In-charge",
    city: "Santej",
    state: "Gujarat",
  },
] as const;

async function upsertVendor(def: (typeof PARTIES)[number]) {
  const existing = await prisma.vendor.findFirst({ where: { name: def.name } });
  if (existing) {
    return prisma.vendor.update({
      where: { id: existing.id },
      data: {
        partyType: def.partyType,
        trade: def.trade,
        email: def.email,
        primaryContactName: def.primaryContactName,
        city: def.city,
        state: def.state,
      },
    });
  }
  return prisma.vendor.create({
    data: { ...def, country: "India", createdVia: "Shared pack setup" },
  });
}

async function writeJulyWprFiles() {
  const pack = buildJulyWprPack();
  const [pptxBuf, xlsxBuf] = await Promise.all([buildWprPptx(pack), buildWprWorkbook(pack)]);
  const outDir = path.join(process.cwd(), "docs", "client-share");
  fs.mkdirSync(outDir, { recursive: true });
  const pptxName = "WPR-Arvind-23-29-Jul-2026.pptx";
  const xlsxName = "WPR-Arvind-23-29-Jul-2026.xlsx";
  fs.writeFileSync(path.join(outDir, pptxName), pptxBuf);
  fs.writeFileSync(path.join(outDir, xlsxName), xlsxBuf);
  const sectionCounts = Object.entries(pack.sections).map(([k, s]) => `${k}:${s?.rows?.length || 0}`);
  console.log(`Wrote ${path.join(outDir, pptxName)} (${pptxBuf.length} bytes)`);
  console.log(`Wrote ${path.join(outDir, xlsxName)} (${xlsxBuf.length} bytes)`);
  console.log("Sections", sectionCounts.join(" · "));
  return pack;
}

async function main() {
  const pack = await writeJulyWprFiles();

  let admin;
  try {
    admin = await prisma.user.findFirst({ where: { role: { in: ["admin", "office"] } }, orderBy: { createdAt: "asc" } });
  } catch (err) {
    console.warn("Database not reachable — WPR files written from the shared July pack. Project row not updated.");
    console.warn(err instanceof Error ? err.message : err);
    return;
  }
  if (!admin) throw new Error("No admin/office user — run db seed first");

  const vendors = [];
  for (const def of PARTIES) vendors.push(await upsertVendor(def));

  const project = await prisma.project.upsert({
    where: { code: "SPDC-ARVIND-01" },
    create: {
      code: "SPDC-ARVIND-01",
      name: "Construction of Worker Dormitory — Arvind Limited, Santej",
      clientName: "Arvind Limited",
      clientContactName: "Client PM",
      clientEmail: "projects@arvind.demo",
      location: "Santej",
      clientAddress: "Santej, Gujarat",
      designConsultant: "AK Consultant",
      contractorName: "Bhavana Infra",
      status: "Active",
    },
    update: {
      name: "Construction of Worker Dormitory — Arvind Limited, Santej",
      clientName: "Arvind Limited",
      location: "Santej",
      clientAddress: "Santej, Gujarat",
      designConsultant: "AK Consultant",
      contractorName: "Bhavana Infra",
    },
  });

  for (const v of vendors) {
    await prisma.projectVendor.upsert({
      where: { projectId_vendorId: { projectId: project.id, vendorId: v.id } },
      create: { projectId: project.id, vendorId: v.id, tradeRole: v.trade, assignedVia: "Shared pack setup" },
      update: { tradeRole: v.trade },
    });
  }

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    create: { projectId: project.id, userId: admin.id, role: "office" },
    update: {},
  });

  const setup = await completeProjectSetup(project.id, admin.id);
  console.log("Setup", {
    project: project.code,
    location: "Santej",
    folders: setup.folders.count,
    contacts: setup.comms.contacts.created,
    dpr: setup.reports.dpr,
    wprToday: setup.reports.wpr,
  });

  const weekEnd = new Date("2026-07-29T23:59:59.999");
  await prisma.wprSnapshot.upsert({
    where: { projectId_weekEnding: { projectId: project.id, weekEnding: weekEnd } },
    create: {
      projectId: project.id,
      weekEnding: weekEnd,
      reportNumber: pack.header.reportNumber ?? 52,
      sectionsJson: JSON.stringify(pack.sections),
      status: "Draft",
      createdById: admin.id,
    },
    update: {
      reportNumber: pack.header.reportNumber ?? 52,
      sectionsJson: JSON.stringify(pack.sections),
      status: "Draft",
    },
  });

  console.log("July WPR snapshot stored on", project.code, "week ending 2026-07-29");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
