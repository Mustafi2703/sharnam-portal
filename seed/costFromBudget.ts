/**
 * Seed Cost registers from:
 * - SPDC_Budget_Arvind 49.xls (Budget, all Monitoring*, all MB, all BBS, rate diffs)
 * - Cashflow - Dashboard.xlsx (Chart, Forecast, Tracking, Monitoring overview)
 *
 * Refresh-on-seed so deploy (`render.yaml` startCommand) keeps sheet data maintained.
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

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
function sheet(wb: XLSX.WorkBook, name: string) {
  const key = wb.SheetNames.find((n) => n === name) || wb.SheetNames.find((n) => n.trim() === name.trim());
  if (!key || !wb.Sheets[key]) return [] as unknown[][];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], {
    header: 1,
    defval: "",
  }) as unknown as unknown[][];
}

async function createManyChunks(
  prisma: PrismaClient,
  model: "costMonitoringLine" | "costMbLine" | "costBbsLine" | "costRateDifference" | "costCashflowPeriod" | "costBudgetLine",
  rows: Record<string, unknown>[]
) {
  const chunk = 100;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    // @ts-expect-error dynamic model
    await prisma[model].createMany({ data: slice });
  }
}

/** All Monitoring* sheets in the Budget workbook → package tools */
const MONITORING_SHEETS: [string, string][] = [
  ["Monitoring Combined", "Combined"],
  ["Monitoring Civil Dormitory", "Civil Dormitory"],
  ["Monitoring Electric", "Electric"],
  ["Monitoring Plumbing", "Plumbing"],
  ["Monitoring UGWT", "UGWT"],
  ["Monitoring Septic Tank", "Septic Tank"],
  ["Monitoring External Dev", "External Development"],
  ["Monitoring Windows", "Windows"],
  ["Monitoring Furniture ", "Furniture"],
  ["Monitoring WPC Door", "WPC Door"],
  ["Monitoring Fire Fighting", "Fire Fighting"],
  ["Monitoring Gas", "Gas Line"],
  ["Monitoring External Electric", "External Electric"],
];

/** Measurement book / BOQ dimension sheets */
const MB_SHEETS: [string, string, number][] = [
  ["DORMITORY MB", "Dormitory Civil", 500],
  ["Electric MB", "Electric", 400],
  ["Plumbing MB", "Plumbing", 400],
  ["UGWT MB", "UGWT", 200],
  ["Septic Tank", "Septic Tank", 200],
  ["Compound Wall", "Compound Wall", 200],
  ["Road & Paving", "Road & Paving", 200],
  ["Windows ", "Windows", 100],
  ["Furniture", "Furniture", 100],
  ["WPC Door", "WPC Door", 50],
  ["Fire Fighting", "Fire Fighting", 200],
  ["Fire Alarm", "Fire Alarm", 100],
  ["Gas Line", "Gas Line", 200],
  ["External Electric", "External Electric", 250],
];

const BBS_SHEETS: [string, string, number][] = [
  ["DORMITORY BBS", "Dormitory BBS", 400],
  ["Compound Wall BBS", "Compound Wall BBS", 120],
  ["Septic Tank BBS", "Septic Tank BBS", 80],
  ["Road BBS", "Road BBS", 50],
  ["UGWT BBS", "UGWT BBS", 80],
];

