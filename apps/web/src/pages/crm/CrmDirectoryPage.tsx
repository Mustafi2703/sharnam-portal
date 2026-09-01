import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import {
  EMPTY_VENDOR_FORM,
  VENDOR_PARTY_TYPES,
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
type PersonRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string | null;
  isActive?: boolean;
  memberships?: { project: { code: string; name: string } }[];
};

const TAB_META: Record<
  string,
  { title: string; subtitle: string; partyTypes: VendorPartyType[]; defaultParty: VendorPartyType; loginRole?: string }
> = {
  vendors: {
    title: "Vendor & contractor directory",
    subtitle: "Tag R2 BOQ disciplines · assign to projects · issue contractor portal logins.",
    partyTypes: ["Contractor", "Vendor"],
    defaultParty: "Contractor",
  },
  clients: {
    title: "Client directory",
    subtitle: "Owner organisations linked to leads and projects · client portal access.",
    partyTypes: ["Client"],
    defaultParty: "Client",
    loginRole: "client",
  },
  stakeholders: {
    title: "Stakeholders & consultants",
    subtitle: "Design consultants, PMC partners, and third-party reviewers on projects.",
    partyTypes: ["Consultant", "PMC"],
    defaultParty: "Consultant",
  },
  people: {
    title: "People & portal access",
    subtitle: "Create logins for office, site, vendor, and client roles — assign to projects from project directory.",
    partyTypes: [],
    defaultParty: "Vendor",
  },
};

function DirectoryCompaniesPanel({
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

  const load = useCallback(async () => {
    const list = await api<VendorRow[]>("/api/vendors", { token });
    setRows(list.filter((r) => meta.partyTypes.includes(r.partyType as VendorPartyType)));
  }, [token, meta.partyTypes]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  useEffect(() => {
    if (selected) setForm(vendorToForm(selected));
    else if (!selectedId) setForm({ ...EMPTY_VENDOR_FORM, partyType: meta.defaultParty });
  }, [selected, selectedId, meta.defaultParty]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMsg("");
    try {
      if (selectedId) {
        await api(`/api/vendors/${selectedId}`, { method: "PATCH", token, body: JSON.stringify(form) });
        setMsg("Updated");
      } else {
        const created = await api<VendorRow>("/api/vendors", { method: "POST", token, body: JSON.stringify(form) });
        setSelectedId(created.id);
        setMsg("Added to directory");
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
      const role = meta.loginRole || (tab === "vendors" ? "vendor" : "client");
      await api("/api/hrm/employees", {
        method: "POST",
        token,
        body: JSON.stringify({
          email: selected.email,
          fullName: selected.primaryContactName || selected.name,
          role,
          phone: selected.businessPhone,
        }),
      });
      setLoginMsg(`Portal login created for ${selected.email} (${role}). Default password: Demo@1234`);
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
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4">
      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm flex justify-between">
          <span>{rows.length} companies</span>
          {canEdit && (
            <button type="button" className="text-xs text-brand font-semibold" onClick={() => setSelectedId(null)}>
              + New
            </button>
          )}
        </div>
        <ul className="divide-y max-h-[420px] overflow-y-auto text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`w-full text-left px-4 py-3 hover:bg-brand-soft/30 ${selectedId === r.id ? "bg-brand-soft/50" : ""}`}
                onClick={() => setSelectedId(r.id)}
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-steel-muted mt-0.5">
                  {r.partyType}
                  {r.email ? ` · ${r.email}` : ""}
                  {r._count?.projects ? ` · ${r._count.projects} project(s)` : ""}
                </div>
              </button>
            </li>
          ))}
          {!rows.length && <li className="px-4 py-8 text-center text-steel-muted">No records yet.</li>}
        </ul>
      </Card>

      <Card>
        <h3 className="font-semibold text-sm mb-3">{selected ? "Edit company" : "Add company"}</h3>
        <form className="space-y-3" onSubmit={save}>
          <Input required placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}>
            {VENDOR_PARTY_TYPES.filter((p) => meta.partyTypes.includes(p.value)).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Input placeholder="Primary contact" value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} />
          <Input placeholder="Email (for portal login)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Phone" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
          <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          {tab === "vendors" && (
            <div>
              <p className="text-xs font-semibold uppercase text-steel-muted mb-2">R2 bid disciplines</p>
              <div className="flex flex-wrap gap-2">
                {CRM_BID_DISCIPLINES.map((d) => (
                  <label key={d.key} className="flex items-center gap-1 text-xs border rounded-lg px-2 py-1">
                    <input type="checkbox" checked={parseVendorBidDisciplines(form.trade).includes(d.key)} onChange={() => toggleBidDiscipline(d.key)} />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <TextArea placeholder="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save</Button>
              {selected && (meta.loginRole || tab === "vendors" || tab === "clients") && (
                <Button type="button" variant="secondary" onClick={() => void createLogin()}>
                  Create portal login
                </Button>
              )}
            </div>
          )}
          {msg && <p className="text-xs text-brand-dark">{msg}</p>}
          {loginMsg && <p className="text-xs text-steel-muted">{loginMsg}</p>}
        </form>
        <p className="text-[11px] text-steel-muted mt-4 border-t border-line pt-3">
          Assign to a delivery project from{" "}
          <Link to="/projects" className="text-brand font-semibold">
            Projects → Directory
          </Link>
          . Open comparative bids from{" "}
          <Link to="/crm/bids" className="text-brand font-semibold">
            Bid management
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

function DirectoryPeoplePanel({ token, canEdit }: { token: string | null; canEdit: boolean }) {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", role: "vendor", phone: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const rows = await api<PersonRow[]>("/api/hrm/employees", { token }).catch(() => []);
    setPeople(rows);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMsg("");
    try {
      await api("/api/hrm/employees", { method: "POST", token, body: JSON.stringify(form) });
      setForm({ fullName: "", email: "", role: "vendor", phone: "" });
      setMsg(`Login created for ${form.email}. Default password: Demo@1234`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm">{people.length} portal accounts</div>
        <ul className="divide-y max-h-[460px] overflow-y-auto text-sm">
          {people.map((p) => (
            <li key={p.id} className="px-4 py-3 flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-medium">{p.fullName}</div>
                <div className="text-xs text-steel-muted">{p.email}</div>
                {p.memberships?.length ? (
                  <div className="text-[10px] text-steel-muted mt-1">
                    {p.memberships.map((m) => m.project.code).join(", ")}
                  </div>
                ) : null}
              </div>
              <Badge tone={p.isActive === false ? "warn" : "ok"}>{p.role}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm mb-3">Create portal login</h3>
        <form className="space-y-3" onSubmit={create}>
          <Input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="admin">Admin (office portal)</option>
            <option value="office">Office team</option>
            <option value="employee">Stakeholder / partner PMC</option>
            <option value="vendor">Vendor / contractor</option>
            <option value="client">Client</option>
            <option value="site_employee">Site employee</option>
          </Select>
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {canEdit && <Button type="submit">Create login</Button>}
          {msg && <p className="text-xs text-steel-muted">{msg}</p>}
        </form>
        <p className="text-[11px] text-steel-muted mt-4">
          Full access matrix: <Link to="/roles" className="text-brand font-semibold">Access · Users</Link>
        </p>
      </Card>
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
