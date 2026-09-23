/**
 * Seed all 11 HR letter kinds for the flow-demo employee (letter-desk form shape).
 * Idempotent — stable ref numbers; re-run regenerates .docx + HTML.
 *
 *   npm run db:seed-hrms-flow          # once, if Riya Shah missing
 *   npm run hrms:seed-letter-samples
 *
 * Portal: HRMS → Documents → select "Riya Shah · Staff" → preview / download each kind.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import { generateHrmsLetter } from "../apps/api/src/services/hrmsLetter.ts";
import { HRMS_FLOW, seedHrmsFlowDemo } from "../seed/hrmsFlowDemo.ts";
import { SPDC_OFFICE_ADDRESS } from "../packages/shared/src/index.ts";

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

type Kind = (typeof KINDS)[number];

const REF_BY_KIND: Record<Kind, string> = {
  Offer: "SPDC/HR/UAT/OF/26-27/001",
  Appointment: "SPDC/HR/UAT/OL/26-27/001",
  Confirmation: "SPDC/HR/UAT/CF/26-27/001",
  Promotion: "SPDC/HR/UAT/PR/26-27/001",
  NdaJoining: "SPDC/HR/UAT/NJ/26-27/001",
  NdaPostEmployment: "SPDC/HR/UAT/NP/26-27/001",
  Warning: "SPDC/HR/UAT/WR/26-27/001",
  Experience: "SPDC/HR/UAT/EC/26-27/001",
  AssetReturn: "SPDC/HR/UAT/AR/26-27/001",
  Relieving: "SPDC/HR/UAT/RL/26-27/001",
  Exit: "SPDC/HR/UAT/EX/26-27/001",
};

/** Matches apps/web hrmsLetterDesk letterDataPayload + form fields. */
function samplePayload(kind: Kind) {
  const oldCtc = 840000;
  const newCtc = 1020000;
  const join = "2026-04-01";
  const effective = kind === "Promotion" ? "2026-09-01" : kind === "Relieving" || kind === "Exit" ? "2026-12-31" : join;

  const base = {
    candidateName: HRMS_FLOW.fullName,
    joinDate: effective,
    fixedCtcAnnual: kind === "Promotion" ? newCtc : oldCtc,
    ctcAnnual: kind === "Promotion" ? newCtc : oldCtc,
    location: SPDC_OFFICE_ADDRESS,
    reportingManager: "Rajesh Mehta",
    previousDesignation: "Site Engineer",
    previousCtc: oldCtc,
    newDesignation: kind === "Promotion" ? "Senior Site Engineer" : "Site Engineer",
    newCtc: kind === "Promotion" ? newCtc : oldCtc,
    reason: "Resignation accepted after notice period.",
    assets: "Dell laptop, company mobile, ID card",
    serials: "DL-88421, MB-99201",
    empCode: HRMS_FLOW.empCode,
    pan: "ABCPR1234F",
    panNumber: "ABCPR1234F",
    gender: "Female",
    address: "Flat 402, Samanvay Silver, Akota, Vadodara — 390020",
    addressAsPerRecords: "Flat 402, Samanvay Silver, Akota, Vadodara — 390020",
    candidateAddress: "Flat 402, Samanvay Silver, Akota, Vadodara — 390020",
    permanentAddress: "Flat 402, Samanvay Silver, Akota, Vadodara — 390020",
    phone: HRMS_FLOW.phone,
    mobile: HRMS_FLOW.phone,
    projectName: "Arvind Dormitory — Ahmedabad",
    project: "Arvind Dormitory — Ahmedabad",
    clientName: "Arvind Limited",
    issueInBrief: "Repeated delay in submission of daily progress reports.",
    impact: "Client escalation on milestone slippage.",
    correctiveAction: "Submit DPR by 7 PM daily; weekly review with PM.",
    facts: "Repeated delay in submission of daily progress reports.",
    separationReason: "resignation",
    natureOfWork: "site supervision, planning, quality control and billing verification",
    period: `${effective} to ${effective}`,
    offerRefNo: HRMS_FLOW.offerNo,
    appointmentRefNo: HRMS_FLOW.appointmentRef,
    effectiveDate: effective,
    lastWorkingDate: kind === "Relieving" || kind === "Exit" ? "2026-12-31" : effective,
  };
  return base;
}

