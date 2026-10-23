/**
 * Parse SPDC-style MB / BBS Excel sheets (same layout as SPDC_Budget_Arvind *.xls).
 */
import XLSX, { type WorkBook, type WorkSheet } from "../lib/xlsx.js";

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function s(v: unknown, max = 500): string {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

export type MbRowKind = "item" | "description" | "subitem" | "subsection" | "data" | "total" | "note";

export type ParsedMbLine = {
  srNo?: string;
  itemCode?: string;
  description: string;
  nos1: number;
  nos2: number;
  length: number;
  width: number;
  height: number;
  qty: number;
  unit?: string;
  raBill?: string;
  remark?: string;
  isDeduction?: boolean;
  rowKind?: MbRowKind;
  lineIndex?: number;
};

function hasMbMeasureFields(r: Pick<ParsedMbLine, "qty" | "nos1" | "length" | "width" | "height">) {
  return (
    Math.abs(r.qty) > 0 ||
    Math.abs(r.nos1) > 0 ||
    Math.abs(r.length) > 0 ||
    Math.abs(r.width) > 0 ||
    Math.abs(r.height) > 0
  );
}

/** "Extra Item 2" is a second sequence. It must not inherit the previous BOQ item number. */
function extraItemCode(raw: string | null | undefined): string {
  const match = String(raw || "").trim().match(/^extra\s*item\s*(\d+)/i);
  if (match) return `E${Number(match[1])}`;
  const coded = String(raw || "").trim();
  if (/^E\d+$/i.test(coded)) return coded.toUpperCase();
  return "";
}

export function inferMbRowKind(r: Pick<ParsedMbLine, "srNo" | "description" | "remark" | "qty" | "nos1" | "length" | "width" | "height">): MbRowKind {
  const desc = String(r.description ?? "").trim();
  const sr = String(r.srNo ?? "").trim();
  if (!desc && !sr) return "note";
  if (isMbTotalRow(desc)) return "total";
  if (extraItemCode(sr)) return hasMbMeasureFields(r) ? "data" : "item";
  if (hasMbMeasureFields(r)) return "data";
  if (sr && /^\d+$/.test(sr)) {
    if (/^-do\b/i.test(desc)) return "subitem";
    return "item";
  }
  if (!sr && desc.length > 90) return "description";
  if (
    !sr &&
    desc.length <= 64 &&
    !/[.;]/.test(desc) &&
    !/^providing|^excavation|^filling|^less |^ded |^do /i.test(desc) &&
    (/^[A-Z][A-Za-z0-9\s\-&/().]+$/.test(desc) || /^[A-Z][A-Z0-9\s\-&/().]+$/.test(desc))
  ) {
    return "subsection";
  }
  if (sr && /^-do\b/i.test(desc)) return "subitem";
  return "note";
}

export type ParsedBbsLine = {
  barMark?: string;
  shapeCode?: string;
  sectionMark?: string;
  itemCode?: string;
  diameterMm: number;
  shape?: string;
  lengthMm: number;
  nos: number;
  nosPerMember: number;
  nosOfMember: number;
  shapeLenA: number;
  shapeLenB: number;
  shapeLenC: number;
  shapeLenD: number;
  shapeLenE: number;
  totalLength: number;
  weightKg: number;
  location?: string;
  rowKind?: "section" | "subsection" | "subheader" | "data" | "note";
  sourceError?: boolean;
  sourceRow?: number;
};

function sheetRows(wb: WorkBook, name?: string): unknown[][] {
  const key = name || wb.SheetNames[0];
  if (!key || !wb.Sheets[key]) return [];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], { header: 1, defval: "" }) as unknown[][];
}

function workbookFromBuffer(buffer: Buffer) {
  return XLSX.read(buffer, { type: "buffer" });
}

function colIndex(hdr: unknown[], patterns: RegExp[]): number {
  for (let j = 0; j < hdr.length; j++) {
    const t = s(hdr[j], 80).toLowerCase().replace(/\s+/g, " ");
    if (patterns.some((p) => p.test(t))) return j;
  }
  return -1;
}

