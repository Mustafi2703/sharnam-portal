/**
 * CRM Comparative Statement — SPDC R2 workbook pattern.
 * summary + master BOQ compare + per-discipline vendor BOQ uploads.
 */
import XLSX, { type WorkBook, type WorkSheet, type CellObject } from "../lib/xlsx.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  type SheetCell,
  evaluateAllRows,
  sheetCellsToAoa,
  applyFormulasToWorksheet,
} from "@sharnam/shared";

/** Discipline BOQ sheets in Comparative Statement R2 (vendor uploads one file per discipline). */
export const COMPARATIVE_DISCIPLINES = [
  { key: "CCV", label: "Civil & Structural (CCV)", sheetName: "BOQ-CCV" },
  { key: "ELE_LAB", label: "Electrical Lab", sheetName: "BOQ ELE. LAB" },
  { key: "ADMIN", label: "Admin Building", sheetName: "BOQ-ADMIN" },
  { key: "SECURITY", label: "Security", sheetName: "BOQ -SECURITY" },
  { key: "COOLING_TOWER", label: "Cooling Tower", sheetName: "BOQ -COOLING TOWER" },
  { key: "WEIGH_BRIDGE", label: "Weigh Bridge", sheetName: "BOQ -WEIGH BRIDGE" },
  { key: "UG_TANK", label: "U.G Tank + Pump Room", sheetName: "BOQ -U.G TANK WITH PUMP ROOM" },
  { key: "ENTRANCE_GATE", label: "Entrance Gate", sheetName: "BOQ -ENTRANCE GATE" },
] as const;

export type ComparativeDisciplineKey = (typeof COMPARATIVE_DISCIPLINES)[number]["key"];

export type DisciplineDef = { key: string; label: string; sheetName: string };

export function defaultDisciplines(): DisciplineDef[] {
  return COMPARATIVE_DISCIPLINES.map((d) => ({ ...d }));
}

export function normalizeDisciplineKey(input: string): string {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function parseDisciplinesJson(json: string | null | undefined): DisciplineDef[] {
  if (!json) return defaultDisciplines();
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || !parsed.length) return defaultDisciplines();
    return parsed
      .map((d: { key?: string; label?: string; sheetName?: string }) => ({
        key: normalizeDisciplineKey(d.key || d.label || ""),
        label: String(d.label || d.key || "").trim(),
        sheetName: String(d.sheetName || d.label || d.key || "").trim(),
      }))
      .filter((d) => d.key && d.label);
  } catch {
    return defaultDisciplines();
  }
}

