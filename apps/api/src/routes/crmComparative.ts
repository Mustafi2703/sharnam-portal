/**
 * CRM Bid & Compare — R2 pattern: summary + master BOQ + per-vendor discipline BOQs.
 */
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import {
  COMPARATIVE_DISCIPLINES,
  importR2WorkbookFromFile,
  parseDisciplineBoqSheet,
  parseR2SummarySheet,
  pickDisciplineWorksheet,
  resolveR2TemplatePath,
  buildVendorDisciplineSlots,
} from "../services/comparativeStatement.js";
import { evaluateAllRows, migrateRows, type SheetCell } from "@sharnam/shared";

export const crmComparativeRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

crmComparativeRouter.use(requireAuth);

function parseVendorNames(json: string): string[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function parseRowsJson(json: string): SheetCell[][] {
  try {
    return evaluateAllRows(migrateRows(JSON.parse(json || "[]")));
  } catch {
    return [];
  }
}

async function createSheetFromImport(
  name: string,
  category: string,
  imported: { headers: string[]; rows: SheetCell[][]; sheetName: string },
  createdById?: string,
  sourceFile?: string
) {
  return prisma.customSheet.create({
    data: {
      name,
      category,
      headersJson: JSON.stringify(imported.headers),
      rowsJson: JSON.stringify(imported.rows),
      sourceFile: sourceFile || imported.sheetName,
      createdById,
    },
  });
}

async function loadBidPackage(id: string) {
  return prisma.crmBidPackage.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, title: true, stage: true } },
      vendorBoqs: {
        include: { vendor: { select: { id: true, name: true, email: true } } },
        orderBy: [{ vendorLabel: "asc" }, { discipline: "asc" }],
      },
    },
  });
}

crmComparativeRouter.get("/disciplines", (_req, res) => {
  res.json(COMPARATIVE_DISCIPLINES);
});

crmComparativeRouter.get("/bid-packages", requireRoles("admin", "office"), async (_req, res) => {
  const rows = await prisma.crmBidPackage.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      lead: { select: { id: true, title: true } },
      vendorBoqs: { select: { id: true, vendorLabel: true, discipline: true, fileName: true, uploadedAt: true } },
    },
  });
  res.json(
    rows.map((r) => ({
      ...r,
      vendorNames: parseVendorNames(r.vendorNamesJson),
      uploadProgress: {
        done: r.vendorBoqs.filter((b) => b.fileName).length,
        total: r.vendorBoqs.length,
      },
    }))
  );
});

crmComparativeRouter.get("/bid-packages/:id", requireRoles("admin", "office"), async (req, res) => {
  const row = await loadBidPackage(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });

  let summary = null;
  if (row.summarySheetId) {
    const sheet = await prisma.customSheet.findUnique({ where: { id: row.summarySheetId } });
    if (sheet) {
      const headers = JSON.parse(sheet.headersJson || "[]");
      const rows = parseRowsJson(sheet.rowsJson);
      summary = parseR2SummarySheet(headers, rows);
    }
  }

  res.json({
    ...row,
    vendorNames: parseVendorNames(row.vendorNamesJson),
    disciplines: COMPARATIVE_DISCIPLINES,
    summary,
    uploadProgress: {
      done: row.vendorBoqs.filter((b) => b.fileName).length,
      total: row.vendorBoqs.length,
    },
  });
});

