import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input } from "../../components/ui";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ProjectSetupMatrixDesk } from "../../components/ProjectSetupMatrixDesk";
import { SetupPartyMultiPick, type SetupVendor } from "../../components/SetupPartyMultiPick";
import { DirectoryMySignaturePanel } from "../../components/DirectoryMySignaturePanel";
import { DirectorySignOffRegister } from "../../components/DirectorySignOffRegister";

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  status?: string;
  clientName?: string | null;
  clientEmail?: string | null;
  location?: string | null;
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
  };
  lead?: { id: string; title: string; stage: string } | null;
  members: { id: string; userId: string; fullName: string; email: string; portalRole: string; role: string }[];
  vendors: { id: string; vendorId: string; name: string; partyType: string; email?: string | null }[];
};

type SetupStatus = {
  ready: boolean;
  checks: { key: string; ok: boolean; label: string; detail?: string }[];
};

type CompleteOut = {
  folders: { count: number; provider: string };
  clientPortals: { email: string; created: boolean; tempPassword?: string }[];
  contractorPortals: { email: string; created: boolean; tempPassword?: string }[];
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
  location: "",
  designConsultant: "",
  contractorName: "",
};

const STEPS: { id: Step; n: string; label: string }[] = [
  { id: "project", n: "1", label: "Project card" },
  { id: "matrix", n: "2", label: "Communication matrix" },
  { id: "launch", n: "3", label: "Portals · folders · DPR / WPR" },
];

