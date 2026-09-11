/**
 * WPR XLSX generator — produces a multi-sheet workbook mirroring the
 * SPDC_Arvind Limited_WPR_50.pptx section list. Each section becomes a
 * sheet with a title, notes, and a table (rows[]). Photos are listed as
 * SharePoint paths on their own "Photos" sheet so the client can jump
 * straight to the folder.
 *
 * The user drives the content via the WPR Maker page — this file only
 * turns the persisted sectionsJson into a printable pack.
 */
import ExcelJS from "exceljs";
import { sharnamLogoPath } from "./brandedExport.js";

export type WprSection = {
  title: string;
  notes?: string;
  headers?: string[];
  rows?: (string | number | null)[][];
  photos?: string[]; // SharePoint paths / URLs
};

export type WprSections = {
  cover?: WprSection;
  index?: WprSection;
  brief?: WprSection;
  stakeholders?: WprSection;
  mobilisation?: WprSection;
  communicationMatrix?: WprSection;
  projectDashboard?: WprSection;
  criticalAreas?: WprSection;
  capex?: WprSection;
  prTracker?: WprSection;
  invoiceTracker?: WprSection;
  hindrance?: WprSection;
  risk?: WprSection;
  legal?: WprSection;
  drawingRegister?: WprSection;
  designStatus?: WprSection;
  procurement?: WprSection;
  milestones?: WprSection;
  manpowerHistogram?: WprSection;
  weeklyExecuted?: WprSection;
  cashflow?: WprSection;
  quality?: WprSection;
  cubeTest?: WprSection;
  safety?: WprSection;
  plannedVsActual?: WprSection;
  valueAddition?: WprSection;
  materialStock?: WprSection;
  progressPictures?: WprSection;
};

export type WprHeader = {
  projectName?: string;
  projectCode?: string;
  reportNumber?: number;
  weekStart?: string;
  weekEnd?: string;
  clientName?: string;
  designConsultant?: string;
  contractorName?: string;
  location?: string;
  pmc?: string;
};

import type { WprChartPack } from "./wprCharts.js";

export type WprPackInput = {
  header: WprHeader;
  sections: WprSections;
  /** Merged chart pack — when set, PPTX export adds native editable chart slides. */
  charts?: WprChartPack;
  packExtras?: {
    attachments?: { path: string; caption?: string; url?: string }[];
    signatures?: { path: string; role: string; url?: string }[];
  };
};

export const SECTION_ORDER: (keyof WprSections)[] = [
  "cover",
  "index",
  "brief",
  "stakeholders",
  "mobilisation",
  "communicationMatrix",
  "projectDashboard",
  "criticalAreas",
  "capex",
  "prTracker",
  "invoiceTracker",
  "hindrance",
  "risk",
  "legal",
  "drawingRegister",
  "designStatus",
  "procurement",
  "milestones",
  "manpowerHistogram",
  "weeklyExecuted",
  "cashflow",
  "quality",
  "cubeTest",
  "safety",
  "plannedVsActual",
  "valueAddition",
  "materialStock",
  "progressPictures",
];

export const DEFAULT_WPR_TITLES: Record<keyof WprSections, string> = {
  cover: "Cover",
  index: "Index",
  brief: "Project Brief",
  stakeholders: "Project Stakeholders",
  mobilisation: "Mobilisation Plan",
  communicationMatrix: "Communication Matrix",
  projectDashboard: "Project Dashboard",
  criticalAreas: "Critical Areas",
  capex: "Project CAPEX",
  prTracker: "PR Tracker",
  invoiceTracker: "Invoice Processing Tracker",
  hindrance: "Hinderance Register",
  risk: "Risk Register",
  legal: "Legal Approval Tracker",
  drawingRegister: "Drawing Register (DCI)",
  designStatus: "Design status",
  procurement: "Procurement tracker",
  milestones: "Project Milestone Schedule",
  manpowerHistogram: "Weekly Manpower",
  weeklyExecuted: "Weekly Executed Plan",
  cashflow: "Project Cashflow",
  quality: "Quality Statistic",
  cubeTest: "Cube Test",
  safety: "HSE Statistic",
  plannedVsActual: "Planned Vs Actual",
  valueAddition: "Value Addition",
  materialStock: "Material Stock",
  progressPictures: "Project Progress Pictures",
};

function safeStr(v: unknown): string {
  return v == null ? "" : String(v);
}

function sheetName(key: string): string {
  // Excel sheet-name limit is 31 chars
  return key.replace(/[\[\]:*?/\\]/g, "_").slice(0, 31);
}

