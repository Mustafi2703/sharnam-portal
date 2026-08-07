import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { graphFetch, graphConfig } = await import("../src/services/graph.js");
const cfg = graphConfig();
try {
  const u = await graphFetch(
    `/users/${encodeURIComponent(cfg.mailbox)}?$select=id,mail,userPrincipalName,displayName`
  );
  console.log("Mailbox OK:", JSON.stringify(u, null, 2));
  process.exit(0);
} catch (e) {
  console.error("Mailbox probe FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
}
