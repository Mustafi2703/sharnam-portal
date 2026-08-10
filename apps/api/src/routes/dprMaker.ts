/**
 * DPR maker — per-project, per-day, per-discipline daily progress report.
 *
 * Endpoints:
 *   GET  /api/dpr-maker/:projectId?date=YYYY-MM-DD&discipline=CIVIL
 *   POST /api/dpr-maker/:projectId/save
 *          body: { logDate, discipline, header, lines, manpower[], equipment[],
 *                  materials[], safety, delays[], photos[] }
 *   POST /api/dpr-maker/:projectId/photo     (multipart, field="photo")
 *          → uploads to SharePoint 07.02_Daily_Site_Records/<DISCIPLINE>/photos/
 *   GET  /api/dpr-maker/:projectId/download.xlsx?date=...&discipline=...
 *   POST /api/dpr-maker/:projectId/publish   body: { logDate, discipline }
 *   GET  /api/dpr-maker/:projectId/recent
 *
 * Format mirrors SPDC_DPR_CIVIL_DASHBOARD.xlsx — 2 sheets: INPUT + DASHBOARD.
 * INPUT sheet holds the 8 blocks (header, quantity, manpower, equipment,
 * material, safety, delay/idle, photos). DASHBOARD is fully computed.
 * On publish, XLSX is uploaded to the ISO folder for DPR under the project
 * library on SharePoint and the DprSnapshot row is marked Published.
 *
 * Storage note: Prisma DprSnapshot has only `headerJson` + `linesJson`.
 * We piggy-back the extra sections inside `headerJson._extras` so no
 * schema change is required. The maker page destructures them client-side.
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
  type DprDelay,
  type DprPhoto,
} from "../services/dprXlsx.js";
import { audit } from "../services/audit.js";

export const dprMakerRouter = Router();
dprMakerRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const VALID_DISCIPLINES = [
  "CIVIL",
  "ELECTRICAL",
  "FIRE",
  "MECHANICAL",
  "PEB_ERECTION",
  "PEB_SUPPLY",
  "PLUMBING",
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

type DprExtras = {
  manpower?: DprManpower[];
  equipment?: DprEquipment[];
  materials?: DprMaterial[];
  safety?: DprSafety;
  delays?: DprDelay[];
  photos?: DprPhoto[];
};

function splitExtras(headerJsonStr: string | null): { header: DprHeader; extras: DprExtras } {
  const raw = JSON.parse(headerJsonStr || "{}");
  const { _extras, ...header } = raw as Record<string, any>;
  return { header: header as DprHeader, extras: (_extras || {}) as DprExtras };
}

function packHeader(header: DprHeader, extras: DprExtras): string {
  return JSON.stringify({ ...header, _extras: extras });
}

function defaultManpower(): DprManpower[] {
  return [
    { trade: "Mason", planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Bar Bender", planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Carpenter — Shuttering", planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Helper / Unskilled", planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Operators — Machine & Pump", planned: 0, actual: 0, hoursWorked: 8 },
    { trade: "Supervisor & PMC Staff", planned: 0, actual: 0, hoursWorked: 8 },
  ];
}

function defaultEquipment(): DprEquipment[] {
  return [
    { name: "Excavator", qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "Transit Mixer", qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "Concrete Pump", qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "Needle Vibrator", qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "Bar Cutting / Bending M/C", qty: 0, workedHrs: 0, idleHrs: 0 },
    { name: "De-watering Pump / DG Set", qty: 0, workedHrs: 0, idleHrs: 0 },
  ];
}

function defaultMaterials(): DprMaterial[] {
  return [
    { name: "Cement OPC 53", unit: "BAGS", opening: 0, received: 0, consumed: 0 },
    { name: "Reinforcement Fe 500 D", unit: "MT", opening: 0, received: 0, consumed: 0 },
    { name: "Ready-mix M30 Concrete", unit: "CUM", opening: 0, received: 0, consumed: 0 },
    { name: "10 mm Aggregate", unit: "CUM", opening: 0, received: 0, consumed: 0 },
    { name: "20 mm Aggregate", unit: "CUM", opening: 0, received: 0, consumed: 0 },
  ];
}

function defaultSafety(): DprSafety {
  return {
    safeManHoursToday: 0,
    safeManDaysToday: 0,
    toolboxTalks: 0,
    ppeCompliancePct: 100,
    nearMiss: 0,
    firstAid: 0,
    ltis: 0,
    incidents: 0,
  };
}

async function seedFromCostMonitoring(projectId: string, discipline: string): Promise<DprLine[]> {
  const packageName = {
    CIVIL: "Civil",
    ELECTRICAL: "Electrical",
    FIRE: "Fire",
    MECHANICAL: "Mechanical",
    PEB_ERECTION: "PEB",
    PEB_SUPPLY: "PEB Supply",
    PLUMBING: "Plumbing",
  }[discipline] || "Civil";
  const rows = await prisma.costMonitoringLine.findMany({
    where: { projectId, packageName: { equals: packageName } },
    orderBy: { itemNo: "asc" },
    take: 30,
  });
  if (rows.length > 0) {
    return rows.map((r) => ({
      srNo: undefined,
      group: r.section || undefined,
      description: r.description,
      unit: r.uom || undefined,
      scopeQty: r.boqQty || r.gfcQty || 0,
      rate: r.rate || 0,
      start: null,
      finish: null,
      cumQtyPrev: r.achievedQty || 0,
      qtyToday: 0,
      remarks: "",
    }));
  }
  return [];
}

/** GET current snapshot or a seed if none exists yet. */
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
  if (existing) {
    const split = splitExtras(existing.headerJson);
    header = split.header;
    extras = split.extras;
  } else {
    header = {
      projectName: project.name,
      projectManager: project.designConsultant || "",
      contractor: project.contractorName || "",
      location: project.location || "",
      contractRef: "",
      contractCompletion: project.endDate ? project.endDate.toISOString() : null,
      calendarHours: "6 Days / Week — 8 hrs",
      shiftHours: 8,
      weather: "Partly Cloudy, 32 °C",
      reportDate: logDate.toISOString(),
      dataDate: logDate.toISOString(),
      reportNumber: `DPR/${discipline.slice(0, 3)}-${Math.round((Date.now() % 10000000) / 1000)}`,
      acCertifiedToDate: 0,
      cumManDaysPrev: 0,
      cumSafeManHoursPrev: 0,
      dateOfLastLti: null,
      preparedBy: "Site Engineer — SPDC (PMC)",
    };
    extras = {
      manpower: defaultManpower(),
      equipment: defaultEquipment(),
      materials: defaultMaterials(),
      safety: defaultSafety(),
      delays: [],
      photos: [],
    };
  }

  const lines: DprLine[] = existing
    ? JSON.parse(existing.linesJson || "[]")
    : await seedFromCostMonitoring(projectId, discipline);

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
    safety: extras.safety || defaultSafety(),
    delays: extras.delays || [],
    photos: extras.photos || [],
    status: existing?.status || "Draft",
    publishedPath: existing?.publishedPath || null,
    publishedAt: existing?.publishedAt || null,
  });
});

