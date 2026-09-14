import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PortalAccountFields } from "../../components/PortalAccountFields";
import { UserAccountEditModal, type UserAccountRow } from "../../components/UserAccountEditModal";
import { UserManageActions } from "../../components/UserManageActions";
import {
  EMPTY_PORTAL_ACCOUNT_FORM,
  accountKindLabel,
  badgeToneForKind,
  loginPathForAccount,
  portalAccountKind,
  roleFromAccountKind,
  type PortalAccountForm,
  type PortalAccountKind,
} from "../../lib/portalAccounts";
import { ConsultantTypeSelect, ConsultantTypesPanel } from "../../components/ConsultantTypesPanel";
import { useConsultantTypes } from "../../lib/consultantTypes";
import { VendorManageActions } from "../../components/VendorManageActions";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import {
  EMPTY_VENDOR_FORM,
  VENDOR_PARTY_TYPES,
  formatPartyType,
  vendorToForm,
  type VendorFormState,
  type VendorPartyType,
} from "../../lib/vendorTypes";
import {
  CRM_BID_DISCIPLINES,
  formatVendorBidDisciplines,
  parseVendorBidDisciplines,
} from "../../lib/crmBidDisciplines";

type VendorRow = VendorFormState & { id: string; isActive?: boolean; _count?: { projects: number } };

const TAB_META: Record<
  string,
  { title: string; subtitle: string; partyTypes: VendorPartyType[]; defaultParty: VendorPartyType; loginRole?: string }
> = {
  vendors: {
    title: "Vendors / contractors master",
    subtitle: "Add the company, contact, email, and phone here. Portal login at /login/vendor is created with the record. Pick these companies later in Bid management — not in project setup.",
    partyTypes: ["Contractor", "Vendor"] as VendorPartyType[],
    defaultParty: "Contractor",
  },
  clients: {
    title: "Client directory",
    subtitle: "Ask for company, contact, email, and phone here. Client portal at /login/client is ready as soon as you save.",
    partyTypes: ["Client"],
    defaultParty: "Client",
    loginRole: "client",
  },
  stakeholders: {
    title: "Consultants",
    subtitle: "Separate list from vendors. Add consultant type and contact — stakeholder login at /login/stakeholder is created on save.",
    partyTypes: ["Consultant", "PMC", "Designer"],
    defaultParty: "Consultant",
    loginRole: "employee",
  },
  people: {
    title: "External logins",
    subtitle: "Client, consultant, and vendor accounts only. Manage SPDC employees in HRMS → Users.",
    partyTypes: [],
    defaultParty: "Contractor",
  },
};

export const DIRECTORY_TAB_META = TAB_META;

