/**
 * DPR maker — per-project, per-day, per-discipline daily progress report.
 *
 * Endpoints:
 *   GET  /api/dpr-maker/:projectId?date=YYYY-MM-DD&discipline=CIVIL
 *   POST /api/dpr-maker/:projectId/save            body: { logDate, discipline, header, lines }
 *   GET  /api/dpr-maker/:projectId/download.xlsx?date=...&discipline=...
 *   POST /api/dpr-maker/:projectId/publish         body: { logDate, discipline }
 *
 * Format mirrors SPDC_DPR_CIVIL_DASHBOARD.xlsx — 2 sheets: INPUT + DASHBOARD.
 * On publish, XLSX is uploaded to the ISO folder for DPR under the project
 * library on SharePoint and the DprSnapshot row is marked Published.
 */
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, type AuthedRequest } from "../auth.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "../services/graph.js";
import { buildDprWorkbook, type DprHeader, type DprLine } from "../services/dprXlsx.js";
import { audit } from "../services/audit.js";

export const dprMakerRouter = Router();
dprMakerRouter.use(requireAuth);

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

  const header: DprHeader = existing
    ? JSON.parse(existing.headerJson || "{}")
    : {
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
  const header = req.body.header || {};
  const lines: DprLine[] = Array.isArray(req.body.lines) ? req.body.lines : [];

  const saved = await prisma.dprSnapshot.upsert({
    where: { projectId_logDate_discipline: { projectId, logDate, discipline } },
    create: {
      projectId,
      logDate,
      discipline,
      headerJson: JSON.stringify(header),
      linesJson: JSON.stringify(lines),
      status: "Draft",
      createdById: req.user!.id,
    },
    update: {
      headerJson: JSON.stringify(header),
      linesJson: JSON.stringify(lines),
      updatedAt: new Date(),
    },
  });

  await audit("dpr.saved", {
    userId: req.user!.id,
    entity: "DprSnapshot",
    entityId: saved.id,
    meta: { discipline, logDate: logDate.toISOString(), lines: lines.length },
  });

  res.json({ id: saved.id, status: saved.status });
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
  const header: DprHeader = existing
    ? JSON.parse(existing.headerJson || "{}")
    : {
        projectName: project.name,
        contractor: project.contractorName || "",
        location: project.location || "",
        reportDate: logDate.toISOString(),
        dataDate: logDate.toISOString(),
      };
  const lines: DprLine[] = existing
    ? JSON.parse(existing.linesJson || "[]")
    : await seedFromCostMonitoring(projectId, discipline);
  const buf = buildDprWorkbook({ discipline, header, lines });
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

  const header: DprHeader = JSON.parse(existing.headerJson || "{}");
  const lines: DprLine[] = JSON.parse(existing.linesJson || "[]");
  const buf = buildDprWorkbook({ discipline, header, lines });

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
