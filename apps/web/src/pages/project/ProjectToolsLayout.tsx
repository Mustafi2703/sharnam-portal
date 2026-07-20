import { NavLink, Outlet, useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button } from "../../components/ui";
import { ToolRightPanel } from "../../components/ToolRightPanel";
import type { RoleKey } from "@sharnam/shared";
import { getActiveWorkspace, setActiveWorkspace, type WorkspaceKey } from "../../workspaces";

type ToolItem = { to: string; label: string; end?: boolean; roles?: RoleKey[] };

const SIDE_TOOLS: Record<WorkspaceKey | "home", ToolItem[]> = {
  home: [
    { to: "", label: "Overview", end: true },
    { to: "directory", label: "Directory" },
    { to: "vendors", label: "Vendors", roles: ["admin", "office", "site_employee", "employee", "vendor"] },
    { to: "email", label: "Email", roles: ["admin", "office", "employee", "site_employee"] },
  ],
  drawings: [
    { to: "drawings", label: "GFC register" },
    { to: "dms", label: "Documents" },
    { to: "coordination", label: "Coordination", roles: ["admin", "office", "site_employee", "employee"] },
    { to: "submittals", label: "Submittals", roles: ["admin", "office", "site_employee", "employee", "vendor"] },
  ],
  quality: [
    { to: "checklist", label: "Final Index" },
    { to: "quality-inspections", label: "QI forms" },
    { to: "inspections", label: "Action plan" },
    { to: "safety", label: "Safety" },
    { to: "rfis", label: "RFIs" },
  ],
  field: [
    { to: "diary", label: "Day log" },
    { to: "photos", label: "Photos" },
    { to: "rfis", label: "RFIs" },
  ],
  comms: [
    { to: "comms", label: "Meetings" },
    { to: "rfis", label: "RFIs" },
    { to: "reports", label: "DPR / reports" },
  ],
  cost: [
    { to: "cost", label: "Measurement" },
    { to: "reports", label: "Reports" },
  ],
};

const TOP_MODULES: { key: WorkspaceKey | "home"; label: string; path: string; roles?: RoleKey[] }[] = [
  { key: "home", label: "Home", path: "" },
  { key: "drawings", label: "Drawings", path: "drawings" },
  { key: "quality", label: "Quality", path: "checklist" },
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
  if (["comms"].includes(tool)) return "comms";
  if (["cost"].includes(tool)) return "cost";
  if (tool === "rfis") return getActiveWorkspace() === "field" ? "field" : "quality";
  if (tool === "reports") return getActiveWorkspace() === "cost" ? "cost" : "comms";
  return "home";
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
  const sideItems = useMemo(() => {
    const items = SIDE_TOOLS[activeMod] || SIDE_TOOLS.home;
    return items.filter((t) => !t.roles || !user?.role || t.roles.includes(user.role));
  }, [activeMod, user?.role]);

  const topMods = useMemo(
    () => TOP_MODULES.filter((m) => !m.roles || !user?.role || m.roles.includes(user.role)),
    [user?.role]
  );

  const moduleLabel = TOP_MODULES.find((m) => m.key === activeMod)?.label || "Tools";

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

  return (
    <div className="min-h-[70vh] -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8">
      <div className="bg-white border-b border-line">
        <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-steel-muted">
              <Link to="/workspace" className="text-brand font-medium hover:underline">
                Sharnam workspaces
              </Link>
              <span>/</span>
              <span className="font-mono">{project?.code || "…"}</span>
            </div>
            <h1 className="font-display text-lg sm:text-xl text-ink truncate mt-0.5">
              {project?.name || "Project"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" className="!text-xs lg:hidden" onClick={() => setSidebarOpen((o) => !o)}>
              {sidebarOpen ? "Hide tools" : "Tools"}
            </Button>
            <Button type="button" variant="ghost" className="!text-xs" onClick={() => setRightOpen((o) => !o)}>
              {rightOpen ? "Hide actions" : "Actions"}
            </Button>
            <Badge tone={gate.publishedCount > 0 ? "ok" : "warn"}>
              {gate.publishedCount > 0 ? `${gate.publishedCount} published` : "Gate locked"}
            </Badge>
          </div>
        </div>

        <nav className="px-2 sm:px-4 flex gap-0.5 overflow-x-auto border-t border-line" aria-label="Sharnam modules">
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
                return `px-3 sm:px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${
                  on ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                }`;
              }}
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div
        className={`min-h-[62vh] ${
          sidebarOpen && rightOpen
            ? "xl:grid xl:grid-cols-[168px_1fr_240px]"
            : sidebarOpen
              ? "lg:grid lg:grid-cols-[168px_1fr]"
              : rightOpen
                ? "xl:grid xl:grid-cols-[1fr_240px]"
                : ""
        }`}
      >
        {sidebarOpen && (
          <aside className="border-b xl:border-b-0 xl:border-r border-line bg-white">
            <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-steel-muted border-b border-line">
              {moduleLabel}
            </div>
            <nav className="p-2 space-y-0.5">
              {sideItems.map((t) => (
                <NavLink
                  key={t.to || "home"}
                  to={t.to ? `/projects/${id}/${t.to}` : `/projects/${id}`}
                  end={t.end}
                  className={({ isActive }) =>
                    `block rounded-md px-2.5 py-2 text-[13px] transition ${
                      isActive ? "bg-brand-soft text-brand font-semibold" : "text-ink/80 hover:bg-sand"
                    }`
                  }
                >
                  {t.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        )}

        <div className="p-5 sm:p-7 bg-sand min-w-0">
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
              moduleLabel,
              role: user?.role,
            }}
            onUploadDrawing={() => navigate(`/projects/${id}/drawings?upload=1`)}
            onAssignChecklist={() => navigate(`/projects/${id}/checklist?assign=1`)}
          />
        )}
      </div>
    </div>
  );
}