function isMbMetaFooter(text: string) {
  return /name of project|name of contractor|w\.o\. no|invoice date|bill submission|ref no\.|ra bill no/i.test(text);
}

function isMbTotalRow(text: string) {
  return /total up to date|previous bill qty|this bill quantity/i.test(text.trim());
}

type MbColLayout = {
  startRow: number;
  sr: number;
  desc: number;
  nos1: number;
  nos2: number;
  length: number;
  width: number;
  height: number;
  qty: number;
  uom: number;
  raBill: number;
  remark: number;
};

function detectMbLayout(rows: unknown[][]): MbColLayout {
  const headerRow = detectMbHeaderRow(rows);
  const hdr = (headerRow >= 0 ? rows[headerRow] : []) as unknown[];
  const nosCols: number[] = [];
  for (let j = 0; j < hdr.length; j++) {
    const t = s(hdr[j], 40).toLowerCase().replace(/\s+/g, " ");
    if (t === "no" || t === "no." || t === "nos") nosCols.push(j);
  }
  return {
    startRow: (headerRow >= 0 ? headerRow : 0) + 1,
    sr: colIndex(hdr, [/sr\.?\s*no/]) >= 0 ? colIndex(hdr, [/sr\.?\s*no/]) : 0,
    desc: colIndex(hdr, [/description|particular|item of work/]) >= 0 ? colIndex(hdr, [/description|particular|item of work/]) : 1,
    nos1: nosCols[0] ?? 2,
    nos2: nosCols[1] ?? nosCols[0] ?? 3,
    length: colIndex(hdr, [/^length/]) >= 0 ? colIndex(hdr, [/^length/]) : 4,
    width: colIndex(hdr, [/^width/]) >= 0 ? colIndex(hdr, [/^width/]) : 5,
    height: colIndex(hdr, [/^height/, /^hight/]) >= 0 ? colIndex(hdr, [/^height/, /^hight/]) : 6,
    qty: colIndex(hdr, [/^qty/]) >= 0 ? colIndex(hdr, [/^qty/]) : 7,
    uom: colIndex(hdr, [/^uom/, /unit/]) >= 0 ? colIndex(hdr, [/^uom/, /unit/]) : 8,
    raBill: colIndex(hdr, [/ra-?bill/, /ra bill/]) >= 0 ? colIndex(hdr, [/ra-?bill/, /ra bill/]) : 9,
    remark: colIndex(hdr, [/remark/]) >= 0 ? colIndex(hdr, [/remark/]) : 10,
  };
}

function detectMbHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 35); i++) {
    const cells = (rows[i] as unknown[]).map((c) => s(c, 60).toLowerCase());
    const hasSr = cells.some((c) => /sr\.?\s*no/.test(c));
    const hasDesc = cells.some((c) => /description|particular|item of work/.test(c));
    const hasQty = cells.some((c) => /^qty/.test(c));
    const hasDim = cells.some((c) => /^(length|width|height|hight)/.test(c));
    if (hasSr && hasDesc && (hasQty || hasDim)) return i;
  }
  return -1;
}

type BbsColLayout = {
  startRow: number;
  mark: number;
  desc: number;
  shape: number;
  dia: number;
  nosPerMember: number;
  nosOfMember: number;
  totalNos: number;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  cutting: number;
  totalLen: number;
  weight: number;
  /** Running metres per diameter. SPDC sheets have no weight column; kg = metres × kg/m. */
  diaMetres: { col: number; kgPerM: number }[];
};

