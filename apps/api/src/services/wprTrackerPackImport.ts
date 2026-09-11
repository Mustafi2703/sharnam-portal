/**
 * Import client WPR tracker workbooks (templates/wpr-client + July 23–29 example).
 * Seeds Progress registers that feed WPR Maker, PPTX, and client Excel export.
 */
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import XLSX from "../lib/xlsx.js";
import type { WorkBook } from "../lib/xlsx.js";

function searchRoots(): string[] {
  return [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(process.cwd(), "../..")];
}

export function resolveWprPackDir() {
  const rels = [
    ["templates", "wpr-client"],
    ["packages", "shared", "untitled folder"],
    ["module_prompts", "untitled folder"],
  ];
  for (const root of searchRoots()) {
    for (const rel of rels) {
      const p = path.join(root, ...rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return path.join(process.cwd(), "templates", "wpr-client");
}

export function resolveJulyWprWorkbook(): string | null {
  const names = [
    ["module_prompts", "untitled folder", "WPR  23 July to 29 July.xlsx"],
    ["templates", "wpr-client", "WPR-Client-Week-Template.xlsx"],
    ["templates", "WPR-File.xlsx"],
  ];
  for (const root of searchRoots()) {
    for (const rel of names) {
      const p = path.join(root, ...rel);
      if (fs.existsSync(p)) return p;
    }
  }
  const dir = resolveWprPackDir();
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => /^WPR/i.test(f) && /\.xlsx?$/i.test(f));
  return hit ? path.join(dir, hit) : null;
}

export function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const n = Number(v);
  if (Number.isFinite(n) && n > 30000 && n < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(epoch.getTime() + n * 86400000);
  }
  const s = String(v).trim();
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    let year = Number(mdy[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function money(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/₹/g, "")
    .replace(/Rs\.?/gi, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return money(v);
}

export function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function days(v: unknown): number | null {
  const m = String(v ?? "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function riskScore(v: unknown): number {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("high")) return 5;
  if (s.includes("medium") || s.includes("med")) return 3;
  if (s.includes("low")) return 1;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
}

function findWorkbookFile(dir: string, pattern: RegExp) {
  if (!fs.existsSync(dir)) return "";
  return fs.readdirSync(dir).find((f) => pattern.test(f)) || "";
}

function readSheetRows(filePath: string, sheetName?: RegExp) {
  const wb = XLSX.readFile(filePath);
  const name = sheetName ? wb.SheetNames.find((n) => sheetName.test(n)) : wb.SheetNames[0];
  if (!name) return [] as unknown[][];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][];
}

function sheetRows(wb: WorkBook, pattern: RegExp) {
  const name = wb.SheetNames.find((n) => pattern.test(n));
  if (!name) return [] as unknown[][];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][];
}

export type WprTrackerImportResult = {
  valueAdditions: number;
  procurementLines: number;
  siteMaterials: number;
  purchaseRequisitions: number;
  invoiceTrackers: number;
  sorStats: number;
  hindrances: number;
  risks: number;
  legalApprovals: number;
  manpower: number;
  cashflow: number;
  activityLines: number;
  cubeTests: number;
};

export async function importWprTrackerPack(prisma: PrismaClient, projectId: string): Promise<WprTrackerImportResult> {
  const dir = resolveWprPackDir();
  const out: WprTrackerImportResult = {
    valueAdditions: 0,
    procurementLines: 0,
    siteMaterials: 0,
    purchaseRequisitions: 0,
    invoiceTrackers: 0,
    sorStats: 0,
    hindrances: 0,
    risks: 0,
    legalApprovals: 0,
    manpower: 0,
    cashflow: 0,
    activityLines: 0,
    cubeTests: 0,
  };

  const wprPath = resolveJulyWprWorkbook() || (findWorkbookFile(dir, /^WPR/i) ? path.join(dir, findWorkbookFile(dir, /^WPR/i)) : "");
  if (wprPath && fs.existsSync(wprPath)) {
    const wb = XLSX.readFile(wprPath);

    const vaRows = sheetRows(wb, /Value Addition/i);
    if (vaRows.length) {
      await prisma.progressValueAddition.deleteMany({ where: { projectId } });
      let sr = 0;
      for (const row of vaRows.slice(1)) {
        const block = str(row[1]);
        const pkg = str(row[2]);
        const ve = str(row[5]);
        if (!block && !pkg && !ve) continue;
        if (/^total/i.test(block) || /^total/i.test(pkg)) continue;
        sr++;
        const earlier = money(row[12]);
        const finalP = money(row[13]);
        await prisma.progressValueAddition.create({
          data: {
            projectId,
            srNo: sr,
            block: block || null,
            packageName: pkg || null,
            planning: str(row[3]) || null,
            suggestions: str(row[4]) || null,
            valueEngineeringPoints: ve || null,
            cost: money(row[6]),
            timeImpact: str(row[7]) || null,
            qualityImpact: str(row[8]) || null,
            approvalAuthority: str(row[9]) || null,
            earlierQuoted: earlier,
            finalPrice: finalP,
            savings: money(row[14]) || earlier - finalP,
          },
        });
        out.valueAdditions++;
      }
    }

    const procRows = sheetRows(wb, /^Procurement tracker$/i);
    if (procRows.length) {
      await prisma.progressProcurementLine.deleteMany({ where: { projectId } });
      let sr = 0;
      for (const row of procRows.slice(1)) {
        const wp = str(row[1]);
        if (!wp) continue;
        sr++;
        await prisma.progressProcurementLine.create({
          data: {
            projectId,
            srNo: sr,
            workPackage: wp,
            itemDescription: str(row[2]) || null,
            responsibleStakeholder: str(row[3]) || null,
            contractorName: str(row[4]) || null,
            targetInquiryDate: excelDate(row[5]),
            vendorAppointmentDate: excelDate(row[6]),
            leadTimeDays: days(row[7]),
            priorityLevel: num(row[8]) || 1,
            vendorAppointed: /^yes/i.test(str(row[9])),
            remarks: str(row[10]) || null,
          },
        });
        out.procurementLines++;
      }
    }

    const qualRows = sheetRows(wb, /Quality Statistic/i);
    if (qualRows.length) {
      await prisma.progressSorStat.deleteMany({ where: { projectId } });
      for (const row of qualRows.slice(1)) {
        const obs = str(row[1]);
        if (!obs) continue;
        const total = num(row[2]);
        const open = num(row[3]);
        const closed = num(row[4]);
        await prisma.progressSorStat.create({
          data: {
            projectId,
            observation: obs,
            total,
            openCount: open,
            closedCount: closed,
            closureRate: total ? closed / total : 0,
          },
        });
        out.sorStats++;
      }
    }

    const hindRows = sheetRows(wb, /Hinderance|Hindrance/i);
    if (hindRows.length > 2) {
      await prisma.progressHindrance.deleteMany({ where: { projectId } });
      for (const row of hindRows.slice(2)) {
        const desc = str(row[1]);
        if (!desc) continue;
        await prisma.progressHindrance.create({
          data: {
            projectId,
            description: desc,
            location: str(row[2]) || null,
            activity: str(row[3]) || str(row[9]) || null,
            correspondence: str(row[4]) || null,
            type: str(row[5]) || null,
            category: str(row[5]) || "Execution",
            occurredAt: excelDate(row[6]),
            resolvedAt: excelDate(row[7]),
            daysImpacted: days(row[8]) ?? 0,
            baselineStart: excelDate(row[10]),
            scheduleImpact: days(row[11]) ?? 0,
            delayType: str(row[12]) || null,
            accountable: str(row[14]) || null,
            status: /open/i.test(str(row[15])) ? "Open" : str(row[15]) || "Resolved",
            remarks: str(row[13]) || null,
          },
        });
        out.hindrances++;
      }
    }

    const riskRows = sheetRows(wb, /Risk Register/i);
    if (riskRows.length > 1) {
      await prisma.progressRisk.deleteMany({ where: { projectId } });
      let i = 0;
      for (const row of riskRows.slice(1)) {
        const name = str(row[3]);
        if (!name) continue;
        i++;
        const p = riskScore(row[6]);
        const c = riskScore(row[7]);
        await prisma.progressRisk.create({
          data: {
            projectId,
            code: str(row[0]) || `R${i}`,
            category: str(row[1]) || "General",
            name,
            description: str(row[4]) || null,
            probability: p,
            consequence: c,
            severity: p * c,
            riskOwner: str(row[9]) || null,
            contingencyPlan: str(row[10]) || null,
            impactNotes: str(row[11]) || null,
            dateLastUpdated: excelDate(row[2]),
            status: /close|closed/i.test(str(row[13])) ? "Closed" : /pending/i.test(str(row[13])) ? "Open" : str(row[13]) || "Open",
          },
        });
        out.risks++;
      }
    }

    const legalRows = sheetRows(wb, /Legal Approval/i);
    if (legalRows.length > 1) {
      await prisma.progressLegalApproval.deleteMany({ where: { projectId } });
      for (const row of legalRows.slice(1)) {
        const desc = str(row[1]);
        if (!desc) continue;
        const statusRaw = str(row[8]);
        await prisma.progressLegalApproval.create({
          data: {
            projectId,
            approvalId: str(row[0]) || `LA-${out.legalApprovals + 1}`,
            category: "Compliance",
            authority: str(row[2]) || null,
            description: desc,
            requiredBy: excelDate(row[5]),
            receivedDate: excelDate(row[6]),
            status: /done|approved/i.test(statusRaw) ? "Approved" : /not done|pending/i.test(statusRaw) ? "Submitted" : statusRaw || "Submitted",
            responsible: str(row[2]) || null,
            remarks: [str(row[3]), str(row[4]), str(row[7])].filter(Boolean).join(" — ") || null,
          },
        });
        out.legalApprovals++;
      }
    }

    const manRows = sheetRows(wb, /Weekly Manpower/i);
    if (manRows.length > 1) {
      await prisma.progressManpower.deleteMany({ where: { projectId } });
      let rank = 0;
      const seen = new Set<string>();
      for (const row of manRows.slice(1)) {
        const trade = str(row[0]);
        if (!trade || /total|type of manpower/i.test(trade)) continue;
        const key = trade.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const required = num(row[1]);
        const available = num(row[2]);
        const shortage = Math.max(0, required - available);
        rank++;
        await prisma.progressManpower.create({
          data: {
            projectId,
            trade,
            required,
            available,
            shortage,
            shortagePct: required > 0 ? shortage / required : 0,
            rank,
          },
        });
        out.manpower++;
      }
    }

    const cashRows = sheetRows(wb, /Project Cashflow/i);
    if (cashRows.length > 1) {
      await prisma.progressPlannedActual.deleteMany({
        where: { projectId, NOT: { packageName: { contains: "S-curve" } } },
      });
      await prisma.costCashflowPeriod.deleteMany({
        where: { projectId, NOT: { packageName: "COP-day" } },
      });
      const monthIndex: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      };
      for (const row of cashRows.slice(1)) {
        const month = str(row[0]);
        if (!month) continue;
        const planned = money(row[3]);
        const actual = money(row[4]);
        const pkg = str(row[1]) || "Overall";
        await prisma.progressPlannedActual.create({
          data: {
            projectId,
            periodLabel: month,
            packageName: pkg,
            plannedAmount: planned,
            actualAmount: actual,
            plannedPct: planned > 0 ? 1 : 0,
            actualPct: planned > 0 ? actual / planned : 0,
          },
        });
        const mi = monthIndex[month.toLowerCase()];
        const periodDate = mi != null ? new Date(2025, mi, 1) : null;
        await prisma.costCashflowPeriod.create({
          data: {
            projectId,
            periodLabel: month,
            periodDate,
            packageName: pkg,
            plannedAmount: planned,
            actualAmount: actual,
            progressPct: planned > 0 ? actual / planned : 0,
          },
        });
        out.cashflow++;
      }
    }

    const pvaRows = sheetRows(wb, /Planned Vs Actual/i);
    if (pvaRows.length > 3) {
      await prisma.progressActivityLine.deleteMany({ where: { projectId } });
      let lastTower = "";
      for (const row of pvaRows.slice(3)) {
        const activity = str(row[2]);
        if (!activity) continue;
        const tower = str(row[1]) || lastTower;
        if (str(row[1])) lastTower = str(row[1]);
        const gfc = num(row[7]);
        const executed = num(row[8]) || num(row[12]);
        const balance = num(row[9]);
        await prisma.progressActivityLine.create({
          data: {
            projectId,
            srNo: Math.round(num(row[0])) || out.activityLines + 1,
            tower: tower || null,
            activity,
            unit: str(row[5]) || null,
            plannedStart: excelDate(row[3]),
            plannedEnd: excelDate(row[4]),
            boqQty: num(row[6]),
            gfcQty: gfc,
            executedQty: executed,
            balanceQty: balance || Math.max(0, gfc - executed),
            weeklyPlanned: num(row[10]),
            weeklyActual: num(row[11]),
            cumulativeQty: num(row[12]) || executed,
            pctComplete: gfc > 0 ? executed / gfc : 0,
            status: gfc > 0 && executed >= gfc ? "Complete" : "In Progress",
          },
        });
        out.activityLines++;
      }
    }

    const cubeRows = sheetRows(wb, /Cube Test/i);
    if (cubeRows.length > 1) {
      await prisma.cubeTest.deleteMany({ where: { projectId } });
      for (const row of cubeRows.slice(1)) {
        const sample = str(row[0]);
        const strength = num(row[1]);
        if (!sample && !strength) continue;
        const limit = num(row[2]) || 17;
        await prisma.cubeTest.create({
          data: {
            projectId,
            srNo: sample || String(out.cubeTests + 1),
            description: `Cube sample ${sample || out.cubeTests + 1} — 7-day compressive strength`,
            grade: "M25",
            strength,
            strength7: strength,
            result: strength >= limit ? "Pass" : "Below IS limit",
            testAgency: "Site lab",
            source: "WPR 23–29 July",
            castDate: new Date(2026, 6, 23),
          },
        });
        out.cubeTests++;
      }
    }
  }

  const prCounts = await importPrInvoiceFromWorkbook(prisma, projectId);
  out.purchaseRequisitions = prCounts.purchaseRequisitions;
  out.invoiceTrackers = prCounts.invoiceTrackers;

  const matFile = findWorkbookFile(dir, /Site Materials/i);
  if (matFile) {
    const rows = readSheetRows(path.join(dir, matFile));
    await prisma.siteMaterialStock.deleteMany({ where: { projectId } });
    let sr = 0;
    for (const row of rows.slice(1)) {
      const name = str(row[2]);
      if (!name) continue;
      sr++;
      await prisma.siteMaterialStock.create({
        data: {
          projectId,
          srNo: sr,
          recordDate: excelDate(row[1]),
          materialName: name,
          totalPurchase: num(row[3]),
          balanceQuantity: num(row[4]),
          unit: str(row[5]) || null,
          location: str(row[6]) || null,
          remarks: str(row[7]) || null,
          buildingQty: num(row[9]) || null,
          externalQty: num(row[10]) || null,
        },
      });
      out.siteMaterials++;
    }
  }

  return out;
}

/** Import PR Tracker + Invoice Processing Tracker from PR Tracker-52.xlsx into Finance registers. */
export async function importPrInvoiceFromWorkbook(
  prisma: PrismaClient,
  projectId: string
): Promise<{ purchaseRequisitions: number; invoiceTrackers: number }> {
  const dir = resolveWprPackDir();
  const named = [
    path.join(process.cwd(), "module_prompts", "untitled folder", "PR Tracker-52.xlsx"),
    path.join(process.cwd(), "templates", "wpr-client", "PR-Tracker-Template.xlsx"),
  ].find((p) => fs.existsSync(p));
  const found = findWorkbookFile(dir, /PR Tracker/i);
  const prPath = named || (found ? path.join(dir, found) : "");
  const out = { purchaseRequisitions: 0, invoiceTrackers: 0 };
  if (!prPath || !fs.existsSync(prPath)) return out;

  const prRows = readSheetRows(prPath, /^PR Tracker$/i);
  await prisma.progressPurchaseRequisition.deleteMany({ where: { projectId } });
  let sr = 0;
  for (const row of prRows.slice(2)) {
    const prNo = str(row[2]);
    if (!prNo) continue;
    sr++;
    await prisma.progressPurchaseRequisition.create({
      data: {
        projectId,
        srNo: sr,
        prType: str(row[1]) || null,
        prNumber: prNo,
        discipline: str(row[3]) || null,
        qty: num(row[4]) || 1,
        unit: str(row[5]) || null,
        rate: money(row[6]),
        amount: money(row[7]),
        materialCode: str(row[8]) || null,
        poNumber: str(row[9]) || null,
      },
    });
    out.purchaseRequisitions++;
  }

  const invRows = readSheetRows(prPath, /Invoice/i);
  await prisma.progressInvoiceTracker.deleteMany({ where: { projectId } });
  let isr = 0;
  for (const row of invRows.slice(2)) {
    const work = str(row[1]);
    const invNo = str(row[2]);
    if (!work && !invNo) continue;
    isr++;
    await prisma.progressInvoiceTracker.create({
      data: {
        projectId,
        srNo: num(row[0]) || isr,
        workName: work || `Invoice ${invNo || isr}`,
        invoiceNumber: invNo || null,
        poNumber: str(row[3]) || null,
        vendorName: str(row[4]) || null,
        invoiceDate: excelDate(row[5]),
        amountExclGst: money(row[6]),
        copStatus: str(row[7]) || "Open",
      },
    });
    out.invoiceTrackers++;
  }
  return out;
}
