/**
 * Plain-text WhatsApp bodies for portal events (meetings, RFI, NCR, CAR).
 */
import { kindLabel, fmtEmailDate, fmtEmailDateTime } from "./rfiEmailFormat.js";
import type { MeetingEmailContext } from "./meetingEmailFormat.js";
import type { NcrEmailKind } from "./ncrEmailFormat.js";

function clip(s: string, max: number) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function whatsAppMeetingScheduled(ctx: MeetingEmailContext) {
  const when = fmtEmailDateTime(ctx.meetingDate);
  const lines = [
    `*Meeting invitation*`,
    `*${ctx.title}*`,
    ctx.projectCode ? `Project: ${ctx.projectCode}` : "",
    `When: ${when}${ctx.durationMins ? ` · ${ctx.durationMins} min` : ""}`,
    ctx.location ? `Where: ${ctx.location}` : "",
    ctx.scheduledByName ? `By: ${ctx.scheduledByName}` : "",
  ].filter(Boolean);

  if (ctx.agendaItems?.length) {
    lines.push("", "*Agenda:*");
    ctx.agendaItems.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  }

  lines.push("", `Portal agenda / MoM:`, ctx.portalAgendaUrl);
  if (ctx.teamsJoinUrl) lines.push(`Teams: ${ctx.teamsJoinUrl}`);

  return lines.join("\n");
}

export function whatsAppRfiRaised(opts: {
  number: string;
  subject: string;
  question: string;
  rfiKind: string;
  status?: string;
  dueDate?: Date | string | null;
  fillUrl?: string | null;
  registerUrl: string;
}) {
  const lines = [
    `*RFI raised — action required*`,
    `*${opts.number}*`,
    opts.subject,
    `Type: ${kindLabel(opts.rfiKind)}`,
    opts.status ? `Status: ${opts.status}` : "",
    opts.dueDate ? `Due: ${fmtEmailDate(opts.dueDate)}` : "",
    "",
    clip(opts.question, 400),
  ].filter(Boolean);

  if (opts.fillUrl) {
    lines.push("", `*Fill checklist:*`, opts.fillUrl);
  }
  lines.push("", `Register: ${opts.registerUrl}`);
  return lines.join("\n");
}

export function whatsAppRfiClosed(opts: { number: string; subject: string; registerUrl: string }) {
  return [
    `*RFI closed*`,
    `*${opts.number}*`,
    opts.subject,
    "",
    `Register: ${opts.registerUrl}`,
  ].join("\n");
}

export function whatsAppNcrStatus(opts: {
  kind: NcrEmailKind | "SafetyNCR";
  number: string;
  status: string;
  description: string;
  event: "created" | "updated" | "closed";
  registerUrl?: string;
}) {
  const label =
    opts.kind === "SafetyNCR" ? "Safety NCR" : opts.kind === "QualityCAR" ? "CAR" : "Quality NCR";
  const verb =
    opts.event === "created" ? "raised" : opts.event === "closed" ? "closed" : "updated";
  const lines = [
    `*${label} ${verb}*`,
    `*${opts.number}*`,
    `Status: ${opts.status}`,
    "",
    clip(opts.description, 450),
  ];
  if (opts.registerUrl) lines.push("", `Portal: ${opts.registerUrl}`);
  return lines.join("\n");
}
