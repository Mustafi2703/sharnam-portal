import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select } from "./ui";
import { SearchableSelect } from "./SearchableSelect";
import { DirectoryMySignaturePanel } from "./DirectoryMySignaturePanel";
import { DirectorySignOffRegister } from "./DirectorySignOffRegister";
import { ProjectSetupMatrixDesk } from "./ProjectSetupMatrixDesk";
import { SetupPartyMultiPick, type SetupVendor } from "./SetupPartyMultiPick";
import { formatPartyType } from "../lib/vendorTypes";
import { VendorManageActions } from "./VendorManageActions";
import { VendorQuickEditModal, type VendorQuickEditRow } from "./VendorQuickEditModal";

type SetupSummary = {
  project: { id: string; code: string; name: string; status: string; clientName?: string | null };
  lead?: { id: string; title: string; stage: string } | null;
  members: {
    id: string;
    fullName: string;
    email: string;
    portalRole: string;
    role: string;
    phone?: string | null;
  }[];
  vendors: {
    id: string;
    vendorId: string;
    name: string;
    partyType: string;
    email?: string | null;
    trade?: string | null;
    tradeRole?: string | null;
  }[];
  bidPackages: {
    id: string;
    title: string;
    status: string;
    revisionLabel: string;
    awardedVendorId?: string | null;
    uploadProgress: { done: number; total: number };
  }[];
};

type UserRow = { id: string; fullName: string; email: string; role: string };
type VendorRow = SetupVendor & { partyType?: string };

type Props = {
  projectId: string;
  token: string;
  allUsers: UserRow[];
  allVendors: SetupVendor[];
  onMsg: (text: string) => void;
};

