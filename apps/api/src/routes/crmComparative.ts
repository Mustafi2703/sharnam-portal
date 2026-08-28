/**
 * CRM Bid & Compare — R2 pattern: summary + master BOQ + per-vendor discipline BOQs.
 */
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import {
  CRM_SHAREPOINT,
  syncBufferToProjectSharePoint,
  syncComparativeWorkbook,
} from "../services/crmSharePoint.js";
import {
  COMPARATIVE_DISCIPLINES,
  type DisciplineDef,
  defaultDisciplines,
  disciplineCatalogEntry,
  importR2WorkbookFromFile,
  parseDisciplineBoqSheet,
  parseDisciplinesJson,
  parseR2SummarySheet,
  pickDisciplineWorksheet,
  resolveDisciplinesForPackage,
  resolveR2TemplatePath,
  buildVendorDisciplineSlots,
  normalizeDisciplineKey,
} from "../services/comparativeStatement.js";
import {
  ensureVendorBoqTemplateSheets,
  recomputeBidPackageComparative,
  vendorCanEditBoqSheet,
} from "../services/crmBidRecompute.js";
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
      project: { select: { id: true, code: true, name: true } },
      vendorBoqs: {
        include: { vendor: { select: { id: true, name: true, email: true } } },
        orderBy: [{ vendorLabel: "asc" }, { discipline: "asc" }],
      },
    },
  });
}

async function resolveProjectForPackage(projectId?: string | null, leadId?: string | null) {
  if (projectId) {
    return prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, code: true, name: true, bidDisciplinesJson: true },
    });
  }
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { projectId: true } });
    if (lead?.projectId) {
      return prisma.project.findUnique({
        where: { id: lead.projectId },
        select: { id: true, code: true, name: true, bidDisciplinesJson: true },
      });
    }
  }
  return null;
}

function packageDisciplines(row: { disciplinesJson?: string | null }) {
  return parseDisciplinesJson(row.disciplinesJson);
}

function parseCustomDisciplines(raw: unknown): DisciplineDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => {
      const row = d as { key?: string; label?: string; sheetName?: string };
      const label = String(row.label || "").trim();
      if (!label) return null;
      const key = normalizeDisciplineKey(row.key || label);
      return { key, label, sheetName: String(row.sheetName || label).trim() };
    })
    .filter(Boolean) as DisciplineDef[];
}

function parseDisciplineKeys(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((x) => normalizeDisciplineKey(String(x))).filter(Boolean);
}

crmComparativeRouter.get("/disciplines", (_req, res) => {
  res.json(COMPARATIVE_DISCIPLINES);
});

crmComparativeRouter.get("/bid-packages", requireRoles("admin", "office"), async (_req, res) => {
  const rows = await prisma.crmBidPackage.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      lead: { select: { id: true, title: true } },
      project: { select: { id: true, code: true, name: true } },
      vendorBoqs: { select: { id: true, vendorLabel: true, discipline: true, fileName: true, uploadedAt: true, sheetId: true } },
    },
  });
  res.json(
    rows.map((r) => ({
      ...r,
      vendorNames: parseVendorNames(r.vendorNamesJson),
      uploadProgress: {
        done: r.vendorBoqs.filter((b) => b.fileName || b.uploadedAt).length,
        total: r.vendorBoqs.length,
      },
    }))
  );
});

