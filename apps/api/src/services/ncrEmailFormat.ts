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
      return "Safety Non-Conformance Report";
    default:
      return "Non-Conformance Report (NCR)";
  }
}

function kindShort(kind: NcrEmailKind) {
  switch (kind) {
    case "QualityCAR":
      return "CAR";
    case "SafetyNCR":
      return "Safety NCR";
    default:
      return "NCR";
  }
}

function formActionLabel(kind: NcrEmailKind) {
  switch (kind) {
    case "QualityCAR":
      return "Open CAR form";
    case "SafetyNCR":
      return "Open Safety NCR form";
    default:
      return "Open NCR form";
  }
}

function registerActionLabel(kind: NcrEmailKind) {
  switch (kind) {
    case "QualityCAR":
      return "Open CAR register";
    case "SafetyNCR":
      return "Open Safety NCR register";
    default:
      return "Open NCR register";
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

export function buildNcrRaisedEmail(opts: {
  ctx: NcrEmailContext;
  registerUrl: string;
  formUrl?: string;
  forContractor?: boolean;
}) {
  const label = kindLabel(opts.ctx.kind);
  const short = kindShort(opts.ctx.kind);
  const formUrl = opts.formUrl || opts.registerUrl;
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

  const intro = opts.forContractor
    ? `A ${label} (${short}) has been served on your company via the Sharnam portal. Open the form, download the NCR 01 Excel format, fill corrective action / sign-off, upload the filled sheet or save in the portal — the register updates automatically.`
    : `A new ${label} (${short}) has been raised. Stakeholders can open the form, download the branded Excel/PDF, fill and resolve — the NCR/CAR register updates when saved or closed.`;

  const stepsHtml = `
<ol style="margin:12px 0 0;padding-left:18px;font-size:13px;color:#334155;line-height:1.55;">
  <li>Open the ${short} form in the portal</li>
  <li>Download Excel (NCR 01 format) or PDF</li>
  <li>Fill corrective action / contractor response and sign</li>
  <li>Save in portal or upload the filled Excel — register row updates</li>
</ol>`;

  const bodyHtml = wrapRfiEmailHtml({
    eyebrow: `${short} raised`,
    headline: `${opts.ctx.number} — action required`,
    intro,
    ctx: rfiCtx,
    detailRows: rows,
    particularsLabel: `${label} particulars`,
    questionLabel: "Description of the problem which requires rectification",
    primaryAction: {
      href: formUrl,
      label: opts.forContractor ? formActionLabel(opts.ctx.kind) : registerActionLabel(opts.ctx.kind),
    },
    extraHtml: `${stepsHtml}<p style="margin:12px 0 0;font-size:12px;color:#64748b;">Form: <a href="${escapeHtml(formUrl)}" style="color:#0b6a78;word-break:break-all;">${escapeHtml(formUrl)}</a><br/>Register: <a href="${escapeHtml(opts.registerUrl)}" style="color:#0b6a78;word-break:break-all;">${escapeHtml(opts.registerUrl)}</a></p>`,
    footerNote:
      "NCR = Non-Conformance Report · CAR = Corrective Action Request. Activity (raise / fill / upload / close) is logged on the form.",
  });

  const bodyText = [
    `${label} raised — ${opts.ctx.number}`,
    "",
    detailTableText(rows),
    "",
    "Description:",
    opts.ctx.description,
    "",
    "Steps: 1) Open form  2) Download Excel/PDF  3) Fill & sign  4) Save or upload filled Excel",
    "",
    "Form:",
    formUrl,
    "Register:",
    opts.registerUrl,
  ].join("\n");

  return {
    bodyHtml,
    bodyText,
    subject: `[${opts.ctx.projectCode || "Portal"}] ${short} raised — ${opts.ctx.number}`,
  };
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
    primaryAction: { href: opts.formUrl, label: formActionLabel(opts.ctx.kind) },
    extraHtml: opts.note?.trim()
      ? `<p style="margin:12px 0 0;padding:10px 12px;background:#fff7ed;border-left:3px solid #ea580c;font-size:13px;color:#431407;"><strong>SPDC note:</strong> ${escapeHtml(opts.note.trim())}</p>`
      : undefined,
    footerNote:
      opts.ctx.kind === "QualityCAR"
        ? "Contractor: fill corrective action and sign-off on the CAR form. SPDC office will verify compliance and close the register row."
        : "Contractor: fill work carried out and sign-off on the NCR form. SPDC office will verify compliance and close the register row.",
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