function detectBbsLayout(rows: unknown[][]): BbsColLayout {
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const hdr = rows[i] as unknown[];
    if (colIndex(hdr, [/sr\.?\s*no/]) >= 0 && colIndex(hdr, [/description/]) >= 0 && colIndex(hdr, [/^dia$/, /^dia\s/]) >= 0) {
      headerRow = i;
      break;
    }
  }
  const hdr = (headerRow >= 0 ? rows[headerRow] : rows[6] || []) as unknown[];

  let a = -1;
  let b = -1;
  let c = -1;
  let d = -1;
  let e = -1;
  const subStart = headerRow >= 0 ? headerRow : 0;
  for (let i = subStart; i <= subStart + 5 && i < rows.length; i++) {
    const sub = rows[i] as unknown[];
    for (let j = 0; j < sub.length; j++) {
      const cell = s(sub[j]);
      if (cell === "A") a = j;
      if (cell === "B") b = j;
      if (cell === "C") c = j;
      if (cell === "D") d = j;
      if (cell === "E") e = j;
    }
    if (a >= 0 && b >= 0) break;
  }

  const shapeLenHdr = colIndex(hdr, [/shape length/]);
  if (a < 0 && shapeLenHdr >= 0) a = shapeLenHdr;

  const cutting = colIndex(hdr, [/cutting length/]);
  const totalLen = colIndex(hdr, [/total\s*length/]);
  const weight = colIndex(hdr, [/weight\s*kg/, /^weight$/]);
  const diaMetres = diaMetreColumns(rows, headerRow);

  return {
    startRow: (headerRow >= 0 ? headerRow : 6) + 1,
    mark: colIndex(hdr, [/sr\.?\s*no/]) >= 0 ? colIndex(hdr, [/sr\.?\s*no/]) : 0,
    desc: colIndex(hdr, [/description/]) >= 0 ? colIndex(hdr, [/description/]) : 1,
    shape: colIndex(hdr, [/shape of bar/]) >= 0 ? colIndex(hdr, [/shape of bar/]) : 2,
    dia: colIndex(hdr, [/^dia$/, /^dia\s/]) >= 0 ? colIndex(hdr, [/^dia$/, /^dia\s/]) : 8,
    nosPerMember: colIndex(hdr, [/no per member/, /nos per member/]) >= 0 ? colIndex(hdr, [/no per member/, /nos per member/]) : 9,
    nosOfMember: colIndex(hdr, [/no of member/, /nos of member/]) >= 0 ? colIndex(hdr, [/no of member/, /nos of member/]) : 10,
    totalNos: colIndex(hdr, [/total nos/]) >= 0 ? colIndex(hdr, [/total nos/]) : 11,
    a: a >= 0 ? a : 12,
    b: b >= 0 ? b : a >= 0 ? a + 1 : 13,
    c: c >= 0 ? c : a >= 0 ? a + 2 : 14,
    d: d >= 0 ? d : a >= 0 ? a + 3 : 15,
    e: e >= 0 ? e : a >= 0 ? a + 4 : 16,
    cutting: cutting >= 0 ? cutting : totalLen >= 0 ? totalLen - 1 : 17,
    totalLen: totalLen >= 0 ? totalLen : 18,
    // SPDC BBS sheets carry no weight column — the columns after "Total length" are running metres per
    // diameter (8 … 32 mm), so weight is only read from a real weight / kg header.
    weight,
    diaMetres,
  };
}

/** kg per metre as stored on the SPDC dia-wise weight row (not the unrounded d²/162 factor). */
const BBS_KG_PER_M: Record<number, number> = {
  8: 0.395,
  10: 0.617,
  12: 0.888,
  16: 1.58,
  20: 2.47,
  25: 3.85,
  32: 6.31,
};

function diaMetreColumns(rows: unknown[][], headerRow: number): { col: number; kgPerM: number }[] {
  const start = headerRow >= 0 ? headerRow : 0;
  for (let i = start; i <= start + 8 && i < rows.length; i++) {
    const sub = rows[i] as unknown[];
    const found: { col: number; kgPerM: number }[] = [];
    for (let j = 0; j < sub.length; j++) {
      const dia = Number(String(sub[j] ?? "").trim());
      const kgPerM = BBS_KG_PER_M[dia];
      if (kgPerM) found.push({ col: j, kgPerM });
    }
    if (found.length >= 4) return found;
  }
  return [];
}

