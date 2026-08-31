/**
 * Rebuild comparative summary / master BOQ from vendor discipline uploads.
 */
import type { PrismaClient } from "@prisma/client";
import { evaluateAllRows, type SheetCell } from "@sharnam/shared";
import {
  type DisciplineDef,
  type ImportedSheet,
  disciplineCatalogEntry,
  importR2WorkbookFromFile,
  parseDisciplinesJson,
  parseR2SummarySheet,
  type ComparativeSummary,
} from "./comparativeStatement.js";

function numCell(cell?: SheetCell): number {
  const n = Number(cell?.computed ?? cell?.raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cell(v: string | number): SheetCell {
  if (typeof v === "number") return { raw: String(v), computed: v };
  return { raw: String(v ?? "") };
}

/** Sum AMOUNT column (or largest total row) from a vendor discipline BOQ sheet. */
export function sumBoqSheetTotal(headers: string[], rows: SheetCell[][]): number {
  const lower = headers.map((h) => String(h).toLowerCase());
  const amountCol = lower.findIndex((h) => h.includes("amount") && !h.includes("unit"));
  if (amountCol >= 0) {
    let sum = 0;
    for (const row of rows) {
      const n = numCell(row[amountCol]);
      if (n > 0) sum += n;
    }
    if (sum > 0) return sum;
  }

  for (let i = rows.length - 1; i >= 0; i--) {
    const line = rows[i].map((c) => String(c.raw ?? "").toUpperCase()).join(" ");
    if (!line.includes("TOTAL")) continue;
    let max = 0;
    for (const c of rows[i]) {
      const n = numCell(c);
      if (n > max) max = n;
    }
    if (max > 0) return max;
  }

  const rateCol = lower.findIndex((h) => h.includes("rate"));
  const qtyCol = lower.findIndex((h) => h.includes("qty") || h === "quantity");
  if (rateCol >= 0 && qtyCol >= 0) {
    let sum = 0;
    for (const row of rows) {
      const q = numCell(row[qtyCol]);
      const r = numCell(row[rateCol]);
      if (q > 0 && r > 0) sum += q * r;
    }
    if (sum > 0) return sum;
  }

  return 0;
}

/** Clear rate/amount cells so bidders fill their own pricing on the R2 line-item template. */
export function blankVendorRates(sheet: ImportedSheet): ImportedSheet {
  const lower = sheet.headers.map((h) => String(h).toLowerCase());
  const editableCols = new Set<number>();
  for (let i = 0; i < lower.length; i++) {
    if (lower[i].includes("rate") || lower[i].includes("amount")) editableCols.add(i);
  }
  if (!editableCols.size) return sheet;

  const rows = sheet.rows.map((row) =>
    row.map((c, ci) => {
      if (!editableCols.has(ci)) return { ...c };
      if (isFormula(c.raw)) return { ...c };
      return { raw: "" };
    })
  );
  return { headers: sheet.headers, rows: evaluateAllRows(rows), sheetName: sheet.sheetName };
}

function isFormula(raw: string) {
  return String(raw ?? "").trim().startsWith("=");
}

export function buildR2SummarySheet(
  vendorNames: string[],
  disciplines: DisciplineDef[],
  totalsByDiscipline: Record<string, Record<string, number>>
): ImportedSheet {
  const rows: SheetCell[][] = [];
  rows.push([cell("SR NO"), cell("SECTION"), cell("TITLE"), ...vendorNames.map(cell)]);
  rows.push([
    cell(""),
    cell(""),
    cell(""),
    ...vendorNames.map(() => cell("GRAND TOTAL")),
  ]);

  disciplines.forEach((d, idx) => {
    const totals: Record<string, number> = {};
    for (const v of vendorNames) totals[v] = totalsByDiscipline[d.key]?.[v] ?? 0;
    rows.push([
      cell(idx + 1),
      cell(`SECTION — ${d.key}`),
      cell(d.label),
      ...vendorNames.map((v) => cell(totals[v] || 0)),
    ]);
  });

  const grandTotals: Record<string, number> = Object.fromEntries(vendorNames.map((v) => [v, 0]));
  for (const d of disciplines) {
    for (const v of vendorNames) {
      grandTotals[v] += totalsByDiscipline[d.key]?.[v] ?? 0;
    }
  }
  rows.push([
    cell("TOTAL AMOUNT OF TENDER ITEMS"),
    cell(""),
    cell(""),
    ...vendorNames.map((v) => cell(grandTotals[v] || 0)),
  ]);

  return { headers: [], rows, sheetName: "summary" };
}

export function buildMasterCompareSheet(
  vendorNames: string[],
  disciplines: DisciplineDef[],
  totalsByDiscipline: Record<string, Record<string, number>>
): ImportedSheet {
  const headers = [
    "Section",
    "Item code",
    "Description",
    "Unit",
    "Qty",
    ...vendorNames.flatMap((v) => [`${v} — RATE`, `${v} — GRAND TOTAL`]),
    "Lowest",
  ];
  const rows: SheetCell[][] = disciplines.map((d, idx) => {
    const amounts = vendorNames.map((v) => totalsByDiscipline[d.key]?.[v] ?? 0);
    const lowIdx = amounts.reduce((best, val, i) => (val > 0 && val < amounts[best] ? i : best), 0);
    const row: (string | number)[] = [d.key, String(idx + 1), d.label, "LS", 1];
    for (const amt of amounts) {
      row.push(0, amt);
    }
    row.push(vendorNames[lowIdx] || "");
    return row.map(cell);
  });
  return { headers, rows: evaluateAllRows(rows), sheetName: "BOQ" };
}

function parseVendorNames(json: string): string[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function parseRowsJson(json: string): SheetCell[][] {
  try {
    return evaluateAllRows(JSON.parse(json || "[]"));
  } catch {
    return [];
  }
}

export async function ensureVendorBoqTemplateSheets(
  prisma: PrismaClient,
  pkgId: string,
  vendorNames: string[],
  disciplines: DisciplineDef[],
  createdById?: string
) {
  const imported = importR2WorkbookFromFile(undefined, vendorNames);
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: pkgId },
    select: { title: true },
  });
  if (!pkg) return 0;

  const slots = await prisma.crmVendorBoq.findMany({ where: { bidPackageId: pkgId } });
  let created = 0;

  for (const slot of slots) {
    if (slot.sheetId) continue;
    const disc = disciplineCatalogEntry(slot.discipline, disciplines);
    const template = imported.disciplineTemplates[slot.discipline];
    const parsed = template?.rows?.length
      ? blankVendorRates(template)
      : {
          headers: ["Sr. No.", "Description", "QTY.", "UNIT", "RATE", "AMOUNT"],
          rows: [] as SheetCell[][],
          sheetName: disc?.sheetName || slot.discipline,
        };

    const boqSheet = await prisma.customSheet.create({
      data: {
        name: `${slot.vendorLabel} — ${disc?.label || slot.discipline} — ${pkg.title}`,
        category: "CRM Vendor BOQ",
        headersJson: JSON.stringify(parsed.headers),
        rowsJson: JSON.stringify(parsed.rows),
        sourceFile: "Comparative Statement - R2.xlsx (template)",
        createdById,
      },
    });

    await prisma.crmVendorBoq.update({
      where: { id: slot.id },
      data: { sheetId: boqSheet.id },
    });
    created++;
  }

  return created;
}

