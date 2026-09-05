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
  defaultDisciplines,
  importR2WorkbookFromFile,
  parseDisciplineBoqSheet,
  pickDisciplineWorksheet,
  resolveR2TemplatePath,
  writeComparativeTemplateFile,
  type ImportedSheet,
} from "../apps/api/src/services/comparativeStatement.ts";
import { evaluateAllRows, type SheetCell } from "@sharnam/shared";
import path from "path";
import { mockOneDrive } from "../apps/api/src/services/mockOneDrive.ts";
import {
  CRM_SHAREPOINT,
  syncBufferToProjectSharePoint,
  syncComparativeWorkbook,
} from "../apps/api/src/services/crmSharePoint.ts";

const DEMO_VENDORS = ["M/s Bhavna Infra", "TCC Projects PVT. LTD.", "Pearl Electricals"];
const DEMO_DISCIPLINES = defaultDisciplines();
const DEMO_DISCIPLINES_JSON = JSON.stringify(DEMO_DISCIPLINES);
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
  vendorBoqs: { id: string; vendorLabel: string; discipline: string; fileName?: string | null; sheetId?: string | null }[],
  projectCode?: string | null,
  force = false
) {
  const r2Path = resolveR2TemplatePath();
  const buffer = fs.readFileSync(r2Path);
  const wb = XLSX.read(buffer, { type: "buffer", cellFormula: true });
  const imported = importR2WorkbookFromFile(r2Path, DEMO_VENDORS);

  let uploaded = 0;
  for (const slot of vendorBoqs) {
    const existing = await prisma.crmVendorBoq.findUnique({ where: { id: slot.id } });
    if (!force && existing?.fileName && existing.sheetId) continue;

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

    const sheetPayload = {
      name: `${slot.vendorLabel} — ${disc?.label || slot.discipline} — ${DEMO_PACKAGE_TITLE}`,
      headersJson: JSON.stringify(parsed.headers),
      rowsJson: JSON.stringify(parsed.rows),
      sourceFile: "Comparative Statement - R2.xlsx",
    };

    let boqSheetId = existing?.sheetId || null;
    if (boqSheetId && force) {
      await prisma.customSheet.update({ where: { id: boqSheetId }, data: sheetPayload });
    } else if (!boqSheetId) {
      const boqSheet = await prisma.customSheet.create({
        data: { ...sheetPayload, category: "CRM Vendor BOQ", createdById: officeUserId },
      });
      boqSheetId = boqSheet.id;
    }

    const fileName = `R2-${slot.discipline}-${slot.vendorLabel.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
    let storagePath: string | undefined = existing?.storagePath || undefined;
    let sharePointUrl: string | null = existing?.sharePointUrl || null;
    if (projectCode) {
      const miniWb = XLSX.utils.book_new();
      const aoa = [parsed.headers, ...parsed.rows.map((row) => row.map((c) => c.raw))];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(miniWb, ws, disc?.sheetName || slot.discipline);
      const out = XLSX.write(miniWb, { type: "buffer", bookType: "xlsx" }) as Buffer;
      const saved = await syncBufferToProjectSharePoint(
        projectCode,
        CRM_SHAREPOINT.vendorBoqFolder(slot.vendorLabel),
        fileName,
        out
      );
      storagePath = saved.path;
      sharePointUrl = saved.sharePointUrl || null;
    }

    await prisma.crmVendorBoq.update({
      where: { id: slot.id },
      data: {
        fileName,
        storagePath,
        sharePointUrl,
        sheetId: boqSheetId,
        uploadedById: officeUserId,
        uploadedAt: new Date(),
      },
    });
    uploaded++;
  }
  return uploaded;
}

async function refreshComparativeSheets(
  prisma: PrismaClient,
  pkg: { id: string; summarySheetId: string | null; comparativeSheetId: string | null },
  officeUserId: string | undefined
) {
  const imported = importR2WorkbookFromFile(undefined, DEMO_VENDORS);
  const summaryPayload = {
    name: "Comparative Statement R2 — Summary (demo)",
    headersJson: JSON.stringify(imported.summary.headers),
    rowsJson: JSON.stringify(imported.summary.rows),
    sourceFile: "Comparative Statement - R2.xlsx",
  };
  const masterPayload = {
    name: "Comparative Statement R2 — Master BOQ (demo)",
    headersJson: JSON.stringify(imported.masterBoq.headers),
    rowsJson: JSON.stringify(imported.masterBoq.rows),
    sourceFile: "Comparative Statement - R2.xlsx",
  };

  let summarySheetId = pkg.summarySheetId;
  let comparativeSheetId = pkg.comparativeSheetId;

  if (summarySheetId) {
    await prisma.customSheet.update({ where: { id: summarySheetId }, data: summaryPayload });
  } else if (officeUserId) {
    const s = await prisma.customSheet.create({
      data: { ...summaryPayload, category: "CRM Comparative Summary", createdById: officeUserId },
    });
    summarySheetId = s.id;
  }

  if (comparativeSheetId) {
    await prisma.customSheet.update({ where: { id: comparativeSheetId }, data: masterPayload });
  } else if (officeUserId) {
    const m = await prisma.customSheet.create({
      data: { ...masterPayload, category: "CRM Comparative BOQ", createdById: officeUserId },
    });
    comparativeSheetId = m.id;
  }

  if (summarySheetId !== pkg.summarySheetId || comparativeSheetId !== pkg.comparativeSheetId) {
    await prisma.crmBidPackage.update({
      where: { id: pkg.id },
      data: { summarySheetId, comparativeSheetId },
    });
  }

  return { summarySheetId, comparativeSheetId };
}

async function ensureDemoVendorSlots(prisma: PrismaClient, pkgId: string) {
  const vendors = await prisma.vendor.findMany({
    where: { name: { in: DEMO_VENDORS } },
    select: { id: true, name: true },
  });
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v.id]));
  const slots = buildVendorDisciplineSlots(DEMO_VENDORS, DEMO_DISCIPLINES);
  let created = 0;
  for (const { vendorLabel, discipline } of slots) {
    await prisma.crmVendorBoq.upsert({
      where: { bidPackageId_vendorLabel_discipline: { bidPackageId: pkgId, vendorLabel, discipline } },
      create: {
        bidPackageId: pkgId,
        vendorLabel,
        discipline,
        vendorId: vendorByName[vendorLabel] ?? null,
      },
      update: { vendorId: vendorByName[vendorLabel] ?? null },
    });
    created++;
  }
  return created;
}

async function backfillDemoVendorIds(
  prisma: PrismaClient,
  vendorBoqs: { id: string; vendorLabel: string; vendorId?: string | null }[]
) {
  const vendors = await prisma.vendor.findMany({
    where: { name: { in: DEMO_VENDORS } },
    select: { id: true, name: true },
  });
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v.id]));
  let linked = 0;
  for (const slot of vendorBoqs) {
    const vendorId = vendorByName[slot.vendorLabel];
    if (!vendorId || slot.vendorId === vendorId) continue;
    await prisma.crmVendorBoq.update({ where: { id: slot.id }, data: { vendorId } });
    linked++;
  }
  return linked;
}

export async function seedCrmComparative(prisma: PrismaClient) {
  const { seedBidVendorCatalog } = await import("../apps/api/src/services/crmVendorCatalog.ts");
  const vendorOut = await seedBidVendorCatalog(prisma);
  console.log("CRM bid vendor catalog:", vendorOut);

  writeComparativeTemplateFile(path.join(process.cwd(), "templates", "Comparative-Statement-R2.xlsx"));

  const office = await prisma.user.findFirst({ where: { email: "office@sharnam.demo" } });
  const officeId = office?.id;
  const demoProject = await prisma.project.findUnique({ where: { code: "SPDC-DEMO-01" } });

  let pkg = await prisma.crmBidPackage.findFirst({
    where: {
      OR: [{ title: DEMO_PACKAGE_TITLE }, { title: "Civil & structural works — R2 demo bid" }],
    },
    include: { vendorBoqs: true },
  });

  if (pkg && demoProject && (!pkg.projectId || pkg.title !== DEMO_PACKAGE_TITLE || !pkg.disciplinesJson)) {
    pkg = await prisma.crmBidPackage.update({
      where: { id: pkg.id },
      data: {
        title: DEMO_PACKAGE_TITLE,
        projectId: demoProject.id,
        disciplinesJson: pkg.disciplinesJson || DEMO_DISCIPLINES_JSON,
        notes: `Linked project: ${demoProject.code} · ${demoProject.name}. Source: Comparative Statement - R2.xlsx`,
      },
      include: { vendorBoqs: true },
    });
  }

  if (demoProject && !demoProject.bidDisciplinesJson) {
    await prisma.project.update({
      where: { id: demoProject.id },
      data: { bidDisciplinesJson: DEMO_DISCIPLINES_JSON },
    });
  }

  if (pkg && demoProject?.code) {
    await mockOneDrive.ensureProjectTree(demoProject.id);
    const sp = await syncComparativeWorkbook(demoProject.code, pkg.revisionLabel || "R2");
    await prisma.crmBidPackage.update({
      where: { id: pkg.id },
      data: { comparativeSharePointUrl: sp.sharePointUrl || sp.url },
    });
  }

  if (pkg) {
    await ensureDemoVendorSlots(prisma, pkg.id);
    pkg = await prisma.crmBidPackage.findUniqueOrThrow({
      where: { id: pkg.id },
      include: { vendorBoqs: true },
    });

    const linked = await backfillDemoVendorIds(prisma, pkg.vendorBoqs);
    if (linked) console.log("CRM comparative vendor links backfilled:", linked);

    if (officeId) {
      await refreshComparativeSheets(prisma, pkg, officeId);
      const forceBoq = process.env.SEED_FORCE_CRM_BOQ !== "0";
      const n = await seedVendorBoqUploads(
        prisma,
        pkg.id,
        officeId,
        pkg.vendorBoqs,
        demoProject?.code,
        forceBoq
      );
      console.log(
        "CRM comparative demo BOQs seeded:",
        n,
        "/",
        pkg.vendorBoqs.length,
        "slots on",
        pkg.title
      );
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
  const vendors = await prisma.vendor.findMany({
    where: { name: { in: DEMO_VENDORS } },
    select: { id: true, name: true },
  });
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v.id]));
  const slots = buildVendorDisciplineSlots(DEMO_VENDORS, DEMO_DISCIPLINES);

  pkg = await prisma.crmBidPackage.create({
    data: {
      title: DEMO_PACKAGE_TITLE,
      leadId: lead?.id ?? null,
      projectId: demoProject?.id ?? null,
      revisionLabel: "R2",
      status: "Evaluation",
      vendorNamesJson: JSON.stringify(DEMO_VENDORS),
      disciplinesJson: DEMO_DISCIPLINES_JSON,
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

  if (demoProject?.code) {
    await mockOneDrive.ensureProjectTree(demoProject.id);
    const sp = await syncComparativeWorkbook(demoProject.code, "R2");
    await prisma.crmBidPackage.update({
      where: { id: pkg.id },
      data: { comparativeSharePointUrl: sp.sharePointUrl || sp.url },
    });
  }

  if (officeId) {
    await refreshComparativeSheets(prisma, pkg, officeId);
    const n = await seedVendorBoqUploads(prisma, pkg.id, officeId, pkg.vendorBoqs, demoProject?.code, true);
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
