/**
 * DPR maker — per-project × per-day × per-discipline daily progress report.
 *
 * Generation is now **template-based**: we load the discipline's SPDC
 * reference XLSX from apps/api/dpr-templates/ and poke the user's values
 * into the yellow INPUT cells. The DASHBOARD sheet keeps its native
 * formulas and prints identically to the reference.
 *
 * Endpoints:
 *   GET  /api/dpr-maker/:projectId?date=YYYY-MM-DD&discipline=CIVIL
 *   POST /api/dpr-maker/:projectId/save
 *          body: { logDate, discipline, header, lines, manpower[], equipment[],
 *                  materials[], qualityTests[], safetyRows[], safety,
 *                  delays[], approvals[], issues[], highlights[], nextDayPlan[],
 *                  decisions[], photos[], attachments[], signatures[] }
 *   POST /api/dpr-maker/:projectId/photo      (multipart, field="photo")
 *   POST /api/dpr-maker/:projectId/attachment (multipart, field="file" — PDFs)
 *   POST /api/dpr-maker/:projectId/signature  (multipart, field="signature" — PNG blob)
 *   GET  /api/dpr-maker/:projectId/download.xlsx?date=...&discipline=...
 *   POST /api/dpr-maker/:projectId/publish    body: { logDate, discipline }
 *   GET  /api/dpr-maker/:projectId/recent
 */
import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "../services/graph.js";
import {
  buildDprWorkbook,
  type DprHeader,
  type DprLine,
  type DprManpower,
  type DprEquipment,
  type DprMaterial,
  type DprSafety,
  type DprSafetyRow,
  type DprQualityTest,
  type DprDelay,
  type DprApprovalPending,
  type DprIssue,
  type DprPhoto,
} from "../services/dprXlsx.js";
import { audit } from "../services/audit.js";
import { buildDprAutoFill } from "../services/dprIntegrations.js";

export const dprMakerRouter = Router();
dprMakerRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const VALID_DISCIPLINES = [
  "CIVIL", "ELECTRICAL", "FIRE", "MECHANICAL",
  "PEB_ERECTION", "PEB_SUPPLY", "PLUMBING",
] as const;

function normDiscipline(d: unknown): string {
  const s = String(d ?? "CIVIL").toUpperCase().replace(/\s+/g, "_");
  return (VALID_DISCIPLINES as readonly string[]).includes(s) ? s : "CIVIL";
}

function parseDate(d: unknown): Date {
  const s = typeof d === "string" ? d : "";
  const parsed = s ? new Date(s) : new Date();
  const day = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  day.setHours(0, 0, 0, 0);
  return day;
}

// ─── extras packing (all non-line, non-header data goes into headerJson._extras) ───

type DprExtras = {
  manpower?: DprManpower[];
  equipment?: DprEquipment[];
  materials?: DprMaterial[];
  qualityTests?: DprQualityTest[];
  safetyRows?: DprSafetyRow[];
  safety?: DprSafety;
  delays?: DprDelay[];
  approvals?: DprApprovalPending[];
  issues?: DprIssue[];
  highlights?: string[];
  nextDayPlan?: string[];
  decisions?: string[];
  photos?: DprPhoto[];
  attachments?: DprPhoto[];
  signatures?: DprPhoto[];
};

function splitExtras(headerJsonStr: string | null): { header: DprHeader; extras: DprExtras } {
  const raw = JSON.parse(headerJsonStr || "{}");
  const { _extras, ...header } = raw as Record<string, any>;
  return { header: header as DprHeader, extras: (_extras || {}) as DprExtras };
}
function packHeader(header: DprHeader, extras: DprExtras): string {
  return JSON.stringify({ ...header, _extras: extras });
}

// ─── seed defaults matching SPDC CIVIL_DASHBOARD layout ───

