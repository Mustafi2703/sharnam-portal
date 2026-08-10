/**
 * DPR XLSX generator — produces a workbook with two sheets (INPUT +
 * DASHBOARD) that mirror the SPDC_DPR_CIVIL_DASHBOARD.xlsx reference.
 *
 * INPUT sheet blocks (from the SPDC template):
 *   1. Project header                    → header{}
 *   2. Quantity progress (BOQ item-wise) → lines[]
 *   3. Manpower deployed today           → manpower[]
 *   4. Equipment deployed today          → equipment[]
 *   5. Material at site                  → materials[]
 *   6. Safety snapshot today             → safety
 *   7. Delay / idle time log today       → delays[]
 *   8. Site photos                       → photos[]
 *
 * All arithmetic is computed in TS so the workbook is correct even when
 * opened by a viewer that does not recompute formulas.
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

export type DprSafety = {
  safeManHoursToday?: number;
  safeManDaysToday?: number;
  toolboxTalks?: number;
  ppeCompliancePct?: number;
  nearMiss?: number;
  firstAid?: number;
  ltis?: number;
  incidents?: number;
};

export type DprDelay = {
  cause: string;
  from?: string; // "HH:mm"
  to?: string;
  hoursLost?: number;
  eot?: "Yes" | "No";
};

export type DprPhoto = {
  path: string;    // relative to project SharePoint library
  caption?: string;
  takenAt?: string | null;
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
  safety?: DprSafety;
  delays?: DprDelay[];
  photos?: DprPhoto[];
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

  // Manpower / equipment / hours-lost aggregates
  const shiftHours = num(header.shiftHours, 8);
  const totalManToday = (snap.manpower || []).reduce((s, m) => s + num(m.actual), 0);
  const manDaysToday = shiftHours > 0
    ? (snap.manpower || []).reduce((s, m) => s + (num(m.actual) * num(m.hoursWorked, shiftHours)) / shiftHours, 0)
    : 0;
  const hoursLostToday = (snap.delays || []).reduce((s, d) => s + num(d.hoursLost), 0);
  const equipmentWorkedHrs = (snap.equipment || []).reduce((s, e) => s + num(e.workedHrs), 0);
  const equipmentIdleHrs = (snap.equipment || []).reduce((s, e) => s + num(e.idleHrs), 0);

  const dateOfLastLti = dateOnly(header.dateOfLastLti);
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
      equipmentWorkedHrs,
      equipmentIdleHrs,
      daysWithoutLti,
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
  const S = snap.safety || {};

  // ═══════════════════════════════════════════════════════════════════════
  // INPUT sheet
  // ═══════════════════════════════════════════════════════════════════════
  const inputAoA: (string | number | null)[][] = [];
  inputAoA.push([`DAILY INPUT SHEET — ${disciplineLabel}`]);
  inputAoA.push(["TYPE ONLY IN THE YELLOW CELLS ON THIS SHEET. The DASHBOARD sheet is fully calculated."]);
  inputAoA.push([""]);

  // 1. PROJECT HEADER
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

  // 2. QUANTITY PROGRESS
  inputAoA.push(["2. QUANTITY PROGRESS (one row per BOQ / scope item)"]);
  inputAoA.push([
    "GROUP", "DESCRIPTION OF ITEM", null, null,
    "UNIT", "SCOPE / BOQ QTY", "RATE ₹",
    "START", "FINISH", "CUM QTY UPTO PREV.", "QTY TODAY", "REMARKS",
  ]);
  for (const l of snap.lines) {
    inputAoA.push([
      l.group || "", l.description, null, null,
      l.unit || "", num(l.scopeQty), num(l.rate),
      fmtDate(l.start ?? null), fmtDate(l.finish ?? null),
      num(l.cumQtyPrev), num(l.qtyToday), l.remarks || "",
    ]);
  }
  inputAoA.push([""]);

  // 3. MANPOWER
  inputAoA.push(["3. MANPOWER DEPLOYED TODAY"]);
  inputAoA.push(["TRADE / CATEGORY", null, null, "PLANNED NOS", "ACTUAL NOS", "HOURS WORKED"]);
  for (const m of snap.manpower || []) {
    inputAoA.push([m.trade || "", null, null, num(m.planned), num(m.actual), num(m.hoursWorked, num(H.shiftHours, 8))]);
  }
  inputAoA.push([""]);

  // 4. EQUIPMENT
  inputAoA.push(["4. EQUIPMENT DEPLOYED TODAY"]);
  inputAoA.push(["EQUIPMENT", null, null, "QTY", "WORKED HRS", "IDLE HRS"]);
  for (const e of snap.equipment || []) {
    inputAoA.push([e.name || "", null, null, num(e.qty), num(e.workedHrs), num(e.idleHrs)]);
  }
  inputAoA.push([""]);

  // 5. MATERIAL AT SITE
  inputAoA.push(["5. MATERIAL AT SITE"]);
  inputAoA.push(["MATERIAL", null, null, "UNIT", "OPENING STOCK", "RECEIVED TODAY", "CONSUMED / ISSUED"]);
  for (const m of snap.materials || []) {
    inputAoA.push([m.name || "", null, null, m.unit || "", num(m.opening), num(m.received), num(m.consumed)]);
  }
  inputAoA.push([""]);

  // 6. SAFETY SNAPSHOT
  inputAoA.push(["6. SAFETY SNAPSHOT (today)"]);
  inputAoA.push(["Safe man-hours today", num(S.safeManHoursToday)]);
  inputAoA.push(["Safe man-days today", num(S.safeManDaysToday)]);
  inputAoA.push(["Tool-box talks today", num(S.toolboxTalks)]);
  inputAoA.push(["PPE compliance %", num(S.ppeCompliancePct)]);
  inputAoA.push(["Near-miss reported", num(S.nearMiss)]);
  inputAoA.push(["First-aid case", num(S.firstAid)]);
  inputAoA.push(["Lost-time injuries", num(S.ltis)]);
  inputAoA.push(["Other incidents", num(S.incidents)]);
  inputAoA.push(["Days without LTI (computed)", kpis.daysWithoutLti ?? ""]);
  inputAoA.push([""]);

  // 7. DELAY / IDLE LOG
  inputAoA.push(["7. DELAY / IDLE TIME LOG TODAY"]);
  inputAoA.push(["CAUSE (CATEGORY)", null, null, "FROM", "TO", "HRS LOST", "EOT"]);
  for (const d of snap.delays || []) {
    inputAoA.push([d.cause || "", null, null, d.from || "", d.to || "", num(d.hoursLost), d.eot || "No"]);
  }
  inputAoA.push([""]);

  // 8. PHOTOS
  inputAoA.push(["8. SITE PHOTOS"]);
  inputAoA.push(["SharePoint path", null, null, "Caption", "Taken at"]);
  for (const p of snap.photos || []) {
    inputAoA.push([p.path, null, null, p.caption || "", p.takenAt ? fmtDate(p.takenAt) : ""]);
  }

  const wsInput = XLSX.utils.aoa_to_sheet(inputAoA);
  wsInput["!cols"] = [
    { wch: 14 }, { wch: 40 }, { wch: 4 }, { wch: 4 },
    { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInput, "INPUT");

  // ═══════════════════════════════════════════════════════════════════════
  // DASHBOARD sheet
  // ═══════════════════════════════════════════════════════════════════════
  const dash: (string | number | null)[][] = [];
  dash.push(["SPDC", null, null, "DAILY PROGRESS REPORT", null, null, null, null, null, null, null, null, null, null, "Report Date", null, null, fmtDate(H.reportDate)]);
  dash.push([null, null, null, null, null, null, null, null, null, null, null, null, null, null, "Data Date", null, null, fmtDate(H.dataDate)]);
  dash.push([null, null, null, disciplineLabel, null, null, null, null, null, null, null, null, null, null, "Report No. / Day", null, null, H.reportNumber || ""]);
  dash.push(["Project Name", null, H.projectName || "", null, null, null, null, null, "Contract / PO Ref.", null, H.contractRef || "", null, null, null, "PROJECT HEALTH"]);
  dash.push(["Project Manager", null, H.projectManager || "", null, null, null, null, null, "Contract Completion", null, fmtDate(H.contractCompletion), null, null, null, "Overall Status", null, null, kpis.overallStatus]);
  dash.push(["Contractor / Vendor", null, H.contractor || "", null, null, null, null, null, "Calendar / Weather", null, `${H.calendarHours || ""}   |   ${H.weather || ""}`, null, null, null, "Contract Value (₹ Lakh)", null, null, kpis.contractValueLakh.toFixed(2)]);
  dash.push(["Location", null, H.location || "", null, null, null, null, null, "Prepared by", null, H.preparedBy || "Site Engineer — SPDC (PMC)"]);
  dash.push([""]);

  // KPI band
  dash.push(["1. KEY PERFORMANCE INDICATORS (all calculated — nothing is manually typed)"]);
  dash.push(["PLANNED %", null, null, "ACTUAL %", null, null, "VARIANCE", null, null, "SPI", null, null, "EARNED VALUE ₹ L", null, null, "VALUE DONE TODAY ₹", null, null, "ITEMS DELAYED"]);
  dash.push([
    fmtPct(kpis.plannedPct), null, null,
    fmtPct(kpis.actualPct), null, null,
    (kpis.variance * 100).toFixed(1) + "%", null, null,
    kpis.spi.toFixed(2), null, null,
    kpis.earnedValueLakh.toFixed(2), null, null,
    Math.round(kpis.valueDoneTodayInr).toLocaleString("en-IN"), null, null,
    kpis.itemsDelayed,
  ]);
  dash.push([""]);

  // Quantity block
  dash.push(["2. QUANTITY / PHYSICAL PROGRESS — BOQ ITEM-WISE"]);
  dash.push([
    "SL", "DESCRIPTION OF ITEM", null, null, null,
    "UNIT", "SCOPE QTY", "RATE ₹", "WEIGHT %",
    "START", "FINISH", "DAYS +/−", "PLANNED %",
    "CUM QTY PREV.", "QTY TODAY", "CUM QTY TO DATE", "BALANCE QTY", "% COMPL.",
    "EARNED ₹ TODAY", "STATUS",
  ]);
  for (const r of rows) {
    dash.push([
      r.srNo, r.description, null, null, null,
      r.unit || "", num(r.scopeQty), num(r.rate),
      (r.weight * 100).toFixed(2) + "%",
      fmtDate(r.start ?? null), fmtDate(r.finish ?? null),
      r.daysDiff === null ? "" : r.daysDiff,
      fmtPct(r.planned),
      num(r.cumQtyPrev), num(r.qtyToday), r.cumToDate, r.balance,
      fmtPct(r.pctComplete),
      Math.round(r.earnedToday),
      r.status,
    ]);
  }
  dash.push([""]);

  // Group summary
  const groups = new Map<string, { planned: number; actual: number; earned: number }>();
  for (const r of rows) {
    const g = r.group || "UNGROUPED";
    const acc = groups.get(g) || { planned: 0, actual: 0, earned: 0 };
    acc.planned += r.weight * r.planned;
    acc.actual += r.weight * r.pctComplete;
    acc.earned += r.earnedToday;
    groups.set(g, acc);
  }
  dash.push(["3. PROGRESS SUMMARY BY GROUP"]);
  dash.push(["GROUP", "PLANNED %", "ACTUAL %", "VARIANCE %", "EARNED ₹ TODAY"]);
  for (const [g, v] of groups) {
    dash.push([g, fmtPct(v.planned), fmtPct(v.actual), ((v.actual - v.planned) * 100).toFixed(1) + "%", Math.round(v.earned)]);
  }
  dash.push([""]);

  // Manpower summary
  dash.push(["4. MANPOWER (today)"]);
  dash.push(["TRADE", "PLANNED", "ACTUAL", "HOURS", "MAN-DAYS"]);
  const sh = num(H.shiftHours, 8);
  for (const m of snap.manpower || []) {
    const md = sh > 0 ? (num(m.actual) * num(m.hoursWorked, sh)) / sh : 0;
    dash.push([m.trade || "", num(m.planned), num(m.actual), num(m.hoursWorked, sh), md.toFixed(2)]);
  }
  dash.push(["TOTAL", "", kpis.totalManToday, "", kpis.manDaysToday.toFixed(2)]);
  dash.push([""]);

  // Equipment summary
  dash.push(["5. EQUIPMENT (today)"]);
  dash.push(["EQUIPMENT", "QTY", "WORKED HRS", "IDLE HRS", "UTIL %"]);
  for (const e of snap.equipment || []) {
    const total = num(e.workedHrs) + num(e.idleHrs);
    const util = total > 0 ? (num(e.workedHrs) / total) * 100 : 0;
    dash.push([e.name || "", num(e.qty), num(e.workedHrs), num(e.idleHrs), util.toFixed(1) + "%"]);
  }
  dash.push([""]);

  // Material summary
  dash.push(["6. MATERIAL AT SITE"]);
  dash.push(["MATERIAL", "UNIT", "OPENING", "RECEIVED", "CONSUMED", "CLOSING"]);
  for (const m of snap.materials || []) {
    const closing = num(m.opening) + num(m.received) - num(m.consumed);
    dash.push([m.name || "", m.unit || "", num(m.opening), num(m.received), num(m.consumed), closing]);
  }
  dash.push([""]);

  // Safety block
  dash.push(["7. SAFETY (today)"]);
  dash.push(["Safe man-hours today", num(S.safeManHoursToday)]);
  dash.push(["Safe man-days today", num(S.safeManDaysToday)]);
  dash.push(["Toolbox talks", num(S.toolboxTalks)]);
  dash.push(["PPE compliance %", num(S.ppeCompliancePct)]);
  dash.push(["Near-miss / First-aid / LTI / Other", `${num(S.nearMiss)} · ${num(S.firstAid)} · ${num(S.ltis)} · ${num(S.incidents)}`]);
  dash.push(["Days without LTI", kpis.daysWithoutLti ?? ""]);
  dash.push([""]);

  // Delay log
  dash.push(["8. DELAY / IDLE TIME LOG (today)"]);
  dash.push(["CAUSE", "FROM", "TO", "HRS LOST", "EOT"]);
  for (const d of snap.delays || []) {
    dash.push([d.cause || "", d.from || "", d.to || "", num(d.hoursLost), d.eot || "No"]);
  }
  dash.push(["TOTAL", "", "", kpis.hoursLostToday.toFixed(2), ""]);
  dash.push([""]);

  // Photos list
  if ((snap.photos || []).length) {
    dash.push(["9. SITE PHOTOS"]);
    dash.push(["Path (SharePoint)", "Caption", "Taken at"]);
    for (const p of snap.photos || []) {
      dash.push([p.path, p.caption || "", p.takenAt ? fmtDate(p.takenAt) : ""]);
    }
  }

  const wsDash = XLSX.utils.aoa_to_sheet(dash);
  wsDash["!cols"] = [
    { wch: 5 }, { wch: 40 }, { wch: 3 }, { wch: 3 }, { wch: 3 },
    { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 9 },
    { wch: 12 }, { wch: 12 }, { wch: 9 }, { wch: 10 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 14 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDash, "DASHBOARD");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
