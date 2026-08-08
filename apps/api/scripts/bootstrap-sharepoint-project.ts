/**
 * Create SharePoint project library + drop test RFI / DPR / WPR docs.
 * Usage: npx tsx apps/api/scripts/bootstrap-sharepoint-project.ts [projectCode]
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const projectCode = process.argv[2] || "SPDC-DEMO-01";
const {
  ensureProjectSharePointTree,
  uploadToProjectLibrary,
  listProjectLibrary,
  graphConfig,
} = await import("../src/services/graph.js");

const cfg = graphConfig();
if (!cfg.configured) {
  console.error("Missing Graph credentials in .env");
  process.exit(1);
}
if (cfg.mock) {
  console.warn("NOTE: MOCK_ONEDRIVE is not false — uploads still go to SharePoint via this script.");
}

console.log(`Creating library tree for ${projectCode}…`);
const tree = await ensureProjectSharePointTree(projectCode);
console.log(`Root: ${tree.rootFolder}`);
console.log(`Folders: ${tree.folders.length}`);
console.log(`Drive: ${tree.drive.driveName} (${tree.drive.driveId.slice(0, 12)}…)`);

const stamp = new Date().toISOString().slice(0, 10);
const tests = [
  {
    folder: "RFIs",
    fileName: `RFI-TEST-${stamp}.txt`,
    content: `Sharnam portal RFI test pack\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\nFolder: RFIs\n`,
  },
  {
    folder: "Documents/DPR",
    fileName: `DPR-TEST-${stamp}.txt`,
    content: `Sharnam portal DPR test pack\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\nFolder: Documents/DPR\n`,
  },
  {
    folder: "Documents/WPR",
    fileName: `WPR-TEST-${stamp}.txt`,
    content: `Sharnam portal WPR test pack\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\nFolder: Documents/WPR\n`,
  },
];

const uploaded = [];
for (const t of tests) {
  const saved = await uploadToProjectLibrary(projectCode, t.folder, t.fileName, Buffer.from(t.content, "utf8"), "text/plain");
  uploaded.push(saved);
  console.log(`Uploaded ${t.folder}/${t.fileName}`);
  if (saved.url) console.log(`  → ${saved.url}`);
}

console.log("\nListing RFIs folder:");
const rfis = await listProjectLibrary(projectCode, "RFIs");
for (const item of (rfis.value || []) as { name: string }[]) {
  console.log(`  - ${item.name}`);
}

console.log("\nListing Documents/DPR:");
const dpr = await listProjectLibrary(projectCode, "Documents/DPR");
for (const item of (dpr.value || []) as { name: string }[]) {
  console.log(`  - ${item.name}`);
}

console.log("\nListing Documents/WPR:");
const wpr = await listProjectLibrary(projectCode, "Documents/WPR");
for (const item of (wpr.value || []) as { name: string }[]) {
  console.log(`  - ${item.name}`);
}

console.log("\nBootstrap OK");
console.log(
  JSON.stringify(
    {
      projectCode,
      rootFolder: tree.rootFolder,
      site: tree.drive.siteName,
      uploaded: uploaded.map((u) => ({ path: u.sharePointPath, url: u.url })),
    },
    null,
    2
  )
);
