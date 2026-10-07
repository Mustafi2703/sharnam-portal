/**
 * RA bill from the BOQ — Cost → Monitoring lines (BOQ item, rate, measured / achieved qty, certified qty).
 *
 *   This bill qty = measured to date − (certified + already on open BOQ bills), per item, priced at the BOQ rate.
 *   The bill carries the discipline of its BOQ package (Electric → MEP, Fire Fighting → Fire, else Civil …),
 *   files a Sharnam-branded abstract as its Submitted workbook, then goes through Corrected → Certified → COP
 *   like any other RA bill. When its COP is generated the quantities are posted to the BOQ as certified.
 */
import type { PrismaClient } from "@prisma/client";
import { workbookBuffer } from "../../services/brandedExport.js";
import { packageForCostPackage } from "./disciplines.js";

/** Monitoring sheets that roll other packages up — never billed on their own. */
const ROLLUP = /cashflow|dashboard|combined|summary|overall/i;

export type BoqBillLine = {
  lineId: string;
  itemNo: string | null;
  description: string;
  uom: string | null;
  rate: number;
  boqQty: number;
  measuredQty: number;
  prevQty: number;
  thisQty: number;
  amount: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Qty on BOQ bills not yet posted to the BOQ (raised / checked / certified, COP still pending). */
async function openBillQty(prisma: PrismaClient, projectId: string, excludeRaId?: string) {
  const open = await prisma.raBill.findMany({
    where: {
      projectId,
      boqLinesJson: { not: null },
      boqPostedAt: null,
      status: { not: "Rejected" },
      ...(excludeRaId ? { id: { not: excludeRaId } } : {}),
    },
    select: { boqLinesJson: true },
  });
  const qty = new Map<string, number>();
  for (const b of open) {
    for (const l of parseLines(b.boqLinesJson)) qty.set(l.lineId, (qty.get(l.lineId) || 0) + (Number(l.thisQty) || 0));
  }
  return qty;
}

export function parseLines(json: string | null | undefined): BoqBillLine[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** BOQ packages on the project with what can be billed now and the discipline the bill will carry. */
export async function boqPackages(prisma: PrismaClient, projectId: string) {
  const [lines, open] = await Promise.all([
    prisma.costMonitoringLine.findMany({
      where: { projectId },
      select: { id: true, packageName: true, rate: true, achievedQty: true, certifiedQty: true, boqQty: true },
    }),
    openBillQty(prisma, projectId),
  ]);
  const by = new Map<string, { items: number; billableItems: number; billable: number; boqValue: number; certifiedValue: number }>();
  for (const l of lines) {
    if (ROLLUP.test(l.packageName)) continue;
    const g = by.get(l.packageName) || { items: 0, billableItems: 0, billable: 0, boqValue: 0, certifiedValue: 0 };
    g.items += 1;
    g.boqValue += l.boqQty * l.rate;
    g.certifiedValue += l.certifiedQty * l.rate;
    const avail = l.achievedQty - l.certifiedQty - (open.get(l.id) || 0);
    if (l.rate > 0 && avail > 0.0005) {
      g.billableItems += 1;
      g.billable += avail * l.rate;
    }
    by.set(l.packageName, g);
  }
  return [...by.entries()]
    .map(([packageName, g]) => {
      const pkg = packageForCostPackage(packageName);
      return {
        packageName,
        discipline: pkg.discipline,
        financeKey: pkg.key,
        items: g.items,
        billableItems: g.billableItems,
        billable: r2(g.billable),
        boqValue: r2(g.boqValue),
        certifiedValue: r2(g.certifiedValue),
      };
    })
    .sort((a, b) => b.billable - a.billable);
}

/**
 * Lines that can be billed for a BOQ package. `qty` overrides this-bill qty per line (capped at what is
 * measured and not yet billed; 0 leaves the line out).
 */
export async function boqBillLines(
  prisma: PrismaClient,
  projectId: string,
  packageName: string,
  qty?: Record<string, number>
): Promise<BoqBillLine[]> {
  const [lines, open] = await Promise.all([
    prisma.costMonitoringLine.findMany({ where: { projectId, packageName }, orderBy: { createdAt: "asc" } }),
    openBillQty(prisma, projectId),
  ]);
  const out: BoqBillLine[] = [];
  for (const l of lines) {
    const prevQty = l.certifiedQty + (open.get(l.id) || 0);
    const avail = l.achievedQty - prevQty;
    if (!(l.rate > 0) || avail <= 0.0005) continue;
    const want = qty && l.id in qty ? Number(qty[l.id]) || 0 : avail;
    const thisQty = r3(Math.max(0, Math.min(avail, want)));
    if (qty && !thisQty) continue;
    out.push({
      lineId: l.id,
      itemNo: l.itemNo,
      description: l.description,
      uom: l.uom,
      rate: l.rate,
      boqQty: l.boqQty,
      measuredQty: l.achievedQty,
      prevQty: r3(prevQty),
      thisQty,
      amount: r2(thisQty * l.rate),
    });
  }
  return out;
}

/** Sharnam-branded RA bill abstract — filed as the bill's Submitted workbook. */
export async function buildBoqAbstractWorkbook(opts: {
  projectCode: string;
  raNumber: string;
  discipline: string;
  packageName: string;
  vendorName: string;
  lines: BoqBillLine[];
  amounts: { against: number; gst: number; retention: number; net: number; gstPct: number; retentionPct: number };
}) {
  const { lines, amounts: a } = opts;
  return workbookBuffer(
    [
      {
        name: "RA Abstract",
        chart: { title: `${opts.raNumber} · this bill by item (₹)`, category: "Item No", values: "This Bill Amount" },
        rows: [
          ["Item No", "Description", "Unit", "Rate", "BOQ Qty", "Measured Qty", "Previous Qty", "This Bill Qty", "Cumulative Qty", "This Bill Amount"],
          ...lines.map((l) => [
            l.itemNo || "",
            l.description,
            l.uom || "",
            l.rate,
            l.boqQty,
            l.measuredQty,
            l.prevQty,
            l.thisQty,
            r3(l.prevQty + l.thisQty),
            l.amount,
          ]),
          ["", "Total — against bill raised", "", "", "", "", "", "", "", a.against],
        ],
      },
      {
        name: "Bill Summary",
        chart: false,
        rows: [
          ["Particulars", "Value"],
          ["RA bill", opts.raNumber],
          ["Discipline", opts.discipline],
          ["BOQ package", opts.packageName],
          ["Contractor", opts.vendorName],
          ["Against bill raised (excl. GST)", a.against],
          [`Add GST (${a.gstPct}%)`, a.gst],
          [`Less retention (${a.retentionPct}%)`, a.retention],
          ["Net amount payable", a.net],
        ],
      },
    ],
    { title: `RA Bill ${opts.raNumber} — ${opts.discipline} (${opts.packageName})`, projectCode: opts.projectCode }
  );
}

/**
 * Post a BOQ bill's quantities to the BOQ as certified (once, when its COP is generated). When PMC certified
 * less than was raised, each line is posted pro rata (certified ÷ raised); the posted lines are kept on the bill.
 */
export async function postRaToBoq(prisma: PrismaClient, raBillId: string) {
  const ra = await prisma.raBill.findUnique({
    where: { id: raBillId },
    select: { boqLinesJson: true, boqPostedAt: true, totalInvoiceWithoutGst: true, priceVariation: true },
  });
  if (!ra?.boqLinesJson || ra.boqPostedAt) return 0;
  const raised = parseLines(ra.boqLinesJson);
  const raisedTotal = raised.reduce((n, l) => n + (Number(l.amount) || 0), 0);
  const certified = (ra.totalInvoiceWithoutGst || 0) - (ra.priceVariation || 0);
  const k = raisedTotal > 0 && certified > 0 ? Math.min(1, certified / raisedTotal) : 1;
  const lines = raised.map((l) => ({ ...l, thisQty: r3((Number(l.thisQty) || 0) * k), amount: r2((Number(l.amount) || 0) * k) }));
  await prisma.$transaction([
    ...lines.map((l) =>
      prisma.costMonitoringLine.updateMany({
        where: { id: l.lineId },
        data: { certifiedQty: { increment: l.thisQty }, certifiedInvoiceCost: { increment: l.amount } },
      })
    ),
    prisma.raBill.update({ where: { id: raBillId }, data: { boqPostedAt: new Date(), boqLinesJson: JSON.stringify(lines) } }),
  ]);
  return lines.length;
}
