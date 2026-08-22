/**
 * SPDC_RFI_Form_and_Register.xlsx — sheet 04_RFI_REGISTER (33 columns).
 */
import { parseFormDataJson } from "./inspectionRequestForms";

export const SPDC_RFI_REGISTER_COLUMNS = [
  "RFI NO",
  "REV",
  "PACKAGE",
  "DISCIPLINE",
  "CATEGORY",
  "SUBJECT",
  "LOCATION / GRID",
  "DWG REF",
  "DWG REV",
  "SPEC CLAUSE",
  "QUERY RAISED",
  "CONTRACTOR'S PROPOSED SOLUTION",
  "ORIGINATOR",
  "DATE RAISED",
  "PRIORITY",
  "SLA DAYS",
  "REPLY REQUIRED BY",
  "RESPONSIBLE PARTY",
  "DATE RESPONDED",
  "RESPONSE",
  "RESPONDED BY",
  "STATUS",
  "DATE CLOSED",
  "DAYS TAKEN",
  "SLA STATUS",
  "AGE BUCKET",
  "COST IMPACT",
  "EST. COST (INR)",
  "TIME IMPACT",
  "EST. DELAY (d)",
  "CHANGE / VO REF",
  "ATTACHMENTS",
  "PMC REMARKS",
] as const;

export type SpdcRfiRegisterColumn = (typeof SPDC_RFI_REGISTER_COLUMNS)[number];

export const SPDC_RFI_SLA_DAYS: Record<string, number> = {
  CRITICAL: 3,
  HIGH: 7,
  NORMAL: 14,
};

export type DrawingRfiRow = {
  id: string;
  number: string;
  subject: string;
  question: string;
  status: string;
  rfiKind: string;
  createdAt: string;
  dueDate?: string | null;
  closedAt?: string | null;
  scheduleImpact?: string | null;
  costImpact?: string | null;
  specSectionLink?: string | null;
  attachmentsJson?: string | null;
  formDataJson?: string | null;
  linkedAssignmentId?: string | null;
  assignedTo?: { fullName: string } | null;
  createdBy?: { fullName: string } | null;
  vendor?: { name: string } | null;
  drawing?: { drawingNumber: string; title?: string; currentRev?: string } | null;
  responses?: { responseText: string; isOfficialResponse?: boolean; createdAt: string; respondedBy?: { fullName: string } }[];
};

