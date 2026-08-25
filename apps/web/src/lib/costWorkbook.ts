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
  // Full SPDC workbook expects ~4300 MB lines; partial legacy seed caps around 500/package.
  const mbIncomplete = budget > 1_000_000 && mb > 0 && mb < 3500;
  return mon < 80 || mbIncomplete || budget < 1_000_000;
}

export function isLikelySpdcBudgetFile(file: File): boolean {
  return (
    /\.xls$/i.test(file.name) ||
    /spdc_budget|budget_arvind|arvind.*49/i.test(file.name)
  );
}
