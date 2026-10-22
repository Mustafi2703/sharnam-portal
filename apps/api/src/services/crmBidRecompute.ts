/**
 * Rebuild comparative summary / master BOQ from vendor discipline uploads.
 */
import type { PrismaClient } from "@prisma/client";
import { evaluateAllRows, type SheetCell } from "@sharnam/shared";
import {
  type DisciplineDef,
  type ImportedSheet,
  disciplineCatalogEntry,
  loadSampleBoqSheet,
  parseDisciplinesJson,
  parseR2SummarySheet,
  type ComparativeSummary,
} from "./comparativeStatement.js";
import { loadMonitoringBoqTemplate } from "./monitoringBoqTemplate.js";
import { buildPackageComparative, comparativeWorkbook, linesFromSheetCells, type BoqLine } from "./boqCompare.js";

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

export type R2SectionRow = { letter: string; title: string; totals: Record<string, number> };

/** Read SECTION headers and TOTAL OF SECTION rows from an R2 BOQ sheet. */
export function extractBoqSectionTotals(headers: string[], rows: SheetCell[][]): { letter: string; title: string; total: number }[] {
  const lower = headers.map((h) => String(h).toLowerCase());
  const descCol = lower.findIndex((h) => h.includes("desc"));
  const amountCol = lower.findIndex((h) => h.includes("amount") && !h.includes("unit"));
  const descIdx = descCol >= 0 ? descCol : 1;
  const out: { letter: string; title: string; total: number }[] = [];
  let current: { letter: string; title: string } | null = null;

  for (const row of rows) {
    const text = String(row[descIdx]?.raw ?? row[1]?.raw ?? "").trim();
    const upper = text.toUpperCase();
    if (!upper.includes("SECTION")) continue;
    if (upper.includes("TOTAL")) {
      if (!current) continue;
      let total = amountCol >= 0 ? numCell(row[amountCol]) : 0;
      if (!(total > 0)) {
        for (const c of row) total = Math.max(total, numCell(c));
      }
      out.push({ letter: current.letter, title: current.title, total });
      current = null;
      continue;
    }
    const match = upper.match(/SECTION\s*[-–:]?\s*([A-Z])/);
    if (!match) continue;
    const title = text.replace(/^SECTION\s*[-–:]?\s*[A-Z]\s*/i, "").replace(/^[-–:.\s]+/, "").trim();
    current = { letter: match[1], title: title || text };
  }
  return out;
}

