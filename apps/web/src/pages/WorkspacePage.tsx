import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Card, PageHeader } from "../components/ui";
import { BrandMark } from "../components/Brand";

type Project = { id: string; code: string; name: string; status: string; clientName?: string };

const WORKSPACES = [
  {
    key: "drawings",
    title: "Drawings & GFC",
    desc: "GFC register, revision upload, publish gate, drawing viewer.",
    path: "drawings",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "quality",
    title: "Quality",
    desc: "Final Index site checklists, quality inspections, action plans, safety.",
    path: "checklist",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "comms",
    title: "Communications",
    desc: "Matrix, meetings, MoM — after drawings publish and during construction.",
    path: "comms",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "field",
    title: "Field & day log",
    desc: "Employee per-day logs, photos, RFIs.",
    path: "diary",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
  {
    key: "home",
    title: "Full project hub",
    desc: "All tools in one Procore-style workspace strip.",
    path: "",
    roles: ["admin", "office", "site_employee", "employee", "vendor", "client"],
  },
] as const;

/** First screen after office/site login — pick project, then workspace */
export default function WorkspacePage() {
  const { user, token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    api<Project[]>("/api/projects", { token }).then((list) => {
      setProjects(list);
      const stored = localStorage.getItem("sharnam_workspace_project");
      if (stored && list.some((p) => p.id === stored)) setProjectId(stored);
      else if (list[0]) setProjectId(list[0].id);
    });
  }, [token]);

  const selected = projects.find((p) => p.id === projectId);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <BrandMark size="lg" tagTone="light" />
      </div>
      <PageHeader
        eyebrow="Workspace"
        title={`Welcome, ${user?.fullName?.split(" ")[0] || "team"}`}
        subtitle="Select a project, then open a workspace — Drawings/GFC, Quality, Communications, or Field. Office and site start here."
        actions={<Badge tone="brand">{user?.portal} portal</Badge>}
      />

      <Card className="brand-frame">
        <label className="text-sm font-medium block mb-2">Project</label>
        <div className="grid sm:grid-cols-2 gap-2">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProjectId(p.id);
                localStorage.setItem("sharnam_workspace_project", p.id);
              }}
              className={`text-left rounded-xl border px-4 py-3 transition ${
                projectId === p.id ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40 bg-white"
              }`}
            >
              <div className="font-mono text-[11px] text-brand">{p.code}</div>
              <div className="font-semibold mt-0.5">{p.name}</div>
              <div className="text-xs text-steel-muted mt-1">{p.clientName || p.status}</div>
            </button>
          ))}
          {!projects.length && <p className="text-sm text-steel-muted">No projects assigned yet.</p>}
        </div>
      </Card>

      {selected && (
        <section>
          <h2 className="font-display text-xl mb-3">Open workspace</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {WORKSPACES.filter((w) => !user || w.roles.includes(user.role as never)).map((w) => (
              <Link
                key={w.key}
                to={`/projects/${selected.id}/${w.path}`}
                className="portal-card surface rounded-xl p-5 block hover:border-brand/40 border border-transparent"
              >
                <div className="font-semibold text-lg">{w.title}</div>
                <p className="text-sm text-steel-muted mt-2 leading-relaxed">{w.desc}</p>
                <div className="mt-4 text-sm text-brand font-medium">Enter →</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-steel-muted">
        Tip: configure project notification emails inside the project hub → Email settings, so publish and checklist events can be sent.
      </p>
    </div>
  );
}