/** Parse stored project bid disciplines — returns null when unset (distinct from full catalog default). */
export function parseStoredBidDisciplinesJson(json: string | null | undefined): DisciplineDef[] | null {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const rows = parsed
      .map((d: { key?: string; label?: string; sheetName?: string }) => ({
        key: normalizeDisciplineKey(d.key || d.label || ""),
        label: String(d.label || d.key || "").trim(),
        sheetName: String(d.sheetName || d.label || d.key || "").trim(),
      }))
      .filter((d) => d.key && d.label);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

/** Each org work-package name is one bid discipline (not mapped to R2 catalog sheets). */
export function disciplinesFromWorkPackages(workPackages: string[]): DisciplineDef[] {
  const seen = new Set<string>();
  const out: DisciplineDef[] = [];
  for (const raw of workPackages) {
    const pkg = String(raw || "").trim();
    if (!pkg) continue;
    const key = normalizeDisciplineKey(pkg);
    if (seen.has(key)) continue;
    seen.add(key);
    const sheetSlug = pkg.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().slice(0, 28);
    out.push({
      key,
      label: pkg,
      sheetName: sheetSlug ? `BOQ-${sheetSlug}` : `BOQ-${key}`,
    });
  }
  return out;
}

export function resolveProjectBidDisciplines(opts: {
  bidDisciplinesJson?: string | null;
  workPackages?: string[];
}): { disciplines: DisciplineDef[]; source: "saved" | "work_packages" | "default" } {
  const fromPackages = opts.workPackages?.length ? disciplinesFromWorkPackages(opts.workPackages) : [];
  if (fromPackages.length) return { disciplines: fromPackages, source: "work_packages" };
  const saved = parseStoredBidDisciplinesJson(opts.bidDisciplinesJson);
  if (saved?.length) return { disciplines: saved, source: "saved" };
  return { disciplines: defaultDisciplines(), source: "default" };
}

/** Resolve discipline list from explicit keys + optional custom entries + project defaults. */
export function resolveDisciplinesForPackage(opts: {
  disciplineKeys?: string[];
  customDisciplines?: DisciplineDef[];
  projectDisciplinesJson?: string | null;
  packageDisciplinesJson?: string | null;
  workPackages?: string[];
}): DisciplineDef[] {
  const catalog = defaultDisciplines();
  const byKey = Object.fromEntries(catalog.map((d) => [d.key, d]));
  const fromWorkPackages = opts.workPackages?.length ? disciplinesFromWorkPackages(opts.workPackages) : [];
  const wpByKey = Object.fromEntries(fromWorkPackages.map((d) => [d.key, d]));
  const savedProject = parseStoredBidDisciplinesJson(opts.projectDisciplinesJson) || [];
  const savedByKey = Object.fromEntries(savedProject.map((d) => [d.key, d]));

  if (opts.packageDisciplinesJson) {
    const pkg = parseDisciplinesJson(opts.packageDisciplinesJson);
    if (pkg.length) return pkg;
  }

  const custom = (opts.customDisciplines || []).map((d) => ({
    key: normalizeDisciplineKey(d.key || d.label),
    label: d.label.trim(),
    sheetName: d.sheetName.trim() || d.label.trim(),
  }));
  const customByKey = Object.fromEntries(custom.map((d) => [d.key, d]));

  if (opts.disciplineKeys?.length) {
    const picked = opts.disciplineKeys
      .map((k) => {
        const nk = normalizeDisciplineKey(k);
        return wpByKey[nk] || savedByKey[nk] || customByKey[nk] || byKey[nk];
      })
      .filter(Boolean) as DisciplineDef[];
    const extras = custom.filter((c) => !picked.some((p) => p.key === c.key));
    const merged = [...picked, ...extras];
    if (merged.length) return merged;
  }

  if (fromWorkPackages.length) return fromWorkPackages;

  if (savedProject.length) return savedProject;

  return catalog;
}

export function disciplineCatalogEntry(key: string, disciplines?: DisciplineDef[]): DisciplineDef | undefined {
  const list = disciplines || defaultDisciplines();
  return list.find((d) => d.key === key) || defaultDisciplines().find((d) => d.key === key);
}

export type ComparativeSummary = {
  vendorLabels: string[];
  sectionTotals: { section: string; title: string; totals: Record<string, number> }[];
  grandTotals: Record<string, number>;
  lowestVendor?: string;
  l1VsOthers?: Record<string, number>;
};

export type ImportedSheet = {
  headers: string[];
  rows: SheetCell[][];
  sheetName: string;
};

export function resolveR2TemplatePath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.join(here, "..", "..", "..", "..");
  const candidates = [
    path.join(repoRoot, "templates", "Comparative-Statement-R2.xlsx"),
    path.join(repoRoot, "seed", "data", "Comparative Statement - R2.xlsx"),
    path.join(process.cwd(), "templates", "Comparative-Statement-R2.xlsx"),
    path.join(process.cwd(), "Sharnam_modules_docs", "Comparative Statement - R2.xlsx"),
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", "Comparative Statement - R2.xlsx"),
    path.join(process.cwd(), "seed", "data", "Comparative Statement - R2.xlsx"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Comparative Statement R2 template not found");
}

function numCell(cell?: SheetCell): number {
  const n = Number(cell?.computed ?? cell?.raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Summary tab — keep Excel cached numeric values (cross-sheet refs break evaluateAllRows). */
function parseR2SummaryWorksheet(ws: WorkSheet): ImportedSheet {
  const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" }) as unknown[][];
  const rows: SheetCell[][] = aoa.map((src) =>
    src.map((c) => {
      if (typeof c === "number") return { raw: String(c), computed: c };
      const t = String(c ?? "").trim();
      return t ? { raw: t } : { raw: "" };
    })
  );
  return { headers: [], rows, sheetName: "summary" };
}

function parseWorksheet(ws: WorkSheet, sheetName: string): ImportedSheet {
  const ref = ws["!ref"];
  if (!ref) return { headers: [], rows: [], sheetName };

  const range = XLSX.utils.decode_range(ref);
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
    const cell = ws[addr] as CellObject | undefined;
    headers.push(cell?.v != null && String(cell.v).trim() ? String(cell.v) : `Column ${c - range.s.c + 1}`);
  }

  const rows: SheetCell[][] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row: SheetCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as CellObject | undefined;
      if (cell?.f) {
        const formula = cell.f.startsWith("=") ? cell.f : `=${cell.f}`;
        const cv = cell.v;
        const computed =
          typeof cv === "number" || typeof cv === "string" ? cv : cv != null ? String(cv) : null;
        row.push({ raw: formula, computed });
      } else if (cell?.v != null) {
        row.push({ raw: String(cell.v) });
      } else {
        row.push({ raw: "" });
      }
    }
    rows.push(row);
  }
  return { headers, rows: evaluateAllRows(rows), sheetName };
}

/** Master BOQ sheet uses two header rows (vendor + RATE/GRAND TOTAL). */
function parseMasterBoqSheet(ws: WorkSheet): ImportedSheet {
  const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" }) as unknown[][];
  let headerIdx = aoa.findIndex((r) => {
    const line = r.map((c) => String(c).toLowerCase()).join(" ");
    return line.includes("sr") && line.includes("description");
  });
  if (headerIdx < 0) headerIdx = 0;

  const rowA = aoa[headerIdx] || [];
  const rowB = aoa[headerIdx + 1] || [];
  const maxCols = Math.max(rowA.length, rowB.length, ...aoa.slice(headerIdx + 2, headerIdx + 12).map((r) => r.length));
  const headers: string[] = [];
  for (let i = 0; i < maxCols; i++) {
    const a = String(rowA[i] ?? "").trim();
    const b = String(rowB[i] ?? "").trim();
    if (a && b && b !== a) headers.push(`${a} — ${b}`);
    else headers.push(a || b || `Column ${i + 1}`);
  }

  const rows: SheetCell[][] = [];
  for (let ri = headerIdx + 2; ri < aoa.length; ri++) {
    const src = aoa[ri] || [];
    if (!src.some((c) => String(c).trim())) continue;
    const row: SheetCell[] = headers.map((_, ci) => ({ raw: src[ci] != null ? String(src[ci]) : "" }));
    rows.push(row);
  }
  return { headers, rows: evaluateAllRows(rows), sheetName: "BOQ" };
}

function normalizeSheetKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function findWorksheet(wb: WorkBook, target: string): WorkSheet | null {
  const key = normalizeSheetKey(target);
  const hit = wb.SheetNames.find((n: string) => normalizeSheetKey(n) === key || normalizeSheetKey(n).includes(key));
  return hit ? wb.Sheets[hit] : null;
}

export function importR2WorkbookFromBuffer(buffer: Buffer, vendorLabels?: string[]) {
  const wb = XLSX.read(buffer, { type: "buffer", cellFormula: true });
  const summaryWs = findWorksheet(wb, "summary") || wb.Sheets[wb.SheetNames[0]];
  const masterWs = findWorksheet(wb, "BOQ") || wb.Sheets[wb.SheetNames[1]];

  const summary = parseR2SummaryWorksheet(summaryWs);
  const masterBoq = parseMasterBoqSheet(masterWs);

  if (vendorLabels?.length) {
    applyVendorLabelsToMasterBoq(masterBoq, vendorLabels);
    applyVendorLabelsToSummary(summary, vendorLabels);
  }

  const disciplineTemplates: Record<string, ImportedSheet> = {};
  for (const d of COMPARATIVE_DISCIPLINES) {
    const ws = findWorksheet(wb, d.sheetName);
    if (ws) disciplineTemplates[d.key] = parseWorksheet(ws, d.sheetName);
  }

  return { summary, masterBoq, disciplineTemplates, sheetNames: wb.SheetNames };
}

export function importR2WorkbookFromFile(filePath?: string, vendorLabels?: string[]) {
  const p = filePath || resolveR2TemplatePath();
  const buffer = fs.readFileSync(p);
  return importR2WorkbookFromBuffer(buffer, vendorLabels);
}

function applyVendorLabelsToMasterBoq(sheet: ImportedSheet, vendorLabels: string[]) {
  for (let i = 0; i < vendorLabels.length; i++) {
    const rateIdx = 4 + i * 2;
    const amtIdx = rateIdx + 1;
    if (rateIdx < sheet.headers.length) {
      sheet.headers[rateIdx] = `${vendorLabels[i]} — RATE`;
      if (amtIdx < sheet.headers.length) sheet.headers[amtIdx] = `${vendorLabels[i]} — GRAND TOTAL`;
    }
  }
}

function applyVendorLabelsToSummary(sheet: ImportedSheet, vendorLabels: string[]) {
  for (const row of sheet.rows) {
    for (let i = 0; i < vendorLabels.length; i++) {
      const col = 3 + i;
      if (col < row.length && String(row[0]?.raw ?? "").trim() === "3") {
        /* header row handled separately */
      }
    }
  }
  const headerRow = sheet.rows.find((r) =>
    String(r[0]?.raw ?? "")
      .toUpperCase()
      .includes("SR")
  );
  if (headerRow) {
    for (let i = 0; i < vendorLabels.length; i++) {
      const col = 3 + i;
      if (col < headerRow.length) headerRow[col] = { raw: vendorLabels[i] };
    }
  }
}

export function pickDisciplineWorksheet(
  wb: WorkBook,
  disciplineKey: string,
  disciplines?: DisciplineDef[]
): WorkSheet | null {
  const disc = disciplineCatalogEntry(disciplineKey, disciplines);
  if (!disc) return wb.Sheets[wb.SheetNames[0]] ?? null;
  return findWorksheet(wb, disc.sheetName) || wb.Sheets[wb.SheetNames[0]] || null;
}

export function parseDisciplineBoqSheet(
  ws: WorkSheet,
  disciplineKey: string,
  disciplines?: DisciplineDef[]
): ImportedSheet {
  const disc = disciplineCatalogEntry(disciplineKey, disciplines);
  const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" }) as unknown[][];
  let headerIdx = aoa.findIndex((r) => {
    const line = r.map((c) => String(c).toLowerCase()).join(" ");
    const hasDesc = line.includes("description") || line.includes("particular");
    const hasSr = line.includes("sr") || line.includes("item no") || line.includes("s.no");
    const hasQty = line.includes("qty") || line.includes("quantity");
    const hasUnit = line.includes("unit") || line.includes("uom");
    return (hasSr && hasDesc) || (hasDesc && hasQty && hasUnit);
  });
  if (headerIdx < 0) {
    headerIdx = aoa.findIndex((r) => {
      const line = r.map((c) => String(c).toLowerCase()).join(" ");
      return line.includes("description") && (line.includes("rate") || line.includes("qty"));
    });
  }
  if (headerIdx < 0) headerIdx = 4;

  const headers = (aoa[headerIdx] || []).map((c, i) => (String(c).trim() ? String(c) : `Column ${i + 1}`));
  const rows: SheetCell[][] = [];
  for (let ri = headerIdx + 1; ri < aoa.length; ri++) {
    const src = aoa[ri] || [];
    if (!src.some((c) => String(c).trim())) continue;
    rows.push(headers.map((_, ci) => ({ raw: src[ci] != null ? String(src[ci]) : "" })));
  }
  return {
    headers,
    rows: evaluateAllRows(rows),
    sheetName: disc?.sheetName || disciplineKey,
  };
}

/** Parse R2 summary tab — section totals + grand total per vendor column. */
export function parseR2SummarySheet(headers: string[], rows: SheetCell[][]): ComparativeSummary {
  const vendorLabels: string[] = [];
  const headerRow = rows.find((r) => {
    const c0 = String(r[0]?.raw ?? "").toUpperCase();
    return c0.includes("SR") && String(r[1]?.raw ?? "").toUpperCase().includes("SECTION");
  });
  if (headerRow) {
    for (let c = 3; c < headerRow.length; c++) {
      const v = String(headerRow[c]?.raw ?? "").trim();
      if (v && !v.toUpperCase().includes("GRAND TOTAL")) vendorLabels.push(v);
    }
  }

  const sectionTotals: ComparativeSummary["sectionTotals"] = [];
  const grandTotals: Record<string, number> = {};
  for (const v of vendorLabels) grandTotals[v] = 0;

  for (const row of rows) {
    const sr = String(row[0]?.raw ?? "").trim();
    const section = String(row[1]?.raw ?? "").trim();
    const title = String(row[2]?.raw ?? "").trim();
    const line0 = sr.toUpperCase();

    if (line0.includes("TOTAL AMOUNT OF TENDER")) {
      for (let i = 0; i < vendorLabels.length; i++) {
        grandTotals[vendorLabels[i]] = numCell(row[3 + i]);
      }
      continue;
    }

    if (!section || !sr || Number.isNaN(Number(sr))) continue;
    if (!section.toUpperCase().includes("SECTION")) continue;

    const totals: Record<string, number> = {};
    for (let i = 0; i < vendorLabels.length; i++) {
      totals[vendorLabels[i]] = numCell(row[3 + i]);
    }
    sectionTotals.push({ section, title, totals });
  }

  let lowestVendor: string | undefined;
  let lowest = Infinity;
  for (const [v, t] of Object.entries(grandTotals)) {
    if (t > 0 && t < lowest) {
      lowest = t;
      lowestVendor = v;
    }
  }

  const l1VsOthers: Record<string, number> = {};
  if (lowestVendor && lowest > 0) {
    for (const [v, t] of Object.entries(grandTotals)) {
      if (v !== lowestVendor && t > 0) l1VsOthers[v] = (t - lowest) / lowest;
    }
  }

  return { vendorLabels, sectionTotals, grandTotals, lowestVendor, l1VsOthers };
}

export function writeComparativeTemplateFile(outPath: string) {
  const src = resolveR2TemplatePath();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.copyFileSync(src, outPath);
}

export function comparativeToWorkbook(headers: string[], rows: SheetCell[][], sheetName = "Sheet1"): WorkBook {
  const evaluated = evaluateAllRows(rows);
  const { data, formulas } = sheetCellsToAoa(headers, evaluated);
  const ws = XLSX.utils.aoa_to_sheet(data);
  applyFormulasToWorksheet(ws as Record<string, unknown>, formulas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return wb;
}

/** @deprecated use parseR2SummarySheet */
export function parseComparativeSummary(headers: string[], rows: SheetCell[][]): ComparativeSummary {
  return parseR2SummarySheet(headers, rows);
}

export function buildVendorDisciplineSlots(vendorNames: string[], disciplines: DisciplineDef[] = defaultDisciplines()) {
  const slots: { vendorLabel: string; discipline: string }[] = [];
  for (const vendorLabel of vendorNames) {
    for (const d of disciplines) {
      slots.push({ vendorLabel, discipline: d.key });
    }
  }
  return slots;
}

/** Clear rate cells — vendors fill Qty + Rate only; amount stays formula/read-only. */
export function blankVendorRates(sheet: ImportedSheet): ImportedSheet {
  const lower = sheet.headers.map((h) => String(h).toLowerCase());
  const rateCols = new Set<number>();
  for (let i = 0; i < lower.length; i++) {
    if (lower[i].includes("rate")) rateCols.add(i);
  }
  if (!rateCols.size) return sheet;
  const rows = sheet.rows.map((row) =>
    row.map((c, ci) => {
      if (!rateCols.has(ci)) return { ...c };
      if (String(c.raw ?? "").trim().startsWith("=")) return { ...c };
      return { raw: "" };
    })
  );
  return { headers: sheet.headers, rows: evaluateAllRows(rows), sheetName: sheet.sheetName };
}

function blankRatesInWorksheet(ws: WorkSheet) {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  let headerRow = -1;
  const rateCols: number[] = [];
  for (let R = range.s.r; R <= Math.min(range.s.r + 20, range.e.r); R++) {
    const labels: string[] = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      labels.push(String(ws[addr]?.v ?? "").toLowerCase());
    }
    const line = labels.join(" ");
    if (line.includes("sr") && line.includes("description")) {
      headerRow = R;
      labels.forEach((h, i) => {
        if (h.includes("rate")) rateCols.push(range.s.c + i);
      });
      break;
    }
  }
  if (headerRow < 0 || !rateCols.length) return;
  for (let R = headerRow + 1; R <= range.e.r; R++) {
    for (const C of rateCols) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || cell.f) continue;
      cell.t = "s";
      cell.v = "";
      cell.w = "";
    }
  }
}

