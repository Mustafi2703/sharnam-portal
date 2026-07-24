import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";

export const progressRouter = Router();
progressRouter.use(requireAuth);

progressRouter.get("/:projectId/summary", async (req, res) => {
  const projectId = req.params.projectId;
  const [milestones, hindrances, risks, plannedActual] = await Promise.all([
    prisma.progressMilestone.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
    prisma.progressHindrance.findMany({ where: { projectId }, orderBy: { occurredAt: "desc" } }),
    prisma.progressRisk.findMany({ where: { projectId }, orderBy: { severity: "desc" } }),
    prisma.progressPlannedActual.findMany({ where: { projectId }, orderBy: { periodLabel: "asc" } }),
  ]);

  const openHindrance = hindrances.filter((h) => h.status === "Open").length;
  const openRisk = risks.filter((r) => r.status === "Open").length;
  const delayed = milestones.filter((m) => (m.varianceDays || 0) > 0).length;

  res.json({
    totals: {
      milestones: milestones.length,
      delayed,
      openHindrance,
      openRisk,
      avgActualPct:
        plannedActual.length > 0
          ? plannedActual.reduce((s, p) => s + p.actualPct, 0) / plannedActual.length
          : 0,
    },
    milestones,
    hindrances,
    risks,
    plannedActual,
  });
});

progressRouter.post(
  "/:projectId/milestones",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const row = await prisma.progressMilestone.create({
      data: {
        projectId: req.params.projectId,
        code: body.code || null,
        category: body.category || null,
        activity: String(body.activity || "Milestone"),
        plannedStart: body.plannedStart ? new Date(body.plannedStart) : null,
        plannedEnd: body.plannedEnd ? new Date(body.plannedEnd) : null,
        plannedDays: Number(body.plannedDays || 0),
        actualStart: body.actualStart ? new Date(body.actualStart) : null,
        actualEnd: body.actualEnd ? new Date(body.actualEnd) : null,
        actualDays: Number(body.actualDays || 0),
        varianceDays: Number(body.varianceDays || 0),
        status: body.status || "Planned",
      },
    });
    await audit("progress.milestone.create", {
      userId: req.user!.id,
      entity: "ProgressMilestone",
      entityId: row.id,
      meta: { projectId: req.params.projectId },
    });
    res.status(201).json(row);
  }
);

progressRouter.post(
  "/:projectId/hindrances",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const row = await prisma.progressHindrance.create({
      data: {
        projectId: req.params.projectId,
        description: String(body.description || ""),
        location: body.location || null,
        activity: body.activity || null,
        correspondence: body.correspondence || null,
        category: body.category || null,
        type: body.type || null,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        resolvedAt: body.resolvedAt ? new Date(body.resolvedAt) : null,
        daysImpacted: Number(body.daysImpacted || 0),
        status: body.status || "Open",
        accountable: body.accountable || null,
      },
    });
    res.status(201).json(row);
  }
);

progressRouter.post(
  "/:projectId/risks",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const probability = Number(body.probability || 1);
    const consequence = Number(body.consequence || 1);
    const row = await prisma.progressRisk.create({
      data: {
        projectId: req.params.projectId,
        code: body.code || null,
        category: body.category || null,
        opportunityThreat: body.opportunityThreat || "Threat",
        name: String(body.name || "Risk"),
        description: body.description || null,
        probability,
        consequence,
        severity: probability * consequence,
        probabilityPct: Number(body.probabilityPct || 0),
        costImpact: Number(body.costImpact || 0),
        status: body.status || "Open",
      },
    });
    res.status(201).json(row);
  }
);

progressRouter.patch(
  "/:projectId/modules",
  requireRoles("admin", "office"),
  async (req: AuthedRequest, res) => {
    const enabledModules = Array.isArray(req.body?.enabledModules)
      ? JSON.stringify(req.body.enabledModules)
      : undefined;
    const workPackages = Array.isArray(req.body?.workPackages)
      ? JSON.stringify(req.body.workPackages)
      : undefined;
    if (!enabledModules && !workPackages) {
      return res.status(400).json({ error: "enabledModules or workPackages required" });
    }
    const project = await prisma.project.update({
      where: { id: req.params.projectId },
      data: {
        ...(enabledModules ? { enabledModules } : {}),
        ...(workPackages ? { workPackages } : {}),
      },
    });
    res.json(project);
  }
);
