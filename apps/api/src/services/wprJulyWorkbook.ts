/**
 * Build a WPR pack + charts from the client 23–29 July workbook
 * (and PR / Invoice tracker) so PPTX headings match the source sheets.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import XLSX, { type WorkBook } from "../lib/xlsx.js";
import { DEFAULT_WPR_TITLES, type WprHeader, type WprPackInput, type WprSection, type WprSections } from "./wprXlsx.js";
import { mergeWprChartsForExport } from "./wprChartMerge.js";
import { resolveJulyWprWorkbook } from "./wprTrackerPackImport.js";

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function sheetRows(wb: WorkBook, pattern: RegExp): unknown[][] {
  const name = wb.SheetNames.find((n) => pattern.test(n));
  if (!name || !wb.Sheets[name]) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as unknown[][];
}

function looksHeader(row: unknown[]): boolean {
  const text = row.map((c) => str(c).toLowerCase()).join(" ");
  return /sr\.?\s*no|description|activity|observation|hse indicator|month|pr no|invoice/i.test(text);
}

function firstHeaderIndex(rows: unknown[][], fallback = 0): number {
  const idx = rows.findIndex((r) => looksHeader(r));
  return idx >= 0 ? idx : fallback;
}

function takeCols(row: unknown[], max = 12): (string | number | null)[] {
  return row.slice(0, max).map((c) => {
    if (c == null || c === "") return "";
    if (typeof c === "number" && Number.isFinite(c)) return c;
    return str(c);
  });
}

function sectionFromSheet(
  title: string,
  rows: unknown[][],
  opts?: { headerRow?: number; dataFrom?: number; maxCols?: number; skipEmpty?: number }
): WprSection {
  if (!rows.length) {
    return { title, headers: ["Item", "Status"], rows: [["(No rows in source sheet)", ""]] };
  }
  const headerRow = opts?.headerRow ?? firstHeaderIndex(rows);
  const dataFrom = opts?.dataFrom ?? headerRow + 1;
  const maxCols = opts?.maxCols ?? 12;
  const skipEmpty = opts?.skipEmpty ?? 1;
  const headers = takeCols(rows[headerRow] || [], maxCols).map((c) => String(c || "—"));
  const body: (string | number | null)[][] = [];
  for (const row of rows.slice(dataFrom)) {
    const cells = takeCols(row, maxCols);
    const filled = cells.filter((c) => c !== "" && c != null).length;
    if (filled < skipEmpty) continue;
    if (/^total$/i.test(String(cells[0] ?? "")) || /^total$/i.test(String(cells[1] ?? ""))) continue;
    body.push(cells);
  }
  return { title, headers, rows: body };
}

export function resolvePrTrackerWorkbook(): string | null {
  return resolveSource(
    ["module_prompts", "untitled folder", "PR Tracker-52.xlsx"],
    ["templates", "wpr-client", "PR-Tracker-Template.xlsx"]
  );
}

function candidateRoots(): string[] {
  return [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(process.cwd(), "../..")];
}

function resolveSource(...relVariants: string[][]): string | null {
  for (const root of candidateRoots()) {
    for (const rel of relVariants) {
      const p = path.join(root, ...rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function excelSerialDate(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 30000) return str(v);
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

function inr(n: number): string {
  return n ? `₹ ${Math.round(n).toLocaleString("en-IN")}` : "";
}

export function buildJulyWprPack(): WprPackInput {
  const wprPath = resolveJulyWprWorkbook();
  if (!wprPath) throw new Error("July WPR workbook not found");
  const wb = XLSX.readFile(wprPath);

  const hindrance = sectionFromSheet(DEFAULT_WPR_TITLES.hindrance, sheetRows(wb, /Hinderance|Hindrance/i), {
    headerRow: 1,
    maxCols: 10,
  });
  const risk = sectionFromSheet(DEFAULT_WPR_TITLES.risk, sheetRows(wb, /Risk Register/i), {
    headerRow: 1,
    maxCols: 10,
  });
  const legal = sectionFromSheet(DEFAULT_WPR_TITLES.legal, sheetRows(wb, /Legal Approval/i), { maxCols: 9 });
  const procurement = sectionFromSheet(DEFAULT_WPR_TITLES.procurement, sheetRows(wb, /^Procurement tracker$/i), {
    maxCols: 11,
  });
  const manpower = sectionFromSheet(DEFAULT_WPR_TITLES.manpowerHistogram, sheetRows(wb, /Weekly Manpower/i), {
    headerRow: 1,
    maxCols: 4,
  });
  const cashflow = sectionFromSheet(DEFAULT_WPR_TITLES.cashflow, sheetRows(wb, /Project Cashflow/i), { maxCols: 5 });
  const quality = sectionFromSheet(DEFAULT_WPR_TITLES.quality, sheetRows(wb, /Quality Statistic/i), { maxCols: 5 });
  const safety = sectionFromSheet(DEFAULT_WPR_TITLES.safety, sheetRows(wb, /HSE Statistic/i), { maxCols: 5 });
  const cubeTest = sectionFromSheet(DEFAULT_WPR_TITLES.cubeTest, sheetRows(wb, /Cube Test/i), { maxCols: 4 });

  const pvaRows = sheetRows(wb, /Planned Vs Actual/i);
  const pvaHeader = pvaRows.findIndex((r) => /sr\.?\s*no/i.test(str(r[0])) && /activity/i.test(str(r[2])));
  const plannedVsActual = sectionFromSheet(DEFAULT_WPR_TITLES.plannedVsActual, pvaRows, {
    headerRow: pvaHeader >= 0 ? pvaHeader : 5,
    maxCols: 12,
  });

  const execRows = sheetRows(wb, /As per drawing status|Weekly Executed/i);
  const weeklyExecuted = sectionFromSheet(DEFAULT_WPR_TITLES.weeklyExecuted, execRows, {
    headerRow: firstHeaderIndex(execRows, 3),
    maxCols: 9,
  });

  const valueAddition = sectionFromSheet(DEFAULT_WPR_TITLES.valueAddition, sheetRows(wb, /Value Addition/i), {
    maxCols: 12,
  });
  const designStatus = sectionFromSheet(DEFAULT_WPR_TITLES.designStatus, sheetRows(wb, /Design status/i), {
    headerRow: firstHeaderIndex(sheetRows(wb, /Design status/i), 0),
    maxCols: 8,
  });

  let prTracker: WprSection = {
    title: DEFAULT_WPR_TITLES.prTracker,
    headers: ["Sr", "PR Type", "PR No", "Discipline", "Qty", "Unit", "Rate", "Amount", "PO"],
    rows: [],
  };
  let invoiceTracker: WprSection = {
    title: DEFAULT_WPR_TITLES.invoiceTracker,
    headers: ["Sr", "Name of Work", "Invoice No", "PO", "Vendor", "Invoice Date", "Amount excl. GST", "COP Status"],
    rows: [],
  };

  const prPath = resolvePrTrackerWorkbook();
  if (prPath) {
    const prWb = XLSX.readFile(prPath);
    prTracker = sectionFromSheet(DEFAULT_WPR_TITLES.prTracker, sheetRows(prWb, /PR Tracker/i), {
      headerRow: 1,
      maxCols: 10,
    });
    invoiceTracker = sectionFromSheet(DEFAULT_WPR_TITLES.invoiceTracker, sheetRows(prWb, /Invoice/i), {
      headerRow: 1,
      maxCols: 8,
    });
  }

  const pvaWeekly = (plannedVsActual.rows || [])
    .map((r) => ({
      label: `${str(r[1])} ${str(r[2])}`.trim().slice(0, 28),
      planned: num(r[10]),
      actual: num(r[11]),
    }))
    .filter((r) => r.label && (Math.abs(r.planned) > 0.05 || Math.abs(r.actual) > 0.05));
  const pvaCum = (plannedVsActual.rows || [])
    .map((r) => ({
      label: `${str(r[1])} ${str(r[2])}`.trim().slice(0, 28),
      planned: num(r[7] || r[6]),
      actual: num(r[8]),
    }))
    .filter((r) => r.label && (r.planned || r.actual))
    .slice(0, 18);
  const pvaChartRows = (pvaWeekly.length >= 4 ? pvaWeekly : pvaCum).slice(0, 18);

  const execChart = (weeklyExecuted.rows || [])
    .map((r) => ({
      label: `${str(r[1])} ${str(r[2])}`.trim().slice(0, 28),
      planned: num(r[6]),
      actual: num(r[7]),
    }))
    .filter((r) => r.label && (r.planned || r.actual))
    .slice(0, 16);

  const sections: WprSections = {
    cover: { title: "Cover", headers: ["Field", "Value"], rows: [["Week", "23 Jul 2026 – 29 Jul 2026"]] },
    index: {
      title: "Index",
      headers: ["No", "Sheet"],
      rows: [
        [1, DEFAULT_WPR_TITLES.brief],
        [2, DEFAULT_WPR_TITLES.projectDashboard],
        [3, DEFAULT_WPR_TITLES.communicationMatrix],
        [4, DEFAULT_WPR_TITLES.capex],
        [5, DEFAULT_WPR_TITLES.hindrance],
        [6, DEFAULT_WPR_TITLES.risk],
        [7, DEFAULT_WPR_TITLES.legal],
        [8, DEFAULT_WPR_TITLES.procurement],
        [9, DEFAULT_WPR_TITLES.manpowerHistogram],
        [10, DEFAULT_WPR_TITLES.cashflow],
        [11, DEFAULT_WPR_TITLES.quality],
        [12, DEFAULT_WPR_TITLES.safety],
        [13, DEFAULT_WPR_TITLES.cubeTest],
        [14, DEFAULT_WPR_TITLES.plannedVsActual],
        [15, DEFAULT_WPR_TITLES.valueAddition],
        [16, DEFAULT_WPR_TITLES.weeklyExecuted],
        [17, DEFAULT_WPR_TITLES.designStatus],
        [18, DEFAULT_WPR_TITLES.drawingRegister],
        [19, DEFAULT_WPR_TITLES.prTracker],
        [20, DEFAULT_WPR_TITLES.invoiceTracker],
        [21, DEFAULT_WPR_TITLES.milestones],
        [22, DEFAULT_WPR_TITLES.materialStock],
      ],
    },
    brief: buildArvindBrief(),
    stakeholders: {
      title: DEFAULT_WPR_TITLES.stakeholders,
      headers: ["Role", "Organisation"],
      rows: [
        ["Client", "Arvind Limited"],
        ["Consultant", "AK.Consultant"],
        ["PMC", "Sharnam Project Development Consultants & Co."],
        ["Civil contractor", "Bhavana Infra"],
      ],
    },
    hindrance,
    risk,
    legal,
    procurement,
    manpowerHistogram: manpower,
    cashflow,
    quality,
    safety,
    cubeTest,
    plannedVsActual,
    weeklyExecuted,
    valueAddition,
    designStatus,
    prTracker,
    invoiceTracker,
    projectDashboard: buildBudgetDashboard(),
    milestones: buildMilestones(),
    materialStock: buildMaterialStock(),
    communicationMatrix: buildArvindComms(),
    mobilisation: {
      title: DEFAULT_WPR_TITLES.mobilisation,
      headers: ["Item", "Status"],
      rows: [
        ["Site establishment / container office", "In progress"],
        ["Labour camp / dormitory", "Ongoing"],
        ["Temporary power / borewell", "Client action pending"],
        ["Machinery & shuttering", "Partial — shortage flagged in risk register"],
      ],
    },
    drawingRegister: buildDrawingRegister(execRows),
    criticalAreas: {
      title: DEFAULT_WPR_TITLES.criticalAreas,
      headers: ["Area", "Issue", "Status"],
      rows: (hindrance.rows || []).slice(0, 8).map((r) => [str(r[1]) || "Site", str(r[2] || r[3]), str(r[5] || r[4] || "Open")]),
    },
    capex: buildCapexFromBudget(),
  };

  const header: WprHeader = {
    projectName: "Construction of Worker Dormitory — Arvind Limited, Santej",
    projectCode: "SPDC-ARVIND-01",
    reportNumber: 52,
    weekStart: "2026-07-23",
    weekEnd: "2026-07-29",
    clientName: "Arvind Limited",
    designConsultant: "AK.Consultant",
    contractorName: "Bhavana Infra",
    location: "Santej",
    pmc: "Sharnam Project Development Consultants & Co.",
  };

  const photos = extractClientWprPhotos();
  if (photos.length) {
    sections.progressPictures = {
      title: "Project Progress Pictures",
      headers: ["Caption"],
      rows: photos.slice(0, 8).map((_, i) => [`Progress photo ${i + 1}`]),
      photos: photos.slice(0, 8),
    };
    sections.weeklyExecuted = {
      ...weeklyExecuted,
      photos: photos.slice(8, 14),
    };
    sections.cubeTest = { ...cubeTest, photos: photos.slice(14, 17) };
    sections.safety = { ...safety, photos: photos.slice(17, 20) };
    sections.mobilisation = {
      ...(sections.mobilisation || { title: DEFAULT_WPR_TITLES.mobilisation, headers: ["Item", "Status"], rows: [] }),
      photos: photos.slice(20, 22),
    };
  }

  const charts = mergeWprChartsForExport(sections, null, header.weekStart!, header.weekEnd!);
  if (pvaChartRows.length) charts.plannedVsActual = pvaChartRows;
  else if (execChart.length) charts.plannedVsActual = execChart;
  const cashBars = (cashflow.rows || [])
    .map((r) => ({ label: str(r[0]), planned: num(r[3]), actual: num(r[4]) }))
    .filter((r) => r.label && (r.planned || r.actual));
  if (cashBars.length) {
    charts.cashflow = cashBars;
    const pTot = cashBars.reduce((s, r) => s + r.planned, 0);
    const aTot = cashBars.reduce((s, r) => s + r.actual, 0);
    let p = 0;
    let a = 0;
    charts.scurve = cashBars.map((r) => {
      p += r.planned;
      a += r.actual;
      return {
        date: header.weekStart!,
        label: r.label,
        planned: pTot ? Math.round((p / pTot) * 1000) / 10 : 0,
        actual: aTot ? Math.round((a / aTot) * 1000) / 10 : 0,
      };
    });
    const last = charts.scurve.at(-1);
    if (last) {
      charts.summary.plannedPct = last.planned;
      charts.summary.actualPct = last.actual;
      charts.summary.variancePct = Math.round((last.actual - last.planned) * 10) / 10;
      charts.summary.spi = last.planned > 0 ? Math.round((last.actual / last.planned) * 100) / 100 : 1;
    }
  }
  const manBars = (manpower.rows || [])
    .map((r) => ({ label: str(r[0]), planned: num(r[1]), actual: num(r[2]) }))
    .filter((r) => r.label && (r.planned || r.actual));
  if (manBars.length) charts.manpowerHistogram = manBars;
  const hseHours = (safety.rows || []).find((r) => /safe-manhours/i.test(str(r[1])));
  const budgetDash = sections.projectDashboard;
  charts.dashboardKpis = [
    ["Week", "23–29 Jul 2026"],
    ["Project", "Worker Dormitory · Santej"],
    ["Budgeted (INR)", (budgetDash?.rows || []).find((r) => /budgeted/i.test(str(r[0])))?.[1] || "—"],
    ["Achieved (INR)", (budgetDash?.rows || []).find((r) => /achieved/i.test(str(r[0])))?.[1] || "—"],
    ["Cost completion", (budgetDash?.rows || []).find((r) => /cost completion/i.test(str(r[0])))?.[1] || "—"],
    ["Schedule", (budgetDash?.rows || []).find((r) => /schedule/i.test(str(r[0])))?.[1] || "Delayed"],
    ["Safe manhours (cum.)", hseHours ? num(hseHours[4]) : "—"],
    ["Quality observations", (quality.rows || []).reduce((n, r) => n + num(r[2]), 0)],
    ["Open NCRs", (quality.rows || []).filter((r) => /ncr/i.test(str(r[1]))).reduce((n, r) => n + num(r[3]), 0)],
    ["Hindrances", (hindrance.rows || []).length],
  ];
  charts.summary.openNcrs = num((quality.rows || []).find((r) => /ncr/i.test(str(r[1])))?.[3]);
  charts.summary.drawingsRegistered = (sections.drawingRegister?.rows || []).length;
  charts.summary.milestonesTotal = (sections.milestones?.rows || []).length;
  charts.summary.milestonesOnTrack = (sections.milestones?.rows || []).filter((r) => num(r[8]) > 0 && num(r[8]) <= num(r[5])).length;

  const dciCounts = new Map<string, number>();
  for (const r of sections.drawingRegister?.rows || []) {
    const a = str(r[0]);
    if (!a || /^total$/i.test(a) || /discipline/i.test(a)) continue;
    const disc = /^(ST|S)/i.test(a)
      ? "Structural"
      : /^A/i.test(a)
        ? "Architecture"
        : /^E/i.test(a)
          ? "Electrical"
          : /^P/i.test(a)
            ? "Plumbing"
            : /^F/i.test(a)
              ? "Fire"
              : "Other";
    dciCounts.set(disc, (dciCounts.get(disc) || 0) + 1);
  }
  if (dciCounts.size) {
    charts.drawingDci = [...dciCounts].map(([label, value]) => ({ label, value }));
  }

  return { header, sections, charts };
}

function buildArvindBrief(): WprSection {
  return {
    title: DEFAULT_WPR_TITLES.brief,
    notes:
      "Construction of Dormitory for Workers at Santej for Arvind Limited — 4,500 sqm, 8-month package. Week 23–29 July 2026 from the client WPR workbook.",
    headers: ["Field", "Value"],
    rows: [
      ["Client", "Arvind Limited"],
      ["Project", "Construction of Dormitory for Workers, Santej"],
      ["Purpose", "Dormitory Facility"],
      ["Area", "4,500 sqm"],
      ["Contract value (INR)", "10,46,48,777"],
      ["Duration", "8 Months"],
      ["Schedule", "Delayed"],
      ["PMC", "Sharnam Project Development Consultants & Co."],
      ["Consultant", "AK.Consultant"],
      ["Contractor", "Bhavana Infra"],
      ["Week", "23 July 2026 to 29 July 2026"],
    ],
  };
}

function pct(n: number): string {
  if (!n) return "";
  return n <= 1.5 ? `${Math.round(n * 1000) / 10}%` : `${Math.round(n * 10) / 10}%`;
}

function buildBudgetDashboard(): WprSection {
  const p = resolveSource(
    ["module_prompts", "untitled folder", "Dash Bord For Budget 52.xlsx"],
    ["templates", "wpr-client", "Project-Dashboard-Budget-Template.xlsx"]
  );
  const rows: (string | number | null)[][] = [
    ["Project", "Construction of Dormitory for Workers"],
    ["Purpose", "Dormitory Facility"],
    ["Area (sqm)", 4500],
    ["Duration", "8 Months"],
    ["Schedule", "Delayed"],
    ["Week ending", "29-07-2026"],
    ["Budgeted project value (INR)", "10,46,48,777"],
    ["Anticipated project value (INR)", "11,12,31,831"],
    ["Achieved as on date (INR)", "10,96,50,960"],
    ["Billed till date (INR)", "8,15,27,326"],
    ["Cost completion %", "98.6%"],
    ["Variance vs budget", "6.3%"],
  ];
  if (p) {
    const wb = XLSX.readFile(p);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    const name = str(grid[2]?.[0]).replace(/^Project Name:\s*/i, "");
    const purpose = str(grid[3]?.[0]).replace(/^Purpose of the Facility:\s*/i, "");
    const area = num(grid[2]?.[3]);
    const duration = str(grid[4]?.[3]);
    const schedule = str(grid[4]?.[5]);
    const budgeted = num(grid[6]?.[2]);
    const anticipated = num(grid[7]?.[2]);
    const variance = num(grid[8]?.[2]);
    const achieved = num(grid[9]?.[2]);
    const billed = num(grid[12]?.[2]);
    const costPct = num(grid[13]?.[2]);
    const start = excelSerialDate(grid[6]?.[6]);
    const actualStart = excelSerialDate(grid[7]?.[6]);
    const end = excelSerialDate(grid[8]?.[6]);
    if (name) rows[0][1] = name;
    if (purpose) rows[1][1] = purpose;
    if (area) rows[2][1] = area;
    if (duration) rows[3][1] = duration;
    if (schedule) rows[4][1] = schedule;
    if (budgeted) rows[6][1] = inr(budgeted);
    if (anticipated) rows[7][1] = inr(anticipated);
    if (achieved) rows[8][1] = inr(achieved);
    if (billed) rows[9][1] = inr(billed);
    if (costPct) rows[10][1] = pct(costPct);
    if (variance) rows[11][1] = pct(variance);
    if (start) rows.push(["Scheduled start", start]);
    if (actualStart) rows.push(["Actual start", actualStart]);
    if (end) rows.push(["Baseline end", end]);
    const planDays = num(grid[6]?.[9]);
    const actDays = num(grid[6]?.[11]);
    if (planDays) rows.push(["Plan days (calendar)", planDays]);
    if (actDays) rows.push(["Actual days (calendar)", actDays]);
  }
  return { title: DEFAULT_WPR_TITLES.projectDashboard, headers: ["KPI", "Value"], rows };
}

