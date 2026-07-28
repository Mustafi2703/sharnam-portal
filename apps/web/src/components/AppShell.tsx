import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./ui";
import { BrandMark, BRAND_EN } from "./Brand";
import { WORKSPACE_PROJECT_KEY } from "../workspaces";
import { api } from "../api";

/** Workday-style light chrome · Dashboard · Modules · Master. Project tools live in-project. */
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
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : "")
  );

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
    <div className="min-h-screen flex flex-col bg-sand">
      <header className="procore-topbar sticky top-0 z-40">
        <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 h-14 text-ink">
          <Link to="/dashboard" className="shrink-0 flex items-center gap-2.5" aria-label={`${BRAND_EN} home`}>
            <BrandMark size="sm" tagTone="light" compact showTag={false} />
            <div className="hidden sm:block leading-tight">
              <div className="font-display text-[15px] text-ink tracking-tight">{BRAND_EN}</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-brand font-semibold">PMC</div>
            </div>
          </Link>

          <nav className="flex items-stretch h-full ml-1 sm:ml-4 gap-0.5" aria-label="App">
            {primaryNav
              .filter((n) => !user || n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/dashboard"}
                  className={({ isActive }) =>
                    `px-3.5 text-sm font-semibold h-full flex items-center border-b-2 transition ${
                      isActive
                        ? "border-brand text-brand"
                        : "border-transparent text-steel-muted hover:text-ink hover:border-line"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
          </nav>

          <label className="hidden md:flex items-center gap-2 min-w-0 flex-1 max-w-xs ml-auto">
            <span className="text-[10px] uppercase tracking-wider text-steel-muted shrink-0 font-semibold">Project</span>
            <select
              className="w-full min-w-0 rounded-lg border border-line bg-sand text-ink text-sm px-2.5 py-1.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              value={projectId}
              onChange={(e) => selectProject(e.target.value)}
              aria-label="Select project"
            >
              {!projects.length && <option value="">No projects</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-2">
            <span className="hidden lg:inline text-xs text-steel-muted font-medium">{user?.fullName?.split(" ")[0]}</span>
            <Button
              variant="ghost"
              className="!px-2.5 !py-1.5 !text-xs"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 w-full">
        <div className={inProject ? "w-full max-w-none" : "w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8"}>
          {children}
        </div>
      </main>
    </div>
  );
}
