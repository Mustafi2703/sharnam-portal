import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  leadPrimaryAction,
  marketStatusTone,
} from "../lib/crmLeadUtils";
import { openModuleToolWindow, withToolWindowParam } from "../lib/moduleToolWindow";

function openCrmSetup(projectId: string) {
  const href = `/crm/setup?projectId=${projectId}&step=project`;
  const w = openModuleToolWindow(href, "Project setup");
  if (!w) window.location.assign(withToolWindowParam(href, true));
}

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
  const [leads, setLeads] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [bidPackages, setBidPackages] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [leadAddOpen, setLeadAddOpen] = useState(false);
  const leadFormRef = useRef<HTMLDivElement>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState({
    title: "",
    contactName: "",
    email: "",
    phone: "",
    stage: "New",
    value: "",
  });
  const [deleteProject, setDeleteProject] = useState<any | null>(null);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [leadsView, setLeadsView] = useState<LeadsView>("register");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const canManage = user?.role === "admin" || user?.role === "office";

  function openSetupBids(lead: CrmLead) {
    if (!lead.projectId) return;
    navigate(`/crm/bids?projectId=${lead.projectId}&leadId=${lead.id}`);
  }

  function openConvert(lead: CrmLead) {
    if (convertingId) return;
    if (lead.projectId) {
      openCrmSetup(lead.projectId);
      return;
    }
    const existing = lead.quotations?.find((q) => (q.status || "").toLowerCase() !== "lost") || lead.quotations?.[0];
    if (existing?.id) {
      navigate(`/crm/proposals/${existing.id}`);
      return;
    }
    setConvertingId(lead.id);
    void (async () => {
      try {
        const row = await api<{ id: string; alreadyExisted?: boolean }>(`/api/crm/leads/${lead.id}/to-proposal`, {
          method: "POST",
          token,
        });
        setMsg(
          row.alreadyExisted
            ? "Opened the existing proposal."
            : "Proposal file created in SharePoint. Edit the client format, add revisions here, then Award to put a Planning job on Projects.",
        );
        navigate(`/crm/proposals/${row.id}`);
        await load();
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Could not convert to proposal");
      } finally {
        setConvertingId(null);
      }
    })();
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
    const [p, l, q, bp] = await Promise.all([
      api<any[]>("/api/projects", { token }).catch((err) => {
        setMsg(err instanceof Error ? err.message : "Could not load projects register");
        return [];
      }),
      canManage ? api<any[]>("/api/crm/leads", { token }).catch(() => []) : Promise.resolve([]),
      api<any[]>("/api/crm/quotations", { token }).catch(() => []),
      canManage ? api<any[]>("/api/crm/bid-packages", { token }).catch(() => []) : Promise.resolve([]),
    ]);
    setProjects(p);
    setLeads(l);
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

  return (
    <div className="space-y-6 pb-4">
      {msg && <p className="text-sm text-ok shrink-0">{msg}</p>}

      {section === "proposals" && (
        <>
          <p className="text-xs text-steel-muted max-w-3xl leading-relaxed">
            PMC proposals live in SharePoint. Open a row to edit in Word, mark <strong className="text-ink">Sent to client</strong>, add a new version, then <strong className="text-ink">Award</strong> to put the job on Projects as Planning. Add companies on CRM → Clients — not on a separate directory page.
          </p>
          <CrmProposalsRegister quotations={quotations} canWrite={canManage} onRefresh={() => void load()} />
        </>
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
              <div className="text-[10px] font-mono uppercase text-steel-muted">Awarded to projects</div>
              <div className="font-display text-3xl">{leads.filter((l) => l.projectId).length}</div>
            </Card>
          </div>

          <ReferenceSheetToolbar
            sheetLabel="CRM market register"
            rowCount={leads.length}
            canEdit
            onAddRow={() => {
              setLeadAddOpen(true);
              requestAnimationFrame(() => leadFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
            }}
            addRowLabel="+ New lead"
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
                ["converted", "Awarded (on projects)"],
                ["market", "By market status"],
              ] as const
            ).map(([key, label]) => (
              <Button key={key} variant={leadsView === key ? "primary" : "secondary"} onClick={() => setLeadsView(key)}>
                {label}
              </Button>
            ))}
          </div>

          {leadAddOpen && (
          <div ref={leadFormRef}>
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
          </div>
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
                        <Button className="!text-xs !py-1 !px-2" onClick={() => openConvert(lead)}>
                          {leadPrimaryAction(lead).label} →
                        </Button>
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
                        {stage !== "Lost" ? (
                          <Button className="!text-xs !py-1 !px-2 w-full" onClick={() => openConvert(lead)}>
                            {leadPrimaryAction(lead).label} →
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

        </>
      )}


      {section === "projects" && (
        <>
          <Card className="!p-5 border-brand/30 bg-brand-soft/40 shrink-0">
            <h3 className="font-display text-lg mb-1">Projects register</h3>
            <p className="text-sm text-steel-muted mb-3">
              Awarded proposals land here as Planning, ready for Project setup. Jobs that did not come from a lead can still be created from Project setup.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/crm/leads">
                <Button type="button">Go to leads →</Button>
              </Link>
              <Link to="/crm/setup">
                <Button type="button" variant="secondary">
                  + New project →
                </Button>
              </Link>
            </div>
          </Card>
          <CrmProjectsRegister
            projects={projects}
            canWrite={canManage}
            onDelete={(p) => {
              setDeleteProject(p);
              setDeleteCode("");
            }}
          />
        </>
      )}

      {deleteProject && token && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-md space-y-3">
            <h3 className="font-display text-xl">Delete {deleteProject.code}?</h3>
            <p className="text-sm text-steel-muted">
              Type the project code to confirm. QAP, cube, drawings, and fills go with it.
            </p>
            <Input value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder={deleteProject.code} />
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={deleteCode.trim().toUpperCase() !== String(deleteProject.code || "").toUpperCase() || deleteBusy}
                onClick={async () => {
                  setDeleteBusy(true);
                  try {
                    await api(`/api/projects/${deleteProject.id}`, {
                      method: "DELETE",
                      token,
                      body: JSON.stringify({ confirmCode: deleteCode.trim() }),
                    });
                    setMsg(`Deleted ${deleteProject.code}.`);
                    setDeleteProject(null);
                    await load();
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Delete failed");
                  } finally {
                    setDeleteBusy(false);
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

    </div>
  );
}
