/**
 * Send branded Sharnam test emails: meeting (agenda), RFI, Quality NCR, CAR.
 *
 * Usage:
 *   npx tsx apps/api/scripts/send-spdc-branded-test-pack.ts preview
 *   npx tsx apps/api/scripts/send-spdc-branded-test-pack.ts nirav@spdc.in,ops@spdc.in
 *   npx tsx apps/api/scripts/send-spdc-branded-test-pack.ts baibhabmustafi@gmail.com
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { buildMeetingScheduledEmail } from "../src/services/meetingEmailFormat.js";
import { buildNcrRaisedEmail } from "../src/services/ncrEmailFormat.js";
import { buildRfiRaisedEmail } from "../src/services/rfiEmailFormat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const PREVIEW_EMAIL = "baibhabmustafi@gmail.com";
const SPDC_TEAM = "nirav@spdc.in,operations@spdc.in";

const portal = (process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
const projectId = process.env.TEST_PROJECT_ID || "cmsqixpod010n55hz8gk1bba5";
const projectCode = "SPDC-DEMO-01";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRecipients(raw: string) {
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function sendHtml(opts: {
  graphFetch: typeof import("../src/services/graph.js").graphFetch;
  mailbox: string;
  to: string[];
  subject: string;
  bodyHtml: string;
}) {
  await opts.graphFetch(`/users/${encodeURIComponent(opts.mailbox)}/sendMail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: opts.subject,
        body: { contentType: "HTML", content: opts.bodyHtml },
        toRecipients: opts.to.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    }),
  });
}

async function sendPack(recipients: string[], graphFetch: typeof import("../src/services/graph.js").graphFetch, mailbox: string) {
  const meetingStart = new Date(Date.now() + 2 * 86400000);
  meetingStart.setHours(11, 0, 0, 0);
  const meetingEnd = new Date(meetingStart.getTime() + 90 * 60_000);
  const meetingId = `test-${Date.now()}`;
  const portalAgendaUrl = `${portal}/projects/${projectId}/comms?tab=agenda&meeting=${meetingId}`;
  const agendaItems = [
    "Progress vs MS Project — dormitory block & external works",
    "Open RFIs — drawing checklist & quality inspection items",
    "NCR / CAR status — RCC cube failures & rebar cover",
    "Cost monitoring — MB/BBS sync vs certified quantities",
    "Safety walk observations & HIRA updates",
    "Action items from previous MoM",
  ];

  const meeting = buildMeetingScheduledEmail({
    projectCode,
    projectName: "SPDC Demo Project",
    title: "Weekly PMC coordination — site, design & quality",
    meetingDate: meetingStart,
    endDate: meetingEnd,
    durationMins: 90,
    location: "Microsoft Teams / Site office — SPDC",
    status: "Agenda published",
    scheduledByName: "Sharnam PMC Office",
    attendeeList: recipients.join(", "),
    portalAgendaUrl,
    agendaItems,
    teamsNote: "Teams link will be shared separately when the live meeting is scheduled from the portal.",
  });

  await sendHtml({
    graphFetch,
    mailbox,
    to: recipients,
    subject: `[${projectCode}] Meeting invitation — Weekly PMC coordination`,
    bodyHtml: meeting.bodyHtml,
  });
  console.log(`✓ Meeting invite + agenda → ${recipients.join(", ")}`);
  await sleep(1200);

  const registerUrl = `${portal}/projects/${projectId}/rfis?kind=RequestForInformation&view=register`;
  const rfi = buildRfiRaisedEmail({
    ctx: {
      projectCode,
      projectName: "SPDC Demo Project",
      number: "RFI-2026-0142",
      subject: "Clarification on UGWT waterproofing detail at junction with dormitory plinth",
      question:
        "Please confirm the membrane lap detail at the UGWT–plinth junction per latest GFC revision AR-104.\nContractor proposes alternate cold-joint treatment — advise if a site mock-up is required before bulk pour.",
      rfiKind: "RequestForInformation",
      status: "Open",
      ballInCourt: "Design Consultant",
      dueDate: new Date(Date.now() + 4 * 86400000),
      createdByName: "Site Engineer — Sharnam PMC",
      createdAt: new Date(),
      assignedToName: "AK Consultant",
      linkedDrawingNumber: "AR-104",
      linkedDrawingTitle: "UGWT & plinth junction detail",
      scheduleImpact: "Potential 3-day delay if unresolved",
      costImpact: "None",
      questionReceivedFrom: "Site coordination",
    },
    registerUrl,
  });

  await sendHtml({
    graphFetch,
    mailbox,
    to: recipients,
    subject: `[${projectCode}] Action required — RFI-2026-0142: UGWT waterproofing clarification`,
    bodyHtml: rfi.bodyHtml,
  });
  console.log(`✓ RFI raised → ${recipients.join(", ")}`);
  await sleep(1200);

  const qualityUrl = `${portal}/projects/${projectId}/quality/ncr`;
  const ncr = buildNcrRaisedEmail({
    ctx: {
      projectCode,
      projectName: "SPDC Demo Project",
      number: "NCR-Q-018",
      kind: "QualityNCR",
      status: "Open",
      description:
        "Cube test result for Dormitory Block-1, Grid B3–B5 at 28 days: average strength 22.4 N/mm² against specified M25 (required 25 N/mm²).\nImmediate hold on further concreting in affected bay until root cause review.",
      severity: "Major",
      location: "Dormitory Block-1 · Grid B3–B5",
      activityTask: "RCC column & beam — 1st floor",
      rootCause: "Under investigation — suspected water-cement ratio at pour",
      correctiveAction: "Core sample & retest; hold notice to contractor",
      responsibleParty: "Main Contractor — Bhavna Infra",
      targetCompletion: new Date(Date.now() + 7 * 86400000),
      raisedByName: "Quality Engineer — Sharnam PMC",
      raisedAt: new Date(),
    },
    registerUrl: qualityUrl,
  });

  await sendHtml({
    graphFetch,
    mailbox,
    to: recipients,
    subject: ncr.subject,
    bodyHtml: ncr.bodyHtml,
  });
  console.log(`✓ Quality NCR raised → ${recipients.join(", ")}`);
  await sleep(1200);

  const car = buildNcrRaisedEmail({
    ctx: {
      projectCode,
      projectName: "SPDC Demo Project",
      number: "CAR-007",
      kind: "QualityCAR",
      status: "Open",
      description:
        "Recurring inadequate rebar cover (15 mm measured vs 40 mm spec) observed during QI for footings F-12 to F-18.\nCorrective action plan required from contractor within 48 hours including supervisor re-briefing and spacer audit.",
      severity: "Medium",
      location: "Footings F-12 to F-18",
      activityTask: "Footing reinforcement — UGWT zone",
      correctiveAction: "Submit method statement revision; PMC to witness next 3 pours",
      responsibleParty: "Main Contractor — Bhavna Infra",
      targetCompletion: new Date(Date.now() + 3 * 86400000),
      raisedByName: "Quality Engineer — Sharnam PMC",
      raisedAt: new Date(),
    },
    registerUrl: qualityUrl,
  });

  await sendHtml({
    graphFetch,
    mailbox,
    to: recipients,
    subject: car.subject,
    bodyHtml: car.bodyHtml,
  });
  console.log(`✓ CAR raised → ${recipients.join(", ")}`);
}

async function main() {
  const mode = (process.argv[2] || "preview").trim().toLowerCase();
  const { graphFetch, graphConfig } = await import("../src/services/graph.js");
  const cfg = graphConfig();
  if (!cfg.configured || !cfg.mailbox) {
    throw new Error("Graph not configured — set AZURE_* and GRAPH_MAIL_FROM in .env");
  }

  if (mode === "preview" || mode === "me") {
    console.log(`Phase 1 — preview pack → ${PREVIEW_EMAIL}`);
    await sendPack([PREVIEW_EMAIL], graphFetch, cfg.mailbox);
    console.log("\nPreview sent. Run again with SPDC recipients:");
    console.log("  npx tsx apps/api/scripts/send-spdc-branded-test-pack.ts spdc");
    return;
  }

  const recipients =
    mode === "spdc" ? parseRecipients(SPDC_TEAM) : parseRecipients(mode === "all" ? `${PREVIEW_EMAIL},${SPDC_TEAM}` : mode);

  if (!recipients.length) throw new Error("No recipients");

  console.log(`Sending branded test pack → ${recipients.join(", ")}`);
  await sendPack(recipients, graphFetch, cfg.mailbox);
  console.log(JSON.stringify({ ok: true, from: cfg.mailbox, recipients, portal }, null, 2));
}

main().catch((err) => {
  console.error("Send failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