crmComparativeRouter.get("/bid-packages/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  let row = await loadBidPackage(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });

  const missingSheets = row.vendorBoqs.some((b) => !b.sheetId);
  if (missingSheets) {
    const vendorNames = parseVendorNames(row.vendorNamesJson);
    const disciplines = packageDisciplines(row);
    await ensureVendorBoqTemplateSheets(prisma, row.id, vendorNames, disciplines, req.user?.id);
    row = (await loadBidPackage(req.params.id))!;
  }

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
    disciplines: packageDisciplines(row),
    summary,
    uploadProgress: {
      done: row.vendorBoqs.filter((b) => b.fileName || b.uploadedAt).length,
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
    select: { id: true, name: true, partyType: true, trade: true },
  });
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v.id]));

  const disciplineKeys = parseDisciplineKeys(req.body.disciplineKeys);
  const customDisciplines = parseCustomDisciplines(req.body.customDisciplines);
  const rev = String(req.body.revisionLabel || "R2");
  const project = await resolveProjectForPackage(
    req.body.projectId ? String(req.body.projectId) : null,
    req.body.leadId ? String(req.body.leadId) : null
  );

  const selectedDisciplines = resolveDisciplinesForPackage({
    disciplineKeys,
    customDisciplines,
    projectDisciplinesJson: project?.bidDisciplinesJson,
  });
  if (!selectedDisciplines.length) {
    return res.status(400).json({ error: "Select at least one discipline BOQ sheet for this package" });
  }

  const imported = importR2WorkbookFromFile(undefined, vendorNames);

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

  const slots = buildVendorDisciplineSlots(vendorNames, selectedDisciplines);

  const pkg = await prisma.crmBidPackage.create({
    data: {
      title,
      leadId: req.body.leadId ? String(req.body.leadId) : null,
      projectId: project?.id ?? null,
      revisionLabel: rev,
      vendorNamesJson: JSON.stringify(vendorNames),
      disciplinesJson: JSON.stringify(selectedDisciplines),
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      notes: req.body.notes
        ? String(req.body.notes)
        : project
          ? `Linked project: ${project.code} · ${project.name}. Source: Comparative Statement - R2.xlsx`
          : null,
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
    include: { vendorBoqs: true, project: { select: { id: true, code: true, name: true } } },
  });

  let comparativeSharePointUrl: string | null = null;
  if (project?.code) {
    try {
      await mockOneDrive.ensureProjectTree(project.id);
      const sp = await syncComparativeWorkbook(project.code, rev);
      comparativeSharePointUrl = sp.sharePointUrl || null;
      if (comparativeSharePointUrl || sp.path) {
        await prisma.crmBidPackage.update({
          where: { id: pkg.id },
          data: { comparativeSharePointUrl: comparativeSharePointUrl || sp.url },
        });
      }
    } catch (err) {
      console.warn("[CRM] comparative SharePoint sync failed:", err instanceof Error ? err.message : err);
    }
  }

  await ensureVendorBoqTemplateSheets(prisma, pkg.id, vendorNames, selectedDisciplines, req.user!.id);

  await audit("crm.comparative.create", {
    userId: req.user!.id,
    entity: "CrmBidPackage",
    entityId: pkg.id,
    meta: { title, vendorNames, summarySheetId: summarySheet.id, masterSheetId: masterSheet.id, disciplines: COMPARATIVE_DISCIPLINES.length },
  });

  const pkgWithSheets = await loadBidPackage(pkg.id);

  res.status(201).json({
    ...pkgWithSheets,
    comparativeSharePointUrl,
    vendorNames,
    disciplines: selectedDisciplines,
    comparativeSheetId: masterSheet.id,
    summarySheetId: summarySheet.id,
    uploadProgress: {
      done: pkgWithSheets?.vendorBoqs.filter((b) => b.sheetId).length ?? 0,
      total: pkgWithSheets?.vendorBoqs.length ?? 0,
    },
  });
});

/** Add discipline BOQ slots to an existing bid package (all vendors get new upload rows). */
crmComparativeRouter.post("/bid-packages/:id/disciplines", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: req.params.id },
    include: { vendorBoqs: { select: { vendorLabel: true, discipline: true } } },
  });
  if (!pkg) return res.status(404).json({ error: "bid package not found" });

  const existing = packageDisciplines(pkg);
  const disciplineKeys = parseDisciplineKeys(req.body.disciplineKeys) || [];
  const customDisciplines = parseCustomDisciplines(req.body.customDisciplines);
  const toAdd = resolveDisciplinesForPackage({ disciplineKeys, customDisciplines }).filter(
    (d) => !existing.some((e) => e.key === d.key)
  );
  if (!toAdd.length) return res.status(400).json({ error: "No new disciplines to add" });

  const vendorNames = parseVendorNames(pkg.vendorNamesJson);
  const vendors = await prisma.vendor.findMany({
    where: { name: { in: vendorNames } },
    select: { id: true, name: true },
  });
  const vendorByName = Object.fromEntries(vendors.map((v) => [v.name, v.id]));

  const merged = [...existing, ...toAdd];
  await prisma.crmBidPackage.update({
    where: { id: pkg.id },
    data: { disciplinesJson: JSON.stringify(merged) },
  });

  const created = await prisma.crmVendorBoq.createMany({
    data: vendorNames.flatMap((vendorLabel) =>
      toAdd.map((d) => ({
        bidPackageId: pkg.id,
        vendorLabel,
        discipline: d.key,
        vendorId: vendorByName[vendorLabel] ?? null,
      }))
    ),
    skipDuplicates: true,
  });

  await audit("crm.comparative.add_disciplines", {
    userId: req.user!.id,
    entity: "CrmBidPackage",
    entityId: pkg.id,
    meta: { added: toAdd.map((d) => d.key), slots: created.count },
  });

  res.json({ disciplines: merged, added: toAdd, slotsCreated: created.count });
});

