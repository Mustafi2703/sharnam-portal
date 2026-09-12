import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import { ProjectSetupMatrixDesk } from "../../components/ProjectSetupMatrixDesk";
import { SetupPartyMultiPick, type SetupVendor } from "../../components/SetupPartyMultiPick";
import { ProjectTeamAllocatePanel } from "../../components/ProjectTeamAllocatePanel";
import { DirectoryMySignaturePanel } from "../../components/DirectoryMySignaturePanel";
import { DirectorySignOffRegister } from "../../components/DirectorySignOffRegister";

type SetupSummary = {
  project: { id: string; code: string; name: string; clientName?: string | null; clientEmail?: string | null };
  members: { id: string; userId: string; fullName: string; email: string; portalRole: string; role: string }[];
  vendors: { id: string; vendorId: string; name: string; partyType: string; email?: string | null }[];
};

type SetupStatus = { ready: boolean; checks: { key: string; ok: boolean; label: string; detail?: string }[] };

type UserRow = { id: string; fullName: string; email: string; role: string };
type VendorRow = SetupVendor & { partyType?: string };

/** Live-project setup — same launch as CRM, for jobs already in the portal. */
export default function LiveProjectSetupPage() {
  const { id: projectId } = useParams();
  const { token, user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "office";
  const [summary, setSummary] = useState<SetupSummary | null>(null);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [overview, setOverview] = useState<{ members?: any[]; vendors?: any[] } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [consultantIds, setConsultantIds] = useState<string[]>([]);
  const [contractorIds, setContractorIds] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessSlip, setAccessSlip] = useState<{ email: string; tempPassword?: string }[]>([]);

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    const [s, st, ov, u, v] = await Promise.all([
      api<SetupSummary>(`/api/projects/${projectId}/setup-summary`, { token }),
      api<SetupStatus>(`/api/projects/${projectId}/setup-status`, { token }).catch(() => null),
      api<{ members?: any[]; vendors?: any[] }>(`/api/directory/project/${projectId}/overview`, { token }).catch(() => null),
      api<UserRow[]>("/api/users", { token }).catch(() => []),
      api<VendorRow[]>("/api/vendors", { token }).catch(() => []),
    ]);
    setSummary(s);
    setStatus(st);
    setOverview(ov);
    setUsers(u);
    setVendors(v);
    setConsultantIds(s.vendors.filter((x) => ["Consultant", "Designer", "PMC"].includes(x.partyType)).map((x) => x.vendorId));
    setContractorIds(s.vendors.filter((x) => ["Contractor", "Vendor"].includes(x.partyType)).map((x) => x.vendorId));
  }, [token, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  function rememberVendor(v: SetupVendor) {
    setVendors((prev) => (prev.some((x) => x.id === v.id) ? prev : [...prev, v]));
  }

  async function saveParties() {
    if (!token || !projectId) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/assign-parties`, {
        method: "POST",
        token,
        body: JSON.stringify({ vendorIds: [...new Set([...consultantIds, ...contractorIds])] }),
      });
      setMsg("Consultants and contractors saved.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save parties failed");
    } finally {
      setBusy(false);
    }
  }

  async function completeSetup() {
    if (!token || !projectId) return;
    setBusy(true);
    try {
      const out = await api<{
        clientPortals: { email: string; created: boolean; tempPassword?: string }[];
        contractorPortals: { email: string; created: boolean; tempPassword?: string }[];
      }>(`/api/projects/${projectId}/complete-setup`, { method: "POST", token, body: JSON.stringify({}) });
      const slips = [...(out.clientPortals || []), ...(out.contractorPortals || [])].filter((p) => p.email);
      setAccessSlip(slips);
      setMsg("Setup complete — folders, comms, portals, first DPR / WPR.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Complete setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvites() {
    if (!token || !projectId) return;
    setBusy(true);
    try {
      const out = await api<{ sent: { email: string }[]; sharePassword: string }>(
        `/api/projects/${projectId}/send-portal-invites`,
        { method: "POST", token, body: JSON.stringify({}) }
      );
      setMsg(`Invites emailed to ${out.sent.length} people. Shared password: ${out.sharePassword}.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Invite send failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return <p className="text-sm text-steel-muted">Office only — ask PMC to finish project setup.</p>;
  }
  if (!projectId || !token) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Live project"
        title={summary ? `Set up ${summary.project.code}` : "Project setup"}
        subtitle="Allocate SPDC people, add vendors (email required), fill the comms matrix, then complete setup and issue logins."
      />
      {msg && <p className="text-sm text-ok">{msg}</p>}
      {status && (
        <div className="flex flex-wrap gap-2">
          {status.ready ? <Badge tone="ok">Ready</Badge> : <Badge tone="warn">Setup in progress</Badge>}
          {(status.checks || []).slice(0, 6).map((c) => (
            <Badge key={c.key} tone={c.ok ? "ok" : "neutral"}>
              {c.label}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <ProjectTeamAllocatePanel
          projectId={projectId}
          token={token}
          users={users}
          members={summary?.members || []}
          canEdit={canManage}
          onMsg={setMsg}
          onChanged={() => void load()}
        />
        <Card className="!p-4 space-y-3">
          <h3 className="font-semibold text-sm">Consultants and contractors</h3>
          <p className="text-xs text-steel-muted">New companies need an email so we can issue a vendor login and bid invite.</p>
          <SetupPartyMultiPick
            token={token}
            title="Consultants"
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
            title="Contractors"
            kind="Contractor"
            vendors={vendors}
            selectedIds={contractorIds}
            onChange={setContractorIds}
            onCreated={rememberVendor}
            onMsg={setMsg}
            busy={busy}
          />
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void saveParties()}>
            Save parties
          </Button>
        </Card>
      </div>

      <ProjectSetupMatrixDesk
        projectId={projectId}
        token={token}
        project={summary?.project}
        users={users}
        vendors={vendors}
        canEdit={canManage}
        onMsg={setMsg}
        onDirectoryChange={async () => {
          await load();
        }}
      />

      <Card className="!p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">Launch · portals · DPR / WPR</h3>
            <p className="text-xs text-steel-muted mt-0.5">
              Creates ISO folders, seeds comms, issues client/vendor logins, and the first DPR / WPR drafts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void completeSetup()}>
              Complete setup
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void sendInvites()}>
              Email portal credentials
            </Button>
            <Link to={`/crm/bids?projectId=${projectId}`} className="text-sm font-semibold text-brand self-center">
              Open bids →
            </Link>
          </div>
        </div>
        {accessSlip.length > 0 && (
          <div className="rounded-lg border border-line bg-sand/40 p-3 text-sm space-y-1">
            <p className="font-semibold text-xs uppercase tracking-wide text-steel-muted">Access slip — give these to vendors / client</p>
            {accessSlip.map((p) => (
              <p key={p.email} className="font-mono text-xs">
                {p.email}
                {p.tempPassword ? ` · ${p.tempPassword}` : " · existing login"}
              </p>
            ))}
          </div>
        )}
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
          onSaved={() => void load()}
        />
      </Card>
    </div>
  );
}
