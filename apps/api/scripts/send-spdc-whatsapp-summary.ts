/**
 * WhatsApp summary — meetings, RFIs, NCR, CAR (Sharnam portal).
 *
 *   npx tsx apps/api/scripts/send-spdc-whatsapp-summary.ts
 *   npx tsx apps/api/scripts/send-spdc-whatsapp-summary.ts 8160757201,9106945294
 *   npx tsx apps/api/scripts/send-spdc-whatsapp-summary.ts --send   # requires MSG91/Twilio in .env
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sendWhatsAppText, waMeLink, whatsAppConfigured } from "../src/services/whatsappNotify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const DEFAULT_MOBILES = ["8160757201", "9106945294"]; // Nirav Parekh · Saurabh Prajapati (comms matrix)
const portal = (process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
const projectCode = "SPDC-DEMO-01";

function buildSummaryMessage() {
  const meetingDate = new Date(Date.now() + 2 * 86400000);
  meetingDate.setHours(11, 0, 0, 0);
  const when = meetingDate.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return [
    `*शरणम् Portal — ${projectCode}*`,
    `*Project update summary*`,
    ``,
    `📅 *MEETING INVITE*`,
    `Weekly PMC coordination — site, design & quality`,
    `When: ${when} IST · 90 min`,
    `Venue: Microsoft Teams / Site office`,
    `*Agenda:*`,
    `1. Progress vs MS Project (dormitory + external works)`,
    `2. Open RFIs — drawing & quality inspections`,
    `3. NCR / CAR status — cube tests & rebar cover`,
    `4. Cost — MB/BBS vs certified qty`,
    `5. Safety walk & HIRA`,
    `6. Previous MoM action items`,
    `Portal MoM: ${portal}/projects`,
    ``,
    `📋 *RFI — Action required*`,
    `*RFI-2026-0142* · UGWT waterproofing at plinth junction`,
    `Status: Open · Ball: Design Consultant`,
    `Due: ${new Date(Date.now() + 4 * 86400000).toLocaleDateString("en-GB")}`,
    `Drawing: AR-104 · Clarify membrane lap detail before bulk pour.`,
    ``,
    `⚠️ *QUALITY NCR — Open*`,
    `*NCR-Q-018* · Cube failure M25`,
    `Location: Dormitory Block-1 · Grid B3–B5`,
    `Result: 22.4 N/mm² vs 25 required (28-day)`,
    `Action: Hold bay · core sample · contractor notify`,
    ``,
    `🔧 *CAR — Corrective action*`,
    `*CAR-007* · Inadequate rebar cover (15 mm vs 40 mm spec)`,
    `Location: Footings F-12 to F-18`,
    `Due: Contractor method statement within 48 hrs`,
    ``,
    `🔗 Portal: ${portal}`,
    `— Sharnam Project Development Consultants`,
  ].join("\n");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--send");
  const forceSend = process.argv.includes("--send");
  const mobiles = args.length ? args[0]!.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : DEFAULT_MOBILES;
  const text = buildSummaryMessage();
  const cfg = whatsAppConfigured();

  console.log("═".repeat(60));
  console.log("WhatsApp summary preview:\n");
  console.log(text);
  console.log("\n" + "═".repeat(60));

  if (!cfg.ready && !forceSend) {
    console.log("\n⚠️  WhatsApp API not configured — cannot auto-send.");
    console.log("Add to .env (MSG91 example):");
    console.log("  WHATSAPP_PROVIDER=msg91");
    console.log("  MSG91_AUTH_KEY=...");
    console.log("  MSG91_WHATSAPP_SENDER=...");
    console.log("  MSG91_INTEGRATED_NUMBER=...");
    console.log("\nOne-click *wa.me* links (open on phone → tap Send):");
    for (const m of mobiles) {
      console.log(`\n  ${m}:\n  ${waMeLink(m, text)}`);
    }
    console.log("\nTo retry API send after configuring .env:");
    console.log("  npx tsx apps/api/scripts/send-spdc-whatsapp-summary.ts --send");
    return;
  }

  console.log(`\nSending via ${cfg.provider} → ${mobiles.join(", ")}`);
  for (const mobile of mobiles) {
    const result = await sendWhatsAppText(mobile, text);
    if (result.ok) {
      console.log(`✓ ${mobile} — sent (${result.provider}${result.messageId ? ` · ${result.messageId}` : ""})`);
    } else {
      console.error(`✗ ${mobile} — ${result.error}`);
      console.log(`  Fallback: ${waMeLink(mobile, text)}`);
    }
    await sleep(1500);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
