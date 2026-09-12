import { useEffect, useState } from "react";
import { api } from "../api";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { Input, Select } from "./ui";
import { VENDOR_PARTY_TYPES, type VendorPartyType } from "../lib/vendorTypes";

export type VendorQuickEditRow = {
  id: string;
  name: string;
  partyType?: string | null;
  email?: string | null;
  businessPhone?: string | null;
  primaryContactName?: string | null;
  city?: string | null;
  trade?: string | null;
};

type Props = {
  open: boolean;
  vendor: VendorQuickEditRow | null;
  token: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

export function VendorQuickEditModal({ open, vendor, token, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: "",
    partyType: "Vendor" as VendorPartyType,
    email: "",
    businessPhone: "",
    primaryContactName: "",
    city: "",
    trade: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!vendor) return;
    setForm({
      name: vendor.name || "",
      partyType: (vendor.partyType as VendorPartyType) || "Vendor",
      email: vendor.email || "",
      businessPhone: vendor.businessPhone || "",
      primaryContactName: vendor.primaryContactName || "",
      city: vendor.city || "",
      trade: vendor.trade || "",
    });
    setErr("");
  }, [vendor]);

  async function save() {
    if (!vendor || !token) return;
    setBusy(true);
    setErr("");
    try {
      await api(`/api/vendors/${vendor.id}`, { method: "PATCH", token, body: JSON.stringify(form) });
      await onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!vendor) return null;

  return (
    <RegisterEntryModal
      open={open}
      title={`Edit — ${vendor.name}`}
      onClose={onClose}
      onSave={() => void save()}
      saving={busy}
      saveLabel="Save changes"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        {err ? <p className="text-sm text-danger sm:col-span-2">{err}</p> : null}
        <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Company name" />
        <Select value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}>
          {VENDOR_PARTY_TYPES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Input value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} placeholder="Primary contact" />
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
        <Input value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} placeholder="Phone" />
        <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
        <Input className="sm:col-span-2" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} placeholder="Trade / discipline" />
      </div>
    </RegisterEntryModal>
  );
}
