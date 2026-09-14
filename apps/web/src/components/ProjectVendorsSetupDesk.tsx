import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";
import { matchesSearch, SearchableSelect } from "./SearchableSelect";
import { VendorManageActions } from "./VendorManageActions";
import { VendorQuickEditModal, type VendorQuickEditRow } from "./VendorQuickEditModal";
import { useConsultantTypes } from "../lib/consultantTypes";
import { ConsultantTypeSelect } from "./ConsultantTypesPanel";
import { formatPartyType, isVendorOrContractor, VENDOR_PARTY_TYPES, type VendorPartyType } from "../lib/vendorTypes";

export type SetupDeskVendor = {
  id: string;
  name: string;
  partyType?: string | null;
  trade?: string | null;
  email?: string | null;
  primaryContactName?: string | null;
  businessPhone?: string | null;
  city?: string | null;
};

export type AssignedSetupVendor = {
  id: string;
  vendorId: string;
  name: string;
  partyType: string;
  email?: string | null;
  trade?: string | null;
  tradeRole?: string | null;
  packages?: string[];
};

export type SetupPartyKind = "Contractor" | "Consultant" | "Client";

type Props = {
  projectId: string;
  token: string;
  catalog: SetupDeskVendor[];
  assigned: AssignedSetupVendor[];
  onMsg: (text: string) => void;
  onChanged: () => void | Promise<void>;
  party?: SetupPartyKind;
  projectPackages?: string[];
};

const COPY: Record<SetupPartyKind, { title: string; blurb: string; add: string; create: string; empty: string; defaultType: VendorPartyType }> = {
  Contractor: {
    title: "Vendors / contractors",
    blurb: "Same company type. Add them here to put the company on the directory and this project. Email creates bid-upload access.",
    add: "Add vendor / contractor",
    create: "+ New vendor / contractor",
    empty: "No vendors / contractors on this job yet.",
    defaultType: "Contractor",
  },
  Consultant: {
    title: "Consultants",
    blurb: "Design, MEP, structural, PMC partners. Email creates a stakeholder desk login at /login/stakeholder.",
    add: "Add consultant",
    create: "+ New consultant",
    empty: "No consultants on this job yet.",
    defaultType: "Consultant",
  },
  Client: {
    title: "Client",
    blurb: "Put the owner organisation on this project so they get a portal login and a request-link seat.",
    add: "Add client",
    create: "+ New client company",
    empty: "No client company on this job yet — add the owner here, not only the name on the card.",
    defaultType: "Client",
  },
};

function matchesParty(partyType: string | null | undefined, party: SetupPartyKind) {
  if (party === "Contractor") return isVendorOrContractor(partyType);
  if (party === "Client") return partyType === "Client";
  return partyType === "Consultant" || partyType === "Designer" || partyType === "PMC";
}

