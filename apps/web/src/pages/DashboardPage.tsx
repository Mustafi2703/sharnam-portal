import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Card, PageHeader, Stat, WorkflowStrip } from "../components/ui";

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  clientName?: string;
  location?: string;
  _count?: { drawings: number; members: number };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("sharnam_token");
    api<Project[]>("/api/projects", { token }).then(setProjects).catch(console.error);
  }, []);

  const roleCopy: Record<string, string> = {
    admin: "You own the system — roles, audit, and every project module.",
    office: "Publish drawings to unlock site checklists. Review, cost, and communicate.",
    site_employee: "Log the day. Fill checklists only after drawings are published.",
    client: "See approved work and raise concerns — without drawing upload control.",
    employee: "Cross-functional demo seat across office modules.",
    vendor: "Assigned projects only — dual checklists, diary fills, and RFI responses.",
  };

  const flowActive =
    user?.role === "site_employee" ? 2 : user?.role === "client" ? 3 : user?.role === "office" ? 1 : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Command center"
        title={`Good day, ${user?.fullName?.split(" ")[0]}`}
        subtitle={roleCopy[user?.role || "office"]}
        actions={<Badge tone="brand">{user?.portal} portal</Badge>}
      />

      <WorkflowStrip
        active={flowActive}
        steps={[
          { label: "Publish drawings", hint: "Office uploads IFC sets into Mock OneDrive" },
          { label: "Gate opens", hint: "Site can only submit when drawings are live" },
          { label: "Fill checklists", hint: "Yes / No / N.A. forms — not Excel sheets" },
          { label: "Approve & report", hint: "Office signs off · client sees weekly pack" },
        ]}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Projects" value={projects.length} hint="Assigned to your portal" />
        <Stat
          label="Drawings on demo"
          value={projects[0]?._count?.drawings ?? "—"}
          hint="Published sets unlock QA"
        />
        <Stat label="Your role" value={(user?.role || "").replace("_", " ")} />
        <Stat label="DMS" value="Mock OD" hint="Graph swap-ready later" />
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">Active projects</h2>
          <Link to="/projects" className="text-sm text-brand font-medium">
            All projects →
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {projects.map((p, i) => (
            <Link key={p.id} to={`/projects/${p.id}`} className={`rise rise-delay-${Math.min(i + 1, 3)}`}>
              <Card className="hover:border-brand/40 transition h-full group">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] text-brand tracking-wider">{p.code}</div>
                    <div className="font-semibold text-lg mt-1 group-hover:text-brand-dark transition">
                      {p.name}
                    </div>
                    <div className="text-sm text-steel-muted mt-1">
                      {p.clientName || "—"}
                      {p.location ? ` · ${p.location}` : ""}
                    </div>
                  </div>
                  <Badge tone={p.status === "In Progress" ? "ok" : "neutral"}>{p.status}</Badge>
                </div>
                <div className="mt-5 pt-4 border-t border-line flex gap-4 text-xs text-steel-muted font-mono">
                  <span>{p._count?.drawings ?? 0} drawings</span>
                  <span>{p._count?.members ?? 0} members</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
