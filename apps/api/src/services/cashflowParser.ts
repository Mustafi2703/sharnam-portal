/**
 * Parse Cashflow - Dashboard.xlsx (Chart, Forecast, Tracking, Monitoring, rate diffs).
 * Column layout matches seed/costFromBudget.ts.
 */
import XLSX, { type WorkBook } from "../lib/xlsx.js";
import { SPDC_BUDGET_DATA_START_ROW } from "./spdcBudgetManifest.js";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function s(v: unknown, max = 500) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

function excelMonthLabel(serial: unknown): string {
  if (typeof serial !== "number" || serial < 30000) return s(serial, 40) || "Period";
  const epoch = new Date(Date.UTC(1899, 11, 30));
  epoch.setUTCDate(epoch.getUTCDate() + Math.floor(serial));
  return epoch.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

const CASHFLOW_SKIP =
  /^(month|difference|cpi|earned value|planned budget|progress percentage|prgress percentage|actual work done|work description|invoice month|yy|xx\s*-\s*yy|total)$/i;

/** Package rows only. Header and calculation labels are not packages. */
export function isCashflowWorkRow(label: string): boolean {
  const t = label.trim();
  if (!t) return false;
  if (CASHFLOW_SKIP.test(t)) return false;
  if (/^revised on\b/i.test(t)) return false;
  if (/planned budget|progress percentage|prgress percentage|actual work done|earned value/i.test(t)) return false;
  if (/^\d+(\.\d+)?$/.test(t)) return false;
  const serial = Number(t);
  if (Number.isFinite(serial) && serial >= 30000 && serial < 80000) return false;
  return true;
}

function periodDate(serialOrLabel: unknown): Date | null {
  if (typeof serialOrLabel === "number" && serialOrLabel >= 30000 && serialOrLabel < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(serialOrLabel));
    return epoch;
  }
  const text = s(serialOrLabel, 40);
  const year = text.match(/\b(19|20)\d{2}\b/);
  const month = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (year && month) return new Date(`${month[1]} 1, ${year[0]}`);
  if (year && /^q[1-4]/i.test(text)) {
    const q = Number(text.match(/q([1-4])/i)?.[1] || 1);
    return new Date(Number(year[0]), (q - 1) * 3, 1);
  }
  return null;
}

/** Drop a column dated more than 2 years before the project start. Sep 2022 is that column. */
export function periodTooEarly(serialOrLabel: unknown, projectStart?: Date | null): boolean {
  const d = periodDate(serialOrLabel);
  if (!d) return false;
  const start = projectStart && !Number.isNaN(projectStart.getTime()) ? projectStart : new Date(2025, 0, 1);
  const cutoff = new Date(start);
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  return d < cutoff;
}

function sheetRows(wb: WorkBook, name: string): unknown[][] {
  const key =
    wb.SheetNames.find((n: string) => n === name) ||
    wb.SheetNames.find((n: string) => n.trim().toLowerCase() === name.trim().toLowerCase());
  if (!key || !wb.Sheets[key]) return [];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], {
    header: 1,
    defval: "",
  }) as unknown[][];
}

export type ParsedCashflowPeriod = {
  periodLabel: string;
  packageName: string;
  plannedAmount: number;
  actualAmount: number;
  progressPct: number;
};

export type ParsedMonitoringLine = {
  packageName: string;
  itemNo: string;
  description: string;
  uom: string | null;
  rate: number;
  boqQty: number;
  extraQty: number;
  gfcQty: number;
  achievedQty: number;
  certifiedQty: number;
  boqCost: number;
};

export type ParsedRateDiff = {
  materialType: string;
  description: string;
  vendorName: string | null;
  purchaseNo: string | null;
  qty: number;
  basicRate: number;
  purchaseRate: number;
  excessAmount: number;
  savingAmount: number;
};