function buildCapexFromBudget(): WprSection {
  const p = resolveSource(
    ["module_prompts", "untitled folder", "SPDC_Budget_Arvind 52.xls"],
    ["module_prompts", "Sharnam_modules_docs 2", "SPDC_Budget_Arvind 49.xls"]
  );
  if (p) {
    const rows = sheetRows(XLSX.readFile(p), /^Budget$/i);
    return {
      ...sectionFromSheet(DEFAULT_WPR_TITLES.capex, rows, { headerRow: 5, dataFrom: 7, maxCols: 12 }),
      notes: "SPDC Budget WBS — Arvind dormitory pack (week 52).",
    };
  }
  const dash = buildBudgetDashboard();
  return {
    title: DEFAULT_WPR_TITLES.capex,
    notes: "From Dash Bord For Budget 52 — Anup-II dormitory pack.",
    headers: ["Item", "Amount"],
    rows: (dash.rows || []).filter((r) => /value|billed|achieved|variance/i.test(str(r[0]))),
  };
}

function buildArvindComms(): WprSection {
  return {
    title: DEFAULT_WPR_TITLES.communicationMatrix,
    notes: "Arvind dormitory — week 23–29 July 2026. Technical / commercial routing.",
    headers: ["Type", "From", "To", "Channel", "SLA"],
    rows: [
      ["Technical query", "Contractor — Bhavana Infra", "PMC — Sharnam", "Email + site", "24 hrs"],
      ["Drawing release", "Consultant — AK.Consultant", "PMC / Contractor", "Email + DMS", "48 hrs"],
      ["Site instruction", "PMC — Sharnam", "Contractor", "Site + email", "Same day"],
      ["Commercial / PR", "PMC — Sharnam", "Client — Arvind Limited", "Email", "5 days"],
      ["Invoice / COP", "Contractor / PMC", "Client — Arvind Limited", "Email + hard copy", "7 days"],
      ["Hindrance / risk", "PMC — Sharnam", "Client + Consultant", "WPR + email", "Weekly"],
    ],
  };
}

