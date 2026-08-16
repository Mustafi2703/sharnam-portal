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

function parseMbRows(rows: unknown[][]): ParsedMbLine[] {
  let header = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const a = s((rows[i] as unknown[])[0]).toLowerCase();
    const b = s((rows[i] as unknown[])[1]).toLowerCase();
    if ((a.includes("sr") || a === "1") && (b.includes("desc") || b.includes("item") || b.includes("particular"))) {
      header = i;
      break;
    }
  }
  const start = header >= 0 ? header + 1 : 0;
  const out: ParsedMbLine[] = [];
  for (let i = start; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const description = s(row[1], 400) || s(row[0], 400);
    if (!description || /total up to date|previous bill|this bill|name of project|name of contractor|w\.o\. no/i.test(description))
      continue;
    const qty = n(row[7]);
    const nos1 = n(row[2]);
    const nos2 = n(row[3]) || 1;
    const length = n(row[4]);
    const width = n(row[5]);
    const height = n(row[6]);
    if (!qty && !nos1 && !length && !width && !height) continue;
    out.push({
      srNo: s(row[0], 40) || undefined,
      itemCode: /^\d+$/.test(s(row[0], 40)) ? s(row[0], 40) : undefined,
      description,
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

function parseBbsRows(rows: unknown[][]): ParsedBbsLine[] {
  let start = 6;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const joined = (rows[i] as unknown[]).map((c) => s(c, 40)).join(" ").toLowerCase();
    if (/bar bending|bbs|mark|dia/.test(joined)) {
      start = i + 1;
      break;
    }
  }

  const out: ParsedBbsLine[] = [];
  let currentSection = "";
  let currentShapeCode = "";

  for (let i = start; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const markRaw = s(row[0], 40);
    const description = s(row[1], 300);
    const shapeCell = s(row[2], 80);
    const dia = n(row[8]) || n(row[3]);
    const totalLen = n(row[18]) || n(row[17]) || n(row[6]);
    const nosPerMember = n(row[9]);
    const nosOfMember = n(row[10]);
    const nos = n(row[11]) || (nosPerMember && nosOfMember ? nosPerMember * nosOfMember : n(row[5]));

    if (!description && !markRaw) continue;
    if (/name of project|bar bending schedule|project development consultancy/i.test(description)) continue;

    // Section / shape-code header rows (A, 1, FOOTING, etc.)
    if (markRaw && !dia && !totalLen && !nos && description) {
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
    if (/sr\.?\s*no|description|shape of bar/i.test(description)) continue;

    // Numeric value in shape column = bend dimension sketch text, not a code
    const shapeFromCell = shapeCell && !/^[\d.]+$/.test(shapeCell) ? shapeCell : undefined;

    if (!dia && !totalLen && !nos && !shapeFromCell) {
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

    if (dia > 100 || totalLen > 500) continue;

    const weight =
      dia && totalLen ? (Math.PI * (dia / 1000 / 2) ** 2 * totalLen * 7850) / 1000 : n(row[19]) || 0;

    out.push({
      barMark: markRaw || currentSection || undefined,
      shapeCode: currentShapeCode || (markRaw && /^[A-Z0-9]{1,4}$/i.test(markRaw) ? markRaw.toUpperCase() : undefined),
      sectionMark: currentSection || undefined,
      itemCode: markRaw && /^\d+$/.test(markRaw) ? markRaw : undefined,
      diameterMm: dia,
      shape: shapeFromCell,
      lengthMm: n(row[17]) || n(row[12]) || n(row[4]),
      nos: nos || 1,
      nosPerMember,
      nosOfMember,
      shapeLenA: n(row[12]),
      shapeLenB: n(row[13]),
      shapeLenC: n(row[14]),
      shapeLenD: n(row[15]),
      shapeLenE: n(row[16]),
      totalLength: totalLen,
      weightKg: Math.round(weight * 100) / 100,
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

export function parseMbBuffer(buffer: Buffer): ParsedMbLine[] {
  return bestSheetParse(buffer, parseMbRows, /mb|dormitory|compound|ugwt|septic|road|plumb|electric|fire|gas|wall|paving|door|window|furniture/i);
}

export function parseBbsBuffer(buffer: Buffer): ParsedBbsLine[] {
  return bestSheetParse(buffer, parseBbsRows, /bbs|bending|rebar|bar/i);
}
