import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";

export default function CrmPage() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [projectForm, setProjectForm] = useState({
    code: "",
    name: "",
    clientName: "",
    location: "",
    description: "",
  });
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("site");
  const [vendorId, setVendorId] = useState("");
  const [trade, setTrade] = useState("");

  const canManage = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [p, u, v] = await Promise.all([
      api<any[]>("/api/projects", { token }),
      canManage ? api<any[]>("/api/users", { token }).catch(() => []) : Promise.resolve([]),
      canManage ? api<any[]>("/api/vendors", { token }).catch(() => []) : Promise.resolve([]),
    ]);
    setProjects(p);
    setUsers(u);
    setVendors(v);
  };

  useEffect(() => {
    void load();
  }, [token, canManage]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    const p = await api<any>("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify(projectForm),
    });
    setCreatedId(p.id);
    setMsg(`Project ${p.code} created.`);
    setStep(2);
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Start a project"
        subtitle="Create the job, assign employees, attach vendors — then open Project Tools for drawings, QA, and RFIs."
      />

      {canManage && (
        <Card>
          <div className="flex gap-2 mb-4 text-xs font-mono">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`px-2 py-1 rounded ${step === s ? "bg-brand text-white" : "bg-sand"}`}
              >
                Step {s}
              </span>
            ))}
          </div>

          {step === 1 && (
            <form className="grid md:grid-cols-2 gap-3" onSubmit={createProject}>
              <Input required placeholder="Project code" value={projectForm.code} onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })} />
              <Input required placeholder="Project name" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
              <Input placeholder="Client" value={projectForm.clientName} onChange={(e) => setProjectForm({ ...projectForm, clientName: e.target.value })} />
              <Input placeholder="Location" value={projectForm.location} onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })} />
              <TextArea className="md:col-span-2" placeholder="Scope / notes" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
              <Button type="submit" className="md:col-span-2">Create project → Assign team</Button>
            </form>
          )}

          {step === 2 && createdId && (
            <div className="space-y-3">
              <p className="text-sm text-steel-muted">Assign employees / portal users to the project.</p>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/api/projects/${createdId}/members`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ userId: memberUserId, role: memberRole }),
                  });
                  setMsg("Employee assigned.");
                  await load();
                }}
              >
                <Select required className="min-w-[220px]" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
                  <option value="">Select user</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </Select>
                <Select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                  {["admin", "office", "site_employee", "employee", "client", "project_manager"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
                <Button type="submit">Assign</Button>
                <Button type="button" variant="secondary" onClick={() => setStep(3)}>Next: vendors →</Button>
              </form>
            </div>
          )}

          {step === 3 && createdId && (
            <div className="space-y-3">
              <p className="text-sm text-steel-muted">Attach vendors (create more under Project → Vendors).</p>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/api/vendors/project/${createdId}/assign`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ vendorId, tradeRole: trade }),
                  });
                  setMsg("Vendor assigned.");
                }}
              >
                <Select required className="min-w-[220px]" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </Select>
                <Input placeholder="Trade" value={trade} onChange={(e) => setTrade(e.target.value)} />
                <Button type="submit">Assign vendor</Button>
              </form>
              <Link to={`/projects/${createdId}`} className="inline-flex text-sm font-semibold text-brand">
                Open project tools →
              </Link>
            </div>
          )}

          {msg && <p className="text-sm text-ok mt-3">{msg}</p>}
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold">CRM project list</div>
        <ul className="divide-y">
          {projects.map((p) => (
            <li key={p.id} className="px-4 py-3 flex justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-brand">{p.code}</div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-steel-muted">{p.clientName || "—"} · {p.location || "—"}</div>
              </div>
              <div className="text-right space-y-1">
                <Badge>{p.status}</Badge>
                <div>
                  <Link to={`/projects/${p.id}`} className="text-xs text-brand font-semibold">Open tools</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
