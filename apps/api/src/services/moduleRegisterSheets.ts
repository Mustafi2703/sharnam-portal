/**
 * Module dashboard exports mapped 1:1 to the client's register sheets
 * (Master Drawing Register, Approval & GFC log, Hindrance / Legal / Milestone / Planned vs Actual,
 * CAR register, Cube test, QAP detail, Safety register). Branded by workbookBuffer().
 */
import { prisma } from "../prisma.js";
import type { SheetSpec } from "./brandedExport.js";

type Cell = string | number | null | undefined;

function d(v?: Date | null): string {
  if (!v) return "";
  const x = new Date(v);
  return Number.isNaN(x.getTime()) ? "" : x.toISOString().slice(0, 10);
}
const n = (v?: number | null): Cell => (v === null || v === undefined ? "" : Math.round(v * 100) / 100);
const pct = (v?: number | null): Cell => (v === null || v === undefined ? "" : `${Math.round((v <= 1 ? v * 100 : v) * 10) / 10}%`);

async function drawingsSheets(projectId: string): Promise<SheetSpec[]> {
  const ex = await import("./drawingRegisterExport.js");
  const bundle = await ex.loadRegisterPivotBundle(projectId);
  const master: Cell[][] = [
    [
      "Sr #", "Project Package", "Building", "Discipline", "Drawing Number", "Drawing Title", "Drawing Type",
      "Consultant Name", "Revision Number", "Revision Date", "Revision Description", "Latest Revision",
      "Planned Submission Date", "Actual Submission Date", "Submission Delay (Days)", "Delay Responsibility",
      "Issued To", "Issue Date", "No. of Copies", "Critical Drawing", "Remarks",
    ],
    ...bundle.lines.map((l) => [
      l.srNo ?? "", l.projectPackage ?? "", l.building ?? "", l.discipline ?? "", l.drawingNumber, l.drawingTitle,
      l.drawingType ?? "", l.consultantName ?? "", l.revisionNumber ?? "", d(l.revisionDate), l.revisionDescription ?? "",
      l.latestRevision ?? "", d(l.plannedSubmissionDate), d(l.actualSubmissionDate), l.submissionDelayDays ?? "",
      l.delayResponsibility ?? "", l.issuedTo ?? "", d(l.issueDate), l.copiesCount ?? "", l.criticalDrawing ?? "", l.remarks ?? "",
    ]),
  ];
  const drawings = await prisma.drawing.findMany({
    where: { projectId },
    include: { revisions: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ discipline: "asc" }, { drawingNumber: "asc" }],
  });
  const slots = 6;
  const gfc: Cell[][] = [
    ["Discipline", "Building / Area", "TL No", "DWG No.", "Title", "Current Rev", ...Array.from({ length: slots }, (_, i) => `R${i}`), "Total"],
    ...drawings.map((dw) => {
      let total = 0;
      const dates = Array.from({ length: slots }, (_, s) => {
        const v = ex.revDateValue(ex.revisionForSlot(dw.revisions, s));
        if (v) total += 1;
        return v ? d(v) : "";
      });
      return [dw.discipline || "", dw.buildingArea || "", dw.tlNo || "", dw.drawingNumber, dw.title, dw.currentRev || "", ...dates, total];
    }),
  ];
  const coord = await ex.loadCoordinationRows(projectId);
  return [
    { name: "Master Drawing Register", rows: master },
    { name: "Approval & GFC Log", rows: gfc },
    { name: "Design Coordination", rows: [ex.COORDINATION_HEADERS, ...coord.rows] },
  ];
}