/** Upload vendor BOQ for a specific discipline (office or matching vendor). */
crmComparativeRouter.post(
  "/bid-packages/:id/vendor-boq/:slotId",
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "BOQ Excel file required" });

    const pkg = await prisma.crmBidPackage.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { id: true, code: true, name: true } } },
    });
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

    const pkgDisciplines = packageDisciplines(pkg);
    const disc = disciplineCatalogEntry(slot.discipline, pkgDisciplines);
    const safeName = `${slot.vendorLabel.replace(/[^a-zA-Z0-9._-]/g, "_")}-${slot.discipline}-BOQ-${Date.now()}.xlsx`;
    const projectCode = pkg.project?.code || "GLOBAL";
    const relFolder = pkg.project?.code
      ? CRM_SHAREPOINT.vendorBoqFolder(slot.vendorLabel)
      : "CRM/BidPackages";
    if (pkg.project?.id) {
      await mockOneDrive.ensureProjectTree(pkg.project.id);
    }
    const saved = await syncBufferToProjectSharePoint(projectCode, relFolder, safeName, req.file.buffer);

    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellFormula: true });
    const ws = pickDisciplineWorksheet(wb, slot.discipline, pkgDisciplines);
    if (!ws) return res.status(400).json({ error: "Could not read BOQ sheet from file" });

    const parsed = parseDisciplineBoqSheet(ws, slot.discipline, pkgDisciplines);

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
        sharePointUrl: saved.sharePointUrl || null,
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

    const recomputed = await recomputeBidPackageComparative(prisma, pkg.id);

    res.json({
      slot: updated,
      boqSheetId: boqSheet.id,
      discipline: slot.discipline,
      storagePath: saved.path,
      sharePointUrl: saved.sharePointUrl,
      projectCode: pkg.project?.code || null,
      summary: recomputed.summary,
      uploadProgress: { done: recomputed.filledSlots, total: recomputed.totalSlots },
    });
  }
);

/** Vendor / office — save in-portal BOQ edits (rates & amounts on R2 template). */
crmComparativeRouter.put(
  "/bid-packages/:id/vendor-boq/:slotId/sheet",
  async (req: AuthedRequest, res) => {
    const pkg = await prisma.crmBidPackage.findUnique({ where: { id: req.params.id } });
    if (!pkg) return res.status(404).json({ error: "bid package not found" });
    if (pkg.status === "Awarded") return res.status(400).json({ error: "Bid package is awarded and locked" });

    const slot = await prisma.crmVendorBoq.findUnique({ where: { id: req.params.slotId } });
    if (!slot || slot.bidPackageId !== pkg.id) return res.status(404).json({ error: "vendor slot not found" });
    if (!slot.sheetId) return res.status(400).json({ error: "No BOQ sheet linked to this slot" });

    const canEdit = await vendorCanEditBoqSheet(prisma, req.user!.role, req.user!.email, slot.sheetId);
    if (!canEdit) return res.status(403).json({ error: "You cannot edit this BOQ sheet" });

    const rows = req.body.rows ? evaluateAllRows(migrateRows(req.body.rows)) : undefined;
    if (!rows) return res.status(400).json({ error: "rows required" });

    await prisma.customSheet.update({
      where: { id: slot.sheetId },
      data: {
        headersJson: req.body.headers ? JSON.stringify(req.body.headers) : undefined,
        rowsJson: JSON.stringify(rows),
      },
    });

    await prisma.crmVendorBoq.update({
      where: { id: slot.id },
      data: {
        uploadedById: req.user!.id,
        uploadedAt: new Date(),
        fileName: slot.fileName || "Filled in portal",
      },
    });

    const recomputed = await recomputeBidPackageComparative(prisma, pkg.id);

    await audit("crm.vendor_boq.save", {
      userId: req.user!.id,
      entity: "CrmVendorBoq",
      entityId: slot.id,
      meta: { bidPackageId: pkg.id, sheetId: slot.sheetId },
    });

    res.json({
      ok: true,
      sheetId: slot.sheetId,
      summary: recomputed.summary,
      uploadProgress: { done: recomputed.filledSlots, total: recomputed.totalSlots },
    });
  }
);

