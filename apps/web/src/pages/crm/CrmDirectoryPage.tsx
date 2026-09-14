import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  accountKindLabel,
  loginPathForAccount,
  portalAccountKind,
} from "../../lib/portalAccounts";
import { ConsultantTypeSelect, ConsultantTypesPanel } from "../../components/ConsultantTypesPanel";
import { useConsultantTypes } from "../../lib/consultantTypes";
import { VendorManageActions } from "../../components/VendorManageActions";
import { Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import {
  EMPTY_VENDOR_FORM,
  VENDOR_PARTY_TYPES,
  formatPartyType,
  vendorDesk,
  vendorDeskLabel,
  vendorToForm,
  type VendorFormState,
  type VendorPartyType,
} from "../../lib/vendorTypes";
import {
  CRM_BID_DISCIPLINES,
  formatVendorBidDisciplines,
  parseVendorBidDisciplines,
} from "../../lib/crmBidDisciplines";

function directoryVendorsQuery(tab: string) {
  if (tab === "vendors") return "?partyType=Contractor";
  if (tab === "clients") return "?partyType=Client";
  if (tab === "stakeholders") return "?partyType=Consultant,PMC,Designer";
  return "";
}

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
    subtitle: "Select a client to edit company, contact, email, phone, and portal password. Saves sync to every linked project card.",
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
  const [typeFilter, setTypeFilter] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const formPanelRef = useRef<HTMLDivElement>(null);
  const { types: consultantTypes } = useConsultantTypes(token);

  const load = useCallback(async () => {
    const list = await api<VendorRow[]>(`/api/vendors${directoryVendorsQuery(tab)}`, { token });
    setRows(list.filter((r) => !meta.partyTypes.length || meta.partyTypes.includes(r.partyType as VendorPartyType)));
  }, [token, meta.partyTypes, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setRows([]);
    setSelectedId(null);
    setCreatingNew(false);
    setForm({ ...EMPTY_VENDOR_FORM, partyType: meta.defaultParty });
    setMsg("");
    setLoginMsg("");
    setLoginPassword("Demo@1234");
    setListSearch("");
    setTypeFilter("");
  }, [tab, meta.defaultParty]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [rows, selectedId]);

  const visibleRows = useMemo(() => {
    const needle = listSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "stakeholders" && typeFilter && (r.trade || "") !== typeFilter) return false;
      if (!needle) return true;
      return [r.name, r.trade, r.email, r.partyType, r.city].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [rows, listSearch, tab, typeFilter]);

  useEffect(() => {
    if (selected) {
      setForm(vendorToForm(selected));
      setLoginPassword("");
    } else if (!selectedId) {
      setForm({ ...EMPTY_VENDOR_FORM, partyType: meta.defaultParty });
      setLoginPassword("Demo@1234");
    }
  }, [selected, selectedId, meta.defaultParty]);

  function startNewCompany() {
    setSelectedId(null);
    setCreatingNew(true);
    setForm({ ...EMPTY_VENDOR_FORM, partyType: meta.defaultParty });
    setMsg("");
    setLoginMsg("");
    setLoginPassword("Demo@1234");
    requestAnimationFrame(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function selectCompany(id: string) {
    setCreatingNew(false);
    setSelectedId(id);
    setMsg("");
    setLoginMsg("");
  }

  const partyType = meta.partyTypes.includes(form.partyType) ? form.partyType : meta.defaultParty;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMsg("");
    const payload = { ...form, partyType };
    try {
      if (selectedId) {
        if (!selected || vendorDesk(selected.partyType) !== vendorDesk(meta.defaultParty)) {
          setMsg(`This company is not on ${vendorDeskLabel(meta.defaultParty)}. Open the matching CRM list to edit it.`);
          return;
        }
        const updated = await api<
          VendorRow & { login?: { passwordUpdated?: boolean; created?: boolean }; projectsSynced?: number }
        >(`/api/vendors/${selectedId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            ...payload,
            ...(loginPassword.trim() ? { password: loginPassword.trim() } : {}),
          }),
        });
        setLoginPassword("");
        const syncNote =
          tab === "clients" && updated.projectsSynced
            ? ` Linked project cards updated (${updated.projectsSynced}).`
            : "";
        setMsg(
          (updated.login?.passwordUpdated
            ? "Updated — portal password changed."
            : updated.login?.created
              ? "Updated — portal login created."
              : "Updated.") + syncNote
        );
      } else {
        const created = await api<VendorRow & { login?: { email: string; created: boolean; tempPassword?: string } }>(
          "/api/vendors",
          {
            method: "POST",
            token,
            body: JSON.stringify({ ...payload, createLogin: true, password: loginPassword }),
          }
        );
        setCreatingNew(false);
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
      const kind = portalAccountKind(role, { department: tab === "stakeholders" ? selected.trade : null }, selected.id);
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
          vendorId: selected.id,
          desk: "crm",
          password: loginPassword.trim() || undefined,
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
    {tab === "stakeholders" ? (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 ${
              !typeFilter ? "bg-brand text-white border-brand" : "bg-paper text-steel-muted border-line"
            }`}
            onClick={() => setTypeFilter("")}
          >
            All types
          </button>
          {consultantTypes.map((t) => (
            <button
              key={t}
              type="button"
              className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 ${
                typeFilter === t ? "bg-brand text-white border-brand" : "bg-paper text-steel-muted border-line"
              }`}
              onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
            >
              {t}
            </button>
          ))}
        </div>
        <ConsultantTypesPanel token={token} />
      </div>
    ) : null}
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
              <button type="button" className="text-left min-w-0 flex-1 hover:text-brand" onClick={() => selectCompany(r.id)}>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-steel-muted mt-0.5">
                  {tab === "stakeholders" && r.trade ? r.trade : formatPartyType(r.partyType)}
                  {r.email ? ` · ${r.email}` : ""}
                  {r._count?.projects ? ` · ${r._count.projects} project(s)` : ""}
                </div>
              </button>
              {canEdit ? (
                <VendorManageActions
                  vendor={r}
                  token={token}
                  onEdit={() => {
                    selectCompany(r.id);
                    requestAnimationFrame(() =>
                      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
                    );
                  }}
                  onChanged={async () => {
                    if (selectedId === r.id) {
                      setSelectedId(null);
                      setCreatingNew(false);
                    }
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
      {!selected && !creatingNew ? (
        <Card className="!p-6 text-sm text-steel-muted space-y-2">
          <p>
            Select a company from the list to edit it here
            {tab === "clients" ? " — changes sync to every project using that client." : "."}
          </p>
          {canEdit ? (
            <p>
              Or click <strong className="text-ink">+ New</strong> to add a company and portal login.
            </p>
          ) : (
            <p>View only — office and admin can add or edit.</p>
          )}
        </Card>
      ) : (
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm">{selected ? "Edit company" : "Add company + portal login"}</h3>
          {canEdit && selected ? (
            <Button
              type="button"
              variant="ghost"
              className="!text-xs"
              onClick={() => {
                setSelectedId(null);
                setCreatingNew(false);
                setMsg("");
              }}
            >
              Close
            </Button>
          ) : null}
        </div>
        {!selected ? (
          <p className="text-[11px] text-steel-muted mb-3">
            Company, contact, email, and phone are collected here. Saving creates the{" "}
            {tab === "clients" ? "client" : tab === "stakeholders" ? "consultant / stakeholder" : "vendor"} login.
          </p>
        ) : tab === "clients" ? (
          <p className="text-[11px] text-steel-muted mb-3">
            Saves to the client master and updates the client card on every linked project.
          </p>
        ) : null}
        <form className="space-y-3" onSubmit={save}>
          <Input required disabled={!canEdit} placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select disabled={!canEdit} value={partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}>
            {VENDOR_PARTY_TYPES.filter((p) => meta.partyTypes.includes(p.value)).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Input required disabled={!canEdit} placeholder="Primary contact (login name)" value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} />
          <Input required disabled={!canEdit} placeholder="Email (portal login)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input required disabled={!canEdit} placeholder="Phone" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
          {canEdit ? (
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={
                selected
                  ? "New portal password (leave blank to keep current)"
                  : "Portal password (default Demo@1234)"
              }
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          ) : null}
          {tab === "stakeholders" ? (
            <ConsultantTypeSelect value={form.trade} onChange={(trade) => setForm({ ...form, trade })} types={consultantTypes} />
          ) : null}
          <Input disabled={!canEdit} placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          {tab === "clients" ? (
            <Input disabled={!canEdit} placeholder="Office address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          ) : null}
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
          <TextArea disabled={!canEdit} placeholder="Notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">Save</Button>
              {creatingNew ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setCreatingNew(false);
                    setForm({ ...EMPTY_VENDOR_FORM, partyType: meta.defaultParty });
                    setMsg("");
                  }}
                >
                  Cancel
                </Button>
              ) : null}
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
                    setCreatingNew(false);
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
              and pick companies from this list. Vendor appointment / work-order letters:{" "}
              <Link to="/hrm/documents" className="text-brand font-semibold">
                HRMS → Documents
              </Link>
              .
            </>
          ) : tab === "clients" || tab === "stakeholders" ? (
            <>
              Attach on{" "}
              <Link to="/crm/setup" className="text-brand font-semibold">
                Project setup
              </Link>
              . Issue appointment / engagement letters via{" "}
              <Link to="/hrm/documents" className="text-brand font-semibold">
                HRMS → Documents
              </Link>
              . SPDC staff CTC:{" "}
              <Link to="/hrm/users" className="text-brand font-semibold">
                HRMS → Users
              </Link>
              .
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
      )}
      </div>
    </div>
    </div>
  );
}

/** CRM directories — clients, consultants, vendors. */
export default function CrmDirectoryPage() {
  const { tab: rawTab = "clients" } = useParams();
  const tab = (rawTab && rawTab in TAB_META ? rawTab : "clients") as keyof typeof TAB_META;
  const { token, user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "office";
  const meta = TAB_META[tab];

  return (
    <div className="space-y-4">
      <PageHeader dense title={meta.title} subtitle={meta.subtitle} />
      <p className="text-xs text-steel-muted max-w-3xl leading-relaxed -mt-2">
        Company master for the whole portal — clients, consultants, and vendors are managed here only. Project pages link companies from this list; they do not maintain a separate directory.
      </p>
      <DirectoryCompaniesPanel key={tab} tab={tab} token={token} canEdit={canEdit} />
    </div>
  );
}
