import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button } from "./ui";
import { BrandMark, BRAND_EN } from "./Brand";
import { getActiveWorkspace, WORKSPACE_PROJECT_KEY, WORKSPACES } from "../workspaces";
import { LIVE_UI_OPTIONS, THEME_STORAGE_KEY, applyThemeOption } from "../themes";
import { api } from "../api";

const primaryNav = [
  { to: "/workspace", label: "Home", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/projects", label: "Projects", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/crm", label: "CRM", roles: ["admin", "office", "employee"] },
  { to: "/hrm", label: "HR / Directory", roles: ["admin", "office"] },
  { to: "/options", label: "UI 1–5", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
];

const moreNav = [
  { to: "/audit", label: "Audit", roles: ["admin", "office"] },
  { to: "/roles", label: "Permissions", roles: ["admin"] },
  { to: "/themes", label: "Themes", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
];

type Proj = { id: string; code: string; name: string };

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Proj[]>([]);
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : "")
  );
  const ws = typeof window !== "undefined" ? getActiveWorkspace() : null;
  const wsLabel = WORKSPACES.find((w) => w.key === ws)?.title;
  const canUpload = user && user.role !== "client";

  useEffect(() => {
    if (!token) return;
    api<Proj[]>("/api/projects", { token })
      .then((list) => {
        setProjects(list);
        const stored = localStorage.getItem(WORKSPACE_PROJECT_KEY);
        if (stored && list.some((p) => p.id === stored)) setProjectId(stored);
        else if (list[0] && !stored) {
          setProjectId(list[0].id);
          localStorage.setItem(WORKSPACE_PROJECT_KEY, list[0].id);
        }
      })
      .catch(() => undefined);
  }, [token]);

  const selected = projects.find((p) => p.id === projectId);

  let activeUi = "1";
  try {
    const id = localStorage.getItem(THEME_STORAGE_KEY) || "ui-1";
    activeUi = String(LIVE_UI_OPTIONS.find((t) => t.id === id)?.number || 1);
  } catch {
    /* ignore */
  }

  function selectProject(id: string) {
    setProjectId(id);
    localStorage.setItem(WORKSPACE_PROJECT_KEY, id);
    navigate(`/projects/${id}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-sand">
      <header className="procore-topbar sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-12 border-b border-line bg-procore-navy text-white">
          <Link to="/workspace" className="shrink-0 flex items-center gap-2" aria-label={`${BRAND_EN} home`}>
            <BrandMark size="sm" tagTone="dark" compact showTag={false} />
            <span className="hidden sm:inline font-display text-sm tracking-tight text-white">{BRAND_EN}</span>
          </Link>

          {/* Project picker — select project then work */}
          <label className="flex items-center gap-1.5 min-w-0 max-w-[42vw] sm:max-w-xs">
            <span className="hidden lg:inline text-[10px] uppercase tracking-wider text-white/60 shrink-0">Project</span>
            <select
              className="w-full min-w-0 rounded-sm border border-white/20 bg-white/10 text-white text-xs sm:text-[13px] px-2 py-1.5 outline-none focus:border-brand"
              value={projectId}
              onChange={(e) => selectProject(e.target.value)}
              aria-label="Select project"
            >
              {!projects.length && <option value="">No projects</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="text-ink">
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-white/70 min-w-0">
            {wsLabel && (
              <>
                <span>/</span>
                <span className="text-white font-medium truncate">{wsLabel}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 shrink-0">
            {canUpload && projectId && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="!hidden lg:!inline-flex !text-[11px] !py-1 !bg-white/10 !text-white !border-white/20 hover:!bg-white/20"
                  onClick={() => navigate(`/projects/${projectId}/dms`)}
                >
                  Docs
                </Button>
                <Button
                  type="button"
                  className="!text-[11px] !py-1"
                  onClick={() => navigate(`/projects/${projectId}/drawings?upload=1`)}
                >
                  Upload drawing
                </Button>
              </>
            )}
            <Badge tone="neutral">{user?.portal}</Badge>
            <Button
              variant="ghost"
              className="!px-2 !py-1 !text-[11px] !text-white/80 hover:!text-white hover:!bg-white/10"
              onClick={() => {
                logout();
                navigate("/options");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2 sm:px-4 h-11 bg-paper">
          <nav className="flex items-center gap-0.5 overflow-x-auto min-w-0 flex-1">
            {primaryNav
              .filter((n) => !user || n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/workspace"}
                  className={({ isActive }) =>
                    `px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${
                      isActive ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            {projectId && (
              <>
                <NavLink
                  to={`/projects/${projectId}`}
                  end
                  className={({ isActive }) =>
                    `px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${
                      isActive ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                    }`
                  }
                >
                  Overview
                </NavLink>
                <NavLink
                  to={`/projects/${projectId}/comms`}
                  className={({ isActive }) =>
                    `hidden sm:inline-flex px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${
                      isActive ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                    }`
                  }
                >
                  Comms
                </NavLink>
                <NavLink
                  to={`/projects/${projectId}/reports`}
                  className={({ isActive }) =>
                    `hidden md:inline-flex px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${
                      isActive ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                    }`
                  }
                >
                  DPR/WPR
                </NavLink>
              </>
            )}
            {moreNav
              .filter((n) => user && n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `hidden xl:inline-flex px-3 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition ${
                      isActive ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-line">
            <span className="hidden sm:inline text-[10px] font-mono uppercase text-steel-muted mr-1">UI</span>
            {LIVE_UI_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.name}
                onClick={() => applyThemeOption(t.id)}
                className={`h-7 w-7 text-[11px] font-semibold border transition ${
                  String(t.number) === activeUi
                    ? "bg-brand text-white border-brand"
                    : "bg-sand border-line text-steel-muted hover:border-brand"
                }`}
                style={{ borderRadius: "var(--ui-radius-sm, 6px)" }}
              >
                {t.number}
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="px-3 sm:px-5 py-1.5 bg-brand-soft/40 border-b border-line text-[11px] text-steel-muted flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-mono text-brand">{selected.code}</span>
            <span className="truncate">{selected.name}</span>
            <span className="text-steel-muted/80">Select project above · then use modules / right Actions</span>
          </div>
        )}
      </header>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