function buildDrawingRegister(execRows: unknown[][]): WprSection {
  const p = resolveSource(
    ["module_prompts", "untitled folder", "DCI_ARVIND LIMITED_17-6-2026.xlsx"],
    ["templates", "wpr-client", "DCI-Drawing-Register-Template.xlsx"]
  );
  if (p) {
    const rows = sheetRows(XLSX.readFile(p), /DCI/i);
    const header = rows.findIndex((r) => /dwg\.?\s*no|title/i.test(str(r[2] || r[4] || r[0])));
    return {
      ...sectionFromSheet(DEFAULT_WPR_TITLES.drawingRegister, rows, {
        headerRow: header >= 0 ? header : 2,
        maxCols: 12,
        skipEmpty: 2,
      }),
      notes: "DCI — Arvind Limited drawing register (17 Jun 2026 cut).",
    };
  }
  return sectionFromSheet(DEFAULT_WPR_TITLES.drawingRegister, execRows, {
    headerRow: firstHeaderIndex(execRows, 3),
    maxCols: 9,
  });
}

function buildMilestones(): WprSection {
  const p = resolveSource(
    ["module_prompts", "untitled folder", "Dash Bord For Budget 52.xlsx"],
    ["templates", "wpr-client", "Project-Dashboard-Budget-Template.xlsx"]
  );
  const rows: (string | number | null)[][] = [
    ["M01", "Start", "Scheduled start", "", "", 316, "", "", 384, ""],
    ["M02", "Civil", "Building civil — anticipated end", "", "", "", "", "", "", ""],
    ["M03", "External", "External civil — anticipated end", "", "", "", "", "", "", ""],
    ["M04", "MEP", "Plumbing — anticipated end", "", "", "", "", "", "", ""],
  ];
  if (p) {
    const wb = XLSX.readFile(p);
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
      defval: "",
    }) as unknown[][];
    const planDays = num(grid[6]?.[9]) || 316;
    const actDays = num(grid[6]?.[11]) || 384;
    rows[0] = [
      "M01",
      "Start",
      "Construction start vs calendar",
      excelSerialDate(grid[6]?.[6]),
      excelSerialDate(grid[8]?.[6]),
      planDays,
      excelSerialDate(grid[7]?.[6]),
      "",
      actDays,
      "",
    ];
    rows[1] = [
      "M02",
      "Civil",
      "Building civil work anticipated end",
      excelSerialDate(grid[8]?.[6]),
      excelSerialDate(grid[9]?.[6]),
      "",
      "",
      "",
      "",
      "",
    ];
    rows[2] = [
      "M03",
      "External",
      "External civil anticipated end",
      "",
      excelSerialDate(grid[10]?.[6]),
      "",
      "",
      "",
      "",
      "",
    ];
    rows[3] = [
      "M04",
      "MEP",
      "Plumbing anticipated end",
      "",
      excelSerialDate(grid[11]?.[6]),
      "",
      "",
      "",
      "",
      "",
    ];
  }
  return {
    title: DEFAULT_WPR_TITLES.milestones,
    notes: "Arvind dormitory dates from Dash Bord For Budget 52 (Anup-II) — not the generic Progress Overview sample.",
    headers: [
      "ID",
      "Phase",
      "Milestone",
      "Planned start",
      "Planned end",
      "Planned days",
      "Actual start",
      "Actual end",
      "Actual days",
      "Weight %",
    ],
    rows,
  };
}

