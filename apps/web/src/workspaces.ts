import type { RoleKey } from "@sharnam/shared";

/** Workspace → tool path filters (Procore modules) */
export const WORKSPACE_KEY = "sharnam_workspace_key";
export const WORKSPACE_PROJECT_KEY = "sharnam_workspace_project";

export type WorkspaceKey =
  | "drawings"
  | "quality"
  | "safety"
  | "progress"
  | "comms"
  | "field"
  | "cost"
  | "finance"
  | "reports";

export type ModuleToolItem = {
  to: string;
  label: string;
  end?: boolean;
  roles?: RoleKey[];
  query?: string;
  blurb?: string;
};

/** Sub-tools for hub cards + horizontal strip (no left rail) */
export const MODULE_TOOLS: Record<WorkspaceKey | "home", ModuleToolItem[]> = {
  drawings: [
    { to: "drawings", label: "GFC register", blurb: "Sheets, revisions R0–R5, publish." },
    {
      to: "checklist-master",
      label: "Checklist manager",
      query: "family=DrawingCheck",
      roles: ["admin", "office", "employee"],
    blurb: "Manage Drawing Check Master templates; upload opens checklist overlay then file dialog.",
    },
    {
      to: "checklist-logs",
      label: "Checklist fill log",
      query: "family=DrawingCheck",
      blurb: "Who filled what — branded download with Sharnam logo.",
    },
    { to: "dms", label: "Documents (DMS)", blurb: "Drawing folders." },
    {
      to: "coordination",
      label: "Coordination",
      roles: ["admin", "office", "site_employee", "employee"],
      blurb: "Design issues → escalate to Ask.",
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
    { to: "dms", label: "Documents (DMS)", blurb: "Project folders and files." },
  ],
  quality: [
    { to: "inspections", label: "Quality dashboard / QI", blurb: "Procore-style quality inspections." },
    {
      to: "checklist-master",
      label: "Checklist master",
      query: "family=QualityInspection",
      roles: ["admin", "office", "employee", "client"],
      blurb: "Create checklists, upload Excel, choose template for fills.",
    },
    {
      to: "checklist-logs",
      label: "QI fill log",
      query: "family=QualityInspection",
      blurb: "Quality checklist fills — branded download.",
    },
    {
      to: "qap",
      label: "Quality Assurance Plan",
      roles: ["admin", "office", "employee", "client", "site_employee"],
      blurb: "Upload and update the QAP (Week-50 sheet style).",
    },
    { to: "checklist", label: "Site checklists", blurb: "Assign and fill site execution forms." },
    {
      to: "rfis",
      label: "Request QI fill",
      query: "kind=QualityInspection",
      blurb: "Notify matrix / vendor to complete QI checklist.",
    },
  ],
  safety: [
    { to: "safety", label: "Safety dashboard", blurb: "Observations, incidents, open items." },
    {
      to: "checklist-master",
      label: "Safety checklists",
      query: "family=Safety",
      roles: ["admin", "office", "employee", "client"],
      blurb: "Create / upload Excel safety checklists and choose for fills.",
    },
    {
      to: "checklist-logs",
      label: "Safety fill log",
      query: "family=Safety",
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
    { to: "progress", label: "Overview", end: true, blurb: "Workday-style progress KPIs." },
    { to: "progress", label: "Milestones", query: "tab=milestones", blurb: "Milestone register." },
    { to: "progress", label: "Planned vs Actual", query: "tab=planned", blurb: "Plan vs actual progress." },
    { to: "progress", label: "Monthly progress", query: "tab=monthly", blurb: "Month-by-month view." },
    { to: "progress", label: "Hindrance", query: "tab=hindrance", blurb: "Hindrance register." },
    { to: "progress", label: "Risk", query: "tab=risk", blurb: "Risk register." },
    { to: "progress", label: "Legal approvals", query: "tab=legal", blurb: "Legal / approval tracker." },
  ],
  field: [
    { to: "diary", label: "Day log", blurb: "Manpower and site notes." },
    { to: "photos", label: "Photos", blurb: "Site photo albums." },
    { to: "rfis", label: "Field RFIs", blurb: "Field questions and fills." },
  ],
  comms: [
    { to: "comms", label: "Matrix · Meetings · MoM", blurb: "Matrix → agenda → MoM → follow-up." },
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
    { to: "cost", label: "Monitoring", end: true, blurb: "BOQ / monitoring desk." },
    { to: "cost", label: "MB sheets", query: "tab=mb", blurb: "Measurement books." },
    { to: "cost", label: "BBS", query: "tab=bbs", blurb: "Bar bending schedule." },
    { to: "cost", label: "Budget WBS", query: "tab=budget", blurb: "Budget structure." },
    { to: "cost", label: "Cashflow", query: "tab=cashflow", blurb: "Cashflow chart." },
    { to: "cost", label: "Rate difference", query: "tab=rates", blurb: "Rate variance." },
    { to: "cost", label: "Structure upload", query: "tab=boq", blurb: "Import BOQ structure." },
  ],
  finance: [
    { to: "finance", label: "Overview", end: true, blurb: "Open invoices, POs, RA bills, COPs." },
    { to: "finance", label: "Invoice tracking", query: "tab=invoices", blurb: "Invoice register." },
    { to: "finance", label: "PO tracking", query: "tab=po", blurb: "Purchase order register." },
    { to: "finance", label: "RA bill tracking", query: "tab=ra", blurb: "Running account bills." },
    { to: "finance", label: "COP tracking", query: "tab=cop", blurb: "Certificate of payment." },
  ],
  reports: [{ to: "reports", label: "DPR / WPR packs", blurb: "Daily and weekly report packs." }],
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
  quality: {
    title: "Quality",
    desc: "QI dashboard, Excel checklist upload, QAP, and Request QI fill.",
    path: "hub/quality",
    accent: "#0D9488",
    soft: "#CCFBF1",
    glow: "rgba(13,148,136,0.35)",
    ink: "#115E59",
    icon: "QA",
  },
  safety: {
    title: "Safety",
    desc: "Safety dashboard, Excel checklists, and safety RFIs.",
    path: "hub/safety",
    accent: "#DC2626",
    soft: "#FEE2E2",
    glow: "rgba(220,38,38,0.32)",
    ink: "#7F1D1D",
    icon: "HSE",
  },
  progress: {
    title: "Progress",
    desc: "Overview, Milestones, Hindrance, Risk, and more.",
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
    desc: "Matrix, meetings / MoM, Ask (PMC RFI), Email / Outlook.",
    path: "hub/comms",
    accent: "#0891B2",
    soft: "#CFFAFE",
    glow: "rgba(8,145,178,0.32)",
    ink: "#155E75",
    icon: "MTG",
  },
  cost: {
    title: "Cost",
    desc: "MB, BBS, budget, cashflow — engineering cost. Commercial tracking is Finance.",
    path: "hub/cost",
    accent: "#0B6A78",
    soft: "#CCFBF1",
    glow: "rgba(11,106,120,0.35)",
    ink: "#134E4A",
    icon: "₹",
  },
  finance: {
    title: "Finance",
    desc: "Invoice, PO, RA bill, and COP tracking — separate from Cost.",
    path: "hub/finance",
    accent: "#0369A1",
    soft: "#E0F2FE",
    glow: "rgba(3,105,161,0.32)",
    ink: "#0C4A6E",
    icon: "FIN",
  },
  reports: {
    title: "Reports",
    desc: "DPR and WPR packs from live registers.",
    path: "hub/reports",
    accent: "#EA580C",
    soft: "#FFEDD5",
    glow: "rgba(234,88,12,0.32)",
    ink: "#9A3412",
    icon: "RPT",
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
  if (key === "cost" || key === "finance") roles = ["admin", "office", "employee"];
  if (key === "progress" || key === "reports") roles = ["admin", "office", "site_employee", "employee", "client"];
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
export function resolveStoredProjectId(list: { id: string }[]): string {
  try {
    const stored = localStorage.getItem(WORKSPACE_PROJECT_KEY);
    if (stored && list.some((p) => p.id === stored)) return stored;
    if (list[0]) {
      localStorage.setItem(WORKSPACE_PROJECT_KEY, list[0].id);
      return list[0].id;
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
  "quality",
  "safety",
  "progress",
  "comms",
  "field",
  "cost",
  "finance",
  "reports",
];
