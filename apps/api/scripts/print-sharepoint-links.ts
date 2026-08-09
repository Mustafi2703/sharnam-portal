import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { graphFetch, resolveDefaultDrive } = await import("../src/services/graph.js");

function enc(relPath: string) {
  return relPath
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
}

const drive = await resolveDefaultDrive();
const base = "Sharnam Portal/SPDC-DEMO-01";
const folders = [
  base,
  `${base}/RFIs`,
  `${base}/Documents/DPR`,
  `${base}/Documents/WPR`,
  `${base}/Drawings`,
  `${base}/Documents`,
];

console.log("Site:", drive.siteName);
console.log("Drive:", drive.driveName);
console.log("");

for (const folder of folders) {
  try {
    const item = await graphFetch<{ name: string; webUrl?: string }>(
      `/drives/${drive.driveId}/root:/${enc(folder)}?$select=name,webUrl`
    );
    console.log(`${folder}`);
    console.log(`  ${item.webUrl || "(no webUrl)"}`);
  } catch (e) {
    console.log(`${folder}`);
    console.log(`  ERROR: ${e instanceof Error ? e.message : e}`);
  }
}

console.log("\nSite home:");
console.log("  https://spdcsmb.sharepoint.com/sites/SharnamProjects");
