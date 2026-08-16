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

export const wprMakerRouter = Router();
wprMakerRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function parseEnd(v: unknown): Date {
  const s = typeof v === "string" ? v : "";
  const parsed = s ? new Date(s) : new Date();
  const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  // Snap to the following Sunday 23:59 to keep the "week ending" stable
  d.setHours(23, 59, 59, 999);
  return d;
}

function isoDate(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

async function seedSections(projectId: string, weekStart: Date, weekEnd: Date): Promise<WprSections> {
  const [
    project,
    stakeholders,
    matrix,
    capex,
    poList,
    hindrance,
    risk,
    legal,
    drawings,
    registerLines,
    submittals,
    milestones,
    plannedActual,
    cashflow,
    qap,
    cubes,
    safety,
    ncrs,
    weeklyDiaries,
    dprSnaps,
  ] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { fullName: true, email: true, phone: true } } },
      take: 40,
    }),
    prisma.communicationMatrix.findMany({ where: { projectId, isActive: true }, take: 40 }),
    prisma.projectCapex.findMany({ where: { projectId }, take: 40 }),
    prisma.purchaseOrder.findMany({ where: { projectId }, take: 40 }),
    prisma.progressHindrance.findMany({ where: { projectId }, take: 40 }),
    prisma.progressRisk.findMany({ where: { projectId }, take: 40 }),
    prisma.progressLegalApproval.findMany({ where: { projectId }, take: 40 }),
    prisma.drawing.findMany({
      where: { projectId },
      include: { revisions: { orderBy: { createdAt: "desc" }, take: 1 } },
      take: 60,
    }),
    prisma.drawingRegisterLine.findMany({
      where: { projectId },
      orderBy: { srNo: "asc" },
      take: 80,
      include: { drawing: { select: { isPublished: true, currentRev: true } } },
    }),
    prisma.submittal.findMany({ where: { projectId }, take: 40 }),
    prisma.progressMilestone.findMany({ where: { projectId }, take: 60 }),
    prisma.progressPlannedActual.findMany({ where: { projectId }, take: 40 }),
    prisma.costCashflowPeriod.findMany({ where: { projectId }, take: 40 }),
    prisma.qapActivity.findMany({
      where: { projectId },
      orderBy: { weekLabel: "desc" },
      take: 40,
    }),
    prisma.cubeTest.findMany({
      where: {
        projectId,
        OR: [{ castDate: { gte: weekStart, lte: weekEnd } }, { castDate: null }],
      },
      take: 40,
      orderBy: { castDate: "desc" },
    }),
    prisma.safetyRecord.findMany({
      where: { projectId, occurredAt: { gte: weekStart, lte: weekEnd } },
      take: 40,
    }),
    prisma.qualityNcr.findMany({
      where: {
        projectId,
        OR: [{ issueDate: { gte: weekStart, lte: weekEnd } }, { status: "Open" }],
      },
      take: 40,
    }),
    prisma.dailyLog.findMany({
      where: { projectId, logDate: { gte: weekStart, lte: weekEnd } },
      include: { manpower: true },
      orderBy: { logDate: "asc" },
    }),
    prisma.dprSnapshot.findMany({
      where: { projectId, logDate: { gte: weekStart, lte: weekEnd } },
      orderBy: { logDate: "asc" },
    }),
  ]);

  const brief: WprSection = {
    title: DEFAULT_WPR_TITLES.brief,
    notes:
      project?.name && project?.clientName
        ? `The ${project.name} project for ${project.clientName} is a ${project.designConsultant || "PMC"}-monitored construction package. This week covers physical progress, safety, quality, drawings, cost and stakeholder actions.`
        : "Add a short brief describing the project — client, location, scope, start / finish dates, and the intent of this weekly pack.",
    headers: ["Field", "Value"],
    rows: [
      ["Construction Start", project?.startDate ? isoDate(project.startDate) : ""],
      ["Construction End (target)", project?.endDate ? isoDate(project.endDate) : ""],
      ["Project Type", "Construction / Industrial"],
      ["Contract Type", "Item Rate Contract"],
      ["Client", project?.clientName || ""],
      ["Design Consultant", project?.designConsultant || ""],
      ["Contractor", project?.contractorName || ""],
      ["Location", project?.location || ""],
    ],
  };

  const stakeholdersSec: WprSection = {
    title: DEFAULT_WPR_TITLES.stakeholders,
    headers: ["Name", "Role", "Company", "Email", "Phone"],
    rows: stakeholders.map((m: any) => [
      m.user?.fullName || "",
      m.role || "",
      "",
      m.user?.email || "",
      m.user?.phone || "",
    ]),
  };

  const communicationMatrix: WprSection = {
    title: DEFAULT_WPR_TITLES.communicationMatrix,
    headers: ["Communication Type", "From role", "To role", "Channel", "SLA"],
    rows: matrix.map((r: any) => [r.communicationType, r.fromRole, r.toRole, r.channel, r.slaDays ?? ""]),
  };

  const capexSec: WprSection = {
    title: DEFAULT_WPR_TITLES.capex,
    headers: ["Sr", "Description", "Package", "Stakeholder", "Budgeted", "WO Value"],
    rows: capex.map((c: any, i: number) => [c.srNo || i + 1, c.description || "", c.packageName || "", c.stakeholder || "", c.budgetedAmount || 0, c.workOrderValue || 0]),
  };

  const prTracker: WprSection = {
    title: DEFAULT_WPR_TITLES.prTracker,
    headers: ["Sr", "PO No", "Vendor", "Trade / Package", "Original ₹", "Certified ₹", "Status"],
    rows: poList.map((p: any, i: number) => [i + 1, p.poNumber || "", p.vendorName || "", p.workTrade || p.packageName || "", p.originalValue || 0, p.totalCertified || 0, p.status || ""]),
  };

  const hindranceSec: WprSection = {
    title: DEFAULT_WPR_TITLES.hindrance,
    headers: ["Sr", "Description", "Location", "Category", "Days impact", "Status"],
    rows: hindrance.map((h: any, i: number) => [i + 1, h.description || "", h.location || "", h.category || "", h.daysImpacted || 0, h.status || ""]),
  };

  const riskSec: WprSection = {
    title: DEFAULT_WPR_TITLES.risk,
    headers: ["Code", "Category", "Name", "Probability", "Consequence", "Severity", "Status"],
    rows: risk.map((r: any) => [r.code || "", r.category || "", r.name || "", r.probability || 0, r.consequence || 0, r.severity || 0, r.status || ""]),
  };

  const legalSec: WprSection = {
    title: DEFAULT_WPR_TITLES.legal,
    headers: ["Approval ID", "Category", "Authority", "Description", "Required by", "Status"],
    rows: legal.map((r: any) => [r.approvalId || "", r.category || "", r.authority || "", r.description || "", r.requiredBy ? isoDate(r.requiredBy) : "", r.status || ""]),
  };

  const drawingRegister: WprSection = {
    title: DEFAULT_WPR_TITLES.drawingRegister,
    headers: ["Dwg No", "Title", "Discipline", "Type", "Rev", "Status", "Critical"],
    rows: (registerLines.length ? registerLines : drawings).map((d: any) => [
      (d.drawingNumber || "").replace(/\s·\s*\d+$/, ""),
      d.drawingTitle || d.title || "",
      d.discipline || "",
      d.drawingType || "",
      d.revisionNumber || d.currentRev || d.drawing?.currentRev || "",
      d.drawing?.isPublished || d.drawingId ? "Linked GFC" : d.isPublished ? "Published" : "Register only",
      d.criticalDrawing || "",
    ]),
  };

  const designStatus: WprSection = {
    title: DEFAULT_WPR_TITLES.designStatus,
    headers: ["Sr", "Discipline", "Status", "Percentage", "Remark"],
    rows: [
      [1, "Architectural", "In progress", "", ""],
      [2, "Structural", "In progress", "", ""],
      [3, "Electrical", "In progress", "", ""],
      [4, "Plumbing", "In progress", "", ""],
      [5, "Fire Protection", "In progress", "", ""],
    ],
  };

  const procurement: WprSection = {
    title: DEFAULT_WPR_TITLES.procurement,
    headers: ["Nomenclature", "Package", "Status"],
    rows: [
      ["DC", "A. Design Consultancy", "In progress"],
      ["CP", "B. Civil Packages", "In progress"],
      ["EP", "C. Electrical Packages", "In progress"],
      ["FP", "D. Fire Protection Packages", "In progress"],
      ["PP", "E. Plumbing Packages", "In progress"],
    ],
  };

  const milestonesSec: WprSection = {
    title: DEFAULT_WPR_TITLES.milestones,
    headers: ["Code", "Activity", "Plan days", "Actual days", "Variance", "Status"],
    rows: milestones.map((m: any) => [m.code || "", m.activity || "", m.plannedDays || 0, m.actualDays || 0, m.varianceDays || 0, m.status || ""]),
  };

  const manpowerRows =
    weeklyDiaries.length > 0
      ? weeklyDiaries.map((d: any) => [
          isoDate(d.logDate),
          d.manpower.reduce((s: number, m: any) => s + (m.workerCount || 0), 0),
        ])
      : dprSnaps.map((snap: any) => {
          const extras = JSON.parse(snap.headerJson || "{}")._extras || {};
          const mp = extras.manpower || [];
          const total = mp.reduce((s: number, m: any) => s + Number(m.actual || 0), 0);
          return [isoDate(snap.logDate), total];
        });

  const manpower: WprSection = {
    title: DEFAULT_WPR_TITLES.manpowerHistogram,
    headers: ["Date", "Total workers"],
    rows: manpowerRows,
  };

  const executedRows: (string | number | null)[][] = [];
  let execSr = 1;
  for (const snap of dprSnaps) {
    const lines = JSON.parse(snap.linesJson || "[]") as { description?: string; qtyToday?: number; unit?: string }[];
    for (const ln of lines) {
      if (!Number(ln.qtyToday)) continue;
      executedRows.push([
        execSr++,
        snap.discipline,
        ln.description || "",
        ln.qtyToday ?? 0,
        ln.unit || "",
        isoDate(snap.logDate),
      ]);
    }
  }

  const weeklyExecuted: WprSection = {
    title: DEFAULT_WPR_TITLES.weeklyExecuted,
    notes:
      executedRows.length > 0
        ? "Auto-filled from published DPR snapshots this week."
        : "List activities executed this week per location (floor / block / grid). Attach progress photographs in the Photos section.",
    headers: ["Sr", "Discipline", "Activity", "Executed qty", "Unit", "DPR date"],
    rows: executedRows,
  };

  const cashflowSec: WprSection = {
    title: DEFAULT_WPR_TITLES.cashflow,
    headers: ["Period", "Package", "Planned", "Actual", "Variance"],
    rows: cashflow.map((c: any) => [c.periodLabel || "", c.packageName || "", c.plannedAmount || 0, c.actualAmount || 0, (c.actualAmount || 0) - (c.plannedAmount || 0)]),
  };

  const quality: WprSection = {
    title: DEFAULT_WPR_TITLES.quality,
    headers: ["Week", "Activity", "Discipline", "Contractor", "PMC", "Client", "Status"],
    rows: qap.map((q: any) => [q.weekLabel || "", q.activity || "", q.discipline || "", q.contractorOk ? "Yes" : "No", q.pmcOk ? "Yes" : "No", q.clientOk ? "Yes" : "No", q.status || ""]),
  };

  const cubeTest: WprSection = {
    title: DEFAULT_WPR_TITLES.cubeTest,
    headers: ["Sr", "Description", "Grade", "Strength", "Cast date", "Result"],
    rows: cubes.map((c: any, i: number) => [i + 1, c.description || "", c.grade || "", c.strength ?? "", c.castDate ? isoDate(c.castDate) : "", c.result || ""]),
  };

  const safetyIndicators = {
    tbt: safety.filter((s: any) => (s.recordType || "").toLowerCase().includes("tool")).length,
    incidents: safety.filter((s: any) => (s.recordType || "").toLowerCase().includes("incident")).length,
    inductions: safety.filter((s: any) => (s.recordType || "").toLowerCase().includes("induct")).length,
    other: safety.length,
  };
  const safetySec: WprSection = {
    title: DEFAULT_WPR_TITLES.safety,
    headers: ["HSE indicator", "Previous week (PW)", "Current week (CW)", "Cumulative"],
    rows: [
      ["Toolbox Talk", 0, safetyIndicators.tbt, safetyIndicators.tbt],
      ["HSE Inductions", 0, safetyIndicators.inductions, safetyIndicators.inductions],
      ["Incidents / Accidents", 0, safetyIndicators.incidents, safetyIndicators.incidents],
      ["Total safety events", 0, safetyIndicators.other, safetyIndicators.other],
    ],
    notes: ncrs.length ? `${ncrs.length} NCR/CAR items open — please review.` : "No open NCRs recorded.",
  };

  const plannedVsActualSec: WprSection = {
    title: DEFAULT_WPR_TITLES.plannedVsActual,
    headers: ["Period", "Package", "Planned %", "Actual %", "Variance %"],
    rows: plannedActual.map((r: any) => [r.periodLabel || "", r.packageName || "", r.plannedPct ?? "", r.actualPct ?? "", (r.actualPct || 0) - (r.plannedPct || 0)]),
  };

  const materialStock: WprSection = {
    title: DEFAULT_WPR_TITLES.materialStock,
    headers: ["Material", "Unit", "Opening", "Received", "Consumed", "Balance"],
    rows: [],
    notes: "Fill in from site stock register for this week.",
  };

  const progressPictures: WprSection = {
    title: DEFAULT_WPR_TITLES.progressPictures,
    notes:
      "Attach 6–10 photos captured this week. Photos uploaded via the Site Pilot are already saved to the SharePoint DPR folder — paste those SharePoint paths here.",
    photos: [],
  };

  const cover: WprSection = {
    title: "WEEKLY PROGRESS REPORT",
    notes: `${project?.name || ""} — Report Week ending ${isoDate(weekEnd)}`,
  };
  const indexSec: WprSection = {
    title: "Index",
    headers: ["No", "Section"],
    rows: [
      [1, "Project Brief"],
      [2, "Project Stakeholders"],
      [3, "Mobilisation Plan"],
      [4, "Communication Matrix"],
      [5, "Project Dashboard"],
      [6, "Critical Areas"],
      [7, "Project CAPEX"],
      [8, "PR Tracker"],
      [9, "Hindrance Register"],
      [10, "Risk Register"],
      [11, "Legal Approvals"],
      [12, "Drawing Register / DCI"],
      [13, "Design Status"],
      [14, "Procurement Status"],
      [15, "Project Milestone Schedule"],
      [16, "Manpower Histogram"],
      [17, "Weekly Executed Plan"],
      [18, "Cashflow Overview"],
      [19, "Quality Updates (QAP)"],
      [20, "Cube Test"],
      [21, "Safety Updates"],
      [22, "Planned vs Actual"],
      [23, "Material Stock"],
      [24, "Progress Pictures"],
    ],
  };

  const mobilisation: WprSection = {
    title: DEFAULT_WPR_TITLES.mobilisation,
    notes:
      "Attach a mobilisation site plan photo — steel yard, office container, labour colony, store, QC lab, toilets, etc. Use the Photos section below to link SharePoint image paths.",
    photos: [],
  };
  const projectDashboard: WprSection = {
    title: DEFAULT_WPR_TITLES.projectDashboard,
    notes: "Insert the KPI dashboard image (or fill the KPI table).",
    headers: ["KPI", "Value"],
    rows: [],
  };
  const criticalAreas: WprSection = {
    title: DEFAULT_WPR_TITLES.criticalAreas,
    notes: "List critical areas of concern this week — schedule, quality, safety, procurement.",
    rows: [],
  };

  return {
    cover,
    index: indexSec,
    brief,
    stakeholders: stakeholdersSec,
    mobilisation,
    communicationMatrix,
    projectDashboard,
    criticalAreas,
    capex: capexSec,
    prTracker,
    hindrance: hindranceSec,
    risk: riskSec,
    legal: legalSec,
    drawingRegister,
    designStatus,
    procurement,
    milestones: milestonesSec,
    manpowerHistogram: manpower,
    weeklyExecuted,
    cashflow: cashflowSec,
    quality,
    cubeTest,
    safety: safetySec,
    plannedVsActual: plannedVsActualSec,
    materialStock,
    progressPictures,
  };
}

