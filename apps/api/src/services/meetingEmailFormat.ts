/**
 * Branded HTML meeting invite — one email per scheduled meeting (Teams + portal MoM).
 */
import { escapeHtml, fmtEmailDateTime } from "./rfiEmailFormat.js";
import { sharnamEmailLogoHtml } from "./brandedExport.js";

const BRAND_NAVY = "#1e3a5f";
const BRAND_ORANGE = "#e4632a";
const BRAND_TEAL = "#0b6a78";
const BRAND_PAPER = "#f7f8fa";
const TEAMS_PURPLE = "#6264a7";

export type MeetingEmailContext = {
  projectCode?: string;
  projectName?: string;
  title: string;
  meetingDate: Date;
  endDate?: Date;
  durationMins?: number;
  location?: string | null;
  status?: string;
  scheduledByName?: string | null;
  attendeeList?: string;
  teamsJoinUrl?: string | null;
  calendarWebLink?: string | null;
  portalAgendaUrl: string;
  teamsNote?: string | null;
  /** Numbered agenda lines shown in the invite body */
  agendaItems?: string[];
};

type DetailRow = { label: string; value: string };

function fmtTimeRange(start: Date, end?: Date, durationMins?: number) {
  const endDt =
    end ||
    (durationMins ? new Date(start.getTime() + durationMins * 60_000) : new Date(start.getTime() + 3600000));
  const datePart = start.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const endTime = endDt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${startTime} – ${endTime} IST`;
}

function meetingDetailRows(ctx: MeetingEmailContext): DetailRow[] {
  const rows: DetailRow[] = [
    { label: "Meeting title", value: ctx.title },
  ];
  if (ctx.projectCode) {
    rows.push({
      label: "Project",
      value: ctx.projectName ? `${ctx.projectCode} — ${ctx.projectName}` : ctx.projectCode,
    });
  }
  rows.push({ label: "Date & time", value: fmtTimeRange(ctx.meetingDate, ctx.endDate, ctx.durationMins) });
  if (ctx.durationMins) rows.push({ label: "Duration", value: `${ctx.durationMins} minutes` });
  if (ctx.location) rows.push({ label: "Location / venue", value: ctx.location });
  rows.push({ label: "Platform", value: ctx.teamsJoinUrl ? "Microsoft Teams (online)" : "Portal + calendar" });
  if (ctx.status) rows.push({ label: "Portal stage", value: ctx.status });
  if (ctx.scheduledByName) rows.push({ label: "Scheduled by", value: ctx.scheduledByName });
  if (ctx.attendeeList) rows.push({ label: "Invited", value: ctx.attendeeList });
  return rows;
}

function detailTableHtml(rows: DetailRow[]) {
  const trs = rows
    .map(
      (r) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;width:34%;vertical-align:top;">${escapeHtml(r.label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:500;vertical-align:top;">${escapeHtml(r.value)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">${trs}</table>`;
}

function buttonHtml(href: string, label: string, bg: string, color = "#fff", border?: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;background:${bg};color:${color};text-decoration:none;font-weight:600;font-size:13px;border-radius:6px;border:2px solid ${border || bg};">${escapeHtml(label)}</a>`;
}

function linkLine(label: string, href: string) {
  return `<p style="margin:10px 0 0;font-size:12px;color:#64748b;">${escapeHtml(label)}<br/><a href="${escapeHtml(href)}" style="color:${BRAND_TEAL};word-break:break-all;">${escapeHtml(href)}</a></p>`;
}

function agendaBlockHtml(items?: string[]) {
  if (!items?.length) return "";
  const lis = items.map((item) => `<li style="margin:6px 0;font-size:13px;color:#334155;line-height:1.5;">${escapeHtml(item)}</li>`).join("");
  return `<div style="margin-top:20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
    <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Meeting agenda</p>
    <ol style="margin:0;padding-left:20px;">${lis}</ol>
  </div>`;
}

