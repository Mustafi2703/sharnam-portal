import type { CSSProperties, ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useMemo, useState } from "react";
import { BRAND_EN } from "./Brand";
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
import { resolveProjectWorkspace, isProjectModuleActive } from "../lib/projectWorkspace";
import { api } from "../api";
import { downloadAuthFile, exportPaths, type ExportModule } from "../lib/downloadReport";
import { sortDemoProjectsFirst } from "../lib/demoProjects";
import {
  applyModuleAccent,
  clearModuleAccent,
  getColorMode,
  notifyModuleTheme,
  SIDEBAR_HIDDEN_KEY,
  toggleColorMode,
  type ColorMode,
} from "../themes";
import { formatUiText } from "../lib/formatUiText";

const BASE_ACCENT = "#0B6A78";
const BASE_SOFT = "#E6F4F6";

function moduleKeyFromPath(pathname: string, search: string): WorkspaceKey | null {
  const ws = resolveProjectWorkspace(pathname, search);
  return ws === "home" ? null : ws;
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
  {
    to: "/training",
    label: "Training",
    icon: "reports",
    roles: ["admin", "office", "site_employee", "client", "employee", "vendor"],
  },
];

/** Site / field desk — attendance + mobile upload testing */
const siteDeskNav: { to: string; label: string; icon: ModuleIconKey }[] = [
  { to: "/attendance", label: "Attendance punch", icon: "field" },
  { to: "/upload-lab", label: "Upload lab · test", icon: "reports" },
];

