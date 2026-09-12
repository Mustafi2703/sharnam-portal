import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader } from "../../components/ui";
import { ProjectSetupMatrixDesk } from "../../components/ProjectSetupMatrixDesk";
import { type SetupVendor } from "../../components/SetupPartyMultiPick";
import { ProjectVendorsSetupDesk } from "../../components/ProjectVendorsSetupDesk";
import { ProjectTeamAllocatePanel } from "../../components/ProjectTeamAllocatePanel";
import { DirectoryMySignaturePanel } from "../../components/DirectoryMySignaturePanel";
import { DirectorySignOffRegister } from "../../components/DirectorySignOffRegister";
import { ProjectManageActions } from "../../components/ProjectManageActions";

type SetupSummary = {
  project: { id: string; code: string; name: string; clientName?: string | null; clientEmail?: string | null };
  members: { id: string; userId: string; fullName: string; email: string; portalRole: string; role: string }[];
  vendors: { id: string; vendorId: string; name: string; partyType: string; email?: string | null }[];
};

type ProjectCard = {
  id: string;
  code: string;
  name: string;
  clientName?: string | null;
  clientContactName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  clientGst?: string | null;
  location?: string | null;
  designConsultant?: string | null;
  contractorName?: string | null;
  pmcName?: string | null;
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
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessSlip, setAccessSlip] = useState<{ email: string; tempPassword?: string }[]>([]);
  const [card, setCard] = useState<ProjectCard | null>(null);

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    const [s, st, ov, u, v, proj] = await Promise.all([
      api<SetupSummary>(`/api/projects/${projectId}/setup-summary`, { token }),
      api<SetupStatus>(`/api/projects/${projectId}/setup-status`, { token }).catch(() => null),
      api<{ members?: any[]; vendors?: any[] }>(`/api/directory/project/${projectId}/overview`, { token }).catch(() => null),
      api<UserRow[]>("/api/users", { token }).catch(() => []),
      api<VendorRow[]>("/api/vendors", { token }).catch(() => []),
      api<ProjectCard>(`/api/projects/${projectId}`, { token }).catch(() => null),
    ]);
    if (proj) setCard(proj);
    setSummary(s);
    setStatus(st);
    setOverview(ov);
    setUsers(u);
    setVendors(v);
  }, [token, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCard() {
    if (!token || !projectId || !card) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          name: card.name,
          clientName: card.clientName,
          clientContactName: card.clientContactName,
          clientEmail: card.clientEmail,
          clientPhone: card.clientPhone,
          clientAddress: card.clientAddress,
          clientGst: card.clientGst,
          location: card.location,
          designConsultant: card.designConsultant,
          contractorName: card.contractorName,
          pmcName: card.pmcName,
        }),
      });
      setMsg("Project card saved — QAP, cube, and register headers will show these names.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save project card failed");
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
        subtitle="Fill the project / design header, add vendors here (no bid required), allocate people, then launch. Open a bid only if you want a comparative."
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

      {card && (
        <Card className="!p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm">Project · design · PMC header</h3>
              <p className="text-xs text-steel-muted mt-0.5">
                These names print at the top of QAP, cube, and quality registers. Keep them short and complete.
              </p>
            </div>
            <ProjectManageActions project={card} token={token} showEdit={false} onChanged={() => void load()} />
          </div>
          <form
            className="grid sm:grid-cols-2 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void saveCard();
            }}
          >
            <Input disabled value={card.code} placeholder="Project code" />
            <Input
              required
              placeholder="Project name"
              value={card.name || ""}
              onChange={(e) => setCard({ ...card, name: e.target.value })}
            />
            <Input
              placeholder="Client organisation"
              value={card.clientName || ""}
              onChange={(e) => setCard({ ...card, clientName: e.target.value })}
            />
            <Input
              required
              placeholder="Site / city"
              value={card.location || ""}
              onChange={(e) => setCard({ ...card, location: e.target.value })}
            />
            <Input
              placeholder="PMC / SPDC"
              value={card.pmcName || ""}
              onChange={(e) => setCard({ ...card, pmcName: e.target.value })}
            />
            <Input
              placeholder="Design consultant"
              value={card.designConsultant || ""}
              onChange={(e) => setCard({ ...card, designConsultant: e.target.value })}
            />
            <Input
              placeholder="Main contractor"
              value={card.contractorName || ""}
              onChange={(e) => setCard({ ...card, contractorName: e.target.value })}
            />
            <Input
              placeholder="Client GST"
              value={card.clientGst || ""}
              onChange={(e) => setCard({ ...card, clientGst: e.target.value })}
            />
            <Input
              placeholder="Client contact"
              value={card.clientContactName || ""}
              onChange={(e) => setCard({ ...card, clientContactName: e.target.value })}
            />
            <Input
              type="email"
              placeholder="Client email"
              value={card.clientEmail || ""}
              onChange={(e) => setCard({ ...card, clientEmail: e.target.value })}
            />
            <Input
              placeholder="Client phone"
              value={card.clientPhone || ""}
              onChange={(e) => setCard({ ...card, clientPhone: e.target.value })}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Client office address"
              value={card.clientAddress || ""}
              onChange={(e) => setCard({ ...card, clientAddress: e.target.value })}
            />
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" disabled={busy}>
                Save project card
              </Button>
            </div>
          </form>
        </Card>
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
        <ProjectVendorsSetupDesk
          projectId={projectId}
          token={token}
          catalog={vendors}
          assigned={summary?.vendors || []}
          onMsg={setMsg}
          onChanged={() => void load()}
        />
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
              Optional · open a bid →
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
