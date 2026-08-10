/**
 * DPR XLSX generator — produces a workbook with two sheets
 * (INPUT + DASHBOARD) that mirror the SPDC_DPR_CIVIL_DASHBOARD.xlsx
 * reference format (INPUT sheet holds the yellow-cell inputs, DASHBOARD
 * shows KPIs, per-item quantity progress, and status).
 *
 * All arithmetic is done in TS so the resulting workbook works even when
 * opened in a viewer that doesn't recompute formulas.
 */
import XLSX from "xlsx";

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
};

const DISCIPLINE_LABEL: Record<string, string> = {
  CIVIL: "CIVIL & STRUCTURAL WORKS PACKAGE",
  ELECTRICAL: "ELECTRICAL WORKS PACKAGE",
  FIRE: "FIRE PROTECTION WORKS PACKAGE",
  MECHANICAL: "MECHANICAL WORKS PACKAGE",
  PEB_ERECTION: "PEB ERECTION WORKS PACKAGE",
  PEB_SUPPLY: "PEB SUPPLY WORKS PACKAGE",
  PLUMBING: "PLUMBING WORKS PACKAGE",
};

function num(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dateOnly(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fraction of scope planned by a data date (linear ramp between start & finish). */
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
  const dataDate = dateOnly(header.dataDate) ?? new Date();
  const weights = lines.map((l) => num(l.scopeQty) * num(l.rate));
  const totalValue = weights.reduce((a, b) => a + b, 0) || 1;
  const contractValue = totalValue;

  const rows = lines.map((l, i) => {
    const weight = weights[i] / totalValue;
    const start = dateOnly(l.start ?? null);
    const finish = dateOnly(l.finish ?? null);
    const daysDiff =
      finish && dataDate
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
    return {
      ...l,
      srNo: i + 1,
      weight,
      daysDiff,
      cumToDate,
      balance,
      pctComplete,
      planned,
      earnedToday,
      status,
    };
  });

  const plannedPct = rows.reduce((s, r) => s + r.weight * r.planned, 0);
  const actualPct = rows.reduce((s, r) => s + r.weight * r.pctComplete, 0);
  const spi = plannedPct > 0 ? actualPct / plannedPct : 0;
  const earnedValueLakh = rows.reduce((s, r) => s + r.weight * r.pctComplete * totalValue, 0) / 100000;
  const valueDoneTodayInr = rows.reduce((s, r) => s + r.earnedToday, 0);
  const itemsDelayed = rows.filter((r) => r.status === "Delay").length;

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
    },
  };
}

