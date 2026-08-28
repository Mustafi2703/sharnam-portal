/**
 * 15-email UAT pack — comms matrix, meetings, MoM, design coordination, RFI (no human reply needed).
 *
 * Usage:
 *   npx tsx apps/api/scripts/send-comms-flow-demo-pack.ts preview
 *   npx tsx apps/api/scripts/send-comms-flow-demo-pack.ts all
 *   npx tsx apps/api/scripts/send-comms-flow-demo-pack.ts baibhabmustafi@gmail.com,nirav@spdc.in
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { buildMeetingScheduledEmail } from "../src/services/meetingEmailFormat.js";
import { buildNcrRaisedEmail } from "../src/services/ncrEmailFormat.js";
import {
  buildRfiClosedEmail,
  buildRfiRaisedEmail,
  buildRfiResponseEmail,
} from "../src/services/rfiEmailFormat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const portal = (process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
const projectId = process.env.TEST_PROJECT_ID || "cmsqixpod010n55hz8gk1bba5";
const projectCode = "SPDC-DEMO-01";

const TEAM = [
  "baibhabmustafi@gmail.com",
  "hello@twinoxis.com",
  "admin@twinoxis.com",
  "nirav@spdc.in",
  "operations@spdc.in",
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRecipients(raw: string) {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function send(opts: {
  graphFetch: typeof import("../src/services/graph.js").graphFetch;
  mailbox: string;
  to: string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
}) {
  const content = opts.bodyHtml || opts.bodyText || "";
  await opts.graphFetch(`/users/${encodeURIComponent(opts.mailbox)}/sendMail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: opts.subject,
        body: {
          contentType: opts.bodyHtml ? "HTML" : "Text",
          content,
        },
        toRecipients: opts.to.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    }),
  });
}

type MailJob = { subject: string; bodyHtml?: string; bodyText?: string };

export function buildCommsFlowDemoMails(): MailJob[] {
  const commsUrl = `${portal}/projects/${projectId}/comms?tab=matrix`;
  const agendaUrl = `${portal}/projects/${projectId}/comms?tab=agenda`;
  const momUrl = `${portal}/projects/${projectId}/comms?tab=mom`;
  const followUrl = `${portal}/projects/${projectId}/comms?tab=followup`;
  const coordUrl = `${portal}/projects/${projectId}/drawings/coordination`;
  const rfiUrl = `${portal}/projects/${projectId}/rfis?kind=RequestForInformation`;
  const qualityUrl = `${portal}/projects/${projectId}/inspections`;

  const meetingStart = new Date(Date.now() + 2 * 86400000);
  meetingStart.setHours(11, 0, 0, 0);
  const meetingEnd = new Date(meetingStart.getTime() + 90 * 60_000);

  const meetingInvite = buildMeetingScheduledEmail({
    projectCode,
    projectName: "SPDC Demo Project",
    title: "Weekly PMC coordination — site, design & quality",
    meetingDate: meetingStart,
    endDate: meetingEnd,
    durationMins: 90,
    location: "Microsoft Teams · Agent scheduled",
    status: "Agenda published",
    scheduledByName: "Sharnam Portal (automated agent)",
    attendeeList: TEAM.join(", "),
    portalAgendaUrl: agendaUrl,
    agendaItems: [
      "Communication matrix review — technical & commercial contacts",
      "Progress vs MS Project — dormitory & external works",
      "Open RFIs & drawing checklist items",
      "NCR / CAR — cube failures & rebar cover",
      "Design coordination — AHU duct vs beam clash",
      "MoM action follow-up from previous week",
    ],
    teamsNote: "Teams meeting created by portal agent. Join link appears in calendar invite when scheduled live.",
  });

  const rfiCtx = {
    projectCode,
    projectName: "SPDC Demo Project",
    number: "RFI-2026-UAT-142",
    subject: "UGWT waterproofing at plinth junction — AR-104",
    question:
      "Confirm membrane lap detail at UGWT–plinth junction per GFC AR-104. Contractor proposes alternate cold-joint — mock-up required?",
    rfiKind: "RequestForInformation",
    status: "Open",
    ballInCourt: "Design Consultant",
    dueDate: new Date(Date.now() + 4 * 86400000),
    createdByName: "Site Engineer — Sharnam PMC",
    createdAt: new Date(),
    scheduleImpact: "Potential 3-day delay",
    costImpact: "None",
    linkedDrawingNumber: "AR-104",
  };

  const rfiRaised = buildRfiRaisedEmail({ ctx: rfiCtx, registerUrl: rfiUrl });
  const rfiResponse = buildRfiResponseEmail({
    ctx: rfiCtx,
    responseText:
      "Proceed with detail 3 on AR-104 Rev C. One junction mock-up before bulk pour — PMC to witness. (Portal auto-response for UAT — no human reply required.)",
    respondedByName: "Design Consultant (portal agent)",
    registerUrl: rfiUrl,
    isOfficial: true,
  });
  const rfiClosed = buildRfiClosedEmail({
    ctx: { ...rfiCtx, status: "Closed" },
    registerUrl: rfiUrl,
  });

  const ncr = buildNcrRaisedEmail({
    ctx: {
      projectCode,
      projectName: "SPDC Demo Project",
      number: "NCR-Q-018",
      kind: "QualityNCR",
      status: "Open",
      description: "Cube test Block-1 B3–B5: 22.4 N/mm² vs M25. Hold pour until retest.",
      severity: "Major",
      location: "Dormitory Block-1",
      raisedByName: "Quality Engineer",
      raisedAt: new Date(),
    },
    registerUrl: qualityUrl,
  });

  const car = buildNcrRaisedEmail({
    ctx: {
      projectCode,
      projectName: "SPDC Demo Project",
      number: "CAR-007",
      kind: "QualityCAR",
      status: "Open",
      description: "Rebar cover 15mm vs 40mm spec — footings F-12 to F-18. CAP in 48h.",
      severity: "Medium",
      location: "Footings F-12–F18",
      raisedByName: "Quality Engineer",
      raisedAt: new Date(),
    },
    registerUrl: qualityUrl,
  });

  return [
    {
      subject: `[${projectCode}] UAT 1/15 — Comms flow overview`,
      bodyText: [
        "Sharnam Portal — 15-email UAT pack (automated, no human reply needed)",
        "",
        "Flow: Matrix → Meeting (agent) → Agenda → MoM → Follow-up → Design coordination → RFI → NCR/CAR",
        "",
        `Matrix: ${commsUrl}`,
        `Portal login: ${portal}/login/office`,
        "",
        "Password for live team users: Demo@1234 (after db:seed-live-team)",
        "",
        `Sent: ${new Date().toISOString()}`,
      ].join("\n"),
    },
    {
      subject: `[${projectCode}] UAT 2/15 — Communication matrix published`,
      bodyText: [
        "Technical communication matrix is live on the portal.",
        "",
        "Contacts: baibhabmustafi@gmail.com, hello@twinoxis.com, admin@twinoxis.com, nirav@spdc.in, operations@spdc.in",
        "",
        commsUrl,
      ].join("\n"),
    },
    {
      subject: `[${projectCode}] UAT 3/15 — Meeting invitation (Teams agent)`,
      bodyHtml: meetingInvite.bodyHtml,
    },
    {
      subject: `[${projectCode}] UAT 4/15 — Agenda published before MoM`,
      bodyText: ["Agenda published.", "", agendaUrl].join("\n"),
    },
    {
      subject: `[${projectCode}] UAT 5/15 — MoM minutes & actions recorded`,
      bodyText: ["MoM captured.", "", momUrl].join("\n"),
    },
    {
      subject: `[${projectCode}] UAT 6/15 — MoM follow-up reminder`,
      bodyText: ["Follow-up on open actions.", "", followUrl].join("\n"),
    },
    {
      subject: `[${projectCode}] UAT 7/15 — Design coordination issue raised`,
      bodyText: ["AHU duct vs beam clash — Level 3", "", coordUrl].join("\n"),
    },
    {
      subject: `[${projectCode}] UAT 8/15 — Design coordination follow-up 1/5`,
      bodyText: ["Follow-up 1 of 5 (automated).", "", coordUrl].join("\n"),
    },
    {
      subject: `[${projectCode}] UAT 9/15 — Coordination → RFI escalation preview`,
      bodyText: ["After 5 follow-ups portal escalates to RFI.", "", coordUrl, rfiUrl].join("\n"),
    },
    { subject: `[${projectCode}] UAT 10/15 — RFI raised (fill remaining details)`, bodyHtml: rfiRaised.bodyHtml },
    {
      subject: `[${projectCode}] UAT 11/15 — RFI official response (automated)`,
      bodyHtml: rfiResponse.bodyHtml,
    },
    { subject: `[${projectCode}] UAT 12/15 — NCR raised (NCR-Q-018)`, bodyHtml: ncr.bodyHtml },
    { subject: `[${projectCode}] UAT 13/15 — CAR raised (CAR-007)`, bodyHtml: car.bodyHtml },
    { subject: `[${projectCode}] UAT 14/15 — RFI closed`, bodyHtml: rfiClosed.bodyHtml },
    {
      subject: `[${projectCode}] UAT 15/15 — UAT pack complete`,
      bodyText: ["15 emails sent.", "", commsUrl].join("\n"),
    },
  ];
}

async function main() {
  const mode = (process.argv[2] || "preview").trim().toLowerCase();
  const { graphFetch, graphConfig } = await import("../src/services/graph.js");
  const cfg = graphConfig();
  if (!cfg.configured || !cfg.mailbox) {
    throw new Error("Graph not configured — set AZURE_* and GRAPH_MAIL_FROM in .env");
  }

  const recipients =
    mode === "preview"
      ? ["baibhabmustafi@gmail.com"]
      : mode === "all" || mode === "team"
        ? TEAM
        : parseRecipients(mode);

  if (!recipients.length) throw new Error("No recipients");

  const jobs = buildCommsFlowDemoMails();
  console.log(`Sending ${jobs.length} emails → ${recipients.join(", ")} from ${cfg.mailbox}`);

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    await send({ graphFetch, mailbox: cfg.mailbox, to: recipients, ...job });
    console.log(`✓ ${i + 1}/${jobs.length} ${job.subject.slice(0, 60)}`);
    await sleep(900);
  }

  console.log(JSON.stringify({ ok: true, count: jobs.length, recipients, portal }, null, 2));
}

main().catch((err) => {
  console.error("Send failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