function defaultManpower(): DprManpower[] {
  return [
    { trade: "Mason",                       planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Bar Bender",                  planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Carpenter – Shuttering",      planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Helper / Unskilled",          planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Operators – Machine & Pump",  planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Supervisor & PMC Staff",      planned: 0, actual: 0, hoursWorked: 8 },
  ];
}
function defaultEquipment(): DprEquipment[] {
  return [
    { name: "Excavator – JCB 3DX",          qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "Transit Mixer 6 CUM",          qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "Concrete Boom Pump 36 m",      qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "Needle Vibrator 40 mm",        qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "Bar Cutting / Bending M/C",    qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "De-watering Pump & DG Set",    qty: 0, workedHrs: 0, idleHrs: 0 },
  ];
}
function defaultMaterials(): DprMaterial[] {
  return [
    { name: "Cement OPC 53",              unit: "BAGS", opening: 0, received: 0, consumed: 0 },
    { name: "Reinforcement Fe 500 D",     unit: "KGS",  opening: 0, received: 0, consumed: 0 },
    { name: "RMC M30 (direct pour)",      unit: "CUM",  opening: 0, received: 0, consumed: 0 },
    { name: "Coarse Aggregate 20 / 10 mm",unit: "CUM",  opening: 0, received: 0, consumed: 0 },
    { name: "Shuttering Ply 12 mm",       unit: "SQM",  opening: 0, received: 0, consumed: 0 },
    { name: "Cover Blocks & Binding Wire",unit: "NOS",  opening: 0, received: 0, consumed: 0 },
  ];
}
function defaultQualityTests(): DprQualityTest[] {
  return [
    { parameter: "Pour cards offered / approved",       figure: "" },
    { parameter: "Concrete cube sets cast / slump tests", figure: "" },
    { parameter: "Reinforcement & shuttering checklists", figure: "" },
    { parameter: "7-day cube result",                    figure: "" },
    { parameter: "NCRs open / closed today",             figure: "" },
    { parameter: "Field density (compaction) tests",     figure: "" },
  ];
}
function defaultSafetyRows(): DprSafetyRow[] {
  return [
    { parameter: "Safe man-hours – today / cumulative", figure: "0 / 0" },
    { parameter: "Days without LTI",                    figure: "0" },
    { parameter: "Toolbox talks conducted",             figure: "0" },
    { parameter: "Permits to work issued",              figure: "0" },
    { parameter: "Safety observations raised / closed", figure: "0 / 0" },
    { parameter: "Near miss / first aid today",         figure: "0 / 0" },
  ];
}
function defaultSafety(): DprSafety {
  return {
    safeManHoursToday: 0, safeManDaysToday: 0, toolboxTalks: 0,
    ppeCompliancePct: 100, nearMiss: 0, firstAid: 0, ltis: 0, incidents: 0,
    permits: 0, observationsRaised: 0, observationsClosed: 0,
  };
}
function defaultDelays(): DprDelay[] { return []; }
function defaultApprovals(): DprApprovalPending[] { return []; }
function defaultIssues(): DprIssue[] { return []; }

// ─── seed from Cost + BBS + MB + Planned vs Actual + prior DPR + Q/S ───

async function seedNewDpr(projectId: string, logDate: Date, discipline: string) {
  return buildDprAutoFill(projectId, logDate, discipline);
}

// ═══════════════════════════════ GET current ═══════════════════════════════

dprMakerRouter.get("/:projectId", async (req, res) => {
  const projectId = req.params.projectId;
  const logDate = parseDate(req.query.date);
  const discipline = normDiscipline(req.query.discipline);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });

  const existing = await prisma.dprSnapshot.findUnique({
    where: { projectId_logDate_discipline: { projectId, logDate, discipline } },
  });

  let header: DprHeader;
  let extras: DprExtras;
  let autoSources: string[] = [];
  let seededLines: DprLine[] = [];
  if (existing) {
    const split = splitExtras(existing.headerJson);
    header = split.header;
    extras = split.extras;
  } else {
    const auto = await seedNewDpr(projectId, logDate, discipline);
    autoSources = auto.sources;
    seededLines = auto.lines;
    header = {
      projectName: project.name,
      projectManager: project.designConsultant || "",
      contractor: project.contractorName || "",
      location: project.location || "",
      contractRef: "",
      contractCompletion: project.endDate ? project.endDate.toISOString() : null,
      calendarHours: "6 Days / Week – 8 hrs",
      shiftHours: 8,
      weather: "",
      reportDate: logDate.toISOString(),
      dataDate: logDate.toISOString(),
      reportNumber: `DPR/${discipline.slice(0, 3)}-${Math.round((Date.now() % 10000000) / 1000)}`,
      acCertifiedToDate: auto.header.acCertifiedToDate ?? 0,
      cumManDaysPrev: auto.header.cumManDaysPrev ?? 0,
      cumSafeManHoursPrev: auto.header.cumSafeManHoursPrev ?? 0,
      dateOfLastLti: null,
      preparedBy: "Site Engineer – SPDC (PMC)",
    };
    extras = {
      manpower: auto.manpower.length ? auto.manpower : defaultManpower(),
      equipment: defaultEquipment(),
      materials: auto.materials.length ? auto.materials : defaultMaterials(),
      qualityTests: auto.qualityTests.length ? auto.qualityTests : defaultQualityTests(),
      safetyRows: auto.safetyRows.length ? auto.safetyRows : defaultSafetyRows(),
      safety: { ...defaultSafety(), ...auto.safety },
      delays: auto.delays.length ? auto.delays : defaultDelays(),
      approvals: auto.approvals.length ? auto.approvals : defaultApprovals(),
      issues: auto.issues.length ? auto.issues : defaultIssues(),
      highlights: [],
      nextDayPlan: [],
      decisions: [],
      photos: [],
      attachments: [],
      signatures: [],
    };
  }

  const lines: DprLine[] = existing ? JSON.parse(existing.linesJson || "[]") : seededLines;

  res.json({
    projectId,
    projectCode: project.code,
    logDate: logDate.toISOString(),
    discipline,
    header,
    lines,
    manpower: extras.manpower || defaultManpower(),
    equipment: extras.equipment || defaultEquipment(),
    materials: extras.materials || defaultMaterials(),
    qualityTests: extras.qualityTests || defaultQualityTests(),
    safetyRows: extras.safetyRows || defaultSafetyRows(),
    safety: extras.safety || defaultSafety(),
    delays: extras.delays || [],
    approvals: extras.approvals || [],
    issues: extras.issues || [],
    highlights: extras.highlights || [],
    nextDayPlan: extras.nextDayPlan || [],
    decisions: extras.decisions || [],
    photos: extras.photos || [],
    attachments: extras.attachments || [],
    signatures: extras.signatures || [],
    status: existing?.status || "Draft",
    publishedPath: existing?.publishedPath || null,
    publishedAt: existing?.publishedAt || null,
    autoFillSources: autoSources,
  });
});

