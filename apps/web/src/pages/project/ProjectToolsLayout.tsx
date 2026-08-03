import { NavLink, Outlet, useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button } from "../../components/ui";
import { ToolRightPanel } from "../../components/ToolRightPanel";
import { ModuleIcon, type ModuleIconKey } from "../../components/icons";
import {
  getActiveWorkspace,
  setActiveWorkspace,
  clearStoredProjectId,
  MODULE_TOOLS,
  MODULE_META,
  type WorkspaceKey,
  type ModuleToolItem,
} from "../../workspaces";

const TOP_MODULES: { key: WorkspaceKey | "home"; label: string; path: string }[] = [
  { key: "home", label: "Project home", path: "" },
  { key: "drawings", label: "Drawings", path: "hub/drawings" },
  { key: "quality", label: "Quality", path: "hub/quality" },
  { key: "safety", label: "Safety", path: "hub/safety" },
  { key: "progress", label: "Progress", path: "hub/progress" },
  { key: "field", label: "Field", path: "hub/field" },
  { key: "comms", label: "Comms", path: "hub/comms" },
  { key: "cost", label: "Cost", path: "hub/cost" },
  { key: "finance", label: "Finance", path: "hub/finance" },
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
  if (tool === "checklist-logs") {
    const q = new URLSearchParams(search).get("family");
    if (q === "Safety") return "safety";
    if (q === "DrawingCheck" || q === "SiteExecution") return "drawings";
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
  if (tool === "finance") return "finance";
  if (tool === "qap") return "quality";
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
    if (ws && ws !== "progress" && ws !== "reports" && ws !== "cost" && ws !== "finance") return ws;
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
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [gate, setGate] = useState({ publishedCount: 0 });
  const [rightOpen, setRightOpen] = useState(true);
  const [openRfis, setOpenRfis] = useState(0);
  const [missing, setMissing] = useState(false);

  const activeMod = moduleFromPath(location.pathname, location.search);
  const activeTool = toolFromPath(location.pathname);

  const stripItems = useMemo(() => {
    const items = MODULE_TOOLS[activeMod] || MODULE_TOOLS.home;
    return items.filter((t) => !t.roles || !user?.role || t.roles.includes(user.role));
  }, [activeMod, user?.role]);

  const moduleLabel = TOP_MODULES.find((m) => m.key === activeMod)?.label || "Tools";
  const modMeta = activeMod !== "home" ? MODULE_META[activeMod as WorkspaceKey] : null;
  const accent = modMeta?.accent || "#0B6A78";
  const toolLabel =
    stripItems.find((t) => isToolActive(t, location.pathname, location.search, id))?.label ||
    (activeTool === "hub" ? `${moduleLabel} hub` : moduleLabel);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setMissing(false);
    api(`/api/projects/${id}`, { token })
      .then((p) => {
        if (!cancelled) setProject(p);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          clearStoredProjectId();
          setMissing(true);
          navigate("/dashboard", { replace: true });
          return;
        }
        console.error(err);
      });
    api<{ publishedCount: number }>(`/api/drawings/project/${id}/gate`, { token })
      .then((g) => {
        if (!cancelled) setGate(g);
      })
      .catch(() => undefined);
    api<{ rfis: any[] }>(`/api/rfis/project/${id}`, { token })
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r) ? r : r.rfis || [];
        setOpenRfis(list.filter((x: any) => x.status === "Open" || x.status === "Draft").length);
      })
      .catch(() => {
        if (!cancelled) setOpenRfis(0);
      });
    return () => {
      cancelled = true;
    };
  }, [id, token, navigate]);

  useEffect(() => {
    if (activeMod !== "home") setActiveWorkspace(activeMod as WorkspaceKey);
  }, [activeMod]);

  if (missing) {
    return (
      <div className="p-8 text-sm text-steel-muted">Project not found. Redirecting…</div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-paper border-b border-line sticky top-0 z-20">
        <div className="px-3 sm:px-5 py-2.5 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0 flex items-center gap-3">
            <span
              className="h-9 w-9 rounded-lg grid place-items-center text-white shrink-0"
              style={{ background: accent || "#0f766e" }}
            >
              <ModuleIcon name={(activeMod === "home" ? "home" : activeMod) as ModuleIconKey} size={18} className="text-white" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-steel-muted">
                <span className="font-mono text-ink">{project?.code || "…"}</span>
                <span>·</span>
                <span className="font-semibold text-brand">{moduleLabel}</span>
              </div>
              <h1 className="font-display text-base sm:text-lg text-ink truncate">{project?.name || "Project"}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" variant="ghost" className="!text-sm" onClick={() => setRightOpen((o) => !o)}>
              {rightOpen ? "Hide panel" : "Actions"}
            </Button>
            {openRfis > 0 && (
              <Link to={`/projects/${id}/rfis`}>
                <Badge tone="warn">{openRfis} open RFIs</Badge>
              </Link>
            )}
            <Badge tone="ok">{gate.publishedCount} drawings</Badge>
          </div>
        </div>

        <div className="px-2 sm:px-4 py-2 flex gap-2 overflow-x-auto border-t border-line bg-paper" aria-label={`${moduleLabel} tools`}>
          {activeMod !== "home" && (
            <Link
              to={`/projects/${id}/hub/${activeMod}`}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border transition ${
                activeTool === "hub"
                  ? "bg-brand text-white border-brand"
                  : "bg-paper border-line text-steel-muted hover:border-brand hover:text-brand"
              }`}
            >
              Hub
            </Link>
          )}
          {stripItems.map((t) => {
            const href = t.to ? `/projects/${id}/${t.to}${t.query ? `?${t.query}` : ""}` : `/projects/${id}`;
            const on = isToolActive(t, location.pathname, location.search, id);
            return (
              <NavLink
                key={`${t.to}-${t.query || ""}-${t.label}`}
                to={href}
                end={t.end}
                className={() =>
                  `shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border transition ${
                    on
                      ? "bg-brand text-white border-brand"
                      : "bg-paper border-line text-steel-muted hover:border-brand hover:text-brand"
                  }`
                }
              >
                {t.label}
              </NavLink>
            );
          })}
        </div>
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