/** Office — refresh comparative summary from all vendor BOQ sheets. */
crmComparativeRouter.post("/bid-packages/:id/recompute", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const result = await recomputeBidPackageComparative(prisma, req.params.id);
    await audit("crm.comparative.recompute", {
      userId: req.user!.id,
      entity: "CrmBidPackage",
      entityId: req.params.id,
      meta: { filledSlots: result.filledSlots, totalSlots: result.totalSlots },
    });
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "recompute failed" });
  }
});

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

/** Vendor / contractor — upload discipline BOQs for assigned bid slots. */
crmComparativeRouter.get("/my-bid-slots", async (req: AuthedRequest, res) => {
  const role = req.user!.role;
  if (role !== "vendor" && role !== "admin" && role !== "office") {
    return res.status(403).json({ error: "Forbidden" });
  }

  let vendorId: string | null = null;
  if (role === "vendor") {
    const v = await prisma.vendor.findFirst({ where: { email: req.user!.email }, select: { id: true, name: true } });
    if (!v) return res.json([]);
    vendorId = v.id;
  }

  const slots = await prisma.crmVendorBoq.findMany({
    where: vendorId ? { vendorId } : undefined,
    include: {
      bidPackage: {
        select: {
          id: true,
          title: true,
          status: true,
          revisionLabel: true,
          notes: true,
          disciplinesJson: true,
          comparativeSharePointUrl: true,
          summarySheetId: true,
          comparativeSheetId: true,
          project: { select: { id: true, code: true, name: true } },
        },
      },
      vendor: { select: { id: true, name: true } },
    },
    orderBy: [{ bidPackage: { updatedAt: "desc" } }, { discipline: "asc" }],
  });

  res.json(
    slots.map((s) => {
      const pkgDisc = parseDisciplinesJson(s.bidPackage.disciplinesJson);
      return {
        id: s.id,
        bidPackageId: s.bidPackageId,
        bidPackageTitle: s.bidPackage.title,
        bidPackageStatus: s.bidPackage.status,
        revisionLabel: s.bidPackage.revisionLabel,
        projectNote: s.bidPackage.notes,
        projectId: s.bidPackage.project?.id || null,
        projectCode: s.bidPackage.project?.code || null,
        projectName: s.bidPackage.project?.name || null,
        comparativeSharePointUrl: s.bidPackage.comparativeSharePointUrl,
        summarySheetId: s.bidPackage.summarySheetId,
        comparativeSheetId: s.bidPackage.comparativeSheetId,
        vendorLabel: s.vendorLabel,
        discipline: s.discipline,
        disciplineLabel:
          disciplineCatalogEntry(s.discipline, pkgDisc)?.label ||
          COMPARATIVE_DISCIPLINES.find((d) => d.key === s.discipline)?.label ||
          s.discipline,
        fileName: s.fileName,
        uploadedAt: s.uploadedAt,
        sharePointUrl: s.sharePointUrl,
        sheetId: s.sheetId,
      };
    })
  );
});

