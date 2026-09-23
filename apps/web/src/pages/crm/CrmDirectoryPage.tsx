import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { ConsultantTypeSelect, ConsultantTypesPanel } from "../../components/ConsultantTypesPanel";
import { ClientRepresentativesPanel } from "../../components/ClientRepresentativesPanel";
import { useConsultantTypes } from "../../lib/consultantTypes";
import { VendorManageActions } from "../../components/VendorManageActions";
import { Button, Card, Input, PageHeader, Select, TextArea, Badge } from "../../components/ui";
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
import { trimField } from "../../lib/stringUtils";

function directoryVendorsQuery(tab: string) {
  if (tab === "vendors") return "?partyType=Contractor";
  if (tab === "clients") return "?partyType=Client";
  if (tab === "stakeholders") return "?partyType=Consultant,PMC,Designer";
  return "";
}

type VendorRow = VendorFormState & { id: string; isActive?: boolean; portalLoginActive?: boolean; _count?: { projects: number } };

const TAB_META: Record<
  string,
  { title: string; subtitle: string; partyTypes: VendorPartyType[]; defaultParty: VendorPartyType; loginRole?: string }
> = {
  vendors: {
    title: "Vendors / contractors master",
    subtitle: "Add company and contact here. Activate vendor portal access when email is on file — then use Bid management.",
    partyTypes: ["Contractor", "Vendor"] as VendorPartyType[],
    defaultParty: "Contractor",
  },
  clients: {
    title: "Client directory",
    subtitle: "Step 1: add the client company. Step 2: add representatives. Step 3: activate portal for each person at /login/client.",
    partyTypes: ["Client"],
    defaultParty: "Client",
    loginRole: "client",
  },
  stakeholders: {
    title: "Consultants",
    subtitle: "Consultant types and contacts — save the company, then activate stakeholder portal access from this desk.",
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
    if (!selectedId) {
      if (!creatingNew) {
        setForm({ ...EMPTY_VENDOR_FORM, partyType: meta.defaultParty });
        setLoginPassword("Demo@1234");
      }
      return;
    }
    const row = rows.find((r) => r.id === selectedId);
    if (row) {
      setForm(vendorToForm(row));
      setLoginPassword("");
    }
  }, [selectedId, rows, creatingNew, meta.defaultParty]);

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
    const trimmedName = trimField(form.name);
    if (!trimmedName) {
      setMsg("Company name is required.");
      return;
    }
    const payload = {
      ...form,
      name: trimmedName,
      partyType,
      primaryContactName: trimField(form.primaryContactName),
      businessPhone: trimField(form.businessPhone),
      email: trimField(form.email).toLowerCase(),
      address: trimField(form.address),
      city: trimField(form.city),
      gstNumber: trimField(form.gstNumber),
      trade: trimField(form.trade),
      notes: trimField(form.notes),
    };
    try {
      if (selectedId) {
        if (!selected || vendorDesk(selected.partyType) !== vendorDesk(meta.defaultParty)) {
          setMsg(`This company is not on ${vendorDeskLabel(meta.defaultParty)}. Open the matching CRM list to edit it.`);
          return;
        }
        const updated = await api<
          VendorRow & {
            login?: { passwordUpdated?: boolean; created?: boolean };
            loginError?: string;
            projectsSynced?: number;
          }
        >(`/api/vendors/${selectedId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            ...payload,
            ...(trimField(loginPassword) ? { password: trimField(loginPassword) } : {}),
          }),
        });
        setLoginPassword("");
        const syncNote =
          tab === "clients" && updated.projectsSynced
            ? ` Linked project cards updated (${updated.projectsSynced}).`
            : "";
        setMsg(
          updated.loginError
            ? `Company saved. Portal login not updated — ${updated.loginError}${syncNote}`
            : tab === "clients"
              ? `Client details saved.${syncNote} Use Step 2 below to manage representatives.`
              : (updated.login?.passwordUpdated
                  ? "Updated — portal password changed."
                  : updated.login?.created
                    ? "Updated — portal login created."
                    : "Updated.") + syncNote
        );
      } else {
        const created = await api<
          VendorRow & {
            login?: { email: string; created: boolean; tempPassword?: string };
            loginError?: string;
          }
        >(
          "/api/vendors",
          {
            method: "POST",
            token,
            body: JSON.stringify({ ...payload, createLogin: false }),
          },
        );
        setCreatingNew(false);
        setSelectedId(created.id);
        setMsg(
          created.loginError
            ? `Company saved. ${created.loginError}`
            : tab === "clients"
              ? "Client saved — scroll down to Step 2: add representatives, then Activate portal for each person."
              : "Company saved. Add email if needed, then use Activate portal access.",
        );
      }
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function activatePortalAccess() {
    if (!selected?.email) {
      setLoginMsg("Add an email on the company record first.");
      return;
    }
    setLoginMsg("");
    try {
      const updated = await api<{ login?: { created?: boolean; email?: string; tempPassword?: string; passwordUpdated?: boolean }; loginError?: string }>(
        `/api/vendors/${selected.id}`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({
            email: selected.email,
            primaryContactName: selected.primaryContactName || selected.name,
            activatePortal: true,
            password: trimField(loginPassword) || "Demo@1234",
          }),
        },
      );
      const path =
        tab === "clients" ? "/login/client" : tab === "stakeholders" ? "/login/stakeholder" : "/login/vendor";
      if (updated.loginError) {
        setLoginMsg(`Company on file. Portal login not updated — ${updated.loginError}`);
      } else if (updated.login?.created) {
        setLoginMsg(
          `Portal activated for ${updated.login.email}. Password: ${updated.login.tempPassword || loginPassword || "Demo@1234"} · ${path}`,
        );
      } else if (updated.login?.passwordUpdated) {
        setLoginMsg(`Portal password updated for ${selected.email}. Sign in at ${path}`);
      } else if (updated.login) {
        setLoginMsg(`Portal login linked for ${selected.email} · ${path}`);
      } else {
        setLoginMsg("Could not create login — check the email address.");
      }
      await load();
    } catch (err) {
      setLoginMsg(err instanceof Error ? err.message : "Could not create login");
    }
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
        {canEdit ? <ConsultantTypesPanel token={token} canEdit /> : null}
      </div>
    ) : null}
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4">
      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 space-y-2">
          <div className="font-semibold text-sm flex justify-between">
            <span>{visibleRows.length} companies</span>
            {canEdit && (
              <Button type="button" variant="secondary" className="!text-xs !py-1 !px-2" onClick={startNewCompany}>
                {tab === "clients" ? "+ New client" : "+ New"}
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
                <div className="text-xs text-steel-muted mt-0.5 flex flex-wrap items-center gap-1.5">
                  {tab === "stakeholders" && r.trade ? r.trade : formatPartyType(r.partyType)}
                  {r.email ? ` · ${r.email}` : ""}
                  {r._count?.projects ? ` · ${r._count.projects} project(s)` : ""}
                  {r.email ? (
                    <Badge tone={r.portalLoginActive ? "ok" : "neutral"}>{r.portalLoginActive ? "Portal active" : "No portal"}</Badge>
                  ) : null}
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
        <Card className="!p-6 text-sm text-steel-muted space-y-3">
          <p className="font-semibold text-ink">How to add a client (3 steps)</p>
          <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
            <li>Click <strong className="text-ink">+ New client</strong> and save the company name</li>
            <li>Add each site representative (name + email)</li>
            <li>Click <strong className="text-ink">Activate portal</strong> for every person who needs access</li>
          </ol>
          {canEdit ? (
            <Button type="button" onClick={startNewCompany}>
              + New client
            </Button>
          ) : null}
        </Card>
      ) : (
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm">
            {selected ? (tab === "clients" ? "Edit client" : "Edit company") : tab === "clients" ? "Step 1 · New client company" : "Add company"}
          </h3>
          {tab === "clients" && selected ? (
            <p className="text-[11px] text-steel-muted w-full basis-full -mt-1">
              Step 2 below — add more representatives anytime, then activate portal for each person.
            </p>
          ) : null}
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
        {tab === "clients" ? (
          <div className="rounded-lg bg-sand/50 border border-line px-3 py-2 text-xs text-steel-muted mb-3">
            <strong className="text-ink">Step 1</strong> — Save the company name and address below.{" "}
            {selected ? (
              <>
                Then scroll to <strong className="text-ink">Step 2</strong> to add people and activate portal for each.
              </>
            ) : (
              <>
                Portal logins are created in <strong className="text-ink">Step 2</strong> for each representative (not on this form).
              </>
            )}
          </div>
        ) : !selected ? (
          <p className="text-[11px] text-steel-muted mb-3">
            Step 1 — save company and contact. Step 2 — add email and click <strong className="text-ink">Activate portal access</strong> (default password Demo@1234).
          </p>
        ) : null}
        <form className="space-y-3" onSubmit={save}>
          <Input disabled={!canEdit} placeholder="Company name" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {tab !== "clients" ? (
            <>
              <Select disabled={!canEdit} value={partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}>
                {VENDOR_PARTY_TYPES.filter((p) => meta.partyTypes.includes(p.value)).map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <Input disabled={!canEdit} placeholder="Primary contact (login name)" autoComplete="name" value={form.primaryContactName ?? ""} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} />
              <Input disabled={!canEdit} placeholder="Email (portal login)" type="email" autoComplete="username" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </>
          ) : null}
          <Input disabled={!canEdit} placeholder="Phone" type="tel" autoComplete="tel" value={form.businessPhone ?? ""} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
          {canEdit && tab !== "clients" ? (
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={
                selected
                  ? "New portal password (leave blank to keep current)"
                  : "Portal password (default Demo@1234)"
              }
              value={loginPassword ?? ""}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
          ) : null}
          {tab === "stakeholders" ? (
            <ConsultantTypeSelect value={form.trade ?? ""} onChange={(trade) => setForm({ ...form, trade })} types={consultantTypes} />
          ) : null}
          <Input disabled={!canEdit} placeholder="City" value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          {tab === "clients" ? (
            <>
              <Input disabled={!canEdit} placeholder="Office address" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Input disabled={!canEdit} placeholder="GST number (optional)" value={form.gstNumber ?? ""} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
            </>
          ) : null}
          {tab === "vendors" ? (
            <Input
              disabled={!canEdit}
              placeholder="Trade / specialty (optional — e.g. Civil, MEP)"
              value={form.trade ?? ""}
              onChange={(e) => setForm({ ...form, trade: e.target.value })}
            />
          ) : null}
          <TextArea disabled={!canEdit} placeholder="Notes" rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
              {selected && tab !== "clients" && (meta.loginRole || tab === "vendors" || tab === "stakeholders") && (
                <Button type="button" variant="secondary" onClick={() => void activatePortalAccess()}>
                  Activate portal access
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
        {tab === "clients" && selected ? (
          <ClientRepresentativesPanel
            vendorId={selected.id}
            clientName={trimField(form.name) || selected.name || "this client"}
            token={token}
            canEdit={canEdit}
          />
        ) : null}
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
