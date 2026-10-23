/**
 * One physical progress figure for Progress, Cost, DPR and WPR.
 * physicalPct = sum(achieved cost) / sum(GFC cost, or BOQ cost when GFC is 0).
 * plannedPct is the cashflow S-curve up to the date. spi = physical / planned.
 * schedulePct is the weighted milestone percent and is not the physical figure.
 */
import { PHYSICAL_PROGRESS_METHOD, asFraction } from "@sharnam/shared";
import { prisma } from "../prisma.js";

export type ProjectProgress = {
  physicalPct: number;
  plannedPct: number;
  schedulePct: number;
  spi: number;
  method: string;
};

function periodDate(label: string): Date | null {
  const text = label.trim();
  const year = text.match(/\b(19|20)\d{2}\b/);
  const month = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (!year || !month) return null;
  const d = new Date(`${month[1]} 1, ${year[0]}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function projectProgress(projectId: string, asOf = new Date()): Promise<ProjectProgress> {
  const [lines, periods, milestones] = await Promise.all([
    prisma.costMonitoringLine.findMany({
      where: { projectId },
      select: { achievedCost: true, gfcCost: true, boqCost: true },
    }),
    prisma.costCashflowPeriod.findMany({
      where: { projectId, packageName: { contains: "Chart" } },
    }),
    prisma.progressMilestone.findMany({
      where: { projectId },
      select: { weightage: true, pctComplete: true },
    }),
  ]);

  let numer = 0;
  let denom = 0;
  for (const line of lines) {
    const base = line.gfcCost > 0 ? line.gfcCost : line.boqCost;
    if (base <= 0) continue;
    denom += base;
    numer += line.achievedCost || 0;
  }
  const physicalPct = denom > 0 ? numer / denom : 0;

  let plannedToDate = 0;
  let plannedTotal = 0;
  for (const period of periods) {
    plannedTotal += period.plannedAmount || 0;
    const when = periodDate(period.periodLabel);
    if (!when || when <= asOf) plannedToDate += period.plannedAmount || 0;
  }
  const plannedPct = plannedTotal > 0 ? plannedToDate / plannedTotal : 0;

  const weight = milestones.reduce((sum, row) => sum + (row.weightage || 0), 0);
  const schedulePct =
    weight > 0
      ? milestones.reduce((sum, row) => sum + (row.weightage || 0) * asFraction(row.pctComplete), 0) / weight
      : 0;

  return {
    physicalPct,
    plannedPct,
    schedulePct,
    spi: plannedPct > 0 ? physicalPct / plannedPct : 0,
    method: PHYSICAL_PROGRESS_METHOD,
  };
}
