import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../../api";
import { Button, Card, Input } from "../../../components/ui";

type Po = {
  id: string;
  poNumber: string;
  poDate: string | null;
  vendorName: string;
  workTrade: string | null;
  budgetCode: string | null;
  originalValue: number;
  amendmentNo: string | null;
  amendedValue: number;
  retentionPct: number;
  panNumber: string | null;
  gstNumber: string | null;
  payableTo: string | null;
  vendor?: { gstNumber: string | null } | null;
  _count?: { raBills: number; certificates: number };
};

const EMPTY = {
  poNumber: "",
  poDate: "",
  vendorName: "",
  workTrade: "",
  budgetCode: "",
  originalValue: "",
  amendmentNo: "",
  amendedValue: "",
  retentionPct: "5",
  gstNumber: "",
  panNumber: "",
  payableTo: "",
};

const inr = (n: number) => (n ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—");

/**
 * Work orders / POs — the COP header (W.O./P.O. no. & date, budget code, original / amended WO value,
 * PAN, GST, payable to) is read from the contractor's PO. Vendor names come from the RA bills.
 */
export function WorkOrderCard({
  projectId,
  token,
  canWrite,
  vendorNames,
  setMsg,
}: {
  projectId: string;
  token: string | null;
  canWrite: boolean;
  vendorNames: string[];
  setMsg: (m: string) => void;
}) {
  const [rows, setRows] = useState<Po[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      setRows(await api<Po[]>(`/api/finance/${projectId}/po`, { token }));
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      await api(`/api/finance/${projectId}/po`, { method: "POST", token, body: fd });
      setForm(EMPTY);
      setOpen(false);
      setMsg(`PO ${form.poNumber} saved — COPs for ${form.vendorName} now carry its PO, WO value, budget code, PAN and GST.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save PO");
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="font-semibold text-sm">Work orders / POs</h3>
          <p className="text-xs text-steel-muted">The certificate's PO, WO value, budget code, PAN and GST come from here.</p>
        </div>
        {canWrite && (
          <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "+ Add PO"}
          </Button>
        )}
      </div>
      {open && canWrite && (
        <form onSubmit={add} className="grid md:grid-cols-4 gap-2 mb-3">
          <Input placeholder="PO / WO no. (2526PO00160)" value={form.poNumber} onChange={set("poNumber")} required />
          <Input placeholder="PO date" type="date" value={form.poDate} onChange={set("poDate")} />
          <Input placeholder="Contractor (as on RA bills)" list="po-vendor-names" value={form.vendorName} onChange={set("vendorName")} required />
          <datalist id="po-vendor-names">
            {vendorNames.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <Input placeholder="Work / trade (Civil)" value={form.workTrade} onChange={set("workTrade")} />
          <Input placeholder="Budget code" value={form.budgetCode} onChange={set("budgetCode")} />
          <Input placeholder="Original WO value (₹)" type="number" value={form.originalValue} onChange={set("originalValue")} />
          <Input placeholder="Amendment no." value={form.amendmentNo} onChange={set("amendmentNo")} />
          <Input placeholder="Amended WO value (₹)" type="number" value={form.amendedValue} onChange={set("amendedValue")} />
          <Input placeholder="Retention %" type="number" value={form.retentionPct} onChange={set("retentionPct")} />
          <Input placeholder="GST no. (PAN is read from it)" value={form.gstNumber} onChange={set("gstNumber")} />
          <Input placeholder="PAN (optional)" value={form.panNumber} onChange={set("panNumber")} />
          <Input placeholder="Payable to (defaults to contractor)" value={form.payableTo} onChange={set("payableTo")} />
          <Button type="submit" className="md:col-start-4">
            Save PO
          </Button>
        </form>
      )}
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-steel-muted">
                <th className="py-1 pr-2">PO / WO</th>
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Contractor</th>
                <th className="py-1 pr-2">Trade</th>
                <th className="py-1 pr-2">Budget code</th>
                <th className="py-1 pr-2 text-right">WO value</th>
                <th className="py-1 pr-2 text-right">Amended</th>
                <th className="py-1 pr-2">GST no.</th>
                <th className="py-1 pr-2 text-right">RA / COP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-1 pr-2 font-medium">{p.poNumber}</td>
                  <td className="py-1 pr-2">{p.poDate ? new Date(p.poDate).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="py-1 pr-2">{p.vendorName}</td>
                  <td className="py-1 pr-2">{p.workTrade || "—"}</td>
                  <td className="py-1 pr-2">{p.budgetCode || "—"}</td>
                  <td className="py-1 pr-2 text-right">{inr(p.originalValue)}</td>
                  <td className="py-1 pr-2 text-right">{inr(p.amendedValue)}</td>
                  <td className="py-1 pr-2">{p.gstNumber || p.vendor?.gstNumber || "—"}</td>
                  <td className="py-1 pr-2 text-right">
                    {p._count?.raBills ?? 0} / {p._count?.certificates ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-steel-muted">No POs yet — add the contractor's work order so certificates carry its details.</p>
      )}
    </Card>
  );
}
