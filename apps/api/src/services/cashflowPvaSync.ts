/**
 * Sync Progress Planned vs Actual cashflow rows → CostCashflowPeriod
 * so WPR cashflow + Cost cashflow stay aligned with the PvsA dashboard.
 * Does not touch COP-* rows (those come from Finance COP sync).
 */
import { prisma } from "../prisma.js";
import { MS_PROJECT_SCURVE_PACKAGE } from "./msProjectSchedule.js";

export async function syncProgressCashflowToCost(projectId: string) {
  const rows = await prisma.progressPlannedActual.findMany({
    where: { projectId, NOT: { packageName: MS_PROJECT_SCURVE_PACKAGE } },
    orderBy: { createdAt: "asc" },
  });

  await prisma.costCashflowPeriod.deleteMany({
    where: {
      projectId,
      packageName: { in: ["PVA", "Progress PvsA", "Planned Vs Actual"] },
    },
  });

  if (!rows.length) return { synced: 0 };

  const data = rows.map((r) => ({
    projectId,
    periodLabel: r.periodLabel,
    periodDate: null as Date | null,
    packageName: r.packageName?.trim() ? `PVA · ${r.packageName}` : "PVA",
    plannedAmount: r.plannedAmount || 0,
    actualAmount: r.actualAmount || 0,
    progressPct:
      r.plannedAmount > 0
        ? (r.actualAmount || 0) / r.plannedAmount
        : r.actualPct || 0,
  }));

  await prisma.costCashflowPeriod.createMany({ data });

  /** Also overlay amounts onto matching Chart / Project cashflow periods by label. */
  const chartRows = await prisma.costCashflowPeriod.findMany({
    where: {
      projectId,
      AND: [
        { packageName: { notIn: ["COP", "COP-week", "COP-day"] } },
        { NOT: { packageName: { startsWith: "PVA" } } },
        {
          OR: [
            { packageName: { contains: "Chart" } },
            { packageName: "Project cashflow" },
            { packageName: { contains: "Cashflow" } },
          ],
        },
      ],
    },
  });

  let overlaid = 0;
  for (const r of rows) {
    const label = (r.periodLabel || "").trim().toLowerCase();
    if (!label) continue;
    const match = chartRows.find((c) => (c.periodLabel || "").trim().toLowerCase() === label);
    if (!match) continue;
    await prisma.costCashflowPeriod.update({
      where: { id: match.id },
      data: {
        plannedAmount: r.plannedAmount || match.plannedAmount,
        actualAmount: r.actualAmount || match.actualAmount,
        progressPct:
          (r.plannedAmount || match.plannedAmount) > 0
            ? (r.actualAmount || match.actualAmount) / (r.plannedAmount || match.plannedAmount)
            : r.actualPct || match.progressPct,
      },
    });
    overlaid += 1;
  }

  return { synced: data.length, overlaid };
}
