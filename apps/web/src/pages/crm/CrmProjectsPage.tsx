import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  CrmProjectsRegister,
  type CrmProjectProposalLink,
  type CrmProjectRow,
} from "../../components/CrmProjectsRegister";
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

type QuotationLinkRow = {
  id: string;
  quotationNo: string;
  projectId?: string | null;
  awardedProjectId?: string | null;
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

  const [proposalByProjectId, setProposalByProjectId] = useState<Record<string, CrmProjectProposalLink>>({});

  const loadProposals = useCallback(async () => {
    if (!token) return;
    try {
      const rows = await api<QuotationLinkRow[]>("/api/crm/quotations", { token });
      const map: Record<string, CrmProjectProposalLink> = {};
      for (const row of rows) {
        const pid = row.awardedProjectId || row.projectId;
        if (pid && !map[pid]) {
          map[pid] = { id: row.id, quotationNo: row.quotationNo };
        }
      }
      setProposalByProjectId(map);
    } catch {
      setProposalByProjectId({});
    }
  }, [token]);

  useEffect(() => {
    void load();
    void loadProposals();
  }, [load, loadProposals]);

  const linkedProposal = useMemo(
    () => (deleteProject ? proposalByProjectId[deleteProject.id] : null),
    [deleteProject, proposalByProjectId],
  );

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wide text-steel-muted">CRM · projects</p>
          <h2 className="font-display text-lg text-ink">Projects register</h2>
          <p className="text-xs text-steel-muted mt-1 max-w-2xl leading-relaxed">
            Delivery jobs and client cards. Award a proposal to land here as Planning, or create a project directly.
            Select a row for the client card — use <strong className="font-semibold text-ink">Edit setup</strong> for parties and staff,{" "}
            <strong className="font-semibold text-ink">Open desk</strong> when live.
          </p>
          {!canManage && (
            <p className="text-xs text-steel-muted mt-1">View only — office and admin can add, edit, or delete.</p>
          )}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Link to="/crm/projects?create=1">
              <Button type="button" variant="secondary" className="!text-xs">
                + New project
              </Button>
            </Link>
            <Link to="/crm/proposals">
              <Button type="button" variant="ghost" className="!text-xs">
                Proposals register
              </Button>
            </Link>
          </div>
        )}
      </div>

      {msg && (
        <p className={`text-sm leading-relaxed ${msg.startsWith("Deleted") ? "text-ok" : msg.includes("failed") ? "text-danger" : "text-ok"}`}>
          {msg}
        </p>
      )}

      {showCreate && canManage && (
        <Card className="!p-4 space-y-3 border-brand/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm">New delivery project</h3>
              <p className="text-xs text-steel-muted">Creates the project row. Next: Project setup for matrix and team.</p>
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
        proposalByProjectId={proposalByProjectId}
        onDelete={(p) => {
          setDeleteProject(p);
          setDeleteCode("");
        }}
      />

      {deleteProject && token && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg space-y-3">
            <h3 className="font-display text-xl">Delete {deleteProject.code}?</h3>
            <p className="text-sm text-steel-muted leading-relaxed">
              Permanently removes this project and all linked site data: drawings, DPR/WPR fills, checklists, QAP, cube,
              meetings, RFIs, bids, POs, and audit rows tied to the job.
            </p>
            {linkedProposal ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Linked proposal <span className="font-mono">{linkedProposal.quotationNo}</span> stays on the proposals
                register — delete it separately if you want a clean slate.
              </p>
            ) : null}
            <label className="block text-xs font-semibold text-steel-muted">
              Type project code to confirm
              <Input
                className="mt-1 font-mono"
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value)}
                placeholder={deleteProject.code}
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                className="!bg-danger !border-danger"
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
                    await loadProposals();
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Delete failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete project & data
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDeleteProject(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