function buildMaterialStock(): WprSection {
  const p = resolveSource(
    ["module_prompts", "untitled folder", "Site Materials-52.xls"],
    ["templates", "wpr-client", "Site-Materials-Template.xls"]
  );
  if (!p) {
    return { title: DEFAULT_WPR_TITLES.materialStock, headers: ["Sr", "Material", "Balance"], rows: [] };
  }
  return sectionFromSheet(DEFAULT_WPR_TITLES.materialStock, sheetRows(XLSX.readFile(p), /Sheet1/i), {
    headerRow: 0,
    maxCols: 8,
  });
}

function extractClientWprPhotos(): string[] {
  const pptx = resolveSource(["module_prompts", "Sharnam_modules_docs 2", "SPDC_Arvind Limited_WPR_50.pptx"]);
  if (!pptx) return [];
  const dest = path.join(os.tmpdir(), "wpr50-media");
  try {
    fs.mkdirSync(dest, { recursive: true });
    execSync(`unzip -o -qq ${JSON.stringify(pptx)} "ppt/media/*" -d ${JSON.stringify(dest)}`, { stdio: "ignore" });
    const media = path.join(dest, "ppt", "media");
    if (!fs.existsSync(media)) return [];
    return fs
      .readdirSync(media)
      .filter((f) => /\.(jpe?g|png)$/i.test(f))
      .map((f) => path.join(media, f))
      .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)
      .slice(0, 24);
  } catch {
    return [];
  }
}
