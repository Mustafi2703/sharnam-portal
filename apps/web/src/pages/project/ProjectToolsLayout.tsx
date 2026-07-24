import { NavLink, Outlet, useParams, Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button } from "../../components/ui";
import { ToolRightPanel } from "../../components/ToolRightPanel";
import type { RoleKey } from "@sharnam/shared";
import {
  DEFAULT_ENABLED_MODULES,
  getActiveWorkspace,
  setActiveWorkspace,
  type WorkspaceKey,
} from "../../workspaces";

type ToolItem = {
  to: string;
  label: string;
  end?: boolean;
  roles?: RoleKey[];
  query?: string;
  /** When set, sidebar item is active if ?tab= is one of these */
  activeTabs?: string[];
};

const SIDE_TOOLS: Record<WorkspaceKey | "home", ToolItem[]> = {
  home: [
    { to: "", label: "Overview", end: true },
    { to: "directory", label: "Directory" },
    { to: "vendors", label: "Vendors", roles: ["admin", "office", "site_employee", "employee", "vendor"] },
    { to: "dms", label: "Documents (DMS)" },
  ],
  drawings: [
    { to: "drawings", label: "GFC register" },
    { to: "checklist-master", label: "Drawing check master", query: "family=DrawingCheck", roles: ["admin", "office", "employee"] },
    { to: "dms", label: "Documents (DMS)" },
    { to: "coordination", label: "Coordination", roles: ["admin", "office", "site_employee", "employee"] },
    { to: "submittals", label: "Submittals", roles: ["admin", "office", "site_employee", "employee", "vendor"] },
    {
      to: "rfis",
      label: "Request checklist fill",
      query: "kind=DrawingChecklist",
      roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
    },
  ],
  quality: [
    { to: "inspections", label: "Quality dashboard / QI" },
    { to: "checklist-master", label: "Checklist master", query: "family=QualityInspection", roles: ["admin", "office", "employee"] },
    { to: "checklist", label: "Site checklists" },
    { to: "quality-inspections", label: "QI templates assign", roles: ["admin", "office", "employee"] },
    { to: "rfis", label: "Request QI fill", query: "kind=QualityInspection" },
  ],
  safety: [
    { to: "safety", label: "Safety dashboard" },
    { to: "checklist-master", label: "Safety checklists", query: "family=Safety", roles: ["admin", "office", "employee"] },
    { to: "rfis", label: "Safety checklist RFI", query: "kind=SafetyChecklist" },
  ],
  progress: [
    { to: "progress", label: "Overview", end: true },
    { to: "progress", label: "Milestones", query: "tab=milestones" },
    { to: "progress", label: "Planned vs Actual", query: "tab=planned" },
    { to: "progress", label: "Monthly progress", query: "tab=monthly" },
    { to: "progress", label: "Hindrance", query: "tab=hindrance" },
    { to: "progress", label: "Risk", query: "tab=risk" },
    { to: "progress", label: "Legal approvals", query: "tab=legal" },
  ],
  field: [
    { to: "diary", label: "Day log" },
    { to: "photos", label: "Photos" },
    { to: "rfis", label: "Field RFIs" },
  ],
  comms: [
    { to: "comms", label: "Matrix · Meetings · MoM" },
    { to: "rfis", label: "Ask (PMC RFI)", query: "kind=RequestForInformation" },
    { to: "email", label: "Email / Outlook", roles: ["admin", "office", "employee", "site_employee"] },
  ],
  cost: [
    { to: "cost", label: "BOQ / Monitoring", end: true },
    { to: "cost", label: "MB sheets", query: "tab=mb" },
    { to: "cost", label: "BBS", query: "tab=bbs" },
    { to: "cost", label: "Budget WBS", query: "tab=budget" },
    { to: "cost", label: "Cashflow Chart", query: "tab=cashflow" },
    { to: "cost", label: "Rate difference", query: "tab=rates" },
    { to: "cost", label: "COP / Bills", query: "tab=bills" },
    { to: "cost", label: "Structure upload", query: "tab=boq" },
  ],
  reports: [
    { to: "reports", label: "DPR / WPR packs" },
  ],
};