function fmtDate(d: string | null | undefined): string {
  const dd = dateOnly(d);
  if (!dd) return "—";
  return dd.toISOString().slice(0, 10);
}
function fmtPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function buildDprWorkbook(snap: DprSnapshot): Buffer {
  const wb = XLSX.utils.book_new();
  const { rows, kpis } = computeDpr(snap);
  const disciplineLabel = DISCIPLINE_LABEL[snap.discipline] || `${snap.discipline} WORKS PACKAGE`;
  const H = snap.header;

  // -------------------------- INPUT sheet ----------------------------------
  const inputAoA: (string | number | null)[][] = [];
  inputAoA.push([`DAILY INPUT SHEET — ${disciplineLabel}`]);
  inputAoA.push(["TYPE ONLY IN THE YELLOW CELLS ON THIS SHEET. The DASHBOARD sheet is fully calculated."]);
  inputAoA.push([""]);
  inputAoA.push(["1. PROJECT HEADER (change once at the start, then only the daily block)"]);
  inputAoA.push(["Project name", H.projectName || ""]);
  inputAoA.push(["Project manager", H.projectManager || ""]);
  inputAoA.push(["Contractor / vendor", H.contractor || ""]);
  inputAoA.push(["Location", H.location || ""]);
  inputAoA.push(["Prepared by", H.preparedBy || "Site Engineer — SPDC (PMC)"]);
  inputAoA.push(["Contract / PO reference", H.contractRef || ""]);
  inputAoA.push(["Contract completion date", fmtDate(H.contractCompletion)]);
  inputAoA.push(["Calendar / working hours", H.calendarHours || "6 Days / Week — 8 hrs"]);
  inputAoA.push(["Shift hours per day", num(H.shiftHours, 8)]);
  inputAoA.push(["Weather", H.weather || ""]);
  inputAoA.push(["REPORT DATE", fmtDate(H.reportDate)]);
  inputAoA.push(["DATA DATE (cut-off)", fmtDate(H.dataDate)]);
  inputAoA.push(["Report number", H.reportNumber || ""]);
  inputAoA.push(["AC — certified / paid to date (₹ Lakh)", num(H.acCertifiedToDate)]);
  inputAoA.push(["Cumulative man-days upto previous day", num(H.cumManDaysPrev)]);
  inputAoA.push(["Cumulative safe man-hours upto prev. day", num(H.cumSafeManHoursPrev)]);
  inputAoA.push(["Date of last LTI", fmtDate(H.dateOfLastLti)]);
  inputAoA.push([""]);
  inputAoA.push(["2. QUANTITY PROGRESS (one row per BOQ / scope item)"]);
  inputAoA.push([
    "GROUP",
    "DESCRIPTION OF ITEM",
    null,
    null,
    "UNIT",
    "SCOPE / BOQ QTY",
    "RATE ₹",
    "START",
    "FINISH",
    "CUM QTY UPTO PREV.",
    "QTY TODAY",
  ]);
  for (const l of rows) {
    inputAoA.push([
      l.group || "",
      l.description,
      null,
      null,
      l.unit || "",
      num(l.scopeQty),
      num(l.rate),
      fmtDate(l.start ?? null),
      fmtDate(l.finish ?? null),
      num(l.cumQtyPrev),
      num(l.qtyToday),
    ]);
  }
  const wsInput = XLSX.utils.aoa_to_sheet(inputAoA);
  wsInput["!cols"] = [
    { wch: 14 },
    { wch: 40 },
    { wch: 4 },
    { wch: 4 },
    { wch: 8 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInput, "INPUT");

  // -------------------------- DASHBOARD sheet ------------------------------
  const dash: (string | number | null)[][] = [];
  dash.push(["SPDC", null, null, "DAILY PROGRESS REPORT", null, null, null, null, null, null, null, null, null, null, "Report Date", null, null, fmtDate(H.reportDate)]);
  dash.push([null, null, null, null, null, null, null, null, null, null, null, null, null, null, "Data Date", null, null, fmtDate(H.dataDate)]);
  dash.push([null, null, null, disciplineLabel, null, null, null, null, null, null, null, null, null, null, "Report No. / Day", null, null, H.reportNumber || ""]);
  dash.push(["Project Name", null, H.projectName || "", null, null, null, null, null, "Contract / PO Ref.", null, H.contractRef || "", null, null, null, "PROJECT HEALTH"]);
  dash.push(["Project Manager", null, H.projectManager || "", null, null, null, null, null, "Contract Completion", null, fmtDate(H.contractCompletion), null, null, null, "Overall Status", null, null, kpis.overallStatus]);
  dash.push(["Contractor / Vendor", null, H.contractor || "", null, null, null, null, null, "Calendar / Weather", null, `${H.calendarHours || ""}   |   ${H.weather || ""}`, null, null, null, "Contract Value (₹ Lakh)", null, null, kpis.contractValueLakh.toFixed(2)]);
  dash.push(["Location", null, H.location || "", null, null, null, null, null, "Prepared by", null, H.preparedBy || "Site Engineer — SPDC (PMC)"]);
  dash.push([""]);
  dash.push(["1. KEY PERFORMANCE INDICATORS (all calculated — nothing is manually typed)"]);
  dash.push(["PLANNED %", null, null, "ACTUAL %", null, null, "VARIANCE", null, null, "SPI", null, null, "EARNED VALUE ₹ L", null, null, "VALUE DONE TODAY ₹", null, null, "ITEMS DELAYED"]);
  dash.push([
    fmtPct(kpis.plannedPct),
    null,
    null,
    fmtPct(kpis.actualPct),
    null,
    null,
    (kpis.variance * 100).toFixed(1) + "%",
    null,
    null,
    kpis.spi.toFixed(2),
    null,
    null,
    kpis.earnedValueLakh.toFixed(2),
    null,
    null,
    Math.round(kpis.valueDoneTodayInr).toLocaleString("en-IN"),
    null,
    null,
    kpis.itemsDelayed,
  ]);
  dash.push([""]);
  dash.push(["2. QUANTITY / PHYSICAL PROGRESS — BOQ ITEM-WISE"]);
  dash.push([
    "SL",
    "DESCRIPTION OF ITEM",
    null,
    null,
    null,
    "UNIT",
    "SCOPE QTY",
    "RATE ₹",
    "WEIGHT %",
    "START",
    "FINISH",
    "DAYS +/−",
    "PLANNED %",
    "CUM QTY PREV.",
    "QTY TODAY",
    "CUM QTY TO DATE",
    "BALANCE QTY",
    "% COMPL.",
    "EARNED ₹ TODAY",
    "STATUS",
  ]);
  for (const r of rows) {
    dash.push([
      r.srNo,
      r.description,
      null,
      null,
      null,
      r.unit || "",
      num(r.scopeQty),
      num(r.rate),
      (r.weight * 100).toFixed(2) + "%",
      fmtDate(r.start ?? null),
      fmtDate(r.finish ?? null),
      r.daysDiff === null ? "" : r.daysDiff,
      fmtPct(r.planned),
      num(r.cumQtyPrev),
      num(r.qtyToday),
      r.cumToDate,
      r.balance,
      fmtPct(r.pctComplete),
      Math.round(r.earnedToday),
      r.status,
    ]);
  }
  const wsDash = XLSX.utils.aoa_to_sheet(dash);
  wsDash["!cols"] = [
    { wch: 5 },
    { wch: 40 },
    { wch: 3 },
    { wch: 3 },
    { wch: 3 },
    { wch: 6 },
    { wch: 10 },
    { wch: 10 },
    { wch: 9 },
    { wch: 12 },
    { wch: 12 },
    { wch: 9 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDash, "DASHBOARD");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