export function parseCashflowBuffer(buffer: Buffer, projectStart?: Date | null): ParsedCashflowPeriod[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const data: ParsedCashflowPeriod[] = [];

  {
    const rows = sheetRows(wb, "Cash Flow Chart - INR");
    const months = (rows[1] || []) as unknown[];
    const planned = (rows[2] || []) as unknown[];
    const actual = (rows[4] || []) as unknown[];
    for (let c = 1; c < months.length; c++) {
      if (s(months[c]).toLowerCase() === "total") continue;
      if (periodTooEarly(months[c], projectStart)) continue;
      const label = excelMonthLabel(months[c]);
      const p = n(planned[c]);
      const a = n(actual[c]);
      if (!p && !a) continue;
      data.push({
        periodLabel: label,
        packageName: "Project cashflow (Chart)",
        plannedAmount: p,
        actualAmount: a,
        progressPct: p ? a / p : 0,
      });
    }
  }

  {
    const rows = sheetRows(wb, "Cash Flow - Forecast");
    const header = (rows[4] || []) as unknown[];
    for (let i = 6; i < Math.min(rows.length, 40); i++) {
      const row = rows[i] as unknown[];
      const structure = s(row[1], 120);
      if (!isCashflowWorkRow(structure)) continue;
      const total = n(row[header.length - 2]) || n(row[22]) || n(row[2]);
      let firstMonth = 0;
      let firstLabel = "";
      for (let c = 4; c < header.length; c++) {
        if (periodTooEarly(header[c], projectStart)) continue;
        const amt = n(row[c]);
        if (!amt) continue;
        firstMonth = amt;
        firstLabel = excelMonthLabel(header[c]);
        break;
      }
      if (!total && !firstMonth) continue;
      data.push({
        periodLabel: "Forecast total",
        packageName: `Forecast · ${structure}`,
        plannedAmount: total || firstMonth,
        actualAmount: 0,
        progressPct: 0,
      });
      if (firstMonth) {
        data.push({
          periodLabel: firstLabel || "Forecast M1",
          packageName: `Forecast · ${structure}`,
          plannedAmount: firstMonth,
          actualAmount: 0,
          progressPct: 0,
        });
      }
    }
  }

  {
    const rows = sheetRows(wb, "Tracking");
    const months = (rows[6] || []) as unknown[];
    const monthCount = Math.max(4, months.length - 1);
    for (let i = 7; i < Math.min(rows.length, 50); i++) {
      const row = rows[i] as unknown[];
      const work = s(row[0], 120);
      if (!isCashflowWorkRow(work)) continue;
      for (let c = 1; c <= monthCount; c++) {
        if (periodTooEarly(months[c], projectStart)) continue;
        const amt = n(row[c]);
        if (!amt) continue;
        data.push({
          periodLabel: excelMonthLabel(months[c]) || `Month ${c}`,
          packageName: `Tracking · ${work}`,
          plannedAmount: amt,
          actualAmount: amt,
          progressPct: 1,
        });
      }
    }
  }

  return data;
}

/** Monitoring overview from Cashflow Dashboard workbook (separate package). */
export function parseCashflowMonitoringBuffer(buffer: Buffer): ParsedMonitoringLine[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const rows = sheetRows(wb, "Monitoring");
  const data: ParsedMonitoringLine[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const description = s(row[1], 500);
    const itemNo = s(row[0], 40);
    if (!description || !itemNo) continue;
    const boqQty = n(row[4]);
    const gfcQty = n(row[6]);
    data.push({
      packageName: "Cashflow Dashboard Monitoring",
      itemNo,
      description,
      uom: s(row[2], 20) || null,
      rate: n(row[3]),
      boqQty,
      extraQty: n(row[5]),
      gfcQty,
      achievedQty: n(row[7]),
      certifiedQty: n(row[10]),
      boqCost: n(row[11]) || n(row[3]) * boqQty,
    });
  }
  return data;
}

/** Steel / Cement rate diffs embedded in Cashflow Dashboard workbook. */
export function parseCashflowRateDiffsBuffer(buffer: Buffer): ParsedRateDiff[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const data: ParsedRateDiff[] = [];

  const steel = sheetRows(wb, "STEEL RATE DIFFRENCE");
  for (let i = 3; i < steel.length; i++) {
    const row = steel[i] as unknown[];
    if (!n(row[5]) && !n(row[7])) continue;
    data.push({
      materialType: "Steel",
      description: s(row[1], 120) || `TMT ${s(row[4])}mm`,
      vendorName: s(row[2], 120) || null,
      purchaseNo: s(row[3], 80) || null,
      qty: n(row[5]),
      basicRate: n(row[6]),
      purchaseRate: n(row[7]),
      excessAmount: n(row[10]),
      savingAmount: n(row[11]),
    });
  }

  const cement = sheetRows(wb, "CEMENT RATE DIFFRENCE");
  for (let i = 2; i < cement.length; i++) {
    const row = cement[i] as unknown[];
    if (!n(row[4]) && !n(row[5])) continue;
    data.push({
      materialType: "Cement",
      description: s(row[1], 120) || "Cement Bags",
      vendorName: s(row[2], 120) || null,
      purchaseNo: s(row[3], 80) || null,
      qty: n(row[4]),
      basicRate: n(row[5]),
      purchaseRate: n(row[6]),
      excessAmount: n(row[9]),
      savingAmount: n(row[10]),
    });
  }

  return data;
}

export type ParsedBudgetLine = {
  srNo: string | null;
  description: string;
  stakeholder: string | null;
  budgetedAmount: number;
  workOrderAmount: number;
  certifiedAmount: number;
  forecastedAmount: number;
  forecastReduction: number;
  nonTendered: number;
  steelExcess: number;
  steelSaving: number;
  cementExcess: number;
  cementSaving: number;
  tilesExcess: number;
  tilesSaving: number;
  grossTotal: number;
  remarks: string | null;
};

