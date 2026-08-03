import type { CSSProperties, ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useMemo, useState } from "react";
import { BRAND_EN, BRAND_HI } from "./Brand";
import {
  ModuleIcon,
  IconClose,
  IconMenu,
  IconSun,
  IconMoon,
  IconPanel,
  IconPanelRight,
  type ModuleIconKey,
} from "./icons";
import {
  WORKSPACE_PROJECT_KEY,
  WORKSPACES,
  MODULE_META,
  getActiveWorkspace,
  resolveStoredProjectId,
  setActiveWorkspace,
  type WorkspaceKey,
} from "../workspaces";
import { api } from "../api";
import {
  applyModuleAccent,
  clearModuleAccent,
  getColorMode,
  notifyModuleTheme,
  SIDEBAR_HIDDEN_KEY,
  toggleColorMode,
  type ColorMode,
} from "../themes";

const BASE_ACCENT = "#0B6A78";
const BASE_SOFT = "#E6F4F6";

function moduleKeyFromPath(pathname: string): WorkspaceKey | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "projects" || !parts[1]) return null;
  const tool = parts[2] || "";
  if (tool === "hub" && parts[3] && MODULE_META[parts[3] as WorkspaceKey]) return parts[3] as WorkspaceKey;
  const stored = getActiveWorkspace();
  if (stored && MODULE_META[stored]) return stored;
  if (tool && MODULE_META[tool as WorkspaceKey]) return tool as WorkspaceKey;
  return null;
}

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
  { to: "/master", label: "Master setup", icon: "master", roles: ["admin", "office"] },
];

/** Office admin — full control surface */
const officeAdminNav: { to: string; label: string; icon: ModuleIconKey }[] = [
  { to: "/crm", label: "CRM · Bids", icon: "modules" },
  { to: "/hrm", label: "HRMS", icon: "modules" },
  { to: "/roles", label: "Access · Users", icon: "master" },
  { to: "/audit", label: "Audit trail", icon: "reports" },
];

type Proj = { id: string; code: string; name: string };

function moduleActive(pathname: string, key: WorkspaceKey) {
  if (pathname.includes(`/hub/${key}`)) return true;
  const map: Record<string, string[]> = {
    drawings: ["/drawings", "/coordination"],
    quality: ["/inspections", "/checklist", "/qap", "/quality-inspections"],
    safety: ["/safety"],
    progress: ["/progress"],
    field: ["/diary", "/photos"],
    comms: ["/comms", "/email"],
    cost: ["/cost"],
    finance: ["/finance"],
    reports: ["/reports"],
  };
  return (map[key] || []).some((p) => pathname.includes(p));
}

