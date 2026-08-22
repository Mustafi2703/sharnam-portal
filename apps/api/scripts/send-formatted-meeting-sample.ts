/**
 * Send one formatted HTML meeting invite (Teams + portal) — preview / test.
 *
 *   npx tsx apps/api/scripts/send-formatted-meeting-sample.ts
 *   npx tsx apps/api/scripts/send-formatted-meeting-sample.ts hello@twinoxis.com,baibhabmustafi@gmail.com
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const recipients = (process.argv[2] || "hello@twinoxis.com,baibhabmustafi@gmail.com").split(/[,;]+/).map((s) => s.trim());
const portal = (process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
const projectId = "cmsqixpod010n55hz8gk1bba5";

async function main() {
  const { graphFetch, graphConfig, createTeamsSchedule } = await import("../src/services/graph.js");
  const { buildMeetingScheduledEmail } = await import("../src/services/meetingEmailFormat.js");
  const cfg = graphConfig();
  if (!cfg.configured || !cfg.mailbox) throw new Error("Graph not configured");

  const start = new Date(Date.now() + 2 * 86400000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  const title = "Weekly site coordination — formatted invite test";
  const meetingId = `sample-${Date.now()}`;
  const portalAgendaUrl = `${portal}/projects/${projectId}/comms?tab=agenda&meeting=${meetingId}`;

  const schedule = await createTeamsSchedule({
    subject: `[SPDC-DEMO-01] ${title}`,
    start,
    end,
    location: "Microsoft Teams / Site cabin",
    bodyHtml: `<p>Sharnam Portal meeting test</p><p><a href="${portalAgendaUrl}">Agenda</a></p>`,
  });

  const { bodyHtml, bodyText } = buildMeetingScheduledEmail({
    projectCode: "SPDC-DEMO-01",
    projectName: "SPDC Demo Project",
    title,
    meetingDate: start,
    endDate: end,
    durationMins: 60,
    location: "Microsoft Teams / Site cabin",
    status: "Agenda",
    scheduledByName: "Sharnam PMC Office",
    attendeeList: recipients.join(", "),
    teamsJoinUrl: schedule.teamsJoinUrl,
    calendarWebLink: schedule.calendarWebLink,
    portalAgendaUrl,
    teamsNote: schedule.note,
  });

  await graphFetch(`/users/${encodeURIComponent(cfg.mailbox)}/sendMail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: `[SPDC-DEMO-01] Meeting invitation — ${title}`,
        body: { contentType: "HTML", content: bodyHtml },
        toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    }),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        from: cfg.mailbox,
        to: recipients,
        teamsJoinUrl: schedule.teamsJoinUrl,
        calendarWebLink: schedule.calendarWebLink,
        teamsProvider: schedule.provider,
        teamsNote: schedule.note,
        portalAgendaUrl,
        plainPreview: bodyText.split("\n").slice(0, 14),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
