/**
 * Roll up MB measurement qty → BOQ monitoring achievedQty (by item code).
 * GFC qty is never overwritten — only achieved is updated from MB totals.
 */
import { prisma } from "../prisma.js";
import { monitoringPackageForMb } from "./costPackageMap.js";

function itemKey(code: string | null | undefined, srNo: string | null | undefined): string | null {
  const k = String(code || srNo || "").trim();
  return k || null;
}

export type SyncResult = {
  packageName: string;
  monitoringPackage: string;
  linesUpdated: number;
  mbLinesMatched: number;
};

export async function syncAchievedFromMb(
  projectId: string,
  mbPackageName?: string
): Promise<SyncResult[]> {
  const mbWhere = { projectId, ...(mbPackageName ? { packageName: mbPackageName } : {}) };
  const mbLines = await prisma.costMbLine.findMany({ where: mbWhere });

  const byPackage = new Map<string, Map<string, number>>();
  for (const line of mbLines) {
    const key = itemKey(line.itemCode, line.srNo);
    if (!key || !line.qty) continue;
    if (!byPackage.has(line.packageName)) byPackage.set(line.packageName, new Map());
    const bucket = byPackage.get(line.packageName)!;
    bucket.set(key, (bucket.get(key) || 0) + line.qty);
  }

  const results: SyncResult[] = [];
  for (const [mbPkg, totals] of byPackage) {
    const monPkg = monitoringPackageForMb(mbPkg);
    let linesUpdated = 0;
    let mbLinesMatched = 0;

    for (const [code, qty] of totals) {
      mbLinesMatched++;
      const monLines = await prisma.costMonitoringLine.findMany({
        where: { projectId, packageName: monPkg, itemNo: code },
      });
      for (const mon of monLines) {
        const gfcQty = mon.gfcQty;
        await prisma.costMonitoringLine.update({
          where: { id: mon.id },
          data: {
            achievedQty: qty,
            excessQty: Math.max(0, gfcQty - mon.boqQty),
            savingQty: Math.max(0, mon.boqQty - gfcQty),
          },
        });
        linesUpdated++;
      }
    }

    results.push({
      packageName: mbPkg,
      monitoringPackage: monPkg,
      linesUpdated,
      mbLinesMatched,
    });
  }

  return results;
}

/** Copy global shape master diagram onto project BBS rows matching shapeCode. */
export async function applyShapeMastersToBbs(projectId: string, packageName?: string) {
  const masters = await prisma.bbsShapeMaster.findMany();
  const masterByCode = new Map(masters.map((m) => [m.shapeCode.toUpperCase(), m]));
  const lines = await prisma.costBbsLine.findMany({
    where: { projectId, ...(packageName ? { packageName } : {}) },
  });

  let applied = 0;
  for (const line of lines) {
    const code = String(line.shapeCode || line.barMark || "").trim();
    if (!code) continue;
    const master = masterByCode.get(code.toUpperCase());
    if (!master?.diagramPath && !master?.diagramUrl) continue;
    await prisma.costBbsLine.update({
      where: { id: line.id },
      data: {
        shapeCode: master.shapeCode,
        shapeDiagramPath: master.diagramPath,
        shapeDiagramUrl: master.diagramUrl,
        shape: master.name || line.shape,
      },
    });
    applied++;
  }
  return applied;
}
