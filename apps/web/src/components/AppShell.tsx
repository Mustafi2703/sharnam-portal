import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./ui";
import { BrandMark, BRAND_EN } from "./Brand";
import { WORKSPACE_PROJECT_KEY } from "../workspaces";
import { api } from "../api";

/** One black bar only — Dashboard · Modules · Master. Project modules live inside the project. */
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
        <div className="flex items-center gap-3 sm:gap-5 px-4 sm:px-6 h-16 text-white">
          <Link to="/dashboard" className="shrink-0 flex items-center gap-3" aria-label={`${BRAND_EN} home`}>
            <BrandMark size="md" tagTone="dark" compact showTag={false} />
            <div className="hidden sm:block leading-tight">
              <div className="font-display text-base text-white tracking-tight">{BRAND_EN}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/50">PMC · Construction</div>
            </div>
          </Link>

          <nav className="flex items-center gap-0.5 ml-2 sm:ml-4" aria-label="App">
            {primaryNav
              .filter((n) => !user || n.roles.includes(user.role))
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/dashboard"}
                  className={({ isActive }) =>
                    `px-3 py-2 text-sm font-semibold rounded-md transition ${
                      isActive ? "bg-white text-black" : "text-white/70 hover:text-white hover:bg-white/10"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
          </nav>

          <label className="hidden md:flex items-center gap-2 min-w-0 flex-1 max-w-xs ml-auto">
            <span className="text-[10px] uppercase tracking-wider text-white/45 shrink-0">Project</span>
            <select
              className="w-full min-w-0 rounded-md border border-white/15 bg-white/10 text-white text-sm px-2.5 py-1.5 outline-none focus:border-white/40"
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

          <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-2">
            <span className="hidden lg:inline text-xs text-white/50">{user?.fullName?.split(" ")[0]}</span>
            <Button
              variant="ghost"
              className="!px-2.5 !py-1.5 !text-xs !text-white/80 hover:!text-white hover:!bg-white/10"
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
        <div className={inProject ? "w-full max-w-none" : "w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8"}>
          {children}
        </div>
      </main>
    </div>
  );
}
