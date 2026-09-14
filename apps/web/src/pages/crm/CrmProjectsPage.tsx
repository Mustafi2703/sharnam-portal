import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { CrmProjectsRegister, type CrmProjectRow } from "../../components/CrmProjectsRegister";
import { Button, Card, Input } from "../../components/ui";

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
      setMsg(`Project ${created.code} saved. Opening the project card…`);
      window.location.assign(`/crm/setup?projectId=${created.id}&step=project`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 p-4 sm:p-5 pb-8 min-w-0">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wide text-steel-muted">CRM · projects</p>
        <h2 className="font-display text-lg text-ink">Projects</h2>
        <p className="text-xs text-steel-muted mt-1 max-w-3xl leading-relaxed">
          Register of SPDC delivery jobs and client cards. When you award a proposal from the bid register, the job lands here as Planning. You can also create a project here or in Project setup without a lead.
          Select a row to view the client card on the right. Use <strong className="font-semibold text-ink">Edit card & team</strong> to open the full setup form — client lines, consultants, vendors, work packages, and SPDC employees — and add more parties or staff any time during the job. Once live, <strong className="font-semibold text-ink">Open desk</strong> takes you to site modules, DPR, and drawings.
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

      <CrmProjectsRegister
        projects={projects}
        canWrite={canManage}
        selectedId={selected?.id || null}
        onSelect={setSelected}
        onDelete={(p) => {
          setDeleteProject(p);
          setDeleteCode("");
        }}
      />

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
