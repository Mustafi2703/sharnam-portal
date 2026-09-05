import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, WorkflowStrip } from "../components/ui";
import { ModuleIcon } from "../components/icons";
import {
  DirectoryCompaniesPanel,
  DirectoryPeoplePanel,
  DIRECTORY_TAB_META,
} from "./crm/CrmDirectoryPage";
import {
  WORKSPACE_PROJECT_KEY,
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
  _count?: { drawings: number; members: number };
};

const DIRECTORY_TABS = [
  { id: "people", label: "People & portal" },
  { id: "clients", label: "Clients" },
  { id: "vendors", label: "Vendors & contractors" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "projects", label: "Projects" },
  { id: "modules", label: "Module toggles" },
  { id: "checklists", label: "Checklist masters" },
] as const;

type DirectoryTab = (typeof DIRECTORY_TABS)[number]["id"];

const CHECKLIST_MASTERS = [
  {
    to: "/master/checklists?family=DrawingCheck",
    label: "Drawing-check master",
    hint: "Pre-upload drawing review checklists — every project",
    tag: "Drawings",
  },
  {
    to: "/master/checklists?family=QualityInspection",
    label: "Quality (QI) master",
    hint: "SPDC F-01 inspection templates",
    tag: "Quality",
  },
  {
    to: "/master/checklists?family=Safety",
    label: "Safety checklist master",
    hint: "SPDC HSE pack F-01 / F-02 / F-03",
    tag: "Safety",
  },
  {
    to: "/master/checklists?family=SiteExecution",
    label: "Site execution master",
    hint: "Activity F-02 site checklists",
    tag: "Quality · Site",
  },
] as const;