export function DirectoryCompaniesPanel({
  tab,
  token,
  canEdit,
}: {
  tab: keyof typeof TAB_META;
  token: string | null;
  canEdit: boolean;
}) {
  const meta = TAB_META[tab];
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormState>({ ...EMPTY_VENDOR_FORM, partyType: meta.defaultParty });
  const [msg, setMsg] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [loginPassword, setLoginPassword] = useState("Demo@1234");
  const [listSearch, setListSearch] = useState("");
  const formPanelRef = useRef<HTMLDivElement>(null);
  const { types: consultantTypes } = useConsultantTypes(token);

  const load = useCallback(async () => {
    const qs = tab === "vendors" ? "?partyType=Contractor" : tab === "clients" ? "?partyType=Client" : "";
    const list = await api<VendorRow[]>(`/api/vendors${qs}`, { token });
    setRows(list.filter((r) => !meta.partyTypes.length || meta.partyTypes.includes(r.partyType as VendorPartyType)));
  }, [token, meta.partyTypes, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  const visibleRows = useMemo(() => {
    const needle = listSearch.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.name, r.trade, r.email, r.partyType, r.city].filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
  }, [rows, listSearch]);

  useEffect(() => {
    if (selected) setForm(vendorToForm(selected));
    else if (!selectedId) setForm({ ...EMPTY_VENDOR_FORM, partyType: meta.defaultParty });
  }, [selected, selectedId, meta.defaultParty]);

  function startNewCompany() {
    setSelectedId(null);
    setForm({ ...EMPTY_VENDOR_FORM, partyType: meta.defaultParty });
    setMsg("");
    setLoginMsg("");
    setLoginPassword("Demo@1234");
    requestAnimationFrame(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMsg("");
    try {
      if (selectedId) {
        await api(`/api/vendors/${selectedId}`, { method: "PATCH", token, body: JSON.stringify(form) });
        setMsg("Updated");
      } else {
        const created = await api<VendorRow & { login?: { email: string; created: boolean; tempPassword?: string } }>(
          "/api/vendors",
          {
            method: "POST",
            token,
            body: JSON.stringify({ ...form, createLogin: true, password: loginPassword }),
          }
        );
        setSelectedId(created.id);
        const path =
          tab === "clients" ? "/login/client" : tab === "stakeholders" ? "/login/stakeholder" : "/login/vendor";
        if (created.login?.created) {
          setMsg(`Saved. Portal ready — ${created.login.email} signs in at ${path}. Password: ${created.login.tempPassword || loginPassword}`);
        } else if (created.login) {
          setMsg(`Saved. Login already existed for ${created.login.email} · ${path}`);
        } else {
          setMsg("Added to directory. Add an email to issue a portal login.");
        }
      }
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function createLogin() {
    if (!selected?.email) {
      setLoginMsg("Add an email on the company record first.");
      return;
    }
    setLoginMsg("");
    try {
      const role = meta.loginRole || (tab === "vendors" ? "vendor" : tab === "stakeholders" ? "employee" : "client");
      const kind = portalAccountKind(role, { department: tab === "stakeholders" ? selected.trade : null });
      await api("/api/hrm/employees", {
        method: "POST",
        token,
        body: JSON.stringify({
          email: selected.email,
          fullName: selected.primaryContactName || selected.name,
          role,
          phone: selected.businessPhone,
          designation: selected.name,
          department: tab === "stakeholders" ? selected.trade || undefined : undefined,
        }),
      });
      setLoginMsg(
        `Portal login created for ${selected.email} (${accountKindLabel(kind)}). Default password: Demo@1234 · Sign in at ${loginPathForAccount(role, kind)}`
      );
    } catch (err) {
      setLoginMsg(err instanceof Error ? err.message : "Could not create login");
    }
  }

  function toggleBidDiscipline(key: string) {
    const current = parseVendorBidDisciplines(form.trade);
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setForm({ ...form, trade: formatVendorBidDisciplines(next) });
  }

  return (
    <div className="space-y-4">
    {tab === "stakeholders" ? <ConsultantTypesPanel token={token} /> : null}
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4">
      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 space-y-2">
          <div className="font-semibold text-sm flex justify-between">
            <span>{visibleRows.length} companies</span>
            {canEdit && (
              <Button type="button" variant="secondary" className="!text-xs !py-1 !px-2" onClick={startNewCompany}>
                + New
              </Button>
            )}
          </div>
          <Input
            placeholder="Search name, trade, email…"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            className="!text-sm"
          />
        </div>
        <ul className="divide-y max-h-[420px] overflow-y-auto text-sm">
          {visibleRows.map((r) => (
            <li
              key={r.id}
              className={`px-4 py-3 flex flex-wrap items-start justify-between gap-2 ${selectedId === r.id ? "bg-brand-soft/50" : ""}`}
            >
              <button type="button" className="text-left min-w-0 flex-1 hover:text-brand" onClick={() => setSelectedId(r.id)}>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-steel-muted mt-0.5">
                  {formatPartyType(r.partyType)}
                  {r.email ? ` · ${r.email}` : ""}
                  {r._count?.projects ? ` · ${r._count.projects} project(s)` : ""}
                </div>
              </button>
              {canEdit ? (
                <VendorManageActions
                  vendor={r}
                  token={token}
                  onEdit={() => {
                    setSelectedId(r.id);
                    requestAnimationFrame(() =>
                      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
                    );
                  }}
                  onChanged={async () => {
                    if (selectedId === r.id) setSelectedId(null);
                    setMsg("Directory updated.");
                    await load();
                  }}
                />
              ) : null}
            </li>
          ))}
          {!visibleRows.length && <li className="px-4 py-8 text-center text-steel-muted">No records yet.</li>}
        </ul>
      </Card>

      <div ref={formPanelRef}>
      <Card>
        <h3 className="font-semibold text-sm mb-1">{selected ? "Edit company" : "Add company + portal login"}</h3>
        {!selected ? (
          <p className="text-[11px] text-steel-muted mb-3">
            Company, contact, email, and phone are collected here. Saving creates the{" "}
            {tab === "clients" ? "client" : tab === "stakeholders" ? "consultant / stakeholder" : "vendor"} login.
          </p>
        ) : null}
        <form className="space-y-3" onSubmit={save}>
          <Input required placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}>
            {VENDOR_PARTY_TYPES.filter((p) => meta.partyTypes.includes(p.value)).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Input required placeholder="Primary contact (login name)" value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} />
          <Input required placeholder="Email (portal login)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input required placeholder="Phone" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
          {!selected ? (
            <Input
              placeholder="Portal password (default Demo@1234)"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          ) : null}
          {tab === "stakeholders" ? (
            <ConsultantTypeSelect value={form.trade} onChange={(trade) => setForm({ ...form, trade })} types={consultantTypes} />
          ) : null}
          <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          {(tab === "vendors" || meta.partyTypes.includes("Contractor")) && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase text-steel-muted mb-1">R2 bid packages (Comparative Statement BOQ sheets)</p>
                <p className="text-[10px] text-steel-muted mb-2">
                  Tag which BOQ sheets this contractor can bid — CCV, Electrical Lab, Admin, etc. Used when picking bidders on CRM convert.
                  Not the same as project work packages (Civil, PEB, MEP).
                </p>
                <div className="flex flex-wrap gap-2">
                  {CRM_BID_DISCIPLINES.map((d) => (
                    <label key={d.key} className="flex items-center gap-1 text-xs border rounded-lg px-2 py-1">
                      <input type="checkbox" checked={parseVendorBidDisciplines(form.trade).includes(d.key)} onChange={() => toggleBidDiscipline(d.key)} />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <TextArea placeholder="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">Save</Button>
              {selected && (meta.loginRole || tab === "vendors" || tab === "clients" || tab === "stakeholders") && (
                <Button type="button" variant="secondary" onClick={() => void createLogin()}>
                  Create portal login
                </Button>
              )}
              {selected ? (
                <VendorManageActions
                  vendor={selected}
                  token={token}
                  showEdit={false}
                  onChanged={async () => {
                    setSelectedId(null);
                    setMsg("Company removed from directory.");
                    await load();
                  }}
                />
              ) : null}
            </div>
          )}
          {msg && <p className="text-xs text-brand-dark">{msg}</p>}
          {loginMsg && <p className="text-xs text-steel-muted">{loginMsg}</p>}
        </form>
        <p className="text-[11px] text-steel-muted mt-4 border-t border-line pt-3">
          {tab === "vendors" ? (
            <>
              Open a bid from{" "}
              <Link to="/crm/bids" className="text-brand font-semibold">
                Bid management
              </Link>{" "}
              and pick companies from this list.
            </>
          ) : (
            <>
              Attach this company on{" "}
              <Link to="/crm/setup" className="text-brand font-semibold">
                Project setup
              </Link>
              . SPDC staff stay in{" "}
              <Link to="/hrm/users" className="text-brand font-semibold">
                HRMS → Users
              </Link>
              .
            </>
          )}
        </p>
      </Card>
      </div>
    </div>
    </div>
  );
}

export function DirectoryPeoplePanel({ token, canEdit }: { token: string | null; canEdit: boolean }) {
  const [people, setPeople] = useState<UserAccountRow[]>([]);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | PortalAccountKind>("all");
  const [form, setForm] = useState<PortalAccountForm>({ ...EMPTY_PORTAL_ACCOUNT_FORM, role: "client" });
  const [kind, setKind] = useState<PortalAccountKind>("client");
  const [msg, setMsg] = useState("");
  const [editUser, setEditUser] = useState<UserAccountRow | null>(null);

  const visiblePeople = useMemo(() => {
    const needle = peopleSearch.trim().toLowerCase();
    return people.filter((p) => {
      const pKind = portalAccountKind(p.role, p.profile);
      if (pKind === "staff") return false;
      if (kindFilter !== "all" && pKind !== kindFilter) return false;
      if (!needle) return true;
      return [p.fullName, p.email, p.role, accountKindLabel(pKind), ...(p.memberships?.map((m) => m.project.code) || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [people, peopleSearch, kindFilter]);

  const load = useCallback(async () => {
    const fromHrm = await api<UserAccountRow[]>("/api/hrm/employees?scope=all", { token }).catch(() => []);
    if (fromHrm.length) {
      setPeople(fromHrm);
      return;
    }
    const fromUsers = await api<UserAccountRow[]>("/api/users", { token }).catch(() => []);
    setPeople(fromUsers);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMsg("");
    try {
      const role = roleFromAccountKind(kind, form.role);
      await api("/api/hrm/employees", {
        method: "POST",
        token,
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          role,
          phone: form.phone,
          designation: form.designation,
          department: kind === "staff" || kind === "stakeholder" ? form.department : undefined,
          empCode: kind === "staff" ? form.empCode : undefined,
          password: form.password,
        }),
      });
      setForm({ ...EMPTY_PORTAL_ACCOUNT_FORM, role: "client" });
      setKind("client");
      setMsg(`Login created for ${form.email} as ${accountKindLabel(kind)}. Sign in at ${loginPathForAccount(role, kind)}. Default password: ${form.password || "Demo@1234"}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 space-y-2">
          <div className="font-semibold text-sm flex flex-wrap items-center justify-between gap-2">
            <span>{visiblePeople.length} external logins</span>
            <Link to="/hrm/users" className="text-[11px] font-semibold text-brand">
              SPDC staff → HRMS
            </Link>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "client", "stakeholder", "vendor"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${
                  kindFilter === k ? "bg-brand text-white border-brand" : "bg-paper text-steel-muted border-line"
                }`}
                onClick={() => setKindFilter(k)}
              >
                {k === "all" ? "All" : accountKindLabel(k)}
              </button>
            ))}
          </div>
          <Input
            placeholder="Search name, email, client…"
            value={peopleSearch}
            onChange={(e) => setPeopleSearch(e.target.value)}
            className="!text-sm"
          />
        </div>
        <ul className="divide-y max-h-[460px] overflow-y-auto text-sm">
          {visiblePeople.map((p) => (
            <li key={p.id} className="px-4 py-3 flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-medium">{p.fullName}</div>
                <div className="text-xs text-steel-muted">{p.email}{p.phone ? ` · ${p.phone}` : ""}</div>
                {p.profile?.designation ? (
                  <div className="text-[11px] text-ink mt-0.5">{p.profile.designation}</div>
                ) : null}
                {p.memberships?.length ? (
                  <div className="text-[10px] text-steel-muted mt-1">
                    {p.memberships.map((m) => m.project.code).join(", ")}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={p.isActive === false ? "warn" : badgeToneForKind(portalAccountKind(p.role, p.profile))}>
                  {accountKindLabel(portalAccountKind(p.role, p.profile))}
                </Badge>
                <span className="text-[10px] font-mono text-steel-muted">
                  {loginPathForAccount(p.role, portalAccountKind(p.role, p.profile))}
                </span>
                {canEdit ? (
                  <UserManageActions
                    user={p}
                    token={token}
                    onEdit={() => setEditUser(p)}
                    onChanged={async () => {
                      setMsg("User list updated.");
                      await load();
                    }}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm mb-3">Create portal login</h3>
        <form className="space-y-3" onSubmit={create}>
          <PortalAccountFields
            form={form}
            onChange={setForm}
            kind={kind}
            onKindChange={setKind}
            allowAdminRole={false}
            token={token}
            externalOnly
          />
          {canEdit && <Button type="submit">Create login</Button>}
          {msg && <p className="text-xs text-steel-muted">{msg}</p>}
        </form>
        <p className="text-[11px] text-steel-muted mt-4">
          Full access matrix: <Link to="/roles" className="text-brand font-semibold">Access · Users</Link>
        </p>
      </Card>

      <UserAccountEditModal
        open={!!editUser}
        user={editUser}
        token={token}
        isAdmin={canEdit}
        onClose={() => setEditUser(null)}
        onSaved={async () => {
          setMsg("User updated.");
          await load();
        }}
        onDeleted={async () => {
          setMsg("User removed.");
          await load();
        }}
      />
    </div>
  );
}

/** CRM directories — vendors, clients, stakeholders, people. */
export default function CrmDirectoryPage() {
  const { tab = "vendors" } = useParams();
  const { token, user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "office";
  const meta = TAB_META[tab] || TAB_META.vendors;

  return (
    <div className="space-y-4">
      <PageHeader dense title={meta.title} subtitle={meta.subtitle} />
      {tab === "people" ? (
        <DirectoryPeoplePanel token={token} canEdit={canEdit} />
      ) : (
        <DirectoryCompaniesPanel tab={tab as keyof typeof TAB_META} token={token} canEdit={canEdit} />
      )}
    </div>
  );
}
