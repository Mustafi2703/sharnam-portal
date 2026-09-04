/**
 * Auto-seed WPR sections from live project data (shared by WPR Maker routes + demo seed).
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_WPR_TITLES, type WprSection, type WprSections } from "./wprXlsx.js";

function isoDate(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export async function seedWprSections(
  prisma: PrismaClient,
  projectId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WprSections> {
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
    progressManpower,
    activityLines,
    photos,
    qap,
    cubes,
    safety,
    safetyPrev,
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
    prisma.progressMilestone.findMany({ where: { projectId }, take: 130 }),
    prisma.progressPlannedActual.findMany({ where: { projectId }, take: 80 }),
    prisma.costCashflowPeriod.findMany({
      where: {
        projectId,
        NOT: { packageName: "COP-day" },
      },
      orderBy: { periodDate: "asc" },
      take: 80,
    }),
    prisma.progressManpower.findMany({ where: { projectId }, orderBy: { rank: "asc" }, take: 40 }),
    prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 80 }),
    prisma.projectPhoto.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.qapActivity.findMany({
      where: { projectId },
      orderBy: { weekLabel: "desc" },
      take: 100,
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
    prisma.safetyRecord.findMany({
      where: {
        projectId,
        occurredAt: {
          gte: new Date(weekStart.getTime() - (weekEnd.getTime() - weekStart.getTime()) - 86400000),
          lt: weekStart,
        },
      },
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

  void submittals;

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
    rows: capex.map((c: any, i: number) => [
      c.srNo || i + 1,
      c.description || "",
      c.packageName || "",
      c.stakeholder || "",
      c.budgetedAmount || 0,
      c.workOrderValue || 0,
    ]),
  };

  const prTracker: WprSection = {
    title: DEFAULT_WPR_TITLES.prTracker,
    headers: ["Sr", "PO No", "Vendor", "Trade / Package", "Original ₹", "Certified ₹", "Status"],
    rows: poList.map((p: any, i: number) => [
      i + 1,
      p.poNumber || "",
      p.vendorName || "",
      p.workTrade || p.packageName || "",
      p.originalValue || 0,
      p.totalCertified || 0,
      p.status || "",
    ]),
  };

  const hindranceSec: WprSection = {
    title: DEFAULT_WPR_TITLES.hindrance,
    headers: ["Sr", "Description", "Location", "Category", "Days impact", "Status"],
    rows: hindrance.map((h: any, i: number) => [
      i + 1,
      h.description || "",
      h.location || "",
      h.category || "",
      h.daysImpacted || 0,
      h.status || "",
    ]),
  };

  const riskSec: WprSection = {
    title: DEFAULT_WPR_TITLES.risk,
    headers: ["Code", "Category", "Name", "Probability", "Consequence", "Severity", "Status"],
    rows: risk.map((r: any) => [
      r.code || "",
      r.category || "",
      r.name || "",
      r.probability || 0,
      r.consequence || 0,
      r.severity || 0,
      r.status || "",
    ]),
  };

  const legalSec: WprSection = {
    title: DEFAULT_WPR_TITLES.legal,
    headers: ["Approval ID", "Category", "Authority", "Description", "Required by", "Status"],
    rows: legal.map((r: any) => [
      r.approvalId || "",
      r.category || "",
      r.authority || "",
      r.description || "",
      r.requiredBy ? isoDate(r.requiredBy) : "",
      r.status || "",
    ]),
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
    rows: milestones.map((m: any) => [
      m.code || "",
      m.activity || "",
      m.plannedDays || 0,
      m.actualDays || 0,
      m.varianceDays || 0,
      m.status || "",
    ]),
  };

  const diaryManpowerRows =
    weeklyDiaries.length > 0
      ? weeklyDiaries.map((d: any) => [
          isoDate(d.logDate),
          d.manpower.reduce((s: number, m: any) => s + (m.workerCount || 0), 0),
          "",
          "",
          "",
        ])
      : dprSnaps.map((snap: any) => {
          const extras = JSON.parse(snap.headerJson || "{}")._extras || {};
          const mp = extras.manpower || [];
          const total = mp.reduce((s: number, m: any) => s + Number(m.actual || 0), 0);
          return [isoDate(snap.logDate), total, "", "", ""];
        });

  const tradeManpowerRows = progressManpower.map((m: any) => [
    m.trade || "",
    m.required || 0,
    m.available || 0,
    m.shortage || 0,
    m.shortagePct != null ? `${Math.round((m.shortagePct || 0) * 100)}%` : "",
  ]);

  const manpower: WprSection = {
    title: DEFAULT_WPR_TITLES.manpowerHistogram,
    notes:
      tradeManpowerRows.length > 0
        ? "Trade shortage from Planned Vs Actual Dashboard; daily totals from day log / DPR."
        : "Fill Weekly manpower on Progress → Planned vs Actual (manpower sub-tool).",
    headers: ["Trade / Date", "Required / Total", "Available", "Shortage", "% shortage"],
    rows: tradeManpowerRows.length > 0 ? tradeManpowerRows : diaryManpowerRows,
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

  /** Prefer Cost cashflow; fall back / merge Progress PlannedActual amounts for WPR cashflow slides. */
  const cashflowRows =
    cashflow.length > 0
      ? cashflow.map((c: any) => [
          c.periodLabel || "",
          c.packageName || "",
          c.plannedAmount || 0,
          c.actualAmount || 0,
          (c.actualAmount || 0) - (c.plannedAmount || 0),
        ])
      : plannedActual.map((r: any) => [
          r.periodLabel || "",
          r.packageName || "Overall",
          r.plannedAmount || 0,
          r.actualAmount || 0,
          (r.actualAmount || 0) - (r.plannedAmount || 0),
        ]);

  const cashflowSec: WprSection = {
    title: DEFAULT_WPR_TITLES.cashflow,
    notes:
      cashflow.length > 0
        ? "From Cost cashflow (Excel / COP sync). Keep Progress Planned vs Actual cashflow in sync via Progress → Sync to Cost."
        : "No Cost cashflow rows — showing Progress Planned vs Actual amounts. Import cashflow or sync from Progress.",
    headers: ["Period", "Package", "Planned", "Actual", "Variance"],
    rows: cashflowRows,
  };

  const quality: WprSection = {
    title: DEFAULT_WPR_TITLES.quality,
    headers: ["Week", "Activity", "Discipline", "Contractor", "PMC", "Client", "Status"],
    rows: qap.map((q: any) => [
      q.weekLabel || "",
      q.activity || "",
      q.discipline || "",
      q.contractorOk ? "Yes" : "No",
      q.pmcOk ? "Yes" : "No",
      q.clientOk ? "Yes" : "No",
      q.status || "",
    ]),
  };

  const cubeTest: WprSection = {
    title: DEFAULT_WPR_TITLES.cubeTest,
    headers: ["Sr", "Description", "Grade", "Strength", "Cast date", "Result"],
    rows: cubes.map((c: any, i: number) => [
      i + 1,
      c.description || "",
      c.grade || "",
      c.strength ?? "",
      c.castDate ? isoDate(c.castDate) : "",
      c.result || "",
    ]),
  };

  const safetyIndicators = {
    tbt: safety.filter((s: any) => (s.recordType || "").toLowerCase().includes("tool")).length,
    incidents: safety.filter((s: any) => (s.recordType || "").toLowerCase().includes("incident")).length,
    inductions: safety.filter((s: any) => (s.recordType || "").toLowerCase().includes("induct")).length,
    other: safety.length,
  };
  const safetyPrevIndicators = {
    tbt: safetyPrev.filter((s: any) => (s.recordType || "").toLowerCase().includes("tool")).length,
    incidents: safetyPrev.filter((s: any) => (s.recordType || "").toLowerCase().includes("incident")).length,
    inductions: safetyPrev.filter((s: any) => (s.recordType || "").toLowerCase().includes("induct")).length,
    other: safetyPrev.length,
  };
  const safetySec: WprSection = {
    title: DEFAULT_WPR_TITLES.safety,
    headers: ["HSE indicator", "Previous week (PW)", "Current week (CW)", "Cumulative"],
    rows: [
      ["Toolbox Talk", safetyPrevIndicators.tbt, safetyIndicators.tbt, safetyIndicators.tbt],
      ["HSE Inductions", safetyPrevIndicators.inductions, safetyIndicators.inductions, safetyIndicators.inductions],
      ["Incidents / Accidents", safetyPrevIndicators.incidents, safetyIndicators.incidents, safetyIndicators.incidents],
      ["Total safety events", safetyPrevIndicators.other, safetyIndicators.other, safetyIndicators.other],
    ],
    notes: ncrs.length ? `${ncrs.length} NCR/CAR items open — please review.` : "No open NCRs recorded.",
  };

  const pvaCashRows = plannedActual.map((r: any) => [
    r.periodLabel || "",
    r.packageName || "",
    r.plannedPct ?? "",
    r.actualPct ?? "",
    (r.actualPct || 0) - (r.plannedPct || 0),
    r.plannedAmount || 0,
    r.actualAmount || 0,
  ]);
  const pvaActivityRows = activityLines.map((a: any) => [
    a.srNo || "",
    a.tower || "",
    a.activity || "",
    a.unit || "",
    a.boqQty || 0,
    a.gfcQty || 0,
    a.executedQty || 0,
    a.weeklyPlanned || 0,
    a.weeklyActual || 0,
    a.pctComplete != null ? `${Math.round((a.pctComplete || 0) * 100)}%` : a.status || "",
  ]);

  const plannedVsActualSec: WprSection = {
    title: DEFAULT_WPR_TITLES.plannedVsActual,
    notes:
      pvaActivityRows.length > 0
        ? "Cashflow % from Progress Planned vs Actual; activity qty register below continues across slides."
        : "Import Planned Vs. Actual Dashboard.xlsx under Progress → Planned vs Actual.",
    headers:
      pvaActivityRows.length > 0
        ? ["Sr", "Tower", "Activity", "Unit", "BOQ", "GFC", "Executed", "Wk plan", "Wk act", "% / Status"]
        : ["Period", "Package", "Planned %", "Actual %", "Variance %", "Planned ₹", "Actual ₹"],
    rows: pvaActivityRows.length > 0 ? pvaActivityRows : pvaCashRows,
  };

  const materialStock: WprSection = {
    title: DEFAULT_WPR_TITLES.materialStock,
    headers: ["Material", "Unit", "Opening", "Received", "Consumed", "Balance"],
    rows: [],
    notes: "Fill in from site stock register for this week.",
  };

  const photoPaths = photos
    .map((p: any) => {
      const label = [p.album, p.description, p.location, p.trade].filter(Boolean).join(" · ");
      return label ? `${label} — ${p.fileUrl || ""}` : p.fileUrl || "";
    })
    .filter(Boolean);
  const progressPictures: WprSection = {
    title: DEFAULT_WPR_TITLES.progressPictures,
    notes:
      photoPaths.length > 0
        ? `${photoPaths.length} photo path(s) from Project Photos / Site Pilot this project.`
        : "Attach 6–10 photos captured this week. Upload via Photos / Site Pilot — paths appear here on next WPR sync.",
    headers: ["#", "Photo / SharePoint path"],
    rows: photoPaths.map((p: string, i: number) => [i + 1, p]),
    photos: photoPaths,
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
  const openNcrs = ncrs.filter((n: { status?: string }) => n.status === "Open").length;
  const dprDayCount = new Set(dprSnaps.map((s: { logDate: Date }) => new Date(s.logDate).toISOString().slice(0, 10))).size;
  const pvaLatest = plannedActual[plannedActual.length - 1];
  const plannedPct = pvaLatest?.plannedPct != null ? `${Math.round(Number(pvaLatest.plannedPct) * 1000) / 10}%` : "";
  const actualPct = pvaLatest?.actualPct != null ? `${Math.round(Number(pvaLatest.actualPct) * 1000) / 10}%` : "";
  const onTrack = milestones.filter(
    (m: { varianceDays?: number; status?: string }) =>
      (m.varianceDays || 0) <= 0 && (m.status || "").toLowerCase() !== "delayed"
  ).length;

  const projectDashboard: WprSection = {
    title: DEFAULT_WPR_TITLES.projectDashboard,
    notes: "Auto-filled from live Progress, DPR, Quality and Safety registers for this reporting window.",
    headers: ["KPI", "Value"],
    rows: [
      ["Reporting window", `${isoDate(weekStart)} → ${isoDate(weekEnd)}`],
      ["Planned progress %", plannedPct || "Import Progress → Planned vs Actual"],
      ["Actual progress %", actualPct || "—"],
      ["DPR days logged", dprDayCount || "No DPR in window — fill DPR Maker"],
      ["Open NCRs", openNcrs],
      ["QAP activities (project)", qap.length],
      ["Cube tests (window)", cubes.length],
      ["Safety events (window)", safety.length],
      ["Milestones on track", milestones.length ? `${onTrack} / ${milestones.length}` : "—"],
      ["Drawings in register", registerLines.length || drawings.length],
    ],
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
