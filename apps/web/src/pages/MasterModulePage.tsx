import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, WorkflowStrip } from "../components/ui";
import { WORKSPACE_PROJECT_KEY, setActiveWorkspace, WORKSPACES, DEFAULT_ENABLED_MODULES, type WorkspaceKey } from "../workspaces";

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  clientName?: string;
  location?: string;
  enabledModules?: string;
  workPackages?: string;
  _count?: { drawings: number; members: number };
};

type UserRow = { id: string; fullName: string; email: string; role: string; portal?: string };
type VendorRow = { id: string; name: string; trade?: string };

/**
 * Master module — projects, PMC roster, per-project directory, docs, RFI guidance.
 */
export default function MasterModulePage() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [dirProjectId, setDirProjectId] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [form, setForm] = useState({ code: "", name: "", clientName: "", location: "" });
  const [memberForm, setMemberForm] = useState({ userId: "", role: "project_manager" });
  const [vendorForm, setVendorForm] = useState({ vendorId: "", tradeRole: "" });
  const [msg, setMsg] = useState("");
  const [dirMsg, setDirMsg] = useState("");
  const canManage = user?.role === "admin" || user?.role === "office";

  const pmcUsers = useMemo(
    () => users.filter((u) => u.role === "admin" || u.role === "office" || u.role === "employee"),
    [users]
  );

  const load = async () => {
    const [p, u, v] = await Promise.all([
      api<Project[]>("/api/projects", { token }),
      api<UserRow[]>("/api/users", { token }).catch(() => []),
      api<VendorRow[]>("/api/vendors", { token }).catch(() => []),
    ]);
    setProjects(p);
    setUsers(u);
    setVendors(v);
    if (!dirProjectId && p[0]) setDirProjectId(p[0].id);
  };

  const loadDirectory = async (projectId: string) => {
    if (!projectId) {
      setOverview(null);
      return;
    }
    const o = await api(`/api/directory/project/${projectId}/overview`, { token });
    setOverview(o);
  };

  useEffect(() => {
    void load();
  }, [token]);

  useEffect(() => {
    if (dirProjectId) void loadDirectory(dirProjectId);
  }, [dirProjectId, token]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const created = await api<Project>("/api/projects", { method: "POST", token, body: JSON.stringify(form) });
      setForm({ code: "", name: "", clientName: "", location: "" });
      localStorage.setItem(WORKSPACE_PROJECT_KEY, created.id);
      setDirProjectId(created.id);
      setMsg(`Project ${created.code} created — build its directory below, then seed Meeting + RFI matrix.`);
      await load();
      await api(`/api/comms/matrix/${created.id}/seed-standard`, { method: "POST", token }).catch(() => null);
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

  const dirProject = projects.find((p) => p.id === dirProjectId);

  return (
    <div className="space-y-10 page-canvas-wide">
      <PageHeader
        eyebrow="Master module"
        title="Project control centre"
        subtitle="Create projects, manage the PMC roster, build each project directory, keep documents, and run Meeting + RFI matrices. Checklist fills use Drawing or QI fill RFIs against the latest drawing revision."
        actions={<Badge tone="brand">Office / Admin</Badge>}
      />

      <WorkflowStrip
        active={projects.length ? (overview?.members?.length ? 2 : 1) : 0}
        steps={[
          { label: "Create project", hint: "Code · client · site" },
          { label: "Project directory", hint: "PMC · staff · vendors" },
          { label: "Matrix", hint: "Meeting + RFI parties" },
          { label: "Drawings & fills", hint: "Checklist + fill RFI" },
        ]}
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { to: "/projects", label: "Projects", hint: `${projects.length} live`, tone: "brand" as const },
          { to: "/hrm", label: "HRM master", hint: `${users.length} people`, tone: "ok" as const },
          { to: "/crm", label: "CRM / PMCs", hint: "Leads → projects", tone: "neutral" as const },
          {
            to: dirProjectId ? `/projects/${dirProjectId}/directory` : "/projects",
            label: "Directories",
            hint: "Per-project roster",
            tone: "brand" as const,
          },
          {
            to: dirProjectId ? `/projects/${dirProjectId}/dms` : "/projects",
            label: "Documents",
            hint: "Master DMS",
            tone: "ok" as const,
          },
        ].map((c) => (
          <Link key={c.label} to={c.to} className="block">
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

      <div className="grid xl:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-display text-xl mb-1">Create project</h2>
          <p className="text-sm text-steel-muted mb-4">Starts the spine — directory, matrix, drawings, and fills hang off it.</p>
          <form className="grid sm:grid-cols-2 gap-3" onSubmit={createProject}>
            <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input placeholder="Client" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Button type="submit" className="sm:col-span-2">
              Create project + seed Meeting/RFI matrix
            </Button>
          </form>
          {msg && <p className="text-sm text-steel-muted mt-3">{msg}</p>}
        </Card>

        <Card>
          <h2 className="font-display text-xl mb-1">PMC roster</h2>
          <p className="text-sm text-steel-muted mb-4">Sharnam PMC / office / consultant accounts from the master directory.</p>
          <ul className="max-h-64 overflow-y-auto divide-y divide-line text-sm">
            {pmcUsers.map((u) => (
              <li key={u.id} className="py-2.5 flex justify-between gap-3">
                <div>
                  <div className="font-semibold">{u.fullName}</div>
                  <div className="text-xs text-steel-muted font-mono">{u.email}</div>
                </div>
                <Badge tone="neutral">{u.role}</Badge>
              </li>
            ))}
            {!pmcUsers.length && <li className="py-4 text-steel-muted">No PMC users yet — add in HRM.</li>}
          </ul>
          <Link to="/hrm" className="inline-block mt-3 text-sm font-semibold text-brand">
            Manage HRM master →
          </Link>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl">Create / edit project directory</h2>
            <p className="text-sm text-steel-muted mt-1">
              Assign PMC, site, consultants, and vendors to a project. This roster feeds the Communication Matrix and fill RFIs.
            </p>
          </div>
          <Select className="min-w-[220px]" value={dirProjectId} onChange={(e) => setDirProjectId(e.target.value)}>
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
        </div>

        {dirProject && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="brand">{dirProject.code}</Badge>
              <Link to={`/projects/${dirProject.id}/directory`} className="font-semibold text-brand">
                Full directory →
              </Link>
              <Link
                to={`/projects/${dirProject.id}/comms`}
                className="font-semibold text-ink/80 hover:text-brand"
                onClick={() => {
                  localStorage.setItem(WORKSPACE_PROJECT_KEY, dirProject.id);
                  setActiveWorkspace("comms");
                }}
              >
                Communication matrix →
              </Link>
              <Button
                type="button"
                variant="secondary"
                className="!text-xs"
                onClick={async () => {
                  const r = await api<{ created: number }>(`/api/comms/matrix/${dirProject.id}/seed-standard`, {
                    method: "POST",
                    token,
                  });
                  setDirMsg(`Seeded ${r.created} Meeting / RFI matrix row(s).`);
                }}
              >
                Seed Meeting + RFI matrix
              </Button>
            </div>

            <div className="border border-line rounded-[var(--ui-radius)] p-4 bg-sand/30 space-y-3">
              <h3 className="font-semibold text-sm">Enabled modules</h3>
              <p className="text-xs text-steel-muted">
                Office controls which Procore-style modules appear on this project’s top bar.
              </p>
              <div className="flex flex-wrap gap-2">
                {WORKSPACES.map((w) => {
                  let enabled: WorkspaceKey[] = DEFAULT_ENABLED_MODULES;
                  try {
                    if (dirProject.enabledModules != null && dirProject.enabledModules !== "") {
                      const parsed = JSON.parse(dirProject.enabledModules);
                      if (Array.isArray(parsed)) enabled = parsed as WorkspaceKey[];
                    }
                  } catch {
                    /* ignore */
                  }
                  const on = enabled.includes(w.key);
                  return (
                    <button
                      key={w.key}
                      type="button"
                      className={`px-3 py-1.5 text-xs font-semibold border rounded-sm ${
                        on ? "bg-brand text-white border-brand" : "bg-white border-line text-steel-muted"
                      }`}
                      onClick={async () => {
                        const next = on ? enabled.filter((k) => k !== w.key) : [...enabled, w.key];
                        const updated = await api<Project>(`/api/progress/${dirProject.id}/modules`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ enabledModules: next }),
                        });
                        setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
                        setDirMsg(`Modules updated for ${dirProject.code}.`);
                      }}
                    >
                      {w.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="border border-line rounded-[var(--ui-radius)] p-4 space-y-3 bg-sand/30">
                <h3 className="font-semibold text-sm">Assign person</h3>
                <form
                  className="flex flex-wrap gap-2 items-end"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setDirMsg("");
                    await api(`/api/projects/${dirProject.id}/members`, {
                      method: "POST",
                      token,
                      body: JSON.stringify(memberForm),
                    });
                    setDirMsg("Person assigned to project directory.");
                    await loadDirectory(dirProject.id);
                    await load();
                  }}
                >
                  <Select
                    className="min-w-[180px] flex-1"
                    value={memberForm.userId}
                    onChange={(e) => setMemberForm({ ...memberForm, userId: e.target.value })}
                    required
                  >
                    <option value="">Select user…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} · {u.role}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={memberForm.role}
                    onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                  >
                    <option value="project_manager">Project Manager</option>
                    <option value="site_engineer">Site Engineer</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </Select>
                  <Button type="submit">Assign</Button>
                </form>
                <ul className="text-sm divide-y divide-line max-h-40 overflow-y-auto">
                  {(overview?.members || []).map((m: any) => (
                    <li key={m.id} className="py-2 flex justify-between gap-2">
                      <span>{m.user?.fullName}</span>
                      <span className="text-xs text-steel-muted">{m.role}</span>
                    </li>
                  ))}
                  {!overview?.members?.length && <li className="py-2 text-steel-muted text-xs">No members yet</li>}
                </ul>
              </div>

              <div className="border border-line rounded-[var(--ui-radius)] p-4 space-y-3 bg-sand/30">
                <h3 className="font-semibold text-sm">Assign vendor</h3>
                <form
                  className="flex flex-wrap gap-2 items-end"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setDirMsg("");
                    await api(`/api/vendors/project/${dirProject.id}/assign`, {
                      method: "POST",
                      token,
                      body: JSON.stringify(vendorForm),
                    });
                    setVendorForm({ vendorId: "", tradeRole: "" });
                    setDirMsg("Vendor assigned to project directory.");
                    await loadDirectory(dirProject.id);
                  }}
                >
                  <Select
                    className="min-w-[180px] flex-1"
                    value={vendorForm.vendorId}
                    onChange={(e) => setVendorForm({ ...vendorForm, vendorId: e.target.value })}
                    required
                  >
                    <option value="">Select vendor…</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    placeholder="Trade role"
                    value={vendorForm.tradeRole}
                    onChange={(e) => setVendorForm({ ...vendorForm, tradeRole: e.target.value })}
                  />
                  <Button type="submit">Assign</Button>
                </form>
                <ul className="text-sm divide-y divide-line max-h-40 overflow-y-auto">
                  {(overview?.vendors || []).map((row: any) => (
                    <li key={row.id} className="py-2 flex justify-between gap-2">
                      <span>{row.vendor?.name || row.name}</span>
                      <span className="text-xs text-steel-muted">{row.tradeRole || "—"}</span>
                    </li>
                  ))}
                  {!overview?.vendors?.length && <li className="py-2 text-steel-muted text-xs">No vendors yet</li>}
                </ul>
              </div>
            </div>
            {dirMsg && <p className="text-sm text-ok">{dirMsg}</p>}
          </div>
        )}
        {!dirProject && <p className="text-sm text-steel-muted">Create or select a project to build its directory.</p>}
      </Card>

      <section className="space-y-4">
        <h2 className="font-display text-xl">RFI types</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="!p-5 border-brand/30">
            <Badge tone="brand">PMC</Badge>
            <h3 className="font-display text-lg mt-3">Request for Information</h3>
            <p className="text-sm text-steel-muted mt-2 leading-relaxed">
              Classic clarification RFI. Matrix Meeting/RFI parties respond and close.
            </p>
          </Card>
          <Card className="!p-5 border-mark/30">
            <Badge tone="warn">Drawing</Badge>
            <h3 className="font-display text-lg mt-3">Checklist fill (latest rev)</h3>
            <p className="text-sm text-steel-muted mt-2 leading-relaxed">
              From Drawings: browse sheet → upload checklist → raise fill RFI against the latest revision for matrix / vendor.
            </p>
            <Link
              to={dirProjectId ? `/projects/${dirProjectId}/drawings` : "/projects"}
              className="inline-block mt-4 text-sm font-semibold text-mark"
              onClick={() => dirProjectId && setActiveWorkspace("drawings")}
            >
              Open drawings →
            </Link>
          </Card>
          <Card className="!p-5 border-ok/40">
            <Badge tone="ok">Quality</Badge>
            <h3 className="font-display text-lg mt-3">Quality Inspection RFI</h3>
            <p className="text-sm text-steel-muted mt-2 leading-relaxed">Separate QI / inspection fill flow only.</p>
            <Link
              to={dirProjectId ? `/projects/${dirProjectId}/rfis?kind=QualityInspection` : "/projects"}
              className="inline-block mt-4 text-sm font-semibold text-ok"
              onClick={() => setActiveWorkspace("quality")}
            >
              Open QI RFIs →
            </Link>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl">All projects</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                <button type="button" className="font-semibold text-brand" onClick={() => setDirProjectId(p.id)}>
                  Edit directory
                </button>
                <Link to={`/projects/${p.id}/dms`} className="font-semibold text-ink/80 hover:text-brand">
                  Documents
                </Link>
                <Link to={`/projects/${p.id}/drawings`} className="font-semibold text-ink/80 hover:text-brand">
                  Drawings
                </Link>
                <Link to={`/projects/${p.id}/comms`} className="font-semibold text-ink/80 hover:text-brand">
                  Matrix
                </Link>
              </div>
              <div className="mt-3 font-mono text-[11px] text-steel-muted">
                {p._count?.drawings ?? 0} drawings · {p._count?.members ?? 0} members
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
