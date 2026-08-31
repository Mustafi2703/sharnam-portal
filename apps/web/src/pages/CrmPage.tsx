import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select } from "../components/ui";
import { CrmLeadsRegister } from "../components/CrmLeadsRegister";
import { CrmProposalsRegister } from "../components/CrmProposalsRegister";
import { CrmProjectsRegister } from "../components/CrmProjectsRegister";
import { RegisterSheetFrame } from "../components/RegisterSheetFrame";
import { ReferenceSheetToolbar } from "../components/ReferenceSheetToolbar";
import {
  type CrmLead,
  PIPELINE_STAGES,
  countByField,
  leadLocation,
  marketStatusTone,
} from "../lib/crmLeadUtils";
import { vendorMatchesBidDisciplines } from "../lib/crmBidDisciplines";

type LeadsView = "register" | "market" | "pipeline" | "converted";
const LEAD_STAGES = PIPELINE_STAGES;

export default function CrmPage() {
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const section = location.pathname.includes("/proposals")
    ? "proposals"
    : location.pathname.includes("/projects")
      ? "projects"
      : "leads";
  const [tab, setTab] = useState<"leads" | "projects" | "wizard">("leads");
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [bidPackages, setBidPackages] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [leadAddOpen, setLeadAddOpen] = useState(false);
  const [convertLead, setConvertLead] = useState<any | null>(null);
  const [leadForm, setLeadForm] = useState({
    title: "",
    contactName: "",
    email: "",
    phone: "",
    stage: "New",
    value: "",
  });
  const emptyClient = {
    clientName: "",
    clientContactName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    clientGst: "",
    designConsultant: "",
    contractorName: "",
    location: "",
  };
  const [convertForm, setConvertForm] = useState({
    code: "",
    name: "",
    ...emptyClient,
    memberIds: [] as string[],
    vendorIds: [] as string[],
    disciplineKeys: [] as string[],
  });
  const [bidDisciplines, setBidDisciplines] = useState<{ key: string; label: string }[]>([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState({
    code: "",
    name: "",
    ...emptyClient,
  });
  const [editProject, setEditProject] = useState<any | null>(null);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("site_employee");
  const [vendorId, setVendorId] = useState("");
  const [trade, setTrade] = useState("");
  const [leadsView, setLeadsView] = useState<LeadsView>("register");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (section === "projects") setTab("wizard");
    else setTab("leads");
  }, [section]);

  const canManage = user?.role === "admin" || user?.role === "office";

  useEffect(() => {
    if (!canManage || !token) return;
    void api<{ key: string; label: string }[]>("/api/crm/disciplines", { token })
      .then((rows) => {
        setBidDisciplines(rows);
        setConvertForm((f) => ({
          ...f,
          disciplineKeys: f.disciplineKeys.length ? f.disciplineKeys : rows.map((d) => d.key),
        }));
      })
      .catch(() => {});
  }, [token, canManage]);

  function openSetupBids(lead: CrmLead) {
    if (!lead.projectId) return;
    navigate(`/crm/bids?projectId=${lead.projectId}&leadId=${lead.id}`);
  }

  function openConvert(lead: CrmLead) {
    if (lead.projectId) {
      openSetupBids(lead);
      return;
    }
    setConvertLead(lead);
    setConvertForm({
      code: `SPDC-${String(lead.srNo || Date.now()).slice(-5)}`,
      name: lead.title,
      ...emptyClient,
      clientName: lead.contactName || lead.title,
      clientContactName: lead.contactName || "",
      clientEmail: lead.email || "",
      clientPhone: lead.phone || "",
      location: leadLocation(lead),
      memberIds: [],
      vendorIds: [],
      disciplineKeys: bidDisciplines.map((d) => d.key),
    });
  }

  async function updateLeadStage(leadId: string, stage: string) {
    await api(`/api/crm/leads/${leadId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ stage }),
    });
    setMsg(`Pipeline stage → ${stage}`);
    await load();
  }

  const load = async () => {
    const [p, l, d, u, v, q, bp] = await Promise.all([
      api<any[]>("/api/projects", { token }),
      canManage ? api<any[]>("/api/crm/leads", { token }).catch(() => []) : Promise.resolve([]),
      canManage ? api<any[]>("/api/crm/deals", { token }).catch(() => []) : Promise.resolve([]),
      canManage ? api<any[]>("/api/users", { token }).catch(() => []) : Promise.resolve([]),
      canManage ? api<any[]>("/api/vendors", { token }).catch(() => []) : Promise.resolve([]),
      api<any[]>("/api/crm/quotations", { token }).catch(() => []),
      canManage ? api<any[]>("/api/crm/bid-packages", { token }).catch(() => []) : Promise.resolve([]),
    ]);
    setProjects(p);
    setLeads(l);
    setDeals(d);
    setUsers(u);
    setVendors(v);
    setQuotations(q);
    setBidPackages(bp);
  };

  useEffect(() => {
    void load();
  }, [token, canManage]);

  const bidPackagesByLeadId = useMemo(() => {
    const map: Record<string, typeof bidPackages> = {};
    for (const bp of bidPackages) {
      const leadId = bp.leadId || bp.lead?.id;
      if (!leadId) continue;
      (map[leadId] ||= []).push(bp);
    }
    return map;
  }, [bidPackages]);

  const convertedLeads = useMemo(() => leads.filter((l) => l.projectId), [leads]);
  const pipelineLeads = useMemo(() => leads.filter((l) => !l.projectId), [leads]);

  const pipeline = useMemo(() => {
    const map: Record<string, CrmLead[]> = {};
    for (const s of LEAD_STAGES) map[s] = [];
    for (const lead of pipelineLeads) {
      const stage = map[lead.stage || "New"] ? lead.stage || "New" : "New";
      map[stage].push(lead);
    }
    return map;
  }, [pipelineLeads]);

  const convertEligibleVendors = useMemo(
    () => vendors.filter((v) => vendorMatchesBidDisciplines(v, convertForm.disciplineKeys)),
    [vendors, convertForm.disciplineKeys]
  );

  const marketPipeline = useMemo(() => {
    const map: Record<string, CrmLead[]> = {};
    for (const lead of leads) {
      const key = lead.latestStatus || "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push(lead);
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [leads]);

  const marketCounts = useMemo(() => countByField(leads, "latestStatus"), [leads]);

  async function createLead(e: FormEvent) {
    e.preventDefault();
    await api("/api/crm/leads", {
      method: "POST",
      token,
      body: JSON.stringify({ ...leadForm, value: leadForm.value ? Number(leadForm.value) : null }),
    });
    setLeadForm({ title: "", contactName: "", email: "", phone: "", stage: "New", value: "" });
    setLeadAddOpen(false);
    setMsg("Lead added.");
    await load();
  }

  async function runConvert(e: FormEvent) {
    e.preventDefault();
    if (!convertLead) return;
    const leadId = convertLead.id;
    const res = await api<{ project: { id: string; code: string }; alreadyConverted?: boolean }>(
      `/api/crm/leads/${leadId}/convert`,
      {
      method: "POST",
      token,
      body: JSON.stringify(convertForm),
      },
    );

    if (res.alreadyConverted) {
      setConvertLead(null);
      setMsg(`Lead already linked to ${res.project.code} — opening bid setup.`);
      navigate(`/crm/bids?projectId=${res.project.id}&leadId=${leadId}`);
      await load();
      return;
    }

    let bidPackageId: string | null = null;
    if (convertForm.vendorIds.length >= 2 && convertForm.disciplineKeys.length) {
      try {
        const vendorNames = convertForm.vendorIds
          .map((id) => vendors.find((v) => v.id === id)?.name)
          .filter(Boolean) as string[];
        const bp = await api<{ id: string }>("/api/crm/bid-packages", {
          method: "POST",
          token,
          body: JSON.stringify({
            title: `${convertForm.name} — comparative bid`,
            projectId: res.project.id,
            leadId,
            revisionLabel: "R2",
            vendorNames,
            disciplineKeys: convertForm.disciplineKeys,
          }),
        });
        bidPackageId = bp.id;
      } catch (err) {
        setMsg(
          `Project ${res.project.code} created. Bid package failed: ${err instanceof Error ? err.message : "unknown"} — open Bid desk to set up manually.`,
        );
        setConvertLead(null);
        navigate(`/crm/bids?projectId=${res.project.id}&leadId=${leadId}`);
        await load();
        return;
      }
    }

    setConvertLead(null);
    if (bidPackageId) {
      setMsg(`Project ${res.project.code} created with discipline-wise bid package (PEB, Civil, Fire, etc.).`);
      navigate(`/crm/bids/${bidPackageId}`);
    } else {
      setMsg(
        `Project ${res.project.code} created. Select at least 2 contractors on convert to auto-open bids — or set up from Bid desk.`,
      );
      navigate(`/crm/bids?projectId=${res.project.id}&leadId=${leadId}`);
    }
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
    <div className="space-y-6 pb-4">
      {msg && <p className="text-sm text-ok shrink-0">{msg}</p>}

      {section === "proposals" && (
        <CrmProposalsRegister quotations={quotations} canWrite={canManage} />
      )}

      {section === "leads" && canManage && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="!p-4">
              <div className="text-[10px] font-mono uppercase text-steel-muted">Total projects</div>
              <div className="font-display text-3xl text-brand">{leads.length}</div>
              <div className="text-xs text-steel-muted mt-1">Active pipeline register</div>
            </Card>
            <Card className="!p-4">
              <div className="text-[10px] font-mono uppercase text-steel-muted">Under construction</div>
              <div className="font-display text-3xl">{marketCounts["Under Construction"] || 0}</div>
            </Card>
            <Card className="!p-4">
              <div className="text-[10px] font-mono uppercase text-steel-muted">Pre-construction</div>
              <div className="font-display text-3xl">{marketCounts["Pre-Construction"] || 0}</div>
            </Card>
            <Card className="!p-4">
              <div className="text-[10px] font-mono uppercase text-steel-muted">Converted to SPDC</div>
              <div className="font-display text-3xl">{leads.filter((l) => l.projectId).length}</div>
            </Card>
          </div>

          <ReferenceSheetToolbar
            sheetLabel="CRM market register"
            rowCount={leads.length}
            canEdit
            onAddRow={() => setLeadAddOpen((v) => !v)}
            onUpload={async (file) => {
              const fd = new FormData();
              fd.append("file", file);
              fd.append("sourceSheet", file.name);
              fd.append("sheet", "Project Details");
              try {
                const out = await api<{ created: number; updated: number; skipped: number; errors: string[] }>(
                  "/api/crm/leads/import",
                  { method: "POST", token, body: fd },
                );
                setMsg(`Imported: ${out.created} created, ${out.updated} updated, ${out.skipped} skipped${out.errors.length ? `, ${out.errors.length} errors` : ""}.`);
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Import failed");
              }
            }}
            uploadTitle="Upload Data - July 2026.xlsx"
            uploadHint="Sheet: Project Details · upserts by Sr No · includes Latest Status / Sub Status / location / segment / description."
            message={msg || undefined}
          />

          <div className="flex flex-wrap gap-2 items-center">
            {(
              [
                ["register", "Register (all rows)"],
                ["pipeline", "Sales pipeline"],
                ["converted", "Converted + bid setup"],
                ["market", "By market status"],
              ] as const
            ).map(([key, label]) => (
              <Button key={key} variant={leadsView === key ? "primary" : "secondary"} onClick={() => setLeadsView(key)}>
                {label}
              </Button>
            ))}
          </div>

          {leadAddOpen && (
          <Card className="!p-3">
            <h3 className="font-semibold mb-3">Add lead manually</h3>
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
              <Button type="button" variant="secondary" className="md:col-span-3" onClick={() => setLeadAddOpen(false)}>Cancel</Button>
            </form>
          </Card>
          )}

          {leadsView === "register" && (
            <CrmLeadsRegister
              leads={leads}
              canWrite={canManage}
              selectedId={selectedLeadId}
              onSelect={(l) => setSelectedLeadId(l?.id || null)}
              onConvert={openConvert}
              onSetupBids={openSetupBids}
              onStageChange={updateLeadStage}
              bidPackagesByLeadId={bidPackagesByLeadId}
            />
          )}

          {leadsView === "converted" && (
            <CrmLeadsRegister
              leads={leads}
              canWrite={canManage}
              selectedId={selectedLeadId}
              onSelect={(l) => setSelectedLeadId(l?.id || null)}
              onConvert={openConvert}
              onSetupBids={openSetupBids}
              onStageChange={updateLeadStage}
              bidPackagesByLeadId={bidPackagesByLeadId}
              defaultConversion="converted"
            />
          )}

          {leadsView === "market" && (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 overflow-x-auto pb-2">
              {marketPipeline.map(([status, rows]) => (
                <Card key={status} padding={false} className="min-w-[240px]">
                  <div className="px-3 py-2 border-b bg-sand/50 text-xs font-semibold flex justify-between gap-2">
                    <span className={`px-1.5 py-0.5 rounded ${marketStatusTone(status)}`}>{status}</span>
                    <span className="font-mono text-brand">{rows.length}</span>
                  </div>
                  <ul className="divide-y max-h-[480px] overflow-y-auto">
                    {rows.slice(0, 40).map((lead) => (
                      <li key={lead.id} className="p-3 text-sm space-y-1.5">
                        <div className="font-medium leading-snug line-clamp-2">{lead.title}</div>
                        <div className="text-xs text-steel-muted">{leadLocation(lead)}</div>
                        {lead.latestSubStatus && (
                          <div className="text-[10px] text-steel-muted">{lead.latestSubStatus}</div>
                        )}
                        {!lead.projectId ? (
                          <Button className="!text-xs !py-1 !px-2" onClick={() => openConvert(lead)}>
                            Convert →
                          </Button>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="text-xs text-brand font-semibold"
                              onClick={() => openSetupBids(lead)}
                            >
                              Setup bids →
                            </button>
                            <Link to={`/projects/${lead.projectId}`} className="text-xs text-brand font-semibold">
                              Project →
                            </Link>
                          </div>
                        )}
                      </li>
                    ))}
                    {rows.length > 40 && (
                      <li className="p-3 text-xs text-steel-muted">+ {rows.length - 40} more — use Register view</li>
                    )}
                  </ul>
                </Card>
              ))}
            </div>
          )}

          {leadsView === "pipeline" && (
            <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto pb-2">
              {LEAD_STAGES.map((stage) => (
                <Card key={stage} padding={false} className="min-w-[180px]">
                  <div className="px-3 py-2 border-b bg-sand/50 text-xs font-semibold uppercase tracking-wide flex justify-between">
                    <span>{stage}</span>
                    <span className="font-mono text-brand">{pipeline[stage]?.length || 0}</span>
                  </div>
                  <ul className="divide-y max-h-[420px] overflow-y-auto">
                    {(pipeline[stage] || []).slice(0, 25).map((lead) => (
                      <li key={lead.id} className="p-3 text-sm space-y-2">
                        <div className="font-medium leading-snug line-clamp-2">{lead.title}</div>
                        <div className="text-xs text-steel-muted">{lead.district || "—"}{lead.state ? `, ${lead.state}` : ""}</div>
                        {lead.latestStatus && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${marketStatusTone(lead.latestStatus)}`}>
                            {lead.latestStatus}
                          </span>
                        )}
                        {lead.projectId ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="text-xs text-brand font-semibold"
                              onClick={() => openSetupBids(lead)}
                            >
                              Setup bids →
                            </button>
                            <Link to={`/projects/${lead.projectId}`} className="text-xs text-brand font-semibold">
                              Project →
                            </Link>
                          </div>
                        ) : stage !== "Lost" ? (
                          <Button className="!text-xs !py-1 !px-2 w-full" onClick={() => openConvert(lead)}>
                            Convert →
                          </Button>
                        ) : null}
                      </li>
                    ))}
                    {(pipeline[stage]?.length || 0) > 25 && (
                      <li className="p-3 text-xs text-steel-muted">Use Register view for full list</li>
                    )}
                    {!pipeline[stage]?.length && <li className="p-3 text-xs text-steel-muted">Empty</li>}
                  </ul>
                </Card>
              ))}
            </div>
          )}

          {deals.length > 0 && (
            <div className="grid xl:grid-cols-[1fr_320px] gap-3">
              <RegisterSheetFrame title="Deals register" sheetLabel="CRM pipeline" rowCount={deals.length}>
                <table className="sheet-register__table min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Deal</th>
                      <th>Stage</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((d) => (
                      <tr key={d.id}>
                        <td className="font-medium">{d.name}</td>
                        <td>
                          <Badge>{d.stage}</Badge>
                        </td>
                        <td className="font-mono text-xs">{d.value != null ? `₹ ${Number(d.value).toLocaleString("en-IN")}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </RegisterSheetFrame>
            </div>
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
              <p className="text-[11px] font-mono uppercase text-steel-muted pt-1">Client information</p>
              <Input placeholder="Client organisation" value={convertForm.clientName} onChange={(e) => setConvertForm({ ...convertForm, clientName: e.target.value })} />
              <Input placeholder="Client contact name" value={convertForm.clientContactName} onChange={(e) => setConvertForm({ ...convertForm, clientContactName: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Client email" value={convertForm.clientEmail} onChange={(e) => setConvertForm({ ...convertForm, clientEmail: e.target.value })} />
                <Input placeholder="Client phone" value={convertForm.clientPhone} onChange={(e) => setConvertForm({ ...convertForm, clientPhone: e.target.value })} />
              </div>
              <Input placeholder="Client address" value={convertForm.clientAddress} onChange={(e) => setConvertForm({ ...convertForm, clientAddress: e.target.value })} />
              <Input placeholder="GST / tax ID" value={convertForm.clientGst} onChange={(e) => setConvertForm({ ...convertForm, clientGst: e.target.value })} />
              <Input placeholder="Design consultant" value={convertForm.designConsultant} onChange={(e) => setConvertForm({ ...convertForm, designConsultant: e.target.value })} />
              <Input placeholder="Main contractor" value={convertForm.contractorName} onChange={(e) => setConvertForm({ ...convertForm, contractorName: e.target.value })} />
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
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-xs font-mono uppercase text-steel-muted">Bid disciplines (PEB, Civil, Fire…)</div>
                  <Link to="/master/vendors" className="text-[10px] text-brand font-semibold" target="_blank" rel="noreferrer">
                    Vendor directory ↗
                  </Link>
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-xl p-2 grid sm:grid-cols-2 gap-1">
                  {bidDisciplines.map((d) => (
                    <label key={d.key} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={convertForm.disciplineKeys.includes(d.key)}
                        onChange={(e) => {
                          setConvertForm({
                            ...convertForm,
                            disciplineKeys: e.target.checked
                              ? [...convertForm.disciplineKeys, d.key]
                              : convertForm.disciplineKeys.filter((k) => k !== d.key),
                          });
                        }}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-steel-muted mb-1">Contractors / vendors for comparative bid (min 2)</div>
                <p className="text-[10px] text-steel-muted mb-1">Office can upload BOQs later, or vendors fill online at /login/vendor.</p>
                <div className="max-h-28 overflow-y-auto border rounded-xl p-2 space-y-1">
                  {convertEligibleVendors.map((v) => (
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
                      {v.trade && <span className="text-[10px] text-steel-muted">· {v.trade}</span>}
                    </label>
                  ))}
                  {!convertEligibleVendors.length && (
                    <p className="text-xs text-steel-muted">No vendors tagged for selected disciplines — add them in Master → Vendors.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Create project + open bids</Button>
                <Button type="button" variant="secondary" onClick={() => setConvertLead(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {section === "projects" && (
        <CrmProjectsRegister
          projects={projects}
          canWrite={canManage}
          onEdit={(p) => setEditProject({ ...p })}
        />
      )}

      {section === "projects" && canManage && tab === "wizard" && (
        <Card>
          <h3 className="font-semibold mb-3">Create new project</h3>
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
              <p className="md:col-span-2 text-[11px] font-mono uppercase text-steel-muted pt-1">Client information (CRM card)</p>
              <Input placeholder="Client organisation" value={projectForm.clientName} onChange={(e) => setProjectForm({ ...projectForm, clientName: e.target.value })} />
              <Input placeholder="Client contact name" value={projectForm.clientContactName} onChange={(e) => setProjectForm({ ...projectForm, clientContactName: e.target.value })} />
              <Input placeholder="Client email" value={projectForm.clientEmail} onChange={(e) => setProjectForm({ ...projectForm, clientEmail: e.target.value })} />
              <Input placeholder="Client phone" value={projectForm.clientPhone} onChange={(e) => setProjectForm({ ...projectForm, clientPhone: e.target.value })} />
              <Input className="md:col-span-2" placeholder="Client address / site address" value={projectForm.clientAddress} onChange={(e) => setProjectForm({ ...projectForm, clientAddress: e.target.value })} />
              <Input placeholder="GST / tax ID" value={projectForm.clientGst} onChange={(e) => setProjectForm({ ...projectForm, clientGst: e.target.value })} />
              <Input placeholder="Site location" value={projectForm.location} onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })} />
              <Input placeholder="Design consultant" value={projectForm.designConsultant} onChange={(e) => setProjectForm({ ...projectForm, designConsultant: e.target.value })} />
              <Input placeholder="Main contractor" value={projectForm.contractorName} onChange={(e) => setProjectForm({ ...projectForm, contractorName: e.target.value })} />
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
              <p className="text-xs text-steel-muted">
                After assign, manage the full directory (employees + vendors) in{" "}
                <Link to="/hrm" className="text-brand font-semibold">
                  HR / Directory
                </Link>{" "}
                or the project Directory tool.
              </p>
              <Link to={`/projects/${createdId}`} className="inline-flex text-sm font-semibold text-brand">
                Open project tools →
              </Link>
            </div>
          )}
        </Card>
      )}

      {editProject && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-2xl mb-1">Client & project card</h3>
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
              <Input value={editProject.clientGst || ""} onChange={(e) => setEditProject({ ...editProject, clientGst: e.target.value })} placeholder="GST" />
              <Input value={editProject.designConsultant || ""} onChange={(e) => setEditProject({ ...editProject, designConsultant: e.target.value })} placeholder="Design consultant" />
              <Input value={editProject.contractorName || ""} onChange={(e) => setEditProject({ ...editProject, contractorName: e.target.value })} placeholder="Contractor" />
              <Input value={editProject.location || ""} onChange={(e) => setEditProject({ ...editProject, location: e.target.value })} placeholder="Location" />
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

    </div>
  );
}
