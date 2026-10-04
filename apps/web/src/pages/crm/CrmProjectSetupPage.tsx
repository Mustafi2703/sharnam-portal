import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";
import { SearchableSelect } from "../../components/SearchableSelect";
import { ProjectSetupMatrixDesk } from "../../components/ProjectSetupMatrixDesk";
import { SetupPartyMultiPick } from "../../components/SetupPartyMultiPick";
import { WorkPackagesPanel } from "../../components/WorkPackagesPanel";
import { ProjectTeamAllocatePanel } from "../../components/ProjectTeamAllocatePanel";
import { ProjectClientRepresentativesPanel, type ProjectClientRep } from "../../components/ProjectClientRepresentativesPanel";
import { ProjectManageActions } from "../../components/ProjectManageActions";
import { PROJECT_STATUSES, projectStatusHint } from "../../lib/projectStatus";
import { trimField } from "../../lib/stringUtils";
import { uiCopy } from "../../lib/formatUiText";
import { isSpdcStaffMember, isSpdcStaffUser } from "../../lib/spdcStaff";
import { suggestedProjectMemberRole } from "@sharnam/shared";
import { parseWorkPackagesField, sanitizeProjectWorkPackages } from "../../lib/workPackages";
import { StatusNote } from "../../components/StatusNote";

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

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string | null;
  vendorId?: string | null;
  designation?: string | null;
  department?: string | null;
  empCode?: string | null;
};
type VendorRow = {
  id: string;
  name: string;
  partyType?: string;
  trade?: string | null;
  email?: string | null;
  primaryContactName?: string | null;
  businessPhone?: string | null;
  address?: string | null;
  gstNumber?: string | null;
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
    clientLogoUrl?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  lead?: { id: string; title: string; stage: string } | null;
  clientRepresentatives?: ProjectClientRep[];
  members: {
    id: string;
    userId: string;
    fullName: string;
    email: string;
    portalRole: string;
    role: string;
    vendorId?: string | null;
    designation?: string | null;
    department?: string | null;
    empCode?: string | null;
  }[];
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
  status: "Planning",
};

function dayField(v?: string | null) {
  return v ? String(v).slice(0, 10) : "";
}

