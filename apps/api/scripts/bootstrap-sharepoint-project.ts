/**
 * Create SharePoint ISO project library + drop test RFI / DPR / WPR / Quality / Safety docs.
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

console.log(`Creating ISO library tree for ${projectCode}…`);
const tree = await ensureProjectSharePointTree(projectCode);
console.log(`Root: ${tree.rootFolder}`);
console.log(`Folders: ${tree.folders.length}`);
console.log(`Drive: ${tree.drive.driveName} (${tree.drive.driveId.slice(0, 12)}…)`);

const stamp = new Date().toISOString().slice(0, 10);
const tests = [
  {
    folder: "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control",
    fileName: `RFI-INFO-TEST-${stamp}.txt`,
    content: `Sharnam portal · Information RFI test\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\n`,
  },
  {
    folder: "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records",
    fileName: `DPR-TEST-${stamp}.txt`,
    content: `Sharnam portal · DPR test\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\n`,
  },
  {
    folder: "07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve",
    fileName: `WPR-TEST-${stamp}.txt`,
    content: `Sharnam portal · WPR test\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\n`,
  },
  {
    folder: "08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards",
    fileName: `QI-RFI-TEST-${stamp}.txt`,
    content: `Sharnam portal · Quality RFI test\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\n`,
  },
  {
    folder: "08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment",
    fileName: `SAF-RFI-TEST-${stamp}.txt`,
    content: `Sharnam portal · Safety RFI test\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\n`,
  },
  {
    folder: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications",
    fileName: `DRAWING-INDEX-TEST-${stamp}.txt`,
    content: `Sharnam portal · Drawing register test\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\n`,
  },
  {
    folder: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination",
    fileName: `DESIGN-COORD-TEST-${stamp}.txt`,
    content: `Sharnam portal · Design coordination test\nProject: ${projectCode}\nCreated: ${new Date().toISOString()}\n`,
  },
  {
    folder: "_Registers",
    fileName: `README.txt`,
    content: `Refreshable register drop for ${projectCode}.\nEvery module log (RFIs by kind, DPR, WPR, checklists, NCR, safety, drawings, submittals, hindrances, cube tests) is written here as CSV whenever the portal Dump-Logs action runs.\nMirror copies live in the matching ISO folder above.\n`,
  },
];

const uploaded = [];
for (const t of tests) {
  const saved = await uploadToProjectLibrary(projectCode, t.folder, t.fileName, Buffer.from(t.content, "utf8"), "text/plain");
  uploaded.push(saved);
  console.log(`Uploaded ${t.folder}/${saved.path}`);
  if (saved.url) console.log(`  → ${saved.url}`);
}

const rfiInfo = await listProjectLibrary(projectCode, "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control");
console.log(`\nRFI Correspondence: ${rfiInfo.value?.length || 0} items`);
const qi = await listProjectLibrary(projectCode, "08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards");
console.log(`Quality Checklists: ${qi.value?.length || 0} items`);
const safety = await listProjectLibrary(projectCode, "08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment");
console.log(`Safety HIRA: ${safety.value?.length || 0} items`);

console.log("\nBootstrap OK");
console.log(
  JSON.stringify(
    {
      projectCode,
      rootFolder: tree.rootFolder,
      folders: tree.folders.length,
      site: tree.drive.siteName,
      uploaded: uploaded.map((u) => ({ path: u.sharePointPath, url: u.url })),
    },
    null,
    2
  )
);
