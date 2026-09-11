// @ts-nocheck — schema field access on many domain models; typed at the boundary.
/**
 * WPR maker — one editable pack per project × weekEnding.
 *
 * Endpoints:
 *   GET  /api/wpr-maker/:projectId?end=YYYY-MM-DD
 *   POST /api/wpr-maker/:projectId/save         body: { weekEnding, reportNumber, header, sections }
 *   GET  /api/wpr-maker/:projectId/download.xlsx?end=...
 *   POST /api/wpr-maker/:projectId/publish      body: { weekEnding }
 *   GET  /api/wpr-maker/:projectId/recent
 *
 * On first open of a given week, sections are auto-seeded from live data
 * (Communication Matrix, Milestones, RFIs, QAP, Safety, PurchaseOrder,
 * Cashflow, Cube tests, Hindrance, Risk, Legal, Drawings, Submittals).
 * The editor may then override any section text or rows.
 */
import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { userCanAccessProject } from "../modules/_shared/projectAccess.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "../services/graph.js";
import { audit } from "../services/audit.js";
import {
  buildWprWorkbook,
  DEFAULT_WPR_TITLES,
  type WprHeader,
  type WprSection,
  type WprSections,
} from "../services/wprXlsx.js";
import { buildWprPptx } from "../services/wprPptx.js";
import { seedWprSections } from "../services/wprSeedSections.js";
import { snapWeekEnding } from "../services/wprDemoSeed.js";
import { loadWprChartPack } from "../services/wprCharts.js";
import { mergeWprChartsForExport } from "../services/wprChartMerge.js";

export type WprDateRange = { start: Date; end: Date; weekEnd: Date; preset: string };

export function parseWprDateRange(query: {
  end?: unknown;
  start?: unknown;
  preset?: unknown;
}): WprDateRange {
  const preset = String(query.preset || "week").toLowerCase();
  const endRaw = query.end ? new Date(String(query.end)) : new Date();
  const end = snapWeekEnding(Number.isNaN(endRaw.getTime()) ? new Date() : endRaw);

  if (query.start) {
    const start = new Date(String(query.start));
    start.setHours(0, 0, 0, 0);
    if (!Number.isNaN(start.getTime()) && start <= end) {
      return { start, end, weekEnd: end, preset: "custom" };
    }
  }

  const start = new Date(end);
  if (preset === "last14") start.setDate(end.getDate() - 13);
  else if (preset === "last28") start.setDate(end.getDate() - 27);
  else if (preset === "last56") start.setDate(end.getDate() - 55);
  else start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end, weekEnd: end, preset };
}