export function buildMeetingScheduledEmail(ctx: MeetingEmailContext) {
  const rows = meetingDetailRows(ctx);
  const intro = ctx.teamsJoinUrl
    ? "You are invited to a project coordination meeting on Microsoft Teams. Use the join button below at the scheduled time, then track agenda and minutes on the Sharnam portal."
    : "You are invited to a project coordination meeting. Open the portal link below for agenda, MoM, and action tracking.";

  const actions = [
    ctx.teamsJoinUrl
      ? buttonHtml(ctx.teamsJoinUrl, "Join Microsoft Teams", TEAMS_PURPLE)
      : "",
    buttonHtml(ctx.portalAgendaUrl, "Open agenda on portal", BRAND_ORANGE),
    ctx.calendarWebLink ? buttonHtml(ctx.calendarWebLink, "Outlook calendar", "#fff", BRAND_TEAL, BRAND_TEAL) : "",
  ]
    .filter(Boolean)
    .join("");

  const extra = [
    ctx.teamsJoinUrl ? linkLine("Teams join link:", ctx.teamsJoinUrl) : "",
    linkLine("Portal — agenda / MoM / actions:", ctx.portalAgendaUrl),
    ctx.calendarWebLink ? linkLine("Outlook calendar event:", ctx.calendarWebLink) : "",
    ctx.teamsNote
      ? `<p style="margin:14px 0 0;padding:10px 12px;background:#f1f5f9;border-radius:6px;font-size:12px;color:#475569;">${escapeHtml(ctx.teamsNote)}</p>`
      : "",
  ].join("");

  const bodyHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${BRAND_PAPER};font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_PAPER};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:${BRAND_PAPER};padding:20px 24px 12px;border:1px solid #e2e8f0;border-bottom:none;border-radius:10px 10px 0 0;">
            ${sharnamEmailLogoHtml(172)}
          </td>
        </tr>
        <tr>
          <td style="background:${BRAND_NAVY};padding:16px 24px 20px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.72);">Sharnam Portal · Meeting invitation</div>
            <div style="font-size:20px;font-weight:700;color:#fff;margin-top:8px;line-height:1.35;">${escapeHtml(ctx.title)}</div>
            ${ctx.projectCode ? `<div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:6px;">${escapeHtml(ctx.projectCode)} · ${escapeHtml(fmtEmailDateTime(ctx.meetingDate))}</div>` : ""}
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#334155;">${escapeHtml(intro)}</p>
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Meeting particulars</p>
            ${detailTableHtml(rows)}
            ${agendaBlockHtml(ctx.agendaItems)}
            <div style="margin-top:22px;">${actions}</div>
            ${extra}
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;padding:16px 24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;font-size:11px;color:#64748b;line-height:1.5;">
            <p style="margin:0;">Flow on portal: <strong>Matrix → Create meeting → Generate agenda → Start MoM → Follow-up</strong> for open actions.</p>
            <p style="margin:8px 0 0;">This is one combined invite for all recipients. Sign in to the portal to update agenda or minutes.</p>
            <p style="margin:8px 0 0;color:#94a3b8;">— Sharnam Project Development Consultants · Portal notification</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const bodyText = [
    "Meeting invitation — Sharnam Portal",
    "",
    ctx.title,
    ctx.projectCode ? `Project: ${ctx.projectCode}${ctx.projectName ? ` — ${ctx.projectName}` : ""}` : "",
    `When: ${fmtTimeRange(ctx.meetingDate, ctx.endDate, ctx.durationMins)}`,
    ctx.location ? `Location: ${ctx.location}` : "",
    ctx.scheduledByName ? `Scheduled by: ${ctx.scheduledByName}` : "",
    ctx.attendeeList ? `Invited: ${ctx.attendeeList}` : "",
    "",
    ...(ctx.agendaItems?.length
      ? ["Agenda:", ...ctx.agendaItems.map((item, i) => `${i + 1}. ${item}`), ""]
      : []),
    ...(ctx.teamsJoinUrl ? ["Join Microsoft Teams:", ctx.teamsJoinUrl, ""] : []),
    "Portal agenda / MoM:",
    ctx.portalAgendaUrl,
    ...(ctx.calendarWebLink ? ["Outlook calendar:", ctx.calendarWebLink, ""] : []),
    ctx.teamsNote || "",
  ]
    .filter(Boolean)
    .join("\n");

  return { bodyHtml, bodyText };
}
