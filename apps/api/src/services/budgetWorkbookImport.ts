/**
 * Load SPDC_Budget_Arvind 49.xls into Cost* tables (Budget WBS + Monitoring + MB + BBS + rates + cashflow).
 * Same source as seed/costFromBudget.ts — used by Cost → Sync template (QAP/Cube pattern).
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { prisma } from "../prisma.js";

export function resolveBudgetWorkbookPath(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT ? path.join(process.env.SHARNAM_EXCEL_ROOT, "SPDC_Budget_Arvind 49.xls") : "",
    path.join(process.cwd(), "seed", "data", "SPDC_Budget_Arvind 49.xls"),
    path.join(process.cwd(), "..", "..", "seed", "data", "SPDC_Budget_Arvind 49.xls"),
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", "SPDC_Budget_Arvind 49.xls"),
    path.join(process.cwd(), "..", "..", "module_prompts", "Sharnam_modules_docs 2", "SPDC_Budget_Arvind 49.xls"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function loadSeedModule(): Promise<{
  seedCostFromBudgetWorkbook: (prisma: typeof import("../prisma.js").prisma, projectId: string, excelRoot: string) => Promise<void>;
}> {
  const candidates = [
    path.join(process.cwd(), "seed", "costFromBudget.ts"),
    path.join(process.cwd(), "seed", "costFromBudget.js"),
    path.join(process.cwd(), "..", "..", "seed", "costFromBudget.ts"),
    path.join(process.cwd(), "..", "..", "seed", "costFromBudget.js"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    return import(pathToFileURL(p).href) as any;
  }
  throw new Error("seed/costFromBudget.ts not found");
}

export async function syncBudgetWorkbookTemplate(projectId: string) {
  const file = resolveBudgetWorkbookPath();
  if (!file) throw new Error("SPDC_Budget_Arvind 49.xls not found on server");
  const { seedCostFromBudgetWorkbook } = await loadSeedModule();
  await seedCostFromBudgetWorkbook(prisma, projectId, path.dirname(file));
  const [budget, monitoring, mb, bbs, rates, cashflow] = await Promise.all([
    prisma.costBudgetLine.count({ where: { projectId } }),
    prisma.costMonitoringLine.count({ where: { projectId } }),
    prisma.costMbLine.count({ where: { projectId } }),
    prisma.costBbsLine.count({ where: { projectId } }),
    prisma.costRateDifference.count({ where: { projectId } }),
    prisma.costCashflowPeriod.count({ where: { projectId } }),
  ]);
  return { ok: true as const, source: path.basename(file), budget, monitoring, mb, bbs, rates, cashflow };
}
