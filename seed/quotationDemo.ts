/**
 * Seed SPDC PMC proposal quotation for client demo (Arvind-style scope).
 */
import type { PrismaClient } from "@prisma/client";

export const ARVIND_DEMO_SECTIONS = [
  {
    title: "1. Project Management Consultancy — Scope of Services",
    note: "Pre-construction, construction phase management, and handover for SPDC dormitory project at Arvind Limited campus. Site supervision, BOQ monitoring, quality & safety, progress reporting, and stakeholder coordination.",
    rows: [
      { description: "Consultancy fee — percentage of executed project cost", unit: "%", qty: 1, rate: 3.5, amount: 3.5 },
      { description: "Estimated executed cost basis (ex GST)", unit: "INR", qty: 1, rate: 85000000, amount: 85000000 },
      { description: "Indicative PMC fee (3.5% × executed cost)", unit: "INR", qty: 1, rate: 2975000, amount: 2975000 },
    ],
  },
  {
    title: "2. Deliverables (included in fee)",
    note: "All reports generated from the Sharnam portal — single source of truth for site and client.",
    rows: [
      { description: "Daily Progress Report (DPR) — 7 disciplines", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Weekly Progress Report (WPR) — PPTX + Excel", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Monthly Progress Dashboard + Planned vs Actual", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "GFC drawing register, RFI log, submittal tracker", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Quality — QAP, NCR/CAR, cube register, QI checklists", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Safety dashboard, toolbox talks, safety checklists", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Cost — BOQ/MB/BBS monitoring, cashflow chart", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Finance — PO, RA Bill tracker, COP (Viatrix format)", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "MS Project schedule import + S-curve (client civil view)", unit: "LS", qty: 1, rate: 0, amount: 0 },
    ],
  },
  {
    title: "3. Payment Terms",
    note: "Monthly certification against executed value. Retention 5% released on final handover. GST extra as applicable.",
    rows: [
      { description: "Mobilisation — on award", unit: "%", qty: 10, rate: 297500, amount: 297500 },
      { description: "Running — monthly against DPR/WPR certified progress", unit: "%", qty: 85, rate: 2528750, amount: 2528750 },
      { description: "Final — on handover & defect liability start", unit: "%", qty: 5, rate: 148750, amount: 148750 },
    ],
  },
  {
    title: "4. Exclusions",
    note: "Not part of this PMC proposal unless separately quoted.",
    rows: [
      { description: "Design consultancy / architectural services", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Third-party testing agency charges", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Comms matrix / design coordination module", unit: "LS", qty: 1, rate: 0, amount: 0 },
    ],
  },
];

export async function seedQuotationDemo(prisma: PrismaClient, createdById: string) {
  const quotationNo = "SPDC-PMC-ARV-2025-001";
  const existing = await prisma.quotation.findFirst({ where: { quotationNo } });
  const totalValue = ARVIND_DEMO_SECTIONS.reduce(
    (s, sec) => s + sec.rows.reduce((r, row) => r + Number(row.amount || 0), 0),
    0
  );

  const data = {
    quotationNo,
    clientName: "Arvind Limited",
    clientAddress: "SPDC Campus · Gujarat, India",
    clientGst: "24AAAAA0000A1Z5",
    scopeSummary:
      "PMC for SPDC dormitory construction — DPR/WPR, quality & safety, cost & cashflow, RA/COP tracking via Sharnam portal.",
    totalValue,
    currency: "INR",
    status: "Sent",
    validityDays: 90,
    quotationDate: new Date("2025-05-01"),
    sectionsJson: JSON.stringify(ARVIND_DEMO_SECTIONS),
    createdById,
  };

  if (existing) {
    await prisma.quotation.update({ where: { id: existing.id }, data });
    console.log("Quotation demo updated:", quotationNo);
    return existing.id;
  }

  const row = await prisma.quotation.create({ data });
  console.log("Quotation demo created:", quotationNo, "→ /quotations/" + row.id);
  return row.id;
}