export const wprMakerRouter = Router();
wprMakerRouter.use(requireAuth);
wprMakerRouter.param("projectId", async (req: AuthedRequest, res, next, projectId) => {
  try {
    const ok = await userCanAccessProject(req, String(projectId));
    if (!ok) return res.status(404).json({ error: "Not found" });
    next();
  } catch (err) {
    next(err);
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function parseEnd(v: unknown): Date {
  return parseWprDateRange({ end: v }).weekEnd;
}

/** Resolve reporting window from download/publish query (respects preset + start). */
function rangeFromQuery(query: Record<string, unknown>): WprDateRange {
  return parseWprDateRange({
    end: query.end,
    start: query.start,
    preset: query.preset,
  });
}

async function buildWprExportPack(
  projectId: string,
  range: WprDateRange,
  existingSections?: WprSections
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  const { start: weekStart, end: weekEnd } = range;
  const existing = await prisma.wprSnapshot.findUnique({
    where: { projectId_weekEnding: { projectId, weekEnding: weekEnd } },
  });
  const header: WprHeader = {
    projectName: project.name,
    projectCode: project.code,
    reportNumber: existing?.reportNumber || undefined,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    clientName: project.clientName || "",
    designConsultant: project.designConsultant || "",
    contractorName: project.contractorName || "",
    location: project.location || "",
    pmc: "Sharnam Project Development Consultants & Co.",
  };
  const sectionsRaw: WprSections =
    existingSections ||
    (existing ? JSON.parse(existing.sectionsJson || "{}") : await seedSections(projectId, weekStart, weekEnd));
  const { sections, extras: packExtras } = stripPackExtras(sectionsRaw);
  const chartsRaw = await loadWprChartPack(prisma, projectId, weekStart, weekEnd);
  const charts = mergeWprChartsForExport(
    sections,
    chartsRaw,
    weekStart.toISOString().slice(0, 10),
    weekEnd.toISOString().slice(0, 10)
  );
  return { project, weekStart, weekEnd, header, sections, charts, existing, packExtras };
}

async function seedSections(projectId: string, weekStart: Date, weekEnd: Date): Promise<WprSections> {
  return seedWprSections(prisma, projectId, weekStart, weekEnd);
}

async function upsertWprDraft(
  projectId: string,
  weekEnd: Date,
  sections: WprSections,
  reportNumber: number | undefined,
  userId: string
) {
  return prisma.wprSnapshot.upsert({
    where: { projectId_weekEnding: { projectId, weekEnding: weekEnd } },
    create: {
      projectId,
      weekEnding: weekEnd,
      reportNumber: reportNumber ?? null,
      sectionsJson: JSON.stringify(sections),
      status: "Draft",
      createdById: userId,
    },
    update: {
      sectionsJson: JSON.stringify(sections),
      reportNumber: reportNumber ?? undefined,
      updatedAt: new Date(),
    },
  });
}

const WPR_PACK_EXTRAS_KEY = "__packExtras";

type WprPackExtras = {
  attachments?: { path: string; caption?: string; url?: string }[];
  signatures?: { path: string; role: string; url?: string }[];
};

function stripPackExtras(raw: WprSections): { sections: WprSections; extras: WprPackExtras | null } {
  const copy = { ...raw };
  const extras = (copy[WPR_PACK_EXTRAS_KEY] as WprPackExtras | undefined) || null;
  delete copy[WPR_PACK_EXTRAS_KEY];
  return { sections: copy, extras };
}

function mergePackExtras(sections: WprSections, extras?: WprPackExtras | null): WprSections {
  if (!extras?.attachments?.length && !extras?.signatures?.length) return sections;
  return { ...sections, [WPR_PACK_EXTRAS_KEY]: extras };
}


wprMakerRouter.get("/:projectId", async (req, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const range = parseWprDateRange({
    end: req.query.end,
    start: req.query.start,
    preset: req.query.preset,
  });
  const { start: weekStart, end: weekEnd } = range;

  const existing = await prisma.wprSnapshot.findUnique({
    where: { projectId_weekEnding: { projectId, weekEnding: weekEnd } },
  });

  const header: WprHeader = {
    projectName: project.name,
    projectCode: project.code,
    reportNumber: existing?.reportNumber || undefined,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    clientName: project.clientName || "",
    designConsultant: project.designConsultant || "",
    contractorName: project.contractorName || "",
    location: project.location || "",
    pmc: "Sharnam Project Development Consultants & Co.",
  };
  const rawSections: WprSections = existing
    ? JSON.parse(existing.sectionsJson || "{}")
    : await seedSections(projectId, weekStart, weekEnd);
  const { sections, extras: packExtras } = stripPackExtras(rawSections);

  const chartsRaw = await loadWprChartPack(prisma, projectId, weekStart, weekEnd);
  const charts = mergeWprChartsForExport(
    sections,
    chartsRaw,
    weekStart.toISOString().slice(0, 10),
    weekEnd.toISOString().slice(0, 10)
  );

  res.json({
    projectId,
    projectCode: project.code,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    rangePreset: range.preset,
    reportNumber: existing?.reportNumber,
    header,
    sections,
    packExtras,
    charts,
    status: existing?.status || "Draft",
    publishedAt: existing?.publishedAt,
    publishedPath: existing?.publishedPath,
    publishedUrl: existing?.publishedUrl,
  });
});

/** Re-build all WPR sections from live portal data for the selected date window. */
wprMakerRouter.post("/:projectId/refresh", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });

  const range = parseWprDateRange({
    end: req.body.weekEnding ?? req.body.end,
    start: req.body.start,
    preset: req.body.preset,
  });
  const { start: weekStart, end: weekEnd } = range;
  const sections = await seedSections(projectId, weekStart, weekEnd);
  const chartsRaw = await loadWprChartPack(prisma, projectId, weekStart, weekEnd);
  const charts = mergeWprChartsForExport(
    sections,
    chartsRaw,
    weekStart.toISOString().slice(0, 10),
    weekEnd.toISOString().slice(0, 10)
  );
  const reportNumber = req.body.reportNumber != null ? Number(req.body.reportNumber) : undefined;

  const saved = await prisma.wprSnapshot.upsert({
    where: { projectId_weekEnding: { projectId, weekEnding: weekEnd } },
    create: {
      projectId,
      weekEnding: weekEnd,
      reportNumber: reportNumber ?? null,
      sectionsJson: JSON.stringify(sections),
      status: "Draft",
      createdById: req.user!.id,
    },
    update: {
      sectionsJson: JSON.stringify(sections),
      reportNumber: reportNumber ?? undefined,
      updatedAt: new Date(),
    },
  });

  await audit("wpr.refreshed", {
    userId: req.user!.id,
    entity: "WprSnapshot",
    entityId: saved.id,
    meta: {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      preset: range.preset,
      sections: Object.keys(sections).length,
    },
  });

  res.json({
    ok: true,
    id: saved.id,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    rangePreset: range.preset,
    sections,
    charts,
    status: saved.status,
  });
});

