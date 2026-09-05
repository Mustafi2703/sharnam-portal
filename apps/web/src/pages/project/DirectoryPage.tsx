import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";
import { SearchableSelect } from "../../components/SearchableSelect";
import { WorkPackagesPanel } from "../../components/WorkPackagesPanel";

const USER_TOOLS: {
  key: string;
  label: string;
  party: string;
  roles: string[];
}[] = [
  { key: "Office", label: "Sharnam Office", party: "PMC", roles: ["admin", "office", "employee"] },
  { key: "Site", label: "Site", party: "Site", roles: ["site_employee"] },
  { key: "Client", label: "Client", party: "Client", roles: ["client"] },
  { key: "Contractor", label: "Contractor", party: "Contractor", roles: [] },
];

const PARTY_TYPES = ["PMC", "Contractor", "Client", "Consultant", "Vendor"] as const;

/** Project directory — four user tools: Office · Site · Client · Contractor */
export default function DirectoryPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const partyTab = searchParams.get("party") || "PMC";
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
  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    role: "site_employee",
    phone: "",
    department: "Site",
    designation: "",
    password: "Demo@1234",
  });

  const activeTool = USER_TOOLS.find((t) => t.party === partyTab) || USER_TOOLS[0];

  useEffect(() => {
    setPartyForm((f) => ({
      ...f,
      partyType: (activeTool.party === "Site" ? "Contractor" : activeTool.party) as (typeof PARTY_TYPES)[number],
    }));
  }, [activeTool.party]);

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

  const staffForTab = useMemo(() => {
    const members = overview?.members || [];
    if (activeTool.party === "PMC") {
      return members.filter((m: any) => ["admin", "office", "employee"].includes(m.user?.role || m.role));
    }
    if (activeTool.party === "Site") {
      return members.filter((m: any) => (m.user?.role || m.role) === "site_employee");
    }
    if (activeTool.party === "Client") {
      return members.filter((m: any) => (m.user?.role || m.role) === "client");
    }
    return members.filter((m: any) => (m.user?.role || m.role) === "vendor");
  }, [overview, activeTool]);

  const partiesForTab = useMemo(() => {
    const list = overview?.vendors || overview?.parties?.list || [];
    const rows = Array.isArray(list) ? list : [];
    const want =
      activeTool.party === "Site"
        ? ["Contractor", "Vendor"]
        : activeTool.party === "PMC"
          ? ["PMC", "Consultant"]
          : [activeTool.party];
    return rows.filter((r: any) => {
      const pt = r.vendor?.partyType || r.partyType || "";
      return want.includes(pt);
    });
  }, [overview, activeTool]);

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
      partyType: partyForm.partyType,
      trade: "",
      email: "",
      primaryContactName: "",
      businessPhone: "",
      city: "",
    });
    setMsg(`${created.partyType} added to directory and project`);
    await load();
  }

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        eyebrow="Directory · Master tools"
        title="Four user kinds"
        subtitle="Sharnam Office · Site · Client · Contractor — assign people and parties for matrix, RFIs, and fills."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link to="/master/vendors" className="text-sm font-semibold text-brand">
              Company directory →
            </Link>
            <Link to={`/projects/${id}/vendors`} className="text-sm font-semibold text-brand">
              Project vendors →
            </Link>
            <Link to="/master" className="text-sm font-semibold text-brand">
              Master →
            </Link>
          </div>
        }
      />

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-xl">{msg}</p>}

      {canEdit && id && (
        <WorkPackagesPanel token={token} projectId={id} onSaved={() => setMsg("Work packages saved for this project.")} />
      )}

      {canEdit && id && (
        <Card className="!p-4 bg-sand/30">
          <h3 className="font-semibold text-sm mb-1">Document library (DMS · ISO Rev 02)</h3>
          <p className="text-xs text-steel-muted mb-2">
            Project folder tree in OneDrive — assign logins above so they can open files needed for RFIs, drawings, and site work.
          </p>
          <Link to={`/projects/${id}/dms`} className="text-sm font-semibold text-brand">
            Open project DMS →
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {USER_TOOLS.map((t) => (
          <Card key={t.key} className={`!p-4 ${activeTool.key === t.key ? "border-brand" : ""}`}>
            <div className="text-[10px] uppercase text-steel-muted">{t.label}</div>
            <div className="text-2xl font-display mt-1">
              {t.party === "PMC"
                ? overview?.members?.filter((m: any) => ["admin", "office", "employee"].includes(m.user?.role)).length || 0
                : t.party === "Site"
                  ? overview?.members?.filter((m: any) => m.user?.role === "site_employee").length || 0
                  : t.party === "Client"
                    ? overview?.stats?.clients || 0
                    : overview?.stats?.contractors || 0}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="font-semibold mb-3">{activeTool.label} on this project</h3>
        <ul className="divide-y divide-line text-sm">
          {staffForTab.map((m: any) => (
            <li key={m.id} className="py-2 flex justify-between gap-2">
              <div>
                <span>{m.user?.fullName || m.fullName}</span>
                {m.user?.email && <div className="text-[10px] font-mono text-steel-muted">{m.user.email}</div>}
              </div>
              <Badge tone="neutral">{m.user?.role || m.role}</Badge>
            </li>
          ))}
          {partiesForTab.map((r: any) => (
            <li key={r.id} className="py-2 flex justify-between gap-2">
              <span>{r.vendor?.name || r.name}</span>
              <Badge tone="brand">{r.vendor?.partyType || r.partyType}</Badge>
            </li>
          ))}
          {!staffForTab.length && !partiesForTab.length && (
            <li className="py-4 text-steel-muted">No one in this tool yet — assign below.</li>
          )}
        </ul>
      </Card>

      {canEdit && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-3 text-sm">Add {activeTool.label} party</h3>
            <form className="grid sm:grid-cols-2 gap-3" onSubmit={createParty}>
              <Select
                value={partyForm.partyType}
                onChange={(e) => setPartyForm({ ...partyForm, partyType: e.target.value as (typeof PARTY_TYPES)[number] })}
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
              <Button type="submit" className="sm:col-span-2">
                Create & assign
              </Button>
            </form>
          </Card>

          <Card>
            <h3 className="font-semibold mb-2 text-sm">Assign login user ({activeTool.label})</h3>
            <form
              className="flex flex-wrap gap-2 items-end"
              onSubmit={async (e) => {
                e.preventDefault();
                await api(`/api/projects/${id}/members`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({ userId, role }),
                });
                setMsg("Person assigned.");
                await load();
              }}
            >
              <SearchableSelect
                className="min-w-[180px] flex-1"
                options={users
                  .filter((u) => !activeTool.roles.length || activeTool.roles.includes(u.role))
                  .map((u) => ({
                    value: u.id,
                    label: u.fullName,
                    sublabel: `${u.role} · ${u.email}`,
                  }))}
                value={userId}
                onChange={setUserId}
                placeholder="Select person"
                searchPlaceholder="Search name or email…"
                required
              />
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="project_manager">Project Manager</option>
                <option value="site_engineer">Site Engineer</option>
                <option value="document_controller">Document Controller (DMS)</option>
                <option value="quality_lead">Quality Lead</option>
                <option value="viewer">Viewer</option>
              </Select>
              <Button type="submit">Assign</Button>
            </form>
            <form
              className="grid sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-line"
              onSubmit={async (e) => {
                e.preventDefault();
                setMsg("");
                try {
                  const user = await api<{ id: string }>("/api/hrm/employees", {
                    method: "POST",
                    token,
                    body: JSON.stringify(userForm),
                  });
                  await api("/api/hrm/assign", {
                    method: "POST",
                    token,
                    body: JSON.stringify({ projectId: id, userId: user.id, role: userForm.role }),
                  });
                  setUserForm({
                    fullName: "",
                    email: "",
                    role: activeTool.party === "Site" ? "site_employee" : activeTool.party === "Client" ? "client" : "office",
                    phone: "",
                    department: activeTool.label,
                    designation: "",
                    password: "Demo@1234",
                  });
                  setMsg("Login created and assigned to this project.");
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Create failed");
                }
              }}
            >
              <p className="sm:col-span-2 text-[10px] font-mono uppercase text-steel-muted">Create portal login (HR)</p>
              <Input placeholder="Full name" value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} required />
              <Input placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
              <Select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                {(activeTool.roles.length ? activeTool.roles : ["office", "site_employee", "employee", "client", "vendor"]).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
              <Input placeholder="Phone" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
              <Button type="submit" className="sm:col-span-2" variant="secondary">
                Create user + assign
              </Button>
            </form>
            <form
              className="flex flex-wrap gap-2 items-end mt-4 pt-4 border-t border-line"
              onSubmit={async (e) => {
                e.preventDefault();
                await api(`/api/vendors/project/${id}/assign`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({ vendorId, tradeRole: trade }),
                });
                setMsg("Party linked.");
                await load();
              }}
            >
              <Select className="min-w-[180px] flex-1" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                <option value="">Link existing party</option>
                {allParties.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.partyType}
                  </option>
                ))}
              </Select>
              <Input placeholder="Trade" value={trade} onChange={(e) => setTrade(e.target.value)} />
              <Button type="submit" variant="secondary">
                Link
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
