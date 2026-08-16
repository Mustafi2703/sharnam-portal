import { Outlet, useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api, ApiError } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button } from "../../components/ui";
import { ModuleToolNav } from "../../components/ModuleToolNav";
import { ToolRightPanel } from "../../components/ToolRightPanel";
import { ModuleIcon, type ModuleIconKey } from "../../components/icons";
import {
  getActiveWorkspace,
  setActiveWorkspace,
  clearStoredProjectId,
  MODULE_TOOLS,
  MODULE_META,
  type WorkspaceKey,
} from "../../workspaces";
import { applyModuleAccent, clearModuleAccent, MODULE_THEME_EVENT } from "../../themes";
import { isToolActive } from "../../lib/moduleToolNav";
import { formatUiText } from "../../lib/formatUiText";

const TOP_MODULES = (
  [
    { key: "home", label: "Project home", path: "" },
    { key: "drawings", label: "Drawings", path: "hub/drawings" },
    { key: "dms", label: "Documents", path: "hub/dms" },
    { key: "quality", label: "Quality", path: "hub/quality" },
    { key: "safety", label: "Safety", path: "hub/safety" },
    { key: "progress", label: "Progress", path: "hub/progress" },
    { key: "field", label: "Field", path: "hub/field" },
    { key: "comms", label: "Comms", path: "hub/comms" },
    { key: "cost", label: "Cost", path: "hub/cost" },
    { key: "finance", label: "Finance", path: "hub/finance" },
    { key: "reports", label: "Reports", path: "hub/reports" },
    { key: "closure", label: "Closure", path: "hub/closure" },
  ] as const
).map((m) => ({ ...m, label: formatUiText(m.label) }));

function moduleFromPath(pathname: string, search: string): WorkspaceKey | "home" {
  const seg = pathname.split("/").filter(Boolean);
  const tool = seg[2] || "";
  if (!tool) return "home";
  if (tool === "hub" && seg[3] && MODULE_META[seg[3] as WorkspaceKey]) return seg[3] as WorkspaceKey;
  if (["drawings", "coordination"].includes(tool) || pathname.includes("/drawings/")) return "drawings";
  if (tool === "closure") return "closure";
  if (tool === "checklist-master") {
    if (pathname.includes("/safety/checklist-master")) return "safety";
    if (pathname.includes("/quality/checklist-master")) return "quality";
    const q = new URLSearchParams(search).get("family");
    if (q === "Safety") return "safety";
    if (q === "DrawingCheck") return "drawings";
    return "quality";
  }
  if (tool === "checklist-logs") {
    if (pathname.includes("/safety/checklist-logs")) return "safety";
    if (pathname.includes("/quality/checklist-logs")) return "quality";
    const q = new URLSearchParams(search).get("family");
    if (q === "Safety") return "safety";
    if (q === "DrawingCheck" || q === "SiteExecution") return "drawings";
    return "quality";
  }
  if (tool === "dms") return "dms";
  if (["checklist", "quality-inspections", "inspections"].includes(tool)) return "quality";
  if (tool === "safety") return "safety";
  if (tool === "progress") return "progress";
  if (["diary", "photos", "site-pilot"].includes(tool)) return "field";
  if (["dpr-maker", "wpr-maker"].includes(tool)) return "reports";
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
  if (seg[2] === "drawings" && seg[3] === "coordination") return "coordination";
  return seg[2] || "";
}

export default function ProjectToolsLayout() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [gate, setGate] = useState({ publishedCount: 0 });
  const [rightOpen, setRightOpen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );
  const [isDesktopPanel, setIsDesktopPanel] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );
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
  /** Brand teal/green is the base theme; modules override with their accent. */
  const accent = modMeta?.accent || "#0B6A78";
  const soft = modMeta?.soft || "#E6F4F6";
  const toolLabel =
    stripItems.find((t) => isToolActive(t, location.pathname, location.search, id))?.label ||
    (activeTool === "hub" ? `${moduleLabel} hub` : moduleLabel);

  useEffect(() => {
    applyModuleAccent(accent, soft);
  }, [accent, soft]);

  useEffect(() => {
    const reapply = () => applyModuleAccent(accent, soft);
    window.addEventListener(MODULE_THEME_EVENT, reapply);
    return () => window.removeEventListener(MODULE_THEME_EVENT, reapply);
  }, [accent, soft]);

  useEffect(() => {
    return () => clearModuleAccent();
  }, []);

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

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setIsDesktopPanel(mq.matches);
      if (mq.matches) setRightOpen(true);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (missing) {
    return (
      <div className="p-8 text-sm text-steel-muted">Project not found. Redirecting…</div>
    );
  }

  const panelCtx = id
    ? {
        projectId: id,
        projectCode: project?.code,
        projectName: project?.name,
        publishedCount: gate.publishedCount,
        tool: activeTool === "hub" ? activeMod : activeTool,
        moduleLabel: toolLabel,
        role: user?.role,
      }
    : null;

  const actionPanel =
    rightOpen && panelCtx ? (
      <ToolRightPanel accent={accent} ctx={panelCtx} />
    ) : null;

  return (
    <div className="w-full tool-workspace" style={{ ["--tool-accent" as string]: accent }}>
      <div className="tool-chrome bg-paper border-b border-line sticky top-0 z-20">
        <div className="px-3 sm:px-5 py-2.5 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0 flex items-center gap-3">
            <span
              className="h-9 w-9 rounded-lg grid place-items-center text-white shrink-0 shadow-sm"
              style={{ background: accent || "var(--color-brand)" }}
            >
              <ModuleIcon name={(activeMod === "home" ? "home" : activeMod) as ModuleIconKey} size={18} className="text-white" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-steel-muted">
                <span className="font-mono text-ink">{project?.code || "…"}</span>
                <span>·</span>
                <span className="font-semibold" style={{ color: accent }}>
                  {moduleLabel}
                </span>
              </div>
              <h1 className="font-display text-base sm:text-lg text-ink truncate">{project?.name || "Project"}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Button
              type="button"
              variant="ghost"
              className="!text-sm tool-actions-toggle"
              onClick={() => setRightOpen((o) => !o)}
            >
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

      </div>

      <div className={`tool-shell ${rightOpen ? "has-right" : ""} bg-sand w-full`}>
        {rightOpen && !isDesktopPanel && (
          <button
            type="button"
            className="tool-actions-backdrop"
            aria-label="Close actions panel"
            onClick={() => setRightOpen(false)}
          />
        )}
        <div className="tool-main page-stack min-w-0">
          {id &&
            activeTool !== "hub" &&
            (activeMod !== "home" || activeTool === "directory" || activeTool === "vendors") && (
              <ModuleToolNav
                projectId={id}
                moduleKey={(activeMod === "home" ? "home" : activeMod) as WorkspaceKey | "home"}
                accent={accent}
              />
            )}
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

        {isDesktopPanel && actionPanel}

        {!isDesktopPanel &&
          actionPanel &&
          createPortal(<div className="tool-actions-portal">{actionPanel}</div>, document.body)}
      </div>
    </div>
  );
}
