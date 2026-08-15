/**
 * DPR XLSX generator — template-based.
 *
 * We ship the seven official SPDC DPR templates under
 * `apps/api/dpr-templates/`. To produce a DPR we:
 *   1. Load the discipline's template (all styling, colours, print
 *      settings, conditional formatting and DASHBOARD formulas
 *      already live there).
 *   2. Poke each user-supplied value into its known cell on the
 *      INPUT sheet. That is the sheet the SPDC file explicitly says
 *      "TYPE ONLY IN THE YELLOW CELLS ON THIS SHEET."
 *   3. Add a PHOTOS sheet listing the SharePoint paths for site
 *      photos, PDF attachments and signatures.
 *   4. Save.
 *
 * The DASHBOARD sheet is untouched — Excel recomputes it from the
 * INPUT values via the formulas SPDC already put there, so the
 * dashboard we produce reads and prints identically to the reference.
 *
 * The 14 INPUT-sheet blocks (row numbers are constant across all
 * seven discipline files):
 *   1. Project header             rows 4-20
 *   2. Quantity progress          rows 24-38   (15 rows)
 *   3. Manpower deployed today    rows 42-47   (6 rows)
 *   4. Equipment deployed today   rows 51-56   (6 rows)
 *   5. Material at site           rows 60-65   (6 rows)
 *   6. Quality control & tests    rows 69-74   (6 rows)
 *   7. HSE / safety statistics    rows 78-83   (6 rows)
 *   8. Delay / idle time log      rows 87-90   (4 rows)
 *   9. Approvals pending          rows 94-97   (4 rows)
 *  10. Issues & risks             rows 101-104 (4 rows)
 *  11. Today's highlights         rows 107-110 (4 rows)
 *  12. Next day plan              rows 113-116 (4 rows)
 *  13. Decisions required         rows 119-121 (3 rows)
 *  14. S-curve history            rows 125-137 (13 rows — mostly formulas)
 */
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";
import { fillScurveHistorySheet, loadDprScurveHistory } from "./dprCharts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// After `tsc -b`, this file runs from `apps/api/dist/services/`, so the
// template dir sits one level higher, at `apps/api/dpr-templates/`.
// The dev entry (`tsx src/index.ts`) starts from `apps/api/src/services/`,
// so the same relative path works too.
const TEMPLATE_DIR = path.resolve(__dirname, "../../dpr-templates");

const TEMPLATE_FILE: Record<string, string> = {
  CIVIL: "SPDC_DPR_CIVIL_DASHBOARD.xlsx",
  ELECTRICAL: "SPDC_DPR_ELECTRICAL_DASHBOARD.xlsx",
  FIRE: "SPDC_DPR_FIRE_DASHBOARD.xlsx",
  MECHANICAL: "SPDC_DPR_MECHANICAL_DASHBOARD.xlsx",
  PEB_ERECTION: "SPDC_DPR_PEB_ERECTION_DASHBOARD.xlsx",
  PEB_SUPPLY: "SPDC_DPR_PEB_SUPPLY_DASHBOARD.xlsx",
  PLUMBING: "SPDC_DPR_PLUMBING_DASHBOARD.xlsx",
};

// ═════════════════════════════════ types ═════════════════════════════════

export type DprLine = {
  srNo?: number;
  group?: string;
  description: string;
  unit?: string;
  scopeQty?: number;
  rate?: number;
  start?: string | null;
  finish?: string | null;
  cumQtyPrev?: number;
  qtyToday?: number;
  remarks?: string;
};

export type DprManpower = {
  trade: string;
  planned?: number;
  actual?: number;
  hoursWorked?: number;
};

export type DprEquipment = {
  name: string;
  qty?: number;
  workedHrs?: number;
  idleHrs?: number;
};

export type DprMaterial = {
  name: string;
  unit?: string;
  opening?: number;
  received?: number;
  consumed?: number;
};

/**
 * Section 6 — quality control & tests today. Free-form parameter
 * + today's figure so the discipline can label the row however it
 * needs (e.g. "Pour cards offered / approved", "Cube slump tests").
 */
export type DprQualityTest = {
  parameter: string;
  figure?: string;
};

