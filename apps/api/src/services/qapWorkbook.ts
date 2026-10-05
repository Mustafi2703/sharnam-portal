/**
 * Sharnam-branded Quality Assurance Plan workbook — same columns and row positions as
 * Quality Assurance Plan Week 50.xlsx (so it imports straight back), with SPDC colours,
 * drop-down pickers, Yes / No colour coding and spare rows for the office to add lines.
 */
import ExcelJS from "exceljs";
import { QAP_LEGENDS, QAP_PICKERS } from "@sharnam/shared";
import { sharnamLogoPath } from "./brandedExport.js";

const NAVY = "FF1E3A5F";
const NAVY_SOFT = "FFDCE6F0";
const SAND = "FFF4F0E6";
const ORANGE = "FFF5A623";
const ORANGE_SOFT = "FFFFF1D6";
const GRID = "FFB8C2CC";
const WHITE = "FFFFFFFF";
const OK = { bg: "FFC6EFCE", fg: "FF006100" };
const BAD = { bg: "FFFFC7CE", fg: "FF9C0006" };
const WARN = { bg: "FFFFEB9C", fg: "FF9C5700" };
const COMPANY = "SHARNAM PROJECT DEVELOPMENT CONSULTANTS & CO. (SPDC)";

/** Spare formatted rows (with pickers) left under the data for new lines. */
const SPARE_ROWS = 40;
/** Header row with the dates (Excel row 8) and first data row (row 10) — the importer reads these. */
const DATE_ROW = 8;
const FIRST_DATA_ROW = 10;
const DAY_COLS = 7;
const FIRST_DAY_COL = 13; // M

export type QapExportRow = {
  srNo?: string | null;
  section?: string | null;
  activity?: string | null;
  description?: string | null;
  frequency?: string | null;
  codeOfConformance?: string | null;
  testAgency?: string | null;
  contractorPerformer?: string | null;
  contractorChecker?: string | null;
  pmcRole?: string | null;
  clientRole?: string | null;
  records?: string | null;
  remarks?: string | null;
  status?: string | null;
  dailyChecks?: string | null;
};

export type QapExportProject = {
  code: string;
  name: string;
  location?: string | null;
  clientName?: string | null;
  designConsultant?: string | null;
  pmcName?: string | null;
  contractorName?: string | null;
};

const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin" as const, color: { argb: GRID } };
const box: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

function parseDaily(raw?: string | null): Record<string, boolean> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The 7 day columns: the dates already ticked on these rows, filled out to a full week. */
export function qapWeekDays(rows: QapExportRow[]): string[] {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(parseDaily(r.dailyChecks))) keys.add(k);
  const dated = [...keys].filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  let start: Date;
  if (dated.length) {
    start = new Date(`${dated[0]}T00:00:00Z`);
  } else {
    const now = new Date();
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dow = (start.getUTCDay() + 6) % 7; // Monday = 0
    start.setUTCDate(start.getUTCDate() - dow);
  }
  const out: string[] = [];
  for (let i = 0; i < DAY_COLS; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push(isoDay(d));
  }
  return out;
}

