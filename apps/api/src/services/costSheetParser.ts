/**
 * Parse SPDC-style MB / BBS Excel sheets (same layout as SPDC_Budget_Arvind *.xls).
 */
import XLSX, { type WorkBook } from "../lib/xlsx.js";

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function s(v: unknown, max = 500): string {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

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
};

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
  rowKind?: "header" | "data";
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

function isMbFooter(text: string) {
  return /total up to date|previous bill|this bill|name of project|name of contractor|w\.o\. no|invoice date|bill submission|ref no\.|ra bill no/i.test(
    text
  );
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
    weight: weight >= 0 ? weight : totalLen >= 0 ? totalLen + 1 : 19,
  };
}

function bbsWeightKg(diaMm: number, totalLenM: number, row: unknown[], weightCol: number): number {
  const fromCell = n(row[weightCol]);
  if (fromCell > 0 && fromCell < 50000) return Math.round(fromCell * 100) / 100;
  if (diaMm >= 6 && totalLenM > 0) {
    return Math.round(((Math.PI * (diaMm / 1000 / 2) ** 2 * totalLenM * 7850) / 1000) * 100) / 100;
  }
  return 0;
}

export function parseMbRows(rows: unknown[][]): ParsedMbLine[] {
  const header = detectMbHeaderRow(rows);
  const start = header >= 0 ? header + 1 : 0;
  const out: ParsedMbLine[] = [];

  for (let i = start; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const srRaw = s(row[0], 40);
    const descPrimary = s(row[1], 400);
    const descExtra = s(row[2], 400);
    let description = descPrimary || srRaw;
    if (!description) continue;
    if (isMbFooter(description) || isMbFooter(descExtra)) continue;

    const nos1 = n(row[2]);
    const nos2 = n(row[3]) || 1;
    const length = n(row[4]);
    const width = n(row[5]);
    const height = n(row[6]);
    const qty = n(row[7]);
    const hasMeasure = qty > 0 || nos1 > 0 || length > 0 || width > 0 || height > 0;

    // SPDC heading / section rows (EXCAVATION, DORMITORY, item 2., Part A, …)
    if (!hasMeasure) {
      const srNo = srRaw && !/^\d+\.\d+$/.test(srRaw) ? srRaw : /^\d+(\.\d+)?$/.test(srRaw) ? srRaw : undefined;
      const itemCode = /^\d+(\.\d+)?$/.test(srRaw) ? srRaw : undefined;
      if (descExtra && descPrimary) {
        out.push({
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
        });
      } else {
        out.push({
          srNo: srNo || itemCode,
          itemCode,
          description,
          nos1: 0,
          nos2: 0,
          length: 0,
          width: 0,
          height: 0,
          qty: 0,
        });
      }
      continue;
    }

    // Measurement row — description usually in col 1; sr may be empty
    const measureDesc = descPrimary || description;
    out.push({
      srNo: srRaw && /^\d+(\.\d+)?$/.test(srRaw) ? srRaw : undefined,
      itemCode: /^\d+(\.\d+)?$/.test(srRaw) ? srRaw : undefined,
      description: measureDesc,
      nos1,
      nos2,
      length,
      width,
      height,
      qty: qty || nos1 * nos2 * (length || 1) * (width || 1) * (height || 1),
      unit: s(row[8], 20) || undefined,
      raBill: s(row[9], 80) || undefined,
      remark: s(row[10], 200) || undefined,
    });
  }
  return out;
}

export function parseBbsRows(rows: unknown[][]): ParsedBbsLine[] {
  const layout = detectBbsLayout(rows);
  const out: ParsedBbsLine[] = [];
  let currentSection = "";
  let currentShapeCode = "";

  for (let i = layout.startRow; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const markRaw = s(row[layout.mark], 40);
    const description = s(row[layout.desc], 300);
    const shapeCell = s(row[layout.shape], 80);

    if (!description && !markRaw) continue;
    if (/name of project|bar bending schedule|project development consultancy/i.test(description)) continue;
    if (/^sr\.?\s*no$/i.test(description) || /^sr\.?\s*no$/i.test(markRaw)) continue;

    const dia = n(row[layout.dia]);
    const nosPerMember = n(row[layout.nosPerMember]);
    const nosOfMember = n(row[layout.nosOfMember]);
    const totalNos = n(row[layout.totalNos]);
    const nos = totalNos || (nosPerMember && nosOfMember ? nosPerMember * nosOfMember : 0);
    const shapeLenA = n(row[layout.a]);
    const shapeLenB = n(row[layout.b]);
    const shapeLenC = n(row[layout.c]);
    const shapeLenD = n(row[layout.d]);
    const shapeLenE = n(row[layout.e]);
    const cuttingLen = n(row[layout.cutting]);
    const totalLen = n(row[layout.totalLen]);
    const shapeFromCell = shapeCell && !/^[\d.\-]+$/.test(shapeCell) ? shapeCell : undefined;

    // Section band rows (A / 1 / FOOTING with title in description column)
    if (markRaw && !dia && !totalNos && !totalLen && description && dia < 6) {
      currentSection = markRaw;
      if (/^[A-Z0-9]{1,6}$/i.test(markRaw)) currentShapeCode = markRaw.toUpperCase();
      out.push({
        barMark: markRaw,
        shapeCode: currentShapeCode || undefined,
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
        rowKind: "header",
      });
      continue;
    }

    if (!description && !markRaw) continue;
    if (/description|shape of bar|shape length|cutting length|total\s*length/i.test(description)) continue;

    if (!dia && !totalLen && !totalNos && !shapeFromCell) {
      if (description) {
        out.push({
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
          rowKind: "header",
        });
      }
      continue;
    }

    // Rebar dia typically 8–40 mm; skip shape-dimension false positives in DIA column
    if (dia > 0 && dia < 6) continue;
    if (dia > 50) continue;

    const weightKg = bbsWeightKg(dia, totalLen, row, layout.weight);

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
      weightKg,
      location: description || undefined,
      rowKind: "data",
    });
  }
  return out;
}

