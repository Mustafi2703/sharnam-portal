import type { RoleKey } from "@sharnam/shared";

/** Workspace → tool path filters (Procore modules) */
export const WORKSPACE_KEY = "sharnam_workspace_key";
export const WORKSPACE_PROJECT_KEY = "sharnam_workspace_project";

export type WorkspaceKey =
  | "drawings"
  | "dms"
  | "quality"
  | "safety"
  | "progress"
  | "comms"
  | "field"
  | "cost"
  | "finance"
  | "reports"
  | "closure";

export type ModuleToolItem = {
  to: string;
  label: string;
  end?: boolean;
  roles?: RoleKey[];
  query?: string;
  blurb?: string;
  /** Source Excel sheet name when this tool maps 1:1 from sheet mode */
  sheet?: string;
  /** live = seeded UI; ready = hub reserved, awaits client sheet drop */
  status?: "live" | "ready";
};

/** Sub-tools for hub cards + horizontal strip (no left rail) — one card per sheet/tool */
export const MODULE_TOOLS: Record<WorkspaceKey | "home", ModuleToolItem[]> = {
  drawings: [
    { to: "drawings", label: "GFC register", blurb: "Sheets, revisions R0–R5, publish.", sheet: "Drawing & GFC Drawing Log" },
    {
      to: "drawings/register",
      label: "Master drawing register",
      blurb: "DCI master register from DRAWING REGISTER - 01.xlsx.",
      sheet: "Master Drawing Register",
    },
    {
      to: "drawings/register",
      label: "Register dashboard",
      query: "sheet=",
      blurb: "Drawing register week KPIs.",
      sheet: "DRAWING REGISTER - 01.xlsx · Dashboard",
    },
    {
      to: "drawings/register",
      label: "Client register",
      query: "sheet=client",
      blurb: "Client-facing drawing register view.",
      sheet: "Drawing Register - Client",
    },
    {
      to: "drawings/library",
      label: "Drawing files",
      blurb: "PDF/DWG in SharePoint design folders — not the general document manager.",
      sheet: "Drawing & GFC Drawing Log",
    },
    {
      to: "checklist-master",
      label: "Checklist manager",
      query: "family=DrawingCheck",
      roles: ["admin", "office", "employee"],
      blurb: "Manage Drawing Check Master templates; upload opens checklist overlay then file dialog.",
      sheet: "Drawing check master",
    },
    {
      to: "checklist-logs",
      label: "Checklist fill log",
      query: "family=DrawingCheck",
      blurb: "Who filled what — branded download with Sharnam logo.",
    },
    {
      to: "drawings/coordination",
      label: "Design coordination",
      blurb: "Clash / design issues — discipline, linked drawing, ball-in-court. Escalate open items to Ask RFI.",
      sheet: "Design coordination register",
    },
    {
      to: "rfis",
      label: "Request checklist fill",
      query: "kind=DrawingChecklist",
      roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
      blurb: "Ask matrix / contractor to fill a site checklist.",
    },
    {
      to: "rfis",
      label: "Ask (drawing RFI)",
      query: "kind=RequestForInformation",
      roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
      blurb: "Raise clarification on a drawing — information only.",
    },
  ],
  dms: [
    {
      to: "dms",
      label: "Document manager",
      blurb: "Browse ISO Rev 02 folder tree — contracts, HSE, daily records, MIS. Upload and preview PDFs.",
    },
  ],
  home: [
    { to: "", label: "Overview", end: true, blurb: "Project desk and module shortcuts." },
    { to: "directory", label: "Directory · Office", query: "party=PMC", blurb: "Sharnam Office / PMC people." },
    { to: "directory", label: "Directory · Site", query: "party=Site", blurb: "Site staff on this project." },
    { to: "directory", label: "Directory · Client", query: "party=Client", blurb: "Client contacts." },
    { to: "directory", label: "Directory · Contractor", query: "party=Contractor", blurb: "Contractors on the job." },
    {
      to: "vendors",
      label: "Vendors",
      roles: ["admin", "office", "site_employee", "employee", "vendor"],
      blurb: "Vendor assignments.",
    },
  ],
  quality: [
    {
      to: "inspections",
      label: "Dashboard",
      blurb: "Quality Dashboard KPIs — week, concreting, QI fills.",
      sheet: "Quality Dashboard.xlsx · Dashboard",
    },
    {
      to: "inspections",
      label: "SOR Log",
      query: "sheet=sor-log",
      blurb: "Site observation register summary.",
      sheet: "SOR Log",
    },
    {
      to: "inspections",
      label: "Checklist summary",
      query: "sheet=checklist-summary",
      blurb: "Checklists filled by discipline + catalog.",
      sheet: "Sheet1 / Sheet2",
    },
    {
      to: "inspections",
      label: "CAR / NCR register",
      query: "sheet=car-register",
      blurb: "Non-conformance / corrective action register.",
      sheet: "CAR register · NCR 01",
    },
    {
      to: "inspections",
      label: "Cube Test",
      query: "sheet=cube-test",
      blurb: "Cube cast / test results.",
      sheet: "Cube Test · SPDC Cube Register",
    },
    {
      to: "inspections",
      label: "QAP Detail",
      query: "sheet=qap-detail",
      blurb: "Quality Assurance Plan detail sheet.",
      sheet: "Quality Assurance Plan - Detail",
    },
    {
      to: "inspections",
      label: "QI & checklist fills",
      query: "sheet=qi",
      blurb: "Raise QI, fill checklists → DPR Quality section.",
    },
    {
      to: "quality/checklist-master",
      label: "Quality checklist master",
      roles: ["admin", "office", "employee", "client"],
      blurb: "Create QI checklists, upload Excel — separate from Safety.",
    },
    {
      to: "quality/checklist-logs",
      label: "QI fill log",
      blurb: "Quality checklist fills — branded download.",
    },
    {
      to: "qap",
      label: "Quality Assurance Plan",
      roles: ["admin", "office", "employee", "client", "site_employee"],
      blurb: "Upload and update the QAP (Week-50 sheet style).",
      sheet: "Quality Assurance Plan Week 50",
    },
    { to: "checklist", label: "Site checklists", blurb: "Assign and fill site execution forms.", sheet: "Final Index" },
    {
      to: "rfis",
      label: "Request QI fill",
      query: "kind=QualityInspection",
      blurb: "Notify matrix / vendor to complete QI checklist.",
    },
  ],
  safety: [
    { to: "safety", label: "Dashboard", blurb: "Safety Dashboard KPIs.", sheet: "Safety Dashboard.xlsx · One Pager" },
    {
      to: "safety",
      label: "Site Instruction",
      query: "sheet=site-instruction",
      blurb: "Site instruction register.",
      sheet: "Site Instruction",
    },
    {
      to: "safety",
      label: "Unsafe Act Summary",
      query: "sheet=unsafe-act-summary",
      blurb: "Unsafe act summary register.",
      sheet: "Unsafe Act Summary",
    },
    {
      to: "safety",
      label: "NCR Summary",
      query: "sheet=ncr-summary",
      blurb: "NCR summary register.",
      sheet: "NCR Summary",
    },
    {
      to: "safety",
      label: "NCR Form",
      query: "sheet=ncr-form",
      blurb: "Full NCR form (Safety NCR.xlsx).",
      sheet: "Safety NCR.xlsx",
    },
    {
      to: "safety",
      label: "Observation — Unsafe Act",
      query: "sheet=observation",
      blurb: "Unsafe act observation sheet.",
      sheet: "Observation - Unsafe Act",
    },
    {
      to: "safety",
      label: "HIRA",
      query: "sheet=hira",
      blurb: "Hazard identification & risk assessment.",
      sheet: "HIRA",
    },
    {
      to: "safety",
      label: "Safety Hours",
      query: "sheet=safety-hours",
      blurb: "Safe man-hours & HSE indicators.",
      sheet: "Safety Hours",
    },
    {
      to: "safety/checklist-master",
      label: "Safety checklist master",
      roles: ["admin", "office", "employee", "client"],
      blurb: "Create / upload Safety checklists only — not Quality QI.",
    },
    {
      to: "safety/checklist-logs",
      label: "Safety fill log",
      blurb: "Safety checklist fills — branded download.",
    },
    {
      to: "rfis",
      label: "Safety checklist RFI",
      query: "kind=SafetyChecklist",
      blurb: "Request safety checklist fill.",
    },
  ],
  progress: [
    {
      to: "progress",
      label: "Overview",
      end: true,
      blurb: "Workday-style progress KPIs and charts.",
      sheet: "Progress Overview.xlsx",
    },
    {
      to: "progress",
      label: "Milestones",
      query: "tab=milestones",
      blurb: "Milestone register.",
      sheet: "Milestone tracking.xlsx",
    },
    {
      to: "progress",
      label: "Planned vs Actual",
      query: "tab=planned",
      blurb: "Cashflow, manpower, qty register.",
      sheet: "Planned Vs. Actual Dashboard",
    },
    {
      to: "progress",
      label: "Monthly progress",
      query: "tab=monthly",
      blurb: "SOR / monthly package progress.",
      sheet: "Monthly Progress Dashboard",
    },
    {
      to: "progress",
      label: "Hindrance",
      query: "tab=hindrance",
      blurb: "Hindrance register.",
      sheet: "Hindrance Register Dashboard",
    },
    { to: "progress", label: "Risk", query: "tab=risk", blurb: "Risk register.", sheet: "Progress Overview · Risk" },
    {
      to: "progress",
      label: "Legal approvals",
      query: "tab=legal",
      blurb: "Legal / approval tracker.",
      sheet: "Progress Overview · Legal Approval",
    },
    {
      to: "progress",
      label: "S-curve",
      query: "tab=scurve",
      blurb: "Client civil S-curve — ready when MS Project / sheet lands.",
      sheet: "MS Project / S-curve pack",
      status: "ready",
    },
    {
      to: "progress",
      label: "Summary schedule",
      query: "tab=schedule",
      blurb: "Summary schedule + PDF viewer — awaiting client sheet.",
      sheet: "Project summary schedule",
      status: "ready",
    },
    {
      to: "progress",
      label: "MS Project progress",
      query: "tab=msproject",
      blurb: "MS Project % / baseline — reserved hub tool.",
      sheet: "MS Project export",
      status: "ready",
    },
    {
      to: "progress",
      label: "Procurement plan",
      query: "tab=procurement",
      blurb: "Procurement plan + PDF — reserved hub tool.",
      sheet: "Procurement plan",
      status: "ready",
    },
  ],
  field: [
    { to: "site-pilot", label: "Site check-in", blurb: "Photo · GPS · PDF markup · signature → SharePoint.", sheet: "SitePilot" },
    { to: "/upload-lab", label: "Photo & PDF test", blurb: "Mobile camera + PDF markup sandbox → SharePoint UploadLab." },
    { to: "/attendance", label: "Attendance punch", blurb: "Selfie + GPS check-in/out (also in sidebar).", sheet: "Attendance" },
    { to: "diary", label: "Day log", blurb: "Manpower and site notes." },
    { to: "photos", label: "Photos", blurb: "Site photo albums." },
    { to: "rfis", label: "Field RFIs", blurb: "Field questions and fills." },
  ],
  comms: [
    {
      to: "comms",
      label: "Communication matrix",
      query: "tab=matrix",
      blurb: "Who talks to whom (roles / channels).",
      sheet: "Communication Matrix_BPCL",
    },
    { to: "comms", label: "Agenda", query: "tab=agenda", blurb: "Create meeting → generate agenda before MoM." },
    { to: "comms", label: "MoM", query: "tab=mom", blurb: "Minutes + action items." },
    { to: "comms", label: "Follow-up", query: "tab=followup", blurb: "Open actions from MoM." },
    {
      to: "rfis",
      label: "Ask (PMC RFI)",
      query: "kind=RequestForInformation",
      blurb: "Classic request for information.",
    },
    {
      to: "email",
      label: "Email / Outlook",
      roles: ["admin", "office", "employee", "site_employee"],
      blurb: "Connect mailbox and outbox.",
    },
  ],
  cost: [
    {
      to: "cost",
      label: "BOQ / Monitoring",
      end: true,
      blurb: "Monitoring packages — GFC qty, excess / saving.",
      sheet: "Cashflow Dashboard · Monitoring",
    },
    { to: "cost", label: "MB sheets", query: "tab=mb", blurb: "Measurement books by package.", sheet: "SPDC Budget · MB" },
    { to: "cost", label: "BBS", query: "tab=bbs", blurb: "Upload BBS Excel + shape diagrams with markup → SharePoint.", sheet: "SPDC Budget · BBS" },
    {
      to: "cost",
      label: "Budget WBS",
      query: "tab=budget",
      blurb: "Budget structure.",
      sheet: "SPDC_Budget · Budget",
    },
    {
      to: "cost",
      label: "Cash Flow Chart",
      query: "tab=cashflow&cf=chart",
      blurb: "Planned vs actual chart (INR).",
      sheet: "Cashflow - Dashboard · Chart",
    },
    {
      to: "cost",
      label: "Cash Flow Forecast",
      query: "tab=cashflow&cf=forecast",
      blurb: "Forecast periods.",
      sheet: "Cashflow - Dashboard · Forecast",
    },
    {
      to: "cost",
      label: "Cashflow Tracking",
      query: "tab=cashflow&cf=tracking",
      blurb: "Tracking sheet rows.",
      sheet: "Cashflow - Dashboard · Tracking",
    },
    {
      to: "cost",
      label: "Rate difference",
      query: "tab=rates",
      blurb: "Steel / Cement / Tiles variance.",
      sheet: "Rate difference sheets",
    },
    {
      to: "cost",
      label: "COP / Bills",
      query: "tab=bills",
      blurb: "Payment summary / vendor bills.",
      sheet: "Payment Summary",
    },
    {
      to: "cost",
      label: "Structure upload",
      query: "tab=boq",
      blurb: "Import BOQ structure into monitoring.",
    },
  ],
  finance: [
    { to: "finance", label: "Overview", end: true, blurb: "Open invoices, POs, RA bills, COPs." },
    {
      to: "finance",
      label: "Invoice tracking",
      query: "tab=invoices",
      blurb: "Invoice register.",
      sheet: "Payment Summary",
    },
    { to: "finance", label: "PO tracking", query: "tab=po", blurb: "Purchase order register." },
    { to: "finance", label: "RA bill tracking", query: "tab=ra", blurb: "Running account bills." },
    { to: "finance", label: "COP tracking", query: "tab=cop", blurb: "Certificate of payment." },
  ],
  reports: [
    { to: "dpr-maker", label: "DPR maker", blurb: "Fill SPDC INPUT → publish template XLSX per discipline.", sheet: "SPDC_DPR_*_DASHBOARD" },
    { to: "wpr-maker", label: "WPR maker", blurb: "24-section weekly pack · photos · sign-off.", sheet: "WPR File" },
    { to: "reports", label: "DPR dashboard", query: "kind=dpr", blurb: "Live KPIs + downloadable client pack.", sheet: "DPR-Sharnam PMC" },
    { to: "reports", label: "WPR dashboard", query: "kind=wpr", blurb: "Weekly register + downloadable pack.", sheet: "WPR File" },
  ],
  closure: [
    { to: "closure", label: "Overview", end: true, blurb: "Snag, lessons learnt, closure report KPIs." },
    {
      to: "closure",
      label: "Snaglist",
      query: "sheet=snaglist",
      blurb: "Snag register — open/close gate for handover.",
      sheet: "Snaglist - Sharnam PMC.xlsx",
    },
    {
      to: "closure",
      label: "Lessons learnt",
      query: "sheet=lessons",
      blurb: "Project lessons learnt register.",
      sheet: "Lessons Learnt - Sharnam PMC.xls",
    },
    {
      to: "closure",
      label: "Closure report",
      query: "sheet=closure-report",
      blurb: "Editable sections + upload Project Closure Report.docx.",
      sheet: "Project Closure Report.docx",
    },
  ],
};