/** Sharnam PMC company directory — clients, vendors, stakeholders, people, projects. */
export default function MasterModulePage() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as DirectoryTab | null;
  const [projects, setProjects] = useState<Project[]>([]);
  const [dirProjectId, setDirProjectId] = useState("");
  const [form, setForm] = useState({ code: "", name: "", clientName: "", location: "" });
  const [msg, setMsg] = useState("");
  const [dirMsg, setDirMsg] = useState("");
  const canManage = user?.role === "admin" || user?.role === "office";

  const directoryTab: DirectoryTab =
    tabParam && DIRECTORY_TABS.some((t) => t.id === tabParam) ? tabParam : "people";

  const dirProject = projects.find((p) => p.id === dirProjectId);
  const directoryMeta = DIRECTORY_TAB_META[directoryTab] || DIRECTORY_TAB_META.people;

  const load = async () => {
    const p = await api<Project[]>("/api/projects", { token });
    setProjects(p);
    if (!dirProjectId && p[0]) setDirProjectId(p[0].id);
  };

  useEffect(() => {
    void load();
  }, [token]);

  function setDirectoryTab(id: DirectoryTab) {
    setSearchParams({ tab: id }, { replace: true });
  }

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const created = await api<Project>("/api/projects", { method: "POST", token, body: JSON.stringify(form) });
      setForm({ code: "", name: "", clientName: "", location: "" });
      localStorage.setItem(WORKSPACE_PROJECT_KEY, created.id);
      setDirProjectId(created.id);
      setMsg(`Project ${created.code} created — assign directory and toggle modules.`);
      setDirectoryTab("modules");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!canManage) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <h1 className="font-display text-2xl">Directory</h1>
        <p className="text-steel-muted text-sm">Only Sharnam Office / Admin can open the company directory.</p>
        <Link to="/dashboard" className="text-brand font-semibold">
          Back to dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="master-module page-scroll-full space-y-6 min-w-0 pb-8 w-full">
      <PageHeader
        eyebrow="Sharnam PMC · Directory"
        title="Company directory"
        subtitle="Maintain clients, vendors, stakeholders, and portal logins. CRM holds client pipeline data; Bid management holds contractor packages. MB / BBS / shape codes are per project under Cost."
        icon={<ModuleIcon name="master" size={20} className="text-white" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/crm/leads">
              <Button type="button" variant="secondary">
                CRM · Leads
              </Button>
            </Link>
            <Link to="/crm/bids">
              <Button type="button" variant="secondary">
                Bid management
              </Button>
            </Link>
            <Link to="/login/hr">
              <Button type="button" variant="secondary">
                HR portal
              </Button>
            </Link>
            <Link to="/custom-sheets">
              <Button type="button" variant="secondary">
                Custom sheets
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {DIRECTORY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDirectoryTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
              directoryTab === t.id
                ? "bg-brand text-white border-brand"
                : "bg-paper border-line text-steel-muted hover:border-brand"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <WorkflowStrip
        active={1}
        steps={[
          { label: "CRM · Convert lead", hint: "Client + project spine" },
          { label: "Directory", hint: "Clients · vendors · people" },
          { label: "Project modules", hint: "Cost MB/BBS per project" },
          { label: "Pilot on dashboard", hint: "Verify RFIs · quality" },
        ]}
      />

      {msg && <p className="text-sm rounded-xl px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}
      {dirMsg && <p className="text-sm rounded-xl px-3 py-2 bg-amber-50 text-warn border border-amber-200">{dirMsg}</p>}

      {["people", "clients", "vendors", "stakeholders"].includes(directoryTab) && (
        <div className="space-y-3">
          <Card className="!p-4 bg-sand/30 border-line">
            <p className="text-sm text-steel-muted">
              <span className="font-semibold text-ink">{directoryMeta.title}</span> — {directoryMeta.subtitle}
            </p>
          </Card>
          {directoryTab === "people" ? (
            <DirectoryPeoplePanel token={token} canEdit={canManage} />
          ) : (
            <DirectoryCompaniesPanel
              tab={directoryTab as "clients" | "vendors" | "stakeholders"}
              token={token}
              canEdit={canManage}
            />
          )}
        </div>
      )}

      {directoryTab === "projects" && (
        <div className="space-y-6">
          <Card className="!p-5 border-brand/30 bg-brand-soft/40">
            <h2 className="font-display text-lg mb-1">Recommended: CRM → Convert lead</h2>
            <p className="text-sm text-steel-muted mb-3">
              Creates the delivery project with client card, team, vendors, bid disciplines, and comms matrix.
            </p>
            <Link to="/crm/leads">
              <Button type="button">Open CRM leads →</Button>
            </Link>
          </Card>

          <Card>
            <h2 className="font-display text-xl mb-1">Quick create (office)</h2>
            <p className="text-sm text-steel-muted mb-4">Bare project when you skip CRM — still seeds sheets and matrix.</p>
            <form className="grid sm:grid-cols-2 gap-3" onSubmit={createProject}>
              <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder="Client" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
              <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <Button type="submit" className="sm:col-span-2">
                Create project
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
                    <Link to={`/projects/${p.id}`} className="font-semibold text-brand">
                      Open project →
                    </Link>
                    <Link to={`/projects/${p.id}/directory`} className="font-semibold text-brand">
                      Project directory →
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

      {directoryTab === "modules" && (
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
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                      on ? "bg-brand text-white border-brand" : "bg-paper border-line text-steel-muted hover:border-brand"
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

      {directoryTab === "checklists" && (
        <div className="space-y-4">
          <Card className="!p-4 bg-sand/30 border-line">
            <p className="text-sm text-steel-muted">
              Org-wide checklist line libraries — assign to projects from each module’s checklist master.{" "}
              <strong className="text-ink">MB / BBS templates</strong> upload per project on{" "}
              <span className="font-medium">Cost → MB / BBS</span>; shape codes on{" "}
              <span className="font-medium">Cost → BBS</span>.
            </p>
          </Card>
          <div className="grid sm:grid-cols-2 xl:grid-cols-2 gap-4">
            {CHECKLIST_MASTERS.map((c) => (
              <Link key={c.label} to={c.to} className="block">
                <Card className="h-full hover:border-brand/50 transition !p-5">
                  <div className="text-[10px] uppercase text-steel-muted tracking-wide">{c.tag}</div>
                  <div className="font-display text-lg mt-0.5">{c.label}</div>
                  <div className="text-sm text-steel-muted mt-1">{c.hint}</div>
                  <div className="mt-3">
                    <Badge tone="brand">Open master →</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
