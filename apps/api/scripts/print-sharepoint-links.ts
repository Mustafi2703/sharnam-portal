/**
 * Print the current SharePoint folder links (ISO tree) for a project.
 * Usage: npx tsx apps/api/scripts/print-sharepoint-links.ts [projectCode]
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { graphFetch, resolveDefaultDrive } = await import("../src/services/graph.js");

const projectCode = process.argv[2] || "SPDC-DEMO-01";

function enc(relPath: string) {
  return relPath
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
}

const drive = await resolveDefaultDrive();
const base = `Sharnam Portal/${projectCode}`;
const folders: [string, string, string][] = [
  ["Root", base, "Project sandbox"],
  ["_Registers", `${base}/_Registers`, "CSV dump of every log — refreshed by the portal"],
  ["01 · Context & Governance", `${base}/01_CONTEXT_AND_GOVERNANCE`, "Charter, stakeholders, agreements"],
  ["02 · Planning", `${base}/02_PLANNING`, "WBS, programme, milestones, cashflow, risk"],
  ["02.07 Cashflow", `${base}/02_PLANNING/02.07_Cash_Flow_Forecast_Monitoring`, "Monthly forecast vs actual"],
  ["03 · Support & Resources", `${base}/03_SUPPORT_AND_RESOURCES`, "Registers, templates, correspondence"],
  ["03.06 Information RFI", `${base}/03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control`, "was: RFIs"],
  ["03.08 Meetings", `${base}/03_SUPPORT_AND_RESOURCES/03.08_Meetings_Minutes_Action_Tracking`, "Agendas, MoM, follow-up"],
  ["04 · Design & Info Mgmt", `${base}/04_DESIGN_AND_INFORMATION_MANAGEMENT`, ""],
  ["04.02 Drawings & Specs", `${base}/04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications`, "was: Drawings"],
  ["04.04 Design Coordination", `${base}/04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination`, ""],
  ["04.08 Submittals", `${base}/04_DESIGN_AND_INFORMATION_MANAGEMENT/04.08_Shop_Drawings_and_Material_Submittals`, ""],
  ["05 · Procurement (office)", `${base}/05_PROCUREMENT_AND_CONTRACTS`, "Contractor-hidden"],
  ["06 · Statutory & Land", `${base}/06_STATUTORY_AND_LAND`, ""],
  ["07 · Execution & Delivery", `${base}/07_EXECUTION_AND_DELIVERY`, ""],
  ["07.02 DPR / Daily Site Records", `${base}/07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records`, "DPR Maker publishes per-discipline packs here"],
  ["07.02/CIVIL", `${base}/07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL`, "Civil DPR packs"],
  ["07.02/ELECTRICAL", `${base}/07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/ELECTRICAL`, "Electrical DPR packs"],
  ["07.02/FIRE", `${base}/07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/FIRE`, "Fire DPR packs"],
  ["07.02/PLUMBING", `${base}/07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/PLUMBING`, "Plumbing DPR packs"],
  ["07.02/SitePilot", `${base}/07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/SitePilot`, "Site pilot photo + signature + notes"],
  ["07.08 Progress / S-curve", `${base}/07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve`, "Progress overview + S-curve"],
  ["07.09 Hindrance / Delay", `${base}/07_EXECUTION_AND_DELIVERY/07.09_Delay_Analysis`, ""],
  ["08 · Quality · HSE · Env", `${base}/08_QUALITY_HSE_AND_ENVIRONMENT`, ""],
  ["08.02 Checklists / Quality RFI", `${base}/08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards`, "client-visible"],
  ["08.03 Cube tests", `${base}/08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control`, ""],
  ["08.06 NCR", `${base}/08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output`, ""],
  ["08.07 HIRA / Safety RFI", `${base}/08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment`, "client-visible"],
  ["09 · Commercial & Change (office)", `${base}/09_COMMERCIAL_AND_CHANGE`, "COP · RA · Change control"],
  ["10 · Performance & Handover", `${base}/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT`, ""],
  ["10.01 MIS / WPR pack", `${base}/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS`, "WPR Maker publishes 24-section packs here"],
  ["10.06 Handover dossier", `${base}/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.06_Handover_Dossier_Practical_Completion`, ""],
  ["10.18 HR audit programme", `${base}/10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.18_Management_Review_and_Audit_Programme`, "HR audit trail exports"],
];

console.log(`Site: ${drive.siteName}`);
console.log(`Drive: ${drive.driveName}`);
console.log(`Project: ${projectCode}`);
console.log("");

for (const [label, folder, note] of folders) {
  try {
    const item = await graphFetch<{ name: string; webUrl?: string; folder?: { childCount?: number } }>(
      `/drives/${drive.driveId}/root:/${enc(folder)}?$select=name,webUrl,folder`
    );
    console.log(`✓ ${label} — ${item.folder?.childCount ?? "?"} items${note ? ` · ${note}` : ""}`);
    console.log(`  ${item.webUrl || "(no webUrl)"}`);
  } catch (e) {
    console.log(`✗ ${label} — MISSING${note ? ` · ${note}` : ""}`);
    console.log(`  ${e instanceof Error ? e.message : e}`);
  }
}

console.log("\nSite home:");
console.log("  https://spdcsmb.sharepoint.com/sites/SharnamProjects");