async function progressSheets(projectId: string): Promise<SheetSpec[]> {
  const [milestones, hindrances, legal, lines, manpower, risks] = await Promise.all([
    prisma.progressMilestone.findMany({ where: { projectId }, orderBy: [{ plannedStart: "asc" }, { code: "asc" }] }),
    prisma.progressHindrance.findMany({ where: { projectId }, orderBy: { occurredAt: "asc" } }),
    prisma.progressLegalApproval.findMany({ where: { projectId }, orderBy: { submissionDate: "asc" } }),
    prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: [{ srNo: "asc" }] }),
    prisma.progressManpower.findMany({ where: { projectId }, orderBy: { rank: "asc" } }),
    prisma.progressRisk.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
  ]);
  const today = new Date();
  return [
    {
      name: "Milestone Tracking",
      rows: [
        ["Milestone ID", "Phase", "Milestone Name", "Planned Start", "Planned End", "Planned Days", "Actual Start", "Actual End", "Actual Days", "Weightage", "% Complete", "Stakeholder", "Zone", "Status", "Delays"],
        ...milestones.map((m) => [
          m.code ?? "", m.category ?? "", m.activity, d(m.plannedStart), d(m.plannedEnd), n(m.plannedDays), d(m.actualStart), d(m.actualEnd),
          n(m.actualDays), n(m.weightage), pct(m.pctComplete), m.stakeholder ?? "", m.zone ?? "", m.status ?? "", n(m.varianceDays),
        ]),
      ],
    },
    {
      name: "Hindrance Register",
      rows: [
        ["Sr. No", "Description of Hindrance", "Location", "Critical Activity affected", "Correspondence", "Category", "Type of Hindrance", "Date of Occurrence", "Target Resolve Date", "No. of Days", "Baseline Start Date", "Schedule Impact", "Delay Type", "Accountable", "Status", "Description of Resolution", "Remarks"],
        ...hindrances.map((h, i) => [
          i + 1, h.description, h.location ?? "", h.activity ?? "", h.correspondence ?? "", h.category ?? "", h.type ?? "",
          d(h.occurredAt), d(h.resolvedAt), n(h.daysImpacted), d(h.baselineStart), h.scheduleImpact ?? "", h.delayType ?? "",
          h.accountable ?? "", h.status ?? "", h.resolutionDescription ?? "", h.remarks ?? "",
        ]),
      ],
    },
    {
      name: "Legal Approval Tracker",
      rows: [
        ["Approval ID", "Approval Category", "Authority Name", "Approval Description", "Applicable Building / Package", "Submission Date", "Required By", "Approval Received Date", "Status", "Delay (Days)", "Responsible Party", "Remarks"],
        ...legal.map((l) => {
          // Live delay: received − required, or today − required while still awaited.
          const due = l.requiredBy ? new Date(l.requiredBy) : null;
          const got = l.receivedDate ? new Date(l.receivedDate) : null;
          const live = due ? Math.round(((got || today).getTime() - due.getTime()) / 86400000) : null;
          const delay = l.delayDays ?? (live !== null && live > 0 ? live : null);
          return [
            l.approvalId ?? "", l.category ?? "", l.authority ?? "", l.description ?? "", l.packageName ?? "", d(l.submissionDate),
            d(l.requiredBy), d(l.receivedDate), l.status ?? "", n(delay), l.responsible ?? "", l.remarks ?? "",
          ];
        }),
      ],
    },
    {
      name: "Planned Vs Actual",
      rows: [
        ["Sr. No.", "Tower", "Activity", "Discipline", "Planned Start", "Planned End", "Unit", "BOQ Qty", "GFC Qty", "Executed Qty", "Balance Qty", "Weekly Planned Qty", "Weekly Actual Qty", "Cumulative Qty", "% Complete", "Status"],
        ...lines.map((a) => [
          a.srNo ?? "", a.tower ?? "", a.activity, a.discipline ?? "", d(a.plannedStart), d(a.plannedEnd), a.unit ?? "", n(a.boqQty),
          n(a.gfcQty), n(a.executedQty), n(a.balanceQty), n(a.weeklyPlanned), n(a.weeklyActual), n(a.cumulativeQty), pct(a.pctComplete), a.status ?? "",
        ]),
      ],
    },
    {
      name: "Manpower",
      rows: [
        ["Trade", "Required", "Available", "Shortage", "Shortage %"],
        ...manpower.map((m) => [m.trade, n(m.required), n(m.available), n(m.shortage), pct(m.shortagePct)]),
      ],
    },
    {
      name: "Risk Register",
      rows: [
        ["Risk ID", "Category", "Opportunity / Threat", "Risk", "Description", "Probability", "Consequence", "Severity", "Risk Owner", "Response", "Contingency Plan", "Status", "Last Updated"],
        ...risks.map((r) => [
          r.code ?? "", r.category ?? "", r.opportunityThreat ?? "", r.name ?? "", r.description ?? "", r.probability ?? "", r.consequence ?? "",
          r.severity ?? "", r.riskOwner ?? "", r.responseCategory ?? "", r.contingencyPlan ?? "", r.status ?? "", d(r.dateLastUpdated),
        ]),
      ],
    },
  ];
}

