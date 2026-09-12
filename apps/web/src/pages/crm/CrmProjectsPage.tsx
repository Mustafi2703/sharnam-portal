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
  const [deleteProject, setDeleteProject] = useState<CrmProjectRow | null>(null);
  const [deleteCode, setDeleteCode] = useState("");

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

  const projectTools: HubCard[] = selected
    ? [
        { n: "01", label: "Setup this project", blurb: "Card, parties, matrix, portals.", href: `/crm/setup?projectId=${selected.id}&step=project` },
        { n: "02", label: "Live project setup", blurb: "Same launch on the job itself.", href: `/projects/${selected.id}/setup` },
        { n: "03", label: "R2 bid for this project", blurb: "Add vendors, upload BOQs, comparative.", href: `/crm/bids?projectId=${selected.id}` },
      ]
    : [];

  return (
    <div className="space-y-5 p-4 sm:p-5 pb-8 min-w-0">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wide text-steel-muted">CRM · projects</p>
        <h2 className="font-display text-lg text-ink">Projects</h2>
        <p className="text-xs text-steel-muted mt-1 max-w-3xl leading-relaxed">
          Delivery projects and client cards. Select a row to continue setup or open an R2 bid for that project.
          Site modules (DPR, Quality, Drawings) live on the project desk, not here.
          <span className="block mt-1 font-semibold text-amber-800">
            Only office and admin can add, edit, or delete a project.
          </span>
        </p>
      </div>

      {msg && <p className="text-sm text-ok leading-relaxed">{msg}</p>}

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
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
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
        onDelete={(p) => {
          setDeleteProject(p);
          setDeleteCode("");
        }}
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
              <Input value={editProject.pmcName || ""} onChange={(e) => setEditProject({ ...editProject, pmcName: e.target.value })} placeholder="PMC / SPDC" />
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

      {deleteProject && token && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-md space-y-3">
            <h3 className="font-display text-xl">Delete {deleteProject.code}?</h3>
            <p className="text-sm text-steel-muted">
              This removes the project, QAP, cube, drawings, fills, and logs. Type the project code to confirm.
            </p>
            <Input
              value={deleteCode}
              onChange={(e) => setDeleteCode(e.target.value)}
              placeholder={deleteProject.code}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={deleteCode.trim().toUpperCase() !== deleteProject.code.toUpperCase() || busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg("");
                  try {
                    await api(`/api/projects/${deleteProject.id}`, {
                      method: "DELETE",
                      token,
                      body: JSON.stringify({ confirmCode: deleteCode.trim() }),
                    });
                    setMsg(`Deleted ${deleteProject.code}.`);
                    setDeleteProject(null);
                    setSelected(null);
                    await load();
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Delete failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete project
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDeleteProject(null)}>
                Cancel
              </Button>
            </div>
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
