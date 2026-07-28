import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useMemo, useState } from "react";
import { BrandMark, BRAND_EN } from "./Brand";
import {
  ModuleIcon,
  IconClose,
  IconMenu,
  type ModuleIconKey,
} from "./icons";
import {
  WORKSPACE_PROJECT_KEY,
  WORKSPACES,
  setActiveWorkspace,
  type WorkspaceKey,
} from "../workspaces";
import { api } from "../api";

const appNav: { to: string; label: string; icon: ModuleIconKey; roles: string[]; end?: boolean }[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    roles: ["admin", "office", "site_employee", "client", "employee", "vendor"],
    end: true,
  },
  {
    to: "/workspace",
    label: "Modules",
    icon: "modules",
    roles: ["admin", "office", "site_employee", "client", "employee", "vendor"],
  },
  { to: "/master", label: "Master", icon: "master", roles: ["admin", "office"] },
];

type Proj = { id: string; code: string; name: string };

function SideNavBody({
  projectId,
  projects,
  onSelectProject,
  onNavigate,
  inProject,
}: {
  projectId: string;
  projects: Proj[];
  onSelectProject: (id: string) => void;
  onNavigate?: () => void;
  inProject: boolean;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = appNav.filter((n) => !user || n.roles.includes(user.role));
  const modules = useMemo(
    () => WORKSPACES.filter((w) => !user || w.roles.includes(user.role)),
    [user]
  );

  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1] || projectId;

  return (
    <div className="side-nav__inner">
      <Link to="/dashboard" className="side-nav__brand" onClick={onNavigate} aria-label={`${BRAND_EN} home`}>
        <BrandMark size="sm" tagTone="light" compact showTag={false} />
        <div className="min-w-0">
          <div className="font-display text-[15px] text-ink tracking-tight truncate">{BRAND_EN}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand font-semibold">PMC portal</div>
        </div>
      </Link>

      <p className="side-nav__label">Workspace</p>
      <nav className="side-nav__group" aria-label="App">
        {navItems.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            className={({ isActive }) => `side-nav__item ${isActive ? "is-active" : ""}`}
          >
            <ModuleIcon name={n.icon} size={18} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="side-nav__project">
        <label className="side-nav__label !mb-1.5 block">Project</label>
        <select
          className="side-nav__select"
          value={projectId}
          onChange={(e) => onSelectProject(e.target.value)}
          aria-label="Select project"
        >
          {!projects.length && <option value="">No projects</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>

      {projectId && (
        <>
          <p className="side-nav__label">Modules</p>
          <nav className="side-nav__group side-nav__modules" aria-label="Project modules">
            <NavLink
              to={`/projects/${activeProjectId || projectId}`}
              end
              onClick={() => {
                setActiveWorkspace(null);
                onNavigate?.();
              }}
              className={({ isActive }) => `side-nav__item ${isActive && !location.pathname.includes("/hub/") && location.pathname.split("/").length <= 3 ? "is-active" : ""}`}
            >
              <ModuleIcon name="home" size={18} />
              <span>Project home</span>
            </NavLink>
            {modules.map((m) => {
              const href = `/projects/${activeProjectId || projectId}/${m.path}`;
              const on =
                inProject &&
                (location.pathname.includes(`/hub/${m.key}`) ||
                  location.pathname.includes(`/${m.key}`) ||
                  (m.key === "comms" && location.pathname.includes("/email")) ||
                  (m.key === "field" && (location.pathname.includes("/diary") || location.pathname.includes("/photos"))) ||
                  (m.key === "quality" &&
                    (location.pathname.includes("/inspections") ||
                      location.pathname.includes("/checklist") ||
                      location.pathname.includes("/qap"))) ||
                  (m.key === "drawings" &&
                    (location.pathname.includes("/drawings") || location.pathname.includes("/coordination"))) ||
                  (m.key === "cost" && location.pathname.includes("/cost")) ||
                  (m.key === "finance" && location.pathname.includes("/finance")) ||
                  (m.key === "reports" && location.pathname.includes("/reports")) ||
                  (m.key === "progress" && location.pathname.includes("/progress")) ||
                  (m.key === "safety" && location.pathname.includes("/safety")));
              return (
                <Link
                  key={m.key}
                  to={href}
                  onClick={() => {
                    setActiveWorkspace(m.key as WorkspaceKey);
                    onNavigate?.();
                  }}
                  className={`side-nav__item ${on ? "is-active" : ""}`}
                  style={{ ["--mod-accent" as string]: m.accent }}
                >
                  <span className="side-nav__icon-wrap" style={{ color: m.accent }}>
                    <ModuleIcon name={m.key as ModuleIconKey} size={18} />
                  </span>
                  <span>{m.title}</span>
                </Link>
              );
            })}
          </nav>
        </>
      )}

      <div className="side-nav__foot">
        <div className="text-xs text-steel-muted truncate">{user?.fullName}</div>
        <button
          type="button"
          className="side-nav__signout"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/** Left sidebar shell — common interactive design system */
export function AppShell({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inProject = /^\/projects\/[^/]+/.test(location.pathname);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : "")
  );

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

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

  function selectProject(id: string) {
    setProjectId(id);
    localStorage.setItem(WORKSPACE_PROJECT_KEY, id);
    if (inProject) navigate(`/projects/${id}`);
  }

  return (
    <div className={`app-frame ${collapsed ? "is-collapsed" : ""}`}>
      {/* Desktop sidebar */}
      <aside className="side-nav hidden md:flex" aria-label="Primary">
        <SideNavBody
          projectId={projectId}
          projects={projects}
          onSelectProject={selectProject}
          inProject={inProject}
        />
      </aside>

      <div className="app-frame__main">
        <header className="app-topbar sticky top-0 z-40">
          <div className="flex items-center gap-2 px-3 sm:px-4 h-12">
            <button
              type="button"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-ink"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu size={18} />
            </button>
            <button
              type="button"
              className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg text-steel-muted hover:bg-brand-soft hover:text-brand"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((c) => !c)}
            >
              <IconMenu size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-brand font-semibold">
                {inProject ? "Project workspace" : "Sharnam PMC"}
              </div>
              <div className="text-sm font-semibold text-ink truncate">
                {projects.find((p) => p.id === projectId)?.name || "Select a project"}
              </div>
            </div>
            <BrandMark size="sm" tagTone="light" compact showTag={false} />
          </div>
        </header>

        <main className="flex-1 min-w-0 w-full">
          <div className={inProject ? "w-full max-w-none" : "w-full max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6"}>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close" onClick={() => setDrawerOpen(false)} />
          <aside className="side-nav side-nav--drawer absolute left-0 top-0 bottom-0 w-[min(88vw,300px)] flex shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 h-8 w-8 rounded-lg bg-white border border-line grid place-items-center"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
            >
              <IconClose size={16} />
            </button>
            <SideNavBody
              projectId={projectId}
              projects={projects}
              onSelectProject={selectProject}
              onNavigate={() => setDrawerOpen(false)}
              inProject={inProject}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
