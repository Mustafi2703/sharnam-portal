/**
 * Read-only audit of Arvind / module_prompts workbooks:
 * locate file → open if spreadsheet → match importer → report leftover gaps.
 */
import fs from "fs";
import path from "path";
import { findWorkbook } from "../lib/excelRoot.js";
import XLSX from "../lib/xlsx.js";
import { isFullSpdcWorkbook } from "./costSheetParser.js";

export type SheetAuditStatus = "imported" | "export_template" | "unused" | "out_of_scope" | "missing" | "parse_fail";

export type SheetAuditRow = {
  name: string;
  status: SheetAuditStatus;
  importer: string;
  feeds: string;
  found: string | null;
  sheets: string[];
  headerFingerprint: string;
  dataRows: number;
  detail?: string;
};

export type BudgetHealth = {
  name: string;
  found: string | null;
  fullSpdcWorkbook: boolean;
  sheets: string[];
  monitoringTabs: number;
  mbTabs: number;
  bbsTabs: number;
  costSource: boolean;
  detail: string;
};

type CatalogEntry = {
  names: string[];
  status: Exclude<SheetAuditStatus, "missing" | "parse_fail">;
  importer: string;
  feeds: string;
  detail?: string;
};

const CATALOG: CatalogEntry[] = [
  { names: ["SPDC_Budget_Arvind 49.xls"], status: "imported", importer: "budgetWorkbookImport", feeds: "Cost BOQ / MB / BBS (NTX)" },
  { names: ["SPDC_Budget_Arvind 52.xls"], status: "imported", importer: "budgetWorkbookImport", feeds: "Cost BOQ / MB / BBS (Dorm)" },
  { names: ["Dash Bord For Budget 03.xlsx"], status: "unused", importer: "none", feeds: "Not Cost — dashboard overlay if present" },
  { names: ["Dash Bord For Budget 52.xlsx"], status: "imported", importer: "wprJulyWorkbook", feeds: "Dorm WPR narrative only" },
  { names: ["Cashflow - Dashboard (3).xlsx", "Cashflow - Dashboard.xlsx"], status: "imported", importer: "cashflowParser / arvind S-curve", feeds: "Cost cashflow + NTX S-curve" },
  { names: ["Planned Vs. Actual Dashboard (1).xlsx", "Planned Vs. Actual Dashboard.xlsx"], status: "imported", importer: "plannedActualDashboard", feeds: "Progress PvsA + Cost PVA sync" },
  { names: ["Quality Assurance Plan Week 50.xlsx"], status: "imported", importer: "qapImportExport", feeds: "QAP activities" },
  { names: ["SPDC CUBE REGISTER (1).xlsx", "SPDC CUBE REGISTER.xlsx"], status: "imported", importer: "cubeRegisterImport", feeds: "Cube tests" },
  { names: ["Quality Dashboard (1).xlsx", "Quality Dashboard.xlsx"], status: "imported", importer: "qualityChecklistCatalog + fills", feeds: "Checklist catalog + week fill counts" },
  { names: ["DRAWING REGISTER - 03.xlsx"], status: "imported", importer: "drawingRegisterSheets", feeds: "NTX drawings / GFC" },
  { names: ["DRAWING REGISTER - 01.xlsx"], status: "imported", importer: "drawingRegisterSheets", feeds: "Demo / fallback register" },
  { names: ["DCI_ARVIND LIMITED_17-6-2026.xlsx"], status: "imported", importer: "syncDciArvindDrawings", feeds: "Dorm drawings" },
  { names: ["Milestone tracking (2).xlsx", "Milestone tracking.xlsx"], status: "imported", importer: "progressRegistersImport", feeds: "WPR milestones" },
  { names: ["HInderance Register Dashboard.xlsx"], status: "imported", importer: "progressRegistersImport", feeds: "DPR delays · WPR" },
  { names: ["Risk Register - Dashboard 1.xlsx"], status: "imported", importer: "progressRegistersImport", feeds: "WPR risk" },
  { names: ["Legal Approvals - Dashboard (1).xlsx", "Legal Approvals - Dashboard.xlsx"], status: "imported", importer: "progressRegistersImport", feeds: "WPR legal" },
  { names: ["Lessons Learnt - Sharnam PMC.xls"], status: "imported", importer: "progressRegistersImport", feeds: "Lessons learnt" },
  { names: ["Progress Overview.xlsx"], status: "imported", importer: "readProgressOverviewDashboard", feeds: "Progress KPI + register fallback" },
  { names: ["Monthly Progress Dashboard.xlsx"], status: "imported", importer: "progressSorParse", feeds: "SOR stats" },
  { names: ["Safety Dashboard.xlsx"], status: "imported", importer: "hiraRegister + safetyDashboardSheets", feeds: "HIRA / safety KPI" },
  { names: ["WPR  23 July to 29 July.xlsx", "WPR 23 July to 29 July.xlsx"], status: "imported", importer: "wprTrackerPackImport", feeds: "Dorm July trackers" },
  { names: ["PR Tracker-52.xlsx"], status: "imported", importer: "importPrInvoiceFromWorkbook", feeds: "PR + invoice tracker" },
  { names: ["Site Materials-52.xls"], status: "imported", importer: "wprTrackerPackImport", feeds: "Site materials" },
  { names: ["Payment Summary - VIATRIX - Copy.xlsx", "Payment Summary - VIATRIX - Copy (1).xlsx"], status: "imported", importer: "paymentSummaryWorkbook", feeds: "Finance RA / invoices" },
  { names: ["Approval  &  GFC Drawing Log.xlsx"], status: "export_template", importer: "drawings export.csv", feeds: "Generate from portal GFC" },
  { names: ["NCR 01 .xlsx"], status: "export_template", importer: "ncrFormExport", feeds: "Create Quality NCR in UI" },
  { names: ["Safety NCR.xlsx"], status: "export_template", importer: "ncrFormExport", feeds: "Create Safety NCR in UI" },
  { names: ["SPDC_RFI_Form_and_Register.xlsx"], status: "export_template", importer: "spdcRfiForm", feeds: "Create RFI in portal" },
  { names: ["SPDC_Activity_Inspection_Checklist_Format.xlsx"], status: "export_template", importer: "brandedChecklistXlsx", feeds: "QI fill export" },
  { names: ["SPDC_Request_for_Inspection_Form.xlsx"], status: "export_template", importer: "spdcInspectionIr", feeds: "IR fill export" },
  { names: ["SPDC_Safety_Inspection_Request_and_Checklists.xlsx"], status: "imported", importer: "safetyPackSeed", feeds: "Safety checklist templates" },
  { names: ["Drwing check master checklist.xlt.xls", "Drwing check master checklist.xlt"], status: "imported", importer: "seed/seed.ts DrawingCheck", feeds: "Drawing Check template (seed)" },
  { names: ["Viatrix_RA BILL_COP.xlsm"], status: "export_template", importer: "copWorkbook", feeds: "Finance COP download" },
  { names: ["SPDC_Arvind Limited_WPR_50.pptx"], status: "export_template", importer: "wprPptx", feeds: "WPR PPTX layout" },
  { names: ["Project Closure Report.docx"], status: "export_template", importer: "closure template download", feeds: "Closure form" },
  { names: ["DPR-Sharnam PMC- ARVIND LIMITED (3) (1).xlsx"], status: "export_template", importer: "dprXlsx (layout ref)", feeds: "Live DPRs from dpr-templates" },
  { names: ["Snaglist - Sharnam PMC.xlsx", "Snaglist - Sharnam PMC (1).xlsx"], status: "imported", importer: "closureDrawingsSeed", feeds: "Snag items (seed / UI)" },
  { names: ["Communication Matrix_BPCL (2).xlsx"], status: "out_of_scope", importer: "bpclMatrixSeed", feeds: "BPCL CRM — not Arvind week" },
  { names: ["Data - July 2026.xlsx"], status: "out_of_scope", importer: "crm/leads/import", feeds: "CRM leads" },
  { names: ["SPDC_CTC_Structure_Calculator.xlsx"], status: "out_of_scope", importer: "HRMS", feeds: "HRMS CTC" },
  { names: ["SPDC_Letter_of_Appointment.docx"], status: "out_of_scope", importer: "HRMS", feeds: "HRMS appointment" },
  { names: ["KGDPL_JUN_2026_9210100157_Payslip.pdf"], status: "out_of_scope", importer: "HRMS", feeds: "Payslip" },
  {
    names: ["As per Bhavana Infra - Final Construction Work of Dormitory for Workers ,  Arvind Limited.mpp"],
    status: "unused",
    importer: "none",
    feeds: "MS Project — convert to XML later; S-curve uses Cashflow",
  },
];

