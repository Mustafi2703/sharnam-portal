/**
 * RFI lifecycle emails with portal deep links:
 * raise (+ fill link) → submit for review → office review → close.
 */
import { queueProjectEmail } from "./email.js";
import {
  buildChecklistDecisionEmail,
  buildChecklistReviewEmail,
  buildRfiClosedEmail,
  buildRfiRaisedEmail,
  buildRfiResponseEmail,
  type RfiEmailContext,
} from "./rfiEmailFormat.js";

export const RFI_FLOW_KINDS = [
  "RequestForInformation",
  "DrawingChecklist",
  "QualityInspection",
  "SafetyChecklist",
  "QualityIR",
  "SafetyIR",
  "ActivityInspection",
  "SiteExecution",
  "ClientConcern",
] as const;

export type RfiFlowKind = (typeof RFI_FLOW_KINDS)[number];

export type { RfiEmailContext };

export function portalOrigin() {
  return (process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
}

export function checklistFamilyForRfiKind(kind?: string | null): string {
  switch (kind) {
    case "QualityInspection":
    case "QualityIR":
      return "QualityInspection";
    case "SafetyChecklist":
    case "SafetyIR":
      return "Safety";
    case "ActivityInspection":
      return "ActivityInspection";
    case "SiteExecution":
      return "SiteExecution";
    case "DrawingChecklist":
    default:
      return "DrawingCheck";
  }
}

export function logsPathForFamily(projectId: string, family: string) {
  if (family === "QualityInspection") return `/projects/${projectId}/quality/checklist-logs`;
  if (family === "Safety") return `/projects/${projectId}/safety/checklist-logs`;
  if (family === "ActivityInspection") return `/projects/${projectId}/inspection/checklist-logs`;
  if (family === "SiteExecution") return `/projects/${projectId}/field/checklist-logs`;
  return `/projects/${projectId}/drawings/checklist-logs`;
}

export function rfiRegisterUrl(projectId: string, kind?: string | null, rfiId?: string | null) {
  const base = `${portalOrigin()}/projects/${projectId}/rfis`;
  const q = new URLSearchParams();
  if (kind && kind !== "RequestForInformation") q.set("kind", kind);
  if (kind === "RequestForInformation" || kind === "DrawingChecklist") q.set("view", "register");
  if (rfiId) q.set("rfi", rfiId);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export function checklistFillUrl(projectId: string, assignmentId: string, kind?: string | null) {
  const family = checklistFamilyForRfiKind(kind);
  return `${portalOrigin()}/projects/${projectId}/checklist/fill/${assignmentId}?family=${encodeURIComponent(family)}`;
}

export function brandedFillUrl(submissionId: string) {
  return `${portalOrigin().replace(/\/$/, "")}/api/checklist/submissions/${submissionId}/branded.html`;
}

export function reviewLogsUrl(projectId: string, kind?: string | null, submissionId?: string | null) {
  const family = checklistFamilyForRfiKind(kind);
  const path = logsPathForFamily(projectId, family);
  const q = submissionId ? `?submission=${submissionId}` : "";
  return `${portalOrigin()}${path}${q}`;
}

/** Map Prisma RFI + project into email detail rows */
export function rfiEmailContextFromRecord(
  rfi: {
    number: string;
    subject: string;
    question: string;
    rfiKind: string;
    status?: string;
    ballInCourt?: string;
    irNumber?: string | null;
    dueDate?: Date | null;
    createdAt?: Date;
    formDataJson?: string | null;
    scheduleImpact?: string | null;
    costImpact?: string | null;
    specSectionLink?: string | null;
    questionReceivedFrom?: string | null;
    assignedTo?: { fullName: string } | null;
    createdBy?: { fullName: string } | null;
    drawing?: { drawingNumber: string; title: string } | null;
    vendor?: { name: string } | null;
  },
  project?: { code: string; name: string } | null,
  linkedChecklistName?: string | null
): RfiEmailContext {
  return {
    projectCode: project?.code,
    projectName: project?.name,
    number: rfi.number,
    subject: rfi.subject,
    question: rfi.question,
    rfiKind: rfi.rfiKind,
    status: rfi.status,
    ballInCourt: rfi.ballInCourt,
    irNumber: rfi.irNumber,
    dueDate: rfi.dueDate,
    createdAt: rfi.createdAt,
    createdByName: rfi.createdBy?.fullName || null,
    assignedToName: rfi.assignedTo?.fullName || null,
    linkedDrawingNumber: rfi.drawing?.drawingNumber || null,
    linkedDrawingTitle: rfi.drawing?.title || null,
    linkedChecklistName: linkedChecklistName || null,
    vendorName: rfi.vendor?.name || null,
    scheduleImpact: rfi.scheduleImpact,
    costImpact: rfi.costImpact,
    specSectionLink: rfi.specSectionLink,
    questionReceivedFrom: rfi.questionReceivedFrom,
    formDataJson: rfi.formDataJson,
  };
}

export async function notifyRfiRaised(
  opts: {
    projectId: string;
    rfiId: string;
    linkedAssignmentId?: string | null;
    createdById?: string;
    toOverride?: string;
  } & RfiEmailContext
) {
  const fill =
    opts.linkedAssignmentId != null
      ? checklistFillUrl(opts.projectId, opts.linkedAssignmentId, opts.rfiKind)
      : null;
  const register = rfiRegisterUrl(opts.projectId, opts.rfiKind, opts.rfiId);
  const ctx: RfiEmailContext = {
    projectCode: opts.projectCode,
    projectName: opts.projectName,
    number: opts.number,
    subject: opts.subject,
    question: opts.question,
    rfiKind: opts.rfiKind,
    status: opts.status || "Open",
    ballInCourt: opts.ballInCourt || "Assignee",
    irNumber: opts.irNumber,
    dueDate: opts.dueDate,
    createdByName: opts.createdByName,
    createdAt: opts.createdAt,
    assignedToName: opts.assignedToName,
    linkedDrawingNumber: opts.linkedDrawingNumber,
    linkedDrawingTitle: opts.linkedDrawingTitle,
    linkedChecklistName: opts.linkedChecklistName,
    vendorName: opts.vendorName,
    scheduleImpact: opts.scheduleImpact,
    costImpact: opts.costImpact,
    specSectionLink: opts.specSectionLink,
    questionReceivedFrom: opts.questionReceivedFrom,
    formDataJson: opts.formDataJson,
  };

  const { bodyHtml, bodyText } = buildRfiRaisedEmail({ ctx, fillUrl: fill, registerUrl: register });

  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `Action required — ${opts.number}: ${opts.subject}`,
    body: bodyText,
    bodyHtml,
    context: "rfi.create",
    createdById: opts.createdById,
    toOverride: opts.toOverride,
  });
}

