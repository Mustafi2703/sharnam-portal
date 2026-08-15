/**
 * Parse Cashflow - Dashboard.xlsx (Chart, Forecast, Tracking).
 * Column layout matches seed/costFromBudget.ts — logic duplicated here (seed not modified).
 */
import * as XLSX from "xlsx";

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

function sheetRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  const key = wb.SheetNames.find((n) => n === name) || wb.SheetNames.find((n) => n.trim() === name.trim());
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

export function parseCashflowBuffer(buffer: Buffer): ParsedCashflowPeriod[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const data: ParsedCashflowPeriod[] = [];

  {
    const rows = sheetRows(wb, "Cash Flow Chart - INR");
    const months = (rows[1] || []) as unknown[];
    const planned = (rows[2] || []) as unknown[];
    const actual = (rows[4] || []) as unknown[];
    for (let c = 1; c < months.length; c++) {
      if (s(months[c]).toLowerCase() === "total") continue;
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
      if (!structure || /total/i.test(structure)) continue;
      const total = n(row[header.length - 2]) || n(row[22]) || n(row[2]);
      const firstMonth = n(row[4]) || n(row[5]);
      data.push({
        periodLabel: "Forecast total",
        packageName: `Forecast · ${structure}`,
        plannedAmount: total || firstMonth,
        actualAmount: 0,
        progressPct: 0,
      });
      if (firstMonth) {
        data.push({
          periodLabel: excelMonthLabel(header[4]) || "Forecast M1",
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
    for (let i = 7; i < Math.min(rows.length, 50); i++) {
      const row = rows[i] as unknown[];
      const work = s(row[0], 120);
      if (!work) continue;
      for (let c = 1; c <= 4; c++) {
        const amt = n(row[c]);
        if (!amt) continue;
        data.push({
          periodLabel: excelMonthLabel(months[c]) || `Month ${c}`,
          packageName: `Tracking · ${work}`,
          plannedAmount: amt,
          actualAmount: 0,
          progressPct: 0,
        });
      }
    }
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
  nonTendered: number;
};

export function parseBudgetBuffer(buffer: Buffer): ParsedBudgetLine[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const budgetSheet =
    wb.SheetNames.find((n) => /^budget$/i.test(n.trim())) || wb.SheetNames[0];
  const rows = sheetRows(wb, budgetSheet);
  const data: ParsedBudgetLine[] = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const description = s(row[1], 400);
    if (!description) continue;
    data.push({
      srNo: s(row[0], 20) || null,
      description,
      stakeholder: s(row[2], 120) || null,
      budgetedAmount: n(row[3]),
      workOrderAmount: n(row[4]),
      certifiedAmount: n(row[5]),
      forecastedAmount: n(row[6]),
      nonTendered: n(row[8]),
    });
  }
  return data;
}