export default function CrmProjectSetupPage() {
  const { token, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("projectId") || "";
  const step = (["project", "matrix", "launch"].includes(params.get("step") || "") ? params.get("step") : projectId ? "matrix" : "project") as Step;
  const canManage = user?.role === "admin" || user?.role === "office";

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [summary, setSummary] = useState<SetupSummary | null>(null);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [overview, setOverview] = useState<{ members?: any[]; vendors?: any[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_PROJECT);
  const [details, setDetails] = useState(EMPTY_PROJECT);
  const [consultantIds, setConsultantIds] = useState<string[]>([]);
  const [contractorIds, setContractorIds] = useState<string[]>([]);

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
      setOverview(null);
      return;
    }
    const [s, st, ov] = await Promise.all([
      api<SetupSummary>(`/api/projects/${projectId}/setup-summary`, { token }),
      api<SetupStatus>(`/api/projects/${projectId}/setup-status`, { token }).catch(() => null),
      api<{ members?: any[]; vendors?: any[] }>(`/api/directory/project/${projectId}/overview`, { token }).catch(
        () => null
      ),
    ]);
    setSummary(s);
    setStatus(st);
    setOverview(ov);
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
    });
    setConsultantIds(
      s.vendors.filter((v) => ["Consultant", "Designer", "PMC"].includes(v.partyType)).map((v) => v.vendorId)
    );
    setContractorIds(
      s.vendors.filter((v) => ["Contractor", "Vendor"].includes(v.partyType)).map((v) => v.vendorId)
    );
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
          vendorIds: [...consultantIds, ...contractorIds],
        }),
      });
      setCreateForm(EMPTY_PROJECT);
      await loadLists();
      setStep("matrix", created.id);
      setMsg(`Project ${created.code} created at ${createForm.location || "the client location"}. Fill the communication matrix next.`);
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
        body: JSON.stringify({ vendorIds: [...consultantIds, ...contractorIds] }),
      });
      setMsg("Project card, client location, consultants and contractors saved.");
      await loadProject();
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
      const out = await api<CompleteOut>(`/api/projects/${projectId}/complete-setup`, { method: "POST", token });
      const passwords = [...out.clientPortals, ...out.contractorPortals]
        .filter((p) => p.created && p.tempPassword)
        .map((p) => `${p.email} → ${p.tempPassword}`);
      setMsg(
        [
          `Setup complete: ${out.folders.count} folders (${out.folders.provider}).`,
          `Comms +${out.comms.contacts.created} contacts.`,
          `DPR ${out.reports.dpr.status} for ${out.reports.dpr.logDate}.`,
          `WPR ${out.reports.wpr.status} week ending ${out.reports.wpr.weekEnding}.`,
          passwords.length ? `New portal passwords: ${passwords.join("; ")}` : "Existing portal logins reused.",
        ].join(" ")
      );
      await loadProject();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Complete setup failed");
    } finally {
      setBusy(false);
    }
  }

  function rememberVendor(v: SetupVendor) {
    setVendors((prev) => (prev.some((x) => x.id === v.id) ? prev : [v, ...prev]));
  }

  if (!canManage) {
    return <p className="p-6 text-sm text-steel-muted">Office access is required for project setup.</p>;
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wide text-steel-muted">CRM · project start</p>
          <h2 className="font-display text-lg text-ink">Project setup</h2>
          <p className="text-xs text-steel-muted mt-1 max-w-3xl leading-relaxed">
            Start the delivery project here. The BPCL communication matrix (Technical and Commercial — all person fields)
            can be filled in this step or later in Comms. It is not required to launch. Complete setup seeds clean registers
            for DPR / WPR; each week and day is saved as history.
          </p>
        </div>
        {summary && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{summary.project.code}</Badge>
            <span className="text-sm font-medium">{summary.project.name}</span>
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
            {projectId ? (
              <form className="grid sm:grid-cols-2 gap-2" onSubmit={saveDetails}>
                <Input placeholder="Project name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
                <Input placeholder="Client organisation" value={details.clientName} onChange={(e) => setDetails({ ...details, clientName: e.target.value })} />
                <Input required placeholder="Client location (site / city)" value={details.location} onChange={(e) => setDetails({ ...details, location: e.target.value })} />
                <Input placeholder="Client contact" value={details.clientContactName} onChange={(e) => setDetails({ ...details, clientContactName: e.target.value })} />
                <Input type="email" placeholder="Client email" value={details.clientEmail} onChange={(e) => setDetails({ ...details, clientEmail: e.target.value })} />
                <Input placeholder="Client phone" value={details.clientPhone} onChange={(e) => setDetails({ ...details, clientPhone: e.target.value })} />
                <Input className="sm:col-span-2" placeholder="Client office address" value={details.clientAddress} onChange={(e) => setDetails({ ...details, clientAddress: e.target.value })} />
                <div className="sm:col-span-2 grid lg:grid-cols-2 gap-3">
                  <SetupPartyMultiPick
                    token={token}
                    title="Consultants (multiple)"
                    kind="Consultant"
                    vendors={vendors}
                    selectedIds={consultantIds}
                    onChange={setConsultantIds}
                    onCreated={rememberVendor}
                    onMsg={setMsg}
                    busy={busy}
                  />
                  <SetupPartyMultiPick
                    token={token}
                    title="Contractors (multiple)"
                    kind="Contractor"
                    vendors={vendors}
                    selectedIds={contractorIds}
                    onChange={setContractorIds}
                    onCreated={rememberVendor}
                    onMsg={setMsg}
                    busy={busy}
                  />
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <Button type="submit" variant="secondary" disabled={busy}>
                    Save project card
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => setStep("matrix")}>
                    Next · Communication matrix
                  </Button>
                </div>
              </form>
            ) : (
              <form className="grid sm:grid-cols-2 gap-2" onSubmit={createProject}>
                <Input required placeholder="Project code" value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} />
                <Input required placeholder="Project name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                <Input placeholder="Client organisation" value={createForm.clientName} onChange={(e) => setCreateForm({ ...createForm, clientName: e.target.value })} />
                <Input required placeholder="Client location (site / city)" value={createForm.location} onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })} />
                <Input placeholder="Client contact" value={createForm.clientContactName} onChange={(e) => setCreateForm({ ...createForm, clientContactName: e.target.value })} />
                <Input type="email" placeholder="Client email (portal login)" value={createForm.clientEmail} onChange={(e) => setCreateForm({ ...createForm, clientEmail: e.target.value })} />
                <Input placeholder="Client phone" value={createForm.clientPhone} onChange={(e) => setCreateForm({ ...createForm, clientPhone: e.target.value })} />
                <Input placeholder="Client office address" value={createForm.clientAddress} onChange={(e) => setCreateForm({ ...createForm, clientAddress: e.target.value })} />
                <div className="sm:col-span-2 grid lg:grid-cols-2 gap-3">
                  <SetupPartyMultiPick
                    token={token}
                    title="Consultants (multiple)"
                    kind="Consultant"
                    vendors={vendors}
                    selectedIds={consultantIds}
                    onChange={setConsultantIds}
                    onCreated={rememberVendor}
                    onMsg={setMsg}
                    busy={busy}
                  />
                  <SetupPartyMultiPick
                    token={token}
                    title="Contractors (multiple)"
                    kind="Contractor"
                    vendors={vendors}
                    selectedIds={contractorIds}
                    onChange={setContractorIds}
                    onCreated={rememberVendor}
                    onMsg={setMsg}
                    busy={busy}
                  />
                </div>
                <Button type="submit" className="sm:col-span-2" disabled={busy}>
                  Create project and open matrix
                </Button>
              </form>
            )}
          </Card>
          <Card className="!p-4 space-y-2">
            <label className="text-xs font-semibold text-steel-muted">Or continue an existing project</label>
            <SearchableSelect
              options={projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}`, sublabel: p.clientName || p.location || undefined }))}
              value={projectId}
              onChange={(id) => setStep(id ? "project" : "project", id)}
              placeholder="Select a project…"
              searchPlaceholder="Search code or client…"
            />
            {summary?.lead && <p className="text-xs text-steel-muted">From lead: {summary.lead.title}</p>}
          </Card>
        </div>
      )}

      {step === "matrix" && projectId && token && (
        <div className="space-y-4">
          {summary && (
            <p className="text-xs text-steel-muted">
              Assigned so far: {summary.members.length} people · {summary.vendors.length} companies. New rows below go into
              Comms and, if you choose, People / Vendors / portal logins.
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
                Writes the matrix into Comms, issues client and contractor portal logins, creates the ISO folder tree, and
                seeds the first DPR and WPR from live data.
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
                  <Badge tone={c.ok ? "ok" : "neutral"}>{c.ok ? "Ready" : "Pending"}</Badge>
                  <span className="font-medium">{c.label}</span>
                </div>
                {c.detail && <p className="text-xs text-steel-muted mt-1">{c.detail}</p>}
              </li>
            ))}
          </ul>
          <div className="border border-amber-200 bg-amber-50/70 rounded-xl p-3 space-y-3">
            <div>
              <h4 className="font-semibold text-sm">Signatures (if missing)</h4>
              <p className="text-xs text-steel-muted mt-0.5">
                PMC, client, and contractor sign-offs must live on this project before checklists and the WPR deck export.
              </p>
            </div>
            <DirectoryMySignaturePanel projectId={projectId} token={token} compact />
            <DirectorySignOffRegister
              projectId={projectId}
              token={token}
              members={overview?.members || []}
              vendors={overview?.vendors || []}
              canEditAll={canManage}
              currentUserId={user?.id}
              currentUserEmail={user?.email}
              currentUserVendorId={user?.vendorId}
              onSaved={() => void loadProject()}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link to={`/projects/${projectId}/comms`} className="font-semibold text-brand">
              Comms →
            </Link>
            <Link to={`/projects/${projectId}/dms`} className="font-semibold text-brand">
              Document library →
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