export async function seedCostFromBudgetWorkbook(prisma: PrismaClient, projectId: string, excelRoot: string) {
  const file = path.join(excelRoot, "SPDC_Budget_Arvind 49.xls");
  if (!fs.existsSync(file)) {
    console.warn("Missing budget workbook:", file);
    return;
  }
  const wb = XLSX.readFile(file);

  await prisma.costBudgetLine.deleteMany({ where: { projectId } });
  await prisma.costMonitoringLine.deleteMany({ where: { projectId } });
  await prisma.costMbLine.deleteMany({ where: { projectId } });
  await prisma.costBbsLine.deleteMany({ where: { projectId } });
  await prisma.costRateDifference.deleteMany({ where: { projectId } });
  await prisma.costCashflowPeriod.deleteMany({ where: { projectId } });

  // Budget WBS
  {
    const rows = sheet(wb, "Budget");
    const data: Record<string, unknown>[] = [];
    for (let i = 3; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const description = s(row[1], 400);
      if (!description) continue;
      data.push({
        projectId,
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
    await createManyChunks(prisma, "costBudgetLine", data);
    console.log("Budget WBS lines:", data.length);
  }

  // All monitoring packages
  {
    const data: Record<string, unknown>[] = [];
    for (const [sheetName, packageName] of MONITORING_SHEETS) {
      const rows = sheet(wb, sheetName);
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const description = s(row[1], 500);
        const itemNo = s(row[0], 40);
        if (!description || /total amount|^electric work$|^plumbing work$/i.test(description)) continue;
        if (!itemNo && n(row[3]) === 0 && n(row[4]) === 0) continue;
        const boqQty = n(row[4]);
        const gfcQty = n(row[6]);
        data.push({
          projectId,
          packageName,
          itemNo: itemNo || null,
          description,
          uom: s(row[2], 20) || null,
          rate: n(row[3]),
          boqQty,
          extraQty: n(row[5]),
          gfcQty,
          achievedQty: n(row[7]),
          excessQty: Math.max(0, gfcQty - boqQty),
          savingQty: Math.max(0, boqQty - gfcQty),
          certifiedQty: n(row[10]),
          boqCost: n(row[11]) || n(row[3]) * boqQty,
        });
      }
    }
    await createManyChunks(prisma, "costMonitoringLine", data);
    console.log("Monitoring lines:", data.length);
  }

  // All MB / structure sheets
  {
    const data: Record<string, unknown>[] = [];
    for (const [sheetName, packageName, limit] of MB_SHEETS) {
      const rows = sheet(wb, sheetName);
      if (!rows.length) continue;
      let header = -1;
      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const a = s((rows[i] as unknown[])[0]).toLowerCase();
        const b = s((rows[i] as unknown[])[1]).toLowerCase();
        if ((a.includes("sr") || a === "1") && (b.includes("desc") || b.includes("item"))) {
          header = i;
          break;
        }
      }
      const start = header >= 0 ? header + 1 : 0;
      let pkg = 0;
      for (let i = start; i < rows.length && pkg < limit; i++) {
        const row = rows[i] as unknown[];
        const description = s(row[1], 400) || s(row[0], 400);
        if (!description || /total up to date|previous bill|this bill|name of project|name of contractor|w\.o\. no/i.test(description))
          continue;
        const qty = n(row[7]);
        const nos1 = n(row[2]);
        const nos2 = n(row[3]);
        if (!qty && !nos1 && !n(row[4]) && !s(row[0], 10).match(/^\d/)) continue;
        if (!qty && !n(row[4]) && !n(row[5]) && !n(row[6]) && !nos1) continue;
        data.push({
          projectId,
          packageName,
          srNo: s(row[0], 40) || null,
          description,
          nos1,
          nos2: nos2 || 1,
          length: n(row[4]),
          width: n(row[5]),
          height: n(row[6]),
          qty: qty || nos1 * (nos2 || 1) * (n(row[4]) || 1) * (n(row[5]) || 1) * (n(row[6]) || 1),
          unit: s(row[8], 20) || null,
        });
        pkg++;
      }
    }
    await createManyChunks(prisma, "costMbLine", data);
    console.log("MB lines:", data.length);
  }

  // BBS
  {
    const data: Record<string, unknown>[] = [];
    for (const [sheetName, packageName, limit] of BBS_SHEETS) {
      const rows = sheet(wb, sheetName);
      let pkg = 0;
      for (let i = 6; i < rows.length && pkg < limit; i++) {
        const row = rows[i] as unknown[];
        const description = s(row[1], 300);
        const dia = n(row[8]);
        const totalLen = n(row[18]) || n(row[17]);
        const nos = n(row[11]) || n(row[9]) * n(row[10]);
        if (!description || /name of project|bar bending|sr\.?\s*no/i.test(description)) continue;
        if (!dia && !totalLen && !nos) continue;
        const weight =
          dia && totalLen ? (Math.PI * (dia / 1000 / 2) ** 2 * totalLen * 7850) / 1000 : 0;
        data.push({
          projectId,
          packageName,
          barMark: s(row[0], 40) || null,
          diameterMm: dia,
          shape: s(row[2], 80) || null,
          lengthMm: n(row[17]) || n(row[12]),
          nos: nos || n(row[9]),
          totalLength: totalLen,
          weightKg: Math.round(weight * 100) / 100,
          location: s(row[1], 80),
        });
        pkg++;
      }
    }
    await createManyChunks(prisma, "costBbsLine", data);
    console.log("BBS lines:", data.length);
  }

  // Rate diffs — Steel, Cement, Tiles
  {
    const data: Record<string, unknown>[] = [];
    const steel = sheet(wb, "STEEL RATE DIFFRENCE");
    for (let i = 3; i < steel.length; i++) {
      const row = steel[i] as unknown[];
      if (!n(row[5]) && !n(row[7])) continue;
      data.push({
        projectId,
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
    const cement = sheet(wb, "CEMENT RATE DIFFRENCE");
    for (let i = 2; i < cement.length; i++) {
      const row = cement[i] as unknown[];
      if (!n(row[4]) && !n(row[5])) continue;
      data.push({
        projectId,
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
    const tiles = sheet(wb, "Tiles Rate Difference");
    for (let i = 2; i < tiles.length; i++) {
      const row = tiles[i] as unknown[];
      if (!n(row[4]) && !n(row[5])) continue;
      data.push({
        projectId,
        materialType: "Tiles",
        description: s(row[1], 120) || s(row[3], 80) || "Tiles",
        vendorName: s(row[2], 120) || null,
        purchaseNo: s(row[3], 80) || null,
        qty: n(row[4]),
        basicRate: n(row[5]),
        purchaseRate: n(row[6]),
        excessAmount: n(row[8]),
        savingAmount: n(row[9]),
      });
    }
    await createManyChunks(prisma, "costRateDifference", data);
    console.log("Rate difference rows:", data.length);
  }

  await seedCashflowDashboard(prisma, projectId, excelRoot, wb);
}

async function seedCashflowDashboard(
  prisma: PrismaClient,
  projectId: string,
  excelRoot: string,
  budgetWb?: XLSX.WorkBook
) {
  const file = path.join(excelRoot, "Cashflow - Dashboard.xlsx");
  if (!fs.existsSync(file)) {
    console.warn("Missing Cashflow Dashboard:", file);
    return;
  }
  const wb = XLSX.readFile(file);
  const data: Record<string, unknown>[] = [];

  // Cash Flow Chart — monthly planned vs actual
  {
    const rows = sheet(wb, "Cash Flow Chart - INR");
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
        projectId,
        periodLabel: label,
        packageName: "Project cashflow (Chart)",
        plannedAmount: p,
        actualAmount: a,
        progressPct: p ? a / p : 0,
      });
    }
  }

  // Forecast by structure (first few month columns as sample periods)
  {
    const rows = sheet(wb, "Cash Flow - Forecast");
    const header = (rows[4] || []) as unknown[];
    for (let i = 6; i < Math.min(rows.length, 40); i++) {
      const row = rows[i] as unknown[];
      const structure = s(row[1], 120);
      if (!structure || /total/i.test(structure)) continue;
      // store quarterly-ish totals using col "Total" near end, plus first month planned
      const total = n(row[header.length - 2]) || n(row[22]) || n(row[2]);
      const firstMonth = n(row[4]) || n(row[5]);
      data.push({
        projectId,
        periodLabel: "Forecast total",
        packageName: `Forecast · ${structure}`,
        plannedAmount: total || firstMonth,
        actualAmount: 0,
        progressPct: 0,
      });
      if (firstMonth) {
        data.push({
          projectId,
          periodLabel: excelMonthLabel(header[4]) || "Forecast M1",
          packageName: `Forecast · ${structure}`,
          plannedAmount: firstMonth,
          actualAmount: 0,
          progressPct: 0,
        });
      }
    }
  }

  // Tracking — work description monthly (first 4 months with values)
  {
    const rows = sheet(wb, "Tracking");
    const months = (rows[6] || []) as unknown[];
    for (let i = 7; i < Math.min(rows.length, 50); i++) {
      const row = rows[i] as unknown[];
      const work = s(row[0], 120);
      if (!work) continue;
      for (let c = 1; c <= 4; c++) {
        const amt = n(row[c]);
        if (!amt) continue;
        data.push({
          projectId,
          periodLabel: excelMonthLabel(months[c]) || `M${c}`,
          packageName: `Tracking · ${work}`,
          plannedAmount: amt,
          actualAmount: amt,
          progressPct: 1,
        });
      }
    }
  }

  // Cashflow Dashboard Monitoring overview (if Budget monitoring already loaded, add as "Cashflow Monitoring")
  {
    const rows = sheet(wb, "Monitoring");
    const monData: Record<string, unknown>[] = [];
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const description = s(row[1], 500);
      const itemNo = s(row[0], 40);
      if (!description || !itemNo) continue;
      const boqQty = n(row[4]);
      const gfcQty = n(row[6]);
      monData.push({
        projectId,
        packageName: "Cashflow Dashboard Monitoring",
        itemNo,
        description,
        uom: s(row[2], 20) || null,
        rate: n(row[3]),
        boqQty,
        extraQty: n(row[5]),
        gfcQty,
        achievedQty: n(row[7]),
        excessQty: Math.max(0, gfcQty - boqQty),
        savingQty: Math.max(0, boqQty - gfcQty),
        certifiedQty: n(row[10]),
        boqCost: n(row[11]) || n(row[3]) * boqQty,
      });
    }
    if (monData.length) {
      await createManyChunks(prisma, "costMonitoringLine", monData);
      console.log("Cashflow Dashboard monitoring lines:", monData.length);
    }
  }

  // Optional: merge Cashflow Dashboard Budget if SPDC budget missing rows
  if (budgetWb) {
    /* already seeded from SPDC Budget sheet */
  }

  await createManyChunks(prisma, "costCashflowPeriod", data);
  console.log("Cashflow periods (Chart + Forecast + Tracking):", data.length);
}

/** Catalog of Cost sheet tools — mirrors Excel tabs */
export const COST_SHEET_TOOLS = {
  cashflow: [
    { id: "chart", label: "Cash Flow Chart", source: "Cashflow - Dashboard.xlsx" },
    { id: "forecast", label: "Cash Flow Forecast", source: "Cashflow - Dashboard.xlsx" },
    { id: "tracking", label: "Tracking", source: "Cashflow - Dashboard.xlsx" },
  ],
  monitoringPackages: MONITORING_SHEETS.map(([, pkg]) => pkg),
  mbPackages: MB_SHEETS.map(([, pkg]) => pkg),
  bbsPackages: BBS_SHEETS.map(([, pkg]) => pkg),
};
