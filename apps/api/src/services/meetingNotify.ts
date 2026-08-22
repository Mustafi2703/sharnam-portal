import { queueProjectEmail } from "./email.js";
import { buildMeetingScheduledEmail } from "./meetingEmailFormat.js";
import { createTeamsSchedule, graphConfig } from "./graph.js";
import { portalOrigin } from "./rfiFlowNotify.js";

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

export type ScheduleMeetingWithInviteOpts = {
  projectId: string;
  projectCode?: string;
  projectName?: string;
  meetingId: string;
  title: string;
  meetingDate: Date;
  durationMins?: number;
  location?: string | null;
  status?: string;
  createdByName?: string;
  createdById?: string;
  /** Comma-separated — one formatted email to all (single Graph sendMail) */
  attendeeEmails: string;
  createTeams?: boolean;
};

export type ScheduleMeetingResult = {
  teamsJoinUrl: string | null;
  graphEventId: string | null;
  calendarWebLink: string | null;
  teamsProvider: string;
  teamsNote: string | null;
  email: Awaited<ReturnType<typeof queueProjectEmail>>;
};

/**
 * Create Microsoft Teams / calendar slot + send ONE formatted HTML invite to all attendees.
 */
export async function scheduleMeetingWithInvite(
  opts: ScheduleMeetingWithInviteOpts
): Promise<ScheduleMeetingResult> {
  const durationMins = opts.durationMins && opts.durationMins > 0 ? opts.durationMins : 60;
  const end = new Date(opts.meetingDate.getTime() + durationMins * 60_000);
  const portal = portalOrigin();
  const portalAgendaUrl = `${portal}/projects/${opts.projectId}/comms?tab=agenda&meeting=${opts.meetingId}`;
  const recipients = parseEmails(opts.attendeeEmails);

  let teamsJoinUrl: string | null = null;
  let graphEventId: string | null = null;
  let calendarWebLink: string | null = null;
  let teamsProvider = "none";
  let teamsNote: string | null = null;

  const shouldCreateTeams = opts.createTeams !== false && graphConfig().configured;

  if (shouldCreateTeams) {
    const subject = opts.projectCode
      ? `[${opts.projectCode}] ${opts.title}`
      : opts.title;
    const schedule = await createTeamsSchedule({
      subject,
      start: opts.meetingDate,
      end,
      location: opts.location || "Microsoft Teams",
      bodyHtml: `<p>Project meeting scheduled via Sharnam Portal.</p><p><a href="${portalAgendaUrl}">Open agenda / MoM</a></p>`,
    });
    teamsJoinUrl = schedule.teamsJoinUrl;
    graphEventId = schedule.graphEventId;
    calendarWebLink = schedule.calendarWebLink;
    teamsProvider = schedule.provider;
    teamsNote = schedule.note;
  }

  const attendeeList = recipients.join(", ");
  const { bodyHtml, bodyText } = buildMeetingScheduledEmail({
    projectCode: opts.projectCode,
    projectName: opts.projectName,
    title: opts.title,
    meetingDate: opts.meetingDate,
    endDate: end,
    durationMins,
    location: opts.location,
    status: opts.status || "Agenda",
    scheduledByName: opts.createdByName,
    attendeeList,
    teamsJoinUrl,
    calendarWebLink,
    portalAgendaUrl,
    teamsNote,
  });

  const email = await queueProjectEmail({
    projectId: opts.projectId,
    subject: `Meeting invitation — ${opts.title}`,
    body: bodyText,
    bodyHtml,
    context: "meeting.schedule",
    createdById: opts.createdById,
    toOverride: opts.attendeeEmails,
  });

  return {
    teamsJoinUrl,
    graphEventId,
    calendarWebLink,
    teamsProvider,
    teamsNote,
    email,
  };
}

/** @deprecated use scheduleMeetingWithInvite */
export async function notifyMeetingScheduled(opts: ScheduleMeetingWithInviteOpts) {
  return scheduleMeetingWithInvite(opts);
}