const SPREADSHEET_EXT = new Set([".xlsx", ".xls", ".xlsm", ".xlt", ".csv"]);

function fingerprint(rows: unknown[][]): string {
  const header = (rows[0] || []).slice(0, 8).map((c) => String(c ?? "").trim()).filter(Boolean);
  return header.join(" | ").slice(0, 160);
}

function countDataRows(rows: unknown[][]): number {
  let n = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row.some((c) => String(c ?? "").trim())) n += 1;
  }
  return n;
}

function auditOne(entry: CatalogEntry): SheetAuditRow {
  const found = findWorkbook(entry.names);
  if (!found) {
    return {
      name: entry.names[0]!,
      status: "missing",
      importer: entry.importer,
      feeds: entry.feeds,
      found: null,
      sheets: [],
      headerFingerprint: "",
      dataRows: 0,
      detail: entry.detail || `Looked for ${entry.names.join(" | ")}`,
    };
  }

  const ext = path.extname(found).toLowerCase();
  if (!SPREADSHEET_EXT.has(ext)) {
    return {
      name: path.basename(found),
      status: entry.status,
      importer: entry.importer,
      feeds: entry.feeds,
      found,
      sheets: [],
      headerFingerprint: "",
      dataRows: 0,
      detail: entry.detail || `Non-spreadsheet (${ext})`,
    };
  }

  try {
    const full = XLSX.readFile(found);
    const sheets = full.SheetNames || [];
    let headerFingerprint = "";
    let dataRows = 0;
    const first = sheets[0] ? full.Sheets[sheets[0]] : undefined;
    if (first) {
      const rows = XLSX.utils.sheet_to_json(first, { header: 1, defval: "" }) as unknown[][];
      headerFingerprint = fingerprint(rows);
      dataRows = countDataRows(rows);
    }
    return {
      name: path.basename(found),
      status: entry.status,
      importer: entry.importer,
      feeds: entry.feeds,
      found,
      sheets,
      headerFingerprint,
      dataRows,
      detail: entry.detail,
    };
  } catch (err) {
    return {
      name: path.basename(found),
      status: "parse_fail",
      importer: entry.importer,
      feeds: entry.feeds,
      found,
      sheets: [],
      headerFingerprint: "",
      dataRows: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function budgetHealthOne(name: string, costSource: boolean): BudgetHealth {
  const found = findWorkbook([name]);
  if (!found) {
    return {
      name,
      found: null,
      fullSpdcWorkbook: false,
      sheets: [],
      monitoringTabs: 0,
      mbTabs: 0,
      bbsTabs: 0,
      costSource,
      detail: "File not found",
    };
  }
  try {
    const buf = fs.readFileSync(found);
    const wb = XLSX.read(buf);
    const sheets = wb.SheetNames || [];
    const monitoringTabs = sheets.filter((n) => /monitor/i.test(n)).length;
    const mbTabs = sheets.filter((n) => /\bmb\b|dormitory mb/i.test(n)).length;
    const bbsTabs = sheets.filter((n) => /\bbbs\b|bending/i.test(n)).length;
    const full = isFullSpdcWorkbook(buf);
    return {
      name: path.basename(found),
      found,
      fullSpdcWorkbook: full,
      sheets,
      monitoringTabs,
      mbTabs,
      bbsTabs,
      costSource: costSource && full,
      detail: full
        ? `Full SPDC budget — ${monitoringTabs} monitoring / ${mbTabs} MB / ${bbsTabs} BBS tabs`
        : "Dashboard overlay — not a Cost source",
    };
  } catch (err) {
    return {
      name,
      found,
      fullSpdcWorkbook: false,
      sheets: [],
      monitoringTabs: 0,
      mbTabs: 0,
      bbsTabs: 0,
      costSource: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export const REAL_PROJECT_LEFTOVERS = [
  "Historical NCR / Safety NCR / RFI registers have no import — create in the portal or add a later importer.",
  "Approval & GFC Drawing Log is export-shaped; inbound GFC is Drawing Register + portal publish.",
  "MS Project .mpp is not imported; S-curve uses Cashflow Dashboard.",
  "Quality Dashboard xlsx on drive stays a template copy unless a live export is added.",
  "QAP contractor / PMC ticks are a human (or demo seed) step — fills do not auto-sign QAP.",
  "Client role cannot upload drawings or open Cost.",
  "Do not set RUN_SEED=1 on Hostinger.",
];

export function auditArvindWorkbooks() {
  const rows = CATALOG.map(auditOne);
  const budget = {
    budget49: budgetHealthOne("SPDC_Budget_Arvind 49.xls", true),
    budget52: budgetHealthOne("SPDC_Budget_Arvind 52.xls", true),
    budget03: budgetHealthOne("Dash Bord For Budget 03.xlsx", false),
    budget52Dashboard: budgetHealthOne("Dash Bord For Budget 52.xlsx", false),
  };
  const counts = {
    imported: rows.filter((r) => r.status === "imported").length,
    export_template: rows.filter((r) => r.status === "export_template").length,
    unused: rows.filter((r) => r.status === "unused").length,
    out_of_scope: rows.filter((r) => r.status === "out_of_scope").length,
    missing: rows.filter((r) => r.status === "missing").length,
    parse_fail: rows.filter((r) => r.status === "parse_fail").length,
  };
  return {
    rows,
    budget,
    counts,
    leftovers: [
      ...REAL_PROJECT_LEFTOVERS,
      ...rows.filter((r) => r.status === "missing" || r.status === "parse_fail").map((r) => `${r.status}: ${r.name}${r.detail ? ` — ${r.detail}` : ""}`),
      ...(!budget.budget03.fullSpdcWorkbook
        ? ["Dash Bord For Budget 03.xlsx is dashboard-only — Cost uses SPDC_Budget_Arvind 49 (NTX) and 52 (Dorm)."]
        : []),
    ],
  };
}