function SideNavBody({
  projectId,
  projects,
  onSelectProject,
  onNavigate,
  colorMode,
  onToggleTheme,
}: {
  projectId: string;
  projects: Proj[];
  onSelectProject: (id: string) => void;
  onNavigate?: () => void;
  colorMode: ColorMode;
  onToggleTheme: () => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = appNav.filter((n) => !user || n.roles.includes(user.role));
  const isOffice = user?.role === "admin" || user?.role === "office";
  const modules = useMemo(
    () => WORKSPACES.filter((w) => !user || w.roles.includes(user.role)),
    [user]
  );
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1] || projectId;
  const dark = colorMode === "dark";
  const activeProject = projects.find((p) => p.id === projectId);

  return (
    <div className="side-nav__inner">
      <div className="side-nav__head">
        <Link to="/dashboard" className="side-nav__brand" onClick={onNavigate} aria-label={`${BRAND_EN} home`}>
          <img src="/logo.png" alt="" className="side-nav__logo" width={120} height={58} />
          <div className="side-nav__brand-text min-w-0">
            <div className="side-nav__brand-name truncate">{BRAND_EN}</div>
            <div className="side-nav__brand-sub">PMC · {BRAND_HI}</div>
          </div>
        </Link>
      </div>

      <div className="side-nav__scroll">
        <section className="side-nav__section" aria-label="Workspace">
          <div className="side-nav__section-head">
            <p className="side-nav__label">Workspace</p>
            <span className="side-nav__section-hint">App</span>
          </div>
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
        </section>

        {isOffice && (
          <section className="side-nav__section side-nav__section--office" aria-label="Office admin">
            <div className="side-nav__section-head">
              <p className="side-nav__label">Office admin</p>
              <span className="side-nav__section-hint">Control</span>
            </div>
            <nav className="side-nav__group" aria-label="Office admin">
              {officeAdminNav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={onNavigate}
                  className={({ isActive }) => `side-nav__item ${isActive ? "is-active" : ""}`}
                >
                  <ModuleIcon name={n.icon} size={18} />
                  <span>{n.label}</span>
                </NavLink>
              ))}
            </nav>
          </section>
        )}

        <section className="side-nav__section side-nav__section--project" aria-label="Active project">
          <div className="side-nav__section-head">
            <p className="side-nav__label">Project</p>
            <span className="side-nav__section-hint">Choose</span>
          </div>
          <div className="side-nav__project">
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
            {activeProject ? (
              <div className="side-nav__project-chip">
                <span className="side-nav__project-dot" aria-hidden />
                <span className="truncate">
                  Active · <strong>{activeProject.code}</strong>
                </span>
              </div>
            ) : (
              <p className="side-nav__project-empty">Select a project to open modules</p>
            )}
          </div>
        </section>

        {projectId && (
          <section className="side-nav__section side-nav__section--modules" aria-label="Project modules">
            <div className="side-nav__section-head">
              <p className="side-nav__label">Modules</p>
              <span className="side-nav__section-hint">{modules.length}</span>
            </div>
            <nav className="side-nav__group" aria-label="Project modules">
              <NavLink
                to={`/projects/${activeProjectId || projectId}`}
                end
                onClick={() => {
                  setActiveWorkspace(null);
                  onNavigate?.();
                }}
                className={({ isActive }) =>
                  `side-nav__item ${isActive && location.pathname.split("/").filter(Boolean).length <= 2 ? "is-active" : ""}`
                }
              >
                <ModuleIcon name="home" size={18} />
                <span>Project home</span>
              </NavLink>
              {modules.map((m) => {
                const href = `/projects/${activeProjectId || projectId}/${m.path}`;
                const on = moduleActive(location.pathname, m.key);
                return (
                  <Link
                    key={m.key}
                    to={href}
                    onClick={() => {
                      setActiveWorkspace(m.key as WorkspaceKey);
                      applyModuleAccent(m.accent, m.soft);
                      onNavigate?.();
                    }}
                    className={`side-nav__item side-nav__item--module ${on ? "is-active" : ""}`}
                    style={
                      {
                        ["--item-accent" as string]: m.accent,
                      } as CSSProperties
                    }
                  >
                    <span className="side-nav__icon-wrap" style={{ color: m.accent }}>
                      <ModuleIcon name={m.key as ModuleIconKey} size={18} />
                    </span>
                    <span className="min-w-0 truncate">{m.title}</span>
                    {on && <span className="side-nav__item-live" aria-hidden />}
                  </Link>
                );
              })}
            </nav>
          </section>
        )}
      </div>

      <div className="side-nav__foot">
        <button type="button" className="side-nav__item w-full" onClick={onToggleTheme}>
          {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
          <span>{dark ? "Light mode" : "Dark mode"}</span>
        </button>
        <div className="side-nav__user" title={user?.fullName}>
          {user?.fullName}
          {isOffice && <span className="opacity-70"> · Office</span>}
        </div>
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

/** Left sidebar + top chrome — Procore / SAP desk for Office admin */
export function AppShell({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inProject = /^\/projects\/[^/]+/.test(location.pathname);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_HIDDEN_KEY);
      // Default hidden for a clean workspace; user can reopen from top bar
      if (v === null) return true;
      return v === "1";
    } catch {
      return true;
    }
  });
  const [colorMode, setColorMode] = useState<ColorMode>(() => getColorMode());
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : "")
  );

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  /** Keep left nav + top bar accent in sync with the open module (green base). */
  useEffect(() => {
    if (!inProject) {
      clearModuleAccent();
      return;
    }
    const key = moduleKeyFromPath(location.pathname);
    if (key && MODULE_META[key]) {
      applyModuleAccent(MODULE_META[key].accent, MODULE_META[key].soft);
    } else {
      applyModuleAccent(BASE_ACCENT, BASE_SOFT);
    }
  }, [location.pathname, inProject]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, hidden ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [hidden]);

  useEffect(() => {
    if (!token) return;
    api<Proj[]>("/api/projects", { token })
      .then((list) => {
        setProjects(list);
        setProjectId(resolveStoredProjectId(list));
      })
      .catch(() => {
        setProjects([]);
      });
  }, [token]);

  function selectProject(id: string) {
    setProjectId(id);
    localStorage.setItem(WORKSPACE_PROJECT_KEY, id);
    if (inProject) navigate(`/projects/${id}`);
  }

  function onToggleTheme() {
    setColorMode(toggleColorMode());
    // Module accent must sit on top of light/dark tokens
    notifyModuleTheme();
  }

  const dark = colorMode === "dark";
  const isOffice = user?.role === "admin" || user?.role === "office";
  const activeProject = projects.find((p) => p.id === projectId);

  return (
    <div className={`app-frame ${hidden ? "is-hidden" : ""}`}>
      <aside className={`side-nav hidden md:flex ${hidden ? "is-off" : ""}`} aria-label="Primary" aria-hidden={hidden}>
        {!hidden && (
          <SideNavBody
            projectId={projectId}
            projects={projects}
            onSelectProject={selectProject}
            colorMode={colorMode}
            onToggleTheme={onToggleTheme}
          />
        )}
      </aside>

      <div className="app-frame__main">
        <header className={`app-topbar ${inProject ? "app-topbar--project" : ""}`}>
          <div className={`flex items-center gap-2.5 px-3 sm:px-4 ${inProject ? "h-11" : "h-[52px]"}`}>
            <button
              type="button"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-paper text-ink"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu size={18} />
            </button>
            <button
              type="button"
              className="hidden md:inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 text-ink hover:bg-brand-soft hover:border-brand/40"
              aria-label={hidden ? "Show left navigation" : "Hide left navigation"}
              title={hidden ? "Show left navigation" : "Hide left navigation"}
              onClick={() => setHidden((h) => !h)}
            >
              {hidden ? <IconPanelRight size={15} /> : <IconPanel size={15} />}
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
                {hidden ? "Show nav" : "Hide nav"}
              </span>
            </button>

            {!inProject && (
              <Link to="/dashboard" className="app-topbar__brand hidden sm:flex min-w-0 shrink-0 items-center gap-2" aria-label={`${BRAND_EN} home`}>
                <img src="/logo.png" alt="" className="app-topbar__logo" width={88} height={42} />
                <span className="app-topbar__brand-name">{BRAND_EN}</span>
                <span className="app-topbar__brand-tag">PMC</span>
              </Link>
            )}

            <div className={`app-topbar__meta ${inProject ? "app-topbar__meta--slim" : ""}`}>
              {!inProject && (
                <div className="app-topbar__eyebrow">
                  {isOffice ? "Office · Full control" : "PMC portal"}
                </div>
              )}
              <div className="app-topbar__title truncate">
                {inProject
                  ? activeProject
                    ? `${activeProject.code}`
                    : "Project"
                  : activeProject
                    ? `${activeProject.code} — ${activeProject.name}`
                    : hidden
                      ? "Open left navigation to pick a project"
                      : "Select a project in the sidebar"}
              </div>
            </div>

            {!inProject && isOffice && (
              <div className="hidden lg:flex items-center gap-1.5">
                <Link to="/roles" className="app-topbar__chip hover:border-brand">
                  <strong>Access</strong>
                </Link>
                <Link to="/crm" className="app-topbar__chip hover:border-brand">
                  CRM
                </Link>
                <Link to="/hrm" className="app-topbar__chip hover:border-brand">
                  HRMS
                </Link>
              </div>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              {inProject && (
                <Link to="/workspace" className="app-topbar__chip hidden sm:inline-flex hover:border-brand">
                  Modules
                </Link>
              )}
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-ink hover:bg-brand-soft"
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                onClick={onToggleTheme}
              >
                {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
              </button>
            </div>
          </div>
        </header>

        <main className="app-frame__scroll">
          <div className={inProject ? "w-full max-w-none" : "w-full max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6"}>
            {children}
          </div>
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-ink/50" aria-label="Close" onClick={() => setDrawerOpen(false)} />
          <aside className="side-nav side-nav--drawer absolute left-0 top-0 bottom-0 w-[min(88vw,300px)] flex shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 h-8 w-8 rounded-lg bg-white/10 border border-white/20 grid place-items-center text-white"
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
              colorMode={colorMode}
              onToggleTheme={onToggleTheme}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
