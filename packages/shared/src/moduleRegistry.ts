import type { ModuleKey, RoleKey } from "./index.js";

/** Folder id under `apps/api/src/modules/` and `apps/web/src/modules/`. */
export type PortalModuleId =
  | "finance"
  | "cost"
  | "dpr"
  | "wpr"
  | "reports"
  | "drawings"
  | "quality"
  | "safety"
  | "progress"
  | "checklist"
  | "comms"
  | "audit-kpi"
  | "crm"
  | "closure"
  | "hrms"
  | "custom-sheets"
  | "dms";

export type ModuleFileRef = {
  path: string;
  status: "live" | "planned";
  note?: string;
};

export type ModuleDefinition = {
  id: PortalModuleId;
  label: string;
  /** Hub workspace key in `apps/web/src/workspaces.ts` (null = office-only). */
  workspace: string | null;
  /** Permission matrix key in `DEFAULT_ROLE_PERMISSIONS`. */
  permissionModule: ModuleKey;
  docs: string;
  api: {
    routes: string[];
    moduleDir: string;
    files: ModuleFileRef[];
  };
  web: {
    moduleDir: string;
    pages: string[];
    components: string[];
  };
};

/** Canonical map — backend files, frontend files, routes, roles (via permissionModule). */
export const MODULE_REGISTRY: Record<PortalModuleId, ModuleDefinition> = {
  finance: {
    id: "finance",
    label: "Finance (commercial COP)",
    workspace: "finance",
    permissionModule: "cost_tracking",
    docs: "docs/modules/MODULE_FINANCE.md",
    api: {
      routes: ["routes/finance.ts"],
      moduleDir: "modules/finance",
      files: [
        { path: "disciplines.ts", status: "live" },
        { path: "paymentSummaryWorkbook.ts", status: "live" },
        { path: "copWorkbook.ts", status: "live" },
        { path: "costBridge.ts", status: "live" },
        { path: "cashflowSync.ts", status: "live" },
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "manifest.ts", status: "live" },
      ],
    },
    web: {
      moduleDir: "modules/finance",
      pages: ["pages/FinancePage.tsx"],
      components: ["components/FinanceBillRegister.tsx", "components/FinanceDisciplineStrip.tsx"],
    },
  },
  cost: {
    id: "cost",
    label: "Cost (engineering BOQ / MB / BBS)",
    workspace: "cost",
    permissionModule: "cost_tracking",
    docs: "docs/modules/MODULE_COST.md",
    api: {
      routes: ["routes/cost.ts", "routes/customSheets.ts"],
      moduleDir: "modules/cost",
      files: [
        { path: "index.ts", status: "live", note: "barrel → services/* until migrated" },
        { path: "roles.ts", status: "live" },
        { path: "manifest.ts", status: "live" },
        { path: "boqParser.ts", status: "planned", note: "services/boqParser.ts" },
        { path: "costSheetParser.ts", status: "planned", note: "services/costSheetParser.ts" },
        { path: "budgetWorkbookImport.ts", status: "planned", note: "services/budgetWorkbookImport.ts" },
        { path: "cashflowParser.ts", status: "planned", note: "services/cashflowParser.ts" },
        { path: "monitoringMetrics.ts", status: "planned", note: "services/monitoringMetrics.ts" },
      ],
    },
    web: {
      moduleDir: "modules/cost",
      pages: ["pages/CostPage.tsx → src/pages/CostPage.tsx"],
      components: [
        "BoqMonitoringEditor.tsx",
        "BudgetWbsRegister.tsx",
        "MbEntryTable.tsx",
        "BbsEntryTable.tsx",
        "CostStructureSetupPanel.tsx",
        "CostSheetUploadPanel.tsx",
      ],
    },
  },
  dpr: {
    id: "dpr",
    label: "DPR Maker",
    workspace: "reports",
    permissionModule: "reports",
    docs: "docs/modules/MODULE_REPORTS.md",
    api: {
      routes: ["routes/dprMaker.ts"],
      moduleDir: "modules/dpr",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "dprXlsx.ts", status: "planned", note: "services/dprXlsx.ts" },
        { path: "dprIntegrations.ts", status: "planned" },
        { path: "dprCharts.ts", status: "planned" },
        { path: "dprSnapshotExport.ts", status: "planned" },
      ],
    },
    web: {
      moduleDir: "modules/reports",
      pages: ["pages/DprMakerPage.tsx → src/pages/DprMakerPage.tsx"],
      components: [],
    },
  },
  wpr: {
    id: "wpr",
    label: "WPR Maker",
    workspace: "reports",
    permissionModule: "reports",
    docs: "docs/modules/MODULE_REPORTS.md",
    api: {
      routes: ["routes/wprMaker.ts"],
      moduleDir: "modules/wpr",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "wprXlsx.ts", status: "planned", note: "services/wprXlsx.ts" },
        { path: "wprPptx.ts", status: "planned" },
        { path: "wprClientPack.ts", status: "planned" },
      ],
    },
    web: {
      moduleDir: "modules/reports",
      pages: ["pages/WprMakerPage.tsx → src/pages/WprMakerPage.tsx"],
      components: ["WprDashboardCharts.tsx"],
    },
  },
  reports: {
    id: "reports",
    label: "Reports hub",
    workspace: "reports",
    permissionModule: "reports",
    docs: "docs/modules/MODULE_REPORTS.md",
    api: {
      routes: ["routes/reports.ts"],
      moduleDir: "modules/reports",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "reportPacks.ts", status: "planned", note: "services/reportPacks.ts" },
        { path: "quotationExport.ts", status: "planned" },
      ],
    },
    web: {
      moduleDir: "modules/reports",
      pages: ["pages/ReportsPage.tsx → src/pages/ReportsPage.tsx"],
      components: ["ReportExportButtons.tsx"],
    },
  },
  drawings: {
    id: "drawings",
    label: "Drawings / GFC / Master register",
    workspace: "drawings",
    permissionModule: "drawings",
    docs: "docs/modules/MODULE_DRAWINGS.md",
    api: {
      routes: ["routes/projects.ts", "routes/checklist.ts (drawing gates)"],
      moduleDir: "modules/drawings",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "drawingRegisterSheets.ts", status: "planned", note: "services/drawingRegisterSheets.ts" },
        { path: "drawingUnlock.ts", status: "planned" },
        { path: "rfiFlowNotify.ts", status: "planned" },
      ],
    },
    web: {
      moduleDir: "modules/drawings",
      pages: [
        "pages/project/DrawingsPage.tsx",
        "pages/project/DrawingRegisterPage.tsx",
        "pages/DrawingsLibraryPage.tsx",
        "pages/project/RevisionUploadPage.tsx",
      ],
      components: [
        "DrawingsModuleNav.tsx",
        "MasterDrawingRegisterTable.tsx",
        "SiteDrawingRegisterTable.tsx",
        "DrawingUploadFilePicker.tsx",
      ],
    },
  },
  quality: {
    id: "quality",
    label: "Quality (QAP · QI · NCR · Cube)",
    workspace: "quality",
    permissionModule: "inspections",
    docs: "docs/modules/MODULE_QUALITY.md",
    api: {
      routes: ["routes/checklist.ts", "routes/procore.ts (inspections)"],
      moduleDir: "modules/quality",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "qapWorkbook.ts", status: "planned", note: "services/qapImportExport.ts" },
        { path: "dashboardSheets.ts", status: "planned", note: "services/qualityDashboardSheets.ts" },
        { path: "cubeRegisterImport.ts", status: "planned" },
        { path: "ncrFormExport.ts", status: "planned" },
      ],
    },
    web: {
      moduleDir: "modules/quality",
      pages: [
        "pages/project/QapPage.tsx",
        "pages/project/InspectionsPage.tsx",
        "pages/project/NcrFormPage.tsx",
        "pages/project/InspectionRegisterPage.tsx",
      ],
      components: [
        "QapDetailRegister.tsx",
        "CubeRegisterPanel.tsx",
        "QualitySiteRegister.tsx",
        "QualityChecklistSummaryPanel.tsx",
        "SorLogPanel.tsx",
      ],
    },
  },
  safety: {
    id: "safety",
    label: "Safety (HIRA · NCR · observations)",
    workspace: "safety",
    permissionModule: "safety",
    docs: "docs/modules/MODULE_SAFETY.md",
    api: {
      routes: ["routes/procore.ts (safety)", "routes/checklist.ts (safety-dashboard)"],
      moduleDir: "modules/safety",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "dashboardSheets.ts", status: "planned", note: "services/safetyDashboardSheets.ts" },
        { path: "hiraRegister.ts", status: "planned", note: "services/hiraRegister.ts" },
      ],
    },
    web: {
      moduleDir: "modules/safety",
      pages: ["pages/project/SafetyPage.tsx"],
      components: ["HiraRegisterTable.tsx"],
    },
  },
  progress: {
    id: "progress",
    label: "Progress (milestones · hindrance · legal)",
    workspace: "progress",
    permissionModule: "reports",
    docs: "docs/modules/MODULE_PROGRESS.md",
    api: {
      routes: ["routes/progress.ts"],
      moduleDir: "modules/progress",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "progressVerify.ts", status: "planned", note: "services/progressVerify.ts" },
        { path: "plannedActualDashboard.ts", status: "planned" },
        { path: "msProjectSchedule.ts", status: "planned" },
      ],
    },
    web: {
      moduleDir: "modules/progress",
      pages: ["pages/project/ProgressPage.tsx"],
      components: [],
    },
  },
  checklist: {
    id: "checklist",
    label: "Checklists (drawing gate · branded fill)",
    workspace: null,
    permissionModule: "checklist",
    docs: "docs/modules/MODULE_DRAWINGS.md",
    api: {
      routes: ["routes/checklist.ts"],
      moduleDir: "modules/checklist",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "brandedChecklistHtml.ts", status: "planned", note: "services/brandedChecklistHtml.ts" },
        { path: "brandedChecklistXlsx.ts", status: "planned" },
        { path: "checklistProgress.ts", status: "planned" },
      ],
    },
    web: {
      moduleDir: "modules/checklist",
      pages: ["pages/ChecklistPage.tsx", "pages/ChecklistFillPage.tsx", "pages/project/ChecklistMasterPage.tsx"],
      components: ["DrawingCheckModal.tsx (planned colocate)"],
    },
  },
  comms: {
    id: "comms",
    label: "Comms · Diary · RFIs",
    workspace: "comms",
    permissionModule: "communications",
    docs: "docs/modules/MODULE_COMMUNICATIONS.md",
    api: {
      routes: ["routes/comms.ts", "routes/diary.ts", "routes/procore.ts (rfis)"],
      moduleDir: "modules/comms",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "meetingNotify.ts", status: "planned", note: "services/meetingNotify.ts" },
        { path: "coordinationEscalation.ts", status: "planned" },
      ],
    },
    web: {
      moduleDir: "modules/comms",
      pages: ["pages/CommsPage.tsx", "pages/DiaryPage.tsx", "pages/project/RfisPage.tsx"],
      components: ["DrawingRfiRegisterTable.tsx", "RfiProgressBar.tsx"],
    },
  },
  "audit-kpi": {
    id: "audit-kpi",
    label: "Site Audit + KPI/KRA",
    workspace: "auditKpi",
    permissionModule: "audit",
    docs: "docs/modules/MODULE_AUDIT_KPI.md",
    api: {
      routes: ["routes/auditKpi.ts"],
      moduleDir: "modules/audit-kpi",
      files: [
        { path: "seedFromSheets.ts", status: "live" },
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
      ],
    },
    web: {
      moduleDir: "modules/audit-kpi",
      pages: ["pages/project/AuditKpiPage.tsx", "pages/AuditPage.tsx"],
      components: [],
    },
  },
  crm: {
    id: "crm",
    label: "CRM / Bid compare",
    workspace: null,
    permissionModule: "crm",
    docs: "docs/modules/MODULE_CRM.md",
    api: {
      routes: ["routes/crmComparative.ts", "routes/reports.ts (crm)"],
      moduleDir: "modules/crm",
      files: [
        { path: "index.ts", status: "live" },
        { path: "roles.ts", status: "live" },
        { path: "comparativeStatement.ts", status: "planned", note: "services/comparativeStatement.ts" },
      ],
    },
    web: {
      moduleDir: "modules/crm",
      pages: ["pages/CrmPage.tsx", "pages/CrmBidComparePage.tsx", "pages/QuotationMakerPage.tsx"],
      components: ["ComparativeStatementPanel.tsx"],
    },
  },
  closure: {
    id: "closure",
    label: "Project closure",
    workspace: "closure",
    permissionModule: "projects",
    docs: "docs/modules/MODULE_CLIENT_PORTAL.md",
    api: {
      routes: ["routes/closure.ts"],
      moduleDir: "modules/closure",
      files: [{ path: "index.ts", status: "live" }, { path: "roles.ts", status: "live" }],
    },
    web: {
      moduleDir: "modules/closure",
      pages: ["pages/project/ProjectClosurePage.tsx"],
      components: [],
    },
  },
  hrms: {
    id: "hrms",
    label: "HRMS / Recruitment",
    workspace: null,
    permissionModule: "hrm",
    docs: "docs/modules/MODULE_HRMS.md",
    api: {
      routes: ["routes/hrmRecruitment.ts", "routes/reports.ts (hrm)"],
      moduleDir: "modules/hrms",
      files: [{ path: "index.ts", status: "live" }, { path: "roles.ts", status: "live" }],
    },
    web: {
      moduleDir: "modules/hrms",
      pages: ["pages/HrmPage.tsx", "pages/HrmsAttendancePage.tsx", "pages/HrmsLeavePage.tsx"],
      components: [],
    },
  },
  "custom-sheets": {
    id: "custom-sheets",
    label: "Sheet maker / custom registers",
    workspace: null,
    permissionModule: "cost_tracking",
    docs: "docs/modules/MODULE_SHEET_MAKER.md",
    api: {
      routes: ["routes/customSheets.ts"],
      moduleDir: "modules/custom-sheets",
      files: [{ path: "index.ts", status: "live" }, { path: "roles.ts", status: "live" }],
    },
    web: {
      moduleDir: "modules/custom-sheets",
      pages: ["pages/CustomSheetsPage.tsx"],
      components: [],
    },
  },
  dms: {
    id: "dms",
    label: "Document manager (SharePoint)",
    workspace: "dms",
    permissionModule: "dms",
    docs: "docs/modules/MODULE_FIELD.md",
    api: {
      routes: ["routes/graph.ts", "routes/projects.ts (dms)"],
      moduleDir: "modules/dms",
      files: [{ path: "index.ts", status: "live" }, { path: "roles.ts", status: "live" }],
    },
    web: {
      moduleDir: "modules/dms",
      pages: ["pages/DmsPage.tsx"],
      components: [],
    },
  },
};

export const PORTAL_MODULE_IDS = Object.keys(MODULE_REGISTRY) as PortalModuleId[];

export function getModuleDefinition(id: PortalModuleId): ModuleDefinition {
  return MODULE_REGISTRY[id];
}

/** Roles allowed for hub tool visibility (union of view permission + explicit tool roles). */
export function moduleViewRoles(id: PortalModuleId): RoleKey[] {
  const m = MODULE_REGISTRY[id];
  const base: RoleKey[] = ["admin"];
  if (m.permissionModule === "cost_tracking") {
    return [...base, "office", "employee"];
  }
  if (m.permissionModule === "inspections" || m.permissionModule === "safety") {
    return [...base, "office", "employee", "site_employee", "vendor", "client"];
  }
  if (m.permissionModule === "drawings") {
    return [...base, "office", "employee", "site_employee", "vendor", "client"];
  }
  if (m.permissionModule === "audit") {
    return [...base, "office", "employee"];
  }
  return [...base, "office", "employee", "site_employee"];
}
