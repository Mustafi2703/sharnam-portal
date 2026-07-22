/** Workspace → tool path filters (hide unrelated modules once focused) */
export const WORKSPACE_KEY = "sharnam_workspace_key";
export const WORKSPACE_PROJECT_KEY = "sharnam_workspace_project";

export type WorkspaceKey = "drawings" | "quality" | "comms" | "field" | "cost";

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
    desc: "GFC register, Documents (DMS), assign checklist, request fill vs latest revision.",
    path: "drawings",
    accent: "#1D4ED8",
    icon: "DWG",
    tools: ["", "drawings", "dms", "coordination", "submittals", "rfis"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "quality",
    title: "Quality",
    desc: "Procore-style Quality Inspections, Safety, and site checklists — separate tools.",
    path: "inspections",
    accent: "#15803D",
    icon: "QA",
    tools: ["", "inspections", "safety", "checklist", "quality-inspections", "rfis"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "comms",
    title: "Communications",
    desc: "Matrix → create meeting → Agenda → MoM → follow-up. PMC RFIs and Outlook live here.",
    path: "comms",
    accent: "#1E3A8A",
    icon: "MTG",
    tools: ["", "comms", "rfis", "email", "reports"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "field",
    title: "Field & day log",
    desc: "Manpower, equipment, photos, site RFIs.",
    path: "diary",
    accent: "#DC2626",
    icon: "FLD",
    tools: ["", "diary", "photos", "rfis", "reports"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "cost",
    title: "Cost & cashflow",
    desc: "Budget, measurement, monitoring, cashflow.",
    path: "cost",
    accent: "#15803D",
    icon: "₹",
    tools: ["", "cost", "reports"],
    roles: ["admin", "office", "employee"],
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
