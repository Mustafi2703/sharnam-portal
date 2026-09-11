/** ISO SharePoint roots per portal module — mirrors apps/api/src/services/graph.ts MODULE_TO_ISO_FOLDER */

export type ModuleFilesKey =
  | "quality"
  | "safety"
  | "drawings"
  | "progress"
  | "reports"
  | "cost"
  | "finance"
  | "comms"
  | "auditKpi"
  | "inspection";

export type ModuleFileConfig = {
  root: string;
  title: string;
  eyebrow: string;
  hubPath: string;
  subtitle: string;
  /** RFI kinds shown in the portal records panel */
  rfiKinds?: string[];
  /** Show quality NCR rows in portal panel */
  showQualityNcr?: boolean;
  /** Show safety NCR rows in portal panel */
  showSafetyNcr?: boolean;
  /** Branded register exports (XLSX) filed to this module's ISO folder */
  registerExports?: { label: string; downloadPath: string; isoSubfolder?: string }[];
};

export const MODULE_FILE_CONFIG: Record<ModuleFilesKey, ModuleFileConfig> = {
  quality: {
    root: "08_QUALITY_HSE_AND_ENVIRONMENT",
    title: "Quality files",
    eyebrow: "Quality · ISO 08",
    hubPath: "hub/quality",
    subtitle:
      "QAP, checklists, cube tests, NCR/CAR — browse the SharePoint ISO tree and open portal exports (RFI, forms, registers).",
    rfiKinds: ["QualityInspection", "SiteExecution", "QualityIR"],
    showQualityNcr: true,
    registerExports: [
      {
        label: "QAP register (XLSX)",
        downloadPath: "/api/checklist/project/:projectId/qap/download.xlsx",
        isoSubfolder: "08.01_Quality_Plans_and_Inspection_Test_Plans",
      },
      {
        label: "Cube test register (XLSX)",
        downloadPath: "/api/checklist/project/:projectId/cubes/download.xlsx",
        isoSubfolder: "08.03_Testing_Test_Report_Control",
      },
    ],
  },
  safety: {
    root: "08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment",
    title: "Safety files",
    eyebrow: "Safety · ISO 08.07",
    hubPath: "hub/safety",
    subtitle: "HIRA, safety NCR, observations — SharePoint HSE folder plus live safety RFIs and NCR forms.",
    rfiKinds: ["SafetyChecklist", "SafetyIR"],
    showSafetyNcr: true,
    registerExports: [
      {
        label: "Safety / observation log (CSV via DMS refresh)",
        downloadPath: "",
        isoSubfolder: "08.07_Hazard_Identification_Risk_Assessment",
      },
    ],
  },
  drawings: {
    root: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications",
    title: "Drawing files",
    eyebrow: "Drawings · ISO 04.02",
    hubPath: "hub/drawings",
    subtitle: "GFC PDFs/DWG by discipline. Live register CSVs → _Registers/Drawings (use Refresh registers in DMS).",
    rfiKinds: ["RequestForInformation", "DrawingChecklist"],
    registerExports: [
      {
        label: "RFI correspondence log (CSV)",
        downloadPath: "",
        isoSubfolder: "03.06_Correspondence_Control",
      },
    ],
  },
  progress: {
    root: "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records",
    title: "Progress & site files",
    eyebrow: "Progress · ISO 07.02",
    hubPath: "hub/progress",
    subtitle: "DPR discipline folders, photos, daily records — open SharePoint copies alongside portal registers.",
  },
  reports: {
    root: "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS",
    title: "Reports & MIS files",
    eyebrow: "Reports · ISO 10.01",
    hubPath: "hub/reports",
    subtitle: "WPR packs, MIS exports, published weekly reports — SharePoint MIS folder.",
  },
  cost: {
    root: "09_COMMERCIAL_AND_CHANGE",
    title: "Cost & commercial files",
    eyebrow: "Cost · ISO 09",
    hubPath: "hub/cost",
    subtitle: "BOQ workbooks, MB/BBS, vendor bills, cashflow — commercial ISO tree.",
  },
  finance: {
    root: "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification",
    title: "Finance & RA files",
    eyebrow: "Finance · ISO 09.01",
    hubPath: "hub/finance",
    subtitle: "RA workbooks, COP, PR Tracker, invoice processing — ISO 09.01. PRs also file under 05.01 Procurement.",
    registerExports: [
      {
        label: "PR Tracker (XLSX)",
        downloadPath: "/api/finance/:projectId/pr-tracker/download.xlsx",
        isoSubfolder: "../05_PROCUREMENT_AND_CONTRACTS/05.01_Procurement_Strategy_and_Packages",
      },
      {
        label: "Invoice processing tracker (XLSX)",
        downloadPath: "/api/finance/:projectId/invoice-trackers/download.xlsx",
        isoSubfolder: "09.01_Interim_Bill_Verification_Certification",
      },
    ],
  },
  comms: {
    root: "03_SUPPORT_AND_RESOURCES/03.08_Meetings_Minutes_Action_Tracking",
    title: "Comms & meeting files",
    eyebrow: "Comms · ISO 03.08",
    hubPath: "hub/comms",
    subtitle: "MoM exports, meeting packs, communication matrix attachments.",
  },
  auditKpi: {
    root: "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.18_Management_Review_and_Audit_Programme",
    title: "Audit & KPI files",
    eyebrow: "Audit · ISO 10.18",
    hubPath: "hub/auditKpi",
    subtitle: "Site audit pack, KPI dashboard workbooks, findings register exports.",
  },
  inspection: {
    root: "08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards",
    title: "Inspection files",
    eyebrow: "Inspection · ISO 08.02",
    hubPath: "hub/inspection",
    subtitle: "IR forms, activity inspection checklists, pour cards — SharePoint inspection folder.",
    rfiKinds: ["QualityIR", "SafetyIR", "ActivityInspection"],
  },
};

export function moduleFilesKeyFromRoute(segment: string): ModuleFilesKey | null {
  const map: Record<string, ModuleFilesKey> = {
    quality: "quality",
    safety: "safety",
    drawings: "drawings",
    progress: "progress",
    reports: "reports",
    cost: "cost",
    finance: "finance",
    comms: "comms",
    "audit-kpi": "auditKpi",
    inspection: "inspection",
  };
  return map[segment] || null;
}
