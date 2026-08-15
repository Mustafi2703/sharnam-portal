/**
 * Seed CRM comparative statement from official R2 workbook + demo bid package.
 * Pre-fills vendor discipline BOQs so office sees a live comparative on first seed.
 */
import type { PrismaClient } from "@prisma/client";
import fs from "fs";
import * as XLSX from "xlsx";
import {
  COMPARATIVE_DISCIPLINES,
  buildVendorDisciplineSlots,
  importR2WorkbookFromFile,
  parseDisciplineBoqSheet,
  pickDisciplineWorksheet,
  resolveR2TemplatePath,
  writeComparativeTemplateFile,
  type ImportedSheet,
} from "../apps/api/src/services/comparativeStatement.ts";
import { evaluateAllRows, type SheetCell } from "@sharnam/shared";
import path from "path";

const DEMO_VENDORS = ["M/s Bhavna Infra", "TCC Projects PVT. LTD.", "Pearl Electricals"];
const DEMO_PACKAGE_TITLE = "SPDC-DEMO-01 · Civil & structural — R2 demo bid";

/** Slight rate variance per vendor so comparative totals differ in demo. */
const VENDOR_RATE_FACTOR: Record<string, number> = {
  "M/s Bhavna Infra": 1,
  "TCC Projects PVT. LTD.": 1.04,
  "Pearl Electricals": 1.02,
};

function scaleBoqRates(sheet: ImportedSheet, factor: number): ImportedSheet {
  if (factor === 1) return sheet;
  const headers = sheet.headers.map((h) => String(h).toLowerCase());
  const rateCols = headers
    .map((h, i) => (h.includes("rate") || h === "unit rate" ? i : -1))
    .filter((i) => i >= 0);
  const amtCols = headers
    .map((h, i) => (h.includes("amount") || h.includes("total") ? i : -1))
    .filter((i) => i >= 0);

  const rows: SheetCell[][] = sheet.rows.map((row) =>
    row.map((cell, ci) => {
      if (rateCols.includes(ci) || amtCols.includes(ci)) {
        const n = Number(cell.raw);
        if (Number.isFinite(n) && n > 0) return { raw: String(Math.round(n * factor)) };
      }
      return { ...cell };
    })
  );
  return { headers: sheet.headers, rows: evaluateAllRows(rows), sheetName: sheet.sheetName };
}

async function seedVendorBoqUploads(
  prisma: PrismaClient,
  pkgId: string,
  officeUserId: string,
  vendorBoqs: { id: string; vendorLabel: string; discipline: string }[]
) {
  const r2Path = resolveR2TemplatePath();
  const buffer = fs.readFileSync(r2Path);
  const wb = XLSX.read(buffer, { type: "buffer", cellFormula: true });
  const imported = importR2WorkbookFromFile(r2Path, DEMO_VENDORS);

  let uploaded = 0;
  for (const slot of vendorBoqs) {
    const existing = await prisma.crmVendorBoq.findUnique({ where: { id: slot.id } });
    if (existing?.fileName) continue;

    const disc = COMPARATIVE_DISCIPLINES.find((d) => d.key === slot.discipline);
    const template = imported.disciplineTemplates[slot.discipline];
    let parsed: ImportedSheet;
    if (template?.rows?.length) {
      parsed = scaleBoqRates(template, VENDOR_RATE_FACTOR[slot.vendorLabel] ?? 1);
    } else {
      const ws = pickDisciplineWorksheet(wb, slot.discipline);
      if (!ws) continue;
      parsed = scaleBoqRates(parseDisciplineBoqSheet(ws, slot.discipline), VENDOR_RATE_FACTOR[slot.vendorLabel] ?? 1);
    }

    const boqSheet = await prisma.customSheet.create({
      data: {
        name: `${slot.vendorLabel} — ${disc?.label || slot.discipline} — ${DEMO_PACKAGE_TITLE}`,
        category: "CRM Vendor BOQ",
        headersJson: JSON.stringify(parsed.headers),
        rowsJson: JSON.stringify(parsed.rows),
        sourceFile: "Comparative Statement - R2.xlsx",
        createdById: officeUserId,
      },
    });

    await prisma.crmVendorBoq.update({
      where: { id: slot.id },
      data: {
        fileName: `R2-${slot.discipline}-${slot.vendorLabel.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`,
        sheetId: boqSheet.id,
        uploadedById: officeUserId,
        uploadedAt: new Date(),
      },
    });
    uploaded++;
  }
  return uploaded;
}

