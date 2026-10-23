/**
 * Budget tab gross total, SPDC_Budget_Arvind 49, Budget sheet.
 * Row 3.1 (Bhavna Infra) matches this identity on the cached values:
 * Gross Total = Actual WO Amount + Forecast addition - Forecast reduction
 *   + Non Tendered + Steel excess + Cement excess + Tiles excess
 *   - Steel saving - Cement saving - Tiles saving.
 */
export const BUDGET_GROSS_FORMULA =
  "Gross Total = Actual WO Amount + Forecast addition - Forecast reduction + Non Tendered + Steel excess + Cement excess + Tiles excess - Steel saving - Cement saving - Tiles saving";

export type BudgetGrossInput = {
  workOrderAmount: number;
  forecastedAmount: number;
  forecastReduction: number;
  nonTendered: number;
  steelExcess: number;
  steelSaving: number;
  cementExcess: number;
  cementSaving: number;
  tilesExcess: number;
  tilesSaving: number;
};

export function budgetGrossTotal(line: BudgetGrossInput): number {
  return (
    (Number(line.workOrderAmount) || 0) +
    (Number(line.forecastedAmount) || 0) -
    (Number(line.forecastReduction) || 0) +
    (Number(line.nonTendered) || 0) +
    (Number(line.steelExcess) || 0) +
    (Number(line.cementExcess) || 0) +
    (Number(line.tilesExcess) || 0) -
    (Number(line.steelSaving) || 0) -
    (Number(line.cementSaving) || 0) -
    (Number(line.tilesSaving) || 0)
  );
}