function weightFromDiaMetres(row: unknown[], cols: { col: number; kgPerM: number }[]): number {
  let weight = 0;
  let any = false;
  for (const col of cols) {
    const metres = n(row[col.col]);
    if (!metres) continue;
    any = true;
    weight += metres * col.kgPerM;
  }
  if (!any) return 0;
  return Math.round(weight * 100) / 100;
}

/** Bar weight in kg: a real weight column if the sheet has one, else d² / 162 kg per metre × total metres. */
function bbsWeightKg(diaMm: number, totalLenM: number, row: unknown[], weightCol: number): number {
  const fromCell = weightCol >= 0 ? n(row[weightCol]) : 0;
  if (fromCell > 0 && fromCell < 50000) return Math.round(fromCell * 100) / 100;
  if (diaMm >= 6 && totalLenM > 0) return Math.round(((diaMm * diaMm) / 162) * totalLenM * 100) / 100;
  return 0;
}

export function parseMbRows(rows: unknown[][]): ParsedMbLine[] {
  const layout = detectMbLayout(rows);
  const out: ParsedMbLine[] = [];

  for (let i = layout.startRow; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const srRaw = s(row[layout.sr], 40);
    const descPrimary = s(row[layout.desc], 400);
    const altLabel = s(row[layout.nos1], 400);
    let description = descPrimary || altLabel || srRaw;
    if (!description) continue;
    if (isMbMetaFooter(description) || isMbMetaFooter(altLabel)) continue;

    const altIsNumeric = altLabel && /^-?\d+(\.\d+)?$/.test(altLabel.trim());
    const descExtra =
      altLabel && descPrimary && !altIsNumeric && !isMbTotalRow(altLabel) ? altLabel : "";
    const nos1 = altLabel && descPrimary && !altIsNumeric ? 0 : n(row[layout.nos1]);
    const nos2 = n(row[layout.nos2]) || 1;
    const length = n(row[layout.length]);
    const width = n(row[layout.width]);
    const height = n(row[layout.height]);
    const qty = n(row[layout.qty]);
    const hasMeasure = Math.abs(qty) > 0 || Math.abs(nos1) > 0 || Math.abs(length) > 0 || Math.abs(width) > 0 || Math.abs(height) > 0;

    if (isMbTotalRow(description)) {
      const totalRow: ParsedMbLine = {
        srNo: undefined,
        description,
        nos1: 0,
        nos2: 0,
        length: 0,
        width: 0,
        height: 0,
        qty,
        unit: s(row[layout.uom], 20) || undefined,
        remark: s(row[layout.remark], 200) || undefined,
      };
      totalRow.rowKind = inferMbRowKind(totalRow);
      out.push(totalRow);
      continue;
    }

    // SPDC heading / section rows (EXCAVATION, DORMITORY, item 2., Part A, …)
    if (!hasMeasure) {
      const srNo = srRaw && !/^\d+\.\d+$/.test(srRaw) ? srRaw : /^\d+(\.\d+)?$/.test(srRaw) ? srRaw : undefined;
      const itemCode = /^\d+(\.\d+)?$/.test(srRaw) ? srRaw : undefined;
      if (descExtra && descPrimary) {
        const band: ParsedMbLine = {
          srNo: srNo || itemCode,
          itemCode,
          description: descPrimary,
          nos1: 0,
          nos2: 0,
          length: 0,
          width: 0,
          height: 0,
          qty: 0,
          remark: descExtra,
        };
        band.rowKind = inferMbRowKind(band);
        out.push(band);
      } else {
        const band: ParsedMbLine = {
          srNo: srNo || itemCode,
          itemCode,
          description,
          nos1: 0,
          nos2: 0,
          length: 0,
          width: 0,
          height: 0,
          qty: 0,
        };
        band.rowKind = inferMbRowKind(band);
        out.push(band);
      }
      continue;
    }

    // Measurement row — description usually in col 1; sr may be empty
    const measureDesc = descPrimary || description;
    const dataRow: ParsedMbLine = {
      srNo: srRaw && /^\d+(\.\d+)?$/.test(srRaw) ? srRaw : undefined,
      itemCode: /^\d+(\.\d+)?$/.test(srRaw) ? srRaw : undefined,
      description: measureDesc,
      nos1,
      nos2,
      length,
      width,
      height,
      qty: qty || nos1 * nos2 * (length || 1) * (width || 1) * (height || 1),
      unit: s(row[layout.uom], 20) || undefined,
      raBill: s(row[layout.raBill], 80) || undefined,
      remark: s(row[layout.remark], 200) || undefined,
    };
    dataRow.rowKind = inferMbRowKind(dataRow);
    out.push(dataRow);
  }
  return assignMbItemCodes(out);
}

