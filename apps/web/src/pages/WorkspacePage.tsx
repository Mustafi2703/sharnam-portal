import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card } from "../components/ui";
import { BrandMark, BRAND_EN } from "../components/Brand";
import {
  WORKSPACES,
  WORKSPACE_PROJECT_KEY,
  setActiveWorkspace,
  type WorkspaceKey,
} from "../workspaces";

type Project = { id: string; code: string; name: string; status: string; clientName?: string };

/** Module picker — enter a module for full detail (construction PMS) */
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

  function enterWorkspace(key: WorkspaceKey, path: string) {
    if (!selected) return;
    setActiveWorkspace(key);
    localStorage.setItem(WORKSPACE_PROJECT_KEY, selected.id);
    navigate(`/projects/${selected.id}/${path}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <BrandMark size="lg" tagTone="light" showTag={false} />
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-steel-muted font-semibold">{BRAND_EN} modules</p>
            <h1 className="font-display text-2xl sm:text-3xl text-ink mt-1">Choose a module</h1>
            <p className="text-sm text-steel-muted mt-1 max-w-lg">
              Pick a project, then open a module to work in detail. Use Dashboard for open RFIs, Comms, and logs.
            </p>
          </div>
        </div>
        <Link to="/dashboard">
          <Button type="button" variant="secondary">
            ← Dashboard
          </Button>
        </Link>
      </div>

      <Card className="!p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted block mb-2">Project</label>
        <select
          className="w-full max-w-md rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleWorkspaces.map((w) => (
          <button
            key={w.key}
            type="button"
            disabled={!selected}
            onClick={() => enterWorkspace(w.key, w.path)}
            className="text-left rounded-lg border border-line bg-white p-4 hover:border-ink disabled:opacity-40 transition"
          >
            <div className="font-display text-lg text-ink">{w.title}</div>
            <p className="text-sm text-steel-muted mt-1.5 line-clamp-2">{w.desc}</p>
            <div className="mt-3 text-sm font-semibold text-brand">Open →</div>
          </button>
        ))}
      </div>
    </div>
  );
}