/** Load the client 23–29 July WPR + budget / PR / materials workbooks into this project week. */
wprMakerRouter.post("/:projectId/import-july", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const { buildJulyWprPack } = await import("../services/wprJulyWorkbook.js");
  const pack = buildJulyWprPack();
  const weekEnd = snapWeekEnding(new Date(`${pack.header.weekEnd || "2026-07-29"}T12:00:00`));
  const weekStart = new Date(`${pack.header.weekStart || "2026-07-23"}T00:00:00`);
  weekStart.setHours(0, 0, 0, 0);
  const existing = await prisma.wprSnapshot.findUnique({
    where: { projectId_weekEnding: { projectId, weekEnding: weekEnd } },
  });
  const prior = existing ? stripPackExtras(JSON.parse(existing.sectionsJson || "{}")).extras : null;
  const stored = mergePackExtras(pack.sections, prior);
  const saved = await upsertWprDraft(
    projectId,
    weekEnd,
    stored,
    pack.header.reportNumber,
    req.user!.id
  );
  await audit("wpr.import_july", {
    userId: req.user!.id,
    entity: "WprSnapshot",
    entityId: saved.id,
    meta: { weekEnd: weekEnd.toISOString(), sections: Object.keys(pack.sections).length },
  });
  res.json({
    ok: true,
    id: saved.id,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    header: { ...pack.header, projectName: project.name || pack.header.projectName, projectCode: project.code },
    sections: pack.sections,
    charts: pack.charts,
    packExtras: prior,
    reportNumber: pack.header.reportNumber,
    status: saved.status,
  });
});

wprMakerRouter.post("/:projectId/save", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const weekEnd = parseEnd(req.body.weekEnding);
  const sections: WprSections = req.body.sections || {};
  const packExtras: WprPackExtras | undefined = req.body.packExtras;
  const reportNumber = req.body.reportNumber != null ? Number(req.body.reportNumber) : undefined;
  const stored = mergePackExtras(sections, packExtras);

  const saved = await upsertWprDraft(projectId, weekEnd, stored, reportNumber, req.user!.id);

  await audit("wpr.saved", {
    userId: req.user!.id,
    entity: "WprSnapshot",
    entityId: saved.id,
    meta: { weekEnding: weekEnd.toISOString(), sections: Object.keys(sections).length },
  });

  res.json({ id: saved.id, status: saved.status });
});

