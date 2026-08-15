/**
 * Seed SPDC PMC proposal quotation for client demo (Arvind / SPDC docx format).
 */
import type { PrismaClient } from "@prisma/client";
import {
  quotationFromRecord,
  writeQuotationFiles,
  type QuotationSection,
} from "../apps/api/src/services/quotationExport.ts";

export const ARVIND_DEMO_SECTIONS: QuotationSection[] = [
  {
    title: "Executive Summary",
    note: "Comprehensive Project Development & Management Consultancy for the manufacturing facility — pre-construction, construction, and post-construction stages with digital portal (DPR/WPR, quality, safety, cost, finance).",
    rows: [
      { description: "Reference", unit: "—", qty: 1, rate: 0, amount: 0 },
      { description: "SPDC/26-27/INQ/78 · Manufacturing Facility, Satej, Ahmedabad", unit: "—", qty: 1, rate: 0, amount: 0 },
    ],
  },
  {
    title: "1. Commercial Proposal — Man-Month Fee",
    note: "Transparent man-month based fee (plus GST). Pre-construction and post-construction services included in comprehensive fee. No extra charges for initial 7 months from effective date.",
    rows: [
      { description: "Professional PMC fee — per man-month (site + office deployment)", unit: "INR/mo", qty: 1, rate: 340000, amount: 340000 },
      { description: "Indicative construction phase duration", unit: "months", qty: 18, rate: 340000, amount: 6120000 },
      { description: "Pre-construction & post-construction (included in scope)", unit: "LS", qty: 1, rate: 0, amount: 0 },
    ],
  },
  {
    title: "2. Complete Scope of Services (included)",
    note: "Service matrix aligned to SPDC PMC proposal — Initiate · Plan · Execute · Control · Close.",
    rows: [
      { description: "Design management, BOQ, tender evaluation, enabling works supervision", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Programme / schedule, cost management, procurement, construction management", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "DPR (7 disciplines) + WPR PPTX + MS Project S-curve", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Quality — QAP, NCR/CAR, cubes, QI checklists", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Safety dashboard + safety checklists + toolbox talks", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Cost BOQ/MB/BBS monitoring + cashflow chart", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Finance PO · RA Bill tracker · COP (Viatrix format)", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Commissioning, handover, DLP & retention management", unit: "LS", qty: 1, rate: 0, amount: 0 },
    ],
  },
  {
    title: "3. Payment Terms",
    note: "Monthly billing on 1st of each month based on actual resource deployment. Retention 5% released on DLP closure. GST extra.",
    rows: [
      { description: "Mobilisation on award", unit: "INR", qty: 1, rate: 340000, amount: 340000 },
      { description: "Running — monthly man-month fee", unit: "INR/mo", qty: 1, rate: 340000, amount: 340000 },
      { description: "Final — on handover certificate", unit: "INR", qty: 1, rate: 340000, amount: 340000 },
    ],
  },
  {
    title: "4. Exclusions",
    note: "Unless separately quoted in writing.",
    rows: [
      { description: "Architectural / design consultancy fees", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Third-party testing agency charges", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Comms matrix / design coordination module", unit: "LS", qty: 1, rate: 0, amount: 0 },
    ],
  },
];

export async function seedQuotationDemo(prisma: PrismaClient, createdById: string) {
  const quotationNo = "SPDC/26-27/INQ/78";
  const existing = await prisma.quotation.findFirst({ where: { quotationNo } });
  const totalValue = ARVIND_DEMO_SECTIONS.reduce(
    (s, sec) => s + sec.rows.reduce((r, row) => r + Number(row.amount || 0), 0),
    0
  );

  const data = {
    quotationNo,
    clientName: "Arvind Limited",
    clientAddress: "Santej Road, Taluka, near Khatrej, Kalol, Gujarat 382722",
    clientGst: "24AAAAA0000A1Z5",
    scopeSummary:
      "Proposal for Comprehensive Project Development & Management Consultancy Services — Manufacturing Facility at Satej, Ahmedabad. Kind Attention: Mr. Soham Shah. SPDC offers senior leadership, dedicated site presence, and digital transparency via the Sharnam portal.",
    totalValue,
    currency: "INR",
    status: "Sent",
    validityDays: 90,
    quotationDate: new Date("2026-07-29"),
    sectionsJson: JSON.stringify(ARVIND_DEMO_SECTIONS),
    createdById,
  };

  let rowId: string;
  if (existing) {
    await prisma.quotation.update({ where: { id: existing.id }, data });
    rowId = existing.id;
    console.log("Quotation demo updated:", quotationNo);
  } else {
    const row = await prisma.quotation.create({ data });
    rowId = row.id;
    console.log("Quotation demo created:", quotationNo, "→ /quotations/" + row.id);
  }

  const paths = writeQuotationFiles(quotationFromRecord({ ...data, quotationDate: data.quotationDate }));
  await prisma.quotation.update({
    where: { id: rowId },
    data: { attachmentUrl: paths.docUrl },
  });
  console.log("  Proposal files:", paths.docUrl, paths.htmlUrl);

  return rowId;
}
