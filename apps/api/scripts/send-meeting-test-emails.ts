/**
 * Send meeting-schedule notification emails via Graph (same body as portal meeting create).
 *
 *   npx tsx apps/api/scripts/send-meeting-test-emails.ts
 *   npx tsx apps/api/scripts/send-meeting-test-emails.ts hello@twinoxis.com,baibhabmustafi@gmail.com
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const recipients = (process.argv[2] || "hello@twinoxis.com,baibhabmustafi@gmail.com").split(/[,;]+/).map((s) => s.trim());
const portal = (process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
const projectId = process.env.TEST_PROJECT_ID || "cmsqixpod010n55hz8gk1bba5";
const projectCode = "SPDC-DEMO-01";

async function main() {
  const { graphFetch, graphConfig } = await import("../src/services/graph.js");
  const cfg = graphConfig();
  if (!cfg.configured || !cfg.mailbox) throw new Error("Graph not configured");

  const meetingDate = new Date(Date.now() + 86400000);
  const meetingId = `test-${Date.now()}`;
  const register = `${portal}/projects/${projectId}/comms?tab=agenda&meeting=${meetingId}`;
  const title = `Sharnam portal — drawings / comms test meeting (${meetingDate.toLocaleDateString("en-GB")})`;

  const body = [
    "Project meeting scheduled on the Sharnam portal (test).",
    "",
    `Project: ${projectCode}`,
    `Title: ${title}`,
    `When: ${meetingDate.toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    "Location: Microsoft Teams / Site office",
    "",
    "── PORTAL (agenda / MoM) ──",
    register,
    "Sign in to view agenda, generate MoM, and track action items.",
    "",
    "── NEXT STEPS ──",
    "1. Open portal → Comms → Create meeting → Generate agenda → Start MoM",
    "2. Drawings: Master register + GFC upload (Drawing Check Master gate)",
    "3. RFIs: Ask (PMC RFI) or checklist fill links from email",
    "",
    "— Sharnam Portal · Meetings & MoM · test",
  ].join("\n");

  for (const to of recipients) {
    await graphFetch(`/users/${encodeURIComponent(cfg.mailbox)}/sendMail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: `[Sharnam][${projectCode}] Meeting scheduled — ${title}`,
          body: { contentType: "Text", content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: true,
      }),
    });
    console.log(`✓ Meeting invite test → ${to}`);
  }

  console.log(JSON.stringify({ ok: true, from: cfg.mailbox, recipients, portal }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
