/**
 * Build CRM vendor BOQ sheets from project Cost → Monitoring (SPDC budget import).
 * One discipline = one BOQ file: sections, item no, description, UOM, BOQ qty from monitoring;
 * vendors fill RATE only; comparative totals use qty × vendor rate.
 */
import type { PrismaClient } from "@prisma/client";
import { evaluateAllRows, type SheetCell } from "@sharnam/shared";
import {
  blankVendorRates,
  disciplineCatalogEntry,
  type DisciplineDef,
  type ImportedSheet,
} from "./comparativeStatement.js";

const DISCIPLINE_MONITORING_HINTS: Record<string, string[]> = {
  CCV: ["civil", "dormitory", "combined", "ccv", "structural", "main contractor"],
  ELE_LAB: ["electric", "electrical", "ele", "lab"],
  ADMIN: ["admin", "furniture", "office", "building"],
  SECURITY: ["security", "cctv", "fire alarm", "fire fighting"],
  COOLING_TOWER: ["cooling", "hvac", "tower"],
  WEIGH_BRIDGE: ["weigh", "bridge"],
  UG_TANK: ["ugwt", "ug tank", "pump", "septic", "plumbing", "tank"],
  ENTRANCE_GATE: ["gate", "entrance", "peb", "compound", "wpc door"],
};

function cell(v: string | number): SheetCell {
  return { raw: String(v ?? "") };
}

function numCell(v: number): SheetCell {
  if (!v) return cell("");
  return { raw: String(v) };
}

/** Match monitoring packageName(s) for an R2 / work-package discipline. */
export function resolveMonitoringPackageNames(discipline: DisciplineDef, availablePackages: string[]): string[] {
  if (!availablePackages.length) return [];
  const label = discipline.label.toLowerCase();
  const keySlug = discipline.key.toLowerCase().replace(/_/g, " ");
  const hints = DISCIPLINE_MONITORING_HINTS[discipline.key] || [];

  const scored = availablePackages
    .map((pkg) => {
      const p = pkg.toLowerCase();
      let score = 0;
      if (p === label) score += 100;
      if (p.includes(label) || label.includes(p)) score += 40;
      if (p.includes(keySlug) || p.includes(discipline.key.toLowerCase())) score += 30;
      for (const h of hints) {
        if (p.includes(h)) score += 15;
      }
      return { pkg, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length) return scored.map((x) => x.pkg);

  const exact = availablePackages.find((p) => p.toLowerCase() === label);
  return exact ? [exact] : [];
}

export async function listProjectMonitoringPackages(prisma: PrismaClient, projectId: string): Promise<string[]> {
  const groups = await prisma.costMonitoringLine.groupBy({
    by: ["packageName"],
    where: { projectId, packageName: { not: "Cashflow Dashboard Monitoring" } },
    _count: true,
  });
  return groups.map((g) => g.packageName).filter(Boolean);
}

/** Monitoring lines → R2 vendor BOQ grid (qty/UOM/description locked; rate blank for bidders). */
export async function loadMonitoringBoqTemplate(
  prisma: PrismaClient,
  projectId: string,
  disciplineKey: string,
  disciplines?: DisciplineDef[],
  opts?: { blankRates?: boolean }
): Promise<ImportedSheet | null> {
  const disc =
    disciplineCatalogEntry(disciplineKey, disciplines) ||
    ({ key: disciplineKey, label: disciplineKey, sheetName: disciplineKey } satisfies DisciplineDef);

  const pkgNames = await listProjectMonitoringPackages(prisma, projectId);
  const targetPkgs = resolveMonitoringPackageNames(disc, pkgNames);
  if (!targetPkgs.length) return null;

  const lines = await prisma.costMonitoringLine.findMany({
    where: { projectId, packageName: { in: targetPkgs } },
    orderBy: [{ packageName: "asc" }, { createdAt: "asc" }],
  });
  if (!lines.length) return null;

  const headers = ["Sr. No.", "Description", "QTY.", "UNIT", "RATE", "AMOUNT"];
  const rows: SheetCell[][] = [];
  let lastSection: string | null = null;
  let sr = 0;

  for (const line of lines) {
    const section = line.section?.trim() || null;
    if (section && section !== lastSection) {
      lastSection = section;
      rows.push([cell(""), cell(section), cell(""), cell(""), cell(""), cell("")]);
    }

    const hasItem = Boolean(line.itemNo?.trim()) || line.boqQty > 0 || Boolean(line.uom?.trim());
    if (!hasItem) {
      if (line.description?.trim() && !section) {
        rows.push([cell(""), cell(line.description), cell(""), cell(""), cell(""), cell("")]);
      }
      continue;
    }

    sr += 1;
    const qty = line.boqQty || 0;
    const budgetRate = line.rate || 0;
    const srLabel = line.itemNo?.trim() || String(sr);
    const excelRow = rows.length + 2;
    rows.push([
      cell(srLabel),
      cell(line.description),
      numCell(qty),
      cell(line.uom || ""),
      opts?.blankRates === false ? numCell(budgetRate) : cell(""),
      cell(`=C${excelRow}*E${excelRow}`),
    ]);
  }

  if (!rows.length) return null;

  const sheet: ImportedSheet = {
    headers,
    rows: evaluateAllRows(rows),
    sheetName: disc.sheetName,
  };
  return opts?.blankRates === false ? sheet : blankVendorRates(sheet);
}