export async function seedCrmComparative(prisma: PrismaClient) {
  writeComparativeTemplateFile(path.join(process.cwd(), "templates", "Comparative-Statement-R2.xlsx"));

  const office = await prisma.user.findFirst({ where: { email: "office@sharnam.demo" } });
  const officeId = office?.id;

  let pkg = await prisma.crmBidPackage.findFirst({
    where: {
      OR: [{ title: DEMO_PACKAGE_TITLE }, { title: "Civil & structural works — R2 demo bid" }],
    },
    include: { vendorBoqs: true },
  });

  if (pkg && pkg.title !== DEMO_PACKAGE_TITLE) {
    pkg = await prisma.crmBidPackage.update({
      where: { id: pkg.id },
      data: { title: DEMO_PACKAGE_TITLE },
      include: { vendorBoqs: true },
    });
  }

  if (pkg) {
    if (officeId && pkg.vendorBoqs.some((b) => !b.fileName)) {
      const n = await seedVendorBoqUploads(prisma, pkg.id, officeId, pkg.vendorBoqs);
      console.log("CRM comparative demo BOQs refreshed:", n, "uploads on", pkg.title);
    } else {
      console.log("CRM comparative bid package already seeded:", pkg.title);
    }
    return { pkg };
  }

  const imported = importR2WorkbookFromFile(undefined, DEMO_VENDORS);

  const summarySheet = await prisma.customSheet.create({
    data: {
      name: "Comparative Statement R2 — Summary (template)",
      category: "CRM Comparative Summary",
      headersJson: JSON.stringify(imported.summary.headers),
      rowsJson: JSON.stringify(imported.summary.rows),
      sourceFile: "Comparative Statement - R2.xlsx",
      createdById: officeId,
    },
  });

  const masterSheet = await prisma.customSheet.create({
    data: {
      name: "Comparative Statement R2 — Master BOQ (template)",
      category: "CRM Comparative BOQ",
      headersJson: JSON.stringify(imported.masterBoq.headers),
      rowsJson: JSON.stringify(imported.masterBoq.rows),
      sourceFile: "Comparative Statement - R2.xlsx",
      createdById: officeId,
    },
  });

  const lead = await prisma.lead.findFirst({ where: { title: { contains: "Warehouse" } } });
  const demoProject = await prisma.project.findUnique({ where: { code: "SPDC-DEMO-01" } });
  const vendors = await prisma.vendor.findMany({
    where: { name: { in: DEMO_VENDORS } },
    select: { id: true, name: true },
  });
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v.id]));
  const slots = buildVendorDisciplineSlots(DEMO_VENDORS);

  pkg = await prisma.crmBidPackage.create({
    data: {
      title: DEMO_PACKAGE_TITLE,
      leadId: lead?.id ?? null,
      revisionLabel: "R2",
      status: "Evaluation",
      vendorNamesJson: JSON.stringify(DEMO_VENDORS),
      comparativeSheetId: masterSheet.id,
      summarySheetId: summarySheet.id,
      notes: demoProject
        ? `Linked project: ${demoProject.code} · ${demoProject.name}. Source: Comparative Statement - R2.xlsx`
        : "Source: Comparative Statement - R2.xlsx",
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

  if (officeId) {
    const n = await seedVendorBoqUploads(prisma, pkg.id, officeId, pkg.vendorBoqs);
    console.log(
      "CRM comparative seeded:",
      pkg.title,
      "—",
      pkg.vendorBoqs.length,
      "slots,",
      n,
      "demo BOQs from R2.xlsx"
    );
  }

  return { pkg, summarySheet, masterSheet };
}
