/**
 * Send morning digest to SPDC leadership (preview or live via Graph).
 *
 *   npx tsx apps/api/scripts/send-daily-digest.ts preview
 *   npx tsx apps/api/scripts/send-daily-digest.ts send
 *   npx tsx apps/api/scripts/send-daily-digest.ts send operations@spdc.in,nirav@spdc.in
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sendDailyDigest } from "../src/services/dailyDigest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  const mode = process.argv[2] || "preview";
  const recipients =
    mode === "send" && process.argv[3]
      ? process.argv[3].split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
      : undefined;

  const out = await sendDailyDigest({
    preview: mode !== "send",
    recipients,
  });

  if (out.preview) {
    console.log("PREVIEW — recipients:", out.recipients.join(", "));
    console.log("Subject:", out.subject);
    console.log("\n--- HTML body ---\n");
    console.log(out.html);
    return;
  }

  console.log("Sent:", out.sent, "→", out.recipients.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