const TOP_MODULES: { key: WorkspaceKey | "home"; label: string; path: string; roles?: RoleKey[] }[] = [
  { key: "home", label: "Home", path: "" },
  { key: "drawings", label: "Drawings", path: "drawings" },
  { key: "quality", label: "Quality", path: "inspections" },
  { key: "safety", label: "Safety", path: "safety" },
  { key: "progress", label: "Progress", path: "progress" },
  { key: "field", label: "Field", path: "diary" },
  { key: "comms", label: "Comms", path: "comms" },
  { key: "cost", label: "Cost", path: "cost", roles: ["admin", "office", "employee"] },
  { key: "reports", label: "Reports", path: "reports" },
];

function moduleFromPath(pathname: string): WorkspaceKey | "home" {
  const seg = pathname.split("/").filter(Boolean);
  const tool = seg[2] || "";
  if (!tool) return "home";
  if (["drawings", "coordination", "submittals"].includes(tool)) return "drawings";
  if (tool === "checklist-master") {
    const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("family") : null;
    if (q === "Safety") return "safety";
    if (q === "DrawingCheck") return "drawings";
    return "quality";
  }
  if (tool === "dms") {
    const ws = getActiveWorkspace();
    return ws === "drawings" ? "drawings" : "home";
  }
  if (["checklist", "quality-inspections", "inspections"].includes(tool)) return "quality";
  if (tool === "safety") return "safety";
  if (tool === "progress") return "progress";
  if (["diary", "photos"].includes(tool)) return "field";
  if (["comms", "email"].includes(tool)) return "comms";
  if (tool === "cost") return "cost";
  if (tool === "reports") return "reports";
  if (tool === "rfis") {
    const ws = getActiveWorkspace();
    if (ws && ws !== "progress" && ws !== "reports" && ws !== "cost") return ws;
    return "quality";
  }
  if (["directory", "vendors"].includes(tool)) return "home";
  return "home";
}

function toolFromPath(pathname: string) {
  const seg = pathname.split("/").filter(Boolean);
  return seg[2] || "";
}

function parseEnabled(raw?: string | null): WorkspaceKey[] {
  try {
    if (raw == null || raw === "") return DEFAULT_ENABLED_MODULES;
    const arr = JSON.parse(raw);
    // Empty array is intentional (all modules off) — do not fall back to defaults
    if (Array.isArray(arr)) return arr as WorkspaceKey[];
  } catch {
    /* ignore */
  }
  return DEFAULT_ENABLED_MODULES;
}

/** Path + query aware active check (Progress/Cost tabs share one pathname) */
function isSideToolActive(
  t: ToolItem,
  pathname: string,
  search: string,
  projectId: string | undefined
): boolean {
  if (!projectId) return false;
  const base = t.to ? `/projects/${projectId}/${t.to}` : `/projects/${projectId}`;
  const pathOk = t.end ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
  if (!pathOk) return false;

  const params = new URLSearchParams(search);
  const currentTab = params.get("tab");

  if (t.activeTabs?.length) {
    return pathOk && !!currentTab && t.activeTabs.includes(currentTab);
  }

  if (t.query) {
    const expected = new URLSearchParams(t.query);
    return [...expected.entries()].every(([k, v]) => params.get(k) === v);
  }

  // Default tool (no query): inactive when siblings use kind/family/tab filters
  if (t.to === "progress") return !currentTab;
  if (t.to === "cost") return !currentTab || currentTab === "monitoring";
  if (params.get("kind") || params.get("family") || params.get("tab")) return false;
  return true;
}

