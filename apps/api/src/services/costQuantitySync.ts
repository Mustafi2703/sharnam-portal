/**
 * Roll MB measurement quantity and BBS steel weight into Monitoring,
 * then write every derived cost column.
 */
import { prisma } from "../prisma.js";
import { monitoringPackageForBbs, monitoringPackageForMb } from "./costPackageMap.js";
import { assignMbItemCodes, mbItemUnits, normItemNo, rollupMbQtyByItem, type MbRowKind, type ParsedMbLine } from "./costSheetParser.js";
import { deriveMonitoringMetrics } from "./monitoringMetrics.js";

function itemKey(code: string | null | undefined): string | null {
  const k = normItemNo(code);
  return k || null;
}

function unitKey(unit: string | null | undefined): string {
  return String(unit || "").toLowerCase().replace(/[^a-z]/g, "");
}

/** Extra Item rows restart at 1. Match them only to the Extra Items section. */
function lineMatchesItem(line: { itemNo: string | null; section: string | null }, itemNo: string): boolean {
  const code = normItemNo(itemNo);
  const extra = /^E(\d+)$/.exec(code);
  const inExtra = /extra\s*items?/i.test(String(line.section || ""));
  if (extra) return inExtra && normItemNo(line.itemNo) === extra[1];
  if (inExtra) return false;
  return normItemNo(line.itemNo) === code;
}

/** MB total in KG against a monitoring line in MT. */
function convertMbQty(qty: number, mbUnit: string | undefined, monUom: string | null | undefined): number {
  const from = unitKey(mbUnit);
  const to = unitKey(monUom);
  if ((from === "kg" || from === "kgs") && (to === "mt" || to === "ton" || to === "tonne" || to === "tonnes")) {
    return qty / 1000;
  }
  return qty;
}

function asMbLine(row: {
  srNo?: string | null;
  itemCode?: string | null;
  description: string;
  nos1: number;
  nos2: number;
  length: number;
  width: number;
  height: number;
  qty: number;
  unit?: string | null;
  rowKind?: string | null;
  isDeduction?: boolean | null;
}): ParsedMbLine {
  return {
    srNo: row.srNo || undefined,
    itemCode: row.itemCode || undefined,
    description: row.description,
    nos1: row.nos1,
    nos2: row.nos2,
    length: row.length,
    width: row.width,
    height: row.height,
    qty: row.qty,
    unit: row.unit || undefined,
    rowKind: (row.rowKind || "data") as MbRowKind,
    isDeduction: Boolean(row.isDeduction),
  };
}

export type SyncResult = {
  packageName: string;
  monitoringPackage: string;
  linesUpdated: number;
  mbLinesMatched: number;
};

async function rederiveMbCodes(projectId: string, packageName: string) {
  const rows = await prisma.costMbLine.findMany({
    where: { projectId, packageName },
    orderBy: [{ lineIndex: "asc" }, { createdAt: "asc" }],
  });
  const assigned = assignMbItemCodes(rows.map((row) => asMbLine(row)));
  for (let i = 0; i < rows.length; i++) {
    const nextCode = assigned[i]?.itemCode || null;
    const nextDeduction = Boolean(assigned[i]?.isDeduction);
    if ((rows[i]!.itemCode || null) === nextCode && rows[i]!.isDeduction === nextDeduction) continue;
    await prisma.costMbLine.update({
      where: { id: rows[i]!.id },
      data: { itemCode: nextCode, isDeduction: nextDeduction },
    });
  }
  return assigned;
}

async function writeMonitoringQty(
  projectId: string,
  packageName: string,
  itemNo: string,
  achievedQty: number,
  source: "mb" | "bbs",
  bbsSteelMt?: number,
  mbUnit?: string
) {
  const lines = await prisma.costMonitoringLine.findMany({ where: { projectId, packageName } });
  const matches = lines.filter((line) => lineMatchesItem(line, itemNo));
  let updated = 0;
  for (const mon of matches) {
    if (mon.achievedFrom === "override") continue;
    const qty = source === "mb" ? convertMbQty(achievedQty, mbUnit, mon.uom) : achievedQty;
    const metrics = deriveMonitoringMetrics({
      rate: mon.rate,
      boqQty: mon.boqQty,
      extraQty: mon.extraQty,
      gfcQty: mon.gfcQty,
      achievedQty: qty,
      certifiedQty: mon.certifiedQty,
    });
    await prisma.costMonitoringLine.update({
      where: { id: mon.id },
      data: {
        ...metrics,
        achievedQty: qty,
        achievedFrom: source,
        ...(bbsSteelMt != null ? { bbsSteelMt } : {}),
      },
    });
    updated += 1;
  }
  return updated;
}