// ═══════════════════════════════ POST save ═══════════════════════════════

dprMakerRouter.post("/:projectId/save", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const logDate = parseDate(req.body.logDate);
  const discipline = normDiscipline(req.body.discipline);
  const header: DprHeader = req.body.header || {};
  const lines: DprLine[] = Array.isArray(req.body.lines) ? req.body.lines : [];
  const extras: DprExtras = {
    manpower:     Array.isArray(req.body.manpower)     ? req.body.manpower     : [],
    equipment:    Array.isArray(req.body.equipment)    ? req.body.equipment    : [],
    materials:    Array.isArray(req.body.materials)    ? req.body.materials    : [],
    qualityTests: Array.isArray(req.body.qualityTests) ? req.body.qualityTests : [],
    safetyRows:   Array.isArray(req.body.safetyRows)   ? req.body.safetyRows   : [],
    safety:       (req.body.safety && typeof req.body.safety === "object") ? req.body.safety : {},
    delays:       Array.isArray(req.body.delays)       ? req.body.delays       : [],
    approvals:    Array.isArray(req.body.approvals)    ? req.body.approvals    : [],
    issues:       Array.isArray(req.body.issues)       ? req.body.issues       : [],
    highlights:   Array.isArray(req.body.highlights)   ? req.body.highlights.map(String)   : [],
    nextDayPlan:  Array.isArray(req.body.nextDayPlan)  ? req.body.nextDayPlan.map(String)  : [],
    decisions:    Array.isArray(req.body.decisions)    ? req.body.decisions.map(String)    : [],
    photos:       Array.isArray(req.body.photos)       ? req.body.photos       : [],
    attachments:  Array.isArray(req.body.attachments)  ? req.body.attachments  : [],
    signatures:   Array.isArray(req.body.signatures)   ? req.body.signatures   : [],
  };

  const saved = await prisma.dprSnapshot.upsert({
    where: { projectId_logDate_discipline: { projectId, logDate, discipline } },
    create: {
      projectId, logDate, discipline,
      headerJson: packHeader(header, extras),
      linesJson: JSON.stringify(lines),
      status: "Draft",
      createdById: req.user!.id,
    },
    update: {
      headerJson: packHeader(header, extras),
      linesJson: JSON.stringify(lines),
      updatedAt: new Date(),
    },
  });

  await audit("dpr.saved", {
    userId: req.user!.id,
    entity: "DprSnapshot",
    entityId: saved.id,
    meta: {
      discipline, logDate: logDate.toISOString(),
      lines: lines.length,
      manpower: (extras.manpower || []).length,
      photos: (extras.photos || []).length,
      attachments: (extras.attachments || []).length,
      signatures: (extras.signatures || []).length,
    },
  });

  res.json({ id: saved.id, status: saved.status });
});

