import { prisma } from "../prisma.js";

/** Indian FY label e.g. 26-27 for Apr 2026 – Mar 2027. */
export function spdcFiscalYearLabel(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = m >= 3 ? y : y - 1;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}

/** Next SPDC/26-27/INQ/78 style quotation number for the current FY. */
export async function nextSpdcQuotationNo(now = new Date()) {
  const fy = spdcFiscalYearLabel(now);
  const prefix = `SPDC/${fy}/INQ/`;
  const rows = await prisma.quotation.findMany({
    where: { quotationNo: { startsWith: prefix } },
    select: { quotationNo: true },
  });
  let max = 0;
  for (const r of rows) {
    const tail = r.quotationNo.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}
