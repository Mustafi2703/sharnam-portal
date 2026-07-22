import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, WorkflowStrip } from "../components/ui";
import { WORKSPACE_PROJECT_KEY, setActiveWorkspace } from "../workspaces";

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  clientName?: string;
  location?: string;
  _count?: { drawings: number; members: number };
};

/**
 * Master module — project setup, HRM, CRM, master docs, and RFI type guidance.
 * Office / admin land here after Master login.
 */
export default function MasterModulePage() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [hrmCount, setHrmCount] = useState(0);
  const [form, setForm] = useState({ code: "", name: "", clientName: "", location: "" });
  const [msg, setMsg] = useState("");
  const canManage = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [p, emp] = await Promise.all([
      api<Project[]>("/api/projects", { token }),
      api<any[]>("/api/hrm/employees", { token }).catch(() => []),
    ]);
    setProjects(p);
    setHrmCount(emp.length);
  };

  useEffect(() => {
    void load();
  }, [token]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const created = await api<Project>("/api/projects", { method: "POST", token, body: JSON.stringify(form) });
      setForm({ code: "", name: "", clientName: "", location: "" });
      localStorage.setItem(WORKSPACE_PROJECT_KEY, created.id);
      setMsg(`Project ${created.code} created — assign HR and open Documents next.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!canManage) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h1 className="font-display text-2xl">Master module</h1>
        <p className="text-steel-muted text-sm">Only Sharnam Office / Admin can open Master setup.</p>
        <Link to="/workspace" className="text-brand font-semibold">
          Back to workspace →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Master module"
        title="Project control centre"
        subtitle="Set up projects, assign people in HRM, keep master documents, and run the right RFI type — PMC Request for Information, Drawing checklist fill, or Quality Inspection fill (separate)."
        actions={<Badge tone="brand">Office / Admin</Badge>}
      />

      <WorkflowStrip
        active={projects.length ? (hrmCount ? 2 : 1) : 0}
        steps={[
          { label: "Create project", hint: "Code · client · site" },
          { label: "HRM assign", hint: "People on project" },
          { label: "Documents", hint: "Master docs in DMS" },
          { label: "RFIs & fills", hint: "PMC · Drawing · QI" },
        ]}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: "/projects", label: "Projects", hint: `${projects.length} live`, tone: "brand" as const },
          { to: "/hrm", label: "HR / Directory", hint: `${hrmCount} people`, tone: "ok" as const },
          { to: "/crm", label: "CRM", hint: "Leads → projects", tone: "neutral" as const },
          {
            to: projects[0] ? `/projects/${projects[0].id}/dms` : "/projects",
            label: "Master documents",
            hint: "DMS per project",
            tone: "brand" as const,
          },
        ].map((c) => (
          <Link key={c.to + c.label} to={c.to} className="block">
            <Card className="h-full hover:border-brand/50 transition !p-5">
              <div className="font-display text-lg">{c.label}</div>
              <div className="text-sm text-steel-muted mt-1">{c.hint}</div>
              <div className="mt-3">
                <Badge tone={c.tone}>Open</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <h2 className="font-display text-xl mb-1">Create project</h2>
        <p className="text-sm text-steel-muted mb-4">Master setup starts here — then assign staff in HRM and upload docs.</p>
        <form className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3" onSubmit={createProject}>
          <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Client" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Button type="submit">Create project</Button>
        </form>
        {msg && <p className="text-sm text-steel-muted mt-3">{msg}</p>}
      </Card>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Three RFI types</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="!p-5 border-brand/30">
            <Badge tone="brand">PMC</Badge>
            <h3 className="font-display text-lg mt-3">Request for Information</h3>
            <p className="text-sm text-steel-muted mt-2 leading-relaxed">
              Classic RFI — PMC / office raises for design or site clarification. Matrix parties respond and close.
            </p>
            <Link
              to={projects[0] ? `/projects/${projects[0].id}/rfis?kind=RequestForInformation` : "/projects"}
              className="inline-block mt-4 text-sm font-semibold text-brand"
              onClick={() => projects[0] && localStorage.setItem(WORKSPACE_PROJECT_KEY, projects[0].id)}
            >
              Open PMC RFIs →
            </Link>
          </Card>
          <Card className="!p-5 border-mark/30">
            <Badge tone="warn">Drawing</Badge>
            <h3 className="font-display text-lg mt-3">Drawing checklist fill</h3>
            <p className="text-sm text-steel-muted mt-2 leading-relaxed">
              After docs / checklists are on the project, raise this RFI so matrix parties and the responsible vendor fill the checklist.
            </p>
            <Link
              to={projects[0] ? `/projects/${projects[0].id}/rfis?kind=DrawingChecklist` : "/projects"}
              className="inline-block mt-4 text-sm font-semibold text-mark"
            >
              Open drawing fill RFIs →
            </Link>
          </Card>
          <Card className="!p-5 border-ok/40">
            <Badge tone="ok">Quality</Badge>
            <h3 className="font-display text-lg mt-3">Quality Inspection RFI</h3>
            <p className="text-sm text-steel-muted mt-2 leading-relaxed">
              Separate from drawing fills — used only for QI checklist / inspection form completion.
            </p>
            <Link
              to={projects[0] ? `/projects/${projects[0].id}/rfis?kind=QualityInspection` : "/projects"}
              className="inline-block mt-4 text-sm font-semibold text-ok"
              onClick={() => {
                setActiveWorkspace("quality");
                if (projects[0]) localStorage.setItem(WORKSPACE_PROJECT_KEY, projects[0].id);
              }}
            >
              Open QI fill RFIs →
            </Link>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl">Projects & master documents</h2>
          <Link to="/hrm" className="text-sm font-semibold text-brand">
            Assign people in HRM →
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Card key={p.id} className="!p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] text-brand">{p.code}</div>
                  <div className="font-display text-lg mt-1">{p.name}</div>
                  <div className="text-sm text-steel-muted mt-1">
                    {p.clientName || "—"}
                    {p.location ? ` · ${p.location}` : ""}
                  </div>
                </div>
                <Badge tone="ok">{p.status}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link
                  to={`/projects/${p.id}/dms`}
                  className="font-semibold text-brand"
                  onClick={() => {
                    localStorage.setItem(WORKSPACE_PROJECT_KEY, p.id);
                    setActiveWorkspace("drawings");
                  }}
                >
                  Documents
                </Link>
                <Link to={`/projects/${p.id}/directory`} className="font-semibold text-ink/80 hover:text-brand">
                  Directory
                </Link>
                <Link to={`/projects/${p.id}/comms`} className="font-semibold text-ink/80 hover:text-brand">
                  Matrix
                </Link>
                <Link to={`/projects/${p.id}`} className="font-semibold text-ink/80 hover:text-brand">
                  Open tools
                </Link>
              </div>
              <div className="mt-3 font-mono text-[11px] text-steel-muted">
                {p._count?.drawings ?? 0} drawings · {p._count?.members ?? 0} members
              </div>
            </Card>
          ))}
          {!projects.length && <p className="text-sm text-steel-muted">No projects yet — create one above.</p>}
        </div>
      </section>

      <Card className="bg-brand-soft/50 border-brand/20">
        <h3 className="font-display text-lg">Module logins</h3>
        <p className="text-sm text-steel-muted mt-2 leading-relaxed">
          Everyone signs into the module they manage: Master · Drawings & Documents · Quality · Comms · Field · plus Client / Vendor /
          Site doors. Pick a UI style on /options first, then use the matching login.
        </p>
        <Link to="/login" className="inline-block mt-3 text-sm font-semibold text-brand">
          View all module logins →
        </Link>
      </Card>
    </div>
  );
}
