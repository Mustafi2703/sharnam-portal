/** Default monitoring package after SPDC budget load (Civil Dormitory dormitory block). */
export const DEFAULT_COST_MONITORING_PKG = "Civil Dormitory";

/** True when Cost registers look empty or legacy — trigger auto sync-template. */
export function costNeedsFullSync(totals?: {
  monitoringLines?: number;
  mbLines?: number;
  budgeted?: number;
} | null): boolean {
  if (!totals) return true;
  const mon = totals.monitoringLines ?? 0;
  const mb = totals.mbLines ?? 0;
  const budget = totals.budgeted ?? 0;
  return mon < 80 || mb < 40 || budget < 1_000_000;
}

export function isLikelySpdcBudgetFile(file: File): boolean {
  return (
    /\.xls$/i.test(file.name) ||
    /spdc_budget|budget_arvind|arvind.*49/i.test(file.name)
  );
}