/** POST save (upsert) the snapshot. */
dprMakerRouter.post("/:projectId/save", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const logDate = parseDate(req.body.logDate);
  const discipline = normDiscipline(req.body.discipline);
  const header: DprHeader = req.body.header || {};
  const lines: DprLine[] = Array.isArray(req.body.lines) ? req.body.lines : [];
  const extras: DprExtras = {
    manpower: Array.isArray(req.body.manpower) ? req.body.manpower : [],
    equipment: Array.isArray(req.body.equipment) ? req.body.equipment : [],
    materials: Array.isArray(req.body.materials) ? req.body.materials : [],
    safety: (req.body.safety && typeof req.body.safety === "object") ? req.body.safety : {},
    delays: Array.isArray(req.body.delays) ? req.body.delays : [],
    photos: Array.isArray(req.body.photos) ? req.body.photos : [],
  };

  const saved = await prisma.dprSnapshot.upsert({
    where: { projectId_logDate_discipline: { projectId, logDate, discipline } },
    create: {
      projectId,
      logDate,
      discipline,
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
      discipline,
      logDate: logDate.toISOString(),
      lines: lines.length,
      manpower: (extras.manpower || []).length,
      photos: (extras.photos || []).length,
    },
  });

  res.json({ id: saved.id, status: saved.status });
});

