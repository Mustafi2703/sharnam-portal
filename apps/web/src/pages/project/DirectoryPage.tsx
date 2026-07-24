import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";

const PARTY_TYPES = ["Contractor", "Vendor", "Client", "Consultant", "PMC"] as const;

/** Project directory — PMC, contractors, vendors, clients + staff */
export default function DirectoryPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [allParties, setAllParties] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("member");
  const [vendorId, setVendorId] = useState("");
  const [trade, setTrade] = useState("");
  const [partyForm, setPartyForm] = useState({
    name: "",
    partyType: "Contractor" as (typeof PARTY_TYPES)[number],
    trade: "",
    email: "",
    primaryContactName: "",
    businessPhone: "",
    city: "",
  });
  const [msg, setMsg] = useState("");
  const canEdit = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [o, u, v] = await Promise.all([
      api(`/api/directory/project/${id}/overview`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>("/api/vendors", { token }).catch(() => []),
    ]);
    setOverview(o);
    setUsers(u);
    setAllParties(v);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  async function createParty(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const created = await api<any>("/api/vendors", {
      method: "POST",
      token,
      body: JSON.stringify(partyForm),
    });
    await api(`/api/vendors/project/${id}/assign`, {
      method: "POST",
      token,
      body: JSON.stringify({ vendorId: created.id, tradeRole: partyForm.trade || partyForm.partyType }),
    });
    setPartyForm({
      name: "",
      partyType: "Contractor",
      trade: "",
      email: "",
      primaryContactName: "",
      businessPhone: "",
      city: "",
    });
    setMsg(`${created.partyType} added to directory and project`);
    await load();
  }

  const parties = overview?.parties || {};

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        eyebrow="Project directory"
        title="People · contractors · vendors · clients · PMC"
        subtitle="Add parties to the directory, assign to this project, and use them in Cost bills, RFIs, and communication matrix."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link to="/hrm" className="text-sm font-semibold text-brand">
              HRM →
            </Link>
            <Link to={`/projects/${id}/comms`} className="text-sm font-semibold text-brand">
              Matrix →
            </Link>
            <Link to={`/projects/${id}/cost?tab=bills`} className="text-sm font-semibold text-brand">
              Cost bills →
            </Link>
          </div>
        }
      />

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Staff", overview?.members?.length || 0],
          ["Contractors", overview?.stats?.contractors || 0],
          ["Vendors", overview?.stats?.vendorCompanies || 0],
          ["Clients", overview?.stats?.clients || 0],
        ].map(([l, v]) => (
          <Card key={l as string} className="!p-4">
            <div className="text-[10px] uppercase text-steel-muted">{l}</div>
            <div className="text-2xl font-display mt-1">{v as number}</div>
          </Card>
        ))}
      </div>

      {canEdit && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-3 text-sm">Add party to directory</h3>
            <form className="grid sm:grid-cols-2 gap-3" onSubmit={createParty}>
              <Select
                value={partyForm.partyType}
                onChange={(e) => setPartyForm({ ...partyForm, partyType: e.target.value as any })}
              >
                {PARTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Company / party name"
                value={partyForm.name}
                onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                required
              />
              <Input
                placeholder="Trade / role"
                value={partyForm.trade}
                onChange={(e) => setPartyForm({ ...partyForm, trade: e.target.value })}
              />
              <Input
                placeholder="Primary contact"
                value={partyForm.primaryContactName}
                onChange={(e) => setPartyForm({ ...partyForm, primaryContactName: e.target.value })}
              />
              <Input
                placeholder="Email"
                value={partyForm.email}
                onChange={(e) => setPartyForm({ ...partyForm, email: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={partyForm.businessPhone}
                onChange={(e) => setPartyForm({ ...partyForm, businessPhone: e.target.value })}
              />
              <Input
                placeholder="City"
                value={partyForm.city}
                onChange={(e) => setPartyForm({ ...partyForm, city: e.target.value })}
              />
              <Button type="submit" className="sm:col-span-2">
                Create & assign to project
              </Button>
            </form>
          </Card>

          <div className="space-y-4">
            <Card>
              <h3 className="font-semibold mb-2 text-sm">Assign PMC / staff</h3>
              <form
                className="flex flex-wrap gap-2 items-end"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/api/projects/${id}/members`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ userId, role }),
                  });
                  await load();
                }}
              >
                <Select className="min-w-[180px] flex-1" value={userId} onChange={(e) => setUserId(e.target.value)} required>
                  <option value="">Select person</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} · {u.role}
                    </option>
                  ))}
                </Select>
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="member">Member</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="site_engineer">Site Engineer</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Button type="submit">Assign</Button>
              </form>
            </Card>
            <Card>
              <h3 className="font-semibold mb-2 text-sm">Assign existing party</h3>
              <form
                className="flex flex-wrap gap-2 items-end"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/api/vendors/project/${id}/assign`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ vendorId, tradeRole: trade }),
                  });
                  setTrade("");
                  await load();
                }}
              >
                <Select className="min-w-[180px] flex-1" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                  <option value="">Select party</option>
                  {allParties.map((v) => (
                    <option key={v.id} value={v.id}>
                      [{v.partyType || "Vendor"}] {v.name}
                    </option>
                  ))}
                </Select>
                <Input className="min-w-[100px]" placeholder="Trade" value={trade} onChange={(e) => setTrade(e.target.value)} />
                <Button type="submit">Assign</Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <PartyList title="PMC" rows={parties.pmc || []} tone="brand" />
        <PartyList title="Contractors" rows={parties.contractors || []} tone="warn" />
        <PartyList title="Vendors" rows={parties.vendorsOnly || []} tone="neutral" />
        <PartyList title="Clients" rows={parties.clients || []} tone="ok" />
        <PartyList title="Consultants" rows={parties.consultants || []} tone="neutral" />
        <Card padding={false}>
          <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm">Assigned team (PMC staff)</div>
          <ul className="divide-y max-h-72 overflow-y-auto">
            {overview?.members?.map((m: any) => (
              <li key={m.id} className="px-4 py-3 flex justify-between text-sm gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.user.fullName}</div>
                  <div className="text-xs text-steel-muted truncate">{m.user.email}</div>
                </div>
                <Badge>{m.role}</Badge>
              </li>
            ))}
            {!overview?.members?.length && <li className="px-4 py-6 text-sm text-steel-muted">No staff assigned.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function PartyList({ title, rows, tone }: { title: string; rows: any[]; tone: "brand" | "warn" | "ok" | "neutral" }) {
  return (
    <Card padding={false}>
      <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm flex justify-between">
        <span>{title}</span>
        <Badge tone={tone}>{rows.length}</Badge>
      </div>
      <ul className="divide-y max-h-72 overflow-y-auto">
        {rows.map((row: any) => (
          <li key={row.id} className="px-4 py-3 text-sm">
            <div className="font-medium">{row.vendor?.name}</div>
            <div className="text-xs text-steel-muted mt-0.5">
              {row.vendor?.trade || row.tradeRole || "—"}
              {row.vendor?.primaryContactName ? ` · ${row.vendor.primaryContactName}` : ""}
            </div>
            {row.vendor?.email && <div className="text-[11px] text-steel-muted">{row.vendor.email}</div>}
          </li>
        ))}
        {!rows.length && <li className="px-4 py-6 text-sm text-steel-muted">None yet — add above.</li>}
      </ul>
    </Card>
  );
}
