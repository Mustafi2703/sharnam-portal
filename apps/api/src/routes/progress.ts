import { Router } from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { userCanAccessProject } from "../modules/_shared/projectAccess.js";
import { audit } from "../services/audit.js";
import { verifyProgressProject } from "../services/progressVerify.js";
import {
  buildPlannedActualWorkbook,
  importPlannedActualDashboard,
  renderPlannedActualHtml,
  syncActivityLinesFromCostBoq,
} from "../services/plannedActualDashboard.js";
import {
  importMsProjectToProgress,
  loadMsProjectSummary,
  seedDemoMsProject,
  generateDemoMsProjectXml,
} from "../services/msProjectSchedule.js";

export const progressRouter = Router();
progressRouter.use(requireAuth);
progressRouter.param("projectId", async (req: AuthedRequest, res, next, projectId) => {
  try {
    const ok = await userCanAccessProject(req, String(projectId));
    if (!ok) return res.status(404).json({ error: "Not found" });
    next();
  } catch (err) {
    next(err);
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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

/** Re-import Monthly SOR summary from Excel (fixes duplicate rows from older seeds). */
progressRouter.post("/:projectId/resync-sor", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const { resyncProgressSorStats } = await import("../services/progressSorParse.js");
  const rows = await resyncProgressSorStats(project.id);
  await audit("progress.sor.resync", { userId: req.user!.id, entity: "project", entityId: project.id, meta: { count: rows.length } });
  const report = await verifyProgressProject(project.id);
  res.json({ imported: rows.length, rows, verify: report });
});

/** Full DPR/WPR pack readiness (all modules / sheet sources) */
progressRouter.get("/:projectId/verify-pack", requireRoles("admin", "office", "employee"), async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const { verifyPackCompleteness } = await import("../services/packCompleteness.js");
  const report = await verifyPackCompleteness(project.id, {
    logDate: req.query.date ? new Date(String(req.query.date)) : undefined,
  });
  res.json({ project: { id: project.id, code: project.code, name: project.name }, ...report });
});

progressRouter.get("/:projectId/summary", async (req, res) => {
  const projectId = req.params.projectId;
  const [milestones, hindrances, risks, plannedActual, legalApprovals, manpower, activityLines, sorStats, boqLineCount, lessons] =
    await Promise.all([
      prisma.progressMilestone.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
      prisma.progressHindrance.findMany({ where: { projectId }, orderBy: { occurredAt: "desc" } }),
      prisma.progressRisk.findMany({ where: { projectId }, orderBy: { severity: "desc" } }),
      prisma.progressPlannedActual.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
      prisma.progressLegalApproval.findMany({ where: { projectId }, orderBy: { approvalId: "asc" } }),
      prisma.progressManpower.findMany({ where: { projectId }, orderBy: { rank: "asc" } }),
      prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
      prisma.progressSorStat.findMany({ where: { projectId } }),
      prisma.costMonitoringLine.count({ where: { projectId } }),
      prisma.lessonLearnt.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
    ]);

  const { readProgressOverviewDashboard } = await import("../services/progressRegistersImport.js");
  const overviewSheet = readProgressOverviewDashboard();

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
      boqLines: boqLineCount,
      projectProgressPct: weightedPct || 0,
      sheetProgressPct: overviewSheet?.sheetProgressPct ?? null,
      avgActualPct:
        plannedActual.length > 0
          ? plannedActual.reduce((s, p) => s + p.actualPct, 0) / plannedActual.length
          : 0,
    },
    overviewSheet,
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
    boqLineCount,
    sorStats,
    lessons,
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
    const existing = await prisma.progressMilestone.findFirst({
      where: { id: req.params.milestoneId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
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
      where: { id: existing.id },
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
        resolutionDescription: body.resolutionDescription || null,
        remarks: body.remarks || null,
      },
    });
    res.status(201).json(row);
  }
);