const STEPS: { id: Step; n: string; label: string }[] = [
  { id: "project", n: "1", label: uiCopy("Card · parties · SPDC team") },
  { id: "matrix", n: "2", label: uiCopy("Communication matrix · export") },
  { id: "launch", n: "3", label: uiCopy("Launch") },
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
  const [mailPreview, setMailPreview] = useState<{ to: string[]; cc: string[] } | null>(null);
  const [createForm, setCreateForm] = useState(EMPTY_PROJECT);
  const [details, setDetails] = useState(EMPTY_PROJECT);
  const [consultantIds, setConsultantIds] = useState<string[]>([]);
  const [contractorIds, setContractorIds] = useState<string[]>([]);
  const [pmcIds, setPmcIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectPackages, setProjectPackages] = useState<string[]>([]);
  const [staffIds, setStaffIds] = useState<string[]>([]);

  const setStep = (next: Step, id = projectId) => {
    const q = new URLSearchParams();
    if (id) q.set("projectId", id);
    q.set("step", next);
    setParams(q, { replace: true });
  };

  const loadLists = useCallback(async () => {
    if (!token || !canManage) return;
    const [p, u, v] = await Promise.all([
      api<ProjectRow[]>("/api/projects", { token }).catch((err) => {
        setMsg(err instanceof Error ? err.message : "Could not load projects register");
        return [] as ProjectRow[];
      }),
      api<UserRow[]>("/api/users?kind=staff", { token }).catch(() => []),
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
      setStaffIds([]);
      setProjectPackages([]);
      setConsultantIds([]);
      setContractorIds([]);
      setPmcIds([]);
      setClientId("");
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
      status: s.project.status || "Planning",
    });
    setConsultantIds(
      s.vendors.filter((v) => ["Consultant", "Designer"].includes(v.partyType)).map((v) => v.vendorId)
    );
    setPmcIds(s.vendors.filter((v) => v.partyType === "PMC").map((v) => v.vendorId));
    setContractorIds(
      s.vendors.filter((v) => ["Contractor", "Vendor"].includes(v.partyType)).map((v) => v.vendorId)
    );
    const clientRow =
      s.vendors.find((v) => v.partyType === "Client") ||
      s.vendors.find((v) => v.email && v.email === s.project.clientEmail) ||
      s.vendors.find((v) => v.name && v.name === s.project.clientName);
    setClientId((prev) => {
      if (prev && s.vendors.some((v) => v.vendorId === prev)) return prev;
      return clientRow?.vendorId || "";
    });
    setStaffIds(
      s.members.filter((m) => isSpdcStaffMember(m)).map((m) => m.userId).filter(Boolean)
    );
    void api<{ workPackages?: string | string[] }>(`/api/projects/${projectId}`, { token })
      .then((p) => {
        setProjectPackages(sanitizeProjectWorkPackages(parseWorkPackagesField(p.workPackages)));
      })
      .catch(() => setProjectPackages([]));
  }, [token, projectId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (clientId) return;
    const email = trimField(details.clientEmail || createForm.clientEmail).toLowerCase();
    const name = trimField(details.clientName || createForm.clientName).toLowerCase();
    const match = vendors.find(
      (v) =>
        (email && (v.email || "").toLowerCase() === email) ||
        (name && (v.name || "").toLowerCase() === name)
    );
    if (match) setClientId(match.id);
  }, [vendors, clientId, details.clientEmail, details.clientName, createForm.clientEmail, createForm.clientName]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const firstConsultant = vendors.find((v) => consultantIds.includes(v.id));
      const firstContractor = vendors.find((v) => contractorIds.includes(v.id));
      const firstPmc = vendors.find((v) => pmcIds.includes(v.id));
      const created = await api<ProjectRow>("/api/projects", {
        method: "POST",
        token,
        body: JSON.stringify({
          ...createForm,
          designConsultant: createForm.designConsultant || firstConsultant?.name || "",
          contractorName: createForm.contractorName || firstContractor?.name || "",
          pmcName: createForm.pmcName || firstPmc?.name || "SPDC",
          vendorIds: [...consultantIds, ...pmcIds, ...contractorIds, ...(clientId ? [clientId] : [])],
          workPackages: sanitizeProjectWorkPackages(projectPackages),
          memberIds: staffIds.filter((id) => {
            const u = users.find((x) => x.id === id);
            return u && isSpdcStaffUser(u);
          }),
        }),
      });
      if (clientId) {
        await syncLinkedClientVendor(clientId, createForm);
      }
      setCreateForm(EMPTY_PROJECT);
      await loadLists();
      setStep("project", created.id);
      await api(`/api/comms/contacts/${created.id}/scaffold`, { method: "POST", token }).catch(() => null);
      setMsg(
        created.alreadyExists
          ? `Project ${created.code} already exists — opened the saved card.`
          : `Project ${created.code} is on the register as Planning. Matrix filled from this card. No login was created.`
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
      const firstConsultant = vendors.find((v) => consultantIds.includes(v.id));
      const firstContractor = vendors.find((v) => contractorIds.includes(v.id));
      const firstPmc = vendors.find((v) => pmcIds.includes(v.id));
      let loginWarn: string | null = null;
      if (clientId) {
        loginWarn = await syncLinkedClientVendor(clientId, details);
      }
      await api(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          name: details.name,
          clientName: details.clientName,
          clientContactName: details.clientContactName,
          clientEmail: details.clientEmail,
          clientPhone: details.clientPhone,
          clientAddress: details.clientAddress,
          clientGst: details.clientGst,
          location: details.location,
          designConsultant: details.designConsultant || firstConsultant?.name || "",
          contractorName: details.contractorName || firstContractor?.name || "",
          pmcName: details.pmcName || firstPmc?.name || "SPDC",
          startDate: details.startDate || null,
          endDate: details.endDate || null,
          status: details.status || "Planning",
          workPackages: sanitizeProjectWorkPackages(projectPackages),
        }),
      });
      await api(`/api/projects/${projectId}/assign-parties`, {
        method: "POST",
        token,
        body: JSON.stringify({
          vendorIds: [...consultantIds, ...pmcIds, ...contractorIds, ...(clientId ? [clientId] : [])].filter(Boolean),
        }),
      });
      if (staffIds.length) {
        const spdcIds = staffIds.filter((id) => {
          const u = users.find((x) => x.id === id);
          return u && isSpdcStaffUser(u);
        });
        if (spdcIds.length) {
          const assignments = spdcIds.map((userId) => {
            const u = users.find((x) => x.id === userId);
            const existing = summary?.members.find((m) => m.userId === userId);
            return {
              userId,
              role: existing?.role || suggestedProjectMemberRole(u?.designation),
            };
          });
          await api(`/api/projects/${projectId}/members`, {
            method: "POST",
            token,
            body: JSON.stringify({ assignments }),
          });
        }
      }
      await api(`/api/comms/contacts/${projectId}/scaffold`, { method: "POST", token }).catch(() => null);
      const baseMsg =
        details.status && details.status !== "Planning"
          ? "Project card updated. New consultants, vendors, and SPDC team members are linked to this job."
          : "Project card saved. Technical and commercial matrices filled from this card.";
      setMsg(loginWarn ? `${baseMsg} Client master saved; portal login: ${loginWarn}` : baseMsg);
      await loadProject();
      await loadLists();
      setStep("project", projectId);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step !== "launch" || !projectId || !token) return;
    void api<{ to: string[]; cc: string[] }>(`/api/projects/${projectId}/onboarding-preview`, { token })
      .then((row) => setMailPreview(row))
      .catch(() => setMailPreview(null));
  }, [step, projectId, token]);

  async function launchDrive() {
    if (!projectId) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ crmFolder?: string | null; sharePointUrl?: string | null }>(`/api/projects/${projectId}/file-drive`, {
        method: "POST",
        token,
      });
      setMsg(
        out.sharePointUrl
          ? `SharePoint folders are ready. Project card filed in CRM: ${out.crmFolder || "04_Orders_Won"}.`
          : "SharePoint folders are ready. The project card is filed under SPDC_CRM / Orders won, and the drawing register copy is in the project drawings folder.",
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not launch SharePoint folders");
    } finally {
      setBusy(false);
    }
  }

  async function sendOnboarding() {
    if (!projectId) return;
    const to = mailPreview?.to.length ? mailPreview.to.join(", ") : "nobody in To";
    const cc = mailPreview?.cc.length ? mailPreview.cc.join(", ") : "nobody in CC";
    const ok = window.confirm(
      `Send onboarding mail now?\n\nTo: ${to}\nCC: ${cc}\n\nThis sends real login emails. Use a spare project if these are live addresses.`,
    );
    if (!ok) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ sent?: { email: string }[]; reason?: string }>(`/api/projects/${projectId}/send-portal-invites`, {
        method: "POST",
        token,
        body: JSON.stringify({ fromMatrix: true }),
      });
      setMsg(out.sent?.length ? `Onboarding mail queued for ${out.sent.length} people.` : out.reason || "No onboarded people to mail.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Onboarding mail was not sent");
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
      setMsg(
        [
          `Setup complete. Status is ${out.status || "In Progress"}.`,
          `Folders: ${out.folders.count} (${out.folders.provider}). Matrix contacts added: ${out.comms.contacts.created} (existing contacts are kept).`,
          out.reports.dpr.created || out.reports.wpr.created
            ? "First DPR/WPR drafts created if they were not already there."
            : "DPR/WPR drafts were already on file — nothing duplicated.",
          "No emails were sent. Tick people below if you want onboarding mail.",
        ].join(" ")
      );
      await loadProject();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Complete setup failed");
    } finally {
      setBusy(false);
    }
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
      clientGst: c.gstNumber || "",
    };
    if (into === "create") setCreateForm((f) => ({ ...f, ...patch }));
    else setDetails((f) => ({ ...f, ...patch }));
  }

  async function syncLinkedClientVendor(
    id: string,
    card: Pick<typeof EMPTY_PROJECT, "clientName" | "clientContactName" | "clientEmail" | "clientPhone" | "clientAddress" | "clientGst">,
  ): Promise<string | null> {
    if (!token || !id) return null;
    const name = trimField(card.clientName);
    if (!name) throw new Error("Client company name is required");
    const updated = await api<{ loginError?: string }>(`/api/vendors/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name,
        primaryContactName: trimField(card.clientContactName) || null,
        email: trimField(card.clientEmail).toLowerCase() || null,
        businessPhone: trimField(card.clientPhone) || null,
        address: trimField(card.clientAddress) || null,
        gstNumber: trimField(card.clientGst) || null,
        partyType: "Client",
      }),
    });
    return updated.loginError || null;
  }

  const clientOptions = vendors.filter((v) => v.partyType === "Client");
  const isLaunched = Boolean(summary?.project.status && summary.project.status !== "Planning");

  if (!canManage) {
    return <p className="p-6 text-sm text-steel-muted">Office access is required for project setup.</p>;
  }

  return (
    <div className="space-y-4 p-4 sm:p-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="CRM · project start"
          title={projectId ? (isLaunched ? "Edit project card & SPDC team" : "Project setup") : "Project setup"}
          subtitle={
            projectId && isLaunched
              ? "Job is live — update the client card and add consultants, vendors, packages, or SPDC team members as the project grows. Save links them; new logins are still created on the directory pages."
              : "Pick client, PMC, consultants, vendors, packages, and SPDC team. New people and companies are added on the directory pages — save only links them to this job."
          }
        />
        {summary && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{summary.project.code}</Badge>
            <span className="text-sm font-medium">{summary.project.name}</span>
            <Badge tone={summary.project.status === "In Progress" ? "ok" : "warn"}>
              {summary.project.status || "Planning"}
            </Badge>
            <ProjectManageActions
              project={summary.project}
              token={token}
              showEdit={false}
              onChanged={() => void loadLists()}
            />
            <Link to="/crm/projects">
              <Button type="button" variant="secondary">
                Projects register
              </Button>
            </Link>
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

      <StatusNote msg={msg} />

      {step === "project" && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <Card className="!p-4 space-y-3">
            <h3 className="font-semibold text-sm">{projectId ? "Project card & parties" : "New delivery project"}</h3>
            {projectId && isLaunched ? (
              <p className="text-xs text-steel-muted leading-relaxed">
                Tick more consultants, contractors, or SPDC team members below and save — existing assignments stay; new picks are added to this job.
              </p>
            ) : null}
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
              {projectId ? (
                <label className="text-xs text-steel-muted sm:col-span-2">
                  Project status
                  <Select
                    value={details.status || "Planning"}
                    onChange={(e) => setDetails({ ...details, status: e.target.value })}
                  >
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}
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
              <div className="sm:col-span-2">
                <WorkPackagesPanel
                  token={token}
                  projectId={projectId || undefined}
                  mode="pick"
                  selected={projectPackages}
                  onChange={setProjectPackages}
                  onSaved={(pkgs) => {
                    setProjectPackages(pkgs);
                    setMsg("Work packages saved.");
                  }}
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-steel-muted">Client (from Client directory)</span>
                  {canManage ? (
                    <Link to="/crm/directory/clients" className="text-[11px] font-semibold text-brand">
                      Add new client →
                    </Link>
                  ) : null}
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
                {clientId ? (
                  <div className="grid sm:grid-cols-2 gap-2 rounded-lg border border-line bg-sand/30 p-3">
                    <Input
                      disabled={!canManage}
                      placeholder="Client company"
                      value={projectId ? details.clientName : createForm.clientName}
                      onChange={(e) =>
                        projectId
                          ? setDetails({ ...details, clientName: e.target.value })
                          : setCreateForm({ ...createForm, clientName: e.target.value })
                      }
                    />
                    <Input
                      disabled={!canManage}
                      placeholder="Contact name"
                      value={projectId ? details.clientContactName : createForm.clientContactName}
                      onChange={(e) =>
                        projectId
                          ? setDetails({ ...details, clientContactName: e.target.value })
                          : setCreateForm({ ...createForm, clientContactName: e.target.value })
                      }
                    />
                    <Input
                      disabled={!canManage}
                      type="email"
                      placeholder="Client email (login)"
                      value={projectId ? details.clientEmail : createForm.clientEmail}
                      onChange={(e) =>
                        projectId
                          ? setDetails({ ...details, clientEmail: e.target.value })
                          : setCreateForm({ ...createForm, clientEmail: e.target.value })
                      }
                    />
                    <Input
                      disabled={!canManage}
                      placeholder="Phone"
                      value={projectId ? details.clientPhone : createForm.clientPhone}
                      onChange={(e) =>
                        projectId
                          ? setDetails({ ...details, clientPhone: e.target.value })
                          : setCreateForm({ ...createForm, clientPhone: e.target.value })
                      }
                    />
                    <Input
                      disabled={!canManage}
                      placeholder="GSTIN"
                      value={projectId ? details.clientGst : createForm.clientGst}
                      onChange={(e) =>
                        projectId
                          ? setDetails({ ...details, clientGst: e.target.value })
                          : setCreateForm({ ...createForm, clientGst: e.target.value })
                      }
                    />
                    <Input
                      disabled={!canManage}
                      className="sm:col-span-2"
                      placeholder="Office address"
                      value={projectId ? details.clientAddress : createForm.clientAddress}
                      onChange={(e) =>
                        projectId
                          ? setDetails({ ...details, clientAddress: e.target.value })
                          : setCreateForm({ ...createForm, clientAddress: e.target.value })
                      }
                    />
                    <p className="sm:col-span-2 text-[11px] text-steel-muted">
                      Office and admin only. Save updates the client directory and every project linked to this company.
                    </p>
                    {projectId && token ? (
                      <ClientLogoUpload
                        projectId={projectId}
                        token={token}
                        logoUrl={summary?.project.clientLogoUrl}
                        onUploaded={() => void loadProject()}
                      />
                    ) : (
                      <p className="sm:col-span-2 text-[11px] text-steel-muted">
                        Client logo is optional. Save the card first, then upload it anytime.
                      </p>
                    )}
                    {projectId ? (
                      <div className="sm:col-span-2 mt-2">
                        <ProjectClientRepresentativesPanel
                          reps={summary?.clientRepresentatives || []}
                          canEdit={canManage}
                          compact
                          directoryClientId={clientId}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[11px] text-steel-muted rounded-lg border border-dashed border-line px-3 py-2">
                    Pick a client above to edit the card here, or add a new company on CRM → Clients.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2 grid lg:grid-cols-3 gap-3">
                <SetupPartyMultiPick
                  token={token}
                  title="Consultants"
                  kind="Consultant"
                  vendors={vendors}
                  selectedIds={consultantIds}
                  onChange={setConsultantIds}
                  directoryHref="/crm/directory/stakeholders"
                  directoryLabel="Add on Consultants →"
                />
                <SetupPartyMultiPick
                  token={token}
                  title="PMC"
                  kind="PMC"
                  vendors={vendors}
                  selectedIds={pmcIds}
                  onChange={setPmcIds}
                  directoryHref="/crm/directory/stakeholders"
                  directoryLabel="Add PMC on Consultants →"
                />
                <SetupPartyMultiPick
                  token={token}
                  title="Vendors / contractors"
                  kind="Contractor"
                  vendors={vendors}
                  selectedIds={contractorIds}
                  onChange={setContractorIds}
                  directoryHref="/crm/directory/vendors"
                  directoryLabel="Add on Vendors →"
                />
              </div>
              <div className="sm:col-span-2">
                <ProjectTeamAllocatePanel
                  projectId={projectId || undefined}
                  token={token}
                  users={users}
                  members={summary?.members || []}
                  selectedIds={staffIds}
                  onChange={setStaffIds}
                  canEdit={canManage}
                  onMsg={setMsg}
                  onChanged={() => void loadProject()}
                />
              </div>
              <div className="sm:col-span-2 flex flex-wrap gap-2 items-center">
                <Button type="submit" disabled={busy}>
                  {projectId ? (isLaunched ? "Save card & SPDC team" : "Save project card") : "Create project"}
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => navigate("/crm/projects")}>
                  Back to register
                </Button>
                {projectId ? (
                  <Link to={`/crm/setup?projectId=${projectId}&step=matrix`} className="text-[11px] font-semibold text-steel-muted">
                    Communication matrix (optional)
                  </Link>
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
            {summary && (
              <div className="rounded-lg border border-line bg-paper px-3 py-2 space-y-1">
                <p className="font-mono text-xs font-semibold text-brand">{summary.project.code}</p>
                <p className="text-sm font-semibold leading-snug">{summary.project.name}</p>
                <p className="text-xs text-steel-muted">{summary.project.clientName || details.clientName || "No client"}</p>
                <p className="text-xs text-steel-muted">{details.location || summary.project.location || "No location"}</p>
                <p className="text-xs">
                  <span className="font-medium">{summary.project.status || "Planning"}</span>
                  <span className="text-steel-muted">
                    {" "}
                    · {details.startDate || "—"} to {details.endDate || "—"}
                  </span>
                </p>
                {summary.lead && <p className="text-xs text-steel-muted">From lead: {summary.lead.title}</p>}
                <p className="text-[11px] text-steel-muted leading-relaxed">
                  {projectStatusHint(summary.project.status)} {summary.members.filter((m) => isSpdcStaffMember(m)).length} SPDC team ·{" "}
                  {summary.vendors.length} companies.
                </p>
                <ProjectManageActions
                  project={summary.project}
                  token={token}
                  showEdit={false}
                  onChanged={() => void loadLists()}
                />
              </div>
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
              Assigned so far: {summary.members.length} people · {summary.vendors.length} companies. Search and auto-fill
              from those lists. Add a missing consultant or vendor on the matrix — no need to leave this step.
            </p>
          )}
          <ProjectSetupMatrixDesk
            projectId={projectId}
            token={token}
            project={summary?.project}
            users={users}
            vendors={vendors}
            assignedVendors={(summary?.vendors || []).map((v) => ({ vendorId: v.vendorId, partyType: v.partyType, name: v.name }))}
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
              Next · Launch
            </Button>
          </div>
        </div>
      )}

      {step === "matrix" && !projectId && (
        <p className="text-sm text-steel-muted">Create or select a project first.</p>
      )}

      {step === "launch" && projectId && isLaunched && (
        <Card className="!p-4 space-y-3">
          <h3 className="font-semibold text-sm">Project already launched</h3>
          <p className="text-sm text-steel-muted leading-relaxed">
            Status is <strong>{summary?.project.status}</strong>. Create the SharePoint folders if they are missing — existing folders are left as they are.
            Use step 1 to add consultants, vendors, or SPDC team members during the job.
          </p>
          <p className="text-xs text-steel-muted">
            Onboarding mail uses the communication matrix. To: {mailPreview?.to.join(", ") || "—"}. CC: {mailPreview?.cc.join(", ") || "—"}. Only people already on the project (SPDC team and parties) are included. Nothing is sent until you click Send onboarding.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void launchDrive()}>
              Launch
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void sendOnboarding()}>
              Send onboarding
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStep("project")}>
              Edit card & SPDC team
            </Button>
            <Link to="/crm/projects">
              <Button type="button" variant="secondary">
                Back to projects register
              </Button>
            </Link>
            <Link to={`/projects/${projectId}`}>
              <Button type="button">Open project desk</Button>
            </Link>
          </div>
        </Card>
      )}

      {step === "launch" && projectId && !isLaunched && (
        <Card className="!p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm">Launch this project</h3>
              <p className="text-xs text-steel-muted mt-0.5">
                Creates ISO folders in SharePoint (about a minute), opens empty Client / PMC / Consultant / Contractor matrix sections, and sets status to{" "}
                <strong>In Progress</strong>. CRM saves, proposals, and HRMS stay fast until this step. No emails are sent.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void completeSetup()}>
                Launch
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void sendOnboarding()}>
                Send onboarding
              </Button>
            </div>
            <p className="text-xs text-steel-muted">
              Launch creates the SharePoint folders and files the project card in SPDC CRM. Send onboarding mails only the people already on the matrix and the team. To: {mailPreview?.to.join(", ") || "—"}. CC: {mailPreview?.cc.join(", ") || "—"}.
            </p>
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
          <Button type="button" variant="secondary" onClick={() => setStep("matrix")}>
            Back · Communication matrix
          </Button>
        </Card>
      )}
    </div>
  );
}

function ClientLogoUpload({
  projectId,
  token,
  logoUrl,
  onUploaded,
}: {
  projectId: string;
  token: string;
  logoUrl?: string | null;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api(`/api/projects/${projectId}/client-logo`, { method: "POST", token, body: fd });
      onUploaded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
      {logoUrl ? <img src={logoUrl} alt="Client logo" className="h-10 max-w-[7rem] object-contain" /> : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button type="button" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? "Uploading…" : logoUrl ? "Replace client logo" : "Upload client logo"}
      </Button>
      <span className="text-[11px] text-steel-muted">Optional. Add it now or later — the matrix and registers use it when it is there.</span>
      {err ? <span className="text-[11px] text-danger">{err}</span> : null}
    </div>
  );
}
