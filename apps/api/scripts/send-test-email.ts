import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const to = (process.argv[2] || "baibahbmustafi@gmail.com").trim();

async function main() {
  const { graphFetch, graphConfig } = await import("../src/services/graph.js");
  const cfg = graphConfig();

  if (!cfg.configured || !cfg.mailbox) {
    console.error("Graph not configured or GRAPH_MAIL_FROM missing");
    process.exit(1);
  }

  const subject = "Sharnam Portal — test email";
  const content = [
    "Hello — this is a test message from the Sharnam portal.",
    "",
    `From: ${cfg.mailbox}`,
    `Portal: https://portal.spdc.in`,
    `Sent: ${new Date().toISOString()}`,
  ].join("\n");

  await graphFetch(`/users/${encodeURIComponent(cfg.mailbox)}/sendMail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "Text", content },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });

  console.log(JSON.stringify({ ok: true, from: cfg.mailbox, to, subject }, null, 2));
}

main().catch((err) => {
  console.error("Send failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
