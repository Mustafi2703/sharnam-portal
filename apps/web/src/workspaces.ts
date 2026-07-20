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
    title: "Drawings & GFC",
    desc: "Register, revise, publish, view sheets.",
    path: "drawings",
    accent: "#E4632A",
    icon: "DWG",
    tools: ["", "drawings", "dms", "coordination", "submittals", "email"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "quality",
    title: "Quality",
    desc: "Final Index, QI forms, action plans, safety.",
    path: "checklist",
    accent: "#0B6A78",
    icon: "QA",
    tools: ["", "checklist", "quality-inspections", "inspections", "safety", "rfis", "email"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "comms",
    title: "Communications",
    desc: "Matrix, meetings, MoM, DPR.",
    path: "comms",
    accent: "#3D4450",
    icon: "MTG",
    tools: ["", "comms", "rfis", "reports", "email"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "field",
    title: "Field & day log",
    desc: "Manpower, equipment, photos, RFIs.",
    path: "diary",
    accent: "#C24D1A",
    icon: "FLD",
    tools: ["", "diary", "photos", "rfis", "reports"],
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "cost",
    title: "Cost & cashflow",
    desc: "Budget, measurement, monitoring, cashflow.",
    path: "cost",
    accent: "#2F6F4E",
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