export async function notifyChecklistSubmittedForReview(opts: {
  projectId: string;
  templateName: string;
  checklistType: string;
  submissionId: string;
  assignmentId: string;
  submittedByName?: string;
  rfiNumbers?: string[];
  createdById?: string;
  toOverride?: string;
  projectCode?: string;
  projectName?: string;
}) {
  const brandedHtmlUrl = `${portalOrigin()}/api/checklist/submissions/${opts.submissionId}/branded.html`;
  const brandedXlsxUrl = `${portalOrigin()}/api/checklist/submissions/${opts.submissionId}/branded.xlsx`;
  const logs = reviewLogsUrl(opts.projectId, opts.checklistType, opts.submissionId);

  const ctx: RfiEmailContext = {
    projectCode: opts.projectCode,
    projectName: opts.projectName,
    number: opts.rfiNumbers?.[0] || "—",
    subject: opts.templateName,
    question: "Checklist submitted — pending office review.",
    rfiKind: opts.checklistType,
    status: "Answered",
    ballInCourt: "Office",
  };

  const { bodyHtml, bodyText } = buildChecklistReviewEmail({
    ctx,
    templateName: opts.templateName,
    checklistType: opts.checklistType,
    submittedByName: opts.submittedByName,
    rfiNumbers: opts.rfiNumbers,
    brandedHtmlUrl,
    brandedXlsxUrl,
    reviewLogsUrl: logs,
  });

  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `For review — ${opts.templateName}${opts.rfiNumbers?.length ? ` (${opts.rfiNumbers.join(", ")})` : ""}`,
    body: bodyText,
    bodyHtml,
    context: "checklist.submit.review",
    createdById: opts.createdById,
    toOverride: opts.toOverride,
  });
}