wprMakerRouter.get("/:projectId", async (req, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const weekEnd = parseEnd(req.query.end);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

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
  const sections: WprSections = existing
    ? JSON.parse(existing.sectionsJson || "{}")
    : await seedSections(projectId, weekStart, weekEnd);

  res.json({
    projectId,
    projectCode: project.code,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    reportNumber: existing?.reportNumber,
    header,
    sections,
    status: existing?.status || "Draft",
    publishedAt: existing?.publishedAt,
    publishedPath: existing?.publishedPath,
  });
});

wprMakerRouter.post("/:projectId/save", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const weekEnd = parseEnd(req.body.weekEnding);
  const sections: WprSections = req.body.sections || {};
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
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const weekEnd = parseEnd(req.query.end);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
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
  const sections: WprSections = existing
    ? JSON.parse(existing.sectionsJson || "{}")
    : await seedSections(projectId, weekStart, weekEnd);
  const buf = buildWprWorkbook({ header, sections });
  const fname = `WPR-${project.code}-${weekEnd.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

/** Client workbook — fills WPR File.xlsx template tabs (21 sheets) from live data. */
wprMakerRouter.get("/:projectId/download-client.xlsx", async (req, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const weekEnd = parseEnd(req.query.end);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const { buildWprClientWorkbook } = await import("../services/wprClientPack.js");
  const buf = await buildWprClientWorkbook(prisma, projectId, weekStart, weekEnd);
  const fname = `WPR-ClientPack-${project.code}-${weekEnd.toISOString().slice(0, 10)}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

wprMakerRouter.get("/:projectId/download.pptx", async (req, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const weekEnd = parseEnd(req.query.end);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
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
  const sections: WprSections = existing
    ? JSON.parse(existing.sectionsJson || "{}")
    : await seedSections(projectId, weekStart, weekEnd);
  const buf = await buildWprPptx({ header, sections });
  const fname = `WPR-${project.code}-${weekEnd.toISOString().slice(0, 10)}.pptx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(buf);
});

wprMakerRouter.post("/:projectId/publish", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return res.status(404).json({ error: "project not found" });
  const weekEnd = parseEnd(req.body.weekEnding);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const existing = await prisma.wprSnapshot.findUnique({
    where: { projectId_weekEnding: { projectId, weekEnding: weekEnd } },
  });
  if (!existing) return res.status(404).json({ error: "save the WPR draft first" });

  const header: WprHeader = {
    projectName: project.name,
    projectCode: project.code,
    reportNumber: existing.reportNumber || undefined,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    clientName: project.clientName || "",
    designConsultant: project.designConsultant || "",
    contractorName: project.contractorName || "",
    location: project.location || "",
    pmc: "Sharnam Project Development Consultants & Co.",
  };
  const sections: WprSections = JSON.parse(existing.sectionsJson || "{}");
  const buf = buildWprWorkbook({ header, sections });

  const dateStr = weekEnd.toISOString().slice(0, 10);
  const fname = `WPR-${project.code}-${dateStr}.xlsx`;
  const folder = MODULE_TO_ISO_FOLDER.wpr;
  const saved = await mockOneDrive.upload(project.code, folder, fname, buf);

  const updated = await prisma.wprSnapshot.update({
    where: { id: existing.id },
    data: { status: "Published", publishedAt: new Date(), publishedPath: saved.path },
  });

  await audit("wpr.published", {
    userId: req.user!.id,
    entity: "WprSnapshot",
    entityId: existing.id,
    meta: { weekEnding: dateStr, path: saved.path, provider: saved.provider },
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
