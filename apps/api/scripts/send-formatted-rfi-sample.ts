/**
 * Send one sample formatted HTML RFI email (for preview before deploy).
 *
 *   npx tsx apps/api/scripts/send-formatted-rfi-sample.ts baibhabmustafi@gmail.com
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { buildRfiRaisedEmail } from "../src/services/rfiEmailFormat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const to = (process.argv[2] || "baibhabmustafi@gmail.com").trim();
const portal = (process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");

async function main() {
  const { graphFetch, graphConfig } = await import("../src/services/graph.js");
  const cfg = graphConfig();
  if (!cfg.configured || !cfg.mailbox) throw new Error("Graph not configured");

  const projectId = "cmsqixpod010n55hz8gk1bba5";
  const assignmentId = "cmsqixpxy01e755hzy76cliqo";
  const fillUrl = `${portal}/projects/${projectId}/checklist/fill/${assignmentId}?family=DrawingCheck`;
  const registerUrl = `${portal}/projects/${projectId}/rfis?kind=DrawingChecklist&view=register`;

  const { bodyHtml, bodyText } = buildRfiRaisedEmail({
    ctx: {
      projectCode: "SPDC-DEMO-01",
      projectName: "SPDC Demo Project",
      number: "DWG-RFI-SAMPLE",
      subject: "Formatted RFI email — Drawing checklist fill",
      question:
        "Please complete the Architectural Drawing Review Checklist for the latest GFC upload.\nAttach site photos where applicable and submit for PMC review by due date.",
      rfiKind: "DrawingChecklist",
      status: "Open",
      ballInCourt: "Assignee",
      irNumber: "IR/ARCH/024",
      dueDate: new Date(Date.now() + 5 * 86400000),
      createdByName: "Sharnam PMC Office",
      createdAt: new Date(),
      assignedToName: "Site Engineer",
      linkedDrawingNumber: "AR-101",
      linkedDrawingTitle: "Typical floor plan — Tower 1",
      linkedChecklistName: "ARCHITECTURAL DRAWING REVIEW CHECKLIST",
      vendorName: "Main Contractor",
      scheduleImpact: "None",
      costImpact: "None",
      questionReceivedFrom: "Design coordination meeting",
    },
    fillUrl,
    registerUrl,
  });

  await graphFetch(`/users/${encodeURIComponent(cfg.mailbox)}/sendMail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: "[SPDC-DEMO-01] Action required — DWG-RFI-SAMPLE: Formatted RFI preview",
        body: { contentType: "HTML", content: bodyHtml },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });

  console.log(JSON.stringify({ ok: true, from: cfg.mailbox, to, plainPreviewLines: bodyText.split("\n").slice(0, 12) }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
