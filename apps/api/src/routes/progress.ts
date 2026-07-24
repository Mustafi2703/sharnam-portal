import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { verifyProgressProject } from "../services/progressVerify.js";

export const progressRouter = Router();
progressRouter.use(requireAuth);

function countBy<T>(rows: T[], keyFn: (r: T) => string) {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = keyFn(r) || "Other";
    out[k] = (out[k] || 0) + 1;
  }
  return Object.entries(out)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Compare DB vs Excel Progress packs — office/admin verification */
progressRouter.get("/:projectId/verify", requireRoles("admin", "office", "employee"), async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const report = await verifyProgressProject(project.id);
  res.json({ project: { id: project.id, code: project.code, name: project.name }, ...report });
});

progressRouter.get("/:projectId/summary", async (req, res) => {
  const projectId = req.params.projectId;
  const [milestones, hindrances, risks, plannedActual, legalApprovals, manpower, activityLines, sorStats] =
    await Promise.all([
      prisma.progressMilestone.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
      prisma.progressHindrance.findMany({ where: { projectId }, orderBy: { occurredAt: "desc" } }),
      prisma.progressRisk.findMany({ where: { projectId }, orderBy: { severity: "desc" } }),
      prisma.progressPlannedActual.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
      prisma.progressLegalApproval.findMany({ where: { projectId }, orderBy: { approvalId: "asc" } }),
      prisma.progressManpower.findMany({ where: { projectId }, orderBy: { rank: "asc" } }),
      prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
      prisma.progressSorStat.findMany({ where: { projectId } }),
    ]);

  const openHindrance = hindrances.filter((h) => h.status === "Open").length;
  const openRisk = risks.filter((r) => r.status === "Open").length;
  const delayed = milestones.filter((m) => /delay/i.test(m.status) || (m.varianceDays || 0) > 0).length;
  const weightedPct =
    milestones.reduce((s, m) => s + (m.weightage || 0) * (m.pctComplete || 0), 0) /
    Math.max(1, milestones.reduce((s, m) => s + (m.weightage || 0), 0));

  res.json({
    totals: {
      milestones: milestones.length,
      delayed,
      openHindrance,
      openRisk,
      legal: legalApprovals.length,
      legalApproved: legalApprovals.filter((l) => /approved/i.test(l.status)).length,
      activityLines: activityLines.length,
      projectProgressPct: weightedPct || 0,
      avgActualPct:
        plannedActual.length > 0
          ? plannedActual.reduce((s, p) => s + p.actualPct, 0) / plannedActual.length
          : 0,
    },
    charts: {
      milestoneByStatus: countBy(milestones, (m) => m.status || "Unknown"),
      milestoneByPhase: countBy(milestones, (m) => m.category || "Other").map((x) => ({
        ...x,
        value:
          milestones.filter((m) => (m.category || "Other") === x.label).reduce((s, m) => s + (m.pctComplete || 0), 0) /
          Math.max(1, milestones.filter((m) => (m.category || "Other") === x.label).length),
      })),
      hindranceByActivity: countBy(hindrances, (h) => h.activity || "Other"),
      hindranceByStatus: countBy(hindrances, (h) => h.status || "Unknown"),
      hindranceByCategory: countBy(hindrances, (h) => h.category || h.type || "Other"),
      legalByStatus: countBy(legalApprovals, (l) => l.status || "Unknown"),
      riskByStatus: countBy(risks, (r) => r.status || "Unknown"),
      riskBySeverity: countBy(risks, (r) => String(r.severity || "0")),
      cashflow: plannedActual.map((p) => ({
        label: p.periodLabel,
        planned: p.plannedAmount,
        actual: p.actualAmount,
      })),
      manpower: manpower.map((m) => ({
        label: m.trade,
        required: m.required,
        available: m.available,
        shortage: m.shortage,
        shortagePct: m.shortagePct,
      })),
      sor: sorStats.map((s) => ({
        label: s.observation,
        open: s.openCount,
        closed: s.closedCount,
        rate: s.closureRate,
      })),
    },
    milestones,
    hindrances,
    risks,
    plannedActual,
    legalApprovals,
    manpower,
    activityLines,
    sorStats,
  });
});

progressRouter.post(
  "/:projectId/milestones",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const plannedDays = Number(body.plannedDays || 0);
    const actualDays = Number(body.actualDays || 0);
    const row = await prisma.progressMilestone.create({
      data: {
        projectId: req.params.projectId,
        code: body.code || null,
        category: body.category || null,
        activity: String(body.activity || "Milestone"),
        plannedStart: body.plannedStart ? new Date(body.plannedStart) : null,
        plannedEnd: body.plannedEnd ? new Date(body.plannedEnd) : null,
        plannedDays,
        actualStart: body.actualStart ? new Date(body.actualStart) : null,
        actualEnd: body.actualEnd ? new Date(body.actualEnd) : null,
        actualDays,
        varianceDays: Number(body.varianceDays ?? actualDays - plannedDays),
        weightage: Number(body.weightage || 0),
        pctComplete: Number(body.pctComplete || 0),
        stakeholder: body.stakeholder || null,
        zone: body.zone || null,
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

progressRouter.patch(
  "/:projectId/milestones/:milestoneId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "code",
      "category",
      "activity",
      "status",
      "stakeholder",
      "zone",
    ] as const) {
      if (body[k] != null) data[k] = body[k];
    }
    for (const k of ["plannedDays", "actualDays", "varianceDays", "weightage", "pctComplete"] as const) {
      if (body[k] != null) data[k] = Number(body[k]);
    }
    for (const k of ["plannedStart", "plannedEnd", "actualStart", "actualEnd"] as const) {
      if (body[k] !== undefined) data[k] = body[k] ? new Date(body[k]) : null;
    }
    const row = await prisma.progressMilestone.update({
      where: { id: req.params.milestoneId },
      data,
    });
    res.json(row);
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
        baselineStart: body.baselineStart ? new Date(body.baselineStart) : null,
        scheduleImpact: Number(body.scheduleImpact || 0),
        delayType: body.delayType || null,
        status: body.status || "Open",
        accountable: body.accountable || null,
        remarks: body.remarks || null,
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

progressRouter.post(
  "/:projectId/legal",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const row = await prisma.progressLegalApproval.create({
      data: {
        projectId: req.params.projectId,
        approvalId: String(body.approvalId || `LA-${Date.now().toString(36)}`),
        category: body.category || null,
        authority: body.authority || null,
        description: String(body.description || ""),
        packageName: body.packageName || null,
        submissionDate: body.submissionDate ? new Date(body.submissionDate) : null,
        requiredBy: body.requiredBy ? new Date(body.requiredBy) : null,
        receivedDate: body.receivedDate ? new Date(body.receivedDate) : null,
        status: body.status || "Submitted",
        delayDays: Number(body.delayDays || 0),
        responsible: body.responsible || null,
        remarks: body.remarks || null,
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