/**
 * Section 7 — HSE / safety statistics. Numeric-ish figures per
 * parameter; the "safeManHoursToday" / etc convenience fields on
 * DprSafety are still supported for backwards compat.
 */
export type DprSafetyRow = {
  parameter: string;
  figure?: string;
};

export type DprSafety = {
  safeManHoursToday?: number;
  safeManDaysToday?: number;
  toolboxTalks?: number;
  ppeCompliancePct?: number;
  nearMiss?: number;
  firstAid?: number;
  ltis?: number;
  incidents?: number;
  daysWithoutLti?: number;
  permits?: number;
  observationsRaised?: number;
  observationsClosed?: number;
};

export type DprDelay = {
  cause: string;
  category?: string; // Weather / Contractor / Client / Vendor / PMC / Other
  from?: string; // "HH:mm"
  to?: string;
  hoursLost?: number;
  eot?: "Yes" | "No" | "Review";
};

export type DprApprovalPending = {
  refNo: string;
  description?: string;
  raisedOn?: string | null;
  pendingWith?: string;
};

export type DprIssue = {
  description: string;
  severity?: "Critical" | "High" | "Medium" | "Low";
  owner?: string;
};

export type DprPhoto = {
  path: string;
  caption?: string;
  takenAt?: string | null;
  kind?: "photo" | "signature" | "pdf";
};

export type DprHeader = {
  projectName?: string;
  projectManager?: string;
  contractor?: string;
  location?: string;
  contractRef?: string;
  contractCompletion?: string | null;
  calendarHours?: string;
  shiftHours?: number;
  weather?: string;
  reportDate?: string | null;
  dataDate?: string | null;
  reportNumber?: string;
  acCertifiedToDate?: number;
  cumManDaysPrev?: number;
  cumSafeManHoursPrev?: number;
  dateOfLastLti?: string | null;
  preparedBy?: string;
};

export type DprSnapshot = {
  discipline: string;
  header: DprHeader;
  lines: DprLine[];
  manpower?: DprManpower[];
  equipment?: DprEquipment[];
  materials?: DprMaterial[];
  qualityTests?: DprQualityTest[];
  safetyRows?: DprSafetyRow[];
  safety?: DprSafety;
  delays?: DprDelay[];
  approvals?: DprApprovalPending[];
  issues?: DprIssue[];
  highlights?: string[];
  nextDayPlan?: string[];
  decisions?: string[];
  photos?: DprPhoto[];
  attachments?: DprPhoto[]; // PDFs
  signatures?: DprPhoto[];  // signature PNGs
};

// ═════════════════════════════════ helpers ═════════════════════════════════

function num(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ═════════════════════════════════ compute ═════════════════════════════════
//
// The DASHBOARD sheet computes everything itself via its native formulas,
// so this function is only used to feed the maker UI's live KPI band.

function planPct(dataDate: Date | null, start: Date | null, finish: Date | null): number {
  if (!dataDate || !start || !finish) return 0;
  if (dataDate >= finish) return 1;
  if (dataDate < start) return 0;
  const total = finish.getTime() - start.getTime();
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (dataDate.getTime() - start.getTime()) / total));
}

