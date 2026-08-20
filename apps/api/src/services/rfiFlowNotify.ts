/**
 * RFI lifecycle emails with portal deep links:
 * raise (+ fill link) → submit for review → office review → close.
 */
import { queueProjectEmail } from "./email.js";

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

function kindLabel(kind: string) {
  switch (kind) {
    case "RequestForInformation":
      return "Ask (PMC RFI)";
    case "DrawingChecklist":
      return "Drawing checklist fill request";
    case "QualityInspection":
      return "Quality inspection fill request";
    case "SafetyChecklist":
      return "Safety checklist fill request";
    case "QualityIR":
      return "Quality IR (Request for Inspection)";
    case "SafetyIR":
      return "Safety IR";
    case "ActivityInspection":
      return "Activity inspection checklist";
    case "SiteExecution":
      return "Field / site checklist fill";
    case "ClientConcern":
      return "Client concern";
    default:
      return kind;
  }
}

export async function notifyRfiRaised(opts: {
  projectId: string;
  number: string;
  subject: string;
  question: string;
  rfiKind: string;
  rfiId: string;
  linkedAssignmentId?: string | null;
  createdByName?: string;
  createdById?: string;
  toOverride?: string;
}) {
  const fill =
    opts.linkedAssignmentId != null
      ? checklistFillUrl(opts.projectId, opts.linkedAssignmentId, opts.rfiKind)
      : null;
  const register = rfiRegisterUrl(opts.projectId, opts.rfiKind, opts.rfiId);
  const lines = [
    `${kindLabel(opts.rfiKind)} raised on the portal.`,
    "",
    `Number: ${opts.number}`,
    `Subject: ${opts.subject}`,
    `Kind: ${opts.rfiKind}`,
    opts.createdByName ? `Raised by: ${opts.createdByName}` : "",
    "",
    "Question / instruction:",
    opts.question || "(none)",
    "",
  ].filter(Boolean);

  if (fill) {
    lines.push(
      "── FILL CHECKLIST (required) ──",
      "Open this link (sign in to the portal), complete the attached checklist, then Submit for review:",
      fill,
      ""
    );
  } else {
    lines.push(
      "── RESPOND IN PORTAL ──",
      "This RFI has no checklist attached. Open the register and post an official response:",
      register,
      ""
    );
  }

  lines.push("RFI register / status:", register, "", "— Sharnam Portal · RFI workflow");

  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `Action required — ${opts.number}: ${opts.subject}`,
    body: lines.join("\n"),
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
}) {
  const branded = `${portalOrigin()}/api/checklist/submissions/${opts.submissionId}/branded.html`;
  const brandedXlsx = `${portalOrigin()}/api/checklist/submissions/${opts.submissionId}/branded.xlsx`;
  const logs = reviewLogsUrl(opts.projectId, opts.checklistType, opts.submissionId);
  const fill = checklistFillUrl(opts.projectId, opts.assignmentId, opts.checklistType);
  const lines = [
    "Checklist fill submitted for office review.",
    "",
    `Checklist: ${opts.templateName}`,
    `Family: ${opts.checklistType}`,
    opts.submittedByName ? `Submitted by: ${opts.submittedByName}` : "",
    opts.rfiNumbers?.length ? `Linked RFI(s): ${opts.rfiNumbers.join(", ")}` : "",
    "",
    "── OPEN FILLED RECORD ──",
    `Branded HTML (print / PDF): ${branded}`,
    `Branded Excel (SPDC format): ${brandedXlsx}`,
    "",
    "── REVIEW IN PORTAL ──",
    `Fill log / review: ${logs}`,
    `Assignment: ${fill}`,
    "",
    "Office: open the branded file, Approve or Reject the submission, then Close the linked RFI when satisfied.",
    "",
    "— Sharnam Portal · RFI / checklist review",
  ].filter(Boolean);

  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `For review — ${opts.templateName}${opts.rfiNumbers?.length ? ` (${opts.rfiNumbers.join(", ")})` : ""}`,
    body: lines.join("\n"),
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
}) {
  const branded = `${portalOrigin()}/api/checklist/submissions/${opts.submissionId}/branded.html`;
  const lines = [
    `Checklist review decision: ${opts.status}.`,
    "",
    `Checklist: ${opts.templateName}`,
    opts.rfiNumbers?.length ? `Linked RFI(s): ${opts.rfiNumbers.join(", ")}` : "",
    opts.remarks ? `Remarks: ${opts.remarks}` : "",
    "",
    `Open filled record: ${branded}`,
    "",
    opts.status === "Approved"
      ? "If an RFI is still open, office can Close it from the RFI register."
      : "Site may re-fill or re-offer after corrections.",
    "",
    "— Sharnam Portal · checklist review",
  ].filter(Boolean);

  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `Checklist ${opts.status} — ${opts.templateName}`,
    body: lines.join("\n"),
    context: "checklist.review",
    createdById: opts.createdById,
    toOverride: opts.toOverride,
  });
}

export async function notifyRfiClosed(opts: {
  projectId: string;
  number: string;
  subject: string;
  rfiKind?: string | null;
  rfiId: string;
  createdById?: string;
  toOverride?: string;
}) {
  const register = rfiRegisterUrl(opts.projectId, opts.rfiKind, opts.rfiId);
  return queueProjectEmail({
    projectId: opts.projectId,
    subject: `Closed — ${opts.number}: ${opts.subject}`,
    body: [
      `${opts.number} has been closed on the portal.`,
      "",
      `Subject: ${opts.subject}`,
      opts.rfiKind ? `Kind: ${opts.rfiKind}` : "",
      "",
      `View register: ${register}`,
      "",
      "— Sharnam Portal · RFI closed",
    ]
      .filter(Boolean)
      .join("\n"),
    context: "rfi.status.closed",
    createdById: opts.createdById,
    toOverride: opts.toOverride,
  });
}
