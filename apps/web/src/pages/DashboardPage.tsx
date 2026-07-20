import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHeader, Stat, WorkflowStrip } from "../components/ui";

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
  const isClient = user?.role === "client";

  useEffect(() => {
    const token = localStorage.getItem("sharnam_token");
    api<Project[]>("/api/projects", { token }).then(setProjects).catch(console.error);
  }, []);

  const roleCopy: Record<string, string> = {
    admin: "You own the system — roles, audit, and every project module.",
    office: "Upload drawings, publish to unlock site checklists, assign types, review cost.",
    site_employee: "Log the day. Fill checklists only after drawings are published — pick drawing + revision.",
    client: "Designed client desk — published drawings, concerns, and weekly packs. No uploads.",
    employee: "Cross-functional demo seat across office modules.",
    vendor: "Assigned projects only — dual checklists, diary fills, and RFI responses.",
  };

  const flowActive =
    user?.role === "site_employee" ? 2 : user?.role === "client" ? 3 : user?.role === "office" ? 1 : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={isClient ? "Client desk" : "Command center"}
        title={`Good day, ${user?.fullName?.split(" ")[0]}`}
        subtitle={roleCopy[user?.role || "office"]}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="brand">{user?.portal} portal</Badge>
            <Link to="/themes">
              <Button type="button" variant="secondary" className="!text-xs">
                Themes A–H
              </Button>
            </Link>
            <Link to="/workspace">
              <Button type="button" className="!text-xs">
                Open workspaces
              </Button>
            </Link>
          </div>
        }
      />

      {isClient ? (
        <WorkflowStrip
          active={1}
          steps={[
            { label: "Project access", hint: "Assigned to your portal" },
            { label: "View drawings", hint: "Published GFC only" },
            { label: "Raise concerns", hint: "RFIs without upload" },
            { label: "Weekly packs", hint: "Reports & approved QA" },
          ]}
        />
      ) : (
        <WorkflowStrip
          active={flowActive}
          steps={[
            { label: "Upload drawings", hint: "GFC register + publish" },
            { label: "Assign checklist types", hint: "Per project catalog" },
            { label: "Engineer fills", hint: "Drawing + revision + Yes/No/N.A." },
            { label: "Approve & report", hint: "Client sees weekly pack" },
          ]}
        />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Projects" value={projects.length} hint="Assigned to your portal" />
        <Stat
          label="Drawings on demo"
          value={projects[0]?._count?.drawings ?? "—"}
          hint={isClient ? "View published sheets" : "Publish unlocks QA"}
        />
        <Stat label="Your role" value={(user?.role || "").replace("_", " ")} />
        <Stat label="UI" value="Designed" hint="No photo tiles in modules" />
      </div>

      {isClient && (
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { title: "Published drawings", desc: "Browse GFC register view-only", to: projects[0] ? `/projects/${projects[0].id}/drawings` : "/workspace" },
            { title: "Raise a concern", desc: "RFI-style client questions", to: projects[0] ? `/projects/${projects[0].id}/rfis` : "/workspace" },
            { title: "Reports & packs", desc: "Weekly / DPR visibility", to: projects[0] ? `/projects/${projects[0].id}/reports` : "/workspace" },
          ].map((c) => (
            <Link key={c.title} to={c.to}>
              <Card className="h-full hover:border-brand/40 transition">
                <div className="font-display text-lg">{c.title}</div>
                <p className="text-sm text-steel-muted mt-1.5">{c.desc}</p>
                <div className="mt-4 text-sm font-semibold text-brand">Open →</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

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
                    <div className="font-semibold text-lg mt-1 group-hover:text-brand-dark transition">{p.name}</div>
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
                  {isClient && <span className="text-brand">View only</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