export const MODULE_META: Record<
  WorkspaceKey,
  {
    title: string;
    desc: string;
    path: string;
    accent: string;
    soft: string;
    glow: string;
    ink: string;
    icon: string;
  }
> = {
  drawings: {
    title: "Drawings",
    desc: "GFC register, Drawing Check Master on upload, coordination, request fill, and drawing Ask RFIs.",
    path: "hub/drawings",
    accent: "#2563EB",
    soft: "#DBEAFE",
    glow: "rgba(37,99,235,0.35)",
    ink: "#1E3A8A",
    icon: "DWG",
  },
  dms: {
    title: "Documents",
    desc: "ISO folder tree — contracts, HSE, daily records, MIS. Browse, upload, and preview. Separate from Drawings GFC workflow.",
    path: "hub/dms",
    accent: "#3D4450",
    soft: "#E8EAED",
    glow: "rgba(61,68,80,0.32)",
    ink: "#1F2937",
    icon: "DOC",
  },
  quality: {
    title: "Quality",
    desc: "QI dashboard, NCR / CAR, Cube register, QAP, Excel checklists, and Request QI fill — each sheet is its own tool.",
    path: "hub/quality",
    accent: "#0D9488",
    soft: "#CCFBF1",
    glow: "rgba(13,148,136,0.35)",
    ink: "#115E59",
    icon: "QA",
  },
  safety: {
    title: "Safety",
    desc: "Safety dashboard, Safety NCR, Excel checklists, and safety RFIs — separate tools per sheet.",
    path: "hub/safety",
    accent: "#DC2626",
    soft: "#FEE2E2",
    glow: "rgba(220,38,38,0.32)",
    ink: "#7F1D1D",
    icon: "HSE",
  },
  progress: {
    title: "Progress",
    desc: "Live Progress sheets plus Ready stubs for S-curve, schedule, MS Project, and procurement.",
    path: "hub/progress",
    accent: "#7C3AED",
    soft: "#EDE9FE",
    glow: "rgba(124,58,237,0.32)",
    ink: "#4C1D95",
    icon: "PRG",
  },
  field: {
    title: "Field",
    desc: "Day log, photos, and field RFIs.",
    path: "hub/field",
    accent: "#D97706",
    soft: "#FEF3C7",
    glow: "rgba(217,119,6,0.32)",
    ink: "#92400E",
    icon: "FLD",
  },
  comms: {
    title: "Comms",
    desc: "Matrix, Agenda, MoM, Follow-up, Ask (PMC RFI), Email — separate tools.",
    path: "hub/comms",
    accent: "#0891B2",
    soft: "#CFFAFE",
    glow: "rgba(8,145,178,0.32)",
    ink: "#155E75",
    icon: "MTG",
  },
  cost: {
    title: "Cost",
    desc: "Monitoring, MB, BBS, Budget, Cashflow Chart / Forecast / Tracking, Rates, COP — sheet-mode tools. Commercial registers live in Finance.",
    path: "hub/cost",
    accent: "#0B6A78",
    soft: "#CCFBF1",
    glow: "rgba(11,106,120,0.35)",
    ink: "#134E4A",
    icon: "₹",
  },
  finance: {
    title: "Finance",
    desc: "Invoice, PO, RA bill, and COP tracking — separate from engineering Cost sheets.",
    path: "hub/finance",
    accent: "#0369A1",
    soft: "#E0F2FE",
    glow: "rgba(3,105,161,0.32)",
    ink: "#0C4A6E",
    icon: "FIN",
  },
  reports: {
    title: "Reports",
    desc: "DPR and WPR packs as separate tools from live registers.",
    path: "hub/reports",
    accent: "#EA580C",
    soft: "#FFEDD5",
    glow: "rgba(234,88,12,0.32)",
    ink: "#9A3412",
    icon: "RPT",
  },
  closure: {
    title: "Project closure",
    desc: "Snaglist, lessons learnt, and project closure report — handover and client sign-off pack.",
    path: "hub/closure",
    accent: "#4F46E5",
    soft: "#E0E7FF",
    glow: "rgba(79,70,229,0.32)",
    ink: "#312E81",
    icon: "CLS",
  },
};

