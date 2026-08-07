/**
 * Live SharePoint probe — loads repo .env, acquires token, lists site library.
 * Usage: npx tsx apps/api/scripts/test-sharepoint.ts
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { probeSharePoint, graphConfig } = await import("../src/services/graph.js");

const cfg = graphConfig();
console.log("Graph config:", {
  configured: cfg.configured,
  mock: cfg.mock,
  siteUrl: cfg.siteUrl || "(missing)",
  mailbox: cfg.mailbox || "(missing)",
  tenant: cfg.tenantId ? `${cfg.tenantId.slice(0, 8)}…` : "(missing)",
  client: cfg.clientId ? `${cfg.clientId.slice(0, 8)}…` : "(missing)",
  secret: cfg.clientSecret ? "set" : "(missing)",
  projectOnline: false,
});

const health = await probeSharePoint();
console.log(JSON.stringify(health, null, 2));

if (!health.tokenOk || !health.siteOk) {
  console.error("\nSharePoint probe FAILED");
  process.exit(1);
}
console.log("\nSharePoint probe OK — token + site + drive readable");
process.exit(0);
