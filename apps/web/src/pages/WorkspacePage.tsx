import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { BrandMark, BRAND_EN, BRAND_TAG } from "../components/Brand";
import {
  WORKSPACES,
  WORKSPACE_PROJECT_KEY,
  setActiveWorkspace,
  type WorkspaceKey,
} from "../workspaces";

type Project = { id: string; code: string; name: string; status: string; clientName?: string };

/** Parikh-style module picker — post-login workspace selection */
export default function WorkspacePage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    api<Project[]>("/api/projects", { token }).then((list) => {
      setProjects(list);
      const stored = localStorage.getItem(WORKSPACE_PROJECT_KEY);
      if (stored && list.some((p) => p.id === stored)) setProjectId(stored);
      else if (list[0]) {
        setProjectId(list[0].id);
        localStorage.setItem(WORKSPACE_PROJECT_KEY, list[0].id);
      }
    });
  }, [token]);

  const selected = projects.find((p) => p.id === projectId);
  const firstName = user?.fullName?.split(" ")[0] || "team";
  const visibleWorkspaces = WORKSPACES.filter((w) => !user || w.roles.includes(user.role));

  function enterWorkspace(key: WorkspaceKey, path: string) {
    if (!selected) return;
    setActiveWorkspace(key);
    localStorage.setItem(WORKSPACE_PROJECT_KEY, selected.id);
    navigate(`/projects/${selected.id}/${path}`);
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] relative overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-10 -my-6 sm:-my-8 rounded-none">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f1b2d] via-[#1e3a5f] to-[#0f2847]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 px-6 lg:px-10 py-8 max-w-6xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <BrandMark size="md" tagTone="dark" showTag={false} />
            <div>
              <p className="text-sm font-semibold text-white tracking-wide">{BRAND_EN.toUpperCase()}</p>
              <p className="text-xs text-slate-400">{BRAND_TAG}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Ops dashboard
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="text-center mb-8 max-w-xl mx-auto">
          <p className="text-amber-400/90 text-sm font-medium tracking-wide uppercase mb-3">Module selection</p>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-white tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-slate-300 mt-3 text-base leading-relaxed">
            Pick a project, then enter a module. Switch modules anytime from the top bar — same flow as Parikh procurement.
          </p>
        </div>

        <div className="mb-8 max-w-lg mx-auto">
          <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 text-center">Active project</label>
          <select
            className="w-full rounded-xl border border-white/20 bg-white/10 text-white text-sm px-4 py-3 outline-none focus:border-amber-400/60"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              localStorage.setItem(WORKSPACE_PROJECT_KEY, e.target.value);
            }}
          >
            {!projects.length && <option value="">No projects</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="text-ink">
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleWorkspaces.map((w) => (
            <button
              key={w.key}
              type="button"
              disabled={!selected}
              onClick={() => enterWorkspace(w.key, w.path)}
              className="portal-tile group text-left p-5 disabled:opacity-40"
            >
              <div className="flex items-start gap-3">
                <span
                  className="h-11 w-11 rounded-xl grid place-items-center text-white text-xs font-display shrink-0"
                  style={{ background: w.accent }}
                >
                  {w.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-display text-lg text-white group-hover:text-amber-300 transition">{w.title}</div>
                  <p className="text-sm text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{w.desc}</p>
                </div>
              </div>
              <div className="mt-4 text-sm font-semibold text-amber-400 group-hover:text-amber-300">Enter module →</div>
            </button>
          ))}
        </div>

        {(user?.role === "admin" || user?.role === "office") && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/master")}
              className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:border-amber-400/50"
            >
              Master setup
            </button>
            <button
              type="button"
              onClick={() => navigate("/roles")}
              className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:border-amber-400/50"
            >
              Who can see what
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
