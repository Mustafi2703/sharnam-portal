import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";
import { SearchableSelect } from "./SearchableSelect";
import { VendorManageActions } from "./VendorManageActions";
import { VendorQuickEditModal, type VendorQuickEditRow } from "./VendorQuickEditModal";
import { formatPartyType, VENDOR_PARTY_TYPES, type VendorPartyType } from "../lib/vendorTypes";

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
};

type Props = {
  projectId: string;
  token: string;
  catalog: SetupDeskVendor[];
  assigned: AssignedSetupVendor[];
  onMsg: (text: string) => void;
  onChanged: () => void | Promise<void>;
};

const EMPTY = {
  name: "",
  partyType: "Contractor" as VendorPartyType,
  email: "",
  primaryContactName: "",
  businessPhone: "",
  trade: "",
};

/** Add / edit / remove companies on a project without opening a bid. */
export function ProjectVendorsSetupDesk({ projectId, token, catalog, assigned, onMsg, onChanged }: Props) {
  const [pickId, setPickId] = useState("");
  const [tradeRole, setTradeRole] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editVendor, setEditVendor] = useState<VendorQuickEditRow | null>(null);

  const unused = useMemo(() => {
    const onJob = new Set(assigned.map((v) => v.vendorId));
    return catalog.filter((v) => !onJob.has(v.id));
  }, [catalog, assigned]);

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
        body: JSON.stringify({ vendorId: pickId, tradeRole }),
      });
      setPickId("");
      setTradeRole("");
      onMsg("Company added to this project. No bid required.");
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
      await api(`/api/vendors/project/${projectId}/assign`, {
        method: "POST",
        token,
        body: JSON.stringify({ vendorId: created.id, tradeRole: form.trade.trim() || form.partyType }),
      });
      setForm(EMPTY);
      setShowCreate(false);
      onMsg(
        `${created.name} added to this project.${
          created.email ? " Portal login can be issued from Complete setup." : " Add an email later if they need a login."
        }`,
      );
      await onChanged();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not create company");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Vendors / contractors on this project</h3>
          <p className="text-xs text-steel-muted mt-0.5">
            Vendor and contractor are the same company type. Add them here even if you never open a bid. Edit or delete whenever needed.
          </p>
        </div>
        <Link to="/crm/directory/vendors" className="text-xs font-semibold text-brand">
          Company directory →
        </Link>
      </div>

      <ul className="divide-y divide-line max-h-64 overflow-y-auto text-sm">
        {assigned.map((v) => (
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
        {!assigned.length && (
          <li className="py-4 text-sm text-steel-muted">No companies on this job yet — pick from the directory or add a new one.</li>
        )}
      </ul>

      <form className="flex flex-wrap gap-2 items-end border-t border-line pt-3" onSubmit={assignExisting}>
        <SearchableSelect
          className="min-w-[200px] flex-1"
          options={unused.map((v) => ({
            value: v.id,
            label: v.name,
            sublabel: [v.partyType, v.trade, v.email].filter(Boolean).join(" · "),
          }))}
          value={pickId}
          onChange={setPickId}
          placeholder="Add from directory…"
          searchPlaceholder="Search company…"
        />
        <Input placeholder="Trade on this project" value={tradeRole} onChange={(e) => setTradeRole(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={busy}>
          Add to project
        </Button>
      </form>

      <div className="border-t border-line pt-3">
        <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancel" : "+ New company on this project"}
        </Button>
        {showCreate && (
          <form className="grid sm:grid-cols-2 gap-2 mt-3" onSubmit={createAndAssign}>
            <Input required placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}>
              {VENDOR_PARTY_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Input placeholder="Contact" value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} />
            <Input type="email" placeholder="Email (optional — only if they need a login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
            <Input placeholder="Trade" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} />
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