export function computeDpr(snap: DprSnapshot) {
  const { header, lines } = snap;
  const dataDate = toDate(header.dataDate) ?? new Date();
  const weights = lines.map((l) => num(l.scopeQty) * num(l.rate));
  const totalValue = weights.reduce((a, b) => a + b, 0) || 1;
  const contractValue = totalValue;

  const rows = lines.map((l, i) => {
    const weight = weights[i] / totalValue;
    const start = toDate(l.start ?? null);
    const finish = toDate(l.finish ?? null);
    const daysDiff = finish
      ? Math.round((finish.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const scope = num(l.scopeQty);
    const rate = num(l.rate);
    const cumPrev = num(l.cumQtyPrev);
    const today = num(l.qtyToday);
    const cumToDate = Math.min(scope, cumPrev + today);
    const balance = Math.max(0, scope - cumToDate);
    const pctComplete = scope > 0 ? Math.min(1, cumToDate / scope) : 0;
    const planned = planPct(dataDate, start, finish);
    const earnedToday = today * rate;
    let status: "Not Started" | "Completed" | "On Track" | "In Progress" | "Delay";
    if (cumToDate <= 0) status = "Not Started";
    else if (pctComplete >= 1) status = "Completed";
    else if (pctComplete >= planned) status = "On Track";
    else if (pctComplete > 0.5 * planned) status = "In Progress";
    else status = "Delay";
    return { ...l, srNo: i + 1, weight, daysDiff, cumToDate, balance, pctComplete, planned, earnedToday, status };
  });

  const plannedPct = rows.reduce((s, r) => s + r.weight * r.planned, 0);
  const actualPct = rows.reduce((s, r) => s + r.weight * r.pctComplete, 0);
  const spi = plannedPct > 0 ? actualPct / plannedPct : 0;
  const earnedValueLakh = rows.reduce((s, r) => s + r.weight * r.pctComplete * totalValue, 0) / 100000;
  const valueDoneTodayInr = rows.reduce((s, r) => s + r.earnedToday, 0);
  const itemsDelayed = rows.filter((r) => r.status === "Delay").length;
  const shiftHours = num(header.shiftHours, 8);
  const totalManToday = (snap.manpower || []).reduce((s, m) => s + num(m.actual), 0);
  const manDaysToday = shiftHours > 0
    ? (snap.manpower || []).reduce((s, m) => s + (num(m.actual) * num(m.hoursWorked, shiftHours)) / shiftHours, 0)
    : 0;
  const hoursLostToday = (snap.delays || []).reduce((s, d) => s + num(d.hoursLost), 0);
  const dateOfLastLti = toDate(header.dateOfLastLti);
  const daysWithoutLti = dateOfLastLti
    ? Math.floor((dataDate.getTime() - dateOfLastLti.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return {
    rows,
    kpis: {
      plannedPct,
      actualPct,
      variance: actualPct - plannedPct,
      spi,
      earnedValueLakh,
      valueDoneTodayInr,
      itemsDelayed,
      contractValueLakh: contractValue / 100000,
      overallStatus: actualPct >= plannedPct ? "ON PROGRAMME" : "BEHIND PROGRAMME",
      totalManToday,
      manDaysToday,
      hoursLostToday,
      daysWithoutLti,
    },
  };
}

// ═════════════════════════════════ writer ═════════════════════════════════

function writeCell(ws: ExcelJS.Worksheet, addr: string, value: any) {
  ws.getCell(addr).value = value == null || value === "" ? null : value;
}
function writeDate(ws: ExcelJS.Worksheet, addr: string, v: string | null | undefined) {
  const d = toDate(v);
  ws.getCell(addr).value = d ? d : null;
}

/**
 * Fill the INPUT sheet cells so the DASHBOARD sheet recomputes into
 * the real SPDC layout. Rows and columns are constant across all
 * seven discipline templates (verified against the reference files).
 */
function fillInputSheet(ws: ExcelJS.Worksheet, snap: DprSnapshot) {
  const H = snap.header;

  // 1. Project header
  writeCell(ws, "B4",  H.projectName || "");
  writeCell(ws, "B5",  H.projectManager || "");
  writeCell(ws, "B6",  H.contractor || "");
  writeCell(ws, "B7",  H.location || "");
  writeCell(ws, "B8",  H.preparedBy || "Site Engineer – SPDC (PMC)");
  writeCell(ws, "B9",  H.contractRef || "");
  writeDate(ws, "B10", H.contractCompletion);
  writeCell(ws, "B11", H.calendarHours || "6 Days / Week – 8 hrs");
  writeCell(ws, "B12", num(H.shiftHours, 8));
  writeCell(ws, "B13", H.weather || "");
  writeDate(ws, "B14", H.reportDate);
  writeDate(ws, "B15", H.dataDate);
  writeCell(ws, "B16", H.reportNumber || "");
  writeCell(ws, "B17", num(H.acCertifiedToDate));
  writeCell(ws, "B18", num(H.cumManDaysPrev));
  writeCell(ws, "B19", num(H.cumSafeManHoursPrev));
  writeDate(ws, "B20", H.dateOfLastLti);

  // 2. Quantity progress (rows 24-38, 15 slots)
  for (let i = 0; i < 15; i++) {
    const row = 24 + i;
    const l = snap.lines[i];
    writeCell(ws, `A${row}`, l?.group ?? null);
    writeCell(ws, `B${row}`, l?.description ?? null);
    writeCell(ws, `E${row}`, l?.unit ?? null);
    writeCell(ws, `F${row}`, l ? num(l.scopeQty) : null);
    writeCell(ws, `G${row}`, l ? num(l.rate) : null);
    writeDate(ws, `H${row}`, l?.start);
    writeDate(ws, `I${row}`, l?.finish);
    writeCell(ws, `J${row}`, l ? num(l.cumQtyPrev) : null);
    writeCell(ws, `K${row}`, l ? num(l.qtyToday) : null);
  }

  // 3. Manpower (rows 42-47, 6 slots)
  const shiftHours = num(H.shiftHours, 8);
  for (let i = 0; i < 6; i++) {
    const row = 42 + i;
    const m = snap.manpower?.[i];
    writeCell(ws, `A${row}`, m?.trade ?? null);
    writeCell(ws, `D${row}`, m ? num(m.planned) : null);
    writeCell(ws, `E${row}`, m ? num(m.actual) : null);
    writeCell(ws, `F${row}`, m ? num(m.hoursWorked, shiftHours) : null);
  }

  // 4. Equipment (rows 51-56)
  for (let i = 0; i < 6; i++) {
    const row = 51 + i;
    const e = snap.equipment?.[i];
    writeCell(ws, `A${row}`, e?.name ?? null);
    writeCell(ws, `D${row}`, e ? num(e.qty) : null);
    writeCell(ws, `E${row}`, e ? num(e.workedHrs) : null);
    writeCell(ws, `F${row}`, e ? num(e.idleHrs) : null);
  }

  // 5. Material (rows 60-65)
  for (let i = 0; i < 6; i++) {
    const row = 60 + i;
    const m = snap.materials?.[i];
    writeCell(ws, `A${row}`, m?.name ?? null);
    writeCell(ws, `D${row}`, m?.unit ?? null);
    writeCell(ws, `E${row}`, m ? num(m.opening) : null);
    writeCell(ws, `F${row}`, m ? num(m.received) : null);
    writeCell(ws, `G${row}`, m ? num(m.consumed) : null);
  }

  // 6. Quality control & tests today (rows 69-74)
  for (let i = 0; i < 6; i++) {
    const row = 69 + i;
    const q = snap.qualityTests?.[i];
    writeCell(ws, `A${row}`, q?.parameter ?? null);
    writeCell(ws, `D${row}`, q?.figure ?? null);
  }

  // 7. HSE / Safety statistics (rows 78-83)
  const sfy: DprSafetyRow[] = (snap.safetyRows && snap.safetyRows.length)
    ? snap.safetyRows
    : buildSafetyRowsFromLegacy(snap.safety);
  for (let i = 0; i < 6; i++) {
    const row = 78 + i;
    const s = sfy[i];
    writeCell(ws, `A${row}`, s?.parameter ?? null);
    writeCell(ws, `D${row}`, s?.figure ?? null);
  }

  // 8. Delay / idle time log (rows 87-90) — 4 rows
  for (let i = 0; i < 4; i++) {
    const row = 87 + i;
    const d = snap.delays?.[i];
    writeCell(ws, `A${row}`, d?.cause ?? null);
    writeCell(ws, `D${row}`, d?.category ?? null);
    writeCell(ws, `E${row}`, d?.from ?? null);
    writeCell(ws, `F${row}`, d?.to ?? null);
    writeCell(ws, `G${row}`, d?.eot ?? null);
  }

  // 9. Approvals pending (rows 94-97) — 4 rows
  for (let i = 0; i < 4; i++) {
    const row = 94 + i;
    const a = snap.approvals?.[i];
    writeCell(ws, `A${row}`, a?.refNo ?? null);
    writeCell(ws, `B${row}`, a?.description ?? null);
    writeDate(ws, `E${row}`, a?.raisedOn);
    writeCell(ws, `F${row}`, a?.pendingWith ?? null);
  }

  // 10. Issues & risks (rows 101-104) — 4 rows
  for (let i = 0; i < 4; i++) {
    const row = 101 + i;
    const iss = snap.issues?.[i];
    writeCell(ws, `A${row}`, iss?.description ?? null);
    writeCell(ws, `E${row}`, iss?.severity ?? null);
    writeCell(ws, `F${row}`, iss?.owner ?? null);
  }

  // 11. Highlights (rows 107-110) — 4 rows
  for (let i = 0; i < 4; i++) {
    writeCell(ws, `A${107 + i}`, snap.highlights?.[i] ?? null);
  }
  // 12. Next-day plan (rows 113-116)
  for (let i = 0; i < 4; i++) {
    writeCell(ws, `A${113 + i}`, snap.nextDayPlan?.[i] ?? null);
  }
  // 13. Decisions required (rows 119-121) — 3 rows
  for (let i = 0; i < 3; i++) {
    writeCell(ws, `A${119 + i}`, snap.decisions?.[i] ?? null);
  }
}

function buildSafetyRowsFromLegacy(s?: DprSafety): DprSafetyRow[] {
  if (!s) return [];
  return [
    { parameter: "Safe man-hours – today / cumulative", figure: String(num(s.safeManHoursToday)) },
    { parameter: "Days without LTI",                    figure: s.daysWithoutLti != null ? String(s.daysWithoutLti) : "" },
    { parameter: "Toolbox talks conducted",             figure: String(num(s.toolboxTalks)) },
    { parameter: "Permits to work issued",              figure: String(num(s.permits)) },
    { parameter: "Safety observations raised / closed", figure: `${num(s.observationsRaised)} / ${num(s.observationsClosed)}` },
    { parameter: "Near miss / first aid today",         figure: `${num(s.nearMiss)} / ${num(s.firstAid)}` },
  ];
}

/**
 * Build the DPR workbook by patching the discipline template.
 * Returns a Buffer ready to send / upload.
 */
export async function buildDprWorkbook(
  snap: DprSnapshot,
  opts?: { projectId?: string; logDate?: Date }
): Promise<Buffer> {
  const templateName = TEMPLATE_FILE[snap.discipline] || TEMPLATE_FILE.CIVIL;
  const templatePath = path.join(TEMPLATE_DIR, templateName);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);

  const inputSheet = wb.getWorksheet("INPUT");
  if (!inputSheet) {
    throw new Error(`Template ${templateName} is missing the INPUT sheet`);
  }
  fillInputSheet(inputSheet, snap);

  if (opts?.projectId && opts.logDate) {
    const history = await loadDprScurveHistory(opts.projectId, snap.discipline, opts.logDate, snap);
    fillScurveHistorySheet(inputSheet, history);
  }

  // Attach a PHOTOS sheet listing every uploaded evidence artefact
  const evidence: (DprPhoto & { kind: string })[] = [
    ...(snap.photos     || []).map((p) => ({ ...p, kind: p.kind || "photo" })),
    ...(snap.attachments|| []).map((p) => ({ ...p, kind: "pdf" as const })),
    ...(snap.signatures || []).map((p) => ({ ...p, kind: "signature" as const })),
  ];
  if (evidence.length) {
    // Drop any existing PHOTOS sheet from a previous re-generation before
    // adding the fresh one — exceljs allows this via workbook.removeWorksheet.
    const existing = wb.getWorksheet("PHOTOS");
    if (existing) wb.removeWorksheet(existing.id);
    const ph = wb.addWorksheet("PHOTOS");
    ph.addRow(["#", "KIND", "SHAREPOINT PATH", "CAPTION", "TAKEN AT"]).font = { bold: true };
    ph.getColumn(1).width = 4;
    ph.getColumn(2).width = 10;
    ph.getColumn(3).width = 84;
    ph.getColumn(4).width = 42;
    ph.getColumn(5).width = 22;
    evidence.forEach((e, i) => {
      ph.addRow([i + 1, e.kind, e.path, e.caption || "", e.takenAt || ""]);
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
