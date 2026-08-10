/**
 * Seed CRM comparative statement from official R2 workbook + demo bid package.
 */
import { PrismaClient } from "@prisma/client";
import {
  COMPARATIVE_DISCIPLINES,
  buildVendorDisciplineSlots,
  importR2WorkbookFromFile,
  writeComparativeTemplateFile,
} from "../apps/api/src/services/comparativeStatement.ts";
import path from "path";

const DEMO_VENDORS = ["M/s Bhavna Infra", "TCC Projects PVT. LTD.", "Pearl Electricals"];

export async function seedCrmComparative(prisma: PrismaClient) {
  writeComparativeTemplateFile(path.join(process.cwd(), "templates", "Comparative-Statement-R2.xlsx"));

  const existingPkg = await prisma.crmBidPackage.findFirst({
    where: { title: "Civil & structural works — R2 demo bid" },
  });
  if (existingPkg) {
    console.log("CRM comparative bid package already seeded:", existingPkg.title);
    return { pkg: existingPkg };
  }

  const imported = importR2WorkbookFromFile(undefined, DEMO_VENDORS);

  const summarySheet = await prisma.customSheet.create({
    data: {
      name: "Comparative Statement R2 — Summary (template)",
      category: "CRM Comparative Summary",
      headersJson: JSON.stringify(imported.summary.headers),
      rowsJson: JSON.stringify(imported.summary.rows),
      sourceFile: "Comparative Statement - R2.xlsx",
    },
  });

  const masterSheet = await prisma.customSheet.create({
    data: {
      name: "Comparative Statement R2 — Master BOQ (template)",
      category: "CRM Comparative BOQ",
      headersJson: JSON.stringify(imported.masterBoq.headers),
      rowsJson: JSON.stringify(imported.masterBoq.rows),
      sourceFile: "Comparative Statement - R2.xlsx",
    },
  });

  const lead = await prisma.lead.findFirst({ where: { title: { contains: "Warehouse" } } });
  const vendors = await prisma.vendor.findMany({
    where: { name: { in: DEMO_VENDORS } },
    select: { id: true, name: true },
  });
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v.id]));
  const slots = buildVendorDisciplineSlots(DEMO_VENDORS);

  const pkg = await prisma.crmBidPackage.create({
    data: {
      title: "Civil & structural works — R2 demo bid",
      leadId: lead?.id ?? null,
      revisionLabel: "R2",
      status: "Evaluation",
      vendorNamesJson: JSON.stringify(DEMO_VENDORS),
      comparativeSheetId: masterSheet.id,
      summarySheetId: summarySheet.id,
      notes: `Per-vendor discipline BOQ uploads (${COMPARATIVE_DISCIPLINES.length} disciplines × ${DEMO_VENDORS.length} vendors).`,
      vendorBoqs: {
        create: slots.map(({ vendorLabel, discipline }) => ({
          vendorLabel,
          discipline,
          vendorId: vendorByName[vendorLabel] ?? null,
        })),
      },
    },
    include: { vendorBoqs: true },
  });

  console.log(
    "CRM comparative seeded:",
    pkg.title,
    "—",
    pkg.vendorBoqs.length,
    "upload slots (",
    DEMO_VENDORS.length,
    "vendors ×",
    COMPARATIVE_DISCIPLINES.length,
    "disciplines )"
  );
  return { pkg, summarySheet, masterSheet };
}
