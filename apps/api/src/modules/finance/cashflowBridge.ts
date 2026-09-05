/**
 * Unified cashflow reconciliation — Progress PvA (planned) + Finance COP (commercial actual).
 *
 * Flow:
 *   1. Progress Planned vs Actual → Cost cashflow planned + PVA rows
 *   2. Finance COP (Certified/Paid) → Cost cashflow actual (COP-day/week/month + Chart overlay)
 *
 * COP always wins for Chart actualAmount when certified payments exist.
 */
import { prisma } from "../../prisma.js";
import { syncCopToCashflow } from "./cashflowSync.js";
import { syncProgressCashflowToCost } from "../../services/cashflowPvaSync.js";

export type CashflowReconciliation = {
  finance: {
    copCount: number;
    copCertifiedPayable: number;
    copPaidPayable: number;
  };
  cost: {
    chartPlanned: number;
    chartActual: number;
    copMonthlyActual: number;
    pvaPlanned: number;
    pvaActual: number;
  };
  aligned: boolean;
  note: string;
};

const COUNTED_COP = ["Certified", "Approved", "Paid"] as const;

/** Run Progress PvA sync then Finance COP sync (COP overlay applied last). */
export async function syncAllCashflowSources(projectId: string) {
  const pva = await syncProgressCashflowToCost(projectId);
  const cop = await syncCopToCashflow(projectId);
  return { pva, cop };
}

export async function getCashflowReconciliation(projectId: string): Promise<CashflowReconciliation> {
  const [cops, cashflow, pvaRows] = await Promise.all([
    prisma.certificateOfPayment.findMany({ where: { projectId } }),
    prisma.costCashflowPeriod.findMany({ where: { projectId } }),
    prisma.progressPlannedActual.findMany({ where: { projectId } }),
  ]);

  const chartRows = cashflow.filter((c) =>
    /chart|project cashflow/i.test(c.packageName || "")
  );
  const copMonthRows = cashflow.filter((c) => c.packageName === "COP");
  const pvaCashflow = pvaRows.filter((r) => (r.plannedAmount || 0) + (r.actualAmount || 0) > 0);

  const copCertifiedPayable = cops
    .filter((c) => COUNTED_COP.includes(c.status as (typeof COUNTED_COP)[number]))
    .reduce((s, c) => s + (c.amountPayable || c.amountCertified || 0), 0);
  const copPaidPayable = cops
    .filter((c) => c.status === "Paid" || c.status === "Approved")
    .reduce((s, c) => s + (c.amountPayable || 0), 0);

  const chartPlanned = chartRows.reduce((s, c) => s + c.plannedAmount, 0);
  const chartActual = chartRows.reduce((s, c) => s + c.actualAmount, 0);
  const copMonthlyActual = copMonthRows.reduce((s, c) => s + c.actualAmount, 0);
  const pvaPlanned = pvaCashflow.reduce((s, r) => s + (r.plannedAmount || 0), 0);
  const pvaActual = pvaCashflow.reduce((s, r) => s + (r.actualAmount || 0), 0);

  const commercialActual = copCertifiedPayable || copMonthlyActual || chartActual;
  const aligned =
    !copCertifiedPayable ||
    Math.abs(commercialActual - chartActual) < Math.max(1, copCertifiedPayable * 0.02);

  return {
    finance: {
      copCount: cops.filter((c) => COUNTED_COP.includes(c.status as (typeof COUNTED_COP)[number])).length,
      copCertifiedPayable,
      copPaidPayable,
    },
    cost: {
      chartPlanned,
      chartActual,
      copMonthlyActual,
      pvaPlanned,
      pvaActual,
    },
    aligned,
    note:
      "Planned outflow comes from Cost cashflow import or Progress PvA. Commercial actual comes from Finance COP (Certified/Paid) and overlays the Cost Chart view. DPR AC certified uses Finance COP cumulative.",
  };
}

/** Cumulative certified payable up to `asOf` (for DPR header). */
export async function acCertifiedToDate(projectId: string, asOf: Date): Promise<number> {
  const end = new Date(asOf);
  end.setHours(23, 59, 59, 999);
  const cops = await prisma.certificateOfPayment.findMany({
    where: {
      projectId,
      status: { in: [...COUNTED_COP] },
      OR: [{ certificateDate: { lte: end } }, { certificateDate: null, createdAt: { lte: end } }],
    },
  });
  const fromFinance = cops.reduce((s, c) => s + (c.amountPayable || c.amountCertified || 0), 0);
  if (fromFinance > 0) return fromFinance;

  const cashflow = await prisma.costCashflowPeriod.findMany({
    where: {
      projectId,
      OR: [{ packageName: "COP" }, { packageName: { contains: "Chart" } }],
    },
  });
  const copRows = cashflow.filter((c) => c.packageName === "COP");
  const rows = copRows.length ? copRows : cashflow.filter((c) => /chart/i.test(c.packageName || ""));
  return rows.reduce((s, c) => s + (c.actualAmount || 0), 0);
}
