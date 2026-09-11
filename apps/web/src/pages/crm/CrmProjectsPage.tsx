import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { CrmProjectsRegister, type CrmProjectRow } from "../../components/CrmProjectsRegister";
import { Badge, Button, Card, Input } from "../../components/ui";
import { openModuleToolWindow } from "../../lib/moduleToolWindow";
import { CRM_ACCENT, CRM_SOFT } from "./crmNav";

const EMPTY = {
  code: "",
  name: "",
  clientName: "",
  clientContactName: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  location: "",
  designConsultant: "",
  contractorName: "",
};

type HubCard = {
  label: string;
  blurb: string;
  href: string;
  n: string;
};

function openBox(href: string, label: string) {
  const w = openModuleToolWindow(href, label);
  if (!w) window.location.assign(href);
}

export default function CrmProjectsPage() {
  const { token, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const canManage = user?.role === "admin" || user?.role === "office";
  const showCreate = params.get("create") === "1";

  const [projects, setProjects] = useState<CrmProjectRow[]>([]);
  const [selected, setSelected] = useState<CrmProjectRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editProject, setEditProject] = useState<CrmProjectRow | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const rows = await api<CrmProjectRow[]>("/api/projects", { token });
    setProjects(rows);
    setSelected((cur) => (cur ? rows.find((p) => p.id === cur.id) || cur : rows[0] || null));
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setMsg("");
    try {
      const created = await api<CrmProjectRow>("/api/projects", {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setForm(EMPTY);
      setParams({}, { replace: true });
      await load();
      setSelected(created);
      setMsg(`Project ${created.code} created. Open setup to add parties, comms, and portals.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  const pipeline: HubCard[] = [
    {
      n: "01",
      label: "Create project",
      blurb: "New delivery project — code, client, location, consultant, contractor.",
      href: "/crm/projects?create=1",
    },
    {
      n: "02",
      label: "Project setup",
      blurb: "Parties, communication matrix, folders, client / contractor portals, first DPR / WPR.",
      href: selected ? `/crm/setup?projectId=${selected.id}&step=project` : "/crm/setup",
    },
    {
      n: "03",
      label: "Convert lead",
      blurb: "Spin a project from the CRM lead register.",
      href: "/crm/leads",
    },
    {
      n: "04",
      label: "Comparative bids",
      blurb: "R2 discipline BOQs, L1 award.",
      href: selected ? `/crm/bids?projectId=${selected.id}` : "/crm/bids",
    },
    {
      n: "05",
      label: "Directories",
      blurb: "Vendors, clients, consultants, portal people.",
      href: "/crm/directory/vendors",
    },
    {
      n: "06",
      label: "Proposals",
      blurb: "PMC quotation register.",
      href: "/crm/proposals",
    },
  ];

  const projectTools: HubCard[] = selected
    ? [
        { n: "01", label: "Project desk", blurb: "Overview and module shortcuts.", href: `/projects/${selected.id}` },
        { n: "02", label: "DPR maker", blurb: "Daily progress from registers.", href: `/projects/${selected.id}/dpr-maker` },
        { n: "03", label: "WPR maker", blurb: "Weekly pack, charts, sign-off.", href: `/projects/${selected.id}/wpr-maker` },
        { n: "04", label: "Progress", blurb: "PvA, manpower, hindrance, cashflow.", href: `/projects/${selected.id}/hub/progress` },
        { n: "05", label: "Quality", blurb: "QAP, NCR, cubes, checklists.", href: `/projects/${selected.id}/hub/quality` },
        { n: "06", label: "Drawings", blurb: "GFC / DCI register and files.", href: `/projects/${selected.id}/hub/drawings` },
        { n: "07", label: "Cost", blurb: "Budget, MB, BBS, cashflow.", href: `/projects/${selected.id}/hub/cost` },
        { n: "08", label: "Comms", blurb: "Matrix and meeting desk.", href: `/projects/${selected.id}/comms` },
        { n: "09", label: "Safety", blurb: "HSE records and permits.", href: `/projects/${selected.id}/hub/safety` },
        { n: "10", label: "Setup this project", blurb: "Parties, matrix, portals.", href: `/crm/setup?projectId=${selected.id}&step=matrix` },
      ]
    : [];

  return (
    <div className="space-y-5 p-4 sm:p-5 pb-8 min-w-0">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wide text-steel-muted">CRM · projects</p>
        <h2 className="font-display text-lg text-ink">Projects</h2>
        <p className="text-xs text-steel-muted mt-1 max-w-3xl leading-relaxed">
          Every delivery project and its client card. Open a box like a project module — it launches in a tool window.
          Select a row to unlock DPR, WPR, and the rest of the site desk.
        </p>
      </div>

      {msg && <p className="text-sm text-ok leading-relaxed">{msg}</p>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {pipeline.map((card) => (
          <button
            key={card.n + card.label}
            type="button"
            className="text-left h-full rounded-xl border border-line bg-paper p-4 sm:p-5 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-brand/50"
            onClick={() => {
              if (card.href.includes("create=1")) {
                setParams({ create: "1" }, { replace: true });
                return;
              }
              openBox(card.href, card.label);
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md"
                style={{ background: CRM_SOFT, color: CRM_ACCENT }}
              >
                Tool {card.n}
              </span>
              <span className="text-xs text-steel-muted">Open →</span>
            </div>
            <h3 className="font-display text-base text-ink mb-1">{card.label}</h3>
            <p className="text-xs text-steel-muted leading-relaxed">{card.blurb}</p>
          </button>
        ))}
      </div>

      {showCreate && canManage && (
        <Card className="!p-4 space-y-3 border-brand/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm">New delivery project</h3>
              <p className="text-xs text-steel-muted">Creates the project row. Next step is Project setup for matrix and portals.</p>
            </div>
            <Button type="button" variant="ghost" className="!text-xs" onClick={() => setParams({}, { replace: true })}>
              Close
            </Button>
          </div>
          <form className="grid sm:grid-cols-2 gap-2" onSubmit={createProject}>
            <Input required placeholder="Project code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Input required placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Client organisation" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            <Input required placeholder="Client location (site / city)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Client contact" value={form.clientContactName} onChange={(e) => setForm({ ...form, clientContactName: e.target.value })} />
            <Input type="email" placeholder="Client email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} />
            <Input placeholder="Client phone" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} />
            <Input placeholder="Client office address" value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} />
            <Input placeholder="Design consultant" value={form.designConsultant} onChange={(e) => setForm({ ...form, designConsultant: e.target.value })} />
            <Input placeholder="Main contractor" value={form.contractorName} onChange={(e) => setForm({ ...form, contractorName: e.target.value })} />
            <Button type="submit" className="sm:col-span-2" disabled={busy}>
              Create project
            </Button>
          </form>
        </Card>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{selected.code}</Badge>
            <span className="font-medium text-sm">{selected.name}</span>
            <span className="text-xs text-steel-muted">
              {selected.clientName || "—"} · {selected.location || "no location"}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {projectTools.map((card) => (
              <button
                key={card.n + card.label}
                type="button"
                className="text-left h-full rounded-xl border border-line bg-paper p-4 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-brand/50"
                onClick={() => openBox(card.href, `${selected.code} ${card.label}`)}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-md"
                    style={{ background: CRM_SOFT, color: CRM_ACCENT }}
                  >
                    {card.n}
                  </span>
                  <span className="text-xs text-steel-muted">Open →</span>
                </div>
                <h3 className="font-semibold text-sm text-ink mb-1">{card.label}</h3>
                <p className="text-xs text-steel-muted leading-relaxed">{card.blurb}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <CrmProjectsRegister
        projects={projects}
        canWrite={canManage}
        selectedId={selected?.id || null}
        onSelect={setSelected}
        onEdit={(p) => setEditProject({ ...p })}
      />

      {editProject && token && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-2xl mb-1">Client and project card</h3>
            <p className="text-sm text-steel-muted mb-4 font-mono">{editProject.code}</p>
            <form
              className="grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await api(`/api/projects/${editProject.id}/settings`, {
                  method: "PATCH",
                  token,
                  body: JSON.stringify(editProject),
                });
                setMsg("Client information saved.");
                setEditProject(null);
                await load();
              }}
            >
              <Input value={editProject.name || ""} onChange={(e) => setEditProject({ ...editProject, name: e.target.value })} placeholder="Project name" />
              <Input value={editProject.clientName || ""} onChange={(e) => setEditProject({ ...editProject, clientName: e.target.value })} placeholder="Client organisation" />
              <Input value={editProject.clientContactName || ""} onChange={(e) => setEditProject({ ...editProject, clientContactName: e.target.value })} placeholder="Contact name" />
              <Input value={editProject.clientEmail || ""} onChange={(e) => setEditProject({ ...editProject, clientEmail: e.target.value })} placeholder="Email" />
              <Input value={editProject.clientPhone || ""} onChange={(e) => setEditProject({ ...editProject, clientPhone: e.target.value })} placeholder="Phone" />
              <Input value={editProject.clientAddress || ""} onChange={(e) => setEditProject({ ...editProject, clientAddress: e.target.value })} placeholder="Address" />
              <Input value={editProject.location || ""} onChange={(e) => setEditProject({ ...editProject, location: e.target.value })} placeholder="Location" />
              <Input value={editProject.designConsultant || ""} onChange={(e) => setEditProject({ ...editProject, designConsultant: e.target.value })} placeholder="Design consultant" />
              <Input value={editProject.contractorName || ""} onChange={(e) => setEditProject({ ...editProject, contractorName: e.target.value })} placeholder="Contractor" />
              <div className="flex gap-2 pt-2">
                <Button type="submit">Save</Button>
                <Button type="button" variant="secondary" onClick={() => setEditProject(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {!canManage && (
        <p className="text-xs text-steel-muted">
          View only. <Link to="/crm/leads" className="text-brand font-semibold">Leads</Link> convert and create stay with office.
        </p>
      )}
    </div>
  );
}
