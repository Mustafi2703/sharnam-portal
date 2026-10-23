/**
 * Re-derive MB item codes and deduction flags from line order.
 * Dry run unless --apply. Does not run unless you pass that flag.
 *
 *   npx tsx scripts/backfill-mb-item-codes.mts
 *   npx tsx scripts/backfill-mb-item-codes.mts --apply
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import { assignMbItemCodes, type MbRowKind } from "../apps/api/src/services/costSheetParser.ts";
import { syncAchievedFromMb, syncSteelFromBbs } from "../apps/api/src/services/costQuantitySync.ts";

applyDatabaseUrl();
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, code: true } });
  for (const project of projects) {
    const packages = await prisma.costMbLine.findMany({
      where: { projectId: project.id },
      distinct: ["packageName"],
      select: { packageName: true },
    });
    let changed = 0;
    for (const pkg of packages) {
      const rows = await prisma.costMbLine.findMany({
        where: { projectId: project.id, packageName: pkg.packageName },
        orderBy: [{ lineIndex: "asc" }, { createdAt: "asc" }],
      });
      const assigned = assignMbItemCodes(
        rows.map((row) => ({
          srNo: row.srNo || undefined,
          itemCode: row.itemCode || undefined,
          description: row.description,
          nos1: row.nos1,
          nos2: row.nos2,
          length: row.length,
          width: row.width,
          height: row.height,
          qty: row.qty,
          rowKind: (row.rowKind || "data") as MbRowKind,
        }))
      );
      for (let i = 0; i < rows.length; i++) {
        const nextCode = assigned[i]?.itemCode || null;
        const nextDeduction = Boolean(assigned[i]?.isDeduction);
        if ((rows[i]!.itemCode || null) === nextCode && rows[i]!.isDeduction === nextDeduction) continue;
        changed += 1;
        if (apply) {
          await prisma.costMbLine.update({
            where: { id: rows[i]!.id },
            data: { itemCode: nextCode, isDeduction: nextDeduction },
          });
        }
      }
    }
    console.log(`${project.code}: ${changed} MB rows ${apply ? "updated" : "would change"}`);
    if (apply && changed) {
      await syncAchievedFromMb(project.id);
      await syncSteelFromBbs(project.id);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
