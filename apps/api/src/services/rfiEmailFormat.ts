/**
 * Branded HTML + plain-text bodies for RFI lifecycle emails (SPDC / Sharnam portal).
 */

const BRAND_NAVY = "#1e3a5f";
const BRAND_ORANGE = "#e4632a";
const BRAND_TEAL = "#0b6a78";
const BRAND_PAPER = "#f7f8fa";

export function escapeHtml(raw: string) {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtEmailDate(d?: Date | string | null) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtEmailDateTime(d?: Date | string | null) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function kindLabel(kind: string) {
  switch (kind) {
    case "RequestForInformation":
      return "Ask (PMC RFI)";
    case "DrawingChecklist":
      return "Drawing checklist fill";
    case "QualityInspection":
      return "Quality inspection fill";
    case "SafetyChecklist":
      return "Safety checklist fill";
    case "QualityIR":
      return "Quality IR (Request for Inspection)";
    case "SafetyIR":
      return "Safety IR";
    case "ActivityInspection":
      return "Activity inspection";
    case "SiteExecution":
      return "Field / site checklist";
    case "ClientConcern":
      return "Client concern";
    default:
      return kind;
  }
}

export type RfiDetailRow = { label: string; value: string };

export type RfiEmailContext = {
  projectCode?: string;
  projectName?: string;
  number: string;
  subject: string;
  question: string;
  rfiKind: string;
  status?: string;
  ballInCourt?: string;
  irNumber?: string | null;
  dueDate?: Date | string | null;
  createdByName?: string | null;
  createdAt?: Date | string | null;
  assignedToName?: string | null;
  linkedDrawingNumber?: string | null;
  linkedDrawingTitle?: string | null;
  linkedChecklistName?: string | null;
  vendorName?: string | null;
  scheduleImpact?: string | null;
  costImpact?: string | null;
  specSectionLink?: string | null;
  questionReceivedFrom?: string | null;
  formDataJson?: string | null;
};

function parseFormDataRows(formDataJson?: string | null): RfiDetailRow[] {
  if (!formDataJson) return [];
  try {
    const data = JSON.parse(formDataJson) as Record<string, unknown>;
    if (!data || typeof data !== "object") return [];
    const skip = new Set(["id", "projectId", "rfiId"]);
    return Object.entries(data)
      .filter(([k, v]) => !skip.has(k) && v != null && String(v).trim() !== "")
      .map(([k, v]) => ({
        label: k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim(),
        value: String(v),
      }));
  } catch {
    return [];
  }
}

export function rfiDetailRows(ctx: RfiEmailContext): RfiDetailRow[] {
  const rows: RfiDetailRow[] = [
    { label: "RFI number", value: ctx.number },
    { label: "Type", value: kindLabel(ctx.rfiKind) },
  ];
  if (ctx.irNumber) rows.push({ label: "IR / reference no.", value: ctx.irNumber });
  if (ctx.projectCode) {
    rows.push({
      label: "Project",
      value: ctx.projectName ? `${ctx.projectCode} — ${ctx.projectName}` : ctx.projectCode,
    });
  }
  if (ctx.status) rows.push({ label: "Status", value: ctx.status });
  if (ctx.ballInCourt) rows.push({ label: "Ball in court", value: ctx.ballInCourt });
  if (ctx.dueDate) rows.push({ label: "Due date", value: fmtEmailDate(ctx.dueDate) });
  if (ctx.createdByName) rows.push({ label: "Raised by", value: ctx.createdByName });
  if (ctx.createdAt) rows.push({ label: "Raised on", value: fmtEmailDateTime(ctx.createdAt) });
  if (ctx.assignedToName) rows.push({ label: "Assigned to", value: ctx.assignedToName });
  if (ctx.linkedDrawingNumber) {
    rows.push({
      label: "Linked drawing",
      value: ctx.linkedDrawingTitle
        ? `${ctx.linkedDrawingNumber} — ${ctx.linkedDrawingTitle}`
        : ctx.linkedDrawingNumber,
    });
  }
  if (ctx.linkedChecklistName) rows.push({ label: "Checklist template", value: ctx.linkedChecklistName });
  if (ctx.vendorName) rows.push({ label: "Responsible vendor", value: ctx.vendorName });
  if (ctx.questionReceivedFrom) rows.push({ label: "Received from", value: ctx.questionReceivedFrom });
  if (ctx.specSectionLink) rows.push({ label: "Spec section", value: ctx.specSectionLink });
  if (ctx.scheduleImpact && ctx.scheduleImpact !== "None") {
    rows.push({ label: "Schedule impact", value: ctx.scheduleImpact });
  }
  if (ctx.costImpact && ctx.costImpact !== "None") {
    rows.push({ label: "Cost impact", value: ctx.costImpact });
  }
  rows.push(...parseFormDataRows(ctx.formDataJson));
  return rows;
}

function detailTableHtml(rows: RfiDetailRow[]) {
  const trs = rows
    .map(
      (r) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;width:38%;vertical-align:top;">${escapeHtml(r.label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:500;vertical-align:top;">${escapeHtml(r.value)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">${trs}</table>`;
}

function detailTableText(rows: RfiDetailRow[]) {
  return rows.map((r) => `${r.label}: ${r.value}`).join("\n");
}

function buttonHtml(href: string, label: string, primary = true) {
  const bg = primary ? BRAND_ORANGE : "#fff";
  const color = primary ? "#fff" : BRAND_TEAL;
  const border = primary ? BRAND_ORANGE : BRAND_TEAL;
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;background:${bg};color:${color};text-decoration:none;font-weight:600;font-size:13px;border-radius:6px;border:2px solid ${border};">${escapeHtml(label)}</a>`;
}

function linkLine(label: string, href: string) {
  return `<p style="margin:8px 0 0;font-size:12px;color:#64748b;">${escapeHtml(label)}<br/><a href="${escapeHtml(href)}" style="color:${BRAND_TEAL};word-break:break-all;">${escapeHtml(href)}</a></p>`;
}

export function wrapRfiEmailHtml(opts: {
  eyebrow: string;
  headline: string;
  intro: string;
  ctx: RfiEmailContext;
  questionLabel?: string;
  primaryAction?: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
  extraHtml?: string;
  footerNote?: string;
  /** Override default RFI detail rows (e.g. NCR/CAR) */
  detailRows?: RfiDetailRow[];
  particularsLabel?: string;
}) {
  const rows = opts.detailRows ?? rfiDetailRows(opts.ctx);
  const questionLabel = opts.questionLabel || "Question / instruction";
  const particularsLabel = opts.particularsLabel || "RFI particulars";
  const actions = [
    opts.primaryAction ? buttonHtml(opts.primaryAction.href, opts.primaryAction.label, true) : "",
    opts.secondaryAction ? buttonHtml(opts.secondaryAction.href, opts.secondaryAction.label, false) : "",
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${BRAND_PAPER};font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_PAPER};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:${BRAND_NAVY};padding:20px 24px;border-radius:10px 10px 0 0;">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.72);">Sharnam Portal · ${escapeHtml(opts.eyebrow)}</div>
            <div style="font-size:20px;font-weight:700;color:#fff;margin-top:8px;line-height:1.35;">${escapeHtml(opts.headline)}</div>
            ${opts.ctx.projectCode ? `<div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:6px;font-family:Consolas,monospace;">${escapeHtml(opts.ctx.projectCode)}${opts.ctx.number ? ` · ${escapeHtml(opts.ctx.number)}` : ""}</div>` : ""}
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#334155;">${escapeHtml(opts.intro)}</p>
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(particularsLabel)}</p>
            ${detailTableHtml(rows)}
            <div style="margin-top:20px;padding:16px;background:#fff7ed;border-left:4px solid ${BRAND_ORANGE};border-radius:0 8px 8px 0;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9a3412;margin-bottom:8px;">${escapeHtml(questionLabel)}</div>
              <div style="font-size:14px;line-height:1.6;color:#1e293b;white-space:pre-wrap;">${escapeHtml(opts.ctx.question || "—")}</div>
            </div>
            ${actions ? `<div style="margin-top:22px;">${actions}</div>` : ""}
            ${opts.extraHtml || ""}
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;padding:16px 24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;font-size:11px;color:#64748b;line-height:1.5;">
            ${opts.footerNote ? `<p style="margin:0 0 8px;">${escapeHtml(opts.footerNote)}</p>` : ""}
            <p style="margin:0;">Sign in at the portal to respond, review checklists, or close this RFI. Do not reply to this automated message.</p>
            <p style="margin:8px 0 0;color:#94a3b8;">— Sharnam Project Development Consultants · Portal notification</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildRfiRaisedEmail(opts: {
  ctx: RfiEmailContext;
  fillUrl?: string | null;
  registerUrl: string;
}) {
  const rows = rfiDetailRows(opts.ctx);
  const hasFill = Boolean(opts.fillUrl);
  const intro = hasFill
    ? "A new request has been raised on the portal. Complete the linked checklist below, then submit for office review."
    : "A new request for information has been raised. Please open the register and post an official response when ready.";

  const bodyHtml = wrapRfiEmailHtml({
    eyebrow: hasFill ? "Checklist fill required" : "Action required",
    headline: `${opts.ctx.number}: ${opts.ctx.subject}`,
    intro,
    ctx: opts.ctx,
    primaryAction: hasFill
      ? { href: opts.fillUrl!, label: "Open checklist & fill" }
      : { href: opts.registerUrl, label: "Open RFI register" },
    secondaryAction: hasFill ? { href: opts.registerUrl, label: "View RFI status" } : undefined,
    extraHtml: hasFill
      ? linkLine("Direct fill link (sign in required):", opts.fillUrl!)
      : linkLine("RFI register:", opts.registerUrl),
    footerNote: hasFill
      ? "Step 1: Open checklist → complete all items → Submit. Step 2: Office reviews branded export → Approve → Close RFI."
      : undefined,
  });

  const bodyText = [
    `${kindLabel(opts.ctx.rfiKind)} — ${opts.ctx.number}`,
    opts.ctx.subject,
    "",
    detailTableText(rows),
    "",
    "Question / instruction:",
    opts.ctx.question || "—",
    "",
    hasFill
      ? ["FILL CHECKLIST (required)", opts.fillUrl!, ""].join("\n")
      : ["RESPOND IN PORTAL", opts.registerUrl, ""].join("\n"),
    "RFI register:",
    opts.registerUrl,
  ].join("\n");

  return { bodyHtml, bodyText };
}

export function buildRfiClosedEmail(opts: { ctx: RfiEmailContext; registerUrl: string }) {
  const rows = rfiDetailRows({ ...opts.ctx, status: "Closed" });
  const bodyHtml = wrapRfiEmailHtml({
    eyebrow: "RFI closed",
    headline: `${opts.ctx.number} closed`,
    intro: "This RFI has been marked Closed on the portal. Retain the register link below for audit.",
    ctx: { ...opts.ctx, status: "Closed" },
    questionLabel: "Original question",
    primaryAction: { href: opts.registerUrl, label: "View closed RFI" },
    extraHtml: linkLine("Register:", opts.registerUrl),
  });
  const bodyText = [
    `${opts.ctx.number} has been closed.`,
    "",
    detailTableText(rows),
    "",
    opts.registerUrl,
  ].join("\n");
  return { bodyHtml, bodyText };
}

export function buildChecklistReviewEmail(opts: {
  ctx: RfiEmailContext;
  templateName: string;
  checklistType: string;
  submittedByName?: string;
  rfiNumbers?: string[];
  brandedHtmlUrl: string;
  brandedXlsxUrl: string;
  reviewLogsUrl: string;
}) {
  const extraRows: RfiDetailRow[] = [
    { label: "Checklist", value: opts.templateName },
    { label: "Family", value: opts.checklistType },
  ];
  if (opts.submittedByName) extraRows.push({ label: "Submitted by", value: opts.submittedByName });
  if (opts.rfiNumbers?.length) extraRows.push({ label: "Linked RFI(s)", value: opts.rfiNumbers.join(", ") });

  const mergedCtx = { ...opts.ctx, question: opts.ctx.question || "Checklist submitted for office review." };
  const rows = [...rfiDetailRows(mergedCtx), ...extraRows];

  const bodyHtml = wrapRfiEmailHtml({
    eyebrow: "Office review",
    headline: `Checklist submitted — ${opts.templateName}`,
    intro: "A filled checklist is ready for review. Open the branded record, then Approve or Reject in the fill log.",
    ctx: mergedCtx,
    questionLabel: "Review instruction",
    primaryAction: { href: opts.brandedHtmlUrl, label: "Open branded record (HTML)" },
    secondaryAction: { href: opts.reviewLogsUrl, label: "Review in portal" },
    extraHtml: [
      linkLine("Branded Excel (SPDC format):", opts.brandedXlsxUrl),
      linkLine("Fill log:", opts.reviewLogsUrl),
    ].join(""),
    footerNote: "After approval, close the linked RFI from the register if all items are satisfied.",
  });

  const bodyText = [
    "Checklist fill submitted for office review.",
    "",
    detailTableText(rows),
    "",
    "Branded HTML:",
    opts.brandedHtmlUrl,
    "Branded Excel:",
    opts.brandedXlsxUrl,
    "Review log:",
    opts.reviewLogsUrl,
  ].join("\n");

  return { bodyHtml, bodyText };
}

export function buildChecklistDecisionEmail(opts: {
  ctx: RfiEmailContext;
  templateName: string;
  status: string;
  remarks?: string | null;
  rfiNumbers?: string[];
  brandedHtmlUrl: string;
}) {
  const mergedCtx = {
    ...opts.ctx,
    question: opts.remarks || opts.ctx.question || `Checklist review decision: ${opts.status}`,
  };
  const rows: RfiDetailRow[] = [
    { label: "Checklist", value: opts.templateName },
    { label: "Decision", value: opts.status },
    ...rfiDetailRows(mergedCtx),
  ];
  if (opts.rfiNumbers?.length) rows.splice(2, 0, { label: "Linked RFI(s)", value: opts.rfiNumbers.join(", ") });

  const bodyHtml = wrapRfiEmailHtml({
    eyebrow: "Checklist review",
    headline: `${opts.status} — ${opts.templateName}`,
    intro:
      opts.status === "Approved"
        ? "The checklist has been approved. Close the linked RFI from the register when satisfied."
        : "The checklist was rejected. Site may correct and re-submit.",
    ctx: mergedCtx,
    questionLabel: opts.remarks ? "Review remarks" : "Notes",
    primaryAction: { href: opts.brandedHtmlUrl, label: "Open filled record" },
    extraHtml: linkLine("Branded record:", opts.brandedHtmlUrl),
  });

  const bodyText = ["Checklist review decision:", opts.status, "", detailTableText(rows), "", opts.brandedHtmlUrl].join(
    "\n"
  );
  return { bodyHtml, bodyText };
}

export function buildRfiResponseEmail(opts: {
  ctx: RfiEmailContext;
  responseText: string;
  respondedByName?: string;
  registerUrl: string;
  isOfficial?: boolean;
}) {
  const rows = rfiDetailRows(opts.ctx);
  if (opts.respondedByName) rows.push({ label: "Responded by", value: opts.respondedByName });
  rows.push({ label: "Response type", value: opts.isOfficial ? "Official response" : "Comment" });

  const bodyHtml = wrapRfiEmailHtml({
    eyebrow: "New response",
    headline: `Response on ${opts.ctx.number}`,
    intro: "A response was posted on this RFI. Open the register for the full thread.",
    ctx: { ...opts.ctx, question: opts.responseText },
    questionLabel: "Response",
    primaryAction: { href: opts.registerUrl, label: "Open RFI register" },
    extraHtml: linkLine("Register:", opts.registerUrl),
  });

  const bodyText = [
    `Response on ${opts.ctx.number}`,
    "",
    detailTableText(rows),
    "",
    opts.responseText,
    "",
    opts.registerUrl,
  ].join("\n");

  return { bodyHtml, bodyText };
}