function itemNumber(raw: string | null | undefined): string {
  const extra = extraItemCode(raw);
  if (extra) return extra;
  const t = String(raw || "").trim();
  if (!t) return "";
  if (/^\d+(\.0+)?$/.test(t)) return String(Number(t));
  if (/^\d+$/.test(t)) return t;
  return "";
}

/** Measurement rows inherit the item or sub-item header above them. Deduction blocks subtract. */
export function assignMbItemCodes<T extends ParsedMbLine>(lines: T[]): T[] {
  let current = "";
  let deduct = false;
  for (const line of lines) {
    const desc = String(line.description || "").trim();
    const own = itemNumber(line.srNo) || itemNumber(line.itemCode);
    const kind = line.rowKind || "data";
    if (/^deduction\b/i.test(desc)) {
      deduct = true;
      line.itemCode = current || own || undefined;
      line.isDeduction = kind === "data";
      continue;
    }
    if (kind === "item" || kind === "subitem") {
      if (own) current = own;
      deduct = false;
      line.itemCode = current || undefined;
      line.isDeduction = false;
      continue;
    }
    line.itemCode = current || own || line.itemCode;
    line.isDeduction = deduct && kind === "data";
  }
  return lines;
}

/** Achieved quantity = data rows minus deduction rows. Total rows are display only. */
export function rollupMbQtyByItem(lines: ParsedMbLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if ((line.rowKind || "data") !== "data") continue;
    const code = itemNumber(line.itemCode) || itemNumber(line.srNo);
    if (!code) continue;
    const qty = Number(line.qty) || 0;
    const signed = line.isDeduction ? -Math.abs(qty) : qty;
    totals.set(code, (totals.get(code) || 0) + signed);
  }
  return totals;
}

/** Unit printed on each item's "Total Up to Date" row (Cum, KG, Smt, …). */
export function mbItemUnits(lines: ParsedMbLine[]): Map<string, string> {
  const units = new Map<string, string>();
  for (const line of lines) {
    if ((line.rowKind || "") !== "total") continue;
    if (!/up to date/i.test(line.description || "")) continue;
    const code = itemNumber(line.itemCode) || itemNumber(line.srNo);
    const unit = String(line.unit || "").trim();
    if (code && unit) units.set(code, unit);
  }
  return units;
}

export function normItemNo(raw: string | null | undefined): string {
  return itemNumber(raw) || String(raw || "").trim();
}

