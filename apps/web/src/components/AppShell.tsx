import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button } from "./ui";
import { BrandMark, BRAND_EN } from "./Brand";
import { getActiveWorkspace, WORKSPACE_PROJECT_KEY, WORKSPACES } from "../workspaces";
import { api } from "../api";

const primaryNav = [
  { to: "/master", label: "Master", roles: ["admin", "office"] },
  { to: "/workspace", label: "Modules", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/projects", label: "Projects", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/crm", label: "CRM", roles: ["admin", "office", "employee"] },
  { to: "/hrm", label: "HR / Directory", roles: ["admin", "office"] },
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

  function selectProject(id: string) {
    setProjectId(id);
    localStorage.setItem(WORKSPACE_PROJECT_KEY, id);
    navigate(`/projects/${id}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-sand">
      <header className="procore-topbar sticky top-0 z-40 shadow-sm">
        <div
          className="flex items-center gap-4 sm:gap-5 px-5 sm:px-8 border-b border-white/10 bg-procore-navy text-white"
          style={{ minHeight: "var(--ui-nav-h, 64px)" }}
        >
          <Link to="/workspace" className="shrink-0 flex items-center gap-2.5" aria-label={`${BRAND_EN} home`}>
            <BrandMark size="sm" tagTone="dark" compact showTag={false} />
            <span className="hidden sm:inline font-display text-base tracking-tight text-white">{BRAND_EN}</span>
          </Link>

          <label className="flex items-center gap-2 min-w-0 flex-1 max-w-md">
            <span className="hidden lg:inline text-[11px] uppercase tracking-wider text-white/55 shrink-0">Project</span>
            <select
              className="w-full min-w-0 rounded-[var(--ui-radius-sm,6px)] border border-white/20 bg-white/10 text-white text-sm px-3 py-2.5 outline-none focus:border-brand"
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

          {wsLabel && (
            <span className="hidden md:inline text-sm text-white/70 truncate max-w-[140px]">/ {wsLabel}</span>
          )}

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Badge tone="neutral">{user?.portal}</Badge>
            <Button
              variant="ghost"
              className="!px-2.5 !py-2 !text-xs !text-white/85 hover:!text-white hover:!bg-white/10"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 sm:px-6 min-h-14 bg-paper">
          <nav className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 py-2">
            {primaryNav
              .filter((n) => !user || n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/workspace"}
                  className={({ isActive }) =>
                    `px-4 py-3 text-[15px] font-semibold whitespace-nowrap border-b-[3px] transition ${
                      isActive ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            {projectId && (
              <NavLink
                to={`/projects/${projectId}`}
                end
                className={({ isActive }) =>
                  `px-4 py-3 text-[15px] font-semibold whitespace-nowrap border-b-[3px] transition ${
                    isActive ? "border-brand text-brand" : "border-transparent text-steel-muted hover:text-ink"
                  }`
                }
              >
                Overview
              </NavLink>
            )}
          </nav>
          <span className="hidden sm:inline text-[11px] font-mono uppercase tracking-wider text-steel-muted shrink-0 pl-3 border-l border-line">
            Graphite Procore
          </span>
        </div>

        {selected && (
          <div className="px-4 sm:px-6 py-2 bg-brand-soft/50 border-b border-line text-xs text-steel-muted flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-mono text-brand font-semibold">{selected.code}</span>
            <span className="truncate">{selected.name}</span>
            <span className="text-steel-muted/90">
              Modules → tools. Office Master toggles which modules appear on this project.
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 min-w-0 w-full">
        <div className="page-canvas-wide px-4 sm:px-6 lg:px-10 xl:px-12 py-7 sm:py-9 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
