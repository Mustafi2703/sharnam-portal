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
  home: [
    { to: "", label: "Overview", end: true, blurb: "Project desk and module shortcuts." },
    { to: "directory", label: "Directory", blurb: "People assigned to this project." },
    {
      to: "vendors",
      label: "Vendors",
      roles: ["admin", "office", "site_employee", "employee", "vendor"],
      blurb: "Contractors and vendors on the job.",
    },
    { to: "dms", label: "Documents (DMS)", blurb: "Project folders and files." },
  ],
  drawings: [
    { to: "drawings", label: "GFC register", blurb: "Sheets, revisions R0–R5, publish." },
    {
      to: "checklist-master",
      label: "Drawing check master",
      query: "family=DrawingCheck",
      roles: ["admin", "office", "employee"],
      blurb: "Linked review form — fill while uploading.",
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
      blurb: "Ask matrix / vendor to fill a site checklist.",
    },
    {
      to: "rfis",
      label: "Ask (drawing RFI)",
      query: "kind=RequestForInformation",
      roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
      blurb: "Raise clarification on a drawing — information only.",
    },
  ],
  quality: [
    { to: "inspections", label: "Quality dashboard / QI", blurb: "Procore-style quality inspections." },
    {
      to: "checklist-master",
      label: "Checklist master",
      query: "family=QualityInspection",
      roles: ["admin", "office", "employee"],
      blurb: "QI templates and checklist library.",
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
      roles: ["admin", "office", "employee"],
      blurb: "Safety checklist forms.",
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
    { to: "cost", label: "COP / Bills", query: "tab=bills", blurb: "Bills and COP." },
    { to: "cost", label: "Structure upload", query: "tab=boq", blurb: "Import BOQ structure." },
  ],
  reports: [{ to: "reports", label: "DPR / WPR packs", blurb: "Daily and weekly report packs." }],
};

export const MODULE_META: Record<
  WorkspaceKey,
  { title: string; desc: string; path: string; accent: string; icon: string }
> = {
  drawings: {
    title: "Drawings",
    desc: "GFC register, Drawing Check Master on upload, coordination, request fill, and drawing Ask RFIs. Submittals excluded.",
    path: "hub/drawings",
    accent: "#2563EB",
    icon: "DWG",
  },
  quality: {
    title: "Quality",
    desc: "Procore-style QI, site checklists, and Request QI fill — checklist and RFI always visible.",
    path: "hub/quality",
    accent: "#1E3A8A",
    icon: "QA",
  },
  safety: {
    title: "Safety",
    desc: "Safety dashboard, checklists, and safety RFIs.",
    path: "hub/safety",
    accent: "#DC2626",
    icon: "HSE",
  },
  progress: {
    title: "Progress",
    desc: "Each dataset is its own tool — Overview, Milestones, Hindrance, Risk, and more.",
    path: "hub/progress",
    accent: "#0A0A0A",
    icon: "PRG",
  },
  field: {
    title: "Field",
    desc: "Day log, photos, and field RFIs.",
    path: "hub/field",
    accent: "#CA8A04",
    icon: "FLD",
  },
  comms: {
    title: "Comms",
    desc: "Matrix, meetings / MoM, Ask (PMC RFI), Email / Outlook.",
    path: "hub/comms",
    accent: "#2563EB",
    icon: "MTG",
  },
  cost: {
    title: "Cost",
    desc: "Monitoring, MB, BBS, budget, cashflow, bills — one tool at a time.",
    path: "hub/cost",
    accent: "#0A0A0A",
    icon: "₹",
  },
  reports: {
    title: "Reports",
    desc: "DPR and WPR packs from live registers.",
    path: "hub/reports",
    accent: "#CA8A04",
    icon: "RPT",
  },
};

export const WORKSPACES: {
  key: WorkspaceKey;
  title: string;
  desc: string;
  path: string;
  accent: string;
  icon: string;
  tools: string[];
  roles: string[];
}[] = (Object.keys(MODULE_META) as WorkspaceKey[]).map((key) => {
  const m = MODULE_META[key];
  let roles = ["admin", "office", "site_employee", "employee", "vendor", "client"];
  if (key === "cost") roles = ["admin", "office", "employee"];
  if (key === "progress" || key === "reports") roles = ["admin", "office", "site_employee", "employee", "client"];
  return {
    key,
    title: m.title,
    desc: m.desc,
    path: m.path,
    accent: m.accent,
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
  "reports",
];
