import { prisma } from "../prisma.js";
import { queueProjectEmail } from "./email.js";
import { getProjectMatrixEmails } from "./matrixContacts.js";
import { portalOrigin } from "./rfiFlowNotify.js";

type MeetingStage = "agenda" | "mom" | "followup" | "invite";

function stageSubject(stage: MeetingStage, title: string, projectCode?: string) {
  const prefix = projectCode ? `[${projectCode}] ` : "";
  switch (stage) {
    case "agenda":
      return `${prefix}Meeting agenda — ${title}`;
    case "mom":
      return `${prefix}Minutes of meeting — ${title}`;
    case "followup":
      return `${prefix}Follow-up meeting — ${title}`;
    default:
      return `${prefix}${title}`;
  }
}

/** Notify all communication-matrix contacts about a meeting stage change. */
export async function notifyMeetingMatrixContacts(opts: {
  projectId: string;
  meetingId: string;
  stage: MeetingStage;
  createdById?: string;
  extraBody?: string;
}) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: opts.meetingId },
    include: {
      project: { select: { code: true, name: true, clientName: true } },
      items: true,
    },
  });
  if (!meeting) return { skipped: true as const, reason: "meeting_not_found" };

  const { all } = await getProjectMatrixEmails(opts.projectId);
  if (!all.length) return { skipped: true as const, reason: "no_matrix_emails" };

  const portal = portalOrigin();
  const link = `${portal}/projects/${opts.projectId}/comms?tab=${opts.stage === "mom" ? "mom" : opts.stage === "followup" ? "followup" : "agenda"}&meeting=${opts.meetingId}`;
  const agendaLines = meeting.items
    .filter((i) => i.category === "Agenda" || i.category === "Action" || i.category === "Follow-up")
    .slice(0, 20)
    .map((i) => `• [${i.category}] ${i.description}`)
    .join("\n");

  const bodyText = [
    `Project: ${meeting.project.name} (${meeting.project.code})`,
    `Meeting: ${meeting.title}`,
    `Date: ${meeting.meetingDate.toLocaleString("en-IN")}`,
    meeting.location ? `Location: ${meeting.location}` : "",
    "",
    opts.extraBody || "",
    agendaLines ? `Items:\n${agendaLines}` : "",
    "",
    `Open in portal: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  const bodyHtml = `<p>${bodyText.replace(/\n/g, "<br/>")}</p><p><a href="${link}">Open meeting in Sharnam portal</a></p>`;

  const result = await queueProjectEmail({
    projectId: opts.projectId,
    subject: stageSubject(opts.stage, meeting.title, meeting.project.code),
    body: bodyText,
    bodyHtml,
    context: `meeting.${opts.stage}`,
    createdById: opts.createdById,
    toOverride: all.join(", "),
  });

  return { ok: true as const, to: all, result };
}
