import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";
import { EMPTY_VENDOR_FORM, VENDOR_PARTY_TYPES, type VendorPartyType } from "../../lib/vendorTypes";

export default function VendorsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [directory, setDirectory] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [form, setForm] = useState({ ...EMPTY_VENDOR_FORM, tradeRole: "" });
  const canEdit = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [all, proj] = await Promise.all([
      api<any[]>("/api/vendors", { token }),
      api<any[]>(`/api/vendors/project/${id}`, { token }),
    ]);
    setDirectory(all);
    setAssigned(proj);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project directory"
        title="Vendors on this project"
        subtitle="Assign companies from the global directory, or create a new company and assign a trade role here."
        actions={
          <Link to="/master/vendors" className="text-sm font-semibold text-brand">
            Company directory (global) →
          </Link>
        }
      />

      {canEdit && (
        <Card>
          <h3 className="font-semibold mb-3">Create company & assign</h3>
          <p className="text-xs text-steel-muted mb-3">
            For full profile (address, website, flags) use{" "}
            <Link to="/master/vendors" className="text-brand font-semibold">
              Master → Company vendors
            </Link>
            .
          </p>
          <form
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const { tradeRole, ...vendorBody } = form;
              const v = await api<any>("/api/vendors", { method: "POST", token, body: JSON.stringify(vendorBody) });
              await api(`/api/vendors/project/${id}/assign`, {
                method: "POST",
                token,
                body: JSON.stringify({ vendorId: v.id, tradeRole: tradeRole || form.trade }),
              });
              setForm({ ...EMPTY_VENDOR_FORM, tradeRole: "" });
              await load();
            }}
          >
            <Input required placeholder="Company name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}>
              {VENDOR_PARTY_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Input placeholder="Trade on this project" value={form.tradeRole} onChange={(e) => setForm({ ...form, tradeRole: e.target.value })} />
            <Input placeholder="Primary contact" value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} />
            <Input placeholder="Phone" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input placeholder="GST" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPrequalified} onChange={(e) => setForm({ ...form, isPrequalified: e.target.checked })} /> Prequalified
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.insuranceVerified} onChange={(e) => setForm({ ...form, insuranceVerified: e.target.checked })} /> Insurance verified
            </label>
            <Button type="submit" className="sm:col-span-2 lg:col-span-3 w-fit">
              Create & assign
            </Button>
          </form>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line font-semibold bg-sand/40">On this project</div>
          <ul className="divide-y divide-line max-h-96 overflow-y-auto">
            {assigned.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{a.vendor.name}</span>
                  <Badge tone="neutral">{a.vendor.partyType}</Badge>
                </div>
                <div className="text-steel-muted text-xs mt-1">
                  {a.tradeRole || a.vendor.trade || "—"} · {a.vendor.city || "—"}
                  {a.vendor.isPrequalified ? " · Prequalified" : ""}
                </div>
              </li>
            ))}
            {!assigned.length && <li className="p-4 text-steel-muted text-sm">No vendors assigned yet.</li>}
          </ul>
        </Card>

        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line font-semibold bg-sand/40">Global company directory</div>
          <ul className="divide-y divide-line max-h-96 overflow-y-auto">
            {directory.map((v) => (
              <li key={v.id} className="px-4 py-3 text-sm flex justify-between gap-2">
                <div>
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs text-steel-muted">
                    {v.partyType} · {v.trade || "General"} · {v.primaryContactName || "—"}
                  </div>
                </div>
                {canEdit && (
                  <button
                    className="text-xs text-brand font-medium shrink-0"
                    onClick={async () => {
                      await api(`/api/vendors/project/${id}/assign`, {
                        method: "POST",
                        token,
                        body: JSON.stringify({ vendorId: v.id, tradeRole: v.trade }),
                      });
                      await load();
                    }}
                  >
                    Assign
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