export function MasterProjectSetupPanel({ projectId, token, allUsers, allVendors, onMsg }: Props) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<SetupSummary | null>(null);
  const [overview, setOverview] = useState<{ members?: any[]; vendors?: any[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [memberListQ, setMemberListQ] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("project_manager");
  const [assignVendorId, setAssignVendorId] = useState("");
  const [assignTrade, setAssignTrade] = useState("");
  const [consultantIds, setConsultantIds] = useState<string[]>([]);
  const [contractorIds, setContractorIds] = useState<string[]>([]);
  const [catalogVendors, setCatalogVendors] = useState<VendorRow[]>([]);
  const [accessSlip, setAccessSlip] = useState<{ email: string; tempPassword?: string }[]>([]);
  const [editVendor, setEditVendor] = useState<VendorQuickEditRow | null>(null);
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    role: "site_employee",
    phone: "",
    department: "Site",
    designation: "",
    password: "Demo@1234",
  });

  const load = useCallback(async () => {
    if (!projectId) return;
    const [s, ov] = await Promise.all([
      api<SetupSummary>(`/api/projects/${projectId}/setup-summary`, { token }),
      api<{ members?: any[]; vendors?: any[] }>(`/api/directory/project/${projectId}/overview`, { token }).catch(
        () => null
      ),
    ]);
    setSummary(s);
    setOverview(ov);
    setConsultantIds(s.vendors.filter((v) => ["Consultant", "Designer", "PMC"].includes(v.partyType)).map((v) => v.vendorId));
    setContractorIds(s.vendors.filter((v) => ["Contractor", "Vendor"].includes(v.partyType)).map((v) => v.vendorId));
    setCatalogVendors((prev) => {
      const extra = s.vendors.map((v) => ({
        id: v.vendorId,
        name: v.name,
        partyType: v.partyType,
        trade: v.trade || undefined,
        email: v.email,
      }));
      const merged = [...allVendors, ...prev, ...extra];
      return merged.filter((v, i) => merged.findIndex((x) => x.id === v.id) === i);
    });
  }, [projectId, token, allVendors]);

  useEffect(() => {
    void load();
  }, [load]);

  async function seedR2Boqs(pkgId: string) {
    setBusy(true);
    try {
      const r = await api<{ uploaded: number; total: number }>(`/api/crm/bid-packages/${pkgId}/seed-r2-boqs`, {
        method: "POST",
        token,
        body: JSON.stringify({ force: true }),
      });
      onMsg(`Simulated R2 BOQ uploads: ${r.uploaded}/${r.total} slots filled.`);
      await load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "BOQ seed failed");
    } finally {
      setBusy(false);
    }
  }

  async function createUserAndAssign(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await api<{ id: string }>("/api/hrm/employees", {
        method: "POST",
        token,
        body: JSON.stringify(userForm),
      });
      await api("/api/hrm/assign", {
        method: "POST",
        token,
        body: JSON.stringify({ projectId, userId: user.id, role: userForm.role }),
      });
      setUserForm({
        fullName: "",
        email: "",
        role: "site_employee",
        phone: "",
        department: "Site",
        designation: "",
        password: "Demo@1234",
      });
      onMsg(`${userForm.fullName || userForm.email} created and assigned to project directory.`);
      await load();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Create user failed");
    } finally {
      setBusy(false);
    }
  }

  if (!summary) {
    return <p className="text-sm text-steel-muted">Loading project desk…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{summary.project.code}</Badge>
        <span className="font-display text-lg">{summary.project.name}</span>
        {summary.lead && (
          <Link to="/crm/leads" className="text-xs font-semibold text-brand">
            Lead: {summary.lead.title} ({summary.lead.stage}) →
          </Link>
        )}
        <Link to={`/projects/${projectId}/setup`} className="ml-auto text-sm font-semibold text-brand">
          Live project setup →
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="!p-4 space-y-3">
          <h3 className="font-semibold text-sm">Directory · people (emails for comms)</h3>
          <Input
            placeholder="Search allocated employees by name…"
            value={memberListQ}
            onChange={(e) => setMemberListQ(e.target.value)}
          />
          <ul className="text-sm divide-y divide-line max-h-48 overflow-y-auto">
            {summary.members
              .filter((m) => !memberListQ.trim() || `${m.fullName} ${m.email}`.toLowerCase().includes(memberListQ.trim().toLowerCase()))
              .map((m) => (
              <li key={m.id} className="py-2 flex justify-between gap-2">
                <div>
                  <div className="font-medium">{m.fullName}</div>
                  <div className="text-xs font-mono text-steel-muted">{m.email}</div>
                </div>
                <Badge tone="neutral">{m.portalRole || m.role}</Badge>
              </li>
            ))}
            {!summary.members.length && <li className="py-2 text-steel-muted text-xs">No members — assign below.</li>}
          </ul>
          <form
            className="flex flex-wrap gap-2 items-end border-t border-line pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(`/api/projects/${projectId}/members`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({ userId: memberUserId, role: memberRole }),
                });
                onMsg("Person assigned to directory.");
                setMemberUserId("");
                await load();
              } catch (err) {
                onMsg(err instanceof Error ? err.message : "Assign failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <SearchableSelect
              className="min-w-[160px] flex-1"
              options={allUsers.map((u) => ({
                value: u.id,
                label: u.fullName,
                sublabel: `${u.email} · ${u.role || ""}`,
                keywords: `${u.fullName} ${u.email} ${u.role || ""}`,
              }))}
              value={memberUserId}
              onChange={setMemberUserId}
              placeholder="Existing login…"
              searchPlaceholder="Search employee by name or email…"
              required
            />
            <Select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
              <option value="project_manager">Project Manager</option>
              <option value="site_engineer">Site Engineer</option>
              <option value="document_controller">Document Controller (DMS)</option>
              <option value="quality_lead">Quality Lead</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </Select>
            <Button type="submit" variant="secondary" disabled={busy}>
              Assign
            </Button>
          </form>
          <form className="grid sm:grid-cols-2 gap-2 border-t border-line pt-3" onSubmit={createUserAndAssign}>
            <p className="sm:col-span-2 text-[10px] font-mono uppercase text-steel-muted">Create login + assign (HR / Master)</p>
            <Input placeholder="Full name" value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} required />
            <Input placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
            <Select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              {["site_employee", "office", "employee", "client", "vendor", "admin"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Input placeholder="Phone" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
            <Button type="submit" className="sm:col-span-2" disabled={busy}>
              Create user + add to project
            </Button>
          </form>
        </Card>

        <Card className="!p-4 space-y-3">
          <div className="flex justify-between items-center gap-2">
            <h3 className="font-semibold text-sm">Vendors / contractors</h3>
            <Link to="/master/vendors" className="text-xs font-semibold text-brand">
              Global directory →
            </Link>
          </div>
          <ul className="text-sm divide-y divide-line max-h-40 overflow-y-auto">
            {summary.vendors.map((v) => (
              <li key={v.id} className="py-2 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{v.name}</span>
                  <Badge tone="brand">{formatPartyType(v.partyType)}</Badge>
                </div>
                <div className="text-xs text-steel-muted">{v.trade || v.tradeRole || "—"}</div>
                {v.email && <div className="text-xs font-mono">{v.email}</div>}
                <VendorManageActions
                  vendor={{ id: v.vendorId, name: v.name }}
                  token={token}
                  projectId={projectId}
                  onEdit={() =>
                    setEditVendor({
                      id: v.vendorId,
                      name: v.name,
                      partyType: v.partyType,
                      email: v.email,
                      trade: v.trade || v.tradeRole,
                    })
                  }
                  onChanged={() => void load()}
                />
              </li>
            ))}
            {!summary.vendors.length && <li className="py-2 text-steel-muted text-xs">No vendors on this project yet.</li>}
          </ul>
          <form
            className="flex flex-wrap gap-2 items-end border-t border-line pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(`/api/vendors/project/${projectId}/assign`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({ vendorId: assignVendorId, tradeRole: assignTrade }),
                });
                onMsg("Vendor linked to project.");
                setAssignVendorId("");
                await load();
              } catch (err) {
                onMsg(err instanceof Error ? err.message : "Assign vendor failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            <SearchableSelect
              className="min-w-[180px] flex-1"
              options={allVendors.map((v) => ({
                value: v.id,
                label: v.name,
                sublabel: [v.trade, v.partyType, v.email].filter(Boolean).join(" · "),
                keywords: [v.name, v.email, v.trade, v.partyType, v.primaryContactName].filter(Boolean).join(" "),
              }))}
              value={assignVendorId}
              onChange={setAssignVendorId}
              placeholder="From global vendor directory…"
              searchPlaceholder="Search company by name or email…"
              required
            />
            <Input placeholder="Trade on project" value={assignTrade} onChange={(e) => setAssignTrade(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={busy}>
              Add
            </Button>
          </form>
          <div className="grid sm:grid-cols-2 gap-3 border-t border-line pt-3">
            <SetupPartyMultiPick
              token={token}
              title="Add consultant (email required)"
              kind="Consultant"
              vendors={catalogVendors.length ? catalogVendors : allVendors}
              selectedIds={consultantIds}
              onChange={setConsultantIds}
              onCreated={(v) =>
                setCatalogVendors((prev) => (prev.some((x) => x.id === v.id) ? prev : [...prev, { ...v, trade: v.trade ?? undefined }]))
              }
              onMsg={onMsg}
              busy={busy}
            />
            <SetupPartyMultiPick
              token={token}
              title="Add vendor / contractor"
              kind="Contractor"
              vendors={catalogVendors.length ? catalogVendors : allVendors}
              selectedIds={contractorIds}
              onChange={setContractorIds}
              onCreated={(v) =>
                setCatalogVendors((prev) => (prev.some((x) => x.id === v.id) ? prev : [...prev, { ...v, trade: v.trade ?? undefined }]))
              }
              onMsg={onMsg}
              busy={busy}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/projects/${projectId}/assign-parties`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({ vendorIds: [...new Set([...consultantIds, ...contractorIds])] }),
                });
                onMsg("Consultants and contractors saved.");
                await load();
              } catch (err) {
                onMsg(err instanceof Error ? err.message : "Save parties failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save parties
          </Button>
        </Card>
      </div>

      <ProjectSetupMatrixDesk
        projectId={projectId}
        token={token}
        project={summary.project}
        users={allUsers}
        vendors={catalogVendors.length ? catalogVendors : allVendors}
        canEdit
        onMsg={onMsg}
        onDirectoryChange={async () => {
          await load();
        }}
      />

      <Card className="!p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 items-start">
          <div>
            <h3 className="font-semibold text-sm">Complete setup · invites</h3>
            <p className="text-xs text-steel-muted mt-0.5">
              Same launch as CRM: ISO folders, comms, client/vendor logins, first DPR / WPR drafts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const out = await api<{
                    clientPortals: { email: string; created: boolean; tempPassword?: string }[];
                    contractorPortals: { email: string; created: boolean; tempPassword?: string }[];
                  }>(`/api/projects/${projectId}/complete-setup`, { method: "POST", token, body: JSON.stringify({}) });
                  setAccessSlip(
                    [...(out.clientPortals || []), ...(out.contractorPortals || [])].filter((p) => p.email)
                  );
                  onMsg("Setup complete — folders, comms, portals, first DPR / WPR.");
                  await load();
                } catch (err) {
                  onMsg(err instanceof Error ? err.message : "Complete setup failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Complete setup
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const out = await api<{ sent: { email: string }[]; sharePassword: string }>(
                    `/api/projects/${projectId}/send-portal-invites`,
                    { method: "POST", token, body: JSON.stringify({}) }
                  );
                  onMsg(`Invites emailed to ${out.sent.length} people. Shared password: ${out.sharePassword}.`);
                } catch (err) {
                  onMsg(err instanceof Error ? err.message : "Invite send failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Email portal credentials
            </Button>
          </div>
        </div>
        {accessSlip.length > 0 && (
          <div className="rounded-lg border border-line bg-sand/40 p-3 text-sm space-y-1">
            <p className="font-semibold text-[10px] uppercase tracking-wide text-steel-muted">Access slip</p>
            {accessSlip.map((p) => (
              <p key={p.email} className="font-mono text-xs">
                {p.email}
                {p.tempPassword ? ` · ${p.tempPassword}` : " · existing login"}
              </p>
            ))}
          </div>
        )}
      </Card>

      {(() => {
        const members = overview?.members || [];
        const vendors = overview?.vendors || [];
        const missingPeople = members.filter((m) => !m.signatureUrl).length;
        const missingCompanies = vendors.filter((v) => !v.signatureUrl).length;
        const missing = missingPeople + missingCompanies;
        return (
          <Card className={`!p-4 space-y-3 ${missing ? "border-amber-300 bg-amber-50/60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-sm">Sign-off register</h3>
                <p className="text-xs text-steel-muted mt-0.5">
                  Required for checklists, RA bills, and WPR export. Set up here if Directory is still empty.
                </p>
              </div>
              <Badge tone={missing ? "warn" : "ok"}>{missing ? `${missing} missing` : "All set"}</Badge>
            </div>
            <DirectoryMySignaturePanel projectId={projectId} token={token} compact />
            <DirectorySignOffRegister
              projectId={projectId}
              token={token}
              members={members}
              vendors={vendors}
              canEditAll
              currentUserId={user?.id}
              currentUserEmail={user?.email}
              currentUserVendorId={user?.vendorId}
              onSaved={() => void load()}
            />
          </Card>
        );
      })()}

      <Card className="!p-4 space-y-2 bg-sand/30">
        <h3 className="font-semibold text-sm">DMS · ISO folder tree (OneDrive)</h3>
        <p className="text-xs text-steel-muted leading-relaxed">
          Created automatically when the project is converted or quick-created. Assign people above so they can view and upload
          in the project document library — site and office need access to address RFIs and NCRs.
        </p>
        <Link to={`/projects/${projectId}/dms`} className="text-sm font-semibold text-brand inline-block">
          Open {summary.project.code} document library →
        </Link>
      </Card>

      <Card className="!p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <h3 className="font-semibold text-sm">Comparative bids (R2 packages)</h3>
          <Link to={`/crm/bids?projectId=${projectId}`} className="text-xs font-semibold text-brand">
            CRM bid desk →
          </Link>
        </div>
        {!summary.bidPackages.length && (
          <p className="text-sm text-steel-muted">
            No bid package yet — convert a lead with 2+ vendors or open{" "}
            <Link to="/crm/bids" className="text-brand font-semibold">
              Comparative bids
            </Link>
            .
          </p>
        )}
        <ul className="space-y-2">
          {summary.bidPackages.map((bp) => (
            <li key={bp.id} className="border border-line rounded-xl p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{bp.title}</div>
                <div className="text-xs text-steel-muted">
                  {bp.revisionLabel} · BOQs {bp.uploadProgress.done}/{bp.uploadProgress.total}
                  {bp.awardedVendorId ? " · Awarded" : ""}
                </div>
              </div>
              <Badge tone={bp.status === "Awarded" ? "ok" : "neutral"}>{bp.status}</Badge>
              <Link to={`/crm/bids/${bp.id}`} className="text-xs font-semibold text-brand">
                Open →
              </Link>
              <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => void seedR2Boqs(bp.id)}>
                Simulate R2 BOQs
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <VendorQuickEditModal
        open={!!editVendor}
        vendor={editVendor}
        token={token}
        onClose={() => setEditVendor(null)}
        onSaved={() => void load()}
      />
    </div>
  );
}
