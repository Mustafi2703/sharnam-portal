import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { listProjectLibrary, uploadToProjectLibrary, graphConfig } = await import("../src/services/graph.js");

const cfg = graphConfig();
console.log("Vars OK:", {
  mock: cfg.mock,
  configured: cfg.configured,
  site: cfg.siteUrl,
  mailbox: cfg.mailbox,
  tenant: cfg.tenantId ? "set" : "missing",
  client: cfg.clientId ? "set" : "missing",
  secret: cfg.clientSecret ? "set" : "missing",
});

const projectCode = "SPDC-DEMO-01";
const root = await listProjectLibrary(projectCode, "");
console.log(
  "\nProject root:",
  ((root.value || []) as { name: string; folder?: unknown }[]).map((i) => `${i.folder ? "[dir]" : "[file]"} ${i.name}`)
);

for (const folder of ["RFIs", "Documents/DPR", "Documents/WPR"]) {
  const listed = await listProjectLibrary(projectCode, folder);
  console.log(
    `\n${folder}:`,
    ((listed.value || []) as { name: string }[]).map((i) => i.name)
  );
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const saved = await uploadToProjectLibrary(
  projectCode,
  "RFIs",
  `RFI-LIVE-TEST-${stamp}.txt`,
  Buffer.from(`Live env test · ${new Date().toISOString()}\nProject ${projectCode}\n`, "utf8"),
  "text/plain"
);
console.log("\nFresh upload OK:");
console.log("  path:", saved.sharePointPath);
console.log("  url:", saved.url);