export async function notifyChecklistReviewed(opts: {
  projectId: string;
  templateName: string;
  status: string;
  submissionId: string;
  remarks?: string | null;
  rfiNumbers?: string[];
  createdById?: string;
  toOverride?: string;
  projectCode?: string;
  projectName?: string;
}) {
  const brandedHtmlUrl = brandedFillUrl(opts.submissionId);
  const ctx: RfiEmailContext = {
    projectCode: opts.projectCode,
    projectName: opts.projectName,
    number: opts.rfiNumbers?.[0] || "—",
    subject: opts.templateName,
    question: opts.remarks || "",
    rfiKind: "Checklist",
    status: opts.status,
  };

  const { bodyHtml, bodyText } = buildChecklistDecisionEmail({
    ctx,
    templateName: opts.templateName,
    status: opts.status,
    remarks: opts.remarks,
    rfiNumbers: opts.rfiNumbers,
    brandedHtmlUrl,
  });

  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `Checklist ${opts.status} — ${opts.templateName}`,
    body: bodyText,
    bodyHtml,
    context: "checklist.review",
    createdById: opts.createdById,
    toOverride: opts.toOverride,
  });
}

export async function notifyRfiClosed(
  opts: {
    projectId: string;
    rfiId: string;
    createdById?: string;
    toOverride?: string;
  } & RfiEmailContext
) {
  const register = rfiRegisterUrl(opts.projectId, opts.rfiKind, opts.rfiId);
  const ctx: RfiEmailContext = {
    projectCode: opts.projectCode,
    projectName: opts.projectName,
    number: opts.number,
    subject: opts.subject,
    question: opts.question,
    rfiKind: opts.rfiKind || "RequestForInformation",
    status: "Closed",
    irNumber: opts.irNumber,
    dueDate: opts.dueDate,
    createdByName: opts.createdByName,
    assignedToName: opts.assignedToName,
    linkedDrawingNumber: opts.linkedDrawingNumber,
    linkedDrawingTitle: opts.linkedDrawingTitle,
    linkedChecklistName: opts.linkedChecklistName,
    vendorName: opts.vendorName,
    scheduleImpact: opts.scheduleImpact,
    costImpact: opts.costImpact,
    formDataJson: opts.formDataJson,
  };

  const { bodyHtml, bodyText } = buildRfiClosedEmail({ ctx, registerUrl: register });

  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `Closed — ${opts.number}: ${opts.subject}`,
    body: bodyText,
    bodyHtml,
    context: "rfi.status.closed",
    createdById: opts.createdById,
    toOverride: opts.toOverride,
  });
}

export async function notifyRfiResponse(opts: {
  projectId: string;
  rfiId: string;
  responseText: string;
  respondedByName?: string;
  isOfficial?: boolean;
  createdById?: string;
  toOverride?: string;
} & RfiEmailContext) {
  const register = rfiRegisterUrl(opts.projectId, opts.rfiKind, opts.rfiId);
  const ctx: RfiEmailContext = {
    projectCode: opts.projectCode,
    projectName: opts.projectName,
    number: opts.number,
    subject: opts.subject,
    question: opts.question,
    rfiKind: opts.rfiKind,
    status: opts.status,
    ballInCourt: opts.ballInCourt,
    irNumber: opts.irNumber,
    dueDate: opts.dueDate,
    createdByName: opts.createdByName,
    assignedToName: opts.assignedToName,
    linkedDrawingNumber: opts.linkedDrawingNumber,
    linkedDrawingTitle: opts.linkedDrawingTitle,
    vendorName: opts.vendorName,
    scheduleImpact: opts.scheduleImpact,
    costImpact: opts.costImpact,
    formDataJson: opts.formDataJson,
  };

  const { bodyHtml, bodyText } = buildRfiResponseEmail({
    ctx,
    responseText: opts.responseText,
    respondedByName: opts.respondedByName,
    registerUrl: register,
    isOfficial: opts.isOfficial,
  });

  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `Response on ${opts.number} — ${opts.subject}`,
    body: bodyText,
    bodyHtml,
    context: "rfi.respond",
    createdById: opts.createdById,
    toOverride: opts.toOverride,
  });
}
