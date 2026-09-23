/**
 * Copy SPDC letter .docx from repo root (01_SPDC_… naming) into apps/api/formats/hrms/<Kind>.docx
 * Run: npm run hrms:import-root-formats
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const TARGET = path.join(ROOT, "apps/api/formats/hrms");

const MAP: Record<string, string> = {
  "00_SPDC_HR_Letters_Usage_Guide.docx": "00_SPDC_HR_Letters_Usage_Guide.docx",
  "01_SPDC_Offer_Letter.docx": "Offer.docx",
  "02_SPDC_Appointment_Letter.docx": "Appointment.docx",
  "03_SPDC_Confirmation_Letter.docx": "Confirmation.docx",
  "04_SPDC_Asset_Submission_Letter.docx": "AssetReturn.docx",
  "05_SPDC_Relieving_Letter.docx": "Relieving.docx",
  "06_SPDC_Exit_Letter.docx": "Exit.docx",
  "07_SPDC_Letter_of_Promotion.docx": "Promotion.docx",
  "08_SPDC_Warning_Concern_Letter.docx": "Warning.docx",
  "09_SPDC_Experience_Certificate.docx": "Experience.docx",
  "10_SPDC_NDA_At_Joining.docx": "NdaJoining.docx",
  "11_SPDC_NDA_Post_Employment.docx": "NdaPostEmployment.docx",
};

let copied = 0;
for (const [srcName, destName] of Object.entries(MAP)) {
  const src = path.join(ROOT, srcName);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(TARGET, { recursive: true });
  fs.copyFileSync(src, path.join(TARGET, destName));
  console.log(`  ✓ ${srcName} → formats/hrms/${destName}`);
  copied++;
}
if (!copied) {
  console.log("No root SPDC letter files found — place 01_SPDC_Offer_Letter.docx etc. in repo root first.");
} else {
  console.log(`\nImported ${copied} template(s). Redeploy API, then HRMS → Documents → Regenerate.`);
}
