import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHero } from "../components/ui";
import { ModuleIcon } from "../components/icons";
import { WORKSPACE_PROJECT_KEY, resolveStoredProjectId } from "../workspaces";

type Project = { id: string; code: string; name: string; status: string };

/** External PMC / consultant desk — coordination, drawings, comms, RFIs on assigned projects. */
export default function StakeholderDeskPage() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : ""),
  );

  useEffect(() => {
    api<Project[]>("/api/projects", { token })
      .then((list) => {
        setProjects(list);
        setProjectId(resolveStoredProjectId(list));
      })
      .catch(() => setProjects([]));
  }, [token]);

  const selected = projects.find((p) => p.id === projectId) || projects[0];
  const pid = selected?.id;

  useEffect(() => {
    if (pid) localStorage.setItem(WORKSPACE_PROJECT_KEY, pid);
  }, [pid]);

  const tools = [
    { to: "drawings/coordination", label: "Design coordination", blurb: "Review sheets · red-lines · PMC comments", icon: "drawings" as const },
    { to: "comms", label: "Meetings & MoM", blurb: "Matrix · agenda · minutes · follow-up", icon: "comms" as const },
    { to: "drawings", label: "GFC register", blurb: "Published drawings and revision history", icon: "drawings" as const },
    { to: "rfis", label: "Ask / RFI", blurb: "Raise and respond to project queries", icon: "comms" as const },
    { to: "reports", label: "Progress reports", blurb: "DPR / WPR packs shared with stakeholders", icon: "reports" as const },
  ];

  return (
    <div className="space-y-5">
      <PageHero
        accent="graphite"
        title={`Stakeholder desk · ${user?.fullName?.split(" ")[0] || "Partner"}`}
        subtitle="Partner PMC and consultant access — coordination, published drawings, meetings, and RFIs on projects you are assigned to."
        icon={<ModuleIcon name="modules" size={20} className="text-white" />}
      />

      <Card className="!p-4 flex flex-col sm:flex-row gap-4 sm:items-end justify-between">
        <div className="flex-1 min-w-0">
          <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted block mb-2">Your project</label>
          <select
            className="w-full max-w-md rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
            value={pid || ""}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {!projects.length && <option value="">No assigned projects</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <Badge tone="brand">Partner PMC</Badge>
      </Card>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {tools.map((t) => (
          <Link
            key={t.to}
            to={pid ? `/projects/${pid}/${t.to}` : "#"}
            className={`stat-tile block ${!pid ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="stat-tile__icon bg-[#1c222b]">
              <ModuleIcon name={t.icon} size={18} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-ink">{t.label}</p>
              <p className="text-xs text-steel-muted mt-0.5">{t.blurb}</p>
            </div>
          </Link>
        ))}
      </div>

      {!pid && (
        <Card>
          <p className="text-sm text-steel-muted">
            Ask the Sharnam office team to assign your login to a delivery project via Project Directory.
          </p>
          <Link to="/projects" className="inline-block mt-3">
            <Button type="button" variant="secondary">View projects</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
