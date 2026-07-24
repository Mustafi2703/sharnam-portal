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
  MODULE_TOOLS,
  MODULE_META,
  type WorkspaceKey,
  type ModuleToolItem,
} from "../../workspaces";

const TOP_MODULES: { key: WorkspaceKey | "home"; label: string; path: string; roles?: RoleKey[] }[] = [
  { key: "home", label: "Home", path: "" },
  { key: "drawings", label: "Drawings", path: "hub/drawings" },
  { key: "quality", label: "Quality", path: "hub/quality" },
  { key: "safety", label: "Safety", path: "hub/safety" },
  { key: "progress", label: "Progress", path: "hub/progress" },
  { key: "field", label: "Field", path: "hub/field" },
  { key: "comms", label: "Comms", path: "hub/comms" },
  { key: "cost", label: "Cost", path: "hub/cost", roles: ["admin", "office", "employee"] },
  { key: "reports", label: "Reports", path: "hub/reports" },
];

function moduleFromPath(pathname: string, search: string): WorkspaceKey | "home" {
  const seg = pathname.split("/").filter(Boolean);
  const tool = seg[2] || "";
  if (!tool) return "home";
  if (tool === "hub" && seg[3] && MODULE_META[seg[3] as WorkspaceKey]) return seg[3] as WorkspaceKey;
  if (["drawings", "coordination"].includes(tool)) return "drawings";
  if (tool === "checklist-master") {
    const q = new URLSearchParams(search).get("family");
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
    const kind = new URLSearchParams(search).get("kind");
    if (kind === "DrawingChecklist" || kind === "RequestForInformation") {
      const ws = getActiveWorkspace();
      if (ws === "drawings" || ws === "comms") return ws;
      if (kind === "DrawingChecklist") return "drawings";
      return "comms";
    }
    if (kind === "QualityInspection") return "quality";
    if (kind === "SafetyChecklist") return "safety";
    const ws = getActiveWorkspace();
    if (ws && ws !== "progress" && ws !== "reports" && ws !== "cost") return ws;
    return "quality";
  }
  if (["directory", "vendors"].includes(tool)) return "home";
  return "home";
}

function toolFromPath(pathname: string) {
  const seg = pathname.split("/").filter(Boolean);
  if (seg[2] === "hub") return "hub";
  return seg[2] || "";
}

function parseEnabled(raw?: string | null): WorkspaceKey[] {
  try {
    if (raw == null || raw === "") return DEFAULT_ENABLED_MODULES;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as WorkspaceKey[];
  } catch {
    /* ignore */
  }
  return DEFAULT_ENABLED_MODULES;
}