function fmtDate(d?: string | Date | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

function officialResponse(r: DrawingRfiRow) {
  const list = r.responses || [];
  const official = list.filter((x) => x.isOfficialResponse);
  return official.length ? official[official.length - 1] : list[list.length - 1] || null;
}

export function spdcPriority(form: Record<string, string>, dueDate?: string | null, createdAt?: string) {
  const p = (form.priority || "").trim().toUpperCase();
  if (p === "CRITICAL" || p === "HIGH" || p === "NORMAL") return p;
  if (dueDate && createdAt) {
    const days = daysBetween(new Date(createdAt), new Date(dueDate));
    if (days <= 3) return "CRITICAL";
    if (days <= 7) return "HIGH";
  }
  return "NORMAL";
}

export function spdcSlaDays(priority: string) {
  return SPDC_RFI_SLA_DAYS[priority] ?? 14;
}

export function spdcReplyRequiredBy(r: DrawingRfiRow, form: Record<string, string>) {
  if (r.dueDate) return fmtDate(r.dueDate);
  if (form.replyRequiredBy) return form.replyRequiredBy;
  const priority = spdcPriority(form, r.dueDate, r.createdAt);
  const raised = new Date(r.createdAt);
  const reply = new Date(raised.getTime() + spdcSlaDays(priority) * 86400000);
  return fmtDate(reply);
}

export function spdcRegisterStatus(r: DrawingRfiRow) {
  if (r.status === "Closed") return "Closed";
  if (r.status === "Answered") return "Answered — pending close";
  const resp = officialResponse(r);
  if (resp) return "Answered — pending close";
  return "Awaiting response";
}

export function spdcSlaStatus(r: DrawingRfiRow, form: Record<string, string>) {
  const replyStr = spdcReplyRequiredBy(r, form);
  const reply = replyStr ? new Date(replyStr) : null;
  const resp = officialResponse(r);
  if (r.status === "Closed" || resp) {
    if (reply && resp) {
      const responded = new Date(resp.createdAt);
      return responded.getTime() <= reply.getTime() + 86400000 ? "Answered on time" : "Answered late";
    }
    return resp ? "Answered" : "Closed";
  }
  if (reply && Date.now() > reply.getTime()) return "OVERDUE";
  return "Within SLA";
}

export function spdcAgeBucket(r: DrawingRfiRow) {
  if (r.status === "Closed") return "";
  const age = daysBetween(new Date(r.createdAt), new Date());
  if (age <= 7) return "0–7 days";
  if (age <= 14) return "8–14 days";
  return "15+ days";
}

export function spdcDaysTaken(r: DrawingRfiRow) {
  const resp = officialResponse(r);
  if (!resp) return "";
  return String(daysBetween(new Date(r.createdAt), new Date(resp.createdAt)));
}

/** One register row keyed by SPDC column header */
export function buildSpdcRegisterRow(r: DrawingRfiRow): Record<SpdcRfiRegisterColumn, string> {
  const form = parseFormDataJson(r.formDataJson);
  const resp = officialResponse(r);
  const priority = spdcPriority(form, r.dueDate, r.createdAt);
  const slaDays = String(form.slaDays || spdcSlaDays(priority));

  return {
    "RFI NO": r.number,
    REV: form.revision || form.rev || "0",
    PACKAGE: form.package || form.projectPackage || "—",
    DISCIPLINE: form.discipline || "—",
    CATEGORY: form.category || r.rfiKind.replace(/([A-Z])/g, " $1").trim(),
    SUBJECT: r.subject,
    "LOCATION / GRID": form.location || form.locationGrid || "—",
    "DWG REF": form.drawingRef || form.dwgRef || r.drawing?.drawingNumber || "—",
    "DWG REV": form.drawingRev || form.dwgRev || r.drawing?.currentRev || "—",
    "SPEC CLAUSE": form.specClause || r.specSectionLink || "—",
    "QUERY RAISED": form.queryRaised || r.question,
    "CONTRACTOR'S PROPOSED SOLUTION": form.contractorSolution || form.proposedSolution || "—",
    ORIGINATOR: form.originator || r.createdBy?.fullName || "—",
    "DATE RAISED": fmtDate(r.createdAt),
    PRIORITY: priority,
    "SLA DAYS": slaDays,
    "REPLY REQUIRED BY": spdcReplyRequiredBy(r, form),
    "RESPONSIBLE PARTY":
      form.responsibleParty || r.assignedTo?.fullName || r.vendor?.name || form.responsibleConsultant || "—",
    "DATE RESPONDED": resp ? fmtDate(resp.createdAt) : "—",
    RESPONSE: resp?.responseText || "—",
    "RESPONDED BY": resp?.respondedBy?.fullName || form.respondedBy || "—",
    STATUS: spdcRegisterStatus(r),
    "DATE CLOSED": r.closedAt ? fmtDate(r.closedAt) : "—",
    "DAYS TAKEN": spdcDaysTaken(r) || "—",
    "SLA STATUS": spdcSlaStatus(r, form),
    "AGE BUCKET": spdcAgeBucket(r),
    "COST IMPACT": r.costImpact && r.costImpact !== "None" ? r.costImpact : form.costImpact || "No",
    "EST. COST (INR)": form.estCostInr || form.estCost || "—",
    "TIME IMPACT": r.scheduleImpact && r.scheduleImpact !== "None" ? r.scheduleImpact : form.timeImpact || "No",
    "EST. DELAY (d)": form.estDelayDays || "—",
    "CHANGE / VO REF": form.changeVoRef || form.voRef || "—",
    ATTACHMENTS: form.attachments || r.attachmentsJson || "—",
    "PMC REMARKS": form.pmcRemarks || form.remarks || "—",
  };
}

export function spdcRegisterDashboard(rows: DrawingRfiRow[]) {
  let awaiting = 0;
  let overdue = 0;
  let answeredOpen = 0;
  let closed = 0;
  let daysSum = 0;
  let daysCount = 0;

  for (const r of rows) {
    const form = parseFormDataJson(r.formDataJson);
    const st = spdcRegisterStatus(r);
    const sla = spdcSlaStatus(r, form);
    if (r.status === "Closed") closed++;
    else if (r.status === "Answered" || st.startsWith("Answered")) answeredOpen++;
    else awaiting++;
    if (sla === "OVERDUE") overdue++;
    const taken = spdcDaysTaken(r);
    if (taken) {
      daysSum += Number(taken);
      daysCount++;
    }
  }

  return {
    total: rows.length,
    awaiting,
    overdue,
    answeredOpen,
    closed,
    avgDaysToRespond: daysCount ? Math.round((daysSum / daysCount) * 10) / 10 : null,
  };
}

export function slaStatusCellClass(sla: string) {
  if (/OVERDUE/i.test(sla)) return "bg-rose-50 text-rose-900 font-semibold";
  if (/on time/i.test(sla)) return "bg-emerald-50 text-emerald-900 font-medium";
  if (/late/i.test(sla)) return "bg-amber-50 text-amber-900 font-medium";
  if (/Within SLA/i.test(sla)) return "bg-sky-50 text-sky-900";
  return "";
}

export function registerStatusCellClass(status: string) {
  if (/Closed/i.test(status)) return "bg-emerald-50 text-emerald-900 font-medium";
  if (/Awaiting/i.test(status)) return "bg-amber-50 text-amber-900 font-medium";
  if (/Answered/i.test(status)) return "bg-sky-50 text-sky-900 font-medium";
  return "";
}

/** Build formDataJson payload from compose form (drawings RFI) */
export function spdcFormDataFromCompose(input: {
  package?: string;
  discipline?: string;
  category?: string;
  location?: string;
  drawingRef?: string;
  drawingRev?: string;
  specClause?: string;
  priority?: string;
  contractorSolution?: string;
  responsibleParty?: string;
  pmcRemarks?: string;
  queryRaised?: string;
}) {
  const priority = (input.priority || "NORMAL").toUpperCase();
  return {
    package: input.package || "",
    discipline: input.discipline || "",
    category: input.category || "",
    locationGrid: input.location || "",
    drawingRef: input.drawingRef || "",
    dwgRev: input.drawingRev || "",
    specClause: input.specClause || "",
    priority,
    slaDays: String(spdcSlaDays(priority)),
    contractorSolution: input.contractorSolution || "",
    responsibleParty: input.responsibleParty || "",
    pmcRemarks: input.pmcRemarks || "",
    queryRaised: input.queryRaised || "",
  };
}
