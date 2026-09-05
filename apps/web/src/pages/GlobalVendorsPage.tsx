import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";
import {
  EMPTY_VENDOR_FORM,
  VENDOR_PARTY_TYPES,
  vendorToForm,
  type VendorFormState,
  type VendorPartyType,
} from "../lib/vendorTypes";
import {
  CRM_BID_DISCIPLINES,
  formatVendorBidDisciplines,
  parseVendorBidDisciplines,
} from "../lib/crmBidDisciplines";

type VendorRow = VendorFormState & {
  id: string;
  isActive?: boolean;
  _count?: { projects: number };
};

/** Company-level vendor directory — Procore-style; assign to projects from project Vendors page. */
export default function GlobalVendorsPage() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [filter, setFilter] = useState<VendorPartyType | "All">("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormState>(EMPTY_VENDOR_FORM);
  const [msg, setMsg] = useState("");
  const canEdit = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const q = filter === "All" ? "" : `?partyType=${encodeURIComponent(filter)}`;
    const list = await api<VendorRow[]>(`/api/vendors${q}`, { token });
    setRows(list);
  };

  useEffect(() => {
    void load();
  }, [token, filter]);

  const [filterDiscipline, setFilterDiscipline] = useState<string>("All");
  const bidDisciplineKeys = useMemo(() => parseVendorBidDisciplines(form.trade), [form.trade]);

  const filteredRows = useMemo(() => {
    if (filterDiscipline === "All") return rows;
    return rows.filter((v) => {
      const keys = parseVendorBidDisciplines(v.trade);
      if (keys.length) return keys.includes(filterDiscipline);
      const trade = (v.trade || "").toLowerCase();
      const def = CRM_BID_DISCIPLINES.find((d) => d.key === filterDiscipline);
      return def?.tradeHints.some((h) => trade.includes(h));
    });
  }, [rows, filterDiscipline]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  function toggleBidDiscipline(key: string) {
    const current = parseVendorBidDisciplines(form.trade);
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setForm({ ...form, trade: formatVendorBidDisciplines(next) });
  }

  useEffect(() => {
    if (selected) setForm(vendorToForm(selected));
    else if (!selectedId) setForm(EMPTY_VENDOR_FORM);
  }, [selected, selectedId]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMsg("");
    try {
      if (selectedId) {
        await api(`/api/vendors/${selectedId}`, { method: "PATCH", token, body: JSON.stringify(form) });
        setMsg("Company updated");
      } else {
        const created = await api<VendorRow>("/api/vendors", { method: "POST", token, body: JSON.stringify(form) });
        setSelectedId(created.id);
        setMsg("Company added to directory");
      }
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="master-module page-scroll-full space-y-6 max-w-6xl pb-8">
      <PageHeader
        eyebrow="Master module · company directory"
        title="Vendors & contractors"
        subtitle="Global bidder directory for CRM comparative packages — tag each company with R2 BOQ disciplines, then pick them when opening a bid package."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                setMsg("");
                try {
                  const r = await api<{ created: number; updated: number; total: number }>("/api/vendors/seed-bid-catalog", {
                    method: "POST",
                    token,
                  });
                  setMsg(`Loaded ${r.total} R2 discipline vendors (${r.created} new).`);
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Seed failed");
                }
              }}
            >
              Seed R2 vendors
            </Button>
            <Link to="/crm/bids">
              <Button type="button" variant="secondary">Open bid packages →</Button>
            </Link>
            <Link to="/master">
              <Button type="button" variant="secondary">← Master hub</Button>
            </Link>
          </div>
        }
      />

      {msg && <p className="text-sm bg-brand-soft text-brand-dark rounded-lg px-3 py-2">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        {(["All", ...VENDOR_PARTY_TYPES.map((p) => p.value)] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
              filter === t ? "bg-brand text-white border-brand" : "bg-paper border-line text-steel-muted"
            }`}
          >
            {t === "All" ? "All types" : t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-mono uppercase text-steel-muted mr-1">BOQ discipline</span>
        <button
          type="button"
          onClick={() => setFilterDiscipline("All")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
            filterDiscipline === "All" ? "bg-brand text-white border-brand" : "bg-paper border-line text-steel-muted"
          }`}
        >
          All disciplines
        </button>
        {CRM_BID_DISCIPLINES.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setFilterDiscipline(d.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
              filterDiscipline === d.key ? "bg-brand text-white border-brand" : "bg-paper border-line text-steel-muted"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm flex justify-between">
            <span>Company directory ({filteredRows.length})</span>
            {canEdit && (
              <button
                type="button"
                className="text-brand text-xs font-semibold"
                onClick={() => {
                  setSelectedId(null);
                  setForm(EMPTY_VENDOR_FORM);
                }}
              >
                + New company
              </button>
            )}
          </div>
          <ul className="divide-y divide-line max-h-[32rem] overflow-y-auto">
            {filteredRows.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-sand/30 ${selectedId === v.id ? "bg-brand-soft" : ""}`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{v.name}</span>
                  <Badge tone="neutral">{v.partyType}</Badge>
                </div>
                <div className="text-xs text-steel-muted mt-1">
                  {v.trade || "General — tag BOQ disciplines below"}
                  {v.city ? ` · ${v.city}` : ""}
                  {v._count?.projects ? ` · ${v._count.projects} project(s)` : ""}
                </div>
              </button>
            ))}
            {!filteredRows.length && <li className="p-4 text-sm text-steel-muted">No companies for this discipline filter.</li>}
          </ul>
        </Card>

        <Card>
          <h3 className="font-semibold mb-1">{selectedId ? "Edit company" : "Add company"}</h3>
          <p className="text-xs text-steel-muted mb-4">
            Assign to a project from <strong>Project → Vendors</strong> after saving here.
          </p>
          {!canEdit ? (
            <p className="text-sm text-steel-muted">Office / Admin only.</p>
          ) : (
            <form className="space-y-3" onSubmit={(e) => void save(e)}>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  required
                  placeholder="Company name *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Select
                  value={form.partyType}
                  onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}
                >
                  {VENDOR_PARTY_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
                <Input placeholder="Trade / notes" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase text-steel-muted mb-2">Bid BOQ disciplines (R2 sheets)</p>
                <div className="flex flex-wrap gap-1.5">
                  {CRM_BID_DISCIPLINES.map((d) => {
                    const on = bidDisciplineKeys.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => toggleBidDiscipline(d.key)}
                        className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${
                          on ? "bg-brand text-white border-brand" : "border-line text-steel-muted hover:border-brand/40"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Primary contact"
                  value={form.primaryContactName}
                  onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })}
                />
                <Input placeholder="Phone" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
                <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                <Input placeholder="GST / tax ID" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
                <Input placeholder="License #" value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
                <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                <Input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <Input placeholder="Street address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <TextArea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              <div className="flex flex-wrap gap-3 text-sm">
                {(
                  [
                    ["isPrequalified", "Prequalified"],
                    ["insuranceVerified", "Insurance verified"],
                    ["isUnionMember", "Union member"],
                    ["isMinorityOwned", "Minority-owned"],
                    ["isWomenOwned", "Women-owned"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Button type="submit">{selectedId ? "Save changes" : "Add company"}</Button>
                {selectedId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSelectedId(null);
                      setForm(EMPTY_VENDOR_FORM);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
