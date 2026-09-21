/**
 * Generate all 11 HRMS letter kinds for the flow-demo employee and report unfilled {{TOKEN}} placeholders.
 *
 * Usage: npm run hrms:letters-smoke
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import { generateHrmsLetter } from "../apps/api/src/services/hrmsLetter.ts";
import { HRMS_FLOW } from "../seed/hrmsFlowDemo.ts";

applyDatabaseUrl();
const prisma = new PrismaClient();

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

function baseData(kind: string, oldCtc: number, newCtc: number) {
  const common = {
    candidateName: HRMS_FLOW.fullName,
    empCode: HRMS_FLOW.empCode,
    location: "Ahmedabad — Arvind dormitory",
    reportingManager: "Office Admin",
    fixedCtcAnnual: oldCtc,
    ctcAnnual: oldCtc,
    joinDate: "2026-04-01",
    projectName: "Arvind Dormitory — Ahmedabad",
    clientName: "Arvind Limited",
    gender: "Female",
    pan: "ABCPR1234F",
    address: "Flat 402, Sharnam Heights, Vadodara — 390007",
    phone: HRMS_FLOW.phone,
    issueInBrief: "Repeated delay in submission of daily progress reports.",
    impact: "Client escalation on milestone slippage.",
    correctiveAction: "Submit DPR by 7 PM daily; weekly review with PM.",
    reason: "Resignation accepted after notice period.",
    assets: "Dell laptop, company mobile, ID card",
    serials: "DL-88421, MB-99201",
    offerRefNo: HRMS_FLOW.offerNo,
    appointmentRefNo: HRMS_FLOW.appointmentRef,
    ndaJoiningRef: HRMS_FLOW.appointmentRef,
    exitLetterRef: "SPDC/HR/EX/26-27/0001",
    assetLetterRef: "SPDC/HR/AR/26-27/0001",
    fnfStatus: "Pending F&F clearance",
    noticeServed: "60 days",
    noticeRequired: "60 days",
    newEmployer: "Confidential",
    fatherOrSpouseName: "Rajesh Shah",
    age: "28",
  };
  if (kind === "Promotion") {
    return {
      ...common,
      fixedCtcAnnual: newCtc,
      ctcAnnual: newCtc,
      newCtc: newCtc,
      previousCtc: oldCtc,
      previousDesignation: "Site Engineer",
      newDesignation: "Senior Site Engineer",
      effectiveDate: "2026-09-01",
    };
  }
  if (kind === "Offer") {
    return { ...common, fixedCtcAnnual: oldCtc, ctcAnnual: oldCtc };
  }
  if (kind === "Relieving" || kind === "Exit" || kind === "NdaPostEmployment") {
    return { ...common, effectiveDate: "2026-12-31", lastWorkingDate: "2026-12-31" };
  }
  return common;
}

async function main() {
  const actor =
    (await prisma.user.findUnique({ where: { email: "office@sharnam.demo" } })) ||
    (await prisma.user.findFirst({ where: { role: { in: ["admin", "office"] } } }));
  const staff = await prisma.user.findUnique({ where: { email: HRMS_FLOW.email } });
  if (!actor || !staff) {
    throw new Error("Run npm run db:seed-hrms-flow first (needs office@sharnam.demo and riya.shah@sharnam.demo).");
  }

  const outDir = path.join(process.cwd(), "uploads/hrms-smoke-test");
  fs.mkdirSync(outDir, { recursive: true });

  const oldCtc = 840000;
  const newCtc = 1020000;
  const results: Array<{ kind: string; refNo: string; unfilled: string[]; docxPath: string }> = [];

  for (const kind of KINDS) {
    const refNo = `SPDC/HR/SMOKE/${kind}/${String(Date.now()).slice(-4)}`;
    const dataJson = JSON.stringify(baseData(kind, oldCtc, newCtc));
    const row = await prisma.hrmsDocument.create({
      data: {
        kind,
        refNo,
        employeeUserId: staff.id,
        employeeName: HRMS_FLOW.fullName,
        candidateEmail: HRMS_FLOW.email,
        designation: kind === "Promotion" ? "Senior Site Engineer" : "Site Engineer",
        department: "Projects",
        effectiveDate: new Date(kind === "Promotion" ? "2026-09-01" : "2026-04-01"),
        status: "Draft",
        createdById: actor.id,
        dataJson,
      },
    });

    const gen = await generateHrmsLetter(row);
    await prisma.hrmsDocument.update({
      where: { id: row.id },
      data: {
        generatedDocxUrl: gen.docxUrl,
        generatedPdfUrl: gen.pdfUrl,
        status: "Generated",
      },
    });

    const docxRel = gen.docxUrl?.replace(/^\/uploads\/onedrive\/_HR\//, "") || "";
    const docxAbs = path.join(process.cwd(), "uploads/onedrive/_HR", docxRel);
    const docxBuf = fs.readFileSync(docxAbs);
    const localCopy = path.join(outDir, `${kind}.docx`);
    fs.copyFileSync(docxAbs, localCopy);
    const unfilled = await unfilledTokens(docxBuf);
    results.push({ kind, refNo, unfilled, docxPath: localCopy });
    console.log(`${kind.padEnd(18)} ${unfilled.length === 0 ? "✅ all tokens filled" : `⚠️  ${unfilled.length} unfilled: ${unfilled.slice(0, 5).join(", ")}${unfilled.length > 5 ? "…" : ""}`}`);
  }

  const reportPath = path.join(outDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  const bad = results.filter((r) => r.unfilled.length > 0);
  console.log(`\nOutput: ${outDir}`);
  console.log(`Report: ${reportPath}`);
  if (bad.length) {
    console.error(`\n${bad.length}/${results.length} letter(s) still have unfilled placeholders.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} letters generated with every template token filled.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