function stampVendorBanner(ws: WorkSheet, vendorLabel: string, projectCode?: string) {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let R = range.s.r; R <= Math.min(range.s.r + 8, range.e.r); R++) {
    for (let C = range.s.c; C <= Math.min(range.s.c + 3, range.e.c); C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const val = String(ws[addr]?.v ?? "").toLowerCase();
      if (val.includes("contractor") || val.includes("bidder") || val.includes("vendor")) {
        const next = XLSX.utils.encode_cell({ r: R, c: C + 1 });
        ws[next] = { t: "s", v: vendorLabel };
        return;
      }
    }
  }
  const bannerAddr = XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c });
  ws[bannerAddr] = {
    t: "s",
    v: `SPDC · ${projectCode || "Bid"} · Contractor: ${vendorLabel}`,
  };
}

/** Per-vendor × discipline BOQ sample — SPDC R2 sheet + instructions (separate file per contractor). */
export function buildVendorBoqTemplateXlsx(opts: {
  disciplineKey: string;
  vendorLabel: string;
  projectCode?: string;
  projectName?: string;
  pkgTitle?: string;
  revisionLabel?: string;
  disciplines?: DisciplineDef[];
  sheet?: ImportedSheet;
}): Buffer {
  const disc = disciplineCatalogEntry(opts.disciplineKey, opts.disciplines);
  const rev = opts.revisionLabel || "R2";
  const wb = XLSX.utils.book_new();

  const instructions: (string | number)[][] = [
    ["SHARNAM PROJECT MANAGEMENT CONSULTANTS PVT LTD (SPDC)"],
    [`Comparative Statement ${rev} — Vendor BOQ (sample format)`],
    [""],
    ["Project code", opts.projectCode || "—", "Project", opts.projectName || "—"],
    ["Bid package", opts.pkgTitle || "—"],
    ["Contractor / vendor", opts.vendorLabel],
    ["Work package / discipline", disc?.label || opts.disciplineKey],
    [""],
    ["Fill QTY and RATE columns only"],
    ["Description, unit, and amount columns are read-only on the portal — amount may auto-calculate in Excel."],
    ["One workbook per vendor × work package — do not share with other bidders."],
    ["Upload the filled file on Vendor bids desk, or use Fill BOQ online in the portal."],
    [""],
    ["Sheet tab", disc?.sheetName || opts.disciplineKey, "← fill rates on this tab"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), "SPDC Instructions");

  let attached = false;
  try {
    const src = resolveR2TemplatePath();
    const srcWb = XLSX.read(fs.readFileSync(src), { type: "buffer", cellFormula: true });
    const srcWs = pickDisciplineWorksheet(srcWb, opts.disciplineKey, opts.disciplines);
    if (srcWs) {
      blankRatesInWorksheet(srcWs);
      stampVendorBanner(srcWs, opts.vendorLabel, opts.projectCode);
      XLSX.utils.book_append_sheet(wb, srcWs, (disc?.sheetName || opts.disciplineKey).slice(0, 31));
      attached = true;
    }
  } catch {
    /* fallback below */
  }

  if (!attached) {
    let parsed: ImportedSheet;
    if (opts.sheet?.rows?.length) {
      parsed = opts.sheet;
    } else {
      const imported = importR2WorkbookFromFile();
      const template = imported.disciplineTemplates[opts.disciplineKey];
      parsed = template?.rows?.length
        ? blankVendorRates(template)
        : { headers: ["Sr. No.", "Description", "QTY.", "UNIT", "RATE", "AMOUNT"], rows: [], sheetName: disc?.sheetName || opts.disciplineKey };
    }
    const aoa = parsed.headers.length
      ? [parsed.headers, ...parsed.rows.map((row) => row.map((c) => c.computed ?? c.raw ?? ""))]
      : parsed.rows.map((row) => row.map((c) => c.computed ?? c.raw ?? ""));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), (disc?.sheetName || "BOQ").slice(0, 31));
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
