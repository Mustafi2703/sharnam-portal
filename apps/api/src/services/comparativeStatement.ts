/**
 * CRM Comparative Statement — R2 pattern (multi-vendor BOQ rate compare).
 * Office confidential; vendors upload BOQs into CRM bid slots only.
 */
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import {
  type SheetCell,
  colLetter,
  evaluateAllRows,
  sheetCellsToAoa,
  applyFormulasToWorksheet,
} from "@sharnam/shared";

export type ComparativeSummary = {
  vendorLabels: string[];
  sectionTotals: { section: string; totals: Record<string, number> }[];
  grandTotals: Record<string, number>;
  lowestVendor?: string;
};

export function buildComparativeHeaders(vendorLabels: string[]): string[] {
  const headers = ["Sr", "Section", "Item Code", "Description", "Qty", "Unit"];
  for (const v of vendorLabels) {
    headers.push(`${v} Rate`, `${v} Amount`);
  }
  headers.push("Sharnam Estimate", "Lowest Vendor", "Remarks");
  return headers;
}

type SampleItem = {
  section: string;
  code: string;
  description: string;
  qty: number;
  unit: string;
  sharnamEstimate?: number;
};

const SAMPLE_ITEMS: SampleItem[] = [
  { section: "SECTION A — EARTH WORK", code: "A-01", description: "Excavation in ordinary soil", qty: 1200, unit: "CUM" },
  { section: "SECTION A — EARTH WORK", code: "A-02", description: "Filling with soling material", qty: 800, unit: "CUM" },
  { section: "SECTION A — EARTH WORK", code: "A-03", description: "Compaction of soling", qty: 800, unit: "CUM" },
  { section: "SECTION B — RCC WORK", code: "B-01", description: "RCC M25 in foundation", qty: 450, unit: "CUM" },
  { section: "SECTION B — RCC WORK", code: "B-02", description: "RCC M30 in columns & beams", qty: 320, unit: "CUM" },
  { section: "SECTION C — MASONRY", code: "C-01", description: "Brick masonry in CM 1:6", qty: 2400, unit: "SQ.M" },
  { section: "SECTION C — MASONRY", code: "C-02", description: "AAC block masonry", qty: 1800, unit: "SQ.M" },
];

export function buildComparativeRows(vendorLabels: string[]): SheetCell[][] {
  const rows: SheetCell[][] = [];
  let sr = 1;
  let excelRow = 2; // header is row 1

  const rateColStart = 6; // 0-based: after Qty, Unit
  const amountCols: number[] = [];
  for (let v = 0; v < vendorLabels.length; v++) {
    amountCols.push(rateColStart + v * 2 + 1);
  }
  const sharnamCol = rateColStart + vendorLabels.length * 2;

  for (const item of SAMPLE_ITEMS) {
    const row: SheetCell[] = [
      { raw: String(sr++) },
      { raw: item.section },
      { raw: item.code },
      { raw: item.description },
      { raw: String(item.qty) },
      { raw: item.unit },
    ];
    for (let v = 0; v < vendorLabels.length; v++) {
      const rateCol = rateColStart + v * 2;
      const amtCol = rateCol + 1;
      row.push({ raw: "" }); // vendor rate — filled by vendor BOQ or office
      row.push({
        raw: `=${colLetter(4)}${excelRow}*${colLetter(rateCol)}${excelRow}`,
      });
    }
    row.push({ raw: item.sharnamEstimate != null ? String(item.sharnamEstimate) : "" });
    row.push({ raw: "" });
    row.push({ raw: "" });
    rows.push(row);
    excelRow++;
  }

  // Section summary placeholder rows
  const summaryRow: SheetCell[] = [
    { raw: "" },
    { raw: "GRAND TOTAL" },
    { raw: "" },
    { raw: "Comparative total (all sections)" },
    { raw: "" },
    { raw: "" },
  ];
  for (let v = 0; v < vendorLabels.length; v++) {
    const amtCol = amountCols[v];
    const col = colLetter(amtCol);
    const firstData = 2;
    const lastData = excelRow - 1;
    summaryRow.push({ raw: "" });
    summaryRow.push({
      raw: `=SUM(${col}${firstData}:${col}${lastData})`,
    });
  }
  summaryRow.push({ raw: "" });
  summaryRow.push({ raw: "" });
  summaryRow.push({ raw: "" });
  rows.push(summaryRow);

  return evaluateAllRows(rows);
}