progressRouter.patch(
  "/:projectId/hindrances/:hindranceId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.progressHindrance.findFirst({
      where: { id: req.params.hindranceId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "description",
      "location",
      "activity",
      "correspondence",
      "category",
      "type",
      "delayType",
      "status",
      "accountable",
      "resolutionDescription",
      "remarks",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    for (const k of ["daysImpacted", "scheduleImpact"] as const) {
      if (body[k] != null) data[k] = Number(body[k]);
    }
    for (const k of ["occurredAt", "resolvedAt", "baselineStart"] as const) {
      if (body[k] !== undefined) data[k] = body[k] ? new Date(body[k]) : null;
    }
    const row = await prisma.progressHindrance.update({ where: { id: existing.id }, data });
    res.json(row);
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
        weeksLikely: Number(body.weeksLikely || 0),
        urgency: body.urgency || null,
        responseCategory: body.responseCategory || null,
        impactNotes: body.impactNotes || null,
        riskOwner: body.riskOwner || null,
        contingencyPlan: body.contingencyPlan || null,
        trackingComments: body.trackingComments || null,
        dateLastUpdated: body.dateLastUpdated ? new Date(body.dateLastUpdated) : null,
        status: body.status || "Open",
      },
    });
    res.status(201).json(row);
  }
);

progressRouter.patch(
  "/:projectId/risks/:riskId",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.progressRisk.findFirst({
      where: { id: req.params.riskId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "code",
      "category",
      "opportunityThreat",
      "name",
      "description",
      "status",
      "urgency",
      "responseCategory",
      "impactNotes",
      "riskOwner",
      "contingencyPlan",
      "trackingComments",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    for (const k of ["probability", "consequence", "severity"] as const) {
      if (body[k] != null) data[k] = Number(body[k]);
    }
    for (const k of ["probabilityPct", "costImpact", "weeksLikely"] as const) {
      if (body[k] != null) data[k] = Number(body[k]);
    }
    if (body.dateLastUpdated !== undefined) {
      data.dateLastUpdated = body.dateLastUpdated ? new Date(body.dateLastUpdated) : null;
    }
    const row = await prisma.progressRisk.update({ where: { id: existing.id }, data });
    res.json(row);
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
  "/:projectId/legal/:legalId",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.progressLegalApproval.findFirst({
      where: { id: req.params.legalId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const data: Record<string, unknown> = {};
    for (const k of [
      "approvalId",
      "category",
      "authority",
      "description",
      "packageName",
      "status",
      "responsible",
      "remarks",
    ] as const) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.delayDays != null) data.delayDays = Number(body.delayDays);
    for (const k of ["submissionDate", "requiredBy", "receivedDate"] as const) {
      if (body[k] !== undefined) data[k] = body[k] ? new Date(body[k]) : null;
    }
    const row = await prisma.progressLegalApproval.update({ where: { id: existing.id }, data });
    res.json(row);
  }
);

progressRouter.patch(
  "/:projectId/manpower/:manpowerId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.progressManpower.findFirst({
      where: { id: req.params.manpowerId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const required = body.required != null ? Number(body.required) : existing.required;
    const available = body.available != null ? Number(body.available) : existing.available;
    const shortage = Math.max(0, required - available);
    const shortagePct = required > 0 ? shortage / required : 0;
    const row = await prisma.progressManpower.update({
      where: { id: existing.id },
      data: {
        trade: body.trade != null ? String(body.trade) : undefined,
        required,
        available,
        shortage,
        shortagePct,
        rank: body.rank != null ? Number(body.rank) : undefined,
      },
    });
    res.json(row);
  }
);

progressRouter.post(
  "/:projectId/planned-actual",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const plannedAmount = Number(body.plannedAmount || 0);
    const actualAmount = Number(body.actualAmount || 0);
    const row = await prisma.progressPlannedActual.create({
      data: {
        projectId: req.params.projectId,
        periodLabel: String(body.periodLabel || "New period"),
        packageName: String(body.packageName || "Overall"),
        plannedAmount,
        actualAmount,
        plannedPct: plannedAmount > 0 ? 1 : 0,
        actualPct: plannedAmount > 0 ? actualAmount / plannedAmount : 0,
      },
    });
    await audit("progress.plannedActual.create", {
      userId: req.user!.id,
      entity: "ProgressPlannedActual",
      entityId: row.id,
      meta: { projectId: req.params.projectId },
    });
    res.status(201).json(row);
  }
);

progressRouter.post(
  "/:projectId/manpower",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const required = Number(body.required || 0);
    const available = Number(body.available || 0);
    const shortage = Math.max(0, required - available);
    const row = await prisma.progressManpower.create({
      data: {
        projectId: req.params.projectId,
        trade: String(body.trade || "Trade"),
        required,
        available,
        shortage,
        shortagePct: required > 0 ? shortage / required : 0,
        rank: Number(body.rank || 99),
      },
    });
    await audit("progress.manpower.create", {
      userId: req.user!.id,
      entity: "ProgressManpower",
      entityId: row.id,
      meta: { projectId: req.params.projectId },
    });
    res.status(201).json(row);
  }
);

progressRouter.patch(
  "/:projectId/planned-actual/:rowId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.progressPlannedActual.findFirst({
      where: { id: req.params.rowId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const plannedAmount = body.plannedAmount != null ? Number(body.plannedAmount) : existing.plannedAmount;
    const actualAmount = body.actualAmount != null ? Number(body.actualAmount) : existing.actualAmount;
    const actualPct = plannedAmount > 0 ? actualAmount / plannedAmount : 0;
    const row = await prisma.progressPlannedActual.update({
      where: { id: existing.id },
      data: {
        periodLabel: body.periodLabel != null ? String(body.periodLabel) : undefined,
        packageName: body.packageName != null ? String(body.packageName) : undefined,
        plannedAmount,
        actualAmount,
        actualPct,
        plannedPct: body.plannedPct != null ? Number(body.plannedPct) : existing.plannedPct,
      },
    });
    res.json(row);
  }
);

/** Re-import all progress register sheets from bundled SPDC Excel packs */
progressRouter.post(
  "/:projectId/resync-registers",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const force = Boolean(req.body?.force);
    const { syncProgressRegisterPack } = await import("../services/progressRegistersImport.js");
    const { syncProgressTemplates } = await import("../services/projectSheetPack.js");
    const registers = await syncProgressRegisterPack(project.id, { force: true });
    const planned = await syncProgressTemplates(project.id, { force: true });
    await audit("progress.registers.resync", {
      userId: req.user!.id,
      entity: "project",
      entityId: project.id,
      meta: { registers, planned },
    });
    const report = await verifyProgressProject(project.id);
    res.json({ ok: true, registers, planned, verify: report });
  }
);

/** Load Planned Vs. Actual + monthly SOR from bundled SPDC Excel (same as seed). */
progressRouter.post(
  "/:projectId/planned-actual/sync-template",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    try {
      const { syncProgressTemplates } = await import("../services/projectSheetPack.js");
      const out = await syncProgressTemplates(project.id, { force: Boolean(req.body?.force) });
      await audit("progress.syncTemplate", {
        userId: req.user!.id,
        entity: "ProgressActivityLine",
        entityId: project.id,
        meta: out,
      });
      res.json({ ok: true, ...out });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "Progress template sync failed" });
    }
  }
);