export function parseBbsRows(rows: unknown[][]): ParsedBbsLine[] {
  const layout = detectBbsLayout(rows);
  const out: ParsedBbsLine[] = [];
  let currentSection = "";
  let currentShapeCode = "";
  let lastDescription = "";

  for (let i = layout.startRow; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const markRaw = s(row[layout.mark], 40);
    let description = s(row[layout.desc], 300);
    const shapeCell = s(row[layout.shape], 80);
    const dia = n(row[layout.dia]);
    const totalLen = n(row[layout.totalLen]);
    const totalNos = n(row[layout.totalNos]);
    // Ring sets put the label on one row and the bar (dia, nos, length) on the next row.
    const continuation = !description && !markRaw && dia >= 6 && dia <= 50 && (totalLen > 0 || totalNos > 0);
    if (continuation) description = lastDescription;
    if (description && !/^(sr\.?\s*no|description|shape of bar|shape length|cutting length|total\s*length|weight\s*kg)$/i.test(description)) {
      lastDescription = description;
    }

    if (!description && !markRaw) continue;
    if (/name of project|bar bending schedule|project development consultancy/i.test(description + " " + markRaw)) continue;
    if (/^sr\.?\s*no$/i.test(description) || /^sr\.?\s*no$/i.test(markRaw)) continue;
    if (/^\s*(grand\s*)?total\b/i.test(description) || /^\s*(grand\s*)?total\b/i.test(markRaw)) continue;
    if (/dia wise|weight\/mtr|weight in kg|weight in mt|in tonne/i.test(description)) continue;
    if (/^dia\s*\d+(\.\d+)?(\s*mm)?$/i.test(description)) continue;

    const nosPerMember = n(row[layout.nosPerMember]);
    const nosOfMember = n(row[layout.nosOfMember]);
    const nos = totalNos || (nosPerMember && nosOfMember ? nosPerMember * nosOfMember : 0);
    const shapeLenA = n(row[layout.a]);
    const shapeLenB = n(row[layout.b]);
    const shapeLenC = n(row[layout.c]);
    const shapeLenD = n(row[layout.d]);
    const shapeLenE = n(row[layout.e]);
    const cuttingLen = n(row[layout.cutting]);
    const shapeFromCell = shapeCell && !/^[\d.\-]+$/.test(shapeCell) ? shapeCell : undefined;
    const fromDia = dia >= 6 && dia <= 50 ? weightFromDiaMetres(row, layout.diaMetres) : 0;
    const weightKg = fromDia || bbsWeightKg(dia, totalLen, row, layout.weight);
    const sourceError = [layout.totalLen, layout.weight, layout.cutting, layout.dia].some(
      (c) => c >= 0 && /^#(REF!|DIV\/0!|VALUE!|N\/A|NAME\?)/i.test(String(row[c] ?? "").trim())
    );

    if (!description && !markRaw) continue;
    if (/^description$|^shape of bar$|^shape length$|^cutting length$|^total\s*length$|^weight\s*kg$/i.test(description)) continue;
    if (/^(l|b|h|dia|spacing|d)$/i.test(description) && !dia && !totalLen) {
      out.push({
        sectionMark: currentSection || undefined,
        shapeCode: currentShapeCode || undefined,
        barMark: markRaw || undefined,
        diameterMm: 0,
        lengthMm: 0,
        nos: 0,
        nosPerMember: 0,
        nosOfMember: 0,
        shapeLenA: 0,
        shapeLenB: 0,
        shapeLenC: 0,
        shapeLenD: 0,
        shapeLenE: 0,
        totalLength: 0,
        weightKg: 0,
        location: description,
        rowKind: "subheader",
      });
      continue;
    }

    const hasSteel =
      (dia >= 6 && dia <= 50) ||
      totalLen > 0 ||
      totalNos > 0 ||
      weightKg > 0 ||
      (shapeFromCell && (nosPerMember > 0 || nosOfMember > 0));

    if (!hasSteel) {
      if (markRaw && /^[A-Z]$/.test(markRaw)) {
        currentSection = markRaw;
        currentShapeCode = markRaw.toUpperCase();
        out.push({
          barMark: markRaw,
          shapeCode: currentShapeCode,
          sectionMark: currentSection,
          diameterMm: 0,
          lengthMm: 0,
          nos: 0,
          nosPerMember: 0,
          nosOfMember: 0,
          shapeLenA: 0,
          shapeLenB: 0,
          shapeLenC: 0,
          shapeLenD: 0,
          shapeLenE: 0,
          totalLength: 0,
          weightKg: 0,
          location: description,
          rowKind: "section",
        });
        continue;
      }
      if (markRaw && /^\d+$/.test(markRaw)) {
        out.push({
          barMark: markRaw,
          sectionMark: currentSection || undefined,
          shapeCode: currentShapeCode || undefined,
          diameterMm: 0,
          lengthMm: 0,
          nos: 0,
          nosPerMember: 0,
          nosOfMember: 0,
          shapeLenA: 0,
          shapeLenB: 0,
          shapeLenC: 0,
          shapeLenD: 0,
          shapeLenE: 0,
          totalLength: 0,
          weightKg: 0,
          location: description,
          rowKind: "subsection",
        });
        continue;
      }
      if (description && (/^footing\s*=|^column\s|^beam\s|^slab\s|^ring\s|^steel\s|^pedestal/i.test(description) || description.length <= 72)) {
        out.push({
          sectionMark: currentSection || undefined,
          shapeCode: currentShapeCode || undefined,
          barMark: markRaw || undefined,
          diameterMm: 0,
          lengthMm: 0,
          nos: 0,
          nosPerMember: 0,
          nosOfMember: 0,
          shapeLenA: 0,
          shapeLenB: 0,
          shapeLenC: 0,
          shapeLenD: 0,
          shapeLenE: 0,
          totalLength: 0,
          weightKg: 0,
          location: description,
          rowKind: "subsection",
        });
        continue;
      }
      if (description) {
        out.push({
          sectionMark: currentSection || undefined,
          shapeCode: currentShapeCode || undefined,
          barMark: markRaw || undefined,
          diameterMm: 0,
          lengthMm: 0,
          nos: 0,
          nosPerMember: 0,
          nosOfMember: 0,
          shapeLenA: 0,
          shapeLenB: 0,
          shapeLenC: 0,
          shapeLenD: 0,
          shapeLenE: 0,
          totalLength: 0,
          weightKg: 0,
          location: description,
          rowKind: "note",
        });
      }
      continue;
    }

    // Rebar dia typically 8–40 mm; skip shape-dimension false positives in DIA column
    if (dia > 0 && dia < 6) continue;
    if (dia > 50) continue;

    if (markRaw && /^[A-Z]$/.test(markRaw)) {
      currentSection = markRaw;
      currentShapeCode = markRaw.toUpperCase();
    }

    out.push({
      barMark: markRaw || currentSection || undefined,
      shapeCode: currentShapeCode || (markRaw && /^[A-Z0-9]{1,4}$/i.test(markRaw) ? markRaw.toUpperCase() : undefined),
      sectionMark: currentSection || undefined,
      itemCode: markRaw && /^\d+$/.test(markRaw) ? markRaw : undefined,
      diameterMm: dia,
      shape: shapeFromCell,
      lengthMm: cuttingLen || shapeLenA || 0,
      nos: nos || 1,
      nosPerMember,
      nosOfMember,
      shapeLenA,
      shapeLenB,
      shapeLenC,
      shapeLenD,
      shapeLenE,
      totalLength: totalLen,
      weightKg: sourceError ? 0 : weightKg,
      location: description || undefined,
      rowKind: "data",
      sourceError,
      sourceRow: i,
    });
  }
  return out;
}

