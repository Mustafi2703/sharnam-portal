import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, PageHero } from "../components/ui";
import {
  WORKSPACES,
  WORKSPACE_PROJECT_KEY,
  setActiveWorkspace,
  type WorkspaceKey,
} from "../workspaces";

type Project = { id: string; code: string; name: string; status: string; clientName?: string };

/** Module picker — Parikh card language; enter module for full detail */
export default function WorkspacePage() {
  const { user, token } = useAuth();
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
  const visibleWorkspaces = WORKSPACES.filter((w) => !user || w.roles.includes(user.role));
  const firstName = user?.fullName?.split(" ")[0] || "team";

  function enterWorkspace(key: WorkspaceKey, path: string) {
    if (!selected) return;
    setActiveWorkspace(key);
    localStorage.setItem(WORKSPACE_PROJECT_KEY, selected.id);
    navigate(`/projects/${selected.id}/${path}`);
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={`Modules · ${firstName}`}
        subtitle="Choose a module to work in detail. You can return to the Dashboard anytime from the top bar."
        actions={
          <Link to="/dashboard">
            <Button type="button" className="!bg-white/15 !text-white !border-white/30" variant="secondary">
              ← Dashboard
            </Button>
          </Link>
        }
      />

      <Card className="!p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted block mb-2">Project</label>
        <select
          className="w-full max-w-md rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            localStorage.setItem(WORKSPACE_PROJECT_KEY, e.target.value);
          }}
        >
          {!projects.length && <option value="">No projects</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleWorkspaces.map((w) => (
          <button
            key={w.key}
            type="button"
            disabled={!selected}
            onClick={() => enterWorkspace(w.key, w.path)}
            className="module-card group"
          >
            <div className="flex items-start gap-3">
              <span
                className="h-11 w-11 rounded-xl grid place-items-center text-white text-xs font-display shrink-0"
                style={{ background: w.accent }}
              >
                {w.icon}
              </span>
              <div className="min-w-0">
                <div className="font-display text-lg text-slate-800 group-hover:text-brand">{w.title}</div>
                <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{w.desc}</p>
              </div>
            </div>
            <div className="mt-4 text-sm font-semibold text-brand group-hover:text-brand-dark">Enter module →</div>
          </button>
        ))}
      </div>
    </div>
  );
}
