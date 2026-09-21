/**
 * Offline smoke: fill all HRMS .docx templates with mock employee data (no database).
 * Usage: npm run hrms:letters-offline
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { buildHrmsDocxTokenMap, fillHrmsDocx } from "../apps/api/src/services/hrmsDocxFill.ts";
import { letterMergeContext } from "../apps/api/src/services/hrmsLetter.ts";
import { computeCtcBreakdown } from "../apps/api/src/services/ctcAnnexure.ts";

const KINDS = [
  "Offer",
  "Appointment",
  "Confirmation",
  "Promotion",
  "NdaJoining",
  "NdaPostEmployment",
  "Warning",
  "Experience",
  "AssetReturn",
  "Relieving",
  "Exit",
] as const;

function tokenKeyFromDocxPlaceholder(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").trim();
}

async function unfilledTokens(docxBuf: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(docxBuf);
  const left = new Set<string>();
  for (const k of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(k)) continue;
    const xml = await zip.file(k)!.async("string");
    for (const m of xml.matchAll(/\{\{((?:[^{}]|<[^>]*>)*?)\}\}/g)) {
      left.add(tokenKeyFromDocxPlaceholder(m[1]));
    }
  }
  return [...left].sort();
}

function mockRow(kind: string, refNo: string) {
  return {
    refNo,
    kind,
    issueDate: new Date("2026-09-21"),
    effectiveDate: new Date("2026-04-01"),
    employeeName: "Riya Shah",
    designation: kind === "Promotion" ? "Senior Site Engineer" : "Site Engineer",
    department: "Projects",
    candidateEmail: "riya.shah@sharnam.demo",
  };
}

function mockData(kind: string) {
  const oldCtc = 840000;
  const newCtc = 1020000;
  return {
    candidateName: "Riya Shah",
    empCode: "EMP-RIYASHAH",
    location: "Ahmedabad — Arvind dormitory",
    reportingManager: "Rajesh Mehta",
    fixedCtcAnnual: kind === "Promotion" ? newCtc : oldCtc,
    ctcAnnual: kind === "Promotion" ? newCtc : oldCtc,
    newCtc,
    previousCtc: oldCtc,
    previousDesignation: "Site Engineer",
    newDesignation: "Senior Site Engineer",
    joinDate: "01 April 2026",
    effectiveDate: kind === "Promotion" ? "01 September 2026" : "01 April 2026",
    projectName: "Arvind Dormitory — Ahmedabad",
    clientName: "Arvind Limited",
    gender: "Female",
    pan: "ABCPR1234F",
    address: "Flat 402, Sharnam Heights, Vadodara — 390007",
    phone: "9876500123",
    reason: "Resignation accepted after notice period.",
    issueInBrief: "Repeated delay in submission of daily progress reports.",
    impact: "Client escalation on milestone slippage.",
    correctiveAction: "Submit DPR by 7 PM daily.",
    assets: "Dell laptop, company mobile, ID card",
    serials: "DL-88421, MB-99201",
    offerRefNo: "SPDC/HR/OF/26-FLOW-RIYA",
    appointmentRefNo: "SPDC/HR/OL/26-27/FLOW",
    ndaJoiningRef: "SPDC/HR/OL/26-27/FLOW",
    exitLetterRef: "SPDC/HR/EX/26-27/0001",
    assetLetterRef: "SPDC/HR/AR/26-27/0001",
    fnfStatus: "Pending F&F clearance",
    noticeServed: "60 days",
    noticeRequired: "60 days",
    newEmployer: "Confidential",
    fatherOrSpouseName: "Rajesh Shah",
    age: "28",
    bankName: "HDFC Bank",
    personalEmail: "riya.shah@sharnam.demo",
  };
}

async function main() {
  const fmtDir = path.join(process.cwd(), "apps/api/formats/hrms");
  const outDir = path.join(process.cwd(), "uploads/hrms-smoke-test");
  fs.mkdirSync(outDir, { recursive: true });

  let failed = 0;
  for (const kind of KINDS) {
    const templatePath = path.join(fmtDir, `${kind}.docx`);
    if (!fs.existsSync(templatePath)) {
      console.log(`${kind.padEnd(18)} ❌ missing template`);
      failed++;
      continue;
    }
    const row = mockRow(kind, `SPDC/HR/SMOKE/${kind}/0001`);
    const ctx = mockData(kind);
    const merged = letterMergeContext(row as any, ctx);
    const ctcNum = Number(String(ctx.fixedCtcAnnual).replace(/[^\d.]/g, ""));
    const breakdown =
      (kind === "Appointment" || kind === "Offer" || kind === "Promotion") && ctcNum
        ? computeCtcBreakdown({
            candidateName: "Riya Shah",
            designation: row.designation,
            fixedCtcAnnual: ctcNum,
          })
        : null;
    const tokens = buildHrmsDocxTokenMap(row as any, merged, breakdown);
    const filled = await fillHrmsDocx(fs.readFileSync(templatePath), tokens);
    const outPath = path.join(outDir, `${kind}.docx`);
    fs.writeFileSync(outPath, filled);
    const unfilled = await unfilledTokens(filled);
    if (unfilled.length) {
      failed++;
      console.log(`${kind.padEnd(18)} ⚠️  ${unfilled.length} unfilled: ${unfilled.join(", ")}`);
    } else {
      console.log(`${kind.padEnd(18)} ✅ all tokens filled → ${outPath}`);
    }
  }

  if (failed) {
    console.error(`\n${failed} letter(s) need attention.`);
    process.exit(1);
  }
  console.log(`\nAll ${KINDS.length} templates filled. Open files in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
