/**
 * Global cost master sheets (CustomSheet) → line items for project import.
 */
import type { SheetCell } from "@sharnam/shared";
import type { ParsedBbsLine, ParsedMbLine } from "./costSheetParser.js";

export type MasterKind = "mb" | "bbs" | "monitoring";

export const MASTER_CATEGORY: Record<MasterKind, string> = {
  mb: "MB sheets",
  bbs: "BBS sheets",
  monitoring: "BOQ / Monitoring",
};

export const MB_HEADERS = [
  "Sr No.",
  "Description",
  "No",
  "No",
  "Length",
  "Width",
  "Height",
  "Qty.",
  "UoM.",
  "RA Bill",
  "Remark",
];

export const BBS_HEADERS = [
  "SR NO",
  "Description",
  "DIA",
  "No/member",
  "No of member",
  "Total nos",
  "A",
  "B",
  "C",
  "D",
  "E",
  "Cutting L",
  "Total L",
  "Weight kg",
];

export const MON_HEADERS = [
  "Section",
  "Item No.",
  "Description",
  "UOM",
  "Rate",
  "BOQ Qty",
  "Extra Qty",
  "GFC Qty",
];

function cellRaw(row: SheetCell[] | undefined, idx: number): string {
  if (!row || idx < 0 || idx >= row.length) return "";
  const c = row[idx];
  if (!c) return "";
  if (c.computed != null && c.computed !== "") return String(c.computed);
  return String(c.raw ?? "").replace(/^=/, "").trim();
}

function num(row: SheetCell[] | undefined, idx: number): number {
  const v = Number(cellRaw(row, idx));
  return Number.isFinite(v) ? v : 0;
}

