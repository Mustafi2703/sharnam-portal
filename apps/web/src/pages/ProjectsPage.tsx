import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  clientName?: string;
  location?: string;
  designConsultant?: string;
  contractorName?: string;
  pmcName?: string;
  _count?: { drawings: number; members: number };
};

const EMPTY = { code: "", name: "", clientName: "", location: "", designConsultant: "", pmcName: "", contractorName: "" };

export default function ProjectsPage() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [edit, setEdit] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteCode, setDeleteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const canManage = user?.role === "admin" || user?.role === "office";

  const load = () => api<Project[]>("/api/projects", { token }).then(setProjects);
  useEffect(() => {
    void load();
  }, [token]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="Projects"
        subtitle="Each project is a spine — drawings, checklists, diary, cost, and communications hang off it."
      />
      <p className="text-sm font-semibold text-warn bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Only office and admin can add, edit, or delete a project. Type the project code to confirm a delete.
      </p>

      {msg && <p className="text-sm text-brand-dark">{msg}</p>}

      {canManage && (
        <Card>
          <form
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api("/api/projects", { method: "POST", token, body: JSON.stringify(form) });
              setForm(EMPTY);
              await load();
            }}
          >
            <Input placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input placeholder="Client" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Design consultant" value={form.designConsultant} onChange={(e) => setForm({ ...form, designConsultant: e.target.value })} />
            <Input placeholder="PMC / SPDC" value={form.pmcName} onChange={(e) => setForm({ ...form, pmcName: e.target.value })} />
            <Input placeholder="Contractor" value={form.contractorName} onChange={(e) => setForm({ ...form, contractorName: e.target.value })} />
            <Button type="submit">Create project</Button>
          </form>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {projects.map((p) => (
          <Card key={p.id} className="h-full hover:border-brand/40 transition">
            <Link to={`/projects/${p.id}`} className="block">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] text-brand">{p.code}</div>
                  <div className="font-semibold text-lg mt-1">{p.name}</div>
                  <div className="text-sm text-steel-muted mt-1">
                    {p.clientName || "—"}
                    {p.location ? ` · ${p.location}` : ""}
                  </div>
                </div>
                <Badge tone="ok">{p.status}</Badge>
              </div>
              <div className="mt-4 pt-3 border-t border-line font-mono text-[11px] text-steel-muted flex gap-4">
                <span>{p._count?.drawings ?? 0} drawings</span>
                <span>{p._count?.members ?? 0} members</span>
              </div>
            </Link>
            {canManage && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="!text-xs !py-1.5" onClick={() => setEdit({ ...p })}>
                  Edit
                </Button>
                <Link to={`/projects/${p.id}/setup`} className="text-xs font-semibold text-brand self-center">
                  Setup →
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  className="!text-xs !py-1.5 !text-danger ml-auto"
                  onClick={() => {
                    setDeleteTarget(p);
                    setDeleteCode("");
                  }}
                >
                  Delete
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {edit && token && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg space-y-3">
            <h3 className="font-display text-xl">Edit {edit.code}</h3>
            <form
              className="grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await api(`/api/projects/${edit.id}/settings`, {
                  method: "PATCH",
                  token,
                  body: JSON.stringify(edit),
                });
                setMsg("Project card saved.");
                setEdit(null);
                await load();
              }}
            >
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Project name" />
              <Input value={edit.clientName || ""} onChange={(e) => setEdit({ ...edit, clientName: e.target.value })} placeholder="Client" />
              <Input value={edit.location || ""} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder="Location" />
              <Input value={edit.designConsultant || ""} onChange={(e) => setEdit({ ...edit, designConsultant: e.target.value })} placeholder="Design consultant" />
              <Input value={edit.pmcName || ""} onChange={(e) => setEdit({ ...edit, pmcName: e.target.value })} placeholder="PMC / SPDC" />
              <Input value={edit.contractorName || ""} onChange={(e) => setEdit({ ...edit, contractorName: e.target.value })} placeholder="Contractor" />
              <div className="flex gap-2 pt-1">
                <Button type="submit">Save</Button>
                <Button type="button" variant="secondary" onClick={() => setEdit(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {deleteTarget && token && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-md space-y-3">
            <h3 className="font-display text-xl">Delete {deleteTarget.code}?</h3>
            <p className="text-sm text-steel-muted">Type the project code to confirm. QAP, cube, drawings, and fills go with it.</p>
            <Input value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder={deleteTarget.code} />
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={deleteCode.trim().toUpperCase() !== deleteTarget.code.toUpperCase() || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/api/projects/${deleteTarget.id}`, {
                      method: "DELETE",
                      token,
                      body: JSON.stringify({ confirmCode: deleteCode.trim() }),
                    });
                    setMsg(`Deleted ${deleteTarget.code}.`);
                    setDeleteTarget(null);
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
              <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
