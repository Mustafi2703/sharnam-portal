import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { RegisterEntryModal } from "../../components/RegisterEntryModal";
import { Button, Card, Input, Select, TextArea } from "../../components/ui";
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

type VendorRow = VendorFormState & {
  id: string;
  isActive?: boolean;
  _count?: { projects: number };
};

/** Office vendor directory inside HRMS — admin / office only. */
export default function HrmsVendorsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [filter, setFilter] = useState<VendorPartyType | "All">("All");
  const [filterDiscipline, setFilterDiscipline] = useState<string>("All");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormState>(EMPTY_VENDOR_FORM);

  const load = useCallback(async () => {
    const q = filter === "All" ? "" : `?partyType=${encodeURIComponent(filter)}`;
    const list = await api<VendorRow[]>(`/api/vendors${q}`, { token });
    setRows(list);
  }, [token, filter]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const bidDisciplineKeys = useMemo(() => parseVendorBidDisciplines(form.trade), [form.trade]);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_VENDOR_FORM);
    setModalOpen(true);
  }

  function openEdit(row: VendorRow) {
    setEditId(row.id);
    setForm(vendorToForm(row));
    setModalOpen(true);
  }

  function toggleBidDiscipline(key: string) {
    const current = parseVendorBidDisciplines(form.trade);
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setForm({ ...form, trade: formatVendorBidDisciplines(next) });
  }

  async function saveVendor() {
    setBusy(true);
    setMsg("");
    try {
      if (editId) {
        await api(`/api/vendors/${editId}`, { method: "PATCH", token, body: JSON.stringify(form) });
        setMsg("Vendor updated");
      } else {
        await api("/api/vendors", { method: "POST", token, body: JSON.stringify(form) });
        setMsg("Vendor added");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-steel-muted max-w-2xl">
          Global vendor &amp; contractor directory for CRM bid packages and project assignment.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={openAdd}>+ Add vendor</Button>
          <Link to="/crm/bids" className="text-sm font-semibold text-brand self-center px-2">Bid packages ↗</Link>
        </div>
      </div>

      {msg && <p className="text-sm text-ok bg-brand-soft/40 border border-brand/20 px-3 py-2 rounded-lg">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as VendorPartyType | "All")}>
          <option value="All">All types</option>
          {VENDOR_PARTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
        <Select value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value)}>
          <option value="All">All BOQ disciplines</option>
          {CRM_BID_DISCIPLINES.map((d) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </Select>
      </div>

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold">Vendors ({filteredRows.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-sand/30 text-left text-xs uppercase tracking-wide text-steel-muted">
                <th className="px-4 py-2 font-semibold">Company</th>
                <th className="px-4 py-2 font-semibold">Type</th>
                <th className="px-4 py-2 font-semibold">Disciplines</th>
                <th className="px-4 py-2 font-semibold">Contact</th>
                <th className="px-4 py-2 font-semibold">Projects</th>
                <th className="px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((v) => (
                <tr key={v.id} className="border-b border-line/60 hover:bg-sand/20">
                  <td className="px-4 py-2.5 font-medium">{v.name}</td>
                  <td className="px-4 py-2.5">{v.partyType || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-steel-muted max-w-[200px] truncate">{v.trade || "—"}</td>
                  <td className="px-4 py-2.5 text-steel-muted">{v.primaryContactName || v.email || "—"}</td>
                  <td className="px-4 py-2.5">{v._count?.projects ?? 0}</td>
                  <td className="px-4 py-2.5">
                    <button type="button" className="text-xs font-semibold text-brand underline" onClick={() => openEdit(v)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <RegisterEntryModal
        open={modalOpen}
        title={editId ? "Edit vendor" : "Add vendor company"}
        onClose={() => setModalOpen(false)}
        onSave={() => void saveVendor()}
        saving={busy}
        saveLabel={editId ? "Save changes" : "Add vendor"}
        size="2xl"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Input required placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value as VendorPartyType })}>
            {VENDOR_PARTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <Input placeholder="Contact name" value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Phone" value={form.businessPhone} onChange={(e) => setForm({ ...form, businessPhone: e.target.value })} />
          <Input placeholder="GST / PAN" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
          <div className="sm:col-span-2">
            <TextArea placeholder="Address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-steel-muted mb-2">CRM bid disciplines (R2 BOQ)</p>
          <div className="flex flex-wrap gap-2">
            {CRM_BID_DISCIPLINES.map((d) => (
              <button
                key={d.key}
                type="button"
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  bidDisciplineKeys.includes(d.key)
                    ? "bg-brand text-white border-brand"
                    : "bg-paper border-line text-steel-muted"
                }`}
                onClick={() => toggleBidDiscipline(d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </RegisterEntryModal>
    </div>
  );
}