/** Vendor — comparative summary for a bid package they participate in. */
crmComparativeRouter.get("/my-bid-packages/:id/summary", async (req: AuthedRequest, res) => {
  const role = req.user!.role;
  if (role !== "vendor" && role !== "admin" && role !== "office") {
    return res.status(403).json({ error: "Forbidden" });
  }

  let vendorId: string | null = null;
  if (role === "vendor") {
    const v = await prisma.vendor.findFirst({ where: { email: req.user!.email }, select: { id: true, name: true } });
    if (!v) return res.status(404).json({ error: "vendor profile not found" });
    vendorId = v.id;
  }

  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: req.params.id },
    include: {
      project: { select: { id: true, code: true, name: true } },
      vendorBoqs: vendorId ? { where: { vendorId }, select: { id: true } } : { select: { id: true } },
    },
  });
  if (!pkg) return res.status(404).json({ error: "bid package not found" });
  if (role === "vendor" && !pkg.vendorBoqs.length) {
    return res.status(403).json({ error: "You are not assigned to this bid package" });
  }

  let summary = null;
  if (pkg.summarySheetId) {
    const sheet = await prisma.customSheet.findUnique({ where: { id: pkg.summarySheetId } });
    if (sheet) {
      const headers = JSON.parse(sheet.headersJson || "[]");
      const rows = parseRowsJson(sheet.rowsJson);
      summary = parseR2SummarySheet(headers, rows);
    }
  }

  const mySlots = vendorId
    ? await prisma.crmVendorBoq.findMany({
        where: { bidPackageId: pkg.id, vendorId },
        select: { id: true, discipline: true, fileName: true, sheetId: true, uploadedAt: true, sharePointUrl: true },
        orderBy: { discipline: "asc" },
      })
    : [];

  res.json({
    id: pkg.id,
    title: pkg.title,
    revisionLabel: pkg.revisionLabel,
    status: pkg.status,
    project: pkg.project,
    comparativeSharePointUrl: pkg.comparativeSharePointUrl,
    summarySheetId: pkg.summarySheetId,
    comparativeSheetId: pkg.comparativeSheetId,
    summary,
    myVendorLabel: role === "vendor" ? (await prisma.vendor.findUnique({ where: { id: vendorId! }, select: { name: true } }))?.name : null,
    mySlots: mySlots.map((s) => ({
      ...s,
      disciplineLabel: COMPARATIVE_DISCIPLINES.find((d) => d.key === s.discipline)?.label || s.discipline,
    })),
    uploadProgress: {
      done: mySlots.filter((s) => s.fileName).length,
      total: mySlots.length,
    },
  });
});

/** Download official Comparative Statement R2 workbook. */
crmComparativeRouter.get("/template.xlsx", requireRoles("admin", "office", "vendor"), (_req, res) => {
  const src = resolveR2TemplatePath();
  res.download(src, "Comparative-Statement-R2.xlsx");
});

/**
 * Seed a demo bid package so the client can see a fully-populated Comparative
 * Statement at UAT without waiting for real vendor quotes.  Creates three
 * vendors (Alpha, Bharat, Concord), a synthetic BOQ across three disciplines,
 * pre-computed section totals, and marks the lowest quote per line.  Safe to
 * run multiple times — always creates a new package (never overwrites real
 * client data).
 */