export function buildR2SummarySheet(
  vendorNames: string[],
  disciplines: DisciplineDef[],
  totalsByDiscipline: Record<string, Record<string, number>>,
  sections?: R2SectionRow[]
): ImportedSheet {
  const rows: SheetCell[][] = [];
  rows.push([cell("SR NO"), cell("SECTION"), cell("TITLE"), ...vendorNames.map(cell)]);
  rows.push([
    cell(""),
    cell(""),
    cell(""),
    ...vendorNames.map(() => cell("GRAND TOTAL")),
  ]);

  const sectionRows = sections?.length
    ? sections
    : disciplines.map((d) => ({
        letter: d.key,
        title: d.label,
        totals: Object.fromEntries(vendorNames.map((v) => [v, totalsByDiscipline[d.key]?.[v] ?? 0])),
      }));

  sectionRows.forEach((section, idx) => {
    rows.push([
      cell(idx + 1),
      cell(`SECTION : -${section.letter}`),
      cell(section.title),
      ...vendorNames.map((v) => cell(section.totals[v] || 0)),
    ]);
  });

  const grandTotals: Record<string, number> = Object.fromEntries(vendorNames.map((v) => [v, 0]));
  for (const section of sectionRows) {
    for (const v of vendorNames) {
      grandTotals[v] += section.totals[v] ?? 0;
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
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: pkgId },
    select: { title: true, projectId: true },
  });
  if (!pkg) return 0;

  const slots = await prisma.crmVendorBoq.findMany({ where: { bidPackageId: pkgId } });
  let created = 0;

  for (const slot of slots) {
    if (slot.sheetId) continue;
    const disc = disciplineCatalogEntry(slot.discipline, disciplines);
    const sample = loadSampleBoqSheet(slot.discipline, disciplines);
    const fromMonitoring =
      !sample?.rows.length && pkg.projectId
        ? await loadMonitoringBoqTemplate(prisma, pkg.projectId, slot.discipline, disciplines)
        : null;
    const parsed = sample?.rows.length
      ? sample
      : fromMonitoring?.rows?.length
        ? fromMonitoring
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
        sourceFile: sample?.rows.length
          ? "Comparative statement sample BOQ"
          : fromMonitoring?.rows?.length
            ? "Project budget monitoring (SPDC Budget)"
            : "Empty BOQ — vendor upload or online fill",
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
  const sectionMap = new Map<string, R2SectionRow>();

  for (const d of disciplines) totalsByDiscipline[d.key] = {};

  let filledSlots = 0;
  const quoteLines = new Map<string, BoqLine[]>();
  for (const slot of pkg.vendorBoqs) {
    if (!slot.sheetId) continue;
    const sheet = await prisma.customSheet.findUnique({ where: { id: slot.sheetId } });
    if (!sheet) continue;

    const slotRow = slot;

    const headers = JSON.parse(sheet.headersJson || "[]") as string[];
    const rows = parseRowsJson(sheet.rowsJson);
    const discLabel = disciplines.find((d) => d.key === slot.discipline)?.label || slot.discipline;
    const parsedLines = linesFromSheetCells(headers, rows).map((line) => ({
      ...line,
      key: disciplines.length > 1 ? `${slot.discipline}:${line.key}` : line.key,
      section:
        disciplines.length > 1
          ? `${discLabel}${line.section ? ` — ${line.section}` : ""}`
          : line.section || "BOQ",
    }));
    if (parsedLines.length) quoteLines.set(slot.vendorLabel, [...(quoteLines.get(slot.vendorLabel) || []), ...parsedLines]);
    const total = sumBoqSheetTotal(headers, rows);
    if (total > 0 || slotRow.fileName || slotRow.uploadedAt) filledSlots++;
    totalsByDiscipline[slot.discipline] ||= {};
    totalsByDiscipline[slot.discipline][slot.vendorLabel] = total;

    for (const section of extractBoqSectionTotals(headers, rows)) {
      const key = `${slot.discipline}:${section.letter}`;
      const title = disciplines.length > 1 ? `${discLabel} — ${section.title}` : section.title;
      const row = sectionMap.get(key) || { letter: section.letter, title, totals: {} };
      if (title.length > row.title.length) row.title = title;
      row.totals[slot.vendorLabel] = section.total;
      sectionMap.set(key, row);
    }
  }

  const blankByKey = new Map<string, BoqLine>();
  for (const lines of quoteLines.values()) {
    for (const line of lines) {
      if (!blankByKey.has(line.key)) blankByKey.set(line.key, { ...line, rate: null, amount: null });
    }
  }
  const quotedVendors = [
    ...vendorNames.filter((vendor) => quoteLines.has(vendor)),
    ...[...quoteLines.keys()].filter((vendor) => !vendorNames.includes(vendor)),
  ];
  const lineComparative =
    blankByKey.size && quotedVendors.length
      ? buildPackageComparative(
          [...blankByKey.values()],
          quotedVendors.map((vendor) => ({ vendor, lines: quoteLines.get(vendor) || [] })),
        )
      : null;
  const sections = lineComparative?.sectionTotals.length
    ? lineComparative.sectionTotals.map((section, index) => {
        const letter = section.title.match(/SECTION\s*[-–:]?\s*([A-Z])/i)?.[1] || String.fromCharCode(65 + (index % 26));
        const title = section.title.replace(/^SECTION\s*[-–:]?\s*[A-Z]\s*/i, "").trim() || section.title;
        return { letter, title, totals: section.totals };
      })
    : [...sectionMap.values()].sort((a, b) => a.title.localeCompare(b.title) || a.letter.localeCompare(b.letter));
  const summaryVendors = lineComparative?.vendors.length ? lineComparative.vendors : vendorNames;
  const summarySheet = buildR2SummarySheet(summaryVendors, disciplines, totalsByDiscipline, sections);
  const masterSheet = lineComparative?.lines.length
    ? {
        headers: ["Sr. No.", "Description", "QTY.", "UNIT", ...summaryVendors.flatMap((vendor) => [`${vendor} RATE`, `${vendor} GRAND TOTAL`])],
        rows: lineComparative.lines.flatMap((line, index, all) => {
          const previous = all[index - 1];
          const banner =
            line.section && line.section !== previous?.section
              ? [[cell(""), cell(line.section), cell(""), cell(""), ...summaryVendors.flatMap(() => [cell(""), cell("")])]]
              : [];
          const values: (string | number)[] = [line.itemNo, line.description, line.qtyText || line.qty || "", line.unit];
          for (const vendor of summaryVendors) {
            const quote = line.quotes.find((item) => item.vendor === vendor);
            values.push(quote?.rate ?? "", quote?.amount ?? "");
          }
          return [...banner, values.map((value) => cell(typeof value === "number" ? value : String(value)))];
        }),
        sheetName: "BOQ",
      }
    : buildMasterCompareSheet(vendorNames, disciplines, totalsByDiscipline);
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
      comparativeJson: lineComparative ? JSON.stringify(lineComparative) : pkg.comparativeJson,
      updatedAt: new Date(),
    },
  });

  return { summary, filledSlots, totalSlots: pkg.vendorBoqs.length };
}

