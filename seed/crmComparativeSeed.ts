/**
 * Seed CRM comparative statement template + demo bid package.
 */
import path from "path";
import { PrismaClient } from "@prisma/client";
import { buildComparativeSheetData, writeComparativeTemplateFile } from "../apps/api/src/services/comparativeStatement.ts";

const DEMO_VENDORS = ["M/s Bhavna Infra", "TCC Projects PVT. LTD.", "Pearl Electricals"];

export async function seedCrmComparative(prisma: PrismaClient) {
  const templatesDir = path.resolve(process.cwd(), "templates");
  writeComparativeTemplateFile(path.join(templatesDir, "Comparative-Statement-R2.xlsx"), DEMO_VENDORS);

  const existingSheet = await prisma.customSheet.findFirst({
    where: { category: "CRM Comparative", name: { contains: "Comparative Statement R2" } },
  });

  const { headers, rows } = buildComparativeSheetData(DEMO_VENDORS);
  const sheet =
    existingSheet ??
    (await prisma.customSheet.create({
      data: {
        name: "Comparative Statement R2 — Template",
        category: "CRM Comparative",
        headersJson: JSON.stringify(headers),
        rowsJson: JSON.stringify(rows),
        sourceFile: "Comparative-Statement-R2.xlsx",
      },
    }));

  const existingPkg = await prisma.crmBidPackage.findFirst({
    where: { title: "Warehouse civil package — demo bid" },
  });
  if (existingPkg) {
    console.log("CRM comparative bid package already seeded:", existingPkg.title);
    return { sheet, pkg: existingPkg };
  }

  const lead = await prisma.lead.findFirst({ where: { title: { contains: "Warehouse" } } });
  const vendors = await prisma.vendor.findMany({
    where: { name: { in: DEMO_VENDORS } },
    select: { id: true, name: true },
  });
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v.id]));

  const pkg = await prisma.crmBidPackage.create({
    data: {
      title: "Warehouse civil package — demo bid",
      leadId: lead?.id ?? null,
      revisionLabel: "R2",
      status: "Evaluation",
      vendorNamesJson: JSON.stringify(DEMO_VENDORS),
      comparativeSheetId: sheet.id,
      notes: "Demo: vendors upload BOQs; Sharnam team edits comparative in Sheet Maker.",
      vendorBoqs: {
        create: DEMO_VENDORS.map((label) => ({
          vendorLabel: label,
          vendorId: vendorByName[label] ?? null,
        })),
      },
    },
    include: { vendorBoqs: true },
  });

  console.log("CRM comparative seeded:", pkg.title, "—", pkg.vendorBoqs.length, "vendor slots");
  return { sheet, pkg };
}