crmComparativeRouter.post("/bid-packages", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const title = String(req.body.title || "").trim();
  const vendorNames: string[] = Array.isArray(req.body.vendorNames)
    ? req.body.vendorNames.map((x: unknown) => String(x)).filter(Boolean)
    : [];
  if (!title) return res.status(400).json({ error: "title required" });
  if (vendorNames.length < 2) return res.status(400).json({ error: "At least 2 vendors required for comparison" });

  const vendors = await prisma.vendor.findMany({
    where: { name: { in: vendorNames } },
    select: { id: true, name: true },
  });
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v.id]));

  const imported = importR2WorkbookFromFile(undefined, vendorNames);
  const rev = String(req.body.revisionLabel || "R2");

  const summarySheet = await createSheetFromImport(
    `Summary — ${title} (${rev})`,
    "CRM Comparative Summary",
    imported.summary,
    req.user!.id,
    "Comparative Statement - R2.xlsx"
  );
  const masterSheet = await createSheetFromImport(
    `Master BOQ Compare — ${title} (${rev})`,
    "CRM Comparative BOQ",
    imported.masterBoq,
    req.user!.id,
    "Comparative Statement - R2.xlsx"
  );

  const slots = buildVendorDisciplineSlots(vendorNames);

  const pkg = await prisma.crmBidPackage.create({
    data: {
      title,
      leadId: req.body.leadId ? String(req.body.leadId) : null,
      revisionLabel: rev,
      vendorNamesJson: JSON.stringify(vendorNames),
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      notes: req.body.notes ? String(req.body.notes) : null,
      comparativeSheetId: masterSheet.id,
      summarySheetId: summarySheet.id,
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

  await audit("crm.comparative.create", {
    userId: req.user!.id,
    entity: "CrmBidPackage",
    entityId: pkg.id,
    meta: { title, vendorNames, summarySheetId: summarySheet.id, masterSheetId: masterSheet.id, disciplines: COMPARATIVE_DISCIPLINES.length },
  });

  res.status(201).json({
    ...pkg,
    vendorNames,
    disciplines: COMPARATIVE_DISCIPLINES,
    comparativeSheetId: masterSheet.id,
    summarySheetId: summarySheet.id,
  });
});

/** Upload vendor BOQ for a specific discipline (office or matching vendor). */
crmComparativeRouter.post(
  "/bid-packages/:id/vendor-boq/:slotId",
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "BOQ Excel file required" });

    const pkg = await prisma.crmBidPackage.findUnique({ where: { id: req.params.id } });
    if (!pkg) return res.status(404).json({ error: "bid package not found" });

    const slot = await prisma.crmVendorBoq.findUnique({ where: { id: req.params.slotId } });
    if (!slot || slot.bidPackageId !== pkg.id) return res.status(404).json({ error: "vendor slot not found" });

    const isOffice = req.user!.role === "admin" || req.user!.role === "office";
    if (!isOffice && req.user!.role === "vendor") {
      const vendorUser = await prisma.vendor.findFirst({
        where: { email: req.user!.email },
        select: { id: true },
      });
      if (!vendorUser?.id || slot.vendorId !== vendorUser.id) {
        return res.status(403).json({ error: "You can only upload BOQ for your assigned vendor slot" });
      }
    } else if (!isOffice) {
      return res.status(403).json({ error: "Office access required" });
    }

    const disc = COMPARATIVE_DISCIPLINES.find((d) => d.key === slot.discipline);
    const safeName = `${slot.vendorLabel.replace(/[^a-zA-Z0-9._-]/g, "_")}-${slot.discipline}-BOQ-${Date.now()}.xlsx`;
    const saved = await mockOneDrive.upload("GLOBAL", "CRM/BidPackages", safeName, req.file.buffer);

    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellFormula: true });
    const ws = pickDisciplineWorksheet(wb, slot.discipline);
    if (!ws) return res.status(400).json({ error: "Could not read BOQ sheet from file" });

    const parsed = parseDisciplineBoqSheet(ws, slot.discipline);

    const boqSheet = await prisma.customSheet.create({
      data: {
        name: `${slot.vendorLabel} — ${disc?.label || slot.discipline} — ${pkg.title}`,
        category: "CRM Vendor BOQ",
        headersJson: JSON.stringify(parsed.headers),
        rowsJson: JSON.stringify(parsed.rows),
        sourceFile: req.file.originalname,
        storagePath: saved.path,
        createdById: req.user!.id,
      },
    });

    const updated = await prisma.crmVendorBoq.update({
      where: { id: slot.id },
      data: {
        fileName: req.file.originalname,
        storagePath: saved.path,
        sheetId: boqSheet.id,
        uploadedById: req.user!.id,
        uploadedAt: new Date(),
      },
    });

    await audit("crm.vendor_boq.upload", {
      userId: req.user!.id,
      entity: "CrmVendorBoq",
      entityId: slot.id,
      meta: {
        bidPackageId: pkg.id,
        vendorLabel: slot.vendorLabel,
        discipline: slot.discipline,
        fileName: req.file.originalname,
      },
    });

    res.json({ slot: updated, boqSheetId: boqSheet.id, discipline: slot.discipline, storagePath: saved.path });
  }
);

crmComparativeRouter.post("/bid-packages/:id/award", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const vendorId = String(req.body.vendorId || "").trim();
  const vendorLabel = String(req.body.vendorLabel || "").trim();
  if (!vendorId && !vendorLabel) return res.status(400).json({ error: "vendorId or vendorLabel required" });

  const pkg = await prisma.crmBidPackage.update({
    where: { id: req.params.id },
    data: { status: "Awarded", awardedVendorId: vendorId || undefined },
  });

  await audit("crm.comparative.award", {
    userId: req.user!.id,
    entity: "CrmBidPackage",
    entityId: pkg.id,
    meta: { vendorId, vendorLabel },
  });

  res.json(pkg);
});

/** Download official Comparative Statement R2 workbook. */
crmComparativeRouter.get("/template.xlsx", requireRoles("admin", "office"), (_req, res) => {
  const src = resolveR2TemplatePath();
  res.download(src, "Comparative-Statement-R2.xlsx");
});
