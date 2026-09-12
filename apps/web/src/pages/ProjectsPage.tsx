import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";
import { ProjectManageActions } from "../components/ProjectManageActions";

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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ProjectManageActions
                  project={p}
                  token={token}
                  onChanged={async () => {
                    setMsg("Project list updated.");
                    await load();
                  }}
                />
                <Link to={`/projects/${p.id}/setup`} className="text-xs font-semibold text-brand self-center">
                  Setup →
                </Link>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
