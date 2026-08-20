/** Derive SPDC Monitoring sheet cost / EV / CPI columns from qty + rate (and optional Excel overrides). */

export type MonitoringQtyInput = {
  rate: number;
  boqQty: number;
  extraQty: number;
  gfcQty: number;
  achievedQty: number;
  certifiedQty: number;
};

export type MonitoringMetrics = {
  excessQty: number;
  savingQty: number;
  boqCost: number;
  extraItemCost: number;
  gfcCost: number;
  achievedCost: number;
  excessCost: number;
  savingCost: number;
  certifiedInvoiceCost: number;
  pctBoq: number;
  pctGfc: number;
  pctAchieved: number;
  pctCertified: number;
  evBoq: number;
  evGfc: number;
  evCertified: number;
  actualCost: number;
  cpi: number;
  cpiStatus: string;
  etcBoq: number;
  etcGfc: number;
  etcCertified: number;
  eac: number;
  vac: number;
  varBoqGfc: number;
  varGfcAchieved: number;
  varGfcCertified: number;
  overrunBoq: number;
  overrunGfc: number;
  overrunCertified: number;
};

function pct(part: number, whole: number) {
  if (!whole || !Number.isFinite(whole)) return 0;
  return (part / whole) * 100;
}

export function deriveMonitoringMetrics(q: MonitoringQtyInput): MonitoringMetrics {
  const rate = Number(q.rate) || 0;
  const boqQty = Number(q.boqQty) || 0;
  const extraQty = Number(q.extraQty) || 0;
  const gfcQty = Number(q.gfcQty) || 0;
  const achievedQty = Number(q.achievedQty) || 0;
  const certifiedQty = Number(q.certifiedQty) || 0;

  const boqCost = boqQty * rate;
  const extraItemCost = extraQty * rate;
  const gfcCost = gfcQty * rate;
  const achievedCost = achievedQty * rate;
  const certifiedInvoiceCost = certifiedQty * rate;
  const excessQty = Math.max(0, gfcQty - boqQty);
  const savingQty = Math.max(0, boqQty - gfcQty);
  const excessCost = Math.max(0, gfcCost - boqCost);
  const savingCost = Math.max(0, boqCost - gfcCost);

  const actualCost = achievedCost;
  const evBoq = achievedCost;
  const evGfc = achievedCost;
  const evCertified = certifiedInvoiceCost;
  const cpi = actualCost > 0 ? evBoq / actualCost : 0;
  const cpiStatus = !actualCost ? "—" : cpi >= 1 ? "On Budget" : "Cost Overrun";

  const etcBoq = Math.max(0, boqCost - achievedCost);
  const etcGfc = gfcCost - achievedCost;
  const etcCertified = Math.max(0, certifiedInvoiceCost - achievedCost);
  const eac = boqCost;
  const vac = 0;
  const varBoqGfc = boqCost - gfcCost;
  const varGfcAchieved = gfcCost - achievedCost;
  const varGfcCertified = gfcCost - certifiedInvoiceCost;
  const overrunBoq = boqQty > 0 ? 1 - achievedQty / boqQty : 0;
  const overrunGfc = gfcQty > 0 ? 1 - achievedQty / gfcQty : 0;
  const overrunCertified = certifiedQty > 0 ? 1 - achievedQty / certifiedQty : 0;

  return {
    excessQty,
    savingQty,
    boqCost,
    extraItemCost,
    gfcCost,
    achievedCost,
    excessCost,
    savingCost,
    certifiedInvoiceCost,
    pctBoq: pct(achievedQty, boqQty),
    pctGfc: gfcQty > 0 ? pct(achievedQty, gfcQty) : 0,
    pctAchieved: pct(achievedQty, boqQty) / 100,
    pctCertified: pct(certifiedQty, boqQty),
    evBoq,
    evGfc,
    evCertified,
    actualCost,
    cpi,
    cpiStatus,
    etcBoq,
    etcGfc,
    etcCertified,
    eac,
    vac,
    varBoqGfc,
    varGfcAchieved,
    varGfcCertified,
    overrunBoq,
    overrunGfc,
    overrunCertified,
  };
}

/** Prefer Excel cell value when present; else derived. */
export function pickNum(excel: unknown, derived: number) {
  const x = Number(excel);
  return Number.isFinite(x) && String(excel ?? "").trim() !== "" ? x : derived;
}