export function buildComparativeSheetData(vendorLabels: string[]) {
  const headers = buildComparativeHeaders(vendorLabels);
  const rows = buildComparativeRows(vendorLabels);
  return { headers, rows };
}

export function comparativeToWorkbook(headers: string[], rows: SheetCell[][]): XLSX.WorkBook {
  const evaluated = evaluateAllRows(rows);
  const { data, formulas } = sheetCellsToAoa(headers, evaluated);
  const ws = XLSX.utils.aoa_to_sheet(data);
  applyFormulasToWorksheet(ws as Record<string, unknown>, formulas);
  ws["!cols"] = headers.map((h) => ({ wch: Math.min(42, Math.max(10, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Comparative R2");
  return wb;
}

export function writeComparativeTemplateFile(
  outPath: string,
  vendorLabels = ["M/s Bhavna Infra", "TCC Projects PVT. LTD.", "Pearl Electricals"]
) {
  const { headers, rows } = buildComparativeSheetData(vendorLabels);
  const wb = comparativeToWorkbook(headers, rows);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  XLSX.writeFile(wb, outPath);
}

export function parseComparativeSummary(headers: string[], rows: SheetCell[][]): ComparativeSummary {
  const vendorLabels: string[] = [];
  for (let i = 6; i < headers.length; i += 2) {
    const h = headers[i] || "";
    if (h.endsWith(" Rate")) vendorLabels.push(h.replace(/ Rate$/, ""));
    else break;
  }

  const sectionTotals: ComparativeSummary["sectionTotals"] = [];
  const grandTotals: Record<string, number> = {};
  for (const v of vendorLabels) grandTotals[v] = 0;

  let currentSection = "";
  const sectionAcc: Record<string, number> = {};

  for (const row of rows) {
    const section = String(row[1]?.computed ?? row[1]?.raw ?? "").trim();
    const desc = String(row[3]?.computed ?? row[3]?.raw ?? "").trim().toUpperCase();
    if (desc.includes("GRAND TOTAL")) {
      for (let v = 0; v < vendorLabels.length; v++) {
        const amtIdx = 6 + v * 2 + 1;
        const val = Number(row[amtIdx]?.computed ?? row[amtIdx]?.raw ?? 0);
        if (Number.isFinite(val)) grandTotals[vendorLabels[v]] = val;
      }
      break;
    }
    if (section && section !== currentSection && !section.startsWith("GRAND")) {
      if (currentSection && Object.keys(sectionAcc).length) {
        sectionTotals.push({ section: currentSection, totals: { ...sectionAcc } });
      }
      currentSection = section;
      for (const v of vendorLabels) sectionAcc[v] = 0;
    }
    const code = String(row[2]?.raw ?? "").trim();
    if (!code || code.startsWith("=")) continue;
    for (let v = 0; v < vendorLabels.length; v++) {
      const amtIdx = 6 + v * 2 + 1;
      const val = Number(row[amtIdx]?.computed ?? row[amtIdx]?.raw ?? 0);
      if (Number.isFinite(val)) {
        sectionAcc[vendorLabels[v]] = (sectionAcc[vendorLabels[v]] || 0) + val;
        grandTotals[vendorLabels[v]] = (grandTotals[vendorLabels[v]] || 0) + val;
      }
    }
  }

  let lowestVendor: string | undefined;
  let lowest = Infinity;
  for (const [v, t] of Object.entries(grandTotals)) {
    if (t > 0 && t < lowest) {
      lowest = t;
      lowestVendor = v;
    }
  }

  return { vendorLabels, sectionTotals, grandTotals, lowestVendor };
}
