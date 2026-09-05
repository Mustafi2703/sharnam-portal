/**
 * Branded HTML for Quality NCR / CAR / Safety NCR notifications.
 */
import { escapeHtml, fmtEmailDate, fmtEmailDateTime, wrapRfiEmailHtml, type RfiDetailRow } from "./rfiEmailFormat.js";

export type NcrEmailKind = "QualityNCR" | "QualityCAR" | "SafetyNCR";

export type NcrEmailContext = {
  projectCode?: string;
  projectName?: string;
  number: string;
  kind: NcrEmailKind;
  status: string;
  description: string;
  severity?: string | null;
  location?: string | null;
  activityTask?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  responsibleParty?: string | null;
  targetCompletion?: Date | string | null;
  raisedByName?: string | null;
  raisedAt?: Date | string | null;
};

function kindLabel(kind: NcrEmailKind) {
  switch (kind) {
    case "QualityCAR":
      return "Corrective Action Request (CAR)";
    case "SafetyNCR":
      return "Safety NCR";
    default:
      return "Quality NCR";
  }
}

function ncrDetailRows(ctx: NcrEmailContext): RfiDetailRow[] {
  const rows: RfiDetailRow[] = [
    { label: "Reference no.", value: ctx.number },
    { label: "Record type", value: kindLabel(ctx.kind) },
  ];
  if (ctx.projectCode) {
    rows.push({
      label: "Project",
      value: ctx.projectName ? `${ctx.projectCode} — ${ctx.projectName}` : ctx.projectCode,
    });
  }
  rows.push({ label: "Status", value: ctx.status });
  if (ctx.severity) rows.push({ label: "Severity", value: ctx.severity });
  if (ctx.location) rows.push({ label: "Location", value: ctx.location });
  if (ctx.activityTask) rows.push({ label: "Activity / task", value: ctx.activityTask });
  if (ctx.raisedByName) rows.push({ label: "Raised by", value: ctx.raisedByName });
  if (ctx.raisedAt) rows.push({ label: "Raised on", value: fmtEmailDateTime(ctx.raisedAt) });
  if (ctx.responsibleParty) rows.push({ label: "Responsible party", value: ctx.responsibleParty });
  if (ctx.targetCompletion) rows.push({ label: "Target completion", value: fmtEmailDate(ctx.targetCompletion) });
  if (ctx.rootCause) rows.push({ label: "Root cause", value: ctx.rootCause });
  if (ctx.correctiveAction) rows.push({ label: "Corrective action", value: ctx.correctiveAction });
  return rows;
}

function detailTableText(rows: RfiDetailRow[]) {
  return rows.map((r) => `${r.label}: ${r.value}`).join("\n");
}

export function buildNcrRaisedEmail(opts: { ctx: NcrEmailContext; registerUrl: string }) {
  const label = kindLabel(opts.ctx.kind);
  const rows = ncrDetailRows(opts.ctx);
  const rfiCtx = {
    projectCode: opts.ctx.projectCode,
    projectName: opts.ctx.projectName,
    number: opts.ctx.number,
    subject: `${label} — ${opts.ctx.description.slice(0, 80)}`,
    question: opts.ctx.description,
    rfiKind: opts.ctx.kind,
    status: opts.ctx.status,
    createdByName: opts.ctx.raisedByName,
    createdAt: opts.ctx.raisedAt,
  };

  const bodyHtml = wrapRfiEmailHtml({
    eyebrow: `${label} raised`,
    headline: `${opts.ctx.number} — action required`,
    intro: `A new ${label} has been raised on the Sharnam portal. Review the details, complete the NCR/CAR form, and assign corrective actions before closing.`,
    ctx: rfiCtx,
    detailRows: rows,
    particularsLabel: `${label} particulars`,
    questionLabel: "Non-conformance / observation",
    primaryAction: { href: opts.registerUrl, label: "Open NCR / CAR register" },
    extraHtml: `<p style="margin:10px 0 0;font-size:12px;color:#64748b;">Register link:<br/><a href="${escapeHtml(opts.registerUrl)}" style="color:#0b6a78;word-break:break-all;">${escapeHtml(opts.registerUrl)}</a></p>`,
    footerNote: "Complete all mandatory fields on the branded NCR form export before marking Closed.",
  });

  const bodyText = [
    `${label} raised — ${opts.ctx.number}`,
    "",
    detailTableText(rows),
    "",
    "Description:",
    opts.ctx.description,
    "",
    "Register:",
    opts.registerUrl,
  ].join("\n");

  return { bodyHtml, bodyText, subject: `[${opts.ctx.projectCode || "Portal"}] ${label} raised — ${opts.ctx.number}` };
}

export function buildNcrFollowUpEmail(opts: {
  ctx: NcrEmailContext;
  formUrl: string;
  followUpNumber: number;
  note?: string | null;
}) {
  const label = kindLabel(opts.ctx.kind);
  const rows = ncrDetailRows(opts.ctx);
  const intro = [
    `Follow-up ${opts.followUpNumber} — the ${label} below remains open.`,
    "You are named on this notice. Complete the corrective action and contractor sign-off in the portal form.",
    opts.note?.trim() ? `\nNote from SPDC: ${opts.note.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const rfiCtx = {
    projectCode: opts.ctx.projectCode,
    projectName: opts.ctx.projectName,
    number: opts.ctx.number,
    subject: `${label} — follow-up ${opts.followUpNumber}`,
    question: opts.ctx.description,
    rfiKind: opts.ctx.kind,
    status: opts.ctx.status,
    createdByName: opts.ctx.raisedByName,
    createdAt: opts.ctx.raisedAt,
  };

  const bodyHtml = wrapRfiEmailHtml({
    eyebrow: `${label} follow-up ${opts.followUpNumber}`,
    headline: `${opts.ctx.number} — compliance required`,
    intro,
    ctx: rfiCtx,
    detailRows: rows,
    particularsLabel: `${label} particulars`,
    questionLabel: "Non-conformance / observation",
    primaryAction: { href: opts.formUrl, label: "Open NCR / CAR form" },
    extraHtml: opts.note?.trim()
      ? `<p style="margin:12px 0 0;padding:10px 12px;background:#fff7ed;border-left:3px solid #ea580c;font-size:13px;color:#431407;"><strong>SPDC note:</strong> ${escapeHtml(opts.note.trim())}</p>`
      : undefined,
    footerNote: "Contractor: fill work carried out and sign-off. SPDC office will verify compliance and close the register row.",
  });

  const bodyText = [
    `${label} follow-up ${opts.followUpNumber} — ${opts.ctx.number}`,
    "",
    detailTableText(rows),
    "",
    "Description:",
    opts.ctx.description,
    "",
    opts.note?.trim() ? `SPDC note: ${opts.note.trim()}\n` : "",
    "Open form:",
    opts.formUrl,
  ].join("\n");

  return {
    bodyHtml,
    bodyText,
    subject: `[Action required] ${label} ${opts.ctx.number} — follow-up ${opts.followUpNumber}`,
  };
}
