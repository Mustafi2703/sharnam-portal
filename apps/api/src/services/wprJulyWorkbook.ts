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
  const names = [
    path.join(process.cwd(), "module_prompts", "untitled folder", "PR Tracker-52.xlsx"),
    path.join(process.cwd(), "templates", "wpr-client", "PR-Tracker-Template.xlsx"),
  ];
  return names.find((p) => fs.existsSync(p)) || null;
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

  const pvaChartRows = (plannedVsActual.rows || [])
    .map((r) => ({
      label: `${str(r[1])} ${str(r[2])}`.trim().slice(0, 28),
      planned: num(r[10] ?? r[6]),
      actual: num(r[11] ?? r[7]),
    }))
    .filter((r) => r.label && (r.planned || r.actual))
    .slice(0, 18);

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
        [1, DEFAULT_WPR_TITLES.hindrance],
        [2, DEFAULT_WPR_TITLES.risk],
        [3, DEFAULT_WPR_TITLES.legal],
        [4, DEFAULT_WPR_TITLES.procurement],
        [5, DEFAULT_WPR_TITLES.manpowerHistogram],
        [6, DEFAULT_WPR_TITLES.cashflow],
        [7, DEFAULT_WPR_TITLES.quality],
        [8, DEFAULT_WPR_TITLES.safety],
        [9, DEFAULT_WPR_TITLES.cubeTest],
        [10, DEFAULT_WPR_TITLES.plannedVsActual],
        [11, DEFAULT_WPR_TITLES.valueAddition],
        [12, DEFAULT_WPR_TITLES.weeklyExecuted],
        [13, DEFAULT_WPR_TITLES.designStatus],
        [14, DEFAULT_WPR_TITLES.prTracker],
        [15, DEFAULT_WPR_TITLES.invoiceTracker],
      ],
    },
    brief: {
      title: DEFAULT_WPR_TITLES.brief,
      headers: ["Item", "Detail"],
      rows: [
        ["Client", "Arvind Limited"],
        ["Project", "Construction of Worker Dormitory, Santej"],
        ["PMC", "Sharnam Project Development Consultants & Co."],
        ["Week", "23 July 2026 to 29 July 2026"],
        ["Source", path.basename(wprPath)],
      ],
    },
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
      title: DEFAULT_WPR_TITLES.mobilisation,
      headers: ["Item", "Status"],
      rows: [["Site establishment", "In progress"], ["Labour camp / dormitory", "Ongoing"]],
      photos: photos.slice(20, 22),
    };
  }

  const charts = mergeWprChartsForExport(sections, null, header.weekStart!, header.weekEnd!);
  if (pvaChartRows.length) charts.plannedVsActual = pvaChartRows;
  else if (execChart.length) charts.plannedVsActual = execChart;
  const hseHours = (safety.rows || []).find((r) => /safe-manhours/i.test(str(r[1])));
  if (hseHours) {
    charts.summary.safetyEvents = num(hseHours[3]);
    charts.dashboardKpis = [
      ["Week", "23–29 Jul 2026"],
      ["Safe manhours (cum.)", num(hseHours[4]) || "—"],
      ["Quality observations", (quality.rows || []).reduce((n, r) => n + num(r[2]), 0)],
      ["Open NCRs", (quality.rows || []).filter((r) => /ncr/i.test(str(r[1]))).reduce((n, r) => n + num(r[3]), 0)],
      ["Hindrances logged", (hindrance.rows || []).length],
      ["Risks open", (risk.rows || []).length],
      ["PRs this week", (prTracker.rows || []).length],
      ["Invoices tracked", (invoiceTracker.rows || []).length],
      ["Cashflow months", (cashflow.rows || []).length],
    ];
  }

  return { header, sections, charts };
}

function extractClientWprPhotos(): string[] {
  const pptx = path.join(
    process.cwd(),
    "module_prompts",
    "Sharnam_modules_docs 2",
    "SPDC_Arvind Limited_WPR_50.pptx"
  );
  if (!fs.existsSync(pptx)) return [];
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