function findCol(headers: string[], needles: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const n of needles) {
    const i = lower.findIndex((h) => h.includes(n.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
}

function colExact(headers: string[], label: string, fallback: number): number {
  const i = headers.findIndex((h) => h.trim().toLowerCase() === label.toLowerCase());
  return i >= 0 ? i : fallback;
}

export function mbLinesToSheetRows(lines: ParsedMbLine[]): SheetCell[][] {
  return lines.map((l) =>
    [
      l.srNo || "",
      l.description,
      l.nos1,
      l.nos2,
      l.length,
      l.width,
      l.height,
      l.qty,
      l.unit || "",
      l.raBill || "",
      l.remark || "",
    ].map((v) => ({ raw: String(v ?? "") }))
  );
}

export function bbsLinesToSheetRows(lines: ParsedBbsLine[]): SheetCell[][] {
  return lines.map((l) =>
    [
      l.barMark || "",
      l.location || "",
      l.diameterMm,
      l.nosPerMember,
      l.nosOfMember,
      l.nos,
      l.shapeLenA,
      l.shapeLenB,
      l.shapeLenC,
      l.shapeLenD,
      l.shapeLenE,
      l.lengthMm,
      l.totalLength,
      l.weightKg,
    ].map((v) => ({ raw: String(v ?? "") }))
  );
}

export type MasterLinePreview = {
  index: number;
  label: string;
  sub?: string;
};

export function previewMasterLines(kind: MasterKind, headers: string[], rows: SheetCell[][]): MasterLinePreview[] {
  return rows.map((row, index) => {
    if (kind === "mb") {
      const desc = cellRaw(row, findCol(headers, ["desc", "particular", "item"]) >= 0 ? findCol(headers, ["desc"]) : 1);
      const sr = cellRaw(row, findCol(headers, ["sr"]) >= 0 ? findCol(headers, ["sr"]) : 0);
      return { index, label: desc || sr || `Row ${index + 1}`, sub: sr ? `Sr ${sr}` : undefined };
    }
    if (kind === "bbs") {
      const mark = cellRaw(row, findCol(headers, ["sr", "mark"]) >= 0 ? findCol(headers, ["sr"]) : 0);
      const desc = cellRaw(row, findCol(headers, ["desc"]) >= 0 ? findCol(headers, ["desc"]) : 1);
      return { index, label: mark || desc || `Bar ${index + 1}`, sub: desc };
    }
    const desc = cellRaw(row, findCol(headers, ["desc", "work", "item"]) >= 0 ? findCol(headers, ["desc"]) : 2);
    const item = cellRaw(row, findCol(headers, ["item"]) >= 0 ? findCol(headers, ["item"]) : 1);
    return { index, label: desc || item || `Line ${index + 1}`, sub: item };
  });
}

export function mapMbRow(headers: string[], row: SheetCell[], packageName: string) {
  const cSr = findCol(headers, ["sr"]);
  const cDesc = findCol(headers, ["desc", "particular"]);
  const cN1 = findCol(headers, ["no"]);
  const cLen = findCol(headers, ["length"]);
  const cW = findCol(headers, ["width"]);
  const cH = findCol(headers, ["height"]);
  const cQty = findCol(headers, ["qty"]);
  const cUom = findCol(headers, ["uom", "unit"]);
  const cRa = findCol(headers, ["ra bill", "ra"]);
  const cRem = findCol(headers, ["remark", "note"]);

  const nos1 = num(row, cN1 >= 0 ? cN1 : 2);
  const nos2 = num(row, cN1 >= 0 ? cN1 + 1 : 3);
  const length = num(row, cLen >= 0 ? cLen : 4);
  const width = num(row, cW >= 0 ? cW : 5);
  const height = num(row, cH >= 0 ? cH : 6);
  const qty = num(row, cQty >= 0 ? cQty : 7) || nos1 * nos2 * (length || 1) * (width || 1) * (height || 1);

  return {
    packageName,
    srNo: cellRaw(row, cSr >= 0 ? cSr : 0) || null,
    itemCode: /^\d+$/.test(cellRaw(row, cSr >= 0 ? cSr : 0)) ? cellRaw(row, cSr >= 0 ? cSr : 0) : null,
    description: cellRaw(row, cDesc >= 0 ? cDesc : 1) || "MB line",
    nos1,
    nos2: nos2 || 1,
    length,
    width,
    height,
    qty,
    unit: cellRaw(row, cUom >= 0 ? cUom : 8) || null,
    raBill: cellRaw(row, cRa) || null,
    remark: cellRaw(row, cRem) || null,
  };
}

export function mapBbsRow(headers: string[], row: SheetCell[], packageName: string) {
  const idx = (names: string[], fallback: number) => {
    const i = findCol(headers, names);
    return i >= 0 ? i : fallback;
  };
  const dia = num(row, idx(["dia"], 2));
  const nosPerMember = num(row, idx(["no/member", "per member"], 3));
  const nosOfMember = num(row, idx(["no of member", "of member"], 4));
  const nos = num(row, idx(["total nos", "total nos"], 5)) || nosPerMember * nosOfMember || 1;
  const totalLen = num(row, idx(["total l", "total length"], 12));
  const weightRaw = num(row, idx(["weight"], 13));
  const weight =
    dia && totalLen ? (Math.PI * (dia / 1000 / 2) ** 2 * totalLen * 7850) / 1000 : weightRaw;

  return {
    packageName,
    barMark: cellRaw(row, idx(["sr", "mark"], 0)) || null,
    shapeCode: cellRaw(row, idx(["sr", "mark"], 0)) && /^[A-Z0-9]{1,6}$/i.test(cellRaw(row, idx(["sr", "mark"], 0)))
      ? cellRaw(row, idx(["sr", "mark"], 0)).toUpperCase()
      : null,
    itemCode: /^\d+$/.test(cellRaw(row, idx(["sr", "mark"], 0))) ? cellRaw(row, idx(["sr", "mark"], 0)) : null,
    location: cellRaw(row, idx(["desc", "description"], 1)) || null,
    diameterMm: dia,
    shape: null as string | null,
    lengthMm: num(row, idx(["cutting"], 11)),
    nos,
    nosPerMember,
    nosOfMember,
    shapeLenA: num(row, colExact(headers, "A", 6)),
    shapeLenB: num(row, colExact(headers, "B", 7)),
    shapeLenC: num(row, colExact(headers, "C", 8)),
    shapeLenD: num(row, colExact(headers, "D", 9)),
    shapeLenE: num(row, colExact(headers, "E", 10)),
    totalLength: totalLen,
    weightKg: Math.round((weight || weightRaw) * 100) / 100,
  };
}

export function mapMonitoringRow(headers: string[], row: SheetCell[], packageName: string) {
  const cSec = findCol(headers, ["section", "package"]);
  const cItem = findCol(headers, ["item"]);
  const cDesc = findCol(headers, ["desc", "work"]);
  const cUom = findCol(headers, ["uom", "unit"]);
  const cRate = findCol(headers, ["rate"]);
  const cBoq = findCol(headers, ["boq"]);
  const cExtra = findCol(headers, ["extra"]);
  const cGfc = findCol(headers, ["gfc"]);

  const rate = num(row, cRate >= 0 ? cRate : 4);
  const boqQty = num(row, cBoq >= 0 ? cBoq : 5);

  return {
    packageName,
    section: cellRaw(row, cSec) || packageName,
    itemNo: cellRaw(row, cItem >= 0 ? cItem : 1) || null,
    description: cellRaw(row, cDesc >= 0 ? cDesc : 2) || "BOQ line",
    uom: cellRaw(row, cUom >= 0 ? cUom : 3) || null,
    rate,
    boqQty,
    extraQty: num(row, cExtra >= 0 ? cExtra : 6),
    gfcQty: num(row, cGfc >= 0 ? cGfc : 7),
    achievedQty: 0,
    certifiedQty: 0,
    excessQty: 0,
    savingQty: 0,
    boqCost: boqQty * rate,
  };
}

export function mapMasterRows(
  kind: MasterKind,
  headers: string[],
  rows: SheetCell[][],
  packageName: string,
  indexes: number[]
) {
  const picked = indexes.filter((i) => i >= 0 && i < rows.length);
  if (kind === "mb") return picked.map((i) => mapMbRow(headers, rows[i], packageName));
  if (kind === "bbs") return picked.map((i) => mapBbsRow(headers, rows[i], packageName));
  return picked.map((i) => mapMonitoringRow(headers, rows[i], packageName));
}
