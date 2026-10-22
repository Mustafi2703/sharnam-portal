/**
 * Package BOQ comparative.
 * Columns come from the uploaded sheet (item, description, qty, unit, rate, amount).
 * Contractor names come from who uploaded a priced copy. No R1 or R2 labels.
 */
import XLSX from "../lib/xlsx.js";

export type BoqLine = {
  key: string;
  itemNo: string;
  description: string;
  qty: number | null;
  qtyText: string;
  unit: string;
  rate: number | null;
  amount: number | null;
  section: string;
};

export type ComparativeLine = {
  key: string;
  itemNo: string;
  description: string;
  qty: number | null;
  qtyText: string;
  unit: string;
  section: string;
  quotes: { vendor: string; rate: number | null; amount: number | null }[];
};

export type PackageComparative = {
  vendors: string[];
  lines: ComparativeLine[];
  sectionTotals: { section: string; title: string; totals: Record<string, number> }[];
  grandTotals: Record<string, number>;
  lowestVendor?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null) return null;
  const raw = String(v).replace(/,/g, "").trim();
  if (!raw || !/\d/.test(raw)) return null;
  const n = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function text(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function sheetRows(buffer: Buffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const name = wb.SheetNames.find((n) => /boq/i.test(n)) || wb.SheetNames[0];
  if (!name) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" }) as unknown[][];
  return rows.filter((row) => row.some((cell) => text(cell)));
}

function headerIndex(row: unknown[]) {
  const cells = row.map((c) => norm(text(c)));
  const find = (...needles: string[]) => cells.findIndex((c) => needles.some((n) => c.includes(n)));
  return {
    item: find("sr", "item", "s no", "sl"),
    description: find("desc"),
    qty: find("qty", "quantity"),
    unit: find("unit"),
    rate: find("rate"),
    amount: find("amount", "grand total"),
  };
}

/** Read BOQ rows. The first matching header row may sit below a title. Rate and amount may be blank. */
export function parseBoqRows(rows: unknown[][]): BoqLine[] {
  let headerAt = -1;
  let cols = headerIndex([]);
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const hit = headerIndex(rows[i]);
    if (hit.description >= 0 && (hit.qty >= 0 || hit.unit >= 0)) {
      headerAt = i;
      cols = hit;
      const next = rows[i + 1] ? headerIndex(rows[i + 1]) : null;
      if (next && cols.rate < 0 && next.rate >= 0) cols.rate = next.rate;
      if (next && cols.amount < 0 && next.amount >= 0) cols.amount = next.amount;
      break;
    }
  }
  if (headerAt < 0) throw new Error("The BOQ needs a Description column and a Qty or Unit column.");
  const lines: BoqLine[] = [];
  let section = "";
  for (const row of rows.slice(headerAt + 1)) {
    const description = cols.description >= 0 ? text(row[cols.description]) : "";
    const itemNo = cols.item >= 0 ? text(row[cols.item]) : "";
    const qtyText = cols.qty >= 0 ? text(row[cols.qty]) : "";
    const unit = cols.unit >= 0 ? text(row[cols.unit]) : "";
    const rate = cols.rate >= 0 ? num(row[cols.rate]) : null;
    const amount = cols.amount >= 0 ? num(row[cols.amount]) : null;
    if (!description && !itemNo) continue;
    if (/^rate$|^amount$|^grand total$/i.test(description)) continue;
    const qty = num(qtyText);
    const looksLikeSection = !itemNo && !qty && !unit && description.length < 80 && !rate;
    if (looksLikeSection) {
      section = description;
      continue;
    }
    if (!description) continue;
    const key = norm(itemNo || description).slice(0, 80);
    if (!key) continue;
    lines.push({
      key,
      itemNo,
      description,
      qty,
      qtyText,
      unit,
      rate,
      amount: amount ?? (qty != null && rate != null ? Math.round(qty * rate * 100) / 100 : null),
      section,
    });
  }
  if (!lines.length) throw new Error("No BOQ lines were found under the header.");
  return lines;
}

/** Read a BOQ sheet. Rate and amount may be blank. */
export function parseBoqBuffer(buffer: Buffer): BoqLine[] {
  return parseBoqRows(sheetRows(buffer));
}

export function linesFromSheetCells(
  headers: string[],
  rows: { raw?: string | null; computed?: string | number | null }[][],
): BoqLine[] {
  const grid = [headers, ...rows.map((row) => headers.map((_, i) => row[i]?.computed ?? row[i]?.raw ?? ""))];
  try {
    return parseBoqRows(grid);
  } catch {
    return [];
  }
}

export function quoteByKey(lines: BoqLine[]) {
  const map = new Map<string, BoqLine>();
  for (const line of lines) {
    map.set(line.key, line);
    const desc = norm(line.description);
    if (desc && !map.has(desc)) map.set(desc, line);
  }
  return map;
}

