/**
 * Certificate of Payment — everything the certificate needs, worked out from the certified RA bill.
 *
 *   PO        — the RA bill's purchase order, else the vendor's PO on the project (same trade when several)
 *   Vendor    — GST No. from the vendor master; PAN from the PO, else characters 3–12 of the GSTIN
 *   Amounts   — "This bill" from the RA bill; "Previous bills" summed from earlier COPs of the same contractor
 *               and PO / trade; cumulative = previous + this
 *
 * Used by the COP create route (fills what the form left blank), the "defaults" endpoint (prefills the form)
 * and the certificate workbook (older COPs created before these fields were filled still print complete).
 */
import type { PrismaClient, PurchaseOrder, RaBill, CertificateOfPayment } from "@prisma/client";

const norm = (s: string | null | undefined) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** PAN is characters 3–12 of a GSTIN (e.g. 24AAOFV0867A1Z8 → AAOFV0867A). */
export function panFromGstin(gstin: string | null | undefined): string {
  const g = String(gstin || "").trim().toUpperCase();
  return /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]{3}$/.test(g) ? g.slice(2, 12) : "";
}

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

/** Short vendor tag for certificate numbers: "N.K Infra Pvt Ltd" → "N.K.INFRA". */
function vendorTag(name: string) {
  return (
    name
      .toUpperCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/^M\s*\/\s*S\.?\s+/, "")
      .replace(/\b(PVT|PRIVATE|LTD|LIMITED|LLP|CO|COMPANY)\b\.?/g, "")
      .replace(/[^A-Z0-9.&]+/g, ".")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.|\.$/g, "")
      .slice(0, 20) || "VENDOR"
  );
}

/** Indian financial year label for a date: Oct 2025 → "2025-26". */
function fyLabel(d: Date) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

/** The RA bill's PO, or the vendor's PO on the project (matching the trade when the vendor has several). */
export async function resolveRaPurchaseOrder(prisma: PrismaClient, ra: RaBill): Promise<PurchaseOrder | null> {
  if (ra.purchaseOrderId) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: ra.purchaseOrderId } });
    if (po) return po;
  }
  const pos = await prisma.purchaseOrder.findMany({ where: { projectId: ra.projectId }, orderBy: { createdAt: "asc" } });
  const vendor = norm(ra.vendorName);
  const mine = pos.filter((p) => (ra.vendorId && p.vendorId === ra.vendorId) || (vendor && norm(p.vendorName) === vendor));
  if (mine.length <= 1) return mine[0] || null;
  const trade = norm(ra.discipline);
  return mine.find((p) => trade && (norm(p.workTrade).includes(trade) || norm(p.packageName).includes(trade))) || mine[0];
}

export type CopDefaults = {
  certificateNumber: string;
  certificateType: string;
  certificateDate: string;
  contractor: string;
  workTrade: string;
  budgetCode: string;
  purchaseOrderId: string;
  poNumberDate: string;
  originalWoValue: number;
  amendmentNo: string;
  amendedWoValue: number;
  invoiceNoDate: string;
  amountCertified: number;
  amountPayable: number;
  gstAmount: number;
  retentionAmount: number;
  panNumber: string;
  gstNumber: string;
  payableTo: string;
};

/** Form values for a COP raised against an RA bill. */
export async function copDefaultsForRa(prisma: PrismaClient, projectId: string, raBillId: string): Promise<CopDefaults | null> {
  const ra = await prisma.raBill.findFirst({ where: { id: raBillId, projectId }, include: { vendor: true } });
  if (!ra) return null;
  const po = await resolveRaPurchaseOrder(prisma, ra);
  const vendor = ra.vendor || (po?.vendorId ? await prisma.vendor.findUnique({ where: { id: po.vendorId } }) : null);
  const contractor = ra.vendorName || po?.vendorName || vendor?.name || "Contractor";
  const workTrade = ra.discipline || po?.workTrade || po?.packageName || "";
  const gstNumber = po?.gstNumber || vendor?.gstNumber || "";
  const today = new Date();

  // Next certificate number for this contractor: 01/N.K.INFRA/2025-26, 02/…
  const earlier = await prisma.certificateOfPayment.count({ where: { projectId, contractor } });
  let seq = earlier + 1;
  let certificateNumber = `${String(seq).padStart(2, "0")}/${vendorTag(contractor)}/${fyLabel(today)}`;
  while (await prisma.certificateOfPayment.findFirst({ where: { projectId, certificateNumber }, select: { id: true } })) {
    seq += 1;
    certificateNumber = `${String(seq).padStart(2, "0")}/${vendorTag(contractor)}/${fyLabel(today)}`;
  }

  return {
    certificateNumber,
    certificateType: `Against - ${ra.raNumber}`,
    certificateDate: today.toISOString().slice(0, 10),
    contractor,
    workTrade,
    budgetCode: po?.budgetCode || "",
    purchaseOrderId: po?.id || "",
    poNumberDate: po ? `${po.poNumber}${po.poDate ? ` dt ${fmtDate(po.poDate)}` : ""}` : "",
    originalWoValue: po?.originalValue || 0,
    amendmentNo: po?.amendmentNo || "",
    amendedWoValue: po?.amendedValue || 0,
    invoiceNoDate: `${ra.invoiceNumber || ra.raNumber}${ra.invoiceDate ? `, ${fmtDate(ra.invoiceDate)}` : ""}`,
    amountCertified: ra.totalInvoiceWithoutGst || ra.againstBillRaised + ra.priceVariation || 0,
    amountPayable: ra.netAmountPayable || 0,
    gstAmount: ra.gstAmount || 0,
    retentionAmount: ra.retentionAmount || 0,
    panNumber: po?.panNumber || panFromGstin(gstNumber),
    gstNumber,
    payableTo: po?.payableTo || contractor,
  };
}