wprMakerRouter.get("/:projectId/download.xlsx", async (req, res) => {
  const projectId = req.params.projectId;
  const range = rangeFromQuery(req.query as Record<string, unknown>);
  const pack = await buildWprExportPack(projectId, range);
  if (!pack) return res.status(404).json({ error: "project not found" });
  const buf = await buildWprWorkbook({ header: pack.header, sections: pack.sections, charts: pack.charts });
  const fname = `WPR-${pack.project.code}-${range.weekEnd.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

/** Client workbook — fills WPR File.xlsx template tabs (21 sheets) from live data. */
wprMakerRouter.get("/:projectId/download-client.xlsx", async (req, res) => {
  const projectId = req.params.projectId;
  const range = rangeFromQuery(req.query as Record<string, unknown>);
  const pack = await buildWprExportPack(projectId, range);
  if (!pack) return res.status(404).json({ error: "project not found" });
  const { buildWprClientWorkbook } = await import("../services/wprClientPack.js");
  const buf = await buildWprClientWorkbook(prisma, projectId, pack.weekStart, pack.weekEnd);
  const fname = `WPR-ClientPack-${pack.project.code}-${range.weekEnd.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

wprMakerRouter.get("/:projectId/download.pptx", async (req, res) => {
  const projectId = req.params.projectId;
  const range = rangeFromQuery(req.query as Record<string, unknown>);
  const pack = await buildWprExportPack(projectId, range);
  if (!pack) return res.status(404).json({ error: "project not found" });
  const buf = await buildWprPptx({
    header: pack.header,
    sections: pack.sections,
    charts: pack.charts,
    packExtras: pack.packExtras || undefined,
  });
  const fname = `WPR-${pack.project.code}-${range.weekEnd.toISOString().slice(0, 10)}.pptx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

wprMakerRouter.post("/:projectId/publish", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const range = parseWprDateRange({
    end: req.body.weekEnding ?? req.body.end,
    start: req.body.start,
    preset: req.body.preset,
  });
  const weekEnd = range.weekEnd;

  if (req.body.sections) {
    const stored = mergePackExtras(req.body.sections, req.body.packExtras);
    const reportNumber = req.body.reportNumber != null ? Number(req.body.reportNumber) : undefined;
    await upsertWprDraft(projectId, weekEnd, stored, reportNumber, req.user!.id);
  }

  const pack = await buildWprExportPack(projectId, range);
  if (!pack) return res.status(404).json({ error: "project not found" });
  if (!pack.existing) {
    const seeded = await seedSections(projectId, range.start, weekEnd);
    await upsertWprDraft(projectId, weekEnd, seeded, undefined, req.user!.id);
    const retry = await buildWprExportPack(projectId, range);
    if (!retry?.existing) return res.status(404).json({ error: "save the WPR draft first" });
    Object.assign(pack, retry);
  }

  const { project, weekStart, header, sections, charts, existing } = pack;
  const buf = await buildWprWorkbook({ header, sections, charts });
  const dateStr = weekEnd.toISOString().slice(0, 10);
  const fname = `WPR-${project.code}-${dateStr}.xlsx`;
  const clientFname = `WPR-ClientPack-${project.code}-${dateStr}.xlsx`;
  const pptxFname = `WPR-${project.code}-${dateStr}.pptx`;
  const folder = MODULE_TO_ISO_FOLDER.wpr;
  const saved = await mockOneDrive.upload(project.code, folder, fname, buf);
  const { buildWprClientWorkbook } = await import("../services/wprClientPack.js");
  const clientBuf = await buildWprClientWorkbook(prisma, projectId, weekStart, weekEnd);
  await mockOneDrive.upload(project.code, folder, clientFname, clientBuf);
  const pptxBuf = await buildWprPptx({ header, sections, charts, packExtras: pack.packExtras || undefined });
  const pptxSaved = await mockOneDrive.upload(project.code, folder, pptxFname, pptxBuf);

  const publishedUrl = saved.sharePointUrl || saved.url || pptxSaved.sharePointUrl || pptxSaved.url || null;

  const updated = await prisma.wprSnapshot.update({
    where: { id: existing!.id },
    data: {
      status: "Published",
      publishedAt: new Date(),
      publishedPath: saved.path,
      publishedUrl,
    },
  });

  await audit("wpr.published", {
    userId: req.user!.id,
    entity: "WprSnapshot",
    entityId: existing!.id,
    meta: { weekEnding: dateStr, path: saved.path, url: publishedUrl, pptxPath: pptxSaved.path, provider: saved.provider },
  });

  res.json({
    ok: true,
    id: updated.id,
    status: updated.status,
    publishedAt: updated.publishedAt,
    publishedPath: updated.publishedPath,
    publishedUrl: updated.publishedUrl,
    sharePointUrl: publishedUrl,
    pptxPath: pptxSaved.path,
    pptxUrl: pptxSaved.url,
    provider: saved.provider,
    url: saved.url,
  });
});

wprMakerRouter.get("/:projectId/recent", async (req, res) => {
  const projectId = req.params.projectId;
  const rows = await prisma.wprSnapshot.findMany({
    where: { projectId },
    orderBy: [{ weekEnding: "desc" }],
    take: 30,
    select: {
      id: true,
      weekEnding: true,
      reportNumber: true,
      status: true,
      publishedAt: true,
      publishedPath: true,
      publishedUrl: true,
      updatedAt: true,
    },
  });
  res.json(rows);
});

/**
 * Photo upload — a section-scoped photo lands in the WPR MIS photos folder
 * and its SharePoint path is returned so the maker page can push it into
 * the corresponding section's `photos[]` array.
 *
 * Multipart field: `photo`. Extra fields: `weekEnding`, `sectionKey`, `caption`.
 */
wprMakerRouter.post("/:projectId/photo", upload.single("photo"), async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const file = (req as any).file as { originalname: string; buffer: Buffer; mimetype: string } | undefined;
  if (!file) return res.status(400).json({ error: "photo file missing (field name: photo)" });

  const weekEnd = parseEnd(req.body.weekEnding);
  const sectionKey = String(req.body.sectionKey || "misc").replace(/[^A-Za-z0-9_]+/g, "_").slice(0, 40);
  const caption = String(req.body.caption || "").slice(0, 200);
  const dateStr = weekEnd.toISOString().slice(0, 10);
  const safeName = file.originalname.replace(/[^A-Za-z0-9._-]+/g, "_");
  const ext = /\.[a-zA-Z0-9]{1,6}$/.test(safeName) ? "" : ".jpg";
  const stamped = `${dateStr}-${sectionKey}-${Date.now()}-${safeName}${ext}`;
  const folder = `${MODULE_TO_ISO_FOLDER.wpr}/photos/${sectionKey}`;

  const saved = await mockOneDrive.upload(project.code, folder, stamped, file.buffer);

  await audit("wpr.photo.uploaded", {
    userId: req.user!.id,
    entity: "WprSnapshot",
    entityId: `${projectId}:${dateStr}`,
    meta: { path: saved.path, provider: saved.provider, section: sectionKey, caption, size: file.buffer.length },
  });

  res.json({
    ok: true,
    path: saved.path,
    caption,
    section: sectionKey,
    provider: saved.provider,
    url: saved.url,
  });
});

/**
 * PDF / doc attachment for a WPR — e.g. signed weekly report, MoM PDF,
 * safety pack. Lands under wpr/attachments/ so the pack export can list it.
 * Multipart field: `file`. Extra fields: `weekEnding`, `caption`.
 */
wprMakerRouter.post("/:projectId/attachment", upload.single("file"), async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const file = (req as any).file as { originalname: string; buffer: Buffer } | undefined;
  if (!file) return res.status(400).json({ error: "file missing (field name: file)" });

  const weekEnd = parseEnd(req.body.weekEnding);
  const dateStr = weekEnd.toISOString().slice(0, 10);
  const caption = String(req.body.caption || file.originalname).slice(0, 200);
  const safeName = file.originalname.replace(/[^A-Za-z0-9._-]+/g, "_");
  const stamped = `${dateStr}-${Date.now()}-${safeName}`;
  const folder = `${MODULE_TO_ISO_FOLDER.wpr}/attachments`;
  const saved = await mockOneDrive.upload(project.code, folder, stamped, file.buffer);

  await audit("wpr.attachment.uploaded", {
    userId: req.user!.id,
    entity: "WprSnapshot",
    entityId: `${projectId}:${dateStr}`,
    meta: { path: saved.path, provider: saved.provider, caption, size: file.buffer.length },
  });
  res.json({ ok: true, path: saved.path, caption, provider: saved.provider, url: saved.url });
});

/**
 * Signature PNG for a WPR — one signature blob per party (e.g. PMC, client,
 * contractor). Saved under wpr/signatures/ for the weekly sign-off block.
 * Multipart field: `signature`. Extra fields: `weekEnding`, `role`.
 */
wprMakerRouter.post("/:projectId/signature", upload.single("signature"), async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const file = (req as any).file as { originalname: string; buffer: Buffer } | undefined;
  if (!file) return res.status(400).json({ error: "signature blob missing (field name: signature)" });

  const weekEnd = parseEnd(req.body.weekEnding);
  const dateStr = weekEnd.toISOString().slice(0, 10);
  const role = String(req.body.role || "signer").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 30);
  const filename = `${dateStr}-${role}-${Date.now()}.png`;
  const folder = `${MODULE_TO_ISO_FOLDER.wpr}/signatures`;
  const saved = await mockOneDrive.upload(project.code, folder, filename, file.buffer);

  await audit("wpr.signature.uploaded", {
    userId: req.user!.id,
    entity: "WprSnapshot",
    entityId: `${projectId}:${dateStr}`,
    meta: { path: saved.path, provider: saved.provider, role, size: file.buffer.length },
  });
  res.json({ ok: true, path: saved.path, role, provider: saved.provider, url: saved.url });
});
