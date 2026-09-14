import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader } from "../../components/ui";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ProjectSetupMatrixDesk } from "../../components/ProjectSetupMatrixDesk";
import { SetupPartyMultiPick, type SetupVendor } from "../../components/SetupPartyMultiPick";
import { WorkPackagesPanel } from "../../components/WorkPackagesPanel";
import { ProjectManageActions } from "../../components/ProjectManageActions";

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  status?: string;
  clientName?: string | null;
  clientEmail?: string | null;
  location?: string | null;
  alreadyExists?: boolean;
};

type UserRow = { id: string; fullName: string; email: string; role: string; phone?: string | null };
type VendorRow = {
  id: string;
  name: string;
  partyType?: string;
  trade?: string | null;
  email?: string | null;
  primaryContactName?: string | null;
  businessPhone?: string | null;
  address?: string | null;
};

type SetupSummary = {
  project: ProjectRow & {
    clientContactName?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
    designConsultant?: string | null;
    contractorName?: string | null;
    pmcName?: string | null;
    clientGst?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  lead?: { id: string; title: string; stage: string } | null;
  members: { id: string; userId: string; fullName: string; email: string; portalRole: string; role: string }[];
  vendors: {
    id: string;
    vendorId: string;
    name: string;
    partyType: string;
    email?: string | null;
    trade?: string | null;
    tradeRole?: string | null;
    packages?: string[];
  }[];
};

type SetupCheck = { key: string; ok: boolean; label: string; detail?: string; optional?: boolean };
type SetupStatus = {
  ready: boolean;
  checks: SetupCheck[];
};

function setupCheckBadge(c: SetupCheck): { tone: "ok" | "neutral"; label: string } {
  if (c.optional && !c.ok) return { tone: "neutral", label: "Optional" };
  if (c.optional) return { tone: "ok", label: "Optional" };
  return c.ok ? { tone: "ok", label: "Ready" } : { tone: "neutral", label: "Pending" };
}

type CompleteOut = {
  folders: { count: number; provider: string };
  clientPortals: { email: string; created: boolean; tempPassword?: string }[];
  contractorPortals: { email: string; created: boolean; tempPassword?: string }[];
  stakeholderPortals?: { email: string; created: boolean; tempPassword?: string }[];
  reports: {
    dpr: { created: boolean; logDate: string; status: string };
    wpr: { created: boolean; weekEnding: string; status: string };
  };
  comms: { contacts: { created: number } };
};

type Step = "project" | "matrix" | "launch";

const EMPTY_PROJECT = {
  code: "",
  name: "",
  clientName: "",
  clientContactName: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  clientGst: "",
  location: "",
  designConsultant: "",
  contractorName: "",
  pmcName: "SPDC",
  startDate: "",
  endDate: "",
};

function dayField(v?: string | null) {
  return v ? String(v).slice(0, 10) : "";
}

const STEPS: { id: Step; n: string; label: string }[] = [
  { id: "project", n: "1", label: "Project card" },
  { id: "matrix", n: "2", label: "Communication matrix" },
  { id: "launch", n: "3", label: "Portals · folders · DPR / WPR" },
];

export default function CrmProjectSetupPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("projectId") || "";
  const step = (["project", "matrix", "launch"].includes(params.get("step") || "") ? params.get("step") : "project") as Step;
  const canManage = user?.role === "admin" || user?.role === "office";

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [summary, setSummary] = useState<SetupSummary | null>(null);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_PROJECT);
  const [details, setDetails] = useState(EMPTY_PROJECT);
  const [consultantIds, setConsultantIds] = useState<string[]>([]);
  const [contractorIds, setContractorIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectPackages, setProjectPackages] = useState<string[]>([]);

  const setStep = (next: Step, id = projectId) => {
    const q = new URLSearchParams();
    if (id) q.set("projectId", id);
    q.set("step", next);
    setParams(q, { replace: true });
  };

  const loadLists = useCallback(async () => {
    if (!token || !canManage) return;
    const [p, u, v] = await Promise.all([
      api<ProjectRow[]>("/api/projects", { token }),
      api<UserRow[]>("/api/users", { token }).catch(() => []),
      api<VendorRow[]>("/api/vendors", { token }).catch(() => []),
    ]);
    setProjects(p);
    setUsers(u);
    setVendors(v);
  }, [token, canManage]);

  const loadProject = useCallback(async () => {
    if (!token || !projectId) {
      setSummary(null);
      setStatus(null);
      return;
    }
    const [s, st] = await Promise.all([
      api<SetupSummary>(`/api/projects/${projectId}/setup-summary`, { token }),
      api<SetupStatus>(`/api/projects/${projectId}/setup-status`, { token }).catch(() => null),
    ]);
    setSummary(s);
    setStatus(st);
    setDetails({
      code: s.project.code,
      name: s.project.name,
      clientName: s.project.clientName || "",
      clientContactName: s.project.clientContactName || "",
      clientEmail: s.project.clientEmail || "",
      clientPhone: s.project.clientPhone || "",
      clientAddress: s.project.clientAddress || "",
      location: s.project.location || "",
      designConsultant: s.project.designConsultant || "",
      contractorName: s.project.contractorName || "",
      pmcName: s.project.pmcName || "SPDC",
      clientGst: s.project.clientGst || "",
      startDate: dayField(s.project.startDate),
      endDate: dayField(s.project.endDate),
    });
    setConsultantIds(
      s.vendors.filter((v) => ["Consultant", "Designer", "PMC"].includes(v.partyType)).map((v) => v.vendorId)
    );
    setContractorIds(
      s.vendors.filter((v) => ["Contractor", "Vendor"].includes(v.partyType)).map((v) => v.vendorId)
    );
    const clientRow = s.vendors.find((v) => v.partyType === "Client");
    setClientId(clientRow?.vendorId || "");
    void api<{ workPackages?: string }>(`/api/projects/${projectId}`, { token })
      .then((p) => {
        try {
          const parsed = p.workPackages ? JSON.parse(p.workPackages) : [];
          setProjectPackages(Array.isArray(parsed) ? parsed : []);
        } catch {
          setProjectPackages([]);
        }
      })
      .catch(() => setProjectPackages([]));
  }, [token, projectId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const firstConsultant = vendors.find((v) => consultantIds.includes(v.id));
      const firstContractor = vendors.find((v) => contractorIds.includes(v.id));
      const created = await api<ProjectRow>("/api/projects", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...createForm,
          designConsultant: createForm.designConsultant || firstConsultant?.name || "",
          contractorName: createForm.contractorName || firstContractor?.name || "",
          vendorIds: [...consultantIds, ...contractorIds, ...(clientId ? [clientId] : [])],
        }),
      });
      setCreateForm(EMPTY_PROJECT);
      await loadLists();
      setStep("project", created.id);
      setMsg(
        created.alreadyExists
          ? `Project ${created.code} already exists — opened the saved card. Update details below, then continue.`
          : `Project ${created.code} saved. Continue the communication matrix, then launch folders.`
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        token,
        body: JSON.stringify(details),
      });
      await api(`/api/projects/${projectId}/assign-parties`, {
        method: "POST",
        token,
        body: JSON.stringify({ vendorIds: [...consultantIds, ...contractorIds, ...(clientId ? [clientId] : [])] }),
      });
      setMsg("Project card saved. Details stay on this project — continue matrix, or launch to go live.");
      await loadProject();
      setStep("project", projectId);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function completeSetup() {
    if (!projectId) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<CompleteOut & { status?: string }>(`/api/projects/${projectId}/complete-setup`, { method: "POST", token });
      const passwords = [...out.clientPortals, ...out.contractorPortals, ...(out.stakeholderPortals || [])]
        .filter((p) => p.created && p.tempPassword)
        .map((p) => `${p.email} → ${p.tempPassword}`);
      setMsg(
        [
          `Setup complete: ${out.folders.count} folders (${out.folders.provider}).`,
          `Comms +${out.comms.contacts.created} contacts.`,
          passwords.length ? `New portal passwords: ${passwords.join("; ")}` : "Existing portal logins reused.",
          "Client signs in at /login/client. Design consultants and other consultants sign in at /login/stakeholder.",
        ].join(" ")
      );
      await loadProject();
      navigate(`/projects/${projectId}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Complete setup failed");
    } finally {
      setBusy(false);
    }
  }

  function rememberVendor(v: SetupVendor) {
    setVendors((prev) => (prev.some((x) => x.id === v.id) ? prev : [v, ...prev]));
  }

  function applyClient(id: string, into: "create" | "details") {
    setClientId(id);
    const c = vendors.find((v) => v.id === id);
    if (!c) return;
    const patch = {
      clientName: c.name,
      clientContactName: c.primaryContactName || "",
      clientEmail: c.email || "",
      clientPhone: c.businessPhone || "",
      clientAddress: c.address || "",
    };
    if (into === "create") setCreateForm((f) => ({ ...f, ...patch }));
    else setDetails((f) => ({ ...f, ...patch }));
  }

  const clientOptions = vendors.filter((v) => v.partyType === "Client");

  if (!canManage) {
    return <p className="p-6 text-sm text-steel-muted">Office access is required for project setup.</p>;
  }

  return (
    <div className="space-y-4 p-4 sm:p-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="CRM · project start"
          title="Project setup"
          subtitle="Code and name first. Pick the client, consultants, and vendors from the CRM lists (logins are created there). Then fill the communication matrix. Bid management is a separate tool."
        />
        {summary && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{summary.project.code}</Badge>
            <span className="text-sm font-medium">{summary.project.name}</span>
            {status?.ready ? <Badge tone="ok">Ready to launch</Badge> : <Badge tone="warn">Setup in progress</Badge>}
            <ProjectManageActions
              project={summary.project}
              token={token}
              showEdit={false}
              onChanged={() => void loadLists()}
            />
            <Link to={`/projects/${summary.project.id}`}>
              <Button type="button" variant="secondary">
                Open project desk
              </Button>
            </Link>
          </div>
        )}
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Setup steps">
        {STEPS.map((s) => {
          const locked = s.id !== "project" && !projectId;
          const on = step === s.id;
          return (
            <button
              key={s.id}
              type="button"
              disabled={locked}
              onClick={() => setStep(s.id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                on ? "text-white border-transparent" : "bg-paper border-line text-steel-muted"
              } disabled:opacity-40`}
              style={on ? { background: "#0B6A78", borderColor: "#0B6A78" } : undefined}
            >
              {s.n}. {s.label}
            </button>
          );
        })}
      </nav>

      {msg && <p className="text-sm text-ok leading-relaxed">{msg}</p>}

      {step === "project" && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <Card className="!p-4 space-y-3">
            <h3 className="font-semibold text-sm">{projectId ? "Project card" : "New delivery project"}</h3>
            <form
              className="grid sm:grid-cols-2 gap-2"
              onSubmit={projectId ? saveDetails : createProject}
            >
              <Input
                required
                disabled={!!projectId}
                placeholder="Project code"
                value={projectId ? details.code : createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
              />
              <Input
                required
                placeholder="Project name"
                value={projectId ? details.name : createForm.name}
                onChange={(e) =>
                  projectId
                    ? setDetails({ ...details, name: e.target.value })
                    : setCreateForm({ ...createForm, name: e.target.value })
                }
              />
              <Input
                required
                placeholder="Site / city"
                value={projectId ? details.location : createForm.location}
                onChange={(e) =>
                  projectId
                    ? setDetails({ ...details, location: e.target.value })
                    : setCreateForm({ ...createForm, location: e.target.value })
                }
              />
              <Input
                placeholder="PMC name"
                value={projectId ? details.pmcName : createForm.pmcName}
                onChange={(e) =>
                  projectId
                    ? setDetails({ ...details, pmcName: e.target.value })
                    : setCreateForm({ ...createForm, pmcName: e.target.value })
                }
              />
              <label className="text-xs text-steel-muted">
                Start date
                <Input
                  type="date"
                  value={projectId ? details.startDate : createForm.startDate}
                  onChange={(e) =>
                    projectId
                      ? setDetails({ ...details, startDate: e.target.value })
                      : setCreateForm({ ...createForm, startDate: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-steel-muted">
                End date
                <Input
                  type="date"
                  value={projectId ? details.endDate : createForm.endDate}
                  onChange={(e) =>
                    projectId
                      ? setDetails({ ...details, endDate: e.target.value })
                      : setCreateForm({ ...createForm, endDate: e.target.value })
                  }
                />
              </label>
              <div className="sm:col-span-2 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-steel-muted">Client (from Client directory)</span>
                  <Link to="/crm/directory/clients" className="text-[11px] font-semibold text-brand">
                    Add a client + login →
                  </Link>
                </div>
                <SearchableSelect
                  options={clientOptions.map((c) => ({
                    value: c.id,
                    label: c.name,
                    sublabel: [c.primaryContactName, c.email].filter(Boolean).join(" · ") || undefined,
                    keywords: `${c.name} ${c.email || ""} ${c.primaryContactName || ""}`,
                  }))}
                  value={clientId}
                  onChange={(id) => applyClient(id, projectId ? "details" : "create")}
                  placeholder="Pick client company…"
                  searchPlaceholder="Search client directory…"
                />
              </div>
              <div className="sm:col-span-2 grid lg:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Link to="/crm/directory/stakeholders" className="text-[11px] font-semibold text-brand">
                    Maintain consultants →
                  </Link>
                  <SetupPartyMultiPick
                    token={token}
                    title="Consultants on this project"
                    kind="Consultant"
                    vendors={vendors}
                    selectedIds={consultantIds}
                    onChange={setConsultantIds}
                    onCreated={rememberVendor}
                    onMsg={setMsg}
                    busy={busy}
                  />
                </div>
                <div className="space-y-1">
                  <Link to="/crm/directory/vendors" className="text-[11px] font-semibold text-brand">
                    Maintain vendors →
                  </Link>
                  <SetupPartyMultiPick
                    token={token}
                    title="Vendors / contractors on this project"
                    kind="Contractor"
                    vendors={vendors}
                    selectedIds={contractorIds}
                    onChange={setContractorIds}
                    onCreated={rememberVendor}
                    onMsg={setMsg}
                    busy={busy}
                  />
                </div>
              </div>
              {projectId && token ? (
                <div className="sm:col-span-2">
                  <WorkPackagesPanel
                    token={token}
                    projectId={projectId}
                    onSaved={(pkgs) => {
                      setProjectPackages(pkgs);
                      setMsg("Work packages saved.");
                    }}
                  />
                </div>
              ) : null}
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <Button type="submit" variant="secondary" disabled={busy}>
                  Save project card
                </Button>
                {projectId ? (
                  <Button type="button" disabled={busy} onClick={() => setStep("matrix")}>
                    Next · Communication matrix
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
          <Card className="!p-4 space-y-3">
            <label className="text-xs font-semibold text-steel-muted">Continue a stored project</label>
            <SearchableSelect
              options={projects.map((p) => ({
                value: p.id,
                label: `${p.code} · ${p.name}`,
                sublabel: p.clientName || p.location || undefined,
                keywords: `${p.code} ${p.name} ${p.clientName || ""} ${p.location || ""}`,
              }))}
              value={projectId}
              onChange={(id) => setStep(id ? "project" : "project", id)}
              placeholder="Select a project…"
              searchPlaceholder="Search project or client by name…"
            />
            {summary?.lead && <p className="text-xs text-steel-muted">From lead: {summary.lead.title}</p>}
            {summary && (
              <p className="text-xs text-steel-muted leading-relaxed">
                Stored: {summary.members.length} people · {summary.vendors.length} companies
                {details.location ? ` · ${details.location}` : ""}.
              </p>
            )}
            <ul className="space-y-1.5">
              {(status?.checks || []).map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-xs">
                  <Badge tone={setupCheckBadge(c).tone}>{c.optional ? "Optional" : c.ok ? "Saved" : "Open"}</Badge>
                  <span>
                    <span className="font-medium">{c.label}</span>
                    {c.detail && <span className="block text-steel-muted">{c.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {step === "matrix" && projectId && token && (
        <div className="space-y-4">
          {summary && (
            <p className="text-xs text-steel-muted">
              Assigned so far: {summary.members.length} people · {summary.vendors.length} companies. Add contacts to the
              matrix only — create logins in Client / Consultant / Vendor directories, not here.
            </p>
          )}
          <ProjectSetupMatrixDesk
            projectId={projectId}
            token={token}
            project={summary?.project}
            users={users}
            vendors={vendors}
            canEdit={canManage}
            onMsg={setMsg}
            onDirectoryChange={async () => {
              await loadLists();
              await loadProject();
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep("project")}>
              Back · Project card
            </Button>
            <Button type="button" onClick={() => setStep("launch")}>
              Next · Launch (matrix optional)
            </Button>
            <Link to={`/projects/${projectId}/comms`} className="text-sm font-semibold text-brand self-center">
              Open in-project Comms →
            </Link>
          </div>
        </div>
      )}

      {step === "matrix" && !projectId && (
        <p className="text-sm text-steel-muted">Create or select a project first.</p>
      )}

      {step === "launch" && projectId && (
        <Card className="!p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm">Launch this project</h3>
              <p className="text-xs text-steel-muted mt-0.5">
                Creates the ISO folder tree and writes the matrix into Comms. Client / consultant / vendor logins come from
                the CRM directories. Open a bid later from Bid management — not from this page.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void completeSetup()}>
                Complete setup
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !projectId}
                onClick={async () => {
                  if (!projectId || !token) return;
                  setBusy(true);
                  try {
                    const out = await api<{ sent: { email: string }[]; sharePassword: string }>(
                      `/api/projects/${projectId}/send-portal-invites`,
                      { method: "POST", token, body: JSON.stringify({}) }
                    );
                    setMsg(
                      `Portal invites emailed to ${out.sent.length} people. Shared password: ${out.sharePassword}. They can forward the login email.`
                    );
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Invite send failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Email portal credentials
              </Button>
            </div>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2">
            {(status?.checks || []).map((c) => (
              <li key={c.key} className="border border-line rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge tone={setupCheckBadge(c).tone}>{setupCheckBadge(c).label}</Badge>
                  <span className="font-medium">{c.label}</span>
                </div>
                {c.detail && <p className="text-xs text-steel-muted mt-1">{c.detail}</p>}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link to={`/projects/${projectId}/comms`} className="font-semibold text-brand">
              Comms →
            </Link>
            <Link to={`/projects/${projectId}/dms`} className="font-semibold text-brand">
              Document library →
            </Link>
            <Link to={`/crm/bids?projectId=${projectId}`} className="font-semibold text-brand">
              Bid management (separate) →
            </Link>
            <Link to={`/projects/${projectId}/dpr-maker`} className="font-semibold text-brand">
              DPR maker →
            </Link>
            <Link to={`/projects/${projectId}/wpr-maker`} className="font-semibold text-brand">
              WPR maker →
            </Link>
            <Link to="/login/client" className="font-semibold text-brand">
              Client portal →
            </Link>
            <Link to="/login/vendor" className="font-semibold text-brand">
              Contractor portal →
            </Link>
          </div>
          <Button type="button" variant="secondary" onClick={() => setStep("matrix")}>
            Back · Communication matrix
          </Button>
        </Card>
      )}
    </div>
  );
}
