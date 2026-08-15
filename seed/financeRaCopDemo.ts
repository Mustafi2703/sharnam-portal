/**
 * Seed PO → RA Bill chain (previous + cumulative) → COP for client demo.
 * Mirrors Viatrix_RA BILL_COP.xlsm / Payment Summary layout.
 */
import type { PrismaClient } from "@prisma/client";

const DEMO_SOURCE = "finance-demo-seed";

export async function seedFinanceRaCopDemo(prisma: PrismaClient, projectId: string, createdById: string) {
  await prisma.certificateOfPayment.deleteMany({ where: { projectId, remarks: { contains: DEMO_SOURCE } } });
  await prisma.raBill.deleteMany({ where: { projectId, description: { contains: DEMO_SOURCE } } });
  await prisma.purchaseOrder.deleteMany({ where: { projectId, packageName: { contains: DEMO_SOURCE } } });

  const po = await prisma.purchaseOrder.create({
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
    { ra: "RA-01", date: "2025-08-15", wo: 4200000, pv: 0, gst: 756000, adv: 420000, ret: 210000, net: 4326000 },
    { ra: "RA-02", date: "2025-09-20", wo: 5100000, pv: 85000, gst: 934500, adv: 0, ret: 255000, net: 5779500 },
    { ra: "RA-03", date: "2025-10-25", wo: 4800000, pv: 0, gst: 864000, adv: 0, ret: 240000, net: 5424000 },
    { ra: "RA-04", date: "2025-11-30", wo: 3900000, pv: -120000, gst: 680400, adv: 0, ret: 195000, net: 4265400 },
    { ra: "RA-05", date: "2026-01-15", wo: 4500000, pv: 0, gst: 810000, adv: 0, ret: 225000, net: 5085000 },
  ];

  let cumulative = 0;
  const raRows: { id: string; raNumber: string; net: number; cumulative: number }[] = [];

  for (const spec of raSpecs) {
    const totalInvoiceWithoutGst = spec.wo + spec.pv;
    const previousBillTotal = cumulative;
    cumulative += totalInvoiceWithoutGst;
    const totalInvoiceWithGst = totalInvoiceWithoutGst + spec.gst;
    const netAmountPayable = spec.net;

    const row = await prisma.raBill.create({
      data: {
        projectId,
        purchaseOrderId: po.id,
        raNumber: spec.ra,
        invoiceNumber: `INV-${spec.ra.replace("RA-", "")}/2025-26`,
        invoiceDate: new Date(spec.date),
        description: `${DEMO_SOURCE} Civil interim bill ${spec.ra}`,
        againstBillRaised: spec.wo,
        priceVariation: spec.pv,
        totalInvoiceWithoutGst,
        gstAmount: spec.gst,
        totalInvoiceWithGst,
        advanceAdjusted: spec.adv,
        retentionAmount: spec.ret,
        otherRecoveries: 0,
        netAmountPayable,
        previousBillTotal,
        cumulativeBillTotal: cumulative,
        status: spec.ra === "RA-05" ? "Submitted" : "Certified",
        discipline: "Civil",
        vendorName: po.vendorName,
        copNo: `COP-${spec.ra.replace("RA-", "")}`,
        createdById,
      },
    });
    raRows.push({ id: row.id, raNumber: spec.ra, net: netAmountPayable, cumulative });
  }

  await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: {
      totalBilledWithoutGst: cumulative,
      totalBilledWithGst: raSpecs.reduce((s, r, i) => s + raSpecs[i].wo + raSpecs[i].pv + raSpecs[i].gst, 0),
    },
  });

  for (let i = 0; i < raRows.length; i++) {
    const spec = raSpecs[i];
    const ra = raRows[i];
    await prisma.certificateOfPayment.create({
      data: {
        projectId,
        certificateNumber: `01/N.K.INFRA/2025-26/${String(i + 1).padStart(2, "0")}`,
        certificateType: "Against - RA",
        certificateDate: new Date(spec.date),
        contractor: po.vendorName!,
        workTrade: "Civil & Structural",
        budgetCode: "3.1",
        purchaseOrderId: po.id,
        poNumberDate: `${po.poNumber} dt ${po.poDate?.toLocaleDateString("en-IN")}`,
        originalWoValue: po.originalValue,
        amendedWoValue: po.amendedValue,
        invoiceNoDate: `${ra.raNumber} · ${spec.date}`,
        raBillId: ra.id,
        amountCertified: spec.wo + spec.pv,
        amountPayable: ra.net,
        gstAmount: spec.gst,
        retentionAmount: spec.ret,
        panNumber: po.panNumber,
        gstNumber: po.gstNumber,
        payableTo: po.payableTo,
        remarks: `${DEMO_SOURCE} — Viatrix COP format`,
        status: i < raRows.length - 1 ? "Certified" : "Draft",
        createdById,
      },
    });

    await prisma.raBill.update({
      where: { id: ra.id },
      data: { copNo: `COP-${String(i + 1).padStart(2, "0")}` },
    });
  }

  console.log(`Finance demo: 1 PO · ${raRows.length} RA bills (cumulative ₹${cumulative.toLocaleString("en-IN")}) · ${raRows.length} COPs`);
  return { poId: po.id, raCount: raRows.length, cumulative };
}
