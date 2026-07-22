import { NavLink, Outlet, useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button } from "../../components/ui";
import { ToolRightPanel } from "../../components/ToolRightPanel";
import type { RoleKey } from "@sharnam/shared";
import { getActiveWorkspace, setActiveWorkspace, type WorkspaceKey } from "../../workspaces";

type ToolItem = { to: string; label: string; end?: boolean; roles?: RoleKey[]; query?: string };

const SIDE_TOOLS: Record<WorkspaceKey | "home", ToolItem[]> = {
  home: [
    { to: "", label: "Overview", end: true },
    { to: "directory", label: "Directory" },
    { to: "vendors", label: "Vendors", roles: ["admin", "office", "site_employee", "employee", "vendor"] },
  ],
  drawings: [
    { to: "drawings", label: "GFC register" },
    { to: "dms", label: "Documents (DMS)" },
    { to: "coordination", label: "Coordination", roles: ["admin", "office", "site_employee", "employee"] },
    { to: "submittals", label: "Submittals", roles: ["admin", "office", "site_employee", "employee", "vendor"] },
    { to: "rfis", label: "Request checklist fill", query: "kind=DrawingChecklist", roles: ["admin", "office", "site_employee", "employee", "vendor", "client"] },
  ],
  quality: [
    { to: "inspections", label: "Quality Inspections" },
    { to: "safety", label: "Safety" },
    { to: "checklist", label: "Site checklists" },
    { to: "rfis", label: "Request QI fill", query: "kind=QualityInspection" },
  ],
  field: [
    { to: "diary", label: "Day log" },
    { to: "photos", label: "Photos" },
    { to: "rfis", label: "Field RFIs" },
  ],
  comms: [
    { to: "comms", label: "Meetings · MoM" },
    { to: "rfis", label: "Ask (PMC RFI)", query: "kind=RequestForInformation" },
    { to: "email", label: "Email / Outlook", roles: ["admin", "office", "employee", "site_employee"] },
    { to: "reports", label: "DPR / WPR" },
  ],
  cost: [
    { to: "cost", label: "Measurement / COP" },
    { to: "reports", label: "Reports" },
  ],
};

const TOP_MODULES: { key: WorkspaceKey | "home"; label: string; path: string; roles?: RoleKey[] }[] = [
  { key: "home", label: "Home", path: "" },
  { key: "drawings", label: "Drawings", path: "drawings" },
  { key: "quality", label: "Quality", path: "inspections" },
  { key: "field", label: "Field", path: "diary" },
  { key: "comms", label: "Comms", path: "comms" },
  { key: "cost", label: "Cost", path: "cost", roles: ["admin", "office", "employee"] },
];

function moduleFromPath(pathname: string): WorkspaceKey | "home" {
  const seg = pathname.split("/").filter(Boolean);
  const tool = seg[2] || "";
  if (!tool) return "home";
  if (["drawings", "dms", "coordination", "submittals"].includes(tool)) return "drawings";
  if (["checklist", "quality-inspections", "inspections", "safety"].includes(tool)) return "quality";
  if (["diary", "photos"].includes(tool)) return "field";
  if (["comms", "email"].includes(tool)) return "comms";
  if (["cost"].includes(tool)) return "cost";
  if (tool === "rfis") {
    const ws = getActiveWorkspace();
    if (ws === "drawings" || ws === "field" || ws === "comms" || ws === "quality") return ws;
    return "quality";
  }
  if (tool === "reports") return getActiveWorkspace() === "cost" ? "cost" : "comms";
  if (["directory", "vendors"].includes(tool)) return "home";
  return "home";
}

function toolFromPath(pathname: string) {
  const seg = pathname.split("/").filter(Boolean);
  return seg[2] || "";
}

export default function ProjectToolsLayout() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [gate, setGate] = useState({ publishedCount: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const activeMod = moduleFromPath(location.pathname);
  const activeTool = toolFromPath(location.pathname);
  const sideItems = useMemo(() => {
    const items = SIDE_TOOLS[activeMod] || SIDE_TOOLS.home;
    return items.filter((t) => !t.roles || !user?.role || t.roles.includes(user.role));
  }, [activeMod, user?.role]);

  const topMods = useMemo(
    () => TOP_MODULES.filter((m) => !m.roles || !user?.role || m.roles.includes(user.role)),
    [user?.role]
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
    if (activeMod !== "home") setActiveWorkspace(activeMod);
  }, [activeMod]);

  const shellClass =
    sidebarOpen && rightOpen ? "has-both" : sidebarOpen ? "has-left" : rightOpen ? "has-right" : "";

  return (
    <div className="min-h-[72vh] -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8">
      <div className="bg-paper border-b border-line sticky top-[calc(var(--ui-nav-h,64px)+3.5rem)] z-20">
        <div className="px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center gap-4 justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-steel-muted">
              <Link to="/workspace" className="text-brand font-semibold hover:underline">
                Workspaces
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
                else setActiveWorkspace(m.key);
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
                return (
                  <NavLink
                    key={`${t.to || "home"}-${t.query || ""}`}
                    to={href}
                    end={t.end}
                    className={({ isActive }) =>
                      isActive ? "bg-brand-soft text-brand font-semibold" : "text-ink/85 hover:bg-sand"
                    }
                  >
                    {t.label}
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        )}

        <div className="p-5 sm:p-8 lg:p-10 xl:p-12 min-w-0 page-stack w-full max-w-none">
          <Outlet
            context={{
              project,
              gate,
              reloadProject: () => api(`/api/projects/${id}`, { token }).then(setProject),
              reloadGate: () =>
                api<{ publishedCount: number }>(`/api/drawings/project/${id}/gate`, { token }).then(setGate),
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
            onUploadDrawing={() => navigate(`/projects/${id}/drawings?upload=1`)}
            onAssignChecklist={() => navigate(`/projects/${id}/checklist/assign`)}
          />
        )}
      </div>
    </div>
  );
}
