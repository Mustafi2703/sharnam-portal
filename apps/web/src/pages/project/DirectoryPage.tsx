import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";
import { matchesSearch, SearchableSelect } from "../../components/SearchableSelect";
import { WorkPackagesPanel } from "../../components/WorkPackagesPanel";
import { DirectorySignOffRegister } from "../../components/DirectorySignOffRegister";
import { DirectoryMySignaturePanel } from "../../components/DirectoryMySignaturePanel";
import { formatPartyType } from "../../lib/vendorTypes";
import { VendorManageActions } from "../../components/VendorManageActions";
import { PortalAccountFields } from "../../components/PortalAccountFields";
import { UserAccountEditModal, type UserAccountRow } from "../../components/UserAccountEditModal";
import { UserManageActions } from "../../components/UserManageActions";
import {
  EMPTY_PORTAL_ACCOUNT_FORM,
  accountKindLabel,
  loginPathForAccount,
  portalAccountKind,
  roleFromAccountKind,
  type PortalAccountForm,
  type PortalAccountKind,
} from "../../lib/portalAccounts";

const USER_TOOLS: {
  key: string;
  label: string;
  party: string;
  roles: string[];
}[] = [
  { key: "Office", label: "Sharnam Office", party: "PMC", roles: ["admin", "office", "employee"] },
  { key: "Site", label: "Site", party: "Site", roles: ["site_employee"] },
  { key: "Client", label: "Client", party: "Client", roles: ["client"] },
  { key: "Contractor", label: "Vendor / contractor", party: "Contractor", roles: [] },
];