async function qualitySheets(projectId: string): Promise<SheetSpec[]> {
  const latestWeek = await prisma.qapActivity.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" }, select: { weekLabel: true } });
  const [ncrs, cubes, qap, sor, fills] = await Promise.all([
    prisma.qualityNcr.findMany({ where: { projectId }, orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }] }),
    prisma.cubeTest.findMany({ where: { projectId }, orderBy: [{ castDate: "asc" }, { createdAt: "asc" }] }),
    latestWeek ? prisma.qapActivity.findMany({ where: { projectId, weekLabel: latestWeek.weekLabel }, orderBy: [{ srNo: "asc" }, { createdAt: "asc" }] }) : [],
    prisma.progressSorStat.findMany({ where: { projectId } }),
    prisma.checklistSubmission.findMany({
      where: { assignment: { projectId, template: { checklistType: { in: ["QualityInspection", "ActivityInspection", "SiteExecution"] } } } },
      include: { assignment: { include: { template: { select: { name: true, checklistType: true } } } }, submittedBy: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);
  const yn = (b?: boolean) => (b ? "Yes" : "");
  return [
    {
      name: "CAR Register",
      rows: [
        ["No.", "NCR / CAR Issue Date", "Type", "Contractor", "Brief Description of Non Conformance", "Location", "Planned Closure Date", "Actual Closure Date", "Status"],
        ...ncrs.map((x) => [x.number ?? "", d(x.issueDate), x.ncrType ?? "", x.contractor ?? "", x.description, x.location ?? "", d(x.plannedClosure), d(x.actualClosure), x.status]),
      ],
    },
    {
      name: "Cube Test",
      rows: [
        ["Sample #", "Cast Date", "Description / Location", "Grade", "7-Day Test Date", "Strength at 7 Days (N/mm²)", "28-Day Test Date", "Strength at 28 Days (N/mm²)", "Average Strength", "Result", "Test Agency"],
        ...cubes.map((c) => [c.srNo ?? "", d(c.castDate), c.description, c.grade ?? "", d(c.testDate7), n(c.strength7), d(c.testDate28), n(c.strength28), n(c.avgStrength), c.result ?? "", c.testAgency ?? ""]),
      ],
    },
    {
      name: `QAP Detail${latestWeek ? ` ${latestWeek.weekLabel}` : ""}`.slice(0, 31),
      rows: [
        ["Sr.No.", "Activity", "Description of Activity / Material", "Frequency of Check", "Code of Conformance", "Test Agency", "Contractor", "PMC", "Client", "Records and Documents to be Maintained", "Status", "Remarks"],
        ...qap.map((q) => [q.srNo ?? "", q.activity, q.description ?? "", q.frequency ?? "", q.codeOfConformance ?? "", q.testAgency ?? "", yn(q.contractorOk), yn(q.pmcOk), yn(q.clientOk), q.records ?? "", q.status, q.remarks ?? ""]),
      ],
    },
    {
      name: "SOR Log",
      rows: [
        ["Observation", "Total", "Open", "Close", "Closure Rate"],
        ...sor.map((s) => [s.observation, n(s.total), n(s.openCount), n(s.closedCount), pct(s.closureRate)]),
      ],
    },
    {
      name: "Checklist Fills",
      rows: [
        ["Checklist", "Type", "Filled By", "Status", "Submitted"],
        ...fills.map((f) => [f.assignment.template.name, f.assignment.template.checklistType, f.submittedBy?.fullName ?? "", f.status, d(f.createdAt)]),
      ],
    },
  ];
}

async function safetySheets(projectId: string): Promise<SheetSpec[]> {
  const rows = await prisma.safetyRecord.findMany({ where: { projectId }, orderBy: { occurredAt: "asc" } });
  const header = ["Type", "NCR No.", "Title", "Description", "Category", "Activity / Task", "Location", "Severity", "Root Cause", "Immediate Action", "Long-term Action", "Responsible Party", "Issued To", "Target Completion", "Follow-up Date", "Occurred", "Closed", "Status"];
  const map = (s: (typeof rows)[number]): Cell[] => [
    s.recordType ?? "", s.ncrNumber ?? "", s.title, s.description ?? "", s.category ?? "", s.activityTask ?? "", s.location ?? "", s.severity ?? "",
    s.rootCause ?? "", s.immediateAction ?? "", s.longTermAction ?? "", s.responsibleParty ?? "", s.issuedTo ?? "", d(s.targetCompletion),
    d(s.followUpDate), d(s.occurredAt), d(s.closedAt), s.status,
  ];
  const ncr = rows.filter((r) => /ncr/i.test(r.recordType || "") || r.ncrNumber);
  return [
    { name: "Safety Register", rows: [header, ...rows.map(map)] },
    { name: "Safety NCR", rows: [header, ...ncr.map(map)] },
  ];
}

/** Register-mapped sheets for module exports; null = keep the module's existing sheets. */
export async function moduleRegisterSheets(projectId: string, module: string): Promise<SheetSpec[] | null> {
  switch (module) {
    case "drawings":
      return drawingsSheets(projectId);
    case "progress":
      return progressSheets(projectId);
    case "quality":
      return qualitySheets(projectId);
    case "safety":
      return safetySheets(projectId);
    default:
      return null;
  }
}