/** One certificate's amounts by Viatrix row (A amount raised … H net payable). */
export type CopLines = {
  raised: number;
  against: number;
  extra: number;
  securedAdvance: number;
  priceVariation: number;
  totalB: number;
  recoveries: number;
  mobilisationAdvance: number;
  adhoc: number;
  other: number;
  totalC: number;
  totalD: number;
  retention: number;
  totalE: number;
  totalF: number;
  gst: number;
  totalG: number;
  totalH: number;
};

type CopWithRa = CertificateOfPayment & { raBill: RaBill | null };

/** Amounts on one certificate, from its RA bill (falling back to the COP's own figures). */
export function copLines(cop: CopWithRa, submittedAmount?: number | null): CopLines {
  const ra = cop.raBill;
  const priceVariation = ra?.priceVariation || 0;
  const totalB = (ra?.totalInvoiceWithoutGst || (ra ? ra.againstBillRaised + priceVariation : 0)) || cop.amountCertified || 0;
  const against = totalB - priceVariation;
  const raised = submittedAmount || ra?.againstBillRaised || against;
  const mobilisationAdvance = ra?.advanceAdjusted || 0;
  const recoveries = ra?.otherRecoveries || 0;
  const totalC = mobilisationAdvance + recoveries;
  const totalD = totalB - totalC;
  const retention = ra?.retentionAmount ?? cop.retentionAmount ?? 0;
  const totalF = totalD - retention;
  const gst = ra?.gstAmount ?? cop.gstAmount ?? 0;
  return {
    raised,
    against,
    extra: 0,
    securedAdvance: 0,
    priceVariation,
    totalB,
    recoveries,
    mobilisationAdvance,
    adhoc: 0,
    other: 0,
    totalC,
    totalD,
    retention,
    totalE: retention,
    totalF,
    gst,
    totalG: gst,
    totalH: totalF + gst,
  };
}

const ZERO = copLines({ amountCertified: 0, retentionAmount: 0, gstAmount: 0, raBill: null } as CopWithRa);

function addLines(a: CopLines, b: CopLines): CopLines {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof CopLines)[]) out[k] = a[k] + b[k];
  return out;
}

/**
 * Previous / this / cumulative amounts for a certificate. Previous = earlier certificates (by date, then
 * creation) on the same PO, plus the same contractor and trade's certificates that carry no PO. Rejected
 * COPs are left out.
 */
export async function copLineHistory(prisma: PrismaClient, cop: CopWithRa) {
  const submitted = async (raBillId: string | null) => {
    if (!raBillId) return null;
    const rev = await prisma.raBillRevision.findFirst({
      where: { raBillId, stage: "Submitted", amountAtStage: { not: null } },
      orderBy: { uploadedAt: "asc" },
      select: { amountAtStage: true },
    });
    return rev?.amountAtStage ?? null;
  };
  const when = (c: CertificateOfPayment) => (c.certificateDate || c.createdAt).getTime();
  const peers = await prisma.certificateOfPayment.findMany({
    where: {
      projectId: cop.projectId,
      id: { not: cop.id },
      status: { not: "Rejected" },
      OR: [
        ...(cop.purchaseOrderId ? [{ purchaseOrderId: cop.purchaseOrderId }] : []),
        { purchaseOrderId: null, contractor: cop.contractor, workTrade: cop.workTrade },
      ],
    },
    include: { raBill: true },
  });
  const earlier = peers.filter(
    (p) => when(p) < when(cop) || (when(p) === when(cop) && p.createdAt.getTime() < cop.createdAt.getTime())
  );
  let previous = ZERO;
  for (const p of earlier) previous = addLines(previous, copLines(p, await submitted(p.raBillId)));
  const current = copLines(cop, await submitted(cop.raBillId));
  return { previous, current, cumulative: addLines(previous, current), previousCount: earlier.length };
}