export async function rebuildPackageBoqComparative(prisma: PrismaClient, pkgId: string) {
  const pkg = await prisma.crmBidPackage.findUnique({
    where: { id: pkgId },
    include: {
      project: { select: { code: true } },
      vendorBoqs: true,
    },
  });
  if (!pkg?.boqLinesJson) return null;
  const blank = JSON.parse(pkg.boqLinesJson) as BoqLine[];
  const quotes = pkg.vendorBoqs
    .filter((slot) => slot.rateLinesJson)
    .map((slot) => ({ vendor: slot.vendorLabel, lines: JSON.parse(slot.rateLinesJson!) as BoqLine[] }));
  const comparative = buildPackageComparative(blank, quotes);
  let sharePointUrl = pkg.comparativeSharePointUrl;
  if (pkg.project?.code && quotes.length) {
    const { CRM_SHAREPOINT, syncBufferToProjectSharePoint } = await import("./crmSharePoint.js");
    const fileName = `${pkg.title.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60)}-Comparative.xlsx`;
    const buffer = await comparativeWorkbook(pkg.title, comparative);
    const saved = await syncBufferToProjectSharePoint(pkg.project.code, CRM_SHAREPOINT.comparative, fileName, buffer, {
      replace: true,
    });
    sharePointUrl = saved.sharePointUrl || sharePointUrl;
    if (saved.sharePointDone) {
      void saved.sharePointDone
        .then(async (sp) => {
          if ("sharePointUrl" in sp && sp.sharePointUrl) {
            await prisma.crmBidPackage.update({
              where: { id: pkg.id },
              data: { comparativeSharePointUrl: sp.sharePointUrl },
            });
          }
        })
        .catch(() => undefined);
    }
  }
  await prisma.crmBidPackage.update({
    where: { id: pkg.id },
    data: {
      comparativeJson: JSON.stringify(comparative),
      comparativeSharePointUrl: sharePointUrl,
    },
  });
  const summary = {
    vendorLabels: comparative.vendors,
    sectionTotals: comparative.sectionTotals,
    grandTotals: comparative.grandTotals,
    lowestVendor: comparative.lowestVendor,
  };
  return {
    summary,
    filledSlots: pkg.vendorBoqs.filter((slot) => slot.fileName || slot.uploadedAt).length,
    totalSlots: pkg.vendorBoqs.length,
  };
}

export async function recomputeAndSyncBidPackage(prisma: PrismaClient, pkgId: string) {
  const head = await prisma.crmBidPackage.findUnique({ where: { id: pkgId }, select: { boqLinesJson: true } });
  if (head?.boqLinesJson) {
    const built = await rebuildPackageBoqComparative(prisma, pkgId);
    if (built) return built;
  }
  const result = await recomputeBidPackageComparative(prisma, pkgId);
  try {
    const { syncBidPackageToSharePoint } = await import("./crmBidSharePointSync.js");
    await syncBidPackageToSharePoint(prisma, pkgId);
  } catch (err) {
    console.warn("[CRM] SharePoint sync after recompute failed:", err instanceof Error ? err.message : err);
  }
  return result;
}

export async function findVendorBoqSlotForSheet(
  prisma: PrismaClient,
  sheetId: string,
  vendor?: { id: string; name: string } | null
) {
  return prisma.crmVendorBoq.findFirst({
    where: vendor
      ? { sheetId, OR: [{ vendorId: vendor.id }, { vendorLabel: vendor.name }] }
      : { sheetId },
    include: {
      bidPackage: { select: { id: true, title: true, status: true } },
    },
  });
}

export async function vendorCanEditBoqSheet(
  prisma: PrismaClient,
  role: string,
  user: { id: string; email: string; role: string; vendorId?: string | null },
  sheetId: string
): Promise<boolean> {
  if (role === "admin" || role === "office") return true;
  if (role !== "vendor") return false;
  const { resolveVendorForUser } = await import("./vendorPortal.js");
  const vendor = await resolveVendorForUser(user, prisma);
  if (!vendor) return false;
  const slot = await findVendorBoqSlotForSheet(prisma, sheetId, vendor);
  return !!slot && slot.bidPackage.status !== "Awarded";
}
