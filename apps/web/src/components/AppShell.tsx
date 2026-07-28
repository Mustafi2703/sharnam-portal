import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark, BRAND_EN } from "./Brand";
import { WORKSPACE_PROJECT_KEY } from "../workspaces";
import { api } from "../api";

/** Modern Workday-like chrome — compact, mobile-first */
const primaryNav = [
  { to: "/dashboard", label: "Dashboard", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/workspace", label: "Modules", roles: ["admin", "office", "site_employee", "client", "employee", "vendor"] },
  { to: "/master", label: "Master", roles: ["admin", "office"] },
];

type Proj = { id: string; code: string; name: string };

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inProject = /^\/projects\/[^/]+/.test(location.pathname);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : "")
  );

  const navItems = primaryNav.filter((n) => !user || n.roles.includes(user.role));

  useEffect(() => {
    setMenuOpen(false);
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
    <div className="min-h-dvh flex flex-col bg-sand">
      <header className="app-topbar sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-12 sm:h-14">
          <Link to="/dashboard" className="shrink-0 flex items-center gap-2" aria-label={`${BRAND_EN} home`}>
            <BrandMark size="sm" tagTone="light" compact showTag={false} />
            <span className="hidden xs:inline font-display text-sm text-ink tracking-tight sm:text-[15px]">{BRAND_EN}</span>
          </Link>

          {/* Desktop nav pills */}
          <nav className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-line" aria-label="App">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/dashboard"}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-full text-[13px] font-semibold transition ${
                    isActive
                      ? "bg-brand text-white shadow-sm"
                      : "text-steel-muted hover:text-ink hover:bg-black/[0.04]"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          <label className="hidden md:flex items-center gap-1.5 min-w-0 max-w-[220px]">
            <select
              className="w-full min-w-0 rounded-full border border-line bg-white text-ink text-[13px] px-3 py-1.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              value={projectId}
              onChange={(e) => selectProject(e.target.value)}
              aria-label="Select project"
            >
              {!projects.length && <option value="">No projects</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </label>

          <span className="hidden lg:inline text-[12px] text-steel-muted font-medium truncate max-w-[7rem]">
            {user?.fullName?.split(" ")[0]}
          </span>

          <button
            type="button"
            className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              {menuOpen ? (
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>

          <button
            type="button"
            className="hidden sm:inline-flex text-[12px] font-semibold text-steel-muted hover:text-ink px-2.5 py-1.5 rounded-full hover:bg-black/[0.04]"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="sm:hidden border-t border-line bg-white px-3 py-3 space-y-3 shadow-lg">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/dashboard"}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-2.5 text-sm font-semibold ${
                      isActive ? "bg-brand-soft text-brand" : "text-ink hover:bg-sand"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-steel-muted font-semibold">Project</span>
              <select
                className="mt-1 w-full rounded-xl border border-line bg-sand text-ink text-sm px-3 py-2.5 outline-none focus:border-brand"
                value={projectId}
                onChange={(e) => selectProject(e.target.value)}
              >
                {!projects.length && <option value="">No projects</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-steel-muted"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 min-w-0 w-full">
        <div className={inProject ? "w-full max-w-none" : "w-full max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6"}>
          {children}
        </div>
      </main>
    </div>
  );
}