crmComparativeRouter.post(
  "/bid-packages/seed-demo",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const projectId = req.body?.projectId ? String(req.body.projectId) : null;
    const project = projectId
      ? await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, code: true, name: true } })
      : null;

    const vendorSeeds = [
      { name: "Alpha Constructions Pvt Ltd", trade: "Civil / Structural", contact: "Rajesh Mehta" },
      { name: "Bharat Builders LLP", trade: "Civil + MEP", contact: "Suresh Iyer" },
      { name: "Concord Infra Solutions", trade: "General Contractor", contact: "Anita Kulkarni" },
    ];
    const vendorRecords: { id: string; name: string }[] = [];
    for (const v of vendorSeeds) {
      const existing = await prisma.vendor.findFirst({ where: { name: v.name } });
      if (existing) {
        vendorRecords.push({ id: existing.id, name: existing.name });
      } else {
        const created = await prisma.vendor.create({
          data: {
            name: v.name,
            partyType: "Contractor",
            trade: v.trade,
            primaryContactName: v.contact,
            isPrequalified: true,
            createdVia: "SeedDemo",
          },
        });
        vendorRecords.push({ id: created.id, name: created.name });
      }
    }
    const vendorNames = vendorRecords.map((v) => v.name);
    const vendorByName = Object.fromEntries(vendorRecords.map((v) => [v.name, v.id]));

    const disciplines: DisciplineDef[] = [
      { key: "CCV", label: "Civil & Structural (CCV)", sheetName: "BOQ-CCV" },
      { key: "ELE_LAB", label: "Electrical Lab", sheetName: "BOQ ELE. LAB" },
      { key: "ADMIN", label: "Admin Building", sheetName: "BOQ-ADMIN" },
    ];

    /** Deterministic demo line items — realistic INR pricing with 5–15% vendor spread. */
    type LineItem = { code: string; description: string; unit: string; qty: number; base: number; discipline: string };
    const lines: LineItem[] = [
      { code: "1.1", description: "PCC 1:3:6 in foundation", unit: "cum", qty: 320, base: 6800, discipline: "CCV" },
      { code: "1.2", description: "RCC M-30 in footings and pedestals", unit: "cum", qty: 640, base: 8950, discipline: "CCV" },
      { code: "1.3", description: "Reinforcement TMT Fe-550D — supply, cut, bend and fix", unit: "MT", qty: 128, base: 78500, discipline: "CCV" },
      { code: "1.4", description: "Structural steel fabrication and erection (columns + purlins)", unit: "MT", qty: 92, base: 122000, discipline: "CCV" },
      { code: "2.1", description: "LT panel — TPN 630A with digital metering, RYB indication", unit: "no", qty: 4, base: 285000, discipline: "ELE_LAB" },
      { code: "2.2", description: "Cable trays perforated 300 x 50 x 2.0 mm hot-dip galvanised", unit: "rm", qty: 460, base: 1250, discipline: "ELE_LAB" },
      { code: "2.3", description: "LED high-bay 150 W with driver, IP-65 body", unit: "no", qty: 48, base: 6900, discipline: "ELE_LAB" },
      { code: "3.1", description: "Aluminium glazing — 2-track sliding, 5 mm toughened glass", unit: "sqm", qty: 210, base: 5400, discipline: "ADMIN" },
      { code: "3.2", description: "Vitrified floor tile 800 x 800 mm with epoxy grout", unit: "sqm", qty: 640, base: 1450, discipline: "ADMIN" },
      { code: "3.3", description: "False ceiling — mineral fibre 600 x 600 mm on GI grid", unit: "sqm", qty: 520, base: 1050, discipline: "ADMIN" },
    ];
    /** Vendor spread multipliers — Alpha lowest for civil, Bharat lowest for elec, Concord premium. */
    const spread: Record<string, Record<string, number>> = {
      CCV: { "Alpha Constructions Pvt Ltd": 1.0, "Bharat Builders LLP": 1.06, "Concord Infra Solutions": 1.09 },
      ELE_LAB: { "Alpha Constructions Pvt Ltd": 1.08, "Bharat Builders LLP": 1.0, "Concord Infra Solutions": 1.04 },
      ADMIN: { "Alpha Constructions Pvt Ltd": 1.05, "Bharat Builders LLP": 1.03, "Concord Infra Solutions": 1.0 },
    };

    const sectionMap = new Map<string, { title: string; totals: Record<string, number> }>();
    for (const d of disciplines) sectionMap.set(d.key, { title: d.label, totals: Object.fromEntries(vendorNames.map((n) => [n, 0])) });
    for (const l of lines) {
      const rowTotals = sectionMap.get(l.discipline)!.totals;
      for (const v of vendorNames) {
        const rate = Math.round(l.base * (spread[l.discipline]?.[v] ?? 1.0));
        rowTotals[v] += rate * l.qty;
      }
    }
    const sectionTotals = Array.from(sectionMap.entries()).map(([section, val]) => ({
      section,
      title: val.title,
      totals: val.totals,
    }));
    const grandTotals: Record<string, number> = Object.fromEntries(vendorNames.map((n) => [n, 0]));
    for (const s of sectionTotals) for (const v of vendorNames) grandTotals[v] += s.totals[v];
    const lowestVendor = vendorNames.reduce((lo, v) => (grandTotals[v] < grandTotals[lo] ? v : lo), vendorNames[0]);

    // Build a canonical summary sheet the existing GET /bid-packages/:id endpoint will parse.
    const cell = (v: string | number): SheetCell => ({ raw: String(v ?? ""), computed: v });

    const summaryHeaders = ["Section", "Description", ...vendorNames, "Lowest"];
    const summaryRows: SheetCell[][] = [];
    for (const s of sectionTotals) {
      const rowVals: (string | number)[] = [s.section, s.title];
      for (const v of vendorNames) rowVals.push(s.totals[v]);
      const lowV = vendorNames.reduce((lo, v) => (s.totals[v] < s.totals[lo] ? v : lo), vendorNames[0]);
      rowVals.push(lowV);
      summaryRows.push(rowVals.map(cell));
    }
    const grandRow: (string | number)[] = ["TOTAL", "Grand total"];
    for (const v of vendorNames) grandRow.push(grandTotals[v]);
    grandRow.push(lowestVendor);
    summaryRows.push(grandRow.map(cell));

    const masterHeaders = ["Section", "Item code", "Description", "Unit", "Qty", ...vendorNames, "Lowest"];
    const masterRows: SheetCell[][] = lines.map((l) => {
      const rates = vendorNames.map((v) => Math.round(l.base * (spread[l.discipline]?.[v] ?? 1.0)) * l.qty);
      const idxLow = rates.reduce((iLo, val, i) => (val < rates[iLo] ? i : iLo), 0);
      return [l.discipline, l.code, l.description, l.unit, l.qty, ...rates, vendorNames[idxLow]].map(cell);
    });

    const summarySheet = await prisma.customSheet.create({
      data: {
        name: `Summary — Demo Comparative (R2)`,
        category: "CRM Comparative Summary",
        headersJson: JSON.stringify(summaryHeaders),
        rowsJson: JSON.stringify(summaryRows),
        sourceFile: "seed-demo",
        createdById: req.user!.id,
      },
    });
    const masterSheet = await prisma.customSheet.create({
      data: {
        name: `Master BOQ Compare — Demo Comparative (R2)`,
        category: "CRM Comparative BOQ",
        headersJson: JSON.stringify(masterHeaders),
        rowsJson: JSON.stringify(masterRows),
        sourceFile: "seed-demo",
        createdById: req.user!.id,
      },
    });

    const title = project ? `Demo Package — ${project.code}` : "Demo Package — Sample Comparative";
    const pkg = await prisma.crmBidPackage.create({
      data: {
        title,
        projectId: project?.id ?? null,
        revisionLabel: "R2",
        vendorNamesJson: JSON.stringify(vendorNames),
        disciplinesJson: JSON.stringify(disciplines),
        notes: `Auto-generated demo · 3 vendors × 3 disciplines · lowest = ${lowestVendor}`,
        comparativeSheetId: masterSheet.id,
        summarySheetId: summarySheet.id,
        vendorBoqs: {
          create: vendorNames.flatMap((vendorLabel) =>
            disciplines.map((d) => ({
              vendorLabel,
              discipline: d.key,
              vendorId: vendorByName[vendorLabel] ?? null,
              fileName: `${vendorLabel.split(" ")[0]}-${d.key}-demo.xlsx`,
              uploadedAt: new Date(),
              uploadedById: req.user!.id,
            }))
          ),
        },
      },
      include: { vendorBoqs: true, project: { select: { id: true, code: true, name: true } } },
    });

    await audit("crm.comparative.seed_demo", {
      userId: req.user!.id,
      entity: "CrmBidPackage",
      entityId: pkg.id,
      meta: { vendorNames, disciplines: disciplines.map((d) => d.key), grandTotals, lowestVendor },
    });

    res.status(201).json({
      ...pkg,
      vendorNames,
      disciplines,
      summary: { vendorLabels: vendorNames, sectionTotals, grandTotals, lowestVendor },
    });
  }
);