export const WORKSPACES: {
  key: WorkspaceKey;
  title: string;
  desc: string;
  path: string;
  accent: string;
  soft: string;
  icon: string;
  tools: string[];
  roles: string[];
}[] = (Object.keys(MODULE_META) as WorkspaceKey[]).map((key) => {
  const m = MODULE_META[key];
  let roles = ["admin", "office", "site_employee", "employee", "vendor", "client"];
  if (key === "dms") roles = ["admin", "office", "site_employee", "employee", "vendor", "client"];
  if (key === "cost" || key === "finance") roles = ["admin", "office", "employee"];
  if (key === "progress" || key === "reports") roles = ["admin", "office", "site_employee", "employee", "client"];
  if (key === "closure") roles = ["admin", "office", "site_employee", "employee", "client"];
  return {
    key,
    title: m.title,
    desc: m.desc,
    path: m.path,
    accent: m.accent,
    soft: m.soft,
    icon: m.icon,
    tools: [...new Set(MODULE_TOOLS[key].map((t) => t.to).filter(Boolean)), "hub"],
    roles,
  };
});

export function getActiveWorkspace(): WorkspaceKey | null {
  try {
    const k = localStorage.getItem(WORKSPACE_KEY);
    if (WORKSPACES.some((w) => w.key === k)) return k as WorkspaceKey;
  } catch {
    /* ignore */
  }
  return null;
}

