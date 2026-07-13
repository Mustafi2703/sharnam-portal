import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge } from "../../components/ui";

const TOOLS = [
  { to: "", label: "Home", end: true },
  { to: "directory", label: "Directory" },
  { to: "vendors", label: "Vendors" },
  { to: "drawings", label: "Drawings" },
  { to: "dms", label: "Documents" },
  { to: "checklist", label: "Checklists" },
  { to: "inspections", label: "QA / Inspections" },
  { to: "rfis", label: "RFIs" },
  { to: "submittals", label: "Submittals" },
  { to: "photos", label: "Photos" },
  { to: "diary", label: "Daily Log" },
  { to: "comms", label: "Meetings & Comms" },
  { to: "coordination", label: "Design Coordination" },
  { to: "cost", label: "Cost" },
  { to: "reports", label: "Reports" },
];

export default function ProjectToolsLayout() {
  const { id } = useParams();
  const { token } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [gate, setGate] = useState({ publishedCount: 0 });

  useEffect(() => {
    if (!id) return;
    api(`/api/projects/${id}`, { token }).then(setProject).catch(console.error);
    api<{ publishedCount: number }>(`/api/drawings/project/${id}/gate`, { token })
      .then((g: { publishedCount: number }) => setGate(g))
      .catch(console.error);
  }, [id, token]);

  return (
    <div className="min-h-[70vh] -mx-4 sm:-mx-6 lg:-mx-8 -mt-2">
      <div className="border-b border-line bg-white px-4 sm:px-6 lg:px-8 py-4">
        <Link to="/projects" className="text-xs text-brand font-medium">
          ← All projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] text-brand tracking-wider">{project?.code || "…"}</div>
            <h1 className="font-display text-3xl text-ink leading-tight">{project?.name || "Project"}</h1>
            <p className="text-sm text-steel-muted mt-1">
              {project?.clientName} · {project?.location} · {project?.status}
            </p>
          </div>
          <Badge tone={gate.publishedCount > 0 ? "ok" : "warn"}>
            {gate.publishedCount > 0
              ? `${gate.publishedCount} published drawings`
              : "No published drawings — checklists & QA locked"}
          </Badge>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_1fr] min-h-[60vh]">
        <aside className="border-b lg:border-b-0 lg:border-r border-line bg-[#f7f5f1] lg:min-h-[60vh]">
          <div className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted">
            Project tools
          </div>
          <nav className="px-2 pb-4 flex lg:flex-col gap-0.5 overflow-x-auto">
            {TOOLS.map((t) => (
              <NavLink
                key={t.to || "home"}
                to={t.to ? `/projects/${id}/${t.to}` : `/projects/${id}`}
                end={t.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                    isActive
                      ? "bg-brand text-white font-medium"
                      : "text-ink/80 hover:bg-white hover:text-ink"
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="p-4 sm:p-6 lg:p-8 bg-[#f3f1ec] min-w-0">
          <Outlet context={{ project, gate, reloadProject: () => api(`/api/projects/${id}`, { token }).then(setProject) }} />
        </div>
      </div>
    </div>
  );
}