progressRouter.post(
  "/:projectId/activity-lines",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const activity = String(body.activity || "").trim();
    if (!activity) return res.status(400).json({ error: "activity required" });
    const last = await prisma.progressActivityLine.findFirst({
      where: { projectId: req.params.projectId },
      orderBy: { srNo: "desc" },
      select: { srNo: true },
    });
    const gfcQty = Number(body.gfcQty || 0);
    const executedQty = Number(body.executedQty || body.cumulativeQty || 0);
    const row = await prisma.progressActivityLine.create({
      data: {
        projectId: req.params.projectId,
        srNo: Number(body.srNo || (last?.srNo || 0) + 1),
        tower: body.tower || null,
        activity,
        unit: body.unit || null,
        plannedStart: body.plannedStart ? new Date(body.plannedStart) : null,
        plannedEnd: body.plannedEnd ? new Date(body.plannedEnd) : null,
        boqQty: Number(body.boqQty || 0),
        gfcQty,
        executedQty,
        balanceQty: gfcQty > 0 ? gfcQty - executedQty : 0,
        weeklyPlanned: Number(body.weeklyPlanned || 0),
        weeklyActual: Number(body.weeklyActual || 0),
        cumulativeQty: executedQty,
        status: body.status || "In progress",
        pctComplete: gfcQty > 0 ? executedQty / gfcQty : 0,
      },
    });
    await audit("progress.activity.create", {
      userId: req.user!.id,
      entity: "ProgressActivityLine",
      entityId: row.id,
      meta: { projectId: req.params.projectId },
    });
    res.status(201).json(row);
  }
);