function isToolActive(t: ModuleToolItem, pathname: string, search: string, projectId: string | undefined): boolean {
  if (!projectId) return false;
  if (pathname.includes("/hub/")) return false;
  const base = t.to ? `/projects/${projectId}/${t.to}` : `/projects/${projectId}`;
  const pathOk = t.end ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
  if (!pathOk) return false;

  const params = new URLSearchParams(search);
  const currentTab = params.get("tab");

  if (t.query) {
    const expected = new URLSearchParams(t.query);
    return [...expected.entries()].every(([k, v]) => params.get(k) === v);
  }

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
  const [rightOpen, setRightOpen] = useState(true);
  const [openRfis, setOpenRfis] = useState(0);

  const activeMod = moduleFromPath(location.pathname, location.search);
  const activeTool = toolFromPath(location.pathname);
  const enabled = useMemo(() => parseEnabled(project?.enabledModules), [project?.enabledModules]);

  const stripItems = useMemo(() => {
    const items = MODULE_TOOLS[activeMod] || MODULE_TOOLS.home;
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
  const toolLabel =
    stripItems.find((t) => isToolActive(t, location.pathname, location.search, id))?.label ||
    (activeTool === "hub" ? `${moduleLabel} hub` : moduleLabel);

  useEffect(() => {
    if (!id) return;
    api(`/api/projects/${id}`, { token }).then(setProject).catch(console.error);
    api<{ publishedCount: number }>(`/api/drawings/project/${id}/gate`, { token })
      .then((g) => setGate(g))
      .catch(console.error);
    api<{ rfis: any[] }>(`/api/rfis/project/${id}`, { token })
      .then((r) => {
        const list = Array.isArray(r) ? r : r.rfis || [];
        setOpenRfis(list.filter((x: any) => x.status === "Open" || x.status === "Draft").length);
      })
      .catch(() => setOpenRfis(0));
  }, [id, token, location.pathname]);

  useEffect(() => {
    if (activeMod !== "home") setActiveWorkspace(activeMod as WorkspaceKey);
  }, [activeMod]);

  return (
    <div className="min-h-[calc(100vh-var(--ui-chrome-h,168px))] w-full">
      <div className="bg-paper border-b border-line sticky top-[calc(var(--ui-nav-h,64px)+3.5rem)] z-20">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-steel-muted">
              <Link to="/workspace" className="text-brand font-semibold hover:underline">
                Modules
              </Link>
              <span>/</span>
              <span className="font-mono text-brand">{project?.code || "…"}</span>
            </div>
            <h1 className="font-display text-lg sm:text-xl text-ink truncate mt-0.5">{project?.name || "Project"}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" variant="ghost" className="!text-sm" onClick={() => setRightOpen((o) => !o)}>
              {rightOpen ? "Hide actions" : "Actions"}
            </Button>
            {openRfis > 0 && (
              <Link to={`/projects/${id}/rfis`}>
                <Badge tone="warn">{openRfis} open RFIs</Badge>
              </Link>
            )}
            <Badge tone="ok">{gate.publishedCount} drawings</Badge>
          </div>
        </div>

        <nav className="px-2 sm:px-4 lg:px-6 flex gap-0.5 overflow-x-auto border-t border-line" aria-label="Modules">
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
                return `px-3.5 sm:px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-[3px] transition ${
                  on ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                }`;
              }}
            >
              {m.label}
            </NavLink>
          ))}
        </nav>

        {activeMod !== "home" && (
          <div className="px-2 sm:px-4 lg:px-6 py-2.5 flex gap-2 overflow-x-auto border-t border-line bg-white" aria-label="Sub-tools">
            <Link
              to={`/projects/${id}/hub/${activeMod}`}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                activeTool === "hub"
                  ? "bg-ink text-white border-ink"
                  : "bg-sand border-line text-steel-muted hover:border-brand hover:text-brand"
              }`}
            >
              Hub
            </Link>
            {stripItems.map((t) => {
              const href = t.to ? `/projects/${id}/${t.to}${t.query ? `?${t.query}` : ""}` : `/projects/${id}`;
              const on = isToolActive(t, location.pathname, location.search, id);
              return (
                <NavLink
                  key={`${t.to}-${t.query || ""}-${t.label}`}
                  to={href}
                  end={t.end}
                  className={() =>
                    `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                      on
                        ? "bg-brand text-white border-brand"
                        : "bg-sand border-line text-steel-muted hover:border-brand hover:text-brand"
                    }`
                  }
                >
                  {t.label}
                </NavLink>
              );
            })}
          </div>
        )}
        {activeMod === "home" && (
          <div className="px-2 sm:px-4 lg:px-6 py-2.5 flex gap-2 overflow-x-auto border-t border-line bg-white" aria-label="Home tools">
            {stripItems.map((t) => {
              const href = t.to ? `/projects/${id}/${t.to}${t.query ? `?${t.query}` : ""}` : `/projects/${id}`;
              const on = isToolActive(t, location.pathname, location.search, id);
              return (
                <NavLink
                  key={`${t.to}-${t.query || ""}-${t.label}`}
                  to={href}
                  end={t.end}
                  className={() =>
                    `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                      on
                        ? "bg-brand text-white border-brand"
                        : "bg-sand border-line text-steel-muted hover:border-brand hover:text-brand"
                    }`
                  }
                >
                  {t.label}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>

      <div className={`tool-shell ${rightOpen ? "has-right" : ""} bg-sand w-full`}>
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
              tool: activeTool === "hub" ? activeMod : activeTool,
              moduleLabel: toolLabel,
              role: user?.role,
            }}
          />
        )}
      </div>
    </div>
  );
}
