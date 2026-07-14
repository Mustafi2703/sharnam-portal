import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";

const LEAD_STAGES = ["New", "Qualified", "Proposal", "Negotiation", "Converted", "Lost"];

export default function CrmPage() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState<"leads" | "projects" | "wizard">("leads");
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [convertLead, setConvertLead] = useState<any | null>(null);
  const [leadForm, setLeadForm] = useState({
    title: "",
    contactName: "",
    email: "",
    phone: "",
    stage: "New",
    value: "",
  });
  const [convertForm, setConvertForm] = useState({
    code: "",
    name: "",
    clientName: "",
    location: "",
    memberIds: [] as string[],
    vendorIds: [] as string[],
  });
  const [wizardStep, setWizardStep] = useState(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState({
    code: "",
    name: "",
    clientName: "",
    location: "",
    description: "",
  });
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("site_employee");
  const [vendorId, setVendorId] = useState("");
  const [trade, setTrade] = useState("");

  const canManage = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [p, l, d, u, v] = await Promise.all([
      api<any[]>("/api/projects", { token }),
      canManage ? api<any[]>("/api/crm/leads", { token }).catch(() => []) : Promise.resolve([]),
      canManage ? api<any[]>("/api/crm/deals", { token }).catch(() => []) : Promise.resolve([]),
      canManage ? api<any[]>("/api/users", { token }).catch(() => []) : Promise.resolve([]),
      canManage ? api<any[]>("/api/vendors", { token }).catch(() => []) : Promise.resolve([]),
    ]);
    setProjects(p);
    setLeads(l);
    setDeals(d);
    setUsers(u);
    setVendors(v);
  };

  useEffect(() => {
    void load();
  }, [token, canManage]);

  const pipeline = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of LEAD_STAGES) map[s] = [];
    for (const lead of leads) {
      const stage = map[lead.stage] ? lead.stage : "New";
      map[stage].push(lead);
    }
    return map;
  }, [leads]);

  async function createLead(e: FormEvent) {
    e.preventDefault();
    await api("/api/crm/leads", {
      method: "POST",
      token,
      body: JSON.stringify({ ...leadForm, value: leadForm.value ? Number(leadForm.value) : null }),
    });
    setLeadForm({ title: "", contactName: "", email: "", phone: "", stage: "New", value: "" });
    setMsg("Lead added.");
    await load();
  }

  async function runConvert(e: FormEvent) {
    e.preventDefault();
    if (!convertLead) return;
    const res = await api<{ project: { id: string; code: string } }>(`/api/crm/leads/${convertLead.id}/convert`, {
      method: "POST",
      token,
      body: JSON.stringify(convertForm),
    });
    setMsg(`Converted to project ${res.project.code}`);
    setConvertLead(null);
    setTab("projects");
    await load();
  }

  async function createProject(e: FormEvent) {
    e.preventDefault();
    const p = await api<any>("/api/projects", {
      method: "POST",
      token,
      body: JSON.stringify(projectForm),
    });
    setCreatedId(p.id);
    setMsg(`Project ${p.code} created.`);
    setWizardStep(2);
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Leads & projects"
        subtitle="Capture leads, convert to project with tender details, assign site staff and vendors."
        actions={
          canManage ? (
            <div className="flex gap-2">
              {(["leads", "wizard", "projects"] as const).map((t) => (
                <Button key={t} variant={tab === t ? "primary" : "secondary"} onClick={() => setTab(t)}>
                  {t === "wizard" ? "New project" : t === "leads" ? "Leads board" : "Projects"}
                </Button>
              ))}
            </div>
          ) : undefined
        }
      />

      {msg && <p className="text-sm text-ok">{msg}</p>}

      {tab === "leads" && canManage && (
        <>
          <Card>
            <h3 className="font-semibold mb-3">Add lead</h3>
            <form className="grid md:grid-cols-3 gap-3" onSubmit={createLead}>
              <Input required placeholder="Opportunity title" value={leadForm.title} onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })} />
              <Input placeholder="Contact name" value={leadForm.contactName} onChange={(e) => setLeadForm({ ...leadForm, contactName: e.target.value })} />
              <Input placeholder="Email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
              <Input placeholder="Phone" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
              <Select value={leadForm.stage} onChange={(e) => setLeadForm({ ...leadForm, stage: e.target.value })}>
                {LEAD_STAGES.filter((s) => s !== "Converted").map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Input placeholder="Value (INR)" value={leadForm.value} onChange={(e) => setLeadForm({ ...leadForm, value: e.target.value })} />
              <Button type="submit" className="md:col-span-3">Save lead</Button>
            </form>
          </Card>

          <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto">
            {LEAD_STAGES.map((stage) => (
              <Card key={stage} padding={false} className="min-w-[180px]">
                <div className="px-3 py-2 border-b bg-sand/50 text-xs font-semibold uppercase tracking-wide flex justify-between">
                  <span>{stage}</span>
                  <span className="font-mono text-brand">{pipeline[stage]?.length || 0}</span>
                </div>
                <ul className="divide-y max-h-[420px] overflow-y-auto">
                  {(pipeline[stage] || []).map((lead) => (
                    <li key={lead.id} className="p-3 text-sm space-y-2">
                      <div className="font-medium leading-snug">{lead.title}</div>
                      <div className="text-xs text-steel-muted">{lead.contactName || "—"}</div>
                      {lead.value != null && (
                        <div className="font-mono text-[11px] text-brand">₹{Number(lead.value).toLocaleString("en-IN")}</div>
                      )}
                      {lead.projectId ? (
                        <Link to={`/projects/${lead.projectId}`} className="text-xs text-brand font-semibold">
                          Open project →
                        </Link>
                      ) : stage !== "Lost" ? (
                        <Button
                          className="!text-xs !py-1 !px-2 w-full"
                          onClick={() => {
                            setConvertLead(lead);
                            setConvertForm({
                              code: `SPDC-${Date.now().toString().slice(-5)}`,
                              name: lead.title,
                              clientName: lead.contactName || "",
                              location: "",
                              memberIds: [],
                              vendorIds: [],
                            });
                          }}
                        >
                          Convert →
                        </Button>
                      ) : null}
                    </li>
                  ))}
                  {!pipeline[stage]?.length && <li className="p-3 text-xs text-steel-muted">Empty</li>}
                </ul>
              </Card>
            ))}
          </div>

          {deals.length > 0 && (
            <Card padding={false}>
              <div className="px-4 py-3 border-b bg-sand/40 font-semibold">Deals</div>
              <ul className="divide-y">
                {deals.map((d) => (
                  <li key={d.id} className="px-4 py-3 flex justify-between text-sm">
                    <span>{d.name}</span>
                    <Badge>{d.stage}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {convertLead && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-2xl mb-1">Convert lead</h3>
            <p className="text-sm text-steel-muted mb-4">{convertLead.title}</p>
            <form className="space-y-3" onSubmit={runConvert}>
              <Input required placeholder="Project code" value={convertForm.code} onChange={(e) => setConvertForm({ ...convertForm, code: e.target.value })} />
              <Input required placeholder="Project name" value={convertForm.name} onChange={(e) => setConvertForm({ ...convertForm, name: e.target.value })} />
              <Input placeholder="Client" value={convertForm.clientName} onChange={(e) => setConvertForm({ ...convertForm, clientName: e.target.value })} />
              <Input placeholder="Site location" value={convertForm.location} onChange={(e) => setConvertForm({ ...convertForm, location: e.target.value })} />
              <div>
                <div className="text-xs font-mono uppercase text-steel-muted mb-1">Assign staff</div>
                <div className="max-h-28 overflow-y-auto border rounded-xl p-2 space-y-1">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={convertForm.memberIds.includes(u.id)}
                        onChange={(e) => {
                          setConvertForm({
                            ...convertForm,
                            memberIds: e.target.checked
                              ? [...convertForm.memberIds, u.id]
                              : convertForm.memberIds.filter((x) => x !== u.id),
                          });
                        }}
                      />
                      {u.fullName || u.name} ({u.role})
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-steel-muted mb-1">Vendors</div>
                <div className="max-h-28 overflow-y-auto border rounded-xl p-2 space-y-1">
                  {vendors.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={convertForm.vendorIds.includes(v.id)}
                        onChange={(e) => {
                          setConvertForm({
                            ...convertForm,
                            vendorIds: e.target.checked
                              ? [...convertForm.vendorIds, v.id]
                              : convertForm.vendorIds.filter((x) => x !== v.id),
                          });
                        }}
                      />
                      {v.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create project</Button>
                <Button type="button" variant="secondary" onClick={() => setConvertLead(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {tab === "wizard" && canManage && (
        <Card>
          <div className="flex gap-2 mb-4 text-xs font-mono">
            {[1, 2, 3].map((s) => (
              <span key={s} className={`px-2 py-1 rounded ${wizardStep === s ? "bg-brand text-white" : "bg-sand"}`}>
                Step {s}
              </span>
            ))}
          </div>
          {wizardStep === 1 && (
            <form className="grid md:grid-cols-2 gap-3" onSubmit={createProject}>
              <Input required placeholder="Project code" value={projectForm.code} onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value })} />
              <Input required placeholder="Project name" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
              <Input placeholder="Client" value={projectForm.clientName} onChange={(e) => setProjectForm({ ...projectForm, clientName: e.target.value })} />
              <Input placeholder="Location" value={projectForm.location} onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })} />
              <TextArea className="md:col-span-2" placeholder="Tender scope / notes" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
              <Button type="submit" className="md:col-span-2">
                Create project → Assign team
              </Button>
            </form>
          )}
          {wizardStep === 2 && createdId && (
            <div className="space-y-3">
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
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.name} ({u.role})
                    </option>
                  ))}
                </Select>
                <Select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                  {["office", "site_employee", "employee", "client", "vendor", "project_manager"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
                <Button type="submit">Assign</Button>
                <Button type="button" variant="secondary" onClick={() => setWizardStep(3)}>
                  Next: vendors →
                </Button>
              </form>
            </div>
          )}
          {wizardStep === 3 && createdId && (
            <div className="space-y-3">
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
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
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
        </Card>
      )}

      {(tab === "projects" || !canManage) && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b bg-sand/40 font-semibold">Projects</div>
          <ul className="divide-y">
            {projects.map((p) => (
              <li key={p.id} className="px-4 py-3 flex justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-brand">{p.code}</div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-steel-muted">
                    {p.clientName || "—"} · {p.location || "—"}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <Badge>{p.status}</Badge>
                  <div>
                    <Link to={`/projects/${p.id}`} className="text-xs text-brand font-semibold">
                      Open tools
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
