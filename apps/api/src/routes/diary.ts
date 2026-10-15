import { Router } from "express";
import { guardProjectParam, guardRecord } from "../modules/_shared/projectAccess.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";

export const diaryRouter = Router();
diaryRouter.use(requireAuth);
guardProjectParam(diaryRouter);
guardRecord(diaryRouter, "/:id", async (id) => (await prisma.dailyLog.findUnique({ where: { id }, select: { projectId: true } }))?.projectId);

function dayStart(d: string | Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

diaryRouter.get("/project/:projectId", async (req, res) => {
  const logs = await prisma.dailyLog.findMany({
    where: { projectId: req.params.projectId },
    include: {
      createdBy: { select: { fullName: true } },
      _count: { select: { manpower: true, equipment: true, notes: true, photos: true } },
    },
    orderBy: { logDate: "desc" },
  });
  res.json(logs);
});

diaryRouter.get("/project/:projectId/date/:date", async (req, res) => {
  const logDate = dayStart(req.params.date);
  const log = await prisma.dailyLog.findUnique({
    where: { projectId_logDate: { projectId: req.params.projectId, logDate } },
    include: {
      manpower: true,
      equipment: true,
      notes: true,
      photos: true,
      createdBy: { select: { fullName: true } },
    },
  });
  res.json(log);
});

diaryRouter.post("/project/:projectId", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const logDate = dayStart(req.body.date || new Date());
  const log = await prisma.dailyLog.upsert({
    where: { projectId_logDate: { projectId: req.params.projectId, logDate } },
    create: {
      projectId: req.params.projectId,
      logDate,
      weatherCondition: req.body.weatherCondition,
      weatherSource: req.body.weatherSource || "Manual",
      createdById: req.user!.id,
    },
    update: {
      weatherCondition: req.body.weatherCondition,
      weatherSource: req.body.weatherSource,
    },
    include: { manpower: true, equipment: true, notes: true, photos: true },
  });
  await audit("diary.open", { userId: req.user!.id, entity: "DailyLog", entityId: log.id });
  res.json(log);
});

diaryRouter.post("/:id/manpower", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const entry = await prisma.dailyLogManpower.create({
    data: {
      dailyLogId: req.params.id,
      companyName: req.body.companyName,
      workerCount: Number(req.body.workerCount || 0),
      hoursWorked: Number(req.body.hoursWorked ?? 8),
      comments: req.body.comments,
    },
  });
  res.status(201).json(entry);
});

diaryRouter.post("/:id/equipment", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const entry = await prisma.dailyLogEquipment.create({
    data: {
      dailyLogId: req.params.id,
      companyName: req.body.companyName,
      equipmentType: req.body.equipmentType,
      hoursUsed: req.body.hoursUsed != null ? Number(req.body.hoursUsed) : null,
      comments: req.body.comments,
    },
  });
  res.status(201).json(entry);
});

diaryRouter.post("/:id/notes", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const entry = await prisma.dailyLogNote.create({
    data: { dailyLogId: req.params.id, noteText: req.body.noteText },
  });
  res.status(201).json(entry);
});

diaryRouter.delete("/:id", requireRoles("admin", "office", "site_employee"), async (req: AuthedRequest, res) => {
  const log = await prisma.dailyLog.findUnique({ where: { id: req.params.id } });
  if (!log) return res.status(404).json({ error: "Not found" });
  if (log.status !== "Open" || log.completedAt) {
    return res.status(409).json({ error: "This day log is completed. It stays as the site record." });
  }
  await prisma.$transaction([
    prisma.dailyLogManpower.deleteMany({ where: { dailyLogId: log.id } }),
    prisma.dailyLogEquipment.deleteMany({ where: { dailyLogId: log.id } }),
    prisma.dailyLogNote.deleteMany({ where: { dailyLogId: log.id } }),
    prisma.dailyLogPhoto.deleteMany({ where: { dailyLogId: log.id } }),
    prisma.dailyLog.delete({ where: { id: log.id } }),
  ]);
  await audit("diary.delete", { userId: req.user!.id, entity: "DailyLog", entityId: log.id, meta: { projectId: log.projectId } });
  res.json({ ok: true });
});

diaryRouter.post("/:id/complete", requireRoles("admin", "office", "site_employee"), async (req: AuthedRequest, res) => {
  const log = await prisma.dailyLog.update({
    where: { id: req.params.id },
    data: { status: "Completed", completedAt: new Date() },
  });
  await audit("diary.complete", { userId: req.user!.id, entity: "DailyLog", entityId: log.id });
  res.json(log);
});