export async function recomputeBidPackageComparative(
  prisma: PrismaClient,
  pkgId: string
): Promise<{ summary: ComparativeSummary | null; filledSlots: number; totalSlots: number }> {
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: pkgId },
    include: {
      vendorBoqs: { select: { vendorLabel: true, discipline: true, sheetId: true, fileName: true, uploadedAt: true } },
    },
  });
  if (!pkg) throw new Error("bid package not found");

  const vendorNames = parseVendorNames(pkg.vendorNamesJson);
  const disciplines = parseDisciplinesJson(pkg.disciplinesJson);
  const totalsByDiscipline: Record<string, Record<string, number>> = {};

  for (const d of disciplines) totalsByDiscipline[d.key] = {};

  let filledSlots = 0;
  for (const slot of pkg.vendorBoqs) {
    if (!slot.sheetId) continue;
    const sheet = await prisma.customSheet.findUnique({ where: { id: slot.sheetId } });
    if (!sheet) continue;

    const slotRow = slot;

    const headers = JSON.parse(sheet.headersJson || "[]") as string[];
    const rows = parseRowsJson(sheet.rowsJson);
    const total = sumBoqSheetTotal(headers, rows);
    if (total > 0 || slotRow.fileName || slotRow.uploadedAt) filledSlots++;
    totalsByDiscipline[slot.discipline] ||= {};
    totalsByDiscipline[slot.discipline][slot.vendorLabel] = total;
  }

  const summarySheet = buildR2SummarySheet(vendorNames, disciplines, totalsByDiscipline);
  const masterSheet = buildMasterCompareSheet(vendorNames, disciplines, totalsByDiscipline);
  const summary = parseR2SummarySheet([], summarySheet.rows);

  if (pkg.summarySheetId) {
    await prisma.customSheet.update({
      where: { id: pkg.summarySheetId },
      data: { rowsJson: JSON.stringify(summarySheet.rows) },
    });
  }
  if (pkg.comparativeSheetId) {
    await prisma.customSheet.update({
      where: { id: pkg.comparativeSheetId },
      data: {
        headersJson: JSON.stringify(masterSheet.headers),
        rowsJson: JSON.stringify(masterSheet.rows),
      },
    });
  }

  const hasAnyTotal = filledSlots > 0;
  await prisma.crmBidPackage.update({
    where: { id: pkgId },
    data: {
      status: hasAnyTotal && filledSlots >= pkg.vendorBoqs.length
        ? "Evaluation"
        : pkg.status === "Awarded"
          ? "Awarded"
          : pkg.status === "Draft"
            ? "Draft"
            : "Open",
      updatedAt: new Date(),
    },
  });

  return { summary, filledSlots, totalSlots: pkg.vendorBoqs.length };
}

export async function findVendorBoqSlotForSheet(prisma: PrismaClient, sheetId: string, vendorId?: string | null) {
  return prisma.crmVendorBoq.findFirst({
    where: { sheetId, ...(vendorId ? { vendorId } : {}) },
    include: {
      bidPackage: { select: { id: true, title: true, status: true } },
    },
  });
}

export async function vendorCanEditBoqSheet(
  prisma: PrismaClient,
  role: string,
  email: string,
  sheetId: string
): Promise<boolean> {
  if (role === "admin" || role === "office") return true;
  if (role !== "vendor") return false;
  const vendor = await prisma.vendor.findFirst({ where: { email }, select: { id: true } });
  if (!vendor) return false;
  const slot = await findVendorBoqSlotForSheet(prisma, sheetId, vendor.id);
  return !!slot && slot.bidPackage.status !== "Awarded";
}