// ═══════════════════════ POST photo / attachment / signature ═══════════════

function stampedName(base: string, prefix?: string): string {
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, "_");
  const hasExt = /\.[a-zA-Z0-9]{1,6}$/.test(safe);
  return `${prefix ? prefix + "-" : ""}${Date.now()}-${safe}${hasExt ? "" : ""}`;
}

/**
 * Photo upload — regular site photos, camera evidence.
 * Folder: 07.02_Daily_Site_Records/<DISCIPLINE>/photos/
 */
dprMakerRouter.post("/:projectId/photo", upload.single("photo"), async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const file = (req as any).file as { originalname: string; buffer: Buffer } | undefined;
  if (!file) return res.status(400).json({ error: "photo file missing (field name: photo)" });

  const discipline = normDiscipline(req.body.discipline);
  const logDate = parseDate(req.body.logDate);
  const dateStr = logDate.toISOString().slice(0, 10);
  const caption = String(req.body.caption || "").slice(0, 200);
  const folder = `${MODULE_TO_ISO_FOLDER.dpr}/${discipline}/photos`;
  const saved = await mockOneDrive.upload(project.code, folder, stampedName(file.originalname, dateStr), file.buffer);

  await audit("dpr.photo.uploaded", {
    userId: req.user!.id, entity: "DprSnapshot",
    entityId: `${projectId}:${dateStr}:${discipline}`,
    meta: { path: saved.path, provider: saved.provider, caption, size: file.buffer.length },
  });

  const photo: DprPhoto = { path: saved.path, caption, takenAt: new Date().toISOString(), kind: "photo" };
  res.json({ ok: true, photo, provider: saved.provider, url: saved.url });
});

/**
 * PDF attachment upload — signed docs, checklists, RA bills etc.
 * Folder: 07.02_Daily_Site_Records/<DISCIPLINE>/attachments/
 */
dprMakerRouter.post("/:projectId/attachment", upload.single("file"), async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const file = (req as any).file as { originalname: string; buffer: Buffer } | undefined;
  if (!file) return res.status(400).json({ error: "file missing (field name: file)" });

  const discipline = normDiscipline(req.body.discipline);
  const logDate = parseDate(req.body.logDate);
  const dateStr = logDate.toISOString().slice(0, 10);
  const caption = String(req.body.caption || "").slice(0, 200);
  const folder = `${MODULE_TO_ISO_FOLDER.dpr}/${discipline}/attachments`;
  const saved = await mockOneDrive.upload(project.code, folder, stampedName(file.originalname, dateStr), file.buffer);

  await audit("dpr.attachment.uploaded", {
    userId: req.user!.id, entity: "DprSnapshot",
    entityId: `${projectId}:${dateStr}:${discipline}`,
    meta: { path: saved.path, provider: saved.provider, caption, size: file.buffer.length },
  });

  const attachment: DprPhoto = { path: saved.path, caption, takenAt: new Date().toISOString(), kind: "pdf" };
  res.json({ ok: true, attachment, provider: saved.provider, url: saved.url });
});

/**
 * Signature upload — a canvas signature PNG blob.
 * Folder: 07.02_Daily_Site_Records/<DISCIPLINE>/signatures/
 */
dprMakerRouter.post("/:projectId/signature", upload.single("signature"), async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const file = (req as any).file as { originalname: string; buffer: Buffer } | undefined;
  if (!file) return res.status(400).json({ error: "signature blob missing (field name: signature)" });

  const discipline = normDiscipline(req.body.discipline);
  const logDate = parseDate(req.body.logDate);
  const dateStr = logDate.toISOString().slice(0, 10);
  const role = String(req.body.role || "signer").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 30);
  const filename = `${dateStr}-${role}-${Date.now()}.png`;
  const folder = `${MODULE_TO_ISO_FOLDER.dpr}/${discipline}/signatures`;
  const saved = await mockOneDrive.upload(project.code, folder, filename, file.buffer);

  await audit("dpr.signature.uploaded", {
    userId: req.user!.id, entity: "DprSnapshot",
    entityId: `${projectId}:${dateStr}:${discipline}`,
    meta: { path: saved.path, provider: saved.provider, role, size: file.buffer.length },
  });

  const signature: DprPhoto = { path: saved.path, caption: role, takenAt: new Date().toISOString(), kind: "signature" };
  res.json({ ok: true, signature, provider: saved.provider, url: saved.url });
});

// ═══════════════════════════════ GET download ═══════════════════════════════