export function setActiveWorkspace(key: WorkspaceKey | null) {
  try {
    if (!key) localStorage.removeItem(WORKSPACE_KEY);
    else localStorage.setItem(WORKSPACE_KEY, key);
  } catch {
    /* ignore */
  }
}

/** Keep stored project id in sync with what the API still returns. */
export function resolveStoredProjectId(list: { id: string; code?: string }[]): string {
  try {
    const stored = localStorage.getItem(WORKSPACE_PROJECT_KEY);
    if (stored && list.some((p) => p.id === stored)) return stored;
    const preferred = list.find((p) => p.code === "SPDC-DEMO-01") || list.find((p) => p.code === "SPDC-PILOT-02") || list[0];
    if (preferred) {
      localStorage.setItem(WORKSPACE_PROJECT_KEY, preferred.id);
      return preferred.id;
    }
    localStorage.removeItem(WORKSPACE_PROJECT_KEY);
  } catch {
    /* ignore */
  }
  return list[0]?.id || "";
}

export function clearStoredProjectId() {
  try {
    localStorage.removeItem(WORKSPACE_PROJECT_KEY);
  } catch {
    /* ignore */
  }
}

export function toolsForWorkspace(key: WorkspaceKey | null): string[] | null {
  if (!key) return null;
  return WORKSPACES.find((w) => w.key === key)?.tools ?? null;
}

export const DEFAULT_ENABLED_MODULES: WorkspaceKey[] = [
  "drawings",
  "dms",
  "quality",
  "safety",
  "progress",
  "comms",
  "field",
  "cost",
  "finance",
  "reports",
  "closure",
];
