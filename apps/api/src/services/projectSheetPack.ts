/**
 * Provision SPDC Excel formats onto a project: Cost, Quality, Safety, Progress.
 * Idempotent — skips a layer when it already has enough rows unless `force`.
 */
import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { resolveExcelRoot } from "../lib/excelRoot.js";
import { verifyPackCompleteness } from "./packCompleteness.js";
import { MS_PROJECT_SCURVE_PACKAGE, MS_PROJECT_SOURCE } from "./msProjectSchedule.js";

export type PackStep = {
  key: string;
  layer: "cost" | "quality" | "safety" | "progress";
  ok: boolean;
  skipped?: boolean;
  count?: number;
  error?: string;
};

function firstExisting(root: string, names: string[]) {
  for (const name of names) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function resolvePlannedActualPath(): string | null {
  return firstExisting(resolveExcelRoot(), [
    "Planned Vs. Actual Dashboard (1).xlsx",
    "Planned Vs. Actual Dashboard.xlsx",
  ]);
}

export async function syncProgressTemplates(projectId: string, opts?: { force?: boolean }) {
  const file = resolvePlannedActualPath();
  let cashflow = 0;
  let manpower = 0;
  let activityLines = 0;
  if (file) {
    const { importPlannedActualDashboard } = await import("./plannedActualDashboard.js");
    if (opts?.force) {
      await prisma.progressPlannedActual.deleteMany({
        where: { projectId, NOT: { packageName: MS_PROJECT_SCURVE_PACKAGE } },
      });
      await prisma.progressManpower.deleteMany({ where: { projectId } });
      await prisma.progressActivityLine.deleteMany({
        where: { projectId, NOT: { status: MS_PROJECT_SOURCE } },
      });
    }
    const counts = await importPlannedActualDashboard(projectId, fs.readFileSync(file));
    cashflow = counts.cashflow;
    manpower = counts.manpower;
    activityLines = counts.activityLines;
    const { syncProgressCashflowToCost } = await import("./cashflowPvaSync.js");
    await syncProgressCashflowToCost(projectId);
  }
  let sor = 0;
  try {
    const { resyncProgressSorStats } = await import("./progressSorParse.js");
    sor = (await resyncProgressSorStats(projectId)).length;
  } catch {
    /* optional monthly pack */
  }
  let registers: Awaited<ReturnType<typeof import("./progressRegistersImport.js").syncProgressRegisterPack>> | null =
    null;
  try {
    const { syncProgressRegisterPack } = await import("./progressRegistersImport.js");
    registers = await syncProgressRegisterPack(projectId, opts);
  } catch {
    /* optional register packs */
  }
  return { cashflow, manpower, activityLines, sor, registers, file: file ? path.basename(file) : null };
}

export async function provisionProjectSheetPack(
  projectId: string,
  userId: string,
  opts?: { force?: boolean }
) {
  const force = Boolean(opts?.force);
  const steps: PackStep[] = [];

  const [monitoring, qap, cube, hira, activity, milestones, hindrance] = await Promise.all([
    prisma.costMonitoringLine.count({ where: { projectId } }),
    prisma.qapActivity.count({ where: { projectId } }),
    prisma.cubeTest.count({ where: { projectId } }),
    prisma.safetyRecord.count({ where: { projectId, recordType: "JHA" } }),
    prisma.progressActivityLine.count({ where: { projectId } }),
    prisma.progressMilestone.count({ where: { projectId } }),
    prisma.progressHindrance.count({ where: { projectId } }),
  ]);

  async function step(
    key: PackStep["key"],
    layer: PackStep["layer"],
    skip: boolean,
    run: () => Promise<number | undefined>
  ) {
    if (skip && !force) {
      steps.push({ key, layer, ok: true, skipped: true });
      return;
    }
    try {
      const count = await run();
      steps.push({ key, layer, ok: true, count });
    } catch (err) {
      steps.push({
        key,
        layer,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await step("cost", "cost", monitoring >= 10, async () => {
    const { syncBudgetWorkbookTemplate } = await import("./budgetWorkbookImport.js");
    const out = await syncBudgetWorkbookTemplate(projectId);
    return (out as { monitoring?: number }).monitoring ?? 0;
  });

  await step("qap", "quality", qap >= 10, async () => {
    const { importQapWorkbook, resolveQapWeek50Path } = await import("./qapImportExport.js");
    const file = resolveQapWeek50Path();
    if (!file) throw new Error("Quality Assurance Plan Week 50.xlsx not found");
    const out = await importQapWorkbook(projectId, fs.readFileSync(file), true);
    return (out as { imported?: number }).imported ?? 0;
  });

  await step("cube", "quality", cube >= 1, async () => {
    const { importCubeRegisterWorkbook, resolveCubeRegisterPath } = await import("./cubeRegisterImport.js");
    const file = resolveCubeRegisterPath();
    if (!file) throw new Error("SPDC CUBE REGISTER not found");
    const out = await importCubeRegisterWorkbook(projectId, fs.readFileSync(file), true);
    return (out as { imported?: number }).imported ?? 0;
  });

  await step("catalog", "quality", false, async () => {
    const { syncQualityChecklistCatalog } = await import("./qualityChecklistCatalog.js");
    const out = await syncQualityChecklistCatalog(projectId);
    return (out as { assigned?: number }).assigned ?? 0;
  });

  await step("hira", "safety", hira >= 1, async () => {
    const { syncHiraFromTemplate } = await import("./hiraRegister.js");
    const out = await syncHiraFromTemplate(projectId, userId);
    return (out as { imported?: number }).imported ?? 0;
  });

  await step("progress", "progress", activity >= 5, async () => {
    const out = await syncProgressTemplates(projectId);
    return out.activityLines;
  });

  await step("milestones", "progress", milestones >= 5, async () => {
    const { syncMilestonesFromTemplate } = await import("./progressRegistersImport.js");
    const out = await syncMilestonesFromTemplate(projectId, { force });
    return out.imported;
  });

  await step("hindrance", "progress", hindrance >= 1, async () => {
    const { syncHindranceFromTemplate } = await import("./progressRegistersImport.js");
    const out = await syncHindranceFromTemplate(projectId, { force });
    return out.imported;
  });

  await step("risk-legal", "progress", false, async () => {
    const { syncRiskFromTemplate, syncLegalFromTemplate } = await import("./progressRegistersImport.js");
    const risk = await syncRiskFromTemplate(projectId, { force });
    const legal = await syncLegalFromTemplate(projectId, { force });
    return (risk.imported || 0) + (legal.imported || 0);
  });

  const pack = await verifyPackCompleteness(projectId);
  return { steps, pack };
}