import {
  SPDC_BBS_SHEETS,
  SPDC_MB_SHEETS,
  SPDC_MONITORING_SHEETS,
  SPDC_RATE_SHEETS,
} from "./spdcBudgetManifest.js";
import { foldTabName, packageForTab } from "@sharnam/shared";

/** SPDC_Budget_Arvind 49.xls — Excel tab name → portal package name */
export const SPDC_MB_SHEET_PACKAGES = SPDC_MB_SHEETS;
export const SPDC_BBS_SHEET_PACKAGES = SPDC_BBS_SHEETS;
export const SPDC_MONITORING_SHEET_PACKAGES = SPDC_MONITORING_SHEETS;

export type ParsedSheetBatch<T> = { sheetName: string; packageName: string; lines: T[] };

/** Tabs that are not an exact MB, BBS, Monitoring, Budget or rate-difference name. */
export function workbookSheetNames(buffer: Buffer): string[] {
  return workbookFromBuffer(buffer).SheetNames;
}

export function skippedBudgetTabs(names: string[]): string[] {
  const known = new Set<string>();
  for (const [sheet] of [...SPDC_MB_SHEETS, ...SPDC_BBS_SHEETS, ...SPDC_MONITORING_SHEETS]) {
    known.add(foldTabName(sheet));
  }
  known.add("budget");
  for (const rate of SPDC_RATE_SHEETS) known.add(foldTabName(rate.sheet));
  return names.filter((name) => !known.has(foldTabName(name)));
}