/** Pick the sheet with the most valid rows (handles full budget workbooks). */
function bestSheetParse<T>(buffer: Buffer, parse: (rows: unknown[][]) => T[], nameHint?: RegExp): T[] {
  const wb = workbookFromBuffer(buffer);
  let best: T[] = [];
  for (const name of wb.SheetNames) {
    if (nameHint && !nameHint.test(name)) continue;
    const rows = parse(sheetRows(wb, name));
    if (rows.length > best.length) best = rows;
  }
  if (best.length) return best;
  for (const name of wb.SheetNames) {
    const rows = parse(sheetRows(wb, name));
    if (rows.length > best.length) best = rows;
  }
  return best;
}

import {
  SPDC_BBS_SHEETS,
  SPDC_MB_SHEETS,
  SPDC_MONITORING_SHEETS,
} from "./spdcBudgetManifest.js";

/** SPDC_Budget_Arvind 49.xls — Excel tab name → portal package name */
export const SPDC_MB_SHEET_PACKAGES = SPDC_MB_SHEETS;
export const SPDC_BBS_SHEET_PACKAGES = SPDC_BBS_SHEETS;
export const SPDC_MONITORING_SHEET_PACKAGES = SPDC_MONITORING_SHEETS;

function resolveSheetPackage(sheetName: string, mappings: [string, string][], fallbackHint?: RegExp): string | null {
  const trimmed = sheetName.trim();
  for (const [sheet, pkg] of mappings) {
    if (trimmed === sheet.trim() || trimmed.toLowerCase() === sheet.trim().toLowerCase()) return pkg;
  }
  if (fallbackHint?.test(trimmed)) {
    const base = trimmed.replace(/\s*(MB|BBS|Monitoring)\s*$/i, "").trim();
    return base || trimmed;
  }
  return null;
}

export type ParsedSheetBatch<T> = { sheetName: string; packageName: string; lines: T[] };

export function parseAllMbSheets(buffer: Buffer): ParsedSheetBatch<ParsedMbLine>[] {
  const wb = workbookFromBuffer(buffer);
  const out: ParsedSheetBatch<ParsedMbLine>[] = [];
  for (const name of wb.SheetNames) {
    const pkg =
      resolveSheetPackage(name, SPDC_MB_SHEET_PACKAGES, /\bMB\b|dormitory|compound|ugwt|septic|road|plumb|electric|fire|gas|wall|paving|door|window|furniture/i) ||
      null;
    if (!pkg && !/\bMB\b|dormitory|compound|ugwt|septic|road|plumb|electric|fire|gas|wall|paving|door|window|furniture/i.test(name))
      continue;
    const lines = parseMbRows(sheetRows(wb, name));
    if (lines.length) out.push({ sheetName: name, packageName: pkg || name.trim(), lines });
  }
  return out;
}

export function parseAllBbsSheets(buffer: Buffer): ParsedSheetBatch<ParsedBbsLine>[] {
  const wb = workbookFromBuffer(buffer);
  const out: ParsedSheetBatch<ParsedBbsLine>[] = [];
  for (const name of wb.SheetNames) {
    const pkg =
      resolveSheetPackage(name, SPDC_BBS_SHEET_PACKAGES, /\bBBS\b|bending|rebar|bar/i) || null;
    if (!pkg && !/\bBBS\b|bending|rebar|bar/i.test(name)) continue;
    const lines = parseBbsRows(sheetRows(wb, name)).filter((r) => r.rowKind !== "header" || (r.location && !r.diameterMm));
    const dataLines = lines.filter((r) => r.rowKind !== "header" && (r.diameterMm || r.totalLength || r.weightKg));
    if (dataLines.length || lines.length >= 3)
      out.push({ sheetName: name, packageName: pkg || name.replace(/\s*BBS\s*/i, " BBS").trim(), lines });
  }
  return out;
}

export function isFullSpdcWorkbook(buffer: Buffer): boolean {
  const wb = workbookFromBuffer(buffer);
  const names = wb.SheetNames.join(" ").toLowerCase();
  return /budget|monitoring|dormitory mb|dormitory bbs/.test(names);
}

export function parseMbBuffer(buffer: Buffer): ParsedMbLine[] {
  if (isFullSpdcWorkbook(buffer)) {
    const all = parseAllMbSheets(buffer);
    if (all.length === 1) return all[0]!.lines;
    if (all.length > 1) return bestSheetParse(buffer, parseMbRows, /mb|dormitory|compound|ugwt|septic|road|plumb|electric|fire|gas|wall|paving|door|window|furniture/i);
  }
  return bestSheetParse(buffer, parseMbRows, /mb|dormitory|compound|ugwt|septic|road|plumb|electric|fire|gas|wall|paving|door|window|furniture/i);
}

export function parseBbsBuffer(buffer: Buffer): ParsedBbsLine[] {
  return bestSheetParse(buffer, parseBbsRows, /bbs|bending|rebar|bar/i);
}
