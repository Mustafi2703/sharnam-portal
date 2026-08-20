/**
 * Send real Graph emails documenting the RFI + checklist fill → review → close flow
 * for every RFI kind. Default recipient: Baibhab Kumar Mustafi.
 *
 * Usage (from repo root, with Graph env in .env):
 *   npx tsx apps/api/scripts/send-rfi-flow-test-emails.ts
 *   npx tsx apps/api/scripts/send-rfi-flow-test-emails.ts you@example.com
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const to = (process.argv[2] || "baibhabmustafi@gmail.com").trim();
const portal = (process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");

const KINDS: { kind: string; label: string; needsChecklist: boolean; fillFamily: string }[] = [
  { kind: "RequestForInformation", label: "Ask (PMC RFI)", needsChecklist: false, fillFamily: "DrawingCheck" },
  { kind: "DrawingChecklist", label: "Drawing checklist fill", needsChecklist: true, fillFamily: "DrawingCheck" },
  { kind: "QualityInspection", label: "Quality inspection fill", needsChecklist: true, fillFamily: "QualityInspection" },
  { kind: "SafetyChecklist", label: "Safety checklist fill", needsChecklist: true, fillFamily: "Safety" },
  { kind: "QualityIR", label: "Quality IR (RIA)", needsChecklist: true, fillFamily: "QualityInspection" },
  { kind: "SafetyIR", label: "Safety IR", needsChecklist: true, fillFamily: "Safety" },
  { kind: "ActivityInspection", label: "Activity inspection checklist", needsChecklist: true, fillFamily: "ActivityInspection" },
  { kind: "SiteExecution", label: "Field / site checklist", needsChecklist: true, fillFamily: "SiteExecution" },
  { kind: "ClientConcern", label: "Client concern", needsChecklist: false, fillFamily: "DrawingCheck" },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendMail(opts: { subject: string; body: string }) {
  const { graphFetch, graphConfig } = await import("../src/services/graph.js");
  const cfg = graphConfig();
  if (!cfg.configured || !cfg.mailbox) {
    throw new Error("Graph not configured or GRAPH_MAIL_FROM missing — set AZURE_* and GRAPH_MAIL_FROM in .env");
  }
  await graphFetch(`/users/${encodeURIComponent(cfg.mailbox)}/sendMail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: opts.subject,
        body: { contentType: "Text", content: opts.body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
  return cfg.mailbox as string;
}

async function main() {
  console.log(`Sending RFI flow test pack → ${to}`);
  console.log(`Portal: ${portal}`);

  const overview = [
    "Sharnam Portal — RFI + checklist workflow (test pack)",
    "",
    "How RFIs and checklists work together:",
    "",
    "1) RAISE — Office/site raises an RFI of a given kind.",
    "   Checklist kinds MUST attach a project checklist assignment.",
    "   You get an email with a deep link to FILL the checklist.",
    "",
    "2) FILL — Site engineer opens the link (signs in), completes items,",
    "   attaches photos if required, then Submit.",
    "",
    "3) REVIEW — Office gets an email with branded HTML/Excel links.",
    "   Open the filled file, then Approve / Reject on the fill log.",
    "   RFI moves to Answered / ball-in-court Office (not closed yet).",
    "",
    "4) CLOSE — Office closes the RFI from the register (or Approve + close RFI).",
    "   A closed notification email is sent.",
    "",
    `Portal home: ${portal}`,
    `Demo project RFIs: ${portal}/projects (pick SPDC-DEMO-01 → RFIs)`,
    "",
    "Following emails (1 per kind) simulate the RAISE notification with the correct fill/register links.",
    "",
    `Sent: ${new Date().toISOString()}`,
  ].join("\n");

  const from = await sendMail({
    subject: "[Sharnam] RFI workflow overview — Baibhab Kumar Mustafi",
    body: overview,
  });
  console.log(`✓ Overview from ${from}`);

  for (const k of KINDS) {
    const number = `TEST-${k.kind.slice(0, 6).toUpperCase()}-001`;
    const fillDemo = `${portal}/projects/SPDC-DEMO-01/checklist/fill/ASSIGNMENT_ID?family=${encodeURIComponent(k.fillFamily)}`;
    const register = `${portal}/projects/SPDC-DEMO-01/rfis?kind=${encodeURIComponent(k.kind)}`;
    const logs =
      k.fillFamily === "QualityInspection"
        ? `${portal}/projects/SPDC-DEMO-01/quality/checklist-logs`
        : k.fillFamily === "Safety"
          ? `${portal}/projects/SPDC-DEMO-01/safety/checklist-logs`
          : k.fillFamily === "ActivityInspection"
            ? `${portal}/projects/SPDC-DEMO-01/inspection/checklist-logs`
            : k.fillFamily === "SiteExecution"
              ? `${portal}/projects/SPDC-DEMO-01/field/checklist-logs`
              : `${portal}/projects/SPDC-DEMO-01/drawings/checklist-logs`;

    const body = [
      `TEST EMAIL — ${k.label}`,
      `Kind code: ${k.kind}`,
      `Number (example): ${number}`,
      "",
      "Subject: Portal RFI flow test — fill / review / close",
      "",
      k.needsChecklist
        ? [
            "This kind ATTACHES a checklist. Raise flow:",
            "  Hub → Request … fill → pick checklist template assignment → Raise",
            "",
            "── STEP A — Fill link (emailed on raise) ──",
            fillDemo,
            "(Replace ASSIGNMENT_ID with the real assignment id from the portal.)",
            "",
            "── STEP B — After submit (office review) ──",
            `Fill log: ${logs}`,
            "Open Branded PDF / Branded Excel → Approve (optionally close RFI).",
            "",
            "── STEP C — Close RFI ──",
            register,
            "Select the RFI → Close → closed email fires.",
          ].join("\n")
        : [
            "This kind has NO checklist attachment (query / concern only).",
            "",
            "── Respond in portal ──",
            register,
            "Post official response → then Close.",
          ].join("\n"),
      "",
      "— Sharnam Portal test · Baibhab Kumar Mustafi",
    ].join("\n");

    await sleep(800);
    await sendMail({
      subject: `[Sharnam][${k.kind}] Raise → ${k.needsChecklist ? "Fill link" : "Respond"} → Review → Close`,
      body,
    });
    console.log(`✓ ${k.kind}`);
  }

  await sleep(800);
  await sendMail({
    subject: "[Sharnam] SAMPLE — checklist submitted for review",
    body: [
      "SAMPLE: after site submits a filled checklist linked to an RFI.",
      "",
      "Checklist: Example — RCC column casting",
      "Family: ActivityInspection",
      "Linked RFI: CL-001",
      "",
      "── OPEN FILLED RECORD ──",
      `${portal}/api/checklist/submissions/SUBMISSION_ID/branded.html`,
      `${portal}/api/checklist/submissions/SUBMISSION_ID/branded.xlsx`,
      "",
      "── REVIEW ──",
      `${portal}/projects/SPDC-DEMO-01/inspection/checklist-logs`,
      "",
      "Office: open branded file → Approve (+ close RFI) or Reject.",
      "",
      "— Sharnam Portal test",
    ].join("\n"),
  });
  console.log("✓ Sample review email");

  await sleep(800);
  await sendMail({
    subject: "[Sharnam] SAMPLE — RFI Closed",
    body: [
      "SAMPLE: RFI CL-001 has been closed on the portal.",
      "",
      "Subject: Portal RFI flow test — fill / review / close",
      "Kind: ActivityInspection",
      "",
      `View register: ${portal}/projects/SPDC-DEMO-01/rfis?kind=ActivityInspection`,
      "",
      "— Sharnam Portal test · closed notification",
    ].join("\n"),
  });
  console.log("✓ Sample closed email");

  console.log(JSON.stringify({ ok: true, from, to, kinds: KINDS.length + 3 }, null, 2));
}

main().catch((err) => {
  console.error("Send failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
