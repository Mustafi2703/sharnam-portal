/**
 * Load SPDC_Budget_Arvind 49.xls into Cost* tables (Budget WBS + Monitoring + MB + BBS + rates + cashflow).
 * Same source as seed/costFromBudget.ts — used by Cost → Sync template (QAP/Cube pattern).
 */
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { prisma } from "../prisma.js";
import { findWorkbook } from "../lib/excelRoot.js";
import { isFullSpdcWorkbook } from "./costSheetParser.js";

export function preferredBudgetFileName(projectCode?: string | null): string {
  const code = String(projectCode || "").toUpperCase();
  if (code.includes("ARVIND-01") || code.includes("DORM")) return "SPDC_Budget_Arvind 52.xls";
  if (code.includes("ARVIND-NTX") || code.includes("NTX")) return "SPDC_Budget_Arvind 49.xls";
  return "SPDC_Budget_Arvind 49.xls";
}

/** Pin NTX → 49, Dorm → 52. Generic jobs prefer 49 so Dorm 52 cannot leak. */
export function resolveBudgetWorkbookPath(opts?: { projectCode?: string | null; fileName?: string | null }): string | null {
  if (opts?.fileName) return findWorkbook([opts.fileName]);
  const preferred = preferredBudgetFileName(opts?.projectCode);
  if (preferred.includes("52")) {
    return findWorkbook(["SPDC_Budget_Arvind 52.xls", "SPDC_Budget_Arvind 49.xls"]);
  }
  return findWorkbook(["SPDC_Budget_Arvind 49.xls", "SPDC_Budget_Arvind 52.xls"]);
}

async function loadSeedModule(): Promise<{
  seedCostFromBudgetWorkbook: (
    prisma: typeof import("../prisma.js").prisma,
    projectId: string,
    excelRoot: string,
    opts?: { fileName?: string }
  ) => Promise<void>;
}> {
  const candidates = [
    path.join(process.cwd(), "seed", "costFromBudget.js"),
    path.join(process.cwd(), "seed", "costFromBudget.ts"),
    path.join(process.cwd(), "..", "..", "seed", "costFromBudget.js"),
    path.join(process.cwd(), "..", "..", "seed", "costFromBudget.ts"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    if (p.endsWith(".ts")) {
      const { register } = await import("tsx/esm/api");
      register();
    }
    return import(pathToFileURL(p).href) as any;
  }
  throw new Error("seed/costFromBudget.ts not found");
}

export async function syncBudgetWorkbookTemplate(projectId: string, opts?: { projectCode?: string | null }) {
  let code = opts?.projectCode;
  if (!code) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
    code = project?.code;
  }
  const file = resolveBudgetWorkbookPath({ projectCode: code });
  if (!file) throw new Error("SPDC_Budget_Arvind 49.xls not found on server");
  const excelRoot = path.dirname(file);
  const { seedCostFromBudgetWorkbook } = await loadSeedModule();
  await seedCostFromBudgetWorkbook(prisma, projectId, excelRoot, { fileName: path.basename(file) });
  const counts = await countCostRows(projectId, path.basename(file));
  const capex = await syncCapexFromCostBudget(projectId, new Date().toISOString().slice(0, 7));
  try {
    const { syncAllCashflowSources } = await import("../modules/finance/cashflowBridge.js");
    await syncAllCashflowSources(projectId);
    return { ...counts, capex, reconciled: true };
  } catch {
    return { ...counts, capex };
  }
}

/** Import uploaded SPDC budget workbook bytes (full Budget + Monitoring + MB + BBS + rates). */
export async function syncBudgetWorkbookFromBuffer(projectId: string, buffer: Buffer, originalName?: string) {
  if (!isFullSpdcWorkbook(buffer) && !/spdc_budget|budget_arvind|arvind.*49/i.test(originalName || "")) {
    throw new Error("Not a full SPDC budget workbook — use structure import for single BOQ sheets.");
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sharnam-cost-"));
  const budgetPath = path.join(dir, "SPDC_Budget_Arvind 49.xls");
  fs.writeFileSync(budgetPath, buffer);
  const serverFile = resolveBudgetWorkbookPath();
  if (serverFile) {
    const serverRoot = path.dirname(serverFile);
    const cfSrc = path.join(serverRoot, "Cashflow - Dashboard.xlsx");
    if (fs.existsSync(cfSrc)) {
      fs.copyFileSync(cfSrc, path.join(dir, "Cashflow - Dashboard.xlsx"));
    }
  }
  try {
    const { seedCostFromBudgetWorkbook } = await loadSeedModule();
    await seedCostFromBudgetWorkbook(prisma, projectId, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const counts = await countCostRows(projectId, originalName || "uploaded workbook");
  const capex = await syncCapexFromCostBudget(projectId, new Date().toISOString().slice(0, 7));
  return { ...counts, capex };
}

/** Project CAPEX is the monthly budget register — keep Finance in sync with Cost WBS. */
export async function syncCapexFromCostBudget(projectId: string, monthLabel?: string) {
  const lines = await prisma.costBudgetLine.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  await prisma.projectCapex.deleteMany({ where: { projectId } });
  if (!lines.length) return 0;
  await prisma.projectCapex.createMany({
    data: lines.map((line) => ({
      projectId,
      srNo: line.srNo || null,
      description: line.description,
      packageName: monthLabel || null,
      stakeholder: line.stakeholder || null,
      budgetedAmount: line.budgetedAmount || 0,
      workOrderValue: line.workOrderAmount || 0,
    })),
  });
  return lines.length;
}

async function countCostRows(projectId: string, source: string) {
  const [budget, monitoring, mb, bbs, rates, cashflow] = await Promise.all([
    prisma.costBudgetLine.count({ where: { projectId } }),
    prisma.costMonitoringLine.count({ where: { projectId } }),
    prisma.costMbLine.count({ where: { projectId } }),
    prisma.costBbsLine.count({ where: { projectId } }),
    prisma.costRateDifference.count({ where: { projectId } }),
    prisma.costCashflowPeriod.count({ where: { projectId } }),
  ]);
  return { ok: true as const, fullWorkbook: true as const, source, budget, monitoring, mb, bbs, rates, cashflow };
}

export { isFullSpdcWorkbook };
