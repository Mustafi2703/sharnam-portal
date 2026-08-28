import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, WorkflowStrip } from "../components/ui";
import { ModuleIcon } from "../components/icons";
import { MasterCostTemplatesPanel } from "../components/MasterCostTemplatesPanel";
import { BbsShapeMasterPanel } from "../components/BbsShapeMasterPanel";
import { SiteFinalIndexPanel } from "../components/SiteFinalIndexPanel";
import SharePointStatusPanel from "../components/SharePointStatusPanel";
import {
  WORKSPACE_PROJECT_KEY,
  setActiveWorkspace,
  WORKSPACES,
  DEFAULT_ENABLED_MODULES,
  type WorkspaceKey,
} from "../workspaces";

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

const MASTER_TOOLS = [
  { id: "projects", label: "Projects" },
  { id: "directory", label: "Directory (4 users)" },
  { id: "vendors", label: "Company vendors" },
  { id: "roster", label: "PMC roster" },
  { id: "modules", label: "Module toggles" },
  { id: "global", label: "Global masters" },
  { id: "links", label: "CRM · HRM · Docs" },
] as const;

type MasterTab = (typeof MASTER_TOOLS)[number]["id"];

/** Master module — tool chips like Drawings / Quality */
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
  const [masterTab, setMasterTab] = useState<MasterTab>("projects");
  const canManage = user?.role === "admin" || user?.role === "office";

  const pmcUsers = useMemo(
    () => users.filter((u) => u.role === "admin" || u.role === "office" || u.role === "employee"),
    [users]
  );

  const dirProject = projects.find((p) => p.id === dirProjectId);

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
      setMsg(`Project ${created.code} created — build Directory (4 users), then open Dashboard.`);
      setMasterTab("directory");
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
        <Link to="/dashboard" className="text-brand font-semibold">
          Back to dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-canvas-wide">
      <PageHeader
        eyebrow="Master module"
        title="Project setup desk"
        subtitle="Master is a module with tools — like Drawings or Quality. Create projects, build the four-user directory, toggle modules, then open the ops dashboard."
        icon={<ModuleIcon name="master" size={20} className="text-white" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard">
              <Button type="button" variant="secondary">
                Ops dashboard
              </Button>
            </Link>
            <Link to="/workspace">
              <Button type="button">Modules →</Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {MASTER_TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMasterTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
              masterTab === t.id
                ? "bg-brand text-white border-brand"
                : "bg-paper border-line text-steel-muted hover:border-brand"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <WorkflowStrip
        active={projects.length ? (overview?.members?.length ? 2 : 1) : 0}
        steps={[
          { label: "Create project", hint: "Code + client" },
          { label: "Directory", hint: "Office · Site · Client · Contractor" },
          { label: "Toggle modules", hint: "Per project" },
          { label: "Dashboard → modules", hint: "Pilot verify" },
        ]}
      />

      {msg && <p className="text-sm rounded-xl px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}
      {dirMsg && <p className="text-sm rounded-xl px-3 py-2 bg-amber-50 text-warn border border-amber-200">{dirMsg}</p>}

      {masterTab === "projects" && (
        <div className="space-y-6">
          <Card>
            <h2 className="font-display text-xl mb-1">Create project</h2>
            <p className="text-sm text-steel-muted mb-4">Starts the spine — directory, matrix, drawings, and fills hang off it.</p>
            <form className="grid sm:grid-cols-2 gap-3" onSubmit={createProject}>
              <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input
                placeholder="Client"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              />
              <Input
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <Button type="submit" className="sm:col-span-2">
                Create project + seed Meeting/RFI matrix
              </Button>
            </form>
          </Card>

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
                    <button
                      type="button"
                      className="font-semibold text-brand"
                      onClick={() => {
                        setDirProjectId(p.id);
                        setMasterTab("directory");
                      }}
                    >
                      Edit directory
                    </button>
                    <Link to={`/projects/${p.id}/drawings`} className="font-semibold text-ink/80 hover:text-brand">
                      Drawings
                    </Link>
                    <Link to={`/dashboard`} className="font-semibold text-ink/80 hover:text-brand">
                      Dashboard
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
      )}

      {masterTab === "directory" && (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl">Four user kinds</h2>
              <p className="text-sm text-steel-muted mt-1">
                Sharnam Office · Site · Client · Contractor — assign people and parties. Full tools live on the project Directory page.
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

          {dirProject ? (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge tone="brand">{dirProject.code}</Badge>
                <Link to={`/projects/${dirProject.id}/directory?party=PMC`} className="font-semibold text-brand">
                  Office →
                </Link>
                <Link to={`/projects/${dirProject.id}/directory?party=Site`} className="font-semibold text-brand">
                  Site →
                </Link>
                <Link to={`/projects/${dirProject.id}/directory?party=Client`} className="font-semibold text-brand">
                  Client →
                </Link>
                <Link to={`/projects/${dirProject.id}/directory?party=Contractor`} className="font-semibold text-brand">
                  Contractor →
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
                  <h3 className="font-semibold text-sm">Assign contractor / party</h3>
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
                      setDirMsg("Party assigned to project directory.");
                      await loadDirectory(dirProject.id);
                    }}
                  >
                    <Select
                      className="min-w-[180px] flex-1"
                      value={vendorForm.vendorId}
                      onChange={(e) => setVendorForm({ ...vendorForm, vendorId: e.target.value })}
                      required
                    >
                      <option value="">Select party…</option>
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
                    {!overview?.vendors?.length && <li className="py-2 text-steel-muted text-xs">No parties yet</li>}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-steel-muted">Create or select a project to build its directory.</p>
          )}
        </Card>
      )}

      {masterTab === "roster" && (
        <Card>
          <h2 className="font-display text-xl mb-1">PMC roster</h2>
          <p className="text-sm text-steel-muted mb-4">Sharnam Office / admin / employee accounts from HRM.</p>
          <ul className="max-h-96 overflow-y-auto divide-y divide-line text-sm">
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
      )}

      {masterTab === "modules" && (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl">Module toggles</h2>
              <p className="text-sm text-steel-muted mt-1">Which modules appear on this project’s top bar.</p>
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
          {dirProject ? (
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
          ) : (
            <p className="text-sm text-steel-muted">Select a project.</p>
          )}
        </Card>
      )}

      {masterTab === "global" && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <SharePointStatusPanel token={token || undefined} />
          <MasterCostTemplatesPanel token={token} />
          <BbsShapeMasterPanel token={token} />
          <SiteFinalIndexPanel token={token} />
          {[
            {
              to: "/master/checklists?family=DrawingCheck",
              label: "Drawing-check master",
              hint: "Drawing check checklists · reused on every project",
              tag: "Checklists · Drawing",
            },
            {
              to: "/master/checklists?family=QualityInspection",
              label: "Quality (QI) checklist master",
              hint: "QI checklist templates — reused across all projects",
              tag: "Checklists · QI",
            },
            {
              to: "/master/checklists?family=Safety",
              label: "Safety checklist master",
              hint: "SPDC HSE pack (F-01/F-02/F-03) seed-ready — reused across all projects",
              tag: "Checklists · Safety",
            },
            {
              to: "/custom-sheets",
              label: "Sheet item templates",
              hint: "Formula sheets · clone · export (advanced editing)",
              tag: "Sheets",
            },
            {
              to: dirProjectId ? `/projects/${dirProjectId}/drawings` : "/projects",
              label: "GFC drawing register",
              hint: "Per-project drawing types · R0–R5 · markup upload",
              tag: "Project",
            },
            {
              to: dirProjectId ? `/projects/${dirProjectId}/cost?tab=boq` : "/projects",
              label: "Cost — BOQ per structure",
              hint: "Upload BOQ per project structure · MB/BBS from global master",
              tag: "Project",
            },
            {
              to: dirProjectId ? `/projects/${dirProjectId}/dms` : "/projects",
              label: "Document management",
              hint: "ISO folder tree · SharePoint sync",
              tag: "Project",
            },
          ].map((c) => (
            <Link key={c.label} to={c.to} className="block">
              <Card className="h-full hover:border-brand/50 transition !p-5">
                <div className="text-[10px] uppercase text-steel-muted tracking-wide">{c.tag}</div>
                <div className="font-display text-lg mt-0.5">{c.label}</div>
                <div className="text-sm text-steel-muted mt-1">{c.hint}</div>
                <div className="mt-3">
                  <Badge tone="brand">Manage</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {masterTab === "vendors" && (
        <Card className="!p-6">
          <h2 className="font-display text-xl mb-2">Company vendor directory</h2>
          <p className="text-sm text-steel-muted mb-4 max-w-2xl">
            Procore-style company records — contractor, vendor, client, consultant, PMC types with GST, license,
            prequalification flags. Create here once; assign to each project under Project → Vendors.
          </p>
          <Link to="/master/vendors">
            <Button type="button">Open company directory ({vendors.length} companies)</Button>
          </Link>
        </Card>
      )}

      {masterTab === "links" && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[
            { to: "/crm", label: "CRM / PMCs", hint: "Leads → projects" },
            { to: "/hrm", label: "HRM master", hint: `${users.length} people` },
            {
              to: dirProjectId ? `/projects/${dirProjectId}/dms` : "/projects",
              label: "Documents",
              hint: "Master DMS",
            },
            {
              to: dirProjectId ? `/projects/${dirProjectId}/comms` : "/projects",
              label: "Communication matrix",
              hint: "Meeting + RFI parties",
            },
            { to: "/dashboard", label: "Ops dashboard", hint: "Open RFIs · alerts" },
            { to: "/workspace", label: "Module select", hint: "After alerts" },
          ].map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className="block"
              onClick={() => {
                if (c.to.includes("/comms") && dirProjectId) setActiveWorkspace("comms");
              }}
            >
              <Card className="h-full hover:border-brand/50 transition !p-5">
                <div className="font-display text-lg">{c.label}</div>
                <div className="text-sm text-steel-muted mt-1">{c.hint}</div>
                <div className="mt-3">
                  <Badge tone="brand">Open</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
