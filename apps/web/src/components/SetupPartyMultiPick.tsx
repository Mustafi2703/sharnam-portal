import { useState } from "react";
import { api } from "../api";
import { Button, Input } from "./ui";
import { SearchableCheckboxList } from "./SearchableCheckboxList";

export type SetupVendor = {
  id: string;
  name: string;
  partyType?: string;
  trade?: string | null;
  email?: string | null;
  primaryContactName?: string | null;
};

type QuickKind = "Consultant" | "Contractor";

type Props = {
  token: string | null;
  title: string;
  kind: QuickKind;
  vendors: SetupVendor[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreated: (vendor: SetupVendor) => void;
  onMsg: (text: string) => void;
  busy?: boolean;
};

const EMPTY = { name: "", contact: "", email: "", phone: "", trade: "" };

/** Multi-select from directory plus quick-create of another company in the same flow. */
export function SetupPartyMultiPick({
  token,
  title,
  kind,
  vendors,
  selectedIds,
  onChange,
  onCreated,
  onMsg,
  busy,
}: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function addNew() {
    if (!token) return;
    if (!form.name.trim()) {
      onMsg("Company name required");
      return;
    }
    setSaving(true);
    try {
      const created = await api<SetupVendor>("/api/vendors", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: form.name,
          partyType: kind,
          primaryContactName: form.contact,
          email: form.email,
          businessPhone: form.phone,
          trade: form.trade,
        }),
      });
      onCreated(created);
      onChange([...selectedIds, created.id]);
      setForm(EMPTY);
      setOpen(false);
      onMsg(`${created.name} added to ${kind === "Consultant" ? "consultants" : "contractors"} and selected.`);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not add company");
    } finally {
      setSaving(false);
    }
  }

  const items = vendors
    .filter((v) => (kind === "Consultant" ? ["Consultant", "Designer", "PMC"].includes(v.partyType || "") : ["Contractor", "Vendor"].includes(v.partyType || "Vendor")))
    .map((v) => ({
      id: v.id,
      label: v.name,
      sublabel: v.primaryContactName || v.trade || undefined,
      meta: v.email || undefined,
      trade: v.trade,
    }));

  return (
    <div className="space-y-2 border border-line rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        <Button type="button" variant="secondary" className="!text-xs" disabled={busy || saving} onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : `Add new ${kind === "Consultant" ? "consultant" : "contractor"}`}
        </Button>
      </div>
      <SearchableCheckboxList
        items={items}
        selectedIds={selectedIds}
        onChange={onChange}
        placeholder={`Search ${kind === "Consultant" ? "consultants" : "contractors"}…`}
        emptyMessage={`No ${kind === "Consultant" ? "consultants" : "contractors"} in the directory yet — add one below.`}
        maxHeightClass="max-h-40"
      />
      {open && (
        <div className="grid sm:grid-cols-2 gap-2 border-t border-line pt-2">
          <Input placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Contact person" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input
            className="sm:col-span-2"
            placeholder={kind === "Consultant" ? "Trade — structural, MEP, architect…" : "Trade — civil, PEB, electrical…"}
            value={form.trade}
            onChange={(e) => setForm({ ...form, trade: e.target.value })}
          />
          <Button type="button" className="sm:col-span-2" disabled={saving || busy} onClick={() => void addNew()}>
            {saving ? "Adding…" : `Add ${kind === "Consultant" ? "consultant" : "contractor"} to this project`}
          </Button>
        </div>
      )}
    </div>
  );
}
