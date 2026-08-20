/**
 * Cross-module bridge: Cost (engineering BOQ/MB/BBS/cashflow) ↔ Finance (PO/RA/COP).
 * Commercial COP certificates live in Finance; Cost cashflow chart tracks planned vs actual outflow.
 */
import { prisma } from "../prisma.js";

export type FinanceCostBridge = {
  finance: {
    copCertified: number;
    copPayable: number;
    copPaid: number;
    raNetPayable: number;
    poCertified: number;
    copCount: number;
    raCount: number;
  };
  cost: {
    budgetCertified: number;
    budgetWorkOrder: number;
    cashflowPlanned: number;
    cashflowActual: number;
    monitoringCertifiedQtyValue: number;
    legacyVendorBillsPending: number;
  };
  links: {
    /** Finance COP payable ≈ commercial outflow certified against RA bills */
    copToCashflowNote: string;
    /** Cost Budget WBS certified column aligns with Finance PO certified roll-up */
    budgetToFinanceNote: string;
    /** Legacy Cost → Bills tab; use Finance → COP for official certificates */
    billsModuleNote: string;
  };
};

export async function getFinanceCostBridge(projectId: string): Promise<FinanceCostBridge> {
  const [cops, ras, pos, budget, cashflow, monitoring, vendorBills] = await Promise.all([
    prisma.certificateOfPayment.findMany({ where: { projectId } }),
    prisma.raBill.findMany({ where: { projectId } }),
    prisma.purchaseOrder.findMany({ where: { projectId } }),
    prisma.costBudgetLine.findMany({ where: { projectId } }),
    prisma.costCashflowPeriod.findMany({ where: { projectId } }),
    prisma.costMonitoringLine.findMany({ where: { projectId } }),
    prisma.vendorBill.findMany({ where: { projectId } }),
  ]);

  const chartCf = cashflow.filter((c) => /chart|project cashflow/i.test(c.packageName || ""));
  const cfRows = chartCf.length ? chartCf : cashflow;

  const copPaid = cops
    .filter((c) => c.status === "Paid" || c.status === "Approved")
    .reduce((s, c) => s + c.amountPayable, 0);

  const monitoringCertifiedQtyValue = monitoring.reduce(
    (s, m) => s + (m.certifiedQty || 0) * (m.rate || 0),
    0
  );

  const legacyPending = vendorBills
    .filter((b) => !["Certified", "Paid"].includes(b.status))
    .reduce((s, b) => s + b.amount, 0);

  return {
    finance: {
      copCertified: cops.reduce((s, c) => s + c.amountCertified, 0),
      copPayable: cops.reduce((s, c) => s + c.amountPayable, 0),
      copPaid,
      raNetPayable: ras.reduce((s, r) => s + r.netAmountPayable, 0),
      poCertified: pos.reduce((s, p) => s + p.totalCertified, 0),
      copCount: cops.length,
      raCount: ras.length,
    },
    cost: {
      budgetCertified: budget.reduce((s, b) => s + b.certifiedAmount, 0),
      budgetWorkOrder: budget.reduce((s, b) => s + b.workOrderAmount, 0),
      cashflowPlanned: cfRows.reduce((s, c) => s + c.plannedAmount, 0),
      cashflowActual: cfRows.reduce((s, c) => s + c.actualAmount, 0),
      monitoringCertifiedQtyValue,
      legacyVendorBillsPending: legacyPending,
    },
    links: {
      copToCashflowNote:
        "Certified / Approved / Paid COP rolls into Cost cashflow as COP-day, COP-week, and COP (month) rows, and overlays Chart actual for the same month. DPR AC certified uses cashflow actual.",
      budgetToFinanceNote:
        "Cost Budget WBS certified amount aligns with Finance PO/CAPEX certified roll-up for the same project.",
      billsModuleNote:
        "Official COP certificates: Finance → COP tab (linked to PO + RA). Cost → Bills is a quick vendor log only.",
    },
  };
}