function designationFor(kind: Kind) {
  return kind === "Promotion" ? "Senior Site Engineer" : "Site Engineer";
}

function effectiveDateFor(kind: Kind) {
  if (kind === "Promotion") return new Date("2026-09-01");
  if (kind === "Relieving" || kind === "Exit" || kind === "NdaPostEmployment") return new Date("2026-12-31");
  return new Date("2026-04-01");
}

async function main() {
  let staff = await prisma.user.findUnique({ where: { email: HRMS_FLOW.email } });
  if (!staff) {
    console.log("Running HRMS flow seed first…");
    await seedHrmsFlowDemo(prisma);
    staff = await prisma.user.findUnique({ where: { email: HRMS_FLOW.email } });
  }
  if (!staff) throw new Error("Could not create demo employee.");

  const actor =
    (await prisma.user.findUnique({ where: { email: "office@sharnam.demo" } })) ||
    (await prisma.user.findFirst({ where: { role: { in: ["admin", "office", "hr"] } } }));
  if (!actor) throw new Error("Need office/admin user.");

  await prisma.employeeProfile.upsert({
    where: { userId: staff.id },
    create: {
      userId: staff.id,
      empCode: HRMS_FLOW.empCode,
      designation: "Site Engineer",
      department: "Projects",
      ctcAnnual: 840000,
      joinDate: new Date("2026-04-01"),
      panNumber: "ABCPR1234F",
      gender: "Female",
      addressCurrent: "Flat 402, Samanvay Silver, Akota, Vadodara — 390020",
    },
    update: {
      empCode: HRMS_FLOW.empCode,
      designation: "Site Engineer",
      department: "Projects",
      ctcAnnual: 840000,
      joinDate: new Date("2026-04-01"),
      panNumber: "ABCPR1234F",
      gender: "Female",
      addressCurrent: "Flat 402, Samanvay Silver, Akota, Vadodara — 390020",
    },
  });

  console.log(`Seeding ${KINDS.length} letter samples for ${HRMS_FLOW.fullName} (${staff.id})…\n`);

  for (const kind of KINDS) {
    const refNo = REF_BY_KIND[kind];
    const dataJson = JSON.stringify(samplePayload(kind));
    const row = await prisma.hrmsDocument.upsert({
      where: { kind_refNo: { kind, refNo } },
      create: {
        kind,
        refNo,
        employeeUserId: staff.id,
        employeeName: HRMS_FLOW.fullName,
        candidateEmail: HRMS_FLOW.email,
        designation: designationFor(kind),
        department: "Projects",
        effectiveDate: effectiveDateFor(kind),
        status: "Draft",
        createdById: actor.id,
        dataJson,
      },
      update: {
        employeeUserId: staff.id,
        employeeName: HRMS_FLOW.fullName,
        candidateEmail: HRMS_FLOW.email,
        designation: designationFor(kind),
        department: "Projects",
        effectiveDate: effectiveDateFor(kind),
        dataJson,
        status: "Draft",
      },
    });

    const gen = await generateHrmsLetter(row);
    await prisma.hrmsDocument.update({
      where: { id: row.id },
      data: {
        generatedDocxUrl: gen.docxUrl,
        generatedPdfUrl: gen.pdfUrl,
        storagePath: gen.storagePath,
        sharePointUrl: gen.sharePointUrl,
        status: "Generated",
      },
    });

    console.log(`  ✅ ${kind.padEnd(18)} ${refNo}`);
    if (gen.docxUrl) console.log(`     .docx → ${gen.docxUrl}`);
  }

  console.log(`
Done. In the portal:
  HRMS → Documents
  Person: ${HRMS_FLOW.fullName} · Staff (${HRMS_FLOW.email})
  Direct link: /hrm/documents?employeeUserId=${staff.id}

Login: office@sharnam.demo or HR desk · password from SEED_PASSWORD (default Demo@1234)
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
