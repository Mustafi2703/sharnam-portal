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
import XLSX from "../lib/xlsx.js";

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

export type WprPackInput = {
  header: WprHeader;
  sections: WprSections;
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
  prTracker: "Project PR Tracker",
  hindrance: "Hindrance Register",
  risk: "Risk Register",
  legal: "Legal Approval Tracker",
  drawingRegister: "Drawing Register (DCI)",
  designStatus: "Design Status",
  procurement: "Procurement Status",
  milestones: "Project Milestone Schedule",
  manpowerHistogram: "Weekly Manpower Histogram",
  weeklyExecuted: "Weekly Executed Plan",
  cashflow: "Project Cashflow Overview",
  quality: "Weekly Quality Updates (QAP)",
  cubeTest: "Cube Test",
  safety: "Weekly Safety Updates",
  plannedVsActual: "Planned vs. Actual",
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

export function buildWprWorkbook(input: WprPackInput): Buffer {
  const wb = XLSX.utils.book_new();
  const H = input.header;

  // -------------------- Cover --------------------
  const cover: (string | number | null)[][] = [
    ["WEEKLY PROGRESS REPORT"],
    [safeStr(H.clientName || H.projectName || "")],
    [`REPORT NO. ${H.reportNumber ?? ""}`],
    [`(${safeStr(H.weekStart)}   to   ${safeStr(H.weekEnd)})`],
    [""],
    ["Project", safeStr(H.projectName)],
    ["Code", safeStr(H.projectCode)],
    ["Client", safeStr(H.clientName)],
    ["Design consultant", safeStr(H.designConsultant)],
    ["Contractor", safeStr(H.contractorName)],
    ["Location", safeStr(H.location)],
    ["PMC", safeStr(H.pmc || "Sharnam Project Development Consultants & Co.")],
  ];
  const wsCover = XLSX.utils.aoa_to_sheet(cover);
  wsCover["!cols"] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsCover, sheetName("00 Cover"));

  // -------------------- One sheet per section --------------------
  let idx = 1;
  for (const key of SECTION_ORDER) {
    if (key === "cover") continue;
    const sec = input.sections[key];
    const title = sec?.title || DEFAULT_WPR_TITLES[key];
    const filled: WprSection = { ...(sec || {}), title };
    const aoa = sectionToAoA(filled);
    if (!filled.notes && !(filled.rows && filled.rows.length) && !(filled.photos && filled.photos.length)) {
      aoa.push(["(No content added yet — fill this section in the WPR Maker.)"]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const maxCols = aoa.reduce((m, r) => Math.max(m, r.length), 1);
    ws["!cols"] = Array.from({ length: maxCols }, () => ({ wch: 22 }));
    const label = `${String(idx).padStart(2, "0")} ${title}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName(label));
    idx += 1;
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
