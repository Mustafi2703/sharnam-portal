/**
 * Auto-seed WPR sections from live project data (shared by WPR Maker routes + demo seed).
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_WPR_TITLES, type WprSection, type WprSections } from "./wprXlsx.js";
import { applyWprArvindDemoFill } from "./wprArvindDemoFill.js";

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
    matrixContacts,
    budgetWbs,
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
    cops,
    materialInvoices,
    valueAdditions,
    procurementLines,
    siteMaterials,
    prRequisitions,
    invoiceTrackers,
    sorStats,
  ] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { fullName: true, email: true, phone: true } } },
      take: 40,
    }),
    prisma.communicationMatrix.findMany({ where: { projectId, isActive: true }, take: 40 }),
    prisma.communicationContact.findMany({
      where: { projectId, isSectionHeader: false, matrixKind: "TECHNICAL" },
      orderBy: { sortOrder: "asc" },
      take: 60,
    }),
    prisma.costBudgetLine.findMany({ where: { projectId }, orderBy: [{ srNo: "asc" }], take: 80 }),
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
    prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 200 }),
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
    prisma.certificateOfPayment.findMany({ where: { projectId }, take: 20, orderBy: { certificateDate: "desc" } }),
    prisma.financeMaterialInvoice.findMany({ where: { projectId }, take: 30, orderBy: { invoiceDate: "desc" } }),
    prisma.progressValueAddition.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 40 }),
    prisma.progressProcurementLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 40 }),
    prisma.siteMaterialStock.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 40 }),
    prisma.progressPurchaseRequisition.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 80 }),
    prisma.progressInvoiceTracker.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 80 }),
    prisma.progressSorStat.findMany({ where: { projectId }, take: 20 }),
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
    rows: [
      ...matrix.map((r: any) => [r.communicationType, r.fromRole, r.toRole, r.channel, r.slaDays ?? ""]),
      ...matrixContacts.map((r: any) => [
        r.orgSection || "Contact",
        r.personName || "",
        r.mailRole || "CC",
        "Email",
        r.email || "",
      ]),
    ],
  };

  const capexSec: WprSection = {
    title: DEFAULT_WPR_TITLES.capex,
    notes: budgetWbs.length
      ? "Budget WBS from Cost → Budget tab (SPDC columns). Shown only in Project CAPEX — not duplicated in other WPR sections."
      : "Load budget template under Cost → Budget WBS, then Regenerate WPR.",
    headers: [
      "Sr",
      "Description",
      "Stakeholder",
      "Budgeted",
      "WO Amount",
      "Certified",
      "Forecast +",
      "Forecast −",
      "Non-tendered",
      "Gross Total",
      "Remarks",
    ],
    rows: budgetWbs.map((b: any) => [
      b.srNo || "",
      b.description || "",
      b.stakeholder || "",
      b.budgetedAmount || 0,
      b.workOrderAmount || 0,
      b.certifiedAmount || 0,
      b.forecastedAmount || 0,
      b.forecastReduction || 0,
      b.nonTendered || 0,
      b.grossTotal || 0,
      b.remarks || "",
    ]),
  };

  const prTracker: WprSection = {
    title: DEFAULT_WPR_TITLES.prTracker,
    headers: ["Sr", "PR No", "Type", "Discipline", "Amount ₹", "PO No", "Status"],
    rows:
      prRequisitions.length > 0
        ? prRequisitions.map((p: any) => [
            p.srNo || "",
            p.prNumber || "",
            p.prType || "",
            p.discipline || "",
            p.amount || 0,
            p.poNumber || "",
            p.poNumber ? "PO linked" : "Open",
          ])
        : poList.map((p: any, i: number) => [
            i + 1,
            p.poNumber || "",
            "PO",
            p.workTrade || p.packageName || "",
            p.originalValue || 0,
            p.poNumber || "",
            p.status || "",
          ]),
    notes: prRequisitions.length ? "From Finance → PR Tracker (client SAP PR register · ISO 05.01)." : "Import PR Tracker-52.xlsx under Finance → PR Tracker.",
  };

  const invoiceTracker: WprSection = {
    title: DEFAULT_WPR_TITLES.invoiceTracker,
    headers: ["Sr", "Name of work", "Invoice No", "PO", "Vendor", "Invoice date", "Amount excl. GST ₹", "COP status"],
    rows: invoiceTrackers.map((r: any) => [
      r.srNo || "",
      r.workName || "",
      r.invoiceNumber || "",
      r.poNumber || "",
      r.vendorName || "",
      r.invoiceDate ? isoDate(r.invoiceDate) : "",
      r.amountExclGst || 0,
      r.copStatus || "Open",
    ]),
    notes: invoiceTrackers.length
      ? "Invoice processing tracker — from Progress → WPR trackers (Invoice tab)."
      : "Import PR Tracker workbook (Invoicen Tracker sheet) or add rows from the Invoice popup.",
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

  const designDisciplines = new Map<string, { total: number; published: number }>();
  for (const d of drawings) {
    const disc = d.discipline || "General";
    const cur = designDisciplines.get(disc) || { total: 0, published: 0 };
    cur.total += 1;
    if (d.isPublished) cur.published += 1;
    designDisciplines.set(disc, cur);
  }
  const designStatus: WprSection = {
    title: DEFAULT_WPR_TITLES.designStatus,
    headers: ["Sr", "Discipline", "Status", "Published %", "Remark"],
    rows:
      designDisciplines.size > 0
        ? [...designDisciplines.entries()].map(([disc, v], i) => [
            i + 1,
            disc,
            v.published >= v.total ? "Complete" : "In progress",
            v.total ? `${Math.round((100 * v.published) / v.total)}%` : "—",
            `${v.published}/${v.total} sheets GFC`,
          ])
        : submittals.slice(0, 5).map((s: any, i: number) => [i + 1, s.submittalType || "Design", s.status || "Under Review", "", s.title || ""]),
  };

  const procurement: WprSection = {
    title: DEFAULT_WPR_TITLES.procurement,
    headers: ["Sr", "Work package", "Item", "Stakeholder", "Vendor appointed", "Target inquiry", "Priority"],
    rows:
      procurementLines.length > 0
        ? procurementLines.map((r: any) => [
            r.srNo || "",
            r.workPackage || "",
            (r.itemDescription || "").slice(0, 80),
            r.responsibleStakeholder || "",
            r.vendorAppointed ? "Yes" : "No",
            r.targetInquiryDate ? isoDate(r.targetInquiryDate) : "",
            r.priorityLevel || "",
          ])
        : poList.length > 0
          ? poList.map((po: any, i: number) => [
              i + 1,
              po.packageName || po.workTrade || po.poNumber,
              po.workTrade || "",
              po.vendorName || "—",
              po.status === "Active" ? "Yes" : "No",
              po.poDate ? isoDate(po.poDate) : "",
              "",
            ])
          : [[1, "Civil & Structural", "Main contractor package", "Client", "No", "", 1]],
    notes: procurementLines.length ? "Procurement tracker — inquiry float & vendor appointment." : "Import WPR client pack or add POs under Finance.",
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

  /** Prefer Cost cashflow periods only (₹). Never mix S-curve / PvA % rows here. */
  const cashflowOnly = cashflow.filter(
    (c: { packageName?: string }) => !String(c.packageName || "").toLowerCase().includes("s-curve")
  );
  const cashflowRows =
    cashflowOnly.length > 0
      ? cashflowOnly.map((c: any) => [
          c.periodLabel || "",
          c.packageName || "",
          c.plannedAmount || 0,
          c.actualAmount || 0,
          (c.actualAmount || 0) - (c.plannedAmount || 0),
        ])
      : [];

  const cashflowSec: WprSection = {
    title: DEFAULT_WPR_TITLES.cashflow,
    notes:
      cashflowOnly.length > 0
        ? "Monthly / period cashflow (₹) from Cost — separate from S-curve % and weekly activity qty."
        : "Import Cost cashflow or sync from Progress. Regenerate applies demo fill if empty.",
    headers: ["Period", "Package", "Planned", "Actual", "Variance"],
    rows: cashflowRows,
  };

  const quality: WprSection = {
    title: DEFAULT_WPR_TITLES.quality,
    headers: sorStats.length
      ? ["Sr", "Observation", "Total", "Open", "Closed"]
      : ["Week", "Activity", "Discipline", "Contractor", "PMC", "Client", "Status"],
    rows: sorStats.length
      ? sorStats.map((s: any, i: number) => [i + 1, s.observation || "", s.total ?? 0, s.openCount ?? 0, s.closedCount ?? 0])
      : qap.map((q: any) => [
          q.weekLabel || "",
          q.activity || "",
          q.discipline || "",
          q.contractorOk ? "Yes" : "No",
          q.pmcOk ? "Yes" : "No",
          q.clientOk ? "Yes" : "No",
          q.status || "",
        ]),
    notes: sorStats.length ? "Quality statistics — Site Observation / NCR counts (WPR client format)." : "QAP weekly sign-off rows.",
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

  const pvaCashRows = plannedActual
    .filter(
      (r: { packageName?: string }) =>
        r.packageName !== "MS Project S-curve" &&
        !String(r.packageName || "").toLowerCase().includes("s-curve")
    )
    .map((r: any) => [
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
        ? "Weekly physical qty by activity — Progress PvA register (not cashflow ₹ or S-curve %)."
        : "Import Planned Vs. Actual Dashboard.xlsx under Progress → Planned vs Actual.",
    headers:
      pvaActivityRows.length > 0
        ? ["Sr", "Tower", "Activity", "Unit", "BOQ", "GFC", "Executed", "Wk plan", "Wk act", "% / Status"]
        : ["Period", "Package", "Planned %", "Actual %", "Variance %", "Planned ₹", "Actual ₹"],
    rows: pvaActivityRows.length > 0 ? pvaActivityRows : pvaCashRows,
  };

  const materialStock: WprSection = {
    title: DEFAULT_WPR_TITLES.materialStock,
    headers: ["Sr", "Material", "Total purchase", "Balance", "Unit", "Location", "Date"],
    rows:
      siteMaterials.length > 0
        ? siteMaterials.map((m: any) => [
            m.srNo || "",
            m.materialName || "",
            m.totalPurchase || 0,
            m.balanceQuantity || 0,
            m.unit || "",
            m.location || "",
            m.recordDate ? isoDate(m.recordDate) : "",
          ])
        : materialInvoices.length > 0
          ? materialInvoices.slice(0, 12).map((m: any, i: number) => [
              i + 1,
              m.description || m.sheetCategory || m.taxInvoiceNo || "Material",
              m.amountWithoutGst || 0,
              "—",
              "Lot",
              "Finance",
              isoDate(m.receivedDate || m.invoiceDate),
            ])
          : [["1", "Cement / steel (site)", "—", "—", "MT", "Site", isoDate(weekEnd)]],
    notes: siteMaterials.length ? "Site materials stock register." : "Import Site Materials workbook or Finance material invoices.",
  };

  const valueAdditionSec: WprSection = {
    title: DEFAULT_WPR_TITLES.valueAddition,
    headers: ["Sr", "Block", "Package", "VE points", "Cost ₹", "Earlier quote ₹", "Final ₹", "Approval"],
    rows: valueAdditions.map((v: any) => [
      v.srNo || "",
      v.block || "",
      v.packageName || "",
      (v.valueEngineeringPoints || v.suggestions || "").slice(0, 120),
      v.cost || 0,
      v.earlierQuoted || 0,
      v.finalPrice || 0,
      v.approvalAuthority || v.status || "",
    ]),
    notes: valueAdditions.length ? "Value engineering / cost-time-quality improvements." : "Import WPR client pack → Value Addition sheet.",
  };

  const photoEntries = photos
    .map((p: any) => ({
      url: String(p.fileUrl || "").trim(),
      caption: [p.album, p.description, p.location, p.trade].filter(Boolean).join(" · "),
    }))
    .filter((e) => e.url);
  const progressPictures: WprSection = {
    title: DEFAULT_WPR_TITLES.progressPictures,
    notes:
      photoEntries.length > 0
        ? `${photoEntries.length} site photo(s) from Project Photos / Site Pilot — embedded in PPTX export.`
        : "Attach 6–10 photos captured this week. Upload via WPR Maker or Photos — paths appear here on next WPR sync.",
    headers: ["#", "Caption", "Path"],
    rows: photoEntries.map((e, i) => [i + 1, e.caption || "Site photo", e.url]),
    photos: photoEntries.map((e) => e.url),
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
      [9, "Invoice Processing Tracker"],
      [10, "Hindrance Register"],
      [11, "Risk Register"],
      [12, "Legal Approvals"],
      [13, "Drawing Register / DCI"],
      [14, "Design Status"],
      [15, "Procurement Status"],
      [16, "Project Milestone Schedule"],
      [17, "Manpower Histogram"],
      [18, "Weekly Executed Plan"],
      [19, "Cashflow Overview"],
      [20, "Quality Updates"],
      [21, "Cube Test"],
      [22, "Safety / HSE Updates"],
      [23, "Planned vs Actual"],
      [24, "Value Addition"],
      [25, "Material Stock"],
      [26, "Progress Pictures"],
    ],
  };

  const mobilisationPhotos = photos
    .filter((p: any) => /mobil|site|yard|camp|office/i.test(`${p.album} ${p.description} ${p.location}`))
    .map((p: any) => p.fileUrl || "")
    .filter(Boolean);
  const mobilisation: WprSection = {
    title: DEFAULT_WPR_TITLES.mobilisation,
    notes: "Mobilisation layout — steel yard, site office, labour colony, store, QC lab (from Project Photos).",
    headers: ["#", "Location / album", "SharePoint path"],
    rows: (mobilisationPhotos.length ? mobilisationPhotos : photos.slice(0, 4).map((p: any) => p.fileUrl || ""))
      .filter(Boolean)
      .map((url: string, i: number) => [i + 1, photos[i]?.album || "Site", url]),
    photos: mobilisationPhotos.length ? mobilisationPhotos : photos.slice(0, 4).map((p: any) => p.fileUrl).filter(Boolean),
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

  const certifiedCopTotal = cops
    .filter((c: { status?: string }) => ["Certified", "Approved", "Paid"].includes(c.status || ""))
    .reduce((s: number, c: { amountPayable?: number | null }) => s + Number(c.amountPayable || 0), 0);

  const projectDashboard: WprSection = {
    title: DEFAULT_WPR_TITLES.projectDashboard,
    notes: "Auto-filled from Progress, DPR, Quality, Safety, Finance (RA/COP) — same KPIs as project dashboard.",
    headers: ["KPI", "Value"],
    rows: [
      ["Reporting window", `${isoDate(weekStart)} → ${isoDate(weekEnd)}`],
      ["Planned progress %", plannedPct || "Import Progress → Planned vs Actual"],
      ["Actual progress %", actualPct || "—"],
      ["SPI / variance", plannedPct && actualPct ? `${actualPct} vs ${plannedPct}` : "—"],
      ["DPR days logged", dprDayCount || "No DPR in window — fill DPR Maker"],
      ["Open NCRs", openNcrs],
      ["Open RFIs / hindrances", `${hindrance.filter((h: { status?: string }) => h.status === "Open").length} hindrance · ${risk.filter((r: { status?: string }) => r.status === "Open").length} risk`],
      ["QAP activities (project)", qap.length],
      ["Cube tests (window)", cubes.length],
      ["Safety events (window)", safety.length],
      ["Milestones on track", milestones.length ? `${onTrack} / ${milestones.length}` : "—"],
      ["Drawings in register", registerLines.length || drawings.length],
      ["COP certified (₹ payable)", certifiedCopTotal ? certifiedCopTotal.toLocaleString("en-IN") : `${cops.length} COP(s)`],
      ["Purchase orders", poList.length],
    ],
  };

  const criticalRows: (string | number)[][] = [];
  hindrance
    .filter((h: { status?: string }) => (h.status || "").toLowerCase() === "open")
    .slice(0, 4)
    .forEach((h: any, i: number) => criticalRows.push([i + 1, "Hindrance", h.description || h.title || "—", h.impact || h.status || "Open"]));
  risk
    .filter((r: { status?: string }) => (r.status || "").toLowerCase() === "open")
    .slice(0, 3)
    .forEach((r: any, i: number) =>
      criticalRows.push([criticalRows.length + 1, "Risk", r.description || r.title || "—", r.likelihood || r.status || "Open"])
    );
  milestones
    .filter((m: { status?: string }) => (m.status || "").toLowerCase() === "delayed")
    .slice(0, 3)
    .forEach((m: any) =>
      criticalRows.push([criticalRows.length + 1, "Schedule", m.activity || m.code || "—", `Delayed · ${m.varianceDays || 0}d`])
    );

  const criticalAreas: WprSection = {
    title: DEFAULT_WPR_TITLES.criticalAreas,
    notes: "Open hindrances, risks, and delayed milestones from Progress registers.",
    headers: ["Sr", "Area", "Description", "Status / impact"],
    rows: criticalRows.length ? criticalRows : [["—", "None flagged", "All registers within tolerance this week", "—"]],
  };

  return applyWprArvindDemoFill(
    {
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
      invoiceTracker,
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
      valueAddition: valueAdditionSec,
      materialStock,
      progressPictures,
    },
    {
      projectName: project?.name,
      clientName: project?.clientName || undefined,
      weekStart,
      weekEnd,
    }
  );
}