/** POST photo upload — saves the file to SharePoint DPR photos folder. */
dprMakerRouter.post("/:projectId/photo", upload.single("photo"), async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const file = (req as any).file as { originalname: string; buffer: Buffer; mimetype: string } | undefined;
  if (!file) return res.status(400).json({ error: "photo file missing (field name: photo)" });

  const discipline = normDiscipline(req.body.discipline);
  const logDate = parseDate(req.body.logDate);
  const dateStr = logDate.toISOString().slice(0, 10);
  const caption = String(req.body.caption || "").slice(0, 200);
  const safeName = file.originalname.replace(/[^A-Za-z0-9._-]+/g, "_");
  const ext = /\.[a-zA-Z0-9]{1,6}$/.test(safeName) ? "" : ".jpg";
  const stamped = `${dateStr}-${Date.now()}-${safeName}${ext}`;
  const folder = `${MODULE_TO_ISO_FOLDER.dpr}/${discipline}/photos`;

  const saved = await mockOneDrive.upload(project.code, folder, stamped, file.buffer);

  await audit("dpr.photo.uploaded", {
    userId: req.user!.id,
    entity: "DprSnapshot",
    entityId: `${projectId}:${dateStr}:${discipline}`,
    meta: { path: saved.path, provider: saved.provider, caption, size: file.buffer.length },
  });

  const photo: DprPhoto = {
    path: saved.path,
    caption,
    takenAt: new Date().toISOString(),
  };
  res.json({ ok: true, photo, provider: saved.provider, url: saved.url });
});

/** GET download (XLSX) — builds from current snapshot or seeded default. */
dprMakerRouter.get("/:projectId/download.xlsx", async (req, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const logDate = parseDate(req.query.date);
  const discipline = normDiscipline(req.query.discipline);
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
    };
    extras = {};
  }
  const lines: DprLine[] = existing
    ? JSON.parse(existing.linesJson || "[]")
    : await seedFromCostMonitoring(projectId, discipline);

  const buf = buildDprWorkbook({
    discipline, header, lines,
    manpower: extras.manpower, equipment: extras.equipment,
    materials: extras.materials, safety: extras.safety,
    delays: extras.delays, photos: extras.photos,
  });
  const fname = `DPR-${project.code}-${discipline}-${logDate.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

/** POST publish — uploads XLSX to SharePoint DPR folder, marks Published. */
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
  const buf = buildDprWorkbook({
    discipline, header, lines,
    manpower: extras.manpower, equipment: extras.equipment,
    materials: extras.materials, safety: extras.safety,
    delays: extras.delays, photos: extras.photos,
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
    userId: req.user!.id,
    entity: "DprSnapshot",
    entityId: existing.id,
    meta: { discipline, logDate: dateStr, path: saved.path, provider: saved.provider },
  });

  res.json({
    ok: true,
    id: updated.id,
    status: updated.status,
    publishedAt: updated.publishedAt,
    publishedPath: updated.publishedPath,
    provider: saved.provider,
    url: saved.url,
  });
});

/** GET recent snapshots list (for the maker's opening screen). */
dprMakerRouter.get("/:projectId/recent", async (req, res) => {
  const projectId = req.params.projectId;
  const rows = await prisma.dprSnapshot.findMany({
    where: { projectId },
    orderBy: [{ logDate: "desc" }, { discipline: "asc" }],
    take: 60,
    select: {
      id: true,
      logDate: true,
      discipline: true,
      status: true,
      publishedAt: true,
      publishedPath: true,
      updatedAt: true,
    },
  });
  res.json(rows);
});