export function buildPackageComparative(
  blank: BoqLine[],
  quotes: { vendor: string; lines: BoqLine[] }[],
): PackageComparative {
  const vendors = quotes.map((q) => q.vendor);
  const lookups = quotes.map((q) => ({ vendor: q.vendor, map: quoteByKey(q.lines) }));
  const lines: ComparativeLine[] = blank.map((base) => ({
    key: base.key,
    itemNo: base.itemNo,
    description: base.description,
    qty: base.qty,
    qtyText: base.qtyText,
    unit: base.unit,
    section: base.section,
    quotes: lookups.map((q) => {
      const hit = q.map.get(base.key) || q.map.get(norm(base.description));
      const rate = hit?.rate ?? null;
      const amount =
        hit?.amount ?? (base.qty != null && rate != null ? Math.round(base.qty * rate * 100) / 100 : null);
      return { vendor: q.vendor, rate, amount };
    }),
  }));
  const grandTotals: Record<string, number> = {};
  for (const vendor of vendors) grandTotals[vendor] = 0;
  const sections = new Map<string, { section: string; title: string; totals: Record<string, number> }>();
  for (const line of lines) {
    const title = line.section || "BOQ";
    const row = sections.get(title) || { section: title, title, totals: Object.fromEntries(vendors.map((v) => [v, 0])) };
    for (const quote of line.quotes) {
      const add = quote.amount || 0;
      row.totals[quote.vendor] = (row.totals[quote.vendor] || 0) + add;
      grandTotals[quote.vendor] = (grandTotals[quote.vendor] || 0) + add;
    }
    sections.set(title, row);
  }
  const ranked = vendors.filter((v) => grandTotals[v] > 0).sort((a, b) => grandTotals[a] - grandTotals[b]);
  return {
    vendors,
    lines,
    sectionTotals: [...sections.values()],
    grandTotals,
    lowestVendor: ranked[0],
  };
}

export async function blankBoqWorkbook(title: string, lines: BoqLine[]): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BOQ");
  ws.addRow([title]);
  ws.addRow(["Fill Rate and Amount. Do not change the item number or description."]);
  ws.addRow([]);
  ws.addRow(["Sr. No.", "Description", "Qty", "Unit", "Rate", "Amount"]);
  ws.getRow(4).font = { bold: true };
  let section = "";
  for (const line of lines) {
    if (line.section && line.section !== section) {
      section = line.section;
      ws.addRow(["", section, "", "", "", ""]);
    }
    ws.addRow([line.itemNo, line.description, line.qtyText || line.qty || "", line.unit, "", ""]);
  }
  ws.columns = [{ width: 14 }, { width: 62 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 16 }];
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function comparativeWorkbook(title: string, comparative: PackageComparative): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet("summary");
  summary.addRow([title]);
  summary.addRow(["SR NO", "SECTION", "TITLE", ...comparative.vendors]);
  summary.addRow(["", "", "", ...comparative.vendors.map(() => "GRAND TOTAL")]);
  comparative.sectionTotals.forEach((section, index) => {
    const letter = section.title.match(/SECTION\s*[-–:]?\s*([A-Z])/i)?.[1] || String.fromCharCode(65 + (index % 26));
    const titleText = section.title.replace(/^SECTION\s*[-–:]?\s*[A-Z]\s*/i, "").trim() || section.title;
    summary.addRow([
      index + 1,
      `SECTION : -${letter}`,
      titleText,
      ...comparative.vendors.map((vendor) => Math.round((section.totals[vendor] || 0) * 100) / 100),
    ]);
  });
  const total = summary.addRow([
    "TOTAL AMOUNT OF TENDER ITEMS",
    "",
    "",
    ...comparative.vendors.map((vendor) => Math.round((comparative.grandTotals[vendor] || 0) * 100) / 100),
  ]);
  total.font = { bold: true };
  summary.getRow(2).font = { bold: true };
  summary.getColumn(3).width = 42;

  const boq = wb.addWorksheet("BOQ");
  const head = ["Sr. No.", "Description", "QTY.", "UNIT"];
  const sub = ["", "", "", ""];
  for (const vendor of comparative.vendors) {
    head.push(vendor, "");
    sub.push("RATE", "GRAND TOTAL");
  }
  boq.addRow(head);
  boq.addRow(sub);
  boq.getRow(1).font = { bold: true };
  boq.getRow(2).font = { bold: true };
  let section = "";
  for (const line of comparative.lines) {
    if (line.section && line.section !== section) {
      section = line.section;
      boq.addRow(["", section, "", "", ...comparative.vendors.flatMap(() => ["", ""])]);
    }
    const row: (string | number)[] = [line.itemNo, line.description, line.qtyText || line.qty || "", line.unit];
    for (const vendor of comparative.vendors) {
      const quote = line.quotes.find((item) => item.vendor === vendor);
      row.push(quote?.rate ?? "", quote?.amount ?? "");
    }
    boq.addRow(row);
  }
  const grand: (string | number)[] = ["", "TOTAL AMOUNT OF TENDER ITEMS", "", ""];
  for (const vendor of comparative.vendors) {
    grand.push("", Math.round((comparative.grandTotals[vendor] || 0) * 100) / 100);
  }
  const grandRow = boq.addRow(grand);
  grandRow.font = { bold: true };
  boq.getColumn(2).width = 62;
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