/** Contractor portal — discipline BOQ uploads per project */
const vendorContractorNav: { to: string; label: string; icon: ModuleIconKey }[] = [
  { to: "/crm/vendor-bids", label: "My bid uploads", icon: "cost" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Office",
  office: "Office",
  site_employee: "Site",
  employee: "Employee",
  vendor: "Contractor",
  client: "Client",
};

/** Office admin — full control surface */
const officeAdminNav: { to: string; label: string; icon: ModuleIconKey }[] = [
  { to: "/crm", label: "CRM", icon: "modules" },
  { to: "/crm/bids", label: "Bid management", icon: "cost" },
  { to: "/quotations/new", label: "PMC proposal", icon: "reports" },
  { to: "/login/hr", label: "HR portal", icon: "modules" },
  { to: "/custom-sheets", label: "Custom sheets", icon: "reports" },
  { to: "/upload-lab", label: "Upload lab", icon: "reports" },
  { to: "/roles", label: "Access · Users", icon: "master" },
  { to: "/audit", label: "Audit trail", icon: "reports" },
];

type Proj = { id: string; code: string; name: string };

function moduleActive(pathname: string, search: string, key: WorkspaceKey) {
  return isProjectModuleActive(pathname, search, key);
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
  const isSiteDesk = user?.role === "site_employee" || user?.role === "vendor";
  const isVendor = user?.role === "vendor";
  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : "";
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
          <img src="/logo-transparent.png" alt={BRAND_EN} className="side-nav__logo" width={240} height={116} />
        </Link>
        {roleLabel ? (
          <span className="side-nav__role-badge" aria-label={`Signed in as ${roleLabel}`}>
            {roleLabel} portal
          </span>
        ) : null}
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
                <span>{formatUiText(n.label)}</span>
              </NavLink>
            ))}
          </nav>
        </section>

        {isSiteDesk && (
          <section className="side-nav__section side-nav__section--site" aria-label="Site desk">
            <div className="side-nav__section-head">
              <p className="side-nav__label">Site desk</p>
              <span className="side-nav__section-hint">Field</span>
            </div>
            <nav className="side-nav__group" aria-label="Site tools">
              {siteDeskNav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={onNavigate}
                  className={({ isActive }) => `side-nav__item ${isActive ? "is-active" : ""}`}
                >
                  <ModuleIcon name={n.icon} size={18} />
                  <span>{formatUiText(n.label)}</span>
                </NavLink>
              ))}
            </nav>
          </section>
        )}

        {isVendor && (
          <section className="side-nav__section side-nav__section--vendor" aria-label="Contractor bids">
            <div className="side-nav__section-head">
              <p className="side-nav__label">Procurement</p>
              <span className="side-nav__section-hint">Bids</span>
            </div>
            <nav className="side-nav__group" aria-label="Vendor bid uploads">
              {vendorContractorNav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={onNavigate}
                  className={({ isActive }) => `side-nav__item ${isActive ? "is-active" : ""}`}
                >
                  <ModuleIcon name={n.icon} size={18} />
                  <span>{formatUiText(n.label)}</span>
                </NavLink>
              ))}
            </nav>
          </section>
        )}

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
                  <span>{formatUiText(n.label)}</span>
                </NavLink>
              ))}
            </nav>
          </section>
        )}

        {isOffice && projects.some((p) => p.code === "SPDC-PILOT-02" || p.code === "SPDC-DEMO-01") && (
          <section className="side-nav__section side-nav__section--demo" aria-label="Client demo">
            <div className="side-nav__section-head">
              <p className="side-nav__label">Client demo</p>
              <span className="side-nav__section-hint">DPR / WPR</span>
            </div>
            <nav className="side-nav__group" aria-label="Demo projects">
              {projects
                .filter((p) => p.code === "SPDC-DEMO-01" || p.code === "SPDC-PILOT-02")
                .map((p) => (
                  <NavLink
                    key={p.id}
                    to={`/projects/${p.id}/dpr-maker`}
                    onClick={() => {
                      onSelectProject(p.id);
                      onNavigate?.();
                    }}
                    className={({ isActive }) => `side-nav__item ${isActive ? "is-active" : ""}`}
                  >
                    <ModuleIcon name="reports" size={18} />
                    <span>{p.code} · DPR</span>
                  </NavLink>
                ))}
              {projects
                .filter((p) => p.code === "SPDC-PILOT-02")
                .map((p) => (
                  <NavLink
                    key={`wpr-${p.id}`}
                    to={`/projects/${p.id}/wpr-maker`}
                    onClick={() => {
                      onSelectProject(p.id);
                      onNavigate?.();
                    }}
                    className={({ isActive }) => `side-nav__item ${isActive ? "is-active" : ""}`}
                  >
                    <ModuleIcon name="reports" size={18} />
                    <span>SPDC-PILOT-02 · WPR</span>
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
                const on = moduleActive(location.pathname, location.search, m.key);
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
                    <span className="min-w-0 truncate">{formatUiText(m.title)}</span>
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
          {roleLabel ? <span className="side-nav__user-role"> · {roleLabel}</span> : null}
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

  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [drawerOpen]);

  /** Keep left nav + top bar accent in sync with the open module (green base). */
  useEffect(() => {
    if (!inProject) {
      clearModuleAccent();
      return;
    }
    const key = moduleKeyFromPath(location.pathname, location.search);
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
        const sorted = sortDemoProjectsFirst(list);
        setProjects(sorted);
        setProjectId(resolveStoredProjectId(sorted));
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
    const next = toggleColorMode();
    setColorMode(next);
    if (inProject) {
      const key = moduleKeyFromPath(location.pathname, location.search);
      if (key && MODULE_META[key]) {
        applyModuleAccent(MODULE_META[key].accent, MODULE_META[key].soft);
      } else {
        applyModuleAccent(BASE_ACCENT, BASE_SOFT);
      }
    }
    notifyModuleTheme();
  }

  const dark = colorMode === "dark";
  const isOffice = user?.role === "admin" || user?.role === "office";
  const isSiteDesk = user?.role === "site_employee" || user?.role === "vendor";
  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : "";
  const activeProject = projects.find((p) => p.id === projectId);
  const routeProjectId = location.pathname.match(/^\/projects\/([^/]+)/)?.[1] || "";

  async function quickExport(kind: ExportModule) {
    if (!routeProjectId || !token) return;
    const paths = exportPaths(routeProjectId, kind);
    const code = projects.find((p) => p.id === routeProjectId)?.code || "project";
    const fname = paths.htmlName.replace(".html", `-${code}.html`);
    try {
      await downloadAuthFile(paths.html, token, fname);
    } catch {
      /* ignore — user can retry from module page */
    }
  }

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
              className="app-topbar__menu-btn md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-paper text-ink"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu size={18} />
            </button>
            <button
              type="button"
              className="hidden md:inline-flex app-topbar__nav-toggle h-8 items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 text-ink hover:bg-brand-soft hover:border-brand/40"
              aria-label={hidden ? "Show left navigation" : "Hide left navigation"}
              title={hidden ? "Show left navigation" : "Hide left navigation"}
              onClick={() => setHidden((h) => !h)}
            >
              {hidden ? <IconPanelRight size={15} /> : <IconPanel size={15} />}
              <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
                {hidden ? "Show nav" : "Hide nav"}
              </span>
            </button>

            <Link to="/dashboard" className="app-topbar__brand min-w-0 shrink-0" aria-label={`${BRAND_EN} home`}>
              <img src="/logo-transparent.png" alt={BRAND_EN} className="app-topbar__logo" width={160} height={76} />
            </Link>

            <div className={`app-topbar__meta ${inProject ? "app-topbar__meta--slim" : ""}`}>
              {roleLabel ? (
                <span className="app-topbar__role-badge">{roleLabel}</span>
              ) : null}
              <div className="app-topbar__title truncate">
                {inProject
                  ? activeProject
                    ? `${activeProject.code}`
                    : "Project"
                  : activeProject
                    ? `${activeProject.code}`
                    : hidden
                      ? "Open left navigation to pick a project"
                      : "Select a project in the sidebar"}
              </div>
            </div>

            {isSiteDesk && (
              <div className="hidden sm:flex items-center gap-1.5">
                <Link to="/attendance" className="app-topbar__chip hover:border-brand">
                  Attendance
                </Link>
                <Link to="/upload-lab" className="app-topbar__chip hover:border-brand">
                  Upload lab
                </Link>
                {user?.role === "vendor" && (
                  <Link to="/crm/vendor-bids" className="app-topbar__chip hover:border-brand">
                    My bids
                  </Link>
                )}
              </div>
            )}

            {!inProject && isOffice && (
              <div className="hidden lg:flex items-center gap-1.5">
                <Link to="/roles" className="app-topbar__chip hover:border-brand">
                  <strong>Access</strong>
                </Link>
                <Link to="/crm" className="app-topbar__chip hover:border-brand">
                  CRM
                </Link>
                <Link to="/login/hr" className="app-topbar__chip hover:border-brand">
                  HR portal
                </Link>
              </div>
            )}

            {inProject && routeProjectId && (
              <div className="hidden lg:flex items-center gap-1 flex-wrap min-w-0 max-w-[min(46vw,520px)]">
                {(
                  [
                    ["dpr", "DPR PDF"],
                    ["wpr", "WPR PDF"],
                    ["rfis", "RFI log"],
                    ["quality", "Quality PDF"],
                    ["progress", "Progress PDF"],
                  ] as const
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    className="app-topbar__chip !text-[10px] !py-1 !px-2 whitespace-nowrap"
                    onClick={() => void quickExport(kind)}
                  >
                    {label}
                  </button>
                ))}
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

        <main className={`app-frame__scroll ${inProject ? "app-frame__scroll--project" : ""}`}>
          <div
            className={
              inProject
                ? "w-full max-w-none h-full min-h-0 flex flex-col"
                : "w-full max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6"
            }
          >
            {children}
          </div>
        </main>
      </div>

      {drawerOpen && (
        <div className="app-mobile-drawer md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="app-mobile-drawer__backdrop"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="side-nav side-nav--drawer app-mobile-drawer__panel">
            <button
              type="button"
              className="side-nav__close absolute right-3 top-3 z-10 h-9 w-9 rounded-lg grid place-items-center"
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
