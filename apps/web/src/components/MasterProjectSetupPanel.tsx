import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";
import { SearchableSelect } from "./SearchableSelect";

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
type VendorRow = { id: string; name: string; partyType?: string; trade?: string };

type Props = {
  projectId: string;
  token: string;
  allUsers: UserRow[];
  allVendors: VendorRow[];
  onMsg: (text: string) => void;
};

export function MasterProjectSetupPanel({ projectId, token, allUsers, allVendors, onMsg }: Props) {
  const [summary, setSummary] = useState<SetupSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("project_manager");
  const [assignVendorId, setAssignVendorId] = useState("");
  const [assignTrade, setAssignTrade] = useState("");
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
    const s = await api<SetupSummary>(`/api/projects/${projectId}/setup-summary`, { token });
    setSummary(s);
  }, [projectId, token]);

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
        <Link to={`/projects/${projectId}`} className="ml-auto text-sm font-semibold text-brand">
          Open project tools →
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="!p-4 space-y-3">
          <h3 className="font-semibold text-sm">Directory · people (emails for comms)</h3>
          <ul className="text-sm divide-y divide-line max-h-48 overflow-y-auto">
            {summary.members.map((m) => (
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
                sublabel: u.email,
              }))}
              value={memberUserId}
              onChange={setMemberUserId}
              placeholder="Existing login…"
              searchPlaceholder="Search name or email…"
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
            <h3 className="font-semibold text-sm">Project vendors / contractors</h3>
            <Link to="/master/vendors" className="text-xs font-semibold text-brand">
              Global directory →
            </Link>
          </div>
          <ul className="text-sm divide-y divide-line max-h-40 overflow-y-auto">
            {summary.vendors.map((v) => (
              <li key={v.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{v.name}</span>
                  <Badge tone="brand">{v.partyType}</Badge>
                </div>
                <div className="text-xs text-steel-muted">{v.trade || v.tradeRole || "—"}</div>
                {v.email && <div className="text-xs font-mono">{v.email}</div>}
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
            <Select className="min-w-[180px] flex-1" value={assignVendorId} onChange={(e) => setAssignVendorId(e.target.value)} required>
              <option value="">From global catalog…</option>
              {allVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.trade || v.partyType}
                </option>
              ))}
            </Select>
            <Input placeholder="Trade on project" value={assignTrade} onChange={(e) => setAssignTrade(e.target.value)} />
            <Button type="submit" variant="secondary" disabled={busy}>
              Add
            </Button>
          </form>
        </Card>
      </div>

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
    </div>
  );
}
