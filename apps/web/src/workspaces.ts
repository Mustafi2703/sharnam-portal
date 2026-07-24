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

export const WORKSPACES: {
  key: WorkspaceKey;
  title: string;
  desc: string;
  path: string;
  accent: string;
  icon: string;
  tools: string[];
  roles: string[];
}[] = [
  {
    key: "drawings",
    title: "Drawings & Documents",
    desc: "GFC register, DMS, coordination, submittals, drawing checklist RFIs.",
    path: "drawings",
    accent: "#2563EB",
    icon: "DWG",
    tools: ["", "drawings", "dms", "coordination", "submittals", "rfis"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "quality",
    title: "Quality",
    desc: "Inspections, QAP, site checklists, cube / NCR, QI RFIs.",
    path: "inspections",
    accent: "#15803D",
    icon: "QA",
    tools: ["", "inspections", "checklist", "quality-inspections", "rfis"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "safety",
    title: "Safety",
    desc: "Safety dashboard, NCR, site instructions, safety RFIs.",
    path: "safety",
    accent: "#B91C1C",
    icon: "HSE",
    tools: ["", "safety", "rfis"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "progress",
    title: "Progress",
    desc: "Milestones, planned vs actual, monthly, hindrance, risk.",
    path: "progress",
    accent: "#0F172A",
    icon: "PRG",
    tools: ["", "progress"],
    roles: ["admin", "office", "site_employee", "employee", "client"],
  },
  {
    key: "comms",
    title: "Communications",
    desc: "Matrix → meeting → Agenda → MoM → follow-up. PMC RFIs and email.",
    path: "comms",
    accent: "#1E3A8A",
    icon: "MTG",
    tools: ["", "comms", "rfis", "email"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "field",
    title: "Field & day log",
    desc: "Manpower, equipment, photos, site RFIs — feeds DPR.",
    path: "diary",
    accent: "#DC2626",
    icon: "FLD",
    tools: ["", "diary", "photos", "rfis"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "cost",
    title: "Cost & cashflow",
    desc: "Budget, monitoring, MB, BBS, cashflow, COP / bills.",
    path: "cost",
    accent: "#15803D",
    icon: "₹",
    tools: ["", "cost"],
    roles: ["admin", "office", "employee"],
  },
  {
    key: "reports",
    title: "DPR / WPR",
    desc: "Generate daily and weekly packs from live registers.",
    path: "reports",
    accent: "#475569",
    icon: "RPT",
    tools: ["", "reports"],
    roles: ["admin", "office", "site_employee", "employee", "client"],
  },
];

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

/** Default modules enabled for a new project (office can toggle) */
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