/** Add / edit / remove companies on a project without opening a bid. */
export function ProjectVendorsSetupDesk({
  projectId,
  token,
  catalog,
  assigned,
  onMsg,
  onChanged,
  party = "Contractor",
  projectPackages = [],
}: Props) {
  const copy = COPY[party];
  const [pickId, setPickId] = useState("");
  const [tradeRole, setTradeRole] = useState("");
  const [form, setForm] = useState({
    name: "",
    partyType: copy.defaultType,
    email: "",
    primaryContactName: "",
    businessPhone: "",
    trade: "",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editVendor, setEditVendor] = useState<VendorQuickEditRow | null>(null);
  const [listQ, setListQ] = useState("");
  const { types: consultantTypes } = useConsultantTypes(token);

  const scopedAssigned = useMemo(() => assigned.filter((v) => matchesParty(v.partyType, party)), [assigned, party]);
  const shownAssigned = useMemo(
    () =>
      scopedAssigned.filter((v) =>
        matchesSearch(`${v.name} ${v.email || ""} ${v.tradeRole || ""} ${v.trade || ""} ${v.partyType}`, listQ)
      ),
    [scopedAssigned, listQ]
  );
  const unused = useMemo(() => {
    const onJob = new Set(assigned.map((v) => v.vendorId));
    return catalog.filter((v) => !onJob.has(v.id) && matchesParty(v.partyType, party));
  }, [catalog, assigned, party]);

  async function assignExisting(e: FormEvent) {
    e.preventDefault();
    if (!pickId) {
      onMsg("Pick a company from the directory, or add a new one below.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/vendors/project/${projectId}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ vendorId: pickId, tradeRole, packages: [] }),
      });
      setPickId("");
      setTradeRole("");
      onMsg(`${copy.add} — saved on this project.`);
      await onChanged();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not add company");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAssign(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      onMsg("Company name is required.");
      return;
    }
    setBusy(true);
    try {
      const created = await api<SetupDeskVendor>("/api/vendors", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: form.name.trim(),
          partyType: form.partyType,
          email: form.email.trim() || undefined,
          primaryContactName: form.primaryContactName.trim() || undefined,
          businessPhone: form.businessPhone.trim() || undefined,
          trade: form.trade.trim() || undefined,
        }),
      });
      const assigned = await api<{ portal?: { email: string; created: boolean; tempPassword?: string; role?: string } }>(
        `/api/vendors/project/${projectId}/assign`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ vendorId: created.id, tradeRole: form.trade.trim() || form.partyType, packages: [] }),
        }
      );
      setForm({ name: "", partyType: copy.defaultType, email: "", primaryContactName: "", businessPhone: "", trade: "" });
      setShowCreate(false);
      const slip = assigned.portal;
      const portalHint =
        slip?.role === "employee"
          ? ` Stakeholder login: ${slip.email}${slip.tempPassword ? ` · ${slip.tempPassword}` : ""} — sign in at /login/stakeholder.`
          : slip?.role === "client"
            ? ` Client login: ${slip.email}${slip.tempPassword ? ` · ${slip.tempPassword}` : ""} — sign in at /login/client.`
            : slip
              ? ` Bid login: ${slip.email}${slip.tempPassword ? ` · ${slip.tempPassword}` : " (existing account)"}. Open a bid so they can upload.`
              : " Add an email if they need a portal login.";
      onMsg(`${created.name} is on the company directory and this project.${portalHint}`);
      await onChanged();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not create company");
    } finally {
      setBusy(false);
    }
  }

  async function savePackages(vendorId: string, packages: string[]) {
    setBusy(true);
    try {
      await api(`/api/vendors/project/${projectId}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ vendorId, packages }),
      });
      await onChanged();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not save packages");
    } finally {
      setBusy(false);
    }
  }

  const typeOptions = VENDOR_PARTY_TYPES.filter((p) => {
    if (party === "Contractor") return p.value === "Contractor";
    if (party === "Client") return p.value === "Client";
    return p.value === "Consultant" || p.value === "Designer" || p.value === "PMC";
  });

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">{copy.title}</h3>
          <p className="text-xs text-steel-muted mt-0.5">{copy.blurb}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link
            to={party === "Contractor" ? "/crm/directory/vendors" : party === "Client" ? "/crm/directory/clients" : "/crm/directory/stakeholders"}
            className="text-xs font-semibold text-brand"
          >
            {party === "Contractor" ? "Vendors / contractors master →" : party === "Client" ? "Client directory →" : "Consultant types & directory →"}
          </Link>
          {party === "Contractor" && (
            <Link to={`/crm/bids?projectId=${projectId}`} className="text-xs font-semibold text-brand">
              Open bid for these vendors →
            </Link>
          )}
        </div>
      </div>

      {scopedAssigned.length > 0 && (
        <Input
          placeholder={`Search ${copy.title.toLowerCase()} by name or email…`}
          value={listQ}
          onChange={(e) => setListQ(e.target.value)}
        />
      )}
      <ul className="divide-y divide-line max-h-[22rem] overflow-y-auto text-sm">
        {shownAssigned.map((v) => (
          <li key={v.id} className="py-2.5 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium">{v.name}</div>
                <div className="text-xs text-steel-muted">
                  {v.tradeRole || v.trade || "—"}
                  {v.email ? ` · ${v.email}` : " · no email yet"}
                </div>
              </div>
              <Badge tone="brand">{formatPartyType(v.partyType)}</Badge>
            </div>
            {projectPackages.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {projectPackages.map((pkg) => {
                  const on = (v.packages || []).includes(pkg);
                  return (
                    <button
                      key={pkg}
                      type="button"
                      disabled={busy}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                        on ? "bg-brand text-white border-brand" : "bg-paper border-line text-steel-muted"
                      }`}
                      onClick={() => {
                        const next = on ? (v.packages || []).filter((p) => p !== pkg) : [...(v.packages || []), pkg];
                        void savePackages(v.vendorId, next);
                      }}
                    >
                      {pkg}
                    </button>
                  );
                })}
              </div>
            )}
            <VendorManageActions
              vendor={{ id: v.vendorId, name: v.name }}
              token={token}
              projectId={projectId}
              onEdit={() =>
                setEditVendor({
                  id: v.vendorId,
                  name: v.name,
                  partyType: v.partyType,
                  email: v.email,
                  trade: v.trade || v.tradeRole,
                })
              }
              onChanged={() => void onChanged()}
            />
          </li>
        ))}
        {!scopedAssigned.length && <li className="py-4 text-sm text-steel-muted">{copy.empty}</li>}
        {scopedAssigned.length > 0 && !shownAssigned.length && (
          <li className="py-3 text-xs text-steel-muted">No company matches “{listQ}”.</li>
        )}
      </ul>

      <form className="flex flex-wrap gap-2 items-end border-t border-line pt-3" onSubmit={assignExisting}>
        <SearchableSelect
          className="min-w-[200px] flex-1"
          options={unused.map((v) => ({
            value: v.id,
            label: v.name,
            sublabel: [v.partyType, v.trade, v.primaryContactName, v.email].filter(Boolean).join(" · "),
            keywords: [v.name, v.email, v.trade, v.primaryContactName, v.businessPhone, v.city, v.partyType]
              .filter(Boolean)
              .join(" "),
          }))}
          value={pickId}
          onChange={setPickId}
          placeholder="Add from directory…"
          searchPlaceholder="Search company by name, contact, or email…"
        />
        {party === "Consultant" ? (
          <ConsultantTypeSelect value={tradeRole} onChange={setTradeRole} types={consultantTypes} className="!w-56" />
        ) : (
          <Input placeholder="Role / trade on this project" value={tradeRole} onChange={(e) => setTradeRole(e.target.value)} />
        )}
        <Button type="submit" variant="secondary" disabled={busy}>
          {copy.add}
        </Button>
      </form>

      <div className="border-t border-line pt-3">
        <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancel" : copy.create}
        </Button>
        {showCreate && (
          <form className="grid sm:grid-cols-2 gap-2 mt-3" onSubmit={createAndAssign}>
            <Input required placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}>
              {typeOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Input placeholder="Contact" value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} />
            <Input
              type="email"
              placeholder={party === "Consultant" ? "Email — stakeholder portal login" : party === "Client" ? "Email — client portal login" : "Email — required for bid upload login"}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input placeholder="Phone (contact — optional)" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
            {party === "Consultant" ? (
              <ConsultantTypeSelect value={form.trade} onChange={(trade) => setForm({ ...form, trade })} types={consultantTypes} />
            ) : (
              <Input placeholder="Trade / discipline" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} />
            )}
            <Button type="submit" className="sm:col-span-2" disabled={busy}>
              {busy ? "Saving…" : "Create and add to project"}
            </Button>
          </form>
        )}
      </div>

      <VendorQuickEditModal
        open={!!editVendor}
        vendor={editVendor}
        token={token}
        onClose={() => setEditVendor(null)}
        onSaved={() => void onChanged()}
      />
    </Card>
  );
}