progressRouter.patch(
  "/:projectId/activity-lines/:lineId",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.progressActivityLine.findFirst({
      where: { id: req.params.lineId, projectId: req.params.projectId },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const body = req.body || {};
    const gfcQty = body.gfcQty != null ? Number(body.gfcQty) : existing.gfcQty;
    const executedQty =
      body.executedQty != null
        ? Number(body.executedQty)
        : body.cumulativeQty != null
          ? Number(body.cumulativeQty)
          : existing.executedQty;
    const weeklyActual = body.weeklyActual != null ? Number(body.weeklyActual) : existing.weeklyActual;
    const cumulativeQty =
      body.cumulativeQty != null ? Number(body.cumulativeQty) : executedQty || existing.cumulativeQty;
    const balanceQty =
      body.balanceQty != null
        ? Number(body.balanceQty)
        : gfcQty > 0
          ? gfcQty - (executedQty || 0)
          : existing.balanceQty;
    const pctComplete =
      body.pctComplete != null
        ? Number(body.pctComplete)
        : gfcQty > 0
          ? (executedQty || 0) / gfcQty
          : existing.pctComplete;
    const row = await prisma.progressActivityLine.update({
      where: { id: existing.id },
      data: {
        activity: body.activity != null ? String(body.activity) : undefined,
        tower: body.tower !== undefined ? body.tower : undefined,
        unit: body.unit !== undefined ? body.unit : undefined,
        plannedStart:
          body.plannedStart !== undefined ? (body.plannedStart ? new Date(body.plannedStart) : null) : undefined,
        plannedEnd: body.plannedEnd !== undefined ? (body.plannedEnd ? new Date(body.plannedEnd) : null) : undefined,
        boqQty: body.boqQty != null ? Number(body.boqQty) : undefined,
        gfcQty,
        weeklyPlanned: body.weeklyPlanned != null ? Number(body.weeklyPlanned) : undefined,
        weeklyActual,
        executedQty,
        cumulativeQty,
        balanceQty,
        status: body.status != null ? String(body.status) : undefined,
        pctComplete,
      },
    });
    res.json(row);
  }
);
progressRouter.post(
  "/:projectId/planned-actual/import",
  requireRoles("admin", "office", "employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const file = (req as any).file as { buffer: Buffer; originalname: string } | undefined;
    if (!file?.buffer?.length) return res.status(400).json({ error: "Excel file required (field: file)" });
    try {
      const counts = await importPlannedActualDashboard(project.id, file.buffer);
      const { syncProgressCashflowToCost } = await import("../services/cashflowPvaSync.js");
      const sync = await syncProgressCashflowToCost(project.id);
      await audit("progress.plannedActual.import", {
        userId: req.user!.id,
        entity: "ProgressActivityLine",
        entityId: project.id,
        meta: { file: file.originalname, ...counts, cashflowSync: sync },
      });
      res.json({ ok: true, ...counts, cashflowSync: sync });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
    }
  }
);

/** Push Progress Planned vs Actual cashflow → Cost cashflow (WPR / Cost tabs stay aligned) */
progressRouter.post(
  "/:projectId/planned-actual/sync-cashflow",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const { syncProgressCashflowToCost } = await import("../services/cashflowPvaSync.js");
    const sync = await syncProgressCashflowToCost(project.id);
    await audit("progress.plannedActual.syncCashflow", {
      userId: req.user!.id,
      entity: "CostCashflowPeriod",
      entityId: project.id,
      meta: sync,
    });
    res.json({ ok: true, ...sync });
  }
);