const col = (n: number) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export async function buildQapWorkbook(project: QapExportProject, rows: QapExportRow[], weekLabel: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY;
  wb.created = new Date();
  const ws = wb.addWorksheet("Sheet1", {
    properties: { defaultRowHeight: 18 },
    views: [{ state: "frozen", xSplit: 3, ySplit: 9, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  ws.headerFooter.oddFooter = `&L&8${COMPANY}&C&8Quality Assurance Plan · ${project.code} · ${weekLabel}&R&8Page &P of &N`;

  const widths = [7, 22, 42, 20, 24, 20, 13, 13, 12, 12, 24, 15, ...Array(DAY_COLS).fill(10)];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const lastCol = widths.length; // S
  const font = (extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Arial", size: 9, ...extra });

  // Row 1 — logo band + title
  ws.getRow(1).height = 46;
  ws.mergeCells(1, 1, 1, 2);
  ws.getCell(1, 1).fill = solid(WHITE);
  ws.mergeCells(1, 3, 1, 12);
  const title = ws.getCell(1, 3);
  title.value = "QUALITY ASSURANCE PLAN";
  title.font = font({ bold: true, size: 16, color: { argb: WHITE } });
  title.fill = solid(NAVY);
  title.alignment = { vertical: "middle", horizontal: "center" };
  ws.mergeCells(1, 13, 1, lastCol);
  const co = ws.getCell(1, 13);
  co.value = COMPANY;
  co.font = font({ bold: true, size: 9, color: { argb: WHITE } });
  co.fill = solid(NAVY);
  co.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  const logo = sharnamLogoPath();
  if (logo) {
    const imgId = wb.addImage({ filename: logo, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0.15, row: 0.12 }, ext: { width: 150, height: 48 }, editAs: "oneCell" });
  }

  // Rows 2–6 — project block, legends, log notes
  const meta: [string, string][] = [
    ["Project", [project.name, project.location].filter(Boolean).join(" — ")],
    ["Client", project.clientName || ""],
    ["Design Consultant", project.designConsultant || ""],
    ["PM Consultant", project.pmcName || "Sharnam Project Development Consultants & Co. (SPDC)"],
    ["Contractor", project.contractorName || ""],
  ];
  meta.forEach(([label, value], i) => {
    const r = 2 + i;
    ws.getRow(r).height = 20;
    ws.mergeCells(r, 1, r, 2);
    const l = ws.getCell(r, 1);
    l.value = label;
    l.font = font({ bold: true, color: { argb: NAVY } });
    l.fill = solid(NAVY_SOFT);
    l.alignment = { vertical: "middle", indent: 1 };
    l.border = box;
    ws.mergeCells(r, 3, r, 5);
    const v = ws.getCell(r, 3);
    v.value = value;
    v.font = font({ bold: true });
    v.alignment = { vertical: "middle", wrapText: true };
    v.border = box;
  });

  ws.mergeCells(2, 6, 2, 12);
  const lg = ws.getCell(2, 6);
  lg.value = "LEGENDS";
  lg.font = font({ bold: true, color: { argb: NAVY } });
  lg.fill = solid(ORANGE);
  lg.alignment = { horizontal: "center", vertical: "middle" };
  lg.border = box;
  // 3 legend pairs per row in F:G, H:I, J:L (as in the client sheet)
  const legendSpans: [number, number][] = [
    [6, 7],
    [8, 9],
    [10, 12],
  ];
  QAP_LEGENDS.forEach(([abbr, full], i) => {
    const r = 3 + Math.floor(i / 3);
    const [c1, c2] = legendSpans[i % 3];
    ws.mergeCells(r, c1, r, c2);
    const c = ws.getCell(r, c1);
    c.value = { richText: [{ text: `${abbr} `, font: font({ bold: true, color: { argb: NAVY } }) }, { text: `- ${full}`, font: font() }] };
    c.fill = solid(ORANGE_SOFT);
    c.alignment = { vertical: "middle", wrapText: true };
    c.border = box;
  });

  ws.mergeCells(2, 13, 2, lastCol);
  const qc = ws.getCell(2, 13);
  qc.value = "QUALITY CONTROL LOGS";
  qc.font = font({ bold: true, color: { argb: NAVY } });
  qc.fill = solid(ORANGE);
  qc.alignment = { horizontal: "center", vertical: "middle" };
  qc.border = box;
  const logKey: [string, string, { bg: string; fg: string } | null][] = [
    ["Yes", "Check done and recorded on this date", OK],
    ["No", "Check due but not done — follow up", BAD],
    ["-", "Not applicable on this date", null],
    ["", "Mark each entry daily. Reviewed in the weekly quality meeting.", null],
  ];
  logKey.forEach(([mark, text, tone], i) => {
    const r = 3 + i;
    const k = ws.getCell(r, 13);
    k.value = mark;
    k.font = font({ bold: true, color: { argb: tone?.fg || NAVY } });
    k.fill = solid(tone?.bg || ORANGE_SOFT);
    k.alignment = { horizontal: "center", vertical: "middle" };
    k.border = box;
    ws.mergeCells(r, 14, r, lastCol);
    const t = ws.getCell(r, 14);
    t.value = text;
    t.font = font();
    t.fill = solid(ORANGE_SOFT);
    t.alignment = { vertical: "middle", wrapText: true };
    t.border = box;
  });

  // Row 7 — generated line + week
  ws.getRow(7).height = 20;
  ws.mergeCells(7, 1, 7, 12);
  const gen = ws.getCell(7, 1);
  gen.value = `Project ${project.code} · Generated ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · Sharnam portal`;
  gen.font = font({ italic: true, size: 8, color: { argb: "FF666666" } });
  gen.alignment = { vertical: "middle" };
  ws.mergeCells(7, 13, 7, lastCol);
  const wk = ws.getCell(7, 13);
  wk.value = weekLabel;
  wk.font = font({ bold: true, size: 11, color: { argb: WHITE } });
  wk.fill = solid(NAVY);
  wk.alignment = { horizontal: "center", vertical: "middle" };

  // Rows 8–9 — two-level header
  const days = qapWeekDays(rows);
  const head = (r1: number, c1: number, r2: number, c2: number, text: string) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
    const c = ws.getCell(r1, c1);
    c.value = text;
  };
  head(8, 1, 9, 1, "Sr.No.");
  head(8, 2, 9, 2, "Activity");
  head(8, 3, 9, 3, "Description of Activity / Material");
  head(8, 4, 9, 4, "Frequency of check");
  head(8, 5, 9, 5, "Code of Conformance");
  head(8, 6, 9, 6, "Test agency");
  head(8, 7, 8, 8, "Contractor");
  head(9, 7, 9, 7, "Performer");
  head(9, 8, 9, 8, "Checker");
  head(8, 9, 8, 9, "PMC");
  head(9, 9, 9, 9, "Checker");
  head(8, 10, 8, 10, "CLIENT");
  head(9, 10, 9, 10, "Checker");
  head(8, 11, 9, 11, "Records and documents to be Maintained");
  head(8, 12, 9, 12, "Remarks if any");
  days.forEach((d, i) => {
    const c = FIRST_DAY_COL + i;
    const date = new Date(`${d}T00:00:00Z`);
    ws.getCell(DATE_ROW, c).value = date;
    ws.getCell(DATE_ROW, c).numFmt = "dd-mmm-yy";
    ws.getCell(9, c).value = date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  });
  for (const r of [8, 9]) {
    ws.getRow(r).height = r === 8 ? 24 : 18;
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      cell.font = font({ bold: true, color: { argb: WHITE } });
      cell.fill = solid(NAVY);
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
    }
  }

  // Data — one row per QAP line, Sr.No. + Activity merged down each section
  let r = FIRST_DATA_ROW;
  let sectionIdx = 0;
  let i = 0;
  while (i < rows.length) {
    const section = rows[i].section || rows[i].activity || "General";
    let j = i;
    while (j + 1 < rows.length && (rows[j + 1].section || rows[j + 1].activity || "General") === section) j++;
    sectionIdx++;
    const band = sectionIdx % 2 === 0 ? SAND : WHITE;
    const sr = rows[i].srNo || String(sectionIdx);
    const top = r;
    for (let k = i; k <= j; k++, r++) {
      const q = rows[k];
      const daily = parseDaily(q.dailyChecks);
      const values: (string | null)[] = [
        k === i ? sr : null,
        k === i ? section : null,
        q.description || "",
        q.frequency || "",
        q.codeOfConformance || "",
        q.testAgency || "",
        q.contractorPerformer || "",
        q.contractorChecker || "",
        q.pmcRole || "",
        q.clientRole || "",
        q.records || "",
        q.remarks || "",
        ...days.map((d) => (daily[d] ? "Yes" : "")),
      ];
      values.forEach((v, idx) => {
        const cell = ws.getCell(r, idx + 1);
        if (v !== null) cell.value = v;
        cell.font = font(idx <= 1 ? { bold: true, color: { argb: NAVY } } : {});
        cell.fill = solid(band);
        cell.border = box;
        cell.alignment = {
          vertical: idx <= 1 ? "middle" : "top",
          horizontal: idx === 0 || idx >= 6 ? "center" : "left",
          wrapText: true,
        };
      });
    }
    if (r - 1 > top) {
      ws.mergeCells(top, 1, r - 1, 1);
      ws.mergeCells(top, 2, r - 1, 2);
    }
    i = j + 1;
  }
  const lastDataRow = r - 1;

  // Spare rows so new lines can be added in Excel with the same pickers
  for (let k = 0; k < SPARE_ROWS; k++, r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      cell.font = font();
      cell.border = box;
      cell.alignment = { vertical: "top", horizontal: c === 1 || c >= 7 ? "center" : "left", wrapText: true };
    }
  }
  const lastRow = r - 1;

  // Picker lists on a hidden sheet (Excel inline lists are limited to 255 characters)
  const lists = wb.addWorksheet("Lists", { state: "veryHidden" });
  const listKeys = [
    "section",
    "frequency",
    "codeOfConformance",
    "testAgency",
    "contractorPerformer",
    "contractorChecker",
    "pmcRole",
    "clientRole",
    "records",
    "remarks",
    "daily",
  ] as const;
  const listRange: Record<string, string> = {};
  listKeys.forEach((key, idx) => {
    const c = idx + 1;
    lists.getCell(1, c).value = key;
    const vals = QAP_PICKERS[key] as readonly string[];
    vals.forEach((v, n) => (lists.getCell(n + 2, c).value = v));
    listRange[key] = `Lists!$${col(c)}$2:$${col(c)}$${vals.length + 1}`;
  });

  const picker = (columnIndex: number, key: (typeof listKeys)[number], fromRow = FIRST_DATA_ROW) => {
    for (let row = fromRow; row <= lastRow; row++) {
      ws.getCell(row, columnIndex).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [listRange[key]],
        showErrorMessage: false, // pick from the list or type your own
        showInputMessage: false,
      };
    }
  };
  // Activity picker only on spare rows (existing sections are merged blocks)
  picker(2, "section", lastDataRow + 1);
  picker(4, "frequency");
  picker(5, "codeOfConformance");
  picker(6, "testAgency");
  picker(7, "contractorPerformer");
  picker(8, "contractorChecker");
  picker(9, "pmcRole");
  picker(10, "clientRole");
  picker(11, "records");
  picker(12, "remarks");
  for (let d = 0; d < DAY_COLS; d++) picker(FIRST_DAY_COL + d, "daily");

  // Colour coding, live in Excel as people type
  const dayRange = `${col(FIRST_DAY_COL)}${FIRST_DATA_ROW}:${col(FIRST_DAY_COL + DAY_COLS - 1)}${lastRow}`;
  const remarksRange = `L${FIRST_DATA_ROW}:L${lastRow}`;
  const tone = (t: { bg: string; fg: string }) => ({
    fill: { type: "pattern" as const, pattern: "solid" as const, bgColor: { argb: t.bg } },
    font: { color: { argb: t.fg }, bold: true },
  });
  const textRule = (ref: string, text: string, t: { bg: string; fg: string }, priority: number) => ({
    type: "containsText" as const,
    operator: "containsText" as const,
    text,
    priority,
    style: tone(t),
    formulae: [`NOT(ISERROR(SEARCH("${text}",${ref})))`],
  });
  ws.addConditionalFormatting({
    ref: dayRange,
    rules: [
      { type: "cellIs", operator: "equal", formulae: ['"Yes"'], priority: 1, style: tone(OK) },
      { type: "cellIs", operator: "equal", formulae: ['"No"'], priority: 2, style: tone(BAD) },
    ],
  });
  ws.addConditionalFormatting({
    ref: remarksRange,
    rules: [
      textRule(`L${FIRST_DATA_ROW}`, "Completed", OK, 3),
      textRule(`L${FIRST_DATA_ROW}`, "Pending", BAD, 4),
      textRule(`L${FIRST_DATA_ROW}`, "In Progress", WARN, 5),
    ],
  });

  ws.autoFilter = { from: { row: 9, column: 1 }, to: { row: Math.max(lastDataRow, 9), column: lastCol } };
  ws.pageSetup.printTitlesRow = "8:9";

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
