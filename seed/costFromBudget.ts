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
import { parseBbsRows, parseMbRows } from "../apps/api/src/services/costSheetParser.ts";
import { monitoringItemRows, parseSpdcMonitoringRows } from "../apps/api/src/services/spdcMonitoringParser.ts";
import {
  COST_SHEET_TOOLS,
  SPDC_BBS_SHEETS,
  SPDC_BUDGET_DATA_START_ROW,
  SPDC_MB_SHEETS,
  SPDC_MONITORING_SHEETS,
  SPDC_RATE_SHEETS,
} from "../apps/api/src/services/spdcBudgetManifest.ts";

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

  // Budget WBS — XLSX omits empty column A: sr=0, description=1, stakeholder=2, amounts from 3+
  {
    const rows = sheet(wb, "Budget");
    const data: Record<string, unknown>[] = [];
    for (let i = SPDC_BUDGET_DATA_START_ROW; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const description = s(row[1], 400);
      if (!description || /^description$/i.test(description)) continue;
      if (/total net project cost|total project cost|^gst\s|^expected over budget/i.test(description)) continue;
      data.push({
        projectId,
        srNo: s(row[0], 20) || null,
        description,
        stakeholder: s(row[2], 120) || null,
        budgetedAmount: n(row[3]),
        workOrderAmount: n(row[4]),
        certifiedAmount: n(row[5]),
        forecastedAmount: n(row[6]),
        forecastReduction: n(row[7]),
        nonTendered: n(row[8]),
        steelExcess: n(row[9]),
        steelSaving: n(row[10]),
        cementExcess: n(row[11]),
        cementSaving: n(row[12]),
        tilesExcess: n(row[13]),
        tilesSaving: n(row[14]),
        grossTotal: n(row[15]),
        remarks: s(row[16], 2000) || null,
      });
    }
    await createManyChunks(prisma, "costBudgetLine", data);
    console.log("Budget WBS lines:", data.length);
  }

  // All monitoring packages — section › subsection on each BOQ line
  {
    const data: Record<string, unknown>[] = [];
    for (const [sheetName, packageName] of SPDC_MONITORING_SHEETS) {
      const rows = sheet(wb, sheetName);
      for (const line of monitoringItemRows(parseSpdcMonitoringRows(rows, packageName))) {
        data.push({
          projectId,
          packageName: line.packageName,
          section: line.section,
          itemNo: line.itemNo,
          description: line.description,
          uom: line.uom,
          rate: line.rate,
          boqQty: line.boqQty,
          extraQty: line.extraQty,
          gfcQty: line.gfcQty,
          achievedQty: line.achievedQty,
          excessQty: line.excessQty,
          savingQty: line.savingQty,
          certifiedQty: line.certifiedQty,
          boqCost: line.boqCost,
          extraItemCost: line.extraItemCost,
          gfcCost: line.gfcCost,
          achievedCost: line.achievedCost,
          excessCost: line.excessCost,
          savingCost: line.savingCost,
          certifiedInvoiceCost: line.certifiedInvoiceCost,
          pctBoq: line.pctBoq,
          pctGfc: line.pctGfc,
          pctAchieved: line.pctAchieved,
          pctCertified: line.pctCertified,
          evBoq: line.evBoq,
          evGfc: line.evGfc,
          evCertified: line.evCertified,
          actualCost: line.actualCost,
          cpi: line.cpi,
          cpiStatus: line.cpiStatus,
          etcBoq: line.etcBoq,
          etcGfc: line.etcGfc,
          etcCertified: line.etcCertified,
          eac: line.eac,
          vac: line.vac,
          varBoqGfc: line.varBoqGfc,
          varGfcAchieved: line.varGfcAchieved,
          varGfcCertified: line.varGfcCertified,
          overrunBoq: line.overrunBoq,
          overrunGfc: line.overrunGfc,
          overrunCertified: line.overrunCertified,
        });
      }
    }
    await createManyChunks(prisma, "costMonitoringLine", data);
    console.log("Monitoring lines:", data.length);
  }

  // All MB / structure sheets — full row import (no caps)
  {
    const data: Record<string, unknown>[] = [];
    for (const [sheetName, packageName] of SPDC_MB_SHEETS) {
      const rows = sheet(wb, sheetName);
      if (!rows.length) continue;
      for (const r of parseMbRows(rows)) {
        data.push({
          projectId,
          packageName,
          srNo: r.srNo || null,
          itemCode: r.itemCode || r.srNo || null,
          description: r.description,
          nos1: r.nos1,
          nos2: r.nos2,
          length: r.length,
          width: r.width,
          height: r.height,
          qty: r.qty,
          unit: r.unit || null,
          raBill: r.raBill || null,
          remark: r.remark || null,
        });
      }
    }
    await createManyChunks(prisma, "costMbLine", data);
    console.log("MB lines:", data.length);
  }

  // BBS — full row import via shared parser
  {
    const data: Record<string, unknown>[] = [];
    for (const [sheetName, packageName] of SPDC_BBS_SHEETS) {
      const rows = sheet(wb, sheetName);
      if (!rows.length) continue;
      for (const r of parseBbsRows(rows)) {
        if (r.rowKind === "header") {
          data.push({
            projectId,
            packageName,
            barMark: r.barMark || null,
            shapeCode: r.shapeCode || null,
            sectionMark: r.sectionMark || r.barMark || null,
            diameterMm: 0,
            shape: null,
            lengthMm: 0,
            nos: 0,
            nosPerMember: 0,
            nosOfMember: 0,
            shapeLenA: 0,
            shapeLenB: 0,
            shapeLenC: 0,
            shapeLenD: 0,
            shapeLenE: 0,
            totalLength: 0,
            weightKg: 0,
            location: r.location || null,
          });
          continue;
        }
        if (!r.diameterMm && !r.totalLength && !r.nos && !r.weightKg) continue;
        data.push({
          projectId,
          packageName,
          barMark: r.barMark || null,
          shapeCode: r.shapeCode || null,
          itemCode: r.itemCode || null,
          sectionMark: r.sectionMark || null,
          diameterMm: r.diameterMm,
          shape: r.shape || null,
          lengthMm: r.lengthMm,
          nos: r.nos,
          nosPerMember: r.nosPerMember,
          nosOfMember: r.nosOfMember,
          shapeLenA: r.shapeLenA,
          shapeLenB: r.shapeLenB,
          shapeLenC: r.shapeLenC,
          shapeLenD: r.shapeLenD,
          shapeLenE: r.shapeLenE,
          totalLength: r.totalLength,
          weightKg: r.weightKg,
          location: r.location || null,
        });
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
export { COST_SHEET_TOOLS };