export async function syncAchievedFromMb(
  projectId: string,
  mbPackageName?: string,
  onlyItem?: string | null
): Promise<SyncResult[]> {
  const packages = mbPackageName
    ? [mbPackageName]
    : (
        await prisma.costMbLine.findMany({
          where: { projectId },
          distinct: ["packageName"],
          select: { packageName: true },
        })
      ).map((row) => row.packageName);

  const results: SyncResult[] = [];
  for (const mbPkg of packages) {
    const lines = await rederiveMbCodes(projectId, mbPkg);
    const parsed = lines as ParsedMbLine[];
    const totals = rollupMbQtyByItem(parsed);
    const units = mbItemUnits(parsed);
    const monPkg = monitoringPackageForMb(mbPkg);
    let linesUpdated = 0;
    let mbLinesMatched = 0;
    for (const [code, qty] of totals) {
      if (onlyItem && normItemNo(onlyItem) !== normItemNo(code)) continue;
      mbLinesMatched += 1;
      linesUpdated += await writeMonitoringQty(projectId, monPkg, code, qty, "mb", undefined, units.get(code));
    }
    results.push({ packageName: mbPkg, monitoringPackage: monPkg, linesUpdated, mbLinesMatched });
  }
  return results;
}

/** Rederive the package, then update only the monitoring items this line affects. */
export async function syncEditedMbLine(
  projectId: string,
  packageName: string,
  lineId: string | null,
  previousItem: string | null
) {
  await rederiveMbCodes(projectId, packageName);
  const fresh = lineId ? await prisma.costMbLine.findFirst({ where: { id: lineId, projectId } }) : null;
  const codes = new Set(
    [previousItem, fresh?.itemCode].map((code) => itemKey(code)).filter((code): code is string => Boolean(code))
  );
  if (!codes.size) return syncAchievedFromMb(projectId, packageName);
  const lines = (await prisma.costMbLine.findMany({ where: { projectId, packageName } })).map((row) => asMbLine(row));
  const totals = rollupMbQtyByItem(lines);
  const units = mbItemUnits(lines);
  const monPkg = monitoringPackageForMb(packageName);
  let linesUpdated = 0;
  for (const code of codes) {
    linesUpdated += await writeMonitoringQty(projectId, monPkg, code, totals.get(code) || 0, "mb", undefined, units.get(code));
  }
  return [{ packageName, monitoringPackage: monPkg, linesUpdated, mbLinesMatched: codes.size }];
}

function isReinforcement(description: string, uom: string | null | undefined): boolean {
  return /reinforcement/i.test(description) && /m\.?\s*t|mt|ton/i.test(String(uom || ""));
}

export async function syncSteelFromBbs(projectId: string, bbsPackageName?: string) {
  const packages = bbsPackageName
    ? [bbsPackageName]
    : (
        await prisma.costBbsLine.findMany({
          where: { projectId },
          distinct: ["packageName"],
          select: { packageName: true },
        })
      ).map((row) => row.packageName);

  const updated: { packageName: string; itemNo: string; mt: number }[] = [];
  for (const bbsPkg of packages) {
    const monPkg = monitoringPackageForBbs(bbsPkg);
    const [bars, maps, monitoring] = await Promise.all([
      prisma.costBbsLine.findMany({ where: { projectId, packageName: bbsPkg } }),
      prisma.costBbsItemMap.findMany({ where: { projectId, packageName: bbsPkg } }),
      prisma.costMonitoringLine.findMany({ where: { projectId, packageName: monPkg } }),
    ]);
    const suggestions = monitoring.filter((line) => isReinforcement(line.description, line.uom) && line.itemNo);
    const explicitDefault = maps.find((map) => !map.sectionMark && !map.locationPattern)?.monitoringItemNo;
    const fallback = explicitDefault || suggestions[0]?.itemNo || null;
    const byItem = new Map<string, number>();
    for (const bar of bars) {
      if (bar.rowKind && bar.rowKind !== "data") continue;
      if (bar.sourceError) continue;
      const weight = Number(bar.weightKg) || 0;
      if (!weight) continue;
      const mapped = maps.find((map) => {
        if (map.sectionMark && map.sectionMark !== (bar.sectionMark || "")) return false;
        if (map.locationPattern) {
          const loc = bar.location || "";
          try {
            if (!new RegExp(map.locationPattern, "i").test(loc)) return false;
          } catch {
            if (!loc.toLowerCase().includes(map.locationPattern.toLowerCase())) return false;
          }
        }
        return Boolean(map.sectionMark || map.locationPattern);
      });
      const itemNo = mapped?.monitoringItemNo || bar.itemCode || fallback;
      if (!itemNo) continue;
      byItem.set(itemNo, (byItem.get(itemNo) || 0) + weight);
    }
    for (const [itemNo, kg] of byItem) {
      const mt = Math.round((kg / 1000) * 1000) / 1000;
      await writeMonitoringQty(projectId, monPkg, itemNo, mt, "bbs", mt);
      updated.push({ packageName: monPkg, itemNo, mt });
    }
  }
  return updated;
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
    const code = (line.shapeCode || "").toUpperCase();
    const master = code ? masterByCode.get(code) : undefined;
    if (!master?.diagramPath) continue;
    if (line.shapeDiagramPath === master.diagramPath) continue;
    await prisma.costBbsLine.update({
      where: { id: line.id },
      data: { shapeDiagramPath: master.diagramPath, shapeDiagramUrl: master.diagramUrl },
    });
    applied++;
  }
  return { applied, masters: masters.length };
}
