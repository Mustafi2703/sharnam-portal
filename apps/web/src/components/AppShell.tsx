import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button } from "./ui";
import { BrandMark, BRAND_EN } from "./Brand";
import { getActiveWorkspace, setActiveWorkspace, WORKSPACE_PROJECT_KEY, WORKSPACES } from "../workspaces";
import { api } from "../api";

const primaryNav = [
  { to: "/dashboard", label: "Dashboard", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/workspace", label: "Modules", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/master", label: "Master", roles: ["admin", "office"] },
  { to: "/projects", label: "Projects", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/roles", label: "Access", roles: ["admin"] },
];

type Proj = { id: string; code: string; name: string };

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const projectToolRoute = /^\/projects\/[^/]+/.test(location.pathname);
  const onModulePicker = location.pathname === "/workspace";
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

  function switchModule() {
    setActiveWorkspace(null);
    navigate("/workspace");
  }

  if (onModulePicker) {
    return <div className="min-h-screen bg-[#0f1b2d]">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-sand">
      <header className="procore-topbar sticky top-0 z-40 shadow-sm">
        <div
          className="flex items-center gap-4 sm:gap-5 px-5 sm:px-8 border-b border-white/10 bg-[#0f1b2d] text-white"
          style={{ minHeight: "var(--ui-nav-h, 58px)" }}
        >
          <Link to="/dashboard" className="shrink-0 flex items-center gap-2.5" aria-label={`${BRAND_EN} home`}>
            <BrandMark size="sm" tagTone="dark" compact showTag={false} />
            <span className="hidden sm:inline font-display text-base tracking-tight text-white">{BRAND_EN}</span>
          </Link>

          <label className="flex items-center gap-2 min-w-0 flex-1 max-w-md">
            <span className="hidden lg:inline text-[11px] uppercase tracking-wider text-white/55 shrink-0">Project</span>
            <select
              className="w-full min-w-0 rounded-lg border border-white/20 bg-white/10 text-white text-sm px-3 py-2 outline-none focus:border-amber-400/60"
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
            <span className="hidden md:inline text-sm text-amber-300/90 truncate max-w-[140px] font-semibold">/ {wsLabel}</span>
          )}

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <Button type="button" className="!bg-amber-500 !text-white !text-xs !py-2 hover:!bg-amber-600" onClick={switchModule}>
              Switch module
            </Button>
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

        <div className="flex items-center gap-2 px-3 sm:px-6 min-h-12 bg-white border-b border-line">
          <nav className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1 py-1.5">
            {primaryNav
              .filter((n) => !user || n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/dashboard"}
                  className={({ isActive }) =>
                    `px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-[3px] transition ${
                      isActive ? "border-amber-500 text-[#1e3a5f]" : "border-transparent text-steel-muted hover:text-ink"
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
                  `px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-[3px] transition ${
                    isActive ? "border-amber-500 text-[#1e3a5f]" : "border-transparent text-steel-muted hover:text-ink"
                  }`
                }
              >
                Overview
              </NavLink>
            )}
          </nav>
        </div>

        {selected && (
          <div className="px-4 sm:px-6 py-2 bg-slate-50 border-b border-line text-xs text-steel-muted flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-mono text-[#1e3a5f] font-semibold">{selected.code}</span>
            <span className="truncate text-ink">{selected.name}</span>
            <span>SAP-style modules · Switch module anytime · Admin allocates access in Access</span>
          </div>
        )}
      </header>

      <main className="flex-1 min-w-0 w-full">
        <div
          className={
            projectToolRoute ? "w-full max-w-none" : "w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8"
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}