function crmDirectoryHref(party: string) {
  if (party === "Client") return "/crm/directory/clients";
  if (party === "Contractor" || party === "Vendor") return "/crm/directory/vendors";
  return "/crm/directory/stakeholders";
}

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
  const [msg, setMsg] = useState("");
  const [listQ, setListQ] = useState("");
  const canEdit = user?.role === "admin" || user?.role === "office";
  const [userForm, setUserForm] = useState<PortalAccountForm>({
    ...EMPTY_PORTAL_ACCOUNT_FORM,
    role: "office",
    department: "Office",
  });
  const [userKind, setUserKind] = useState<PortalAccountKind>("staff");
  const [editUser, setEditUser] = useState<UserAccountRow | null>(null);

  const activeTool = USER_TOOLS.find((t) => t.party === partyTab) || USER_TOOLS[0];

  useEffect(() => {
    if (activeTool.party === "Client") {
      setUserKind("client");
      setUserForm({ ...EMPTY_PORTAL_ACCOUNT_FORM, role: "client" });
    } else if (activeTool.party === "Contractor") {
      setUserKind("vendor");
      setUserForm({ ...EMPTY_PORTAL_ACCOUNT_FORM, role: "vendor" });
    } else if (activeTool.party === "Site") {
      setUserKind("staff");
      setUserForm({ ...EMPTY_PORTAL_ACCOUNT_FORM, role: "site_employee", department: "Site" });
    } else {
      setUserKind("staff");
      setUserForm({ ...EMPTY_PORTAL_ACCOUNT_FORM, role: "office", department: "Office" });
    }
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
          ? ["PMC", "Consultant", "Designer"]
          : [activeTool.party];
    return rows.filter((r: any) => {
      const pt = r.vendor?.partyType || r.partyType || "";
      return want.includes(pt);
    });
  }, [overview, activeTool]);

  const linkableParties = useMemo(() => {
    const want =
      activeTool.party === "Site"
        ? ["Contractor", "Vendor"]
        : activeTool.party === "PMC"
          ? ["PMC", "Consultant", "Designer"]
          : activeTool.party === "Contractor"
            ? ["Contractor", "Vendor"]
            : [activeTool.party];
    return allParties.filter((v) => want.includes(v.partyType));
  }, [allParties, activeTool.party]);

  async function assignExistingParty(e: FormEvent) {
    e.preventDefault();
    if (!vendorId) return;
    await api(`/api/vendors/project/${id}/assign`, {
      method: "POST",
      token,
      body: JSON.stringify({ vendorId, tradeRole: trade }),
    });
    setMsg("Party linked from CRM directory.");
    setVendorId("");
    await load();
  }

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        eyebrow="Project · directory"
        title="People on this job"
        subtitle="Assign SPDC staff and link companies already in CRM. Add or edit client, consultant, and vendor master records on CRM directory tabs only."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link to="/crm/directory/clients" className="text-sm font-semibold text-brand">
              CRM clients →
            </Link>
            <Link to="/crm/directory/stakeholders" className="text-sm font-semibold text-brand">
              CRM consultants →
            </Link>
            <Link to="/crm/directory/vendors" className="text-sm font-semibold text-brand">
              CRM vendors →
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

      {id && (
        <DirectoryMySignaturePanel projectId={id} token={token} />
      )}

      {id && (
        <DirectorySignOffRegister
          projectId={id}
          token={token}
          members={overview?.members || []}
          vendors={overview?.vendors || []}
          canEditAll={canEdit}
          currentUserId={user?.id}
          currentUserEmail={user?.email}
          currentUserVendorId={user?.vendorId}
          onSaved={load}
        />
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
        <Input
          className="mb-3"
          placeholder="Search allocated people or companies by name…"
          value={listQ}
          onChange={(e) => setListQ(e.target.value)}
        />
        <ul className="divide-y divide-line text-sm">
          {staffForTab
            .filter((m: any) =>
              matchesSearch(`${m.user?.fullName || m.fullName || ""} ${m.user?.email || m.email || ""}`, listQ)
            )
            .map((m: any) => (
            <li key={m.id} className="py-2 flex justify-between gap-2">
              <div>
                <span>{m.user?.fullName || m.fullName}</span>
                {m.user?.email && <div className="text-[10px] font-mono text-steel-muted">{m.user.email}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">
                  {accountKindLabel(portalAccountKind(m.user?.role || m.role, m.user?.profile))}
                </Badge>
                {canEdit && m.user?.id ? (
                  <UserManageActions
                    user={{
                      id: m.user.id,
                      fullName: m.user.fullName,
                      email: m.user.email,
                      role: m.user.role,
                      phone: m.user.phone,
                      profile: m.user.profile,
                    }}
                    token={token}
                    onEdit={() =>
                      setEditUser({
                        id: m.user.id,
                        fullName: m.user.fullName,
                        email: m.user.email,
                        role: m.user.role,
                        phone: m.user.phone,
                        profile: m.user.profile,
                        memberships: id
                          ? [{ id: m.id, project: { id, code: overview?.project?.code || "", name: overview?.project?.name || "" } }]
                          : [],
                      })
                    }
                    onChanged={() => void load()}
                  />
                ) : null}
              </div>
            </li>
          ))}
          {partiesForTab
            .filter((r: any) =>
              matchesSearch(
                `${r.vendor?.name || r.name || ""} ${r.vendor?.email || r.email || ""} ${r.vendor?.primaryContactName || ""}`,
                listQ
              )
            )
            .map((r: any) => (
            <li key={r.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span>{r.vendor?.name || r.name}</span>
                <div className="text-[10px] text-steel-muted">{r.vendor?.email || r.email || ""}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{formatPartyType(r.vendor?.partyType || r.partyType)}</Badge>
                {canEdit && (r.vendor || r.id) ? (
                  <VendorManageActions
                    vendor={{ id: r.vendor?.id || r.vendorId || r.id, name: r.vendor?.name || r.name }}
                    token={token}
                    projectId={id}
                    showEdit={false}
                    onChanged={() => void load()}
                  />
                ) : null}
              </div>
            </li>
          ))}
          {!staffForTab.length && !partiesForTab.length && (
            <li className="py-4 text-steel-muted">No one in this tool yet — assign below.</li>
          )}
        </ul>
      </Card>

      {canEdit && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="!p-4 bg-sand/30">
            <h3 className="font-semibold mb-2 text-sm">Company master is on CRM</h3>
            <p className="text-xs text-steel-muted mb-3">
              Add or edit {activeTool.label.toLowerCase()} companies on{" "}
              <Link to={crmDirectoryHref(activeTool.party)} className="text-brand font-semibold">
                CRM directory
              </Link>
              , then link them to this project below.
            </p>
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
                    keywords: `${u.fullName} ${u.email} ${u.role} ${u.phone || ""}`,
                  }))}
                value={userId}
                onChange={setUserId}
                placeholder="Select person"
                searchPlaceholder="Search employee by name or email…"
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
                  const role = roleFromAccountKind(userKind, userForm.role);
                  const user = await api<{ id: string }>("/api/hrm/employees", {
                    method: "POST",
                    token,
                    body: JSON.stringify({
                      fullName: userForm.fullName,
                      email: userForm.email,
                      role,
                      phone: userForm.phone,
                      password: userForm.password,
                      designation: userForm.designation,
                      department: userKind === "staff" || userKind === "stakeholder" ? userForm.department : undefined,
                      empCode: userKind === "staff" ? userForm.empCode : undefined,
                    }),
                  });
                  await api("/api/hrm/assign", {
                    method: "POST",
                    token,
                    body: JSON.stringify({ projectId: id, userId: user.id, role }),
                  });
                  setMsg(`Login created as ${accountKindLabel(userKind)} · ${loginPathForAccount(role, userKind)} and assigned to this project.`);
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Create failed");
                }
              }}
            >
              <p className="sm:col-span-2 text-[10px] font-mono uppercase text-steel-muted">
                Create {accountKindLabel(userKind)} login
              </p>
              <div className="sm:col-span-2">
                <PortalAccountFields
                  form={userForm}
                  onChange={setUserForm}
                  kind={userKind}
                  onKindChange={setUserKind}
                  allowKindSwitch={activeTool.party === "PMC"}
                  allowAdminRole={user?.role === "admin"}
                  token={token}
                />
              </div>
              <Button type="submit" className="sm:col-span-2" variant="secondary">
                Create user + assign
              </Button>
            </form>
            <form
              className="flex flex-wrap gap-2 items-end mt-4 pt-4 border-t border-line"
              onSubmit={assignExistingParty}
            >
              <SearchableSelect
                className="min-w-[180px] flex-1"
                options={linkableParties.map((v) => ({
                  value: v.id,
                  label: v.name,
                  sublabel: `${v.partyType}${v.trade ? ` · ${v.trade}` : ""}${v.email ? ` · ${v.email}` : ""}`,
                  keywords: [v.name, v.email, v.trade, v.primaryContactName, v.businessPhone, v.city]
                    .filter(Boolean)
                    .join(" "),
                }))}
                value={vendorId}
                onChange={setVendorId}
                placeholder="Link from CRM directory…"
                searchPlaceholder="Search company by name, contact, or email…"
                required
              />
              <Input placeholder="Trade on project" value={trade} onChange={(e) => setTrade(e.target.value)} />
              <Button type="submit" variant="secondary">
                Link
              </Button>
            </form>
          </Card>
        </div>
      )}

      <UserAccountEditModal
        open={!!editUser}
        user={editUser}
        token={token}
        isAdmin={user?.role === "admin"}
        onClose={() => setEditUser(null)}
        onSaved={() => void load()}
        onDeleted={() => void load()}
      />
    </div>
  );
}