function headerText(v: unknown): string {
  return s(v, 80).toLowerCase().replace(/\s+/g, " ");
}

function findCol(rows: unknown[][], from: number, to: number, pattern: RegExp): number {
  for (let i = from; i <= to && i < rows.length; i++) {
    const row = (rows[i] || []) as unknown[];
    for (let j = 0; j < row.length; j++) {
      if (pattern.test(headerText(row[j]))) return j;
    }
  }
  return -1;
}

export function parseBudgetBuffer(buffer: Buffer): ParsedBudgetLine[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const budgetSheet =
    wb.SheetNames.find((n) => /^budget$/i.test(n.trim())) || wb.SheetNames[0];
  const rows = sheetRows(wb, budgetSheet);
  let headerAt = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const blob = ((rows[i] || []) as unknown[]).map(headerText).join(" | ");
    if (/budgeted/.test(blob) && /work order|certif/.test(blob)) {
      headerAt = i;
      break;
    }
  }
  if (headerAt < 0) headerAt = Math.max(0, SPDC_BUDGET_DATA_START_ROW - 3);
  const subAt = headerAt + 2;
  const descCol = findCol(rows, headerAt, subAt, /^description$/);
  const srCol = findCol(rows, headerAt, subAt, /^sr/);
  const whoCol = findCol(rows, headerAt, subAt, /stackholder|stakeholder/);
  const budgetedCol = findCol(rows, headerAt, headerAt + 1, /budgeted/);
  const woCol = findCol(rows, headerAt, headerAt + 1, /actual wo|work order/);
  const certifiedCol = findCol(rows, headerAt, headerAt + 1, /certif/);
  const forecastCol = findCol(rows, headerAt, headerAt + 1, /fore\s*cast/);
  // The group header is "FORECASTED / NON TENDERED ITEMS". The amount column is the next header row.
  const nonTenderedCol = findCol(rows, headerAt + 1, headerAt + 1, /non tendered/);
  const steelCol = findCol(rows, headerAt, headerAt + 1, /\bsteel\b/);
  const cementCol = findCol(rows, headerAt, headerAt + 1, /\bcement\b/);
  const tilesCol = findCol(rows, headerAt, headerAt + 1, /\btiles\b/);
  const grossCol = findCol(rows, headerAt, headerAt + 1, /gross total|^total$/);
  const remarksCol = findCol(rows, headerAt, headerAt + 1, /^remarks$/);
  const sub = (rows[subAt] || []) as unknown[];
  const additionCol = sub.findIndex((cell) => /^addition$/i.test(headerText(cell)));
  const reductionCol = sub.findIndex((cell) => /^reduction$/i.test(headerText(cell)));
  const data: ParsedBudgetLine[] = [];
  const start = Math.max(subAt + 1, SPDC_BUDGET_DATA_START_ROW);
  for (let i = start; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const description = s(row[descCol >= 0 ? descCol : 1], 400);
    if (!description) continue;
    if (/^description$|^budget wbs$|^sr no/i.test(description)) continue;
    if (/^gst\b|total project cost/i.test(description)) continue;
    const excessAt = (base: number) => {
      if (base < 0) return { excess: 0, saving: 0 };
      const next = headerText(sub[base]);
      const after = headerText(sub[base + 1]);
      const excess = next === "excess" ? n(row[base]) : 0;
      const saving = after === "saving" ? n(row[base + 1]) : next === "saving" ? n(row[base]) : 0;
      return { excess, saving };
    };
    const steel = excessAt(steelCol);
    const cement = excessAt(cementCol);
    const tiles = excessAt(tilesCol);
    data.push({
      srNo: s(row[srCol >= 0 ? srCol : 0], 20) || null,
      description,
      stakeholder: s(row[whoCol >= 0 ? whoCol : 2], 120) || null,
      budgetedAmount: budgetedCol >= 0 ? n(row[budgetedCol]) : 0,
      workOrderAmount: woCol >= 0 ? n(row[woCol]) : 0,
      certifiedAmount: certifiedCol >= 0 ? n(row[certifiedCol]) : 0,
      forecastedAmount: additionCol >= 0 ? n(row[additionCol]) : forecastCol >= 0 ? n(row[forecastCol]) : 0,
      forecastReduction: reductionCol >= 0 ? n(row[reductionCol]) : 0,
      nonTendered: nonTenderedCol >= 0 ? n(row[nonTenderedCol]) : 0,
      steelExcess: steel.excess,
      steelSaving: steel.saving,
      cementExcess: cement.excess,
      cementSaving: cement.saving,
      tilesExcess: tiles.excess,
      tilesSaving: tiles.saving,
      grossTotal: grossCol >= 0 ? n(row[grossCol]) : 0,
      remarks: remarksCol >= 0 ? s(row[remarksCol], 2000) || null : null,
    });
  }
  return data;
}