progressRouter.get("/:projectId/planned-actual/download.xlsx", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const buf = await buildPlannedActualWorkbook(project.id);
  const fname = `Planned-Vs-Actual-${project.code}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

progressRouter.get("/:projectId/planned-actual/download.html", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const html = await renderPlannedActualHtml(project.id);
  const fname = `Planned-Vs-Actual-${project.code}.html`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(html);
});

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

/** Sync Progress activity register from Cost BOQ monitoring lines (per package). */
progressRouter.post(
  "/:projectId/activity-lines/sync-from-boq",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    try {
      const result = await syncActivityLinesFromCostBoq(project.id);
      await audit("progress.activityLines.syncBoq", {
        userId: req.user!.id,
        entity: "ProgressActivityLine",
        entityId: project.id,
        meta: result,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Sync failed" });
    }
  }
);

/** Per-discipline S-curve register — feeds DPR INPUT and WPR charts. */
progressRouter.get("/:projectId/scurve-points", async (req, res) => {
  const discipline = String(req.query.discipline || "OVERALL").toUpperCase();
  const rows = await prisma.progressScurvePoint.findMany({
    where: { projectId: req.params.projectId, discipline },
    orderBy: { periodDate: "asc" },
    take: 52,
  });
  res.json(rows);
});

progressRouter.post(
  "/:projectId/scurve-points",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const projectId = req.params.projectId;
    const discipline = String(req.body.discipline || "OVERALL").toUpperCase();
    const periodDate = new Date(String(req.body.periodDate || req.body.date));
    if (Number.isNaN(periodDate.getTime())) return res.status(400).json({ error: "periodDate required" });
    const row = await prisma.progressScurvePoint.upsert({
      where: {
        projectId_discipline_periodDate: { projectId, discipline, periodDate },
      },
      create: {
        projectId,
        discipline,
        periodDate,
        periodLabel: req.body.periodLabel ? String(req.body.periodLabel) : null,
        plannedPct: Number(req.body.plannedPct) || 0,
        actualPct: Number(req.body.actualPct) || 0,
        source: req.body.source ? String(req.body.source) : "manual",
      },
      update: {
        periodLabel: req.body.periodLabel != null ? String(req.body.periodLabel) : undefined,
        plannedPct: req.body.plannedPct != null ? Number(req.body.plannedPct) : undefined,
        actualPct: req.body.actualPct != null ? Number(req.body.actualPct) : undefined,
        source: req.body.source ? String(req.body.source) : undefined,
      },
    });
    res.json(row);
  }
);

progressRouter.delete(
  "/:projectId/scurve-points/:pointId",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    await prisma.progressScurvePoint.deleteMany({
      where: { id: req.params.pointId, projectId: req.params.projectId },
    });
    res.json({ ok: true });
  }
);

/** MS Project schedule — summary, S-curve, stored XML file */
progressRouter.get("/:projectId/ms-project/summary", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const summary = await loadMsProjectSummary(project.id);
  res.json({ project: { id: project.id, code: project.code, name: project.name }, ...summary });
});

progressRouter.get("/:projectId/ms-project/scurve", async (req, res) => {
  const summary = await loadMsProjectSummary(req.params.projectId);
  res.json({ scurve: summary.scurve, connected: summary.connected });
});

/** Seed demo MS Project XML + import tasks → milestones + S-curve rows */
progressRouter.post(
  "/:projectId/ms-project/seed-demo",
  requireRoles("admin", "office", "employee"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    try {
      const result = await seedDemoMsProject(project.id);
      await audit("progress.msProject.seedDemo", {
        userId: req.user!.id,
        entity: "ProgressPlannedActual",
        entityId: project.id,
        meta: { tasks: result.taskCount, scurve: result.scurvePoints, file: result.filePath },
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Seed failed" });
    }
  }
);

/** Import MS Project XML (.xml export from Project desktop / Project for the web) */
progressRouter.post(
  "/:projectId/ms-project/import",
  requireRoles("admin", "office", "employee"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const file = (req as { file?: { buffer: Buffer; originalname: string } }).file;
    if (!file?.buffer?.length) return res.status(400).json({ error: "MS Project XML required (field: file)" });
    if (!/\.xml$/i.test(file.originalname) && !file.buffer.toString("utf8", 0, 200).includes("<Project")) {
      return res.status(400).json({ error: "Upload MS Project XML export (.xml). MPP binary is not supported yet." });
    }
    try {
      const result = await importMsProjectToProgress(project.id, file.buffer, { fileName: file.originalname });
      await audit("progress.msProject.import", {
        userId: req.user!.id,
        entity: "ProgressMilestone",
        entityId: project.id,
        meta: { file: file.originalname, tasks: result.taskCount },
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
    }
  }
);

progressRouter.get("/:projectId/ms-project/download.xml", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const summary = await loadMsProjectSummary(project.id);
  const buf = summary.connected
    ? generateDemoMsProjectXml(project.code, project.name)
    : generateDemoMsProjectXml(project.code, project.name);
  const fname = `${project.code}-Schedule.xml`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});