export default function ProjectToolsLayout() {
  const { id } = useParams();
  const location = useLocation();
  const { token, user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [gate, setGate] = useState({ publishedCount: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const activeMod = moduleFromPath(location.pathname);
  const activeTool = toolFromPath(location.pathname);
  const enabled = useMemo(() => parseEnabled(project?.enabledModules), [project?.enabledModules]);

  const sideItems = useMemo(() => {
    const items = SIDE_TOOLS[activeMod] || SIDE_TOOLS.home;
    return items.filter((t) => !t.roles || !user?.role || t.roles.includes(user.role));
  }, [activeMod, user?.role]);

  const topMods = useMemo(
    () =>
      TOP_MODULES.filter((m) => {
        if (m.roles && user?.role && !m.roles.includes(user.role)) return false;
        if (m.key === "home") return true;
        return enabled.includes(m.key as WorkspaceKey);
      }),
    [user?.role, enabled]
  );

  const moduleLabel = TOP_MODULES.find((m) => m.key === activeMod)?.label || "Tools";
  const toolLabel = sideItems.find((t) => (t.to || "") === activeTool)?.label || moduleLabel;

  useEffect(() => {
    if (!id) return;
    api(`/api/projects/${id}`, { token }).then(setProject).catch(console.error);
    api<{ publishedCount: number }>(`/api/drawings/project/${id}/gate`, { token })
      .then((g) => setGate(g))
      .catch(console.error);
  }, [id, token]);

  useEffect(() => {
    if (activeMod !== "home") setActiveWorkspace(activeMod as WorkspaceKey);
  }, [activeMod]);

  const shellClass =
    sidebarOpen && rightOpen ? "has-both" : sidebarOpen ? "has-left" : rightOpen ? "has-right" : "";

  return (
    <div className="min-h-[calc(100vh-var(--ui-chrome-h,168px))] w-full">
      <div className="bg-paper border-b border-line sticky top-[calc(var(--ui-nav-h,64px)+3.5rem)] z-20">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center gap-4 justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-steel-muted">
              <Link to="/workspace" className="text-brand font-semibold hover:underline">
                Modules
              </Link>
              <span>/</span>
              <span className="font-mono text-brand">{project?.code || "…"}</span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl text-ink truncate mt-1">{project?.name || "Project"}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" variant="ghost" className="!text-sm xl:hidden" onClick={() => setSidebarOpen((o) => !o)}>
              {sidebarOpen ? "Hide tools" : "Tools"}
            </Button>
            <Button type="button" variant="ghost" className="!text-sm" onClick={() => setRightOpen((o) => !o)}>
              {rightOpen ? "Hide actions" : "Actions"}
            </Button>
            <Badge tone="ok">{gate.publishedCount} drawings</Badge>
          </div>
        </div>

        <nav className="px-2 sm:px-4 lg:px-6 flex gap-1 overflow-x-auto border-t border-line" aria-label="Modules">
          {topMods.map((m) => (
            <NavLink
              key={m.key}
              to={m.path ? `/projects/${id}/${m.path}` : `/projects/${id}`}
              end={!m.path}
              onClick={() => {
                if (m.key === "home") setActiveWorkspace(null);
                else setActiveWorkspace(m.key as WorkspaceKey);
              }}
              className={() => {
                const on = activeMod === m.key;
                return `px-4 sm:px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-[3px] transition ${
                  on ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                }`;
              }}
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={`tool-shell ${shellClass} bg-sand w-full`}>
        {sidebarOpen && (
          <aside className="border-b xl:border-b-0 xl:border-r border-line bg-paper tool-side-nav min-w-0">
            <div className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-muted border-b border-line">
              {moduleLabel}
            </div>
            <nav className="p-3 space-y-1">
              {sideItems.map((t) => {
                const href = t.to
                  ? `/projects/${id}/${t.to}${t.query ? `?${t.query}` : ""}`
                  : `/projects/${id}`;
                const on = isSideToolActive(t, location.pathname, location.search, id);
                return (
                  <NavLink
                    key={`${t.to || "home"}-${t.query || ""}-${t.label}`}
                    to={href}
                    end={t.end}
                    className={() =>
                      on ? "bg-brand-soft text-brand font-semibold" : "text-ink/85 hover:bg-sand"
                    }
                  >
                    {t.label}
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        )}

        <div className="tool-main page-stack min-w-0">
          <Outlet
            context={{
              project,
              gate,
              toolLabel,
              refreshProject: () =>
                id ? api(`/api/projects/${id}`, { token }).then(setProject) : Promise.resolve(),
            }}
          />
        </div>

        {rightOpen && id && (
          <ToolRightPanel
            ctx={{
              projectId: id,
              projectCode: project?.code,
              projectName: project?.name,
              publishedCount: gate.publishedCount,
              tool: activeTool,
              moduleLabel: toolLabel,
              role: user?.role,
            }}
          />
        )}
      </div>
    </div>
  );
}
