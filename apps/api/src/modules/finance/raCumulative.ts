import type { PrismaClient } from "@prisma/client";

/**
 * Rebuild previous / cumulative bill totals for RA bills in a PO + discipline chain.
 * Payment Summary rule: last COP cumulative = sum of all prior RA bills + this bill (excl. GST).
 */
export async function recomputeRaCumulativeChain(
  prisma: PrismaClient,
  projectId: string,
  opts?: { discipline?: string | null; purchaseOrderId?: string | null }
) {
  const where: { projectId: string; discipline?: string; purchaseOrderId?: string } = { projectId };
  if (opts?.discipline) where.discipline = opts.discipline;
  if (opts?.purchaseOrderId) where.purchaseOrderId = opts.purchaseOrderId;

  const ras = await prisma.raBill.findMany({
    where,
    orderBy: [{ invoiceDate: "asc" }, { createdAt: "asc" }],
  });

  const groups = new Map<string, typeof ras>();
  for (const r of ras) {
    const key = `${r.purchaseOrderId || "none"}|${r.discipline || ""}`;
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  }

  let updated = 0;
  for (const list of groups.values()) {
    let running = 0;
    for (const r of list) {
      const without = Number(r.totalInvoiceWithoutGst || 0);
      const previousBillTotal = running;
      const cumulativeBillTotal = previousBillTotal + without;
      running = cumulativeBillTotal;
      if (r.previousBillTotal !== previousBillTotal || r.cumulativeBillTotal !== cumulativeBillTotal) {
        await prisma.raBill.update({
          where: { id: r.id },
          data: { previousBillTotal, cumulativeBillTotal },
        });
        updated++;
      }
      if (r.copNo) {
        const cop = await prisma.certificateOfPayment.findFirst({
          where: { projectId, certificateNumber: r.copNo },
        });
        if (cop) {
          const cumNote = `Cumulative excl. GST ₹${Math.round(cumulativeBillTotal).toLocaleString("en-IN")}`;
          const prior = String(cop.remarks || "").replace(/Cumulative excl\. GST ₹[\d,]+/g, "").replace(/\s*·\s*$/, "").trim();
          await prisma.certificateOfPayment.update({
            where: { id: cop.id },
            data: {
              amountCertified: without || cop.amountCertified,
              amountPayable: Number(r.netAmountPayable || cop.amountPayable),
              gstAmount: Number(r.gstAmount || cop.gstAmount),
              retentionAmount: Number(r.retentionAmount || cop.retentionAmount),
              remarks: [prior, cumNote].filter(Boolean).join(" · ").slice(0, 500),
            },
          });
        }
      }
    }
    const poId = list[0]?.purchaseOrderId;
    if (poId) {
      const totals = await prisma.raBill.aggregate({
        where: { purchaseOrderId: poId },
        _sum: { totalInvoiceWithoutGst: true, totalInvoiceWithGst: true, netAmountPayable: true },
      });
      await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          totalBilledWithoutGst: totals._sum.totalInvoiceWithoutGst || 0,
          totalBilledWithGst: totals._sum.totalInvoiceWithGst || 0,
          totalCertified: totals._sum.netAmountPayable || 0,
        },
      });
    }
  }

  return { groups: groups.size, bills: ras.length, updated };
}
