/**
 * Seed PO → RA Bill chain → COP for client demo (Viatrix layout).
 */
import type { PrismaClient } from "@prisma/client";

const DEMO_SOURCE = "finance-demo-seed";

export async function seedFinanceRaCopDemo(db: PrismaClient, projectId: string, createdById: string) {
  await db.certificateOfPayment.deleteMany({ where: { projectId, remarks: { contains: DEMO_SOURCE } } });
  await db.raBill.deleteMany({ where: { projectId, description: { contains: DEMO_SOURCE } } });
  await db.purchaseOrder.deleteMany({ where: { projectId, packageName: { contains: DEMO_SOURCE } } });

  const po = await db.purchaseOrder.create({
    data: {
      projectId,
      poNumber: "PO-NK-INFRA-CIV-01",
      poDate: new Date("2025-06-01"),
      vendorName: "M/s NK Infra (Viatrix)",
      workTrade: "Civil & Structural",
      packageName: `${DEMO_SOURCE} Civil dormitory`,
      originalValue: 57673579,
      amendedValue: 57673579,
      retentionPct: 5,
      advancePct: 10,
      panNumber: "AABCN1234F",
      gstNumber: "24AABCN1234F1Z5",
      payableTo: "M/s NK Infra",
      status: "Active",
    },
  });

  const raSpecs = [
    { ra: "RA-01", date: "2025-08-15", wo: 4200000, pv: 0, gst: 756000, adv: 420000, ret: 210000, net: 4326000, discipline: "Civil" },
    { ra: "RA-02", date: "2025-09-20", wo: 5100000, pv: 85000, gst: 934500, adv: 0, ret: 255000, net: 5779500, discipline: "Civil" },
    { ra: "RA-03", date: "2025-10-25", wo: 4800000, pv: 0, gst: 864000, adv: 0, ret: 240000, net: 5424000, discipline: "Structural" },
    { ra: "RA-04", date: "2025-11-30", wo: 3900000, pv: -120000, gst: 680400, adv: 0, ret: 195000, net: 4265400, discipline: "MEP" },
    { ra: "RA-05", date: "2026-01-15", wo: 4500000, pv: 0, gst: 810000, adv: 0, ret: 225000, net: 5085000, discipline: "Electrical" },
  ];

  let cumulative = 0;
  const copIds: string[] = [];

  for (const spec of raSpecs) {
    const totalInvoiceWithoutGst = spec.wo + spec.pv;
    const previousBillTotal = cumulative;
    cumulative += totalInvoiceWithoutGst;
    const totalInvoiceWithGst = totalInvoiceWithoutGst + spec.gst;

    const row = await db.raBill.create({
      data: {
        projectId,
        purchaseOrderId: po.id,
        raNumber: spec.ra,
        invoiceNumber: `INV-${spec.ra.replace("RA-", "")}/2025-26`,
        invoiceDate: new Date(spec.date),
        description: `${DEMO_SOURCE} ${spec.discipline} interim bill ${spec.ra}`,
        againstBillRaised: spec.wo,
        priceVariation: spec.pv,
        totalInvoiceWithoutGst,
        gstAmount: spec.gst,
        totalInvoiceWithGst,
        advanceAdjusted: spec.adv,
        retentionAmount: spec.ret,
        otherRecoveries: 0,
        netAmountPayable: spec.net,
        previousBillTotal,
        cumulativeBillTotal: cumulative,
        status: spec.ra === "RA-05" ? "Submitted" : "Certified",
        discipline: spec.discipline,
        vendorName: po.vendorName,
        copNo: `COP-${spec.ra.replace("RA-", "")}`,
        createdById,
      },
    });

    const cop = await db.certificateOfPayment.create({
      data: {
        projectId,
        certificateNumber: `01/N.K.INFRA/2025-26/${spec.ra.replace("RA-", "")}`,
        certificateType: "Against - RA",
        certificateDate: new Date(spec.date),
        contractor: po.vendorName!,
        workTrade: `${spec.discipline} — Civil dormitory`,
        budgetCode: "3.1",
        purchaseOrderId: po.id,
        poNumberDate: `${po.poNumber} dt ${po.poDate?.toLocaleDateString("en-IN")}`,
        originalWoValue: po.originalValue,
        amendedWoValue: po.amendedValue,
        invoiceNoDate: `${spec.ra} · ${spec.date}`,
        raBillId: row.id,
        amountCertified: spec.wo + spec.pv,
        amountPayable: spec.net,
        gstAmount: spec.gst,
        retentionAmount: spec.ret,
        panNumber: po.panNumber,
        gstNumber: po.gstNumber,
        payableTo: po.payableTo,
        remarks: `${DEMO_SOURCE} — Viatrix COP format · ${spec.discipline}`,
        status: spec.ra === "RA-05" ? "Draft" : "Certified",
        createdById,
      },
    });
    copIds.push(cop.id);
  }

  await db.purchaseOrder.update({
    where: { id: po.id },
    data: {
      totalBilledWithoutGst: cumulative,
      totalBilledWithGst: raSpecs.reduce((s, r) => s + r.wo + r.pv + r.gst, 0),
    },
  });

  return { poId: po.id, raCount: raSpecs.length, copIds, cumulative };
}
