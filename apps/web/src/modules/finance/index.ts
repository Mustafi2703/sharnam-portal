/**
 * Finance module (web) — re-exports canonical config from API module.
 * Single source of truth: apps/api/src/modules/finance/disciplines.ts
 */
export * from "@sharnam/finance/disciplines";
export { FinanceBillRegister } from "./components/FinanceBillRegister";
export { FinanceDisciplineStrip } from "./components/FinanceDisciplineStrip";
export { default as FinancePage } from "./pages/FinancePage";
