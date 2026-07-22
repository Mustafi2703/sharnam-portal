import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card } from "../components/ui";
import { BrandMark } from "../components/Brand";
import {
  WORKSPACES,
  WORKSPACE_PROJECT_KEY,
  getActiveWorkspace,
  setActiveWorkspace,
  type WorkspaceKey,
} from "../workspaces";

type Project = { id: string; code: string; name: string; status: string; clientName?: string };

export default function WorkspacePage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [activeWs, setActiveWs] = useState<WorkspaceKey | null>(() => getActiveWorkspace());

  useEffect(() => {
    api<Project[]>("/api/projects", { token }).then((list) => {
      setProjects(list);
      const stored = localStorage.getItem(WORKSPACE_PROJECT_KEY);
      if (stored && list.some((p) => p.id === stored)) setProjectId(stored);
      else if (list[0]) setProjectId(list[0].id);
    });
  }, [token]);

  const selected = projects.find((p) => p.id === projectId);
  const isClient = user?.role === "client";

  function enterWorkspace(key: WorkspaceKey, path: string) {
    if (!selected) return;
    setActiveWorkspace(key);
    setActiveWs(key);
    localStorage.setItem(WORKSPACE_PROJECT_KEY, selected.id);
    navigate(`/projects/${selected.id}/${path}`);
  }

  function clearFocus() {
    setActiveWorkspace(null);
    setActiveWs(null);
  }

  const visibleWorkspaces = WORKSPACES.filter((w) => !user || w.roles.includes(user.role));

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-4">
          <BrandMark size="lg" tagTone="light" />
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brand mb-2">Sharnam workspaces</p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink">
            Welcome, {user?.fullName?.split(" ")[0] || "team"}
          </h1>
          <p className="mt-2 text-sm text-steel-muted max-w-xl leading-relaxed">
            {isClient
              ? "Select your project, then open a module tool set — Drawings & Documents, Quality, Comms, Field, or Reports."
              : "Each portal login lands here. Pick a project, then choose a module (tools). Documents (DMS) holds files; checklists fill via Drawing or QI RFIs for matrix parties / vendors."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone="neutral">{user?.portal} portal</Badge>
          <Link to="/options" className="text-xs font-semibold text-brand hover:underline">
            UI styles 1–5 →
          </Link>
          {activeWs && (
            <Button type="button" variant="secondary" className="!text-xs" onClick={clearFocus}>
              Clear workspace focus
            </Button>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl">1 · Project</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const on = projectId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProjectId(p.id);
                  localStorage.setItem(WORKSPACE_PROJECT_KEY, p.id);
                }}
                className={`text-left border px-5 py-5 transition interactive-lift rounded-xl bg-white ${
                  on ? "selected-ring border-brand" : "border-line hover:border-brand/40"
                }`}
              >
                <div className="font-mono text-[11px] text-brand">{p.code}</div>
                <div className="font-display text-lg mt-2">{p.name}</div>
                <div className="text-xs text-steel-muted mt-2">{p.clientName || p.status}</div>
                {on && <div className="mt-3 text-[11px] font-semibold text-brand">Selected</div>}
              </button>
            );
          })}
          {!projects.length && <p className="text-sm text-steel-muted">No projects assigned yet.</p>}
        </div>
      </section>

      {selected && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-xl">2 · Select tools / module for {selected.code}</h2>
            {activeWs && (
              <span className="text-xs text-steel-muted">
                Focused: <strong className="text-brand">{WORKSPACES.find((w) => w.key === activeWs)?.title}</strong>
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleWorkspaces.map((w, i) => {
              const focused = activeWs === w.key;
              return (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => enterWorkspace(w.key, w.path)}
                  className={`group text-left rounded-xl border bg-white p-5 transition interactive-lift rise rise-delay-${Math.min(i + 1, 4)} ${
                    focused ? "selected-ring border-brand" : "border-line hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="h-11 w-11 rounded-lg grid place-items-center text-white text-xs font-display shrink-0"
                      style={{ background: w.accent }}
                    >
                      {w.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-xl leading-tight">{w.title}</div>
                      <p className="text-sm text-steel-muted mt-1.5 leading-relaxed">{w.desc}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-brand">
                      {focused ? "Open focused →" : "Enter module →"}
                    </span>
                    {isClient && w.key === "drawings" && (
                      <Badge tone="brand">View only</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {isClient && (
            <Card className="bg-brand-soft/40 border-brand/20">
              <div className="font-semibold text-brand-dark">Client desk</div>
              <p className="text-sm text-steel-muted mt-1 leading-relaxed">
                Open Drawings for published sheets, RFIs to raise concerns, and Reports for weekly packs. Uploads and cost stay hidden.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" className="!text-xs" onClick={() => enterWorkspace("drawings", "drawings")}>
                  View drawings
                </Button>
                <Button type="button" variant="secondary" className="!text-xs" onClick={() => enterWorkspace("quality", "rfis")}>
                  Raise concern
                </Button>
              </div>
            </Card>
          )}

          <p className="text-xs text-steel-muted">
            Tip:{" "}
            <Link to={`/projects/${selected.id}`} className="text-brand font-medium underline">
              project home
            </Link>{" "}
            shows the Procore-style left tools + right Actions panel.
          </p>
        </section>
      )}
    </div>
  );
}
