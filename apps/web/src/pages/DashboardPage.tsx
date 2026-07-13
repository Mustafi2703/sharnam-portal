import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  clientName?: string;
  _count?: { drawings: number; members: number };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("sharnam_token");
    api<Project[]>("/api/projects", { token }).then(setProjects).catch(console.error);
  }, []);

  const tips: Record<string, string> = {
    admin: "Full access — manage roles, audit trail, cost, and all project modules.",
    office: "Review checklists, publish drawings, run cost tracking & communications.",
    site_employee: "Mobile-first: fill daily diary and checklists (requires published drawings).",
    client: "View approved checklists, diaries, and weekly reports for your projects.",
    employee: "Office-style employee access for demos.",
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm uppercase tracking-[0.18em] text-brand">Portal home</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-1">
          Welcome, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-steel-muted mt-2 max-w-2xl">{tips[user?.role || "office"]}</p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Projects", value: projects.length },
          { label: "Portal", value: user?.portal },
          { label: "Role", value: user?.role?.replace("_", " ") },
          { label: "DMS", value: "Mock OneDrive" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-steel-muted">{c.label}</div>
            <div className="mt-2 text-2xl font-semibold capitalize">{c.value}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Your projects</h2>
          <Link to="/projects" className="text-sm text-brand">
            View all
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="rounded-2xl bg-white border border-black/5 p-5 hover:border-brand/40 transition shadow-sm"
            >
              <div className="text-xs text-brand font-medium">{p.code}</div>
              <div className="font-semibold text-lg mt-1">{p.name}</div>
              <div className="text-sm text-steel-muted mt-1">
                {p.clientName || "—"} · {p.status}
              </div>
              <div className="text-xs text-steel-muted mt-3">
                {p._count?.drawings ?? 0} drawings · {p._count?.members ?? 0} members
              </div>
            </Link>
          ))}
          {!projects.length && (
            <p className="text-steel-muted text-sm">No projects assigned yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