/** Flag BBS rows whose length or weight cell is an Excel error, and zero the weight. */
export function markBbsSheetErrors(sheet: WorkSheet | undefined, lines: ParsedBbsLine[]) {
  if (!sheet) return lines;
  const badRows = new Set<number>();
  for (const addr of Object.keys(sheet)) {
    if (addr.startsWith("!")) continue;
    const cell = sheet[addr] as { t?: string; v?: unknown; w?: unknown } | undefined;
    const text = String(cell?.w ?? cell?.v ?? "");
    if (cell?.t !== "e" && !/^#(REF!|DIV\/0!|VALUE!|N\/A|NAME\?)/i.test(text.trim())) continue;
    const decoded = XLSX.utils.decode_cell(addr);
    badRows.add(decoded.r);
  }
  for (const line of lines) {
    if (line.sourceRow == null || !badRows.has(line.sourceRow)) continue;
    if (line.rowKind && line.rowKind !== "data") continue;
    line.sourceError = true;
    line.weightKg = 0;
  }
  return lines;
}

export function parseAllMbSheets(buffer: Buffer): ParsedSheetBatch<ParsedMbLine>[] {
  const wb = workbookFromBuffer(buffer);
  const out: ParsedSheetBatch<ParsedMbLine>[] = [];
  for (const name of wb.SheetNames) {
    const pkg = packageForTab(name, SPDC_MB_SHEETS);
    if (!pkg) continue;
    const lines = parseMbRows(sheetRows(wb, name));
    if (lines.length) out.push({ sheetName: name, packageName: pkg, lines });
  }
  return out;
}

export function parseAllBbsSheets(buffer: Buffer): ParsedSheetBatch<ParsedBbsLine>[] {
  const wb = workbookFromBuffer(buffer);
  const out: ParsedSheetBatch<ParsedBbsLine>[] = [];
  for (const name of wb.SheetNames) {
    const pkg = packageForTab(name, SPDC_BBS_SHEETS);
    if (!pkg) continue;
    const lines = markBbsSheetErrors(wb.Sheets[name], parseBbsRows(sheetRows(wb, name)));
    if (lines.length) out.push({ sheetName: name, packageName: pkg, lines });
  }
  return out;
}

export function isFullSpdcWorkbook(buffer: Buffer): boolean {
  const wb = workbookFromBuffer(buffer);
  const names = wb.SheetNames.join(" ").toLowerCase();
  return /budget|monitoring|dormitory mb|dormitory bbs/.test(names);
}

export function parseMbBuffer(buffer: Buffer): ParsedMbLine[] {
  const all = parseAllMbSheets(buffer);
  if (all.length) return all.reduce((best, sheet) => (sheet.lines.length > best.lines.length ? sheet : best)).lines;
  const wb = workbookFromBuffer(buffer);
  if (wb.SheetNames.length === 1) return parseMbRows(sheetRows(wb, wb.SheetNames[0]));
  return [];
}

export function parseBbsBuffer(buffer: Buffer): ParsedBbsLine[] {
  const all = parseAllBbsSheets(buffer);
  if (all.length) return all.reduce((best, sheet) => (sheet.lines.length > best.lines.length ? sheet : best)).lines;
  const wb = workbookFromBuffer(buffer);
  if (wb.SheetNames.length === 1) {
    const name = wb.SheetNames[0]!;
    return markBbsSheetErrors(wb.Sheets[name], parseBbsRows(sheetRows(wb, name)));
  }
  return [];
}