async function loadFullSnapshot(project: { name: string; code: string; endDate?: Date | null; contractorName?: string | null; location?: string | null; designConsultant?: string | null }, projectId: string, logDate: Date, discipline: string) {
  const existing = await prisma.dprSnapshot.findUnique({
    where: { projectId_logDate_discipline: { projectId, logDate, discipline } },
  });
  let header: DprHeader;
  let extras: DprExtras;
  if (existing) {
    const split = splitExtras(existing.headerJson);
    header = split.header;
    extras = split.extras;
  } else {
    header = {
      projectName: project.name,
      contractor: project.contractorName || "",
      location: project.location || "",
      reportDate: logDate.toISOString(),
      dataDate: logDate.toISOString(),
      reportNumber: `DPR/${discipline.slice(0, 3)}-${logDate.toISOString().slice(0, 10)}`,
    };
    extras = {};
  }
  const lines: DprLine[] = existing
    ? JSON.parse(existing.linesJson || "[]")
    : (await seedNewDpr(projectId, logDate, discipline)).lines;
  return { existing, header, extras, lines };
}

dprMakerRouter.get("/:projectId/download.xlsx", async (req, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const logDate = parseDate(req.query.date);
  const discipline = normDiscipline(req.query.discipline);

  const { header, extras, lines } = await loadFullSnapshot(project, projectId, logDate, discipline);

  const buf = await buildDprWorkbook({
    discipline, header, lines,
    manpower: extras.manpower, equipment: extras.equipment,
    materials: extras.materials, qualityTests: extras.qualityTests,
    safetyRows: extras.safetyRows, safety: extras.safety,
    delays: extras.delays, approvals: extras.approvals,
    issues: extras.issues, highlights: extras.highlights,
    nextDayPlan: extras.nextDayPlan, decisions: extras.decisions,
    photos: extras.photos, attachments: extras.attachments,
    signatures: extras.signatures,
  });
  const fname = `DPR-${project.code}-${discipline}-${logDate.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

// ═══════════════════════════════ POST publish ═══════════════════════════════

dprMakerRouter.post("/:projectId/publish", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const logDate = parseDate(req.body.logDate);
  const discipline = normDiscipline(req.body.discipline);

  const existing = await prisma.dprSnapshot.findUnique({
    where: { projectId_logDate_discipline: { projectId, logDate, discipline } },
  });
  if (!existing) return res.status(404).json({ error: "save the DPR draft first" });

  const { header, extras } = splitExtras(existing.headerJson);
  const lines: DprLine[] = JSON.parse(existing.linesJson || "[]");
  const buf = await buildDprWorkbook({
    discipline, header, lines,
    manpower: extras.manpower, equipment: extras.equipment,
    materials: extras.materials, qualityTests: extras.qualityTests,
    safetyRows: extras.safetyRows, safety: extras.safety,
    delays: extras.delays, approvals: extras.approvals,
    issues: extras.issues, highlights: extras.highlights,
    nextDayPlan: extras.nextDayPlan, decisions: extras.decisions,
    photos: extras.photos, attachments: extras.attachments,
    signatures: extras.signatures,
  });

  const dateStr = logDate.toISOString().slice(0, 10);
  const fname = `DPR-${project.code}-${discipline}-${dateStr}.xlsx`;
  const folder = `${MODULE_TO_ISO_FOLDER.dpr}/${discipline}`;
  const saved = await mockOneDrive.upload(project.code, folder, fname, buf);

  const updated = await prisma.dprSnapshot.update({
    where: { id: existing.id },
    data: { status: "Published", publishedAt: new Date(), publishedPath: saved.path },
  });

  await audit("dpr.published", {
    userId: req.user!.id, entity: "DprSnapshot", entityId: existing.id,
    meta: { discipline, logDate: dateStr, path: saved.path, provider: saved.provider },
  });

  res.json({
    ok: true, id: updated.id, status: updated.status,
    publishedAt: updated.publishedAt, publishedPath: updated.publishedPath,
    provider: saved.provider, url: saved.url,
  });
});

// ═══════════════════════════════ GET recent ═══════════════════════════════

dprMakerRouter.get("/:projectId/recent", async (req, res) => {
  const projectId = req.params.projectId;
  const rows = await prisma.dprSnapshot.findMany({
    where: { projectId },
    orderBy: [{ logDate: "desc" }, { discipline: "asc" }],
    take: 60,
    select: {
      id: true, logDate: true, discipline: true,
      status: true, publishedAt: true, publishedPath: true, updatedAt: true,
    },
  });
  res.json(rows);
});
