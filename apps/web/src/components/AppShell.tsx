import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useMemo, useState } from "react";
import { BrandMark, BRAND_EN } from "./Brand";
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
  setActiveWorkspace,
  type WorkspaceKey,
} from "../workspaces";
import { api } from "../api";
import {
  applyColorMode,
  getColorMode,
  SIDEBAR_HIDDEN_KEY,
  toggleColorMode,
  type ColorMode,
} from "../themes";

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
  const modules = useMemo(
    () => WORKSPACES.filter((w) => !user || w.roles.includes(user.role)),
    [user]
  );
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1] || projectId;
  const dark = colorMode === "dark";

  return (
    <div className="side-nav__inner">
      <div className="side-nav__head">
        <Link to="/dashboard" className="side-nav__brand" onClick={onNavigate} aria-label={`${BRAND_EN} home`}>
          <BrandMark size="sm" tagTone={dark ? "dark" : "light"} compact showTag={false} />
          <div className="side-nav__brand-text min-w-0">
            <div className="font-display text-[15px] text-ink tracking-tight truncate">{BRAND_EN}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-brand font-semibold">PMC portal</div>
          </div>
        </Link>
      </div>

      <div className="side-nav__scroll">
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
                      onNavigate?.();
                    }}
                    className={`side-nav__item ${on ? "is-active" : ""}`}
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
      </div>

      <div className="side-nav__foot">
        <button type="button" className="side-nav__item w-full" onClick={onToggleTheme}>
          {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
          <span>{dark ? "Light mode" : "Dark mode"}</span>
        </button>
        <div className="text-xs text-steel-muted truncate px-2">{user?.fullName}</div>
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

/** Left sidebar shell — hideable, scrollable, light/dark */
export function AppShell({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inProject = /^\/projects\/[^/]+/.test(location.pathname);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [colorMode, setColorMode] = useState<ColorMode>(() => getColorMode());
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : "")
  );

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    applyColorMode(colorMode);
  }, [colorMode]);

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

  function onToggleTheme() {
    setColorMode(toggleColorMode());
  }

  const dark = colorMode === "dark";

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
        <header className="app-topbar sticky top-0 z-40">
          <div className="flex items-center gap-2 px-3 sm:px-4 h-12">
            <button
              type="button"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper text-ink"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu size={18} />
            </button>
            <button
              type="button"
              className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-ink hover:bg-brand-soft hover:text-brand"
              aria-label={hidden ? "Show sidebar" : "Hide sidebar"}
              title={hidden ? "Show sidebar" : "Hide sidebar"}
              onClick={() => setHidden((h) => !h)}
            >
              {hidden ? <IconPanelRight size={16} /> : <IconPanel size={16} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-brand font-semibold">
                {inProject ? "Project workspace" : "Sharnam PMC"}
              </div>
              <div className="text-sm font-semibold text-ink truncate">
                {projects.find((p) => p.id === projectId)?.name || "Select a project"}
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-paper text-ink hover:bg-brand-soft"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={onToggleTheme}
            >
              {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            <BrandMark size="sm" tagTone={dark ? "dark" : "light"} compact showTag={false} />
          </div>
        </header>

        <main className="flex-1 min-w-0 w-full overflow-auto">
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
              className="absolute right-3 top-3 z-10 h-8 w-8 rounded-lg bg-paper border border-line grid place-items-center text-ink"
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