function sectionToAoA(sec: WprSection): (string | number | null)[][] {
  const aoa: (string | number | null)[][] = [];
  aoa.push([sec.title || ""]);
  if (sec.notes) {
    aoa.push([sec.notes]);
    aoa.push([""]);
  }
  if (sec.headers?.length) {
    aoa.push(sec.headers);
    for (const r of sec.rows || []) aoa.push(r);
  } else if (sec.rows?.length) {
    for (const r of sec.rows) aoa.push(r);
  }
  if (sec.photos?.length) {
    aoa.push([""]);
    aoa.push(["Photos / paths"]);
    for (const p of sec.photos) aoa.push([p]);
  }
  return aoa;
}

export async function buildWprWorkbook(input: WprPackInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sharnam Portal";
  wb.created = new Date();
  const H = input.header;

  const BRAND = "FF0F766E";
  const INK = "FF1A1D26";
  const MUTED = "FF5C6578";
  const HEADER_FILL = "FFF0F2F5";
  const ALT_FILL = "FFF7F9FA";
  const BORDER = "FFE2E5EB";

  const styleHeaderRow = (row: ExcelJS.Row, colCount: number) => {
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.font = { bold: true, size: 10, color: { argb: INK } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: BORDER } } };
    }
    row.height = 22;
  };

  const styleBodyRow = (row: ExcelJS.Row, colCount: number, zebra: boolean) => {
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      if (typeof cell.value === "number") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = { vertical: "middle", wrapText: true };
      }
      if (zebra) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT_FILL } };
      }
      cell.border = { bottom: { style: "hair", color: { argb: BORDER } } };
    }
  };

  const addSectionSheet = (label: string, sec: WprSection) => {
    const ws = wb.addWorksheet(sheetName(label), { views: [{ state: "frozen", ySplit: 0 }] });
    let rowIdx = 1;

    const titleCell = ws.getCell(rowIdx, 1);
    titleCell.value = sec.title || label;
    titleCell.font = { bold: true, size: 14, color: { argb: BRAND } };
    rowIdx += 1;

    if (sec.notes) {
      ws.mergeCells(rowIdx, 1, rowIdx, Math.max(6, sec.headers?.length || 6));
      const notesCell = ws.getCell(rowIdx, 1);
      notesCell.value = sec.notes;
      notesCell.font = { italic: true, size: 10, color: { argb: MUTED } };
      notesCell.alignment = { wrapText: true };
      rowIdx += 2;
    }

    const headers = sec.headers || [];
    const body = sec.rows || [];

    if (headers.length) {
      const hRow = ws.getRow(rowIdx);
      headers.forEach((h, i) => {
        hRow.getCell(i + 1).value = h;
      });
      styleHeaderRow(hRow, headers.length);
      const headerRowNum = rowIdx;
      rowIdx += 1;

      if (body.length) {
        body.forEach((dataRow, ri) => {
          const r = ws.getRow(rowIdx);
          headers.forEach((_, ci) => {
            r.getCell(ci + 1).value = dataRow[ci] ?? "";
          });
          styleBodyRow(r, headers.length, ri % 2 === 1);
          rowIdx += 1;
        });
        ws.autoFilter = {
          from: { row: headerRowNum, column: 1 },
          to: { row: rowIdx - 1, column: headers.length },
        };
      } else {
        ws.mergeCells(rowIdx, 1, rowIdx, headers.length);
        ws.getCell(rowIdx, 1).value = "(No rows — fill in WPR Maker or Regenerate from registers.)";
        ws.getCell(rowIdx, 1).font = { italic: true, color: { argb: MUTED } };
        rowIdx += 1;
      }

      headers.forEach((h, i) => {
        ws.getColumn(i + 1).width = Math.min(42, Math.max(12, String(h).length + 6));
      });
    } else if (body.length) {
      body.forEach((dataRow, ri) => {
        const r = ws.getRow(rowIdx);
        dataRow.forEach((v, ci) => {
          r.getCell(ci + 1).value = v ?? "";
        });
        styleBodyRow(r, dataRow.length, ri % 2 === 1);
        rowIdx += 1;
      });
    } else if (sec.photos?.length) {
      /* handled below */
    } else {
      ws.getCell(rowIdx, 1).value = "(No content added yet — fill this section in the WPR Maker.)";
      ws.getCell(rowIdx, 1).font = { italic: true, color: { argb: MUTED } };
      rowIdx += 1;
    }

    if (sec.photos?.length) {
      rowIdx += 1;
      ws.getCell(rowIdx, 1).value = "Photos / paths";
      ws.getCell(rowIdx, 1).font = { bold: true, size: 10, color: { argb: INK } };
      rowIdx += 1;
      for (const p of sec.photos) {
        ws.getCell(rowIdx, 1).value = p;
        rowIdx += 1;
      }
    }

    return ws;
  };

  // -------------------- Cover --------------------
  const coverWs = wb.addWorksheet(sheetName("00 Cover"), { views: [{ showGridLines: false }] });
  coverWs.getColumn(1).width = 22;
  coverWs.getColumn(2).width = 62;
  const coverRows: (string | number)[][] = [
    ["WEEKLY PROGRESS REPORT", ""],
    [safeStr(H.clientName || H.projectName || ""), ""],
    [`REPORT NO. ${H.reportNumber ?? ""}`, ""],
    [`(${safeStr(H.weekStart)}   to   ${safeStr(H.weekEnd)})`, ""],
    ["", ""],
    ["Project", safeStr(H.projectName)],
    ["Code", safeStr(H.projectCode)],
    ["Client", safeStr(H.clientName)],
    ["Design consultant", safeStr(H.designConsultant)],
    ["Contractor", safeStr(H.contractorName)],
    ["Location", safeStr(H.location)],
    ["PMC", safeStr(H.pmc || "Sharnam Project Development Consultants & Co.")],
  ];
  coverRows.forEach((r) => coverWs.addRow(r));
  coverWs.getRow(1).font = { bold: true, size: 16, color: { argb: BRAND } };
  coverWs.getRow(2).font = { bold: true, size: 12, color: { argb: INK } };
  coverWs.getRow(3).font = { size: 11, color: { argb: INK } };
  coverWs.getRow(4).font = { size: 10, color: { argb: MUTED } };

  const logo = sharnamLogoPath();
  if (logo) {
    try {
      const imgId = wb.addImage({ filename: logo, extension: "png" });
      coverWs.getRow(1).height = 42;
      coverWs.addImage(imgId, { tl: { col: 1.1, row: 0.05 }, ext: { width: 140, height: 46 }, editAs: "oneCell" });
    } catch {
      /* optional logo */
    }
  }

  // -------------------- One sheet per section --------------------
  let idx = 1;
  for (const key of SECTION_ORDER) {
    if (key === "cover") continue;
    const sec = input.sections[key];
    const title = sec?.title || DEFAULT_WPR_TITLES[key];
    const filled: WprSection = { ...(sec || {}), title };
    const label = `${String(idx).padStart(2, "0")} ${title}`;
    addSectionSheet(label, filled);
    idx += 1;
  }

  // -------------------- Dashboard charts --------------------
  if (input.charts) {
    const c = input.charts;
    const dashWs = wb.addWorksheet(sheetName("Charts Dashboard"));
    const dashRows: (string | number | null)[][] = [
      ["WPR Dashboard · chart data"],
      ["Period", `${c.rangeStart} → ${c.rangeEnd}`],
      [],
      ["Summary KPI", "Value"],
      ...c.dashboardKpis.map(([k, v]) => [k, v]),
      [],
      ["S-curve · Date", "Planned %", "Actual %"],
      ...c.scurve.map((p) => [p.label || p.date, p.planned, p.actual]),
      [],
      ["Manpower · Trade", "Required", "Available"],
      ...c.manpowerHistogram.map((p) => [p.label, p.planned, p.actual]),
      [],
      ["Cashflow · Period", "Planned (Lakh)", "Actual (Lakh)"],
      ...c.cashflow.map((p) => [p.label, p.planned, p.actual]),
      [],
      ["Milestones", "Planned days", "Actual days"],
      ...c.milestones.map((p) => [p.label, p.planned, p.actual]),
      [],
      ["Planned vs Actual qty", "Planned", "Actual"],
      ...c.plannedVsActual.map((p) => [p.label, p.planned, p.actual]),
      [],
      ["Quality status", "Count"],
      ...c.quality.map((p) => [p.label, p.value]),
      [],
      ["Safety · Indicator", "Previous week", "Current week"],
      ...c.safety.map((p) => [p.label, p.previous, p.current]),
    ];
    dashRows.forEach((r) => dashWs.addRow(r));
    dashWs.getRow(1).font = { bold: true, size: 13, color: { argb: BRAND } };
    dashWs.getColumn(1).width = 28;
    dashWs.getColumn(2).width = 16;
    dashWs.getColumn(3).width = 16;
  }

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}
