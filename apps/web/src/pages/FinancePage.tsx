import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";

const TOOLS = [
  { id: "overview", label: "Overview" },
  { id: "capex", label: "Project CAPEX" },
  { id: "po", label: "Purchase Orders" },
  { id: "ra", label: "RA Bill Tracker" },
  { id: "cop", label: "COP (Certificate of Payment)" },
  { id: "summary", label: "Payment Summary" },
  { id: "audit", label: "Audit sheets → drive" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

function money(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return "₹ " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function d(s?: string | null) {
  if (!s) return "";
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-IN");
}

export default function FinancePage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const tab = (searchParams.get("tab") as ToolId) || "overview";
  const active = TOOLS.find((t) => t.id === tab) || TOOLS[0];
  const canWrite = ["admin", "office"].includes(user?.role || "");

  const [summary, setSummary] = useState<any>(null);
  const [capex, setCapex] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [ras, setRas] = useState<any[]>([]);
  const [cops, setCops] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const reload = async () => {
    const [sum, cx, po, ra, cop] = await Promise.all([
      api<any>(`/api/finance/${id}/summary`, { token }),
      api<any[]>(`/api/finance/${id}/capex`, { token }),
      api<any[]>(`/api/finance/${id}/po`, { token }),
      api<any[]>(`/api/finance/${id}/ra`, { token }),
      api<any[]>(`/api/finance/${id}/cop`, { token }),
    ]);
    setSummary(sum);
    setCapex(cx);
    setPos(po);
    setRas(ra);
    setCops(cop);
  };
  useEffect(() => {
    void reload();
  }, [id, token]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance module · commercial ledger"
        title={active.label}
        subtitle="CAPEX · PO · RA Bill · COP tracking. Everything cross-linked; cumulative computed. Audit sheets dump to SharePoint on demand."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/projects/${id}/hub/finance`}>
              <Button type="button" variant="secondary">Finance hub</Button>
            </Link>
            <Link to={`/projects/${id}/cost`}>
              <Button type="button" variant="secondary">Cost (MB / BOQ) →</Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSearchParams(t.id === "overview" ? {} : { tab: t.id })}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
              active.id === t.id ? "bg-ink text-white border-ink" : "bg-white border-line text-steel-muted hover:border-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      {active.id === "overview" && <Overview summary={summary} pos={pos} ras={ras} cops={cops} />}

      {active.id === "capex" && (
        <CapexTab
          capex={capex}
          canWrite={canWrite}
          reload={reload}
          setMsg={setMsg}
          projectId={id!}
          token={token || ""}
        />
      )}

      {active.id === "po" && (
        <PoTab pos={pos} canWrite={canWrite} reload={reload} setMsg={setMsg} projectId={id!} token={token || ""} />
      )}

      {active.id === "ra" && (
        <RaTab
          ras={ras}
          pos={pos}
          canWrite={canWrite}
          reload={reload}
          setMsg={setMsg}
          projectId={id!}
          token={token || ""}
        />
      )}

      {active.id === "cop" && (
        <CopTab
          cops={cops}
          pos={pos}
          ras={ras}
          canWrite={canWrite}
          reload={reload}
          setMsg={setMsg}
          projectId={id!}
          token={token || ""}
        />
      )}

      {active.id === "summary" && <PaymentSummaryTab summary={summary} />}

      {active.id === "audit" && (
        <AuditTab
          canWrite={canWrite}
          projectId={id!}
          token={token || ""}
          setMsg={setMsg}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── Overview ─────────────────────────── */

function Overview({ summary, pos, ras, cops }: { summary: any; pos: any[]; ras: any[]; cops: any[] }) {
  const t = summary?.totals || {};
  const cards = [
    ["CAPEX budgeted", money(t.capexBudgeted)],
    ["PO original value", money(t.poOriginal)],
    ["Billed (w/o GST)", money(t.poBilledWithoutGst)],
    ["Certified", money(t.poCertified)],
    ["RA gross", money(t.raGross)],
    ["RA net payable", money(t.raNetPayable)],
    ["Retention held", money(t.raRetention)],
    ["Advance adjusted", money(t.raAdvanceAdjusted)],
    ["COP certified", money(t.copCertified)],
    ["COP payable", money(t.copPayable)],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {cards.map(([label, val]) => (
          <Card key={label} className="!p-4">
            <div className="text-[10px] uppercase tracking-wide text-steel-muted">{label}</div>
            <div className="text-lg font-display mt-2">{val}</div>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <h3 className="font-semibold text-sm mb-2">Latest RA bills</h3>
          <table className="w-full text-xs">
            <thead className="text-left text-steel-muted">
              <tr><th>RA</th><th>Invoice</th><th>Date</th><th className="text-right">Net</th><th>Status</th></tr>
            </thead>
            <tbody>
              {ras.slice(0, 8).map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5">{r.raNumber}</td>
                  <td>{r.invoiceNumber || "—"}</td>
                  <td>{d(r.invoiceDate)}</td>
                  <td className="text-right">{money(r.netAmountPayable)}</td>
                  <td><Badge tone={r.status === "Paid" ? "ok" : r.status === "Rejected" ? "danger" : "brand"}>{r.status}</Badge></td>
                </tr>
              ))}
              {!ras.length && <tr><td colSpan={5} className="py-4 text-center text-steel-muted">No RA bills yet.</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-2">COPs by status</h3>
          <table className="w-full text-xs">
            <thead className="text-left text-steel-muted"><tr><th>COP</th><th>Contractor</th><th>PO</th><th className="text-right">Payable</th><th>Status</th></tr></thead>
            <tbody>
              {cops.slice(0, 8).map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-1.5">{c.certificateNumber}</td>
                  <td>{c.contractor}</td>
                  <td>{c.purchaseOrder?.poNumber || "—"}</td>
                  <td className="text-right">{money(c.amountPayable)}</td>
                  <td><Badge tone={c.status === "Paid" ? "ok" : c.status === "Rejected" ? "danger" : "brand"}>{c.status}</Badge></td>
                </tr>
              ))}
              {!cops.length && <tr><td colSpan={5} className="py-4 text-center text-steel-muted">No COPs yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
      <Card>
        <h3 className="font-semibold text-sm mb-2">Open POs — {pos.length}</h3>
        <table className="w-full text-xs">
          <thead className="text-left text-steel-muted">
            <tr>
              <th>PO No</th><th>Vendor</th><th>Trade</th>
              <th className="text-right">Original</th>
              <th className="text-right">Billed (w/o GST)</th>
              <th className="text-right">Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-1.5">{p.poNumber}</td>
                <td>{p.vendorName}</td>
                <td>{p.workTrade || "—"}</td>
                <td className="text-right">{money(p.originalValue)}</td>
                <td className="text-right">{money(p.totalBilledWithoutGst)}</td>
                <td className="text-right">{money(Math.max(0, (p.amendedValue || p.originalValue) - p.totalBilledWithoutGst))}</td>
                <td><Badge tone={p.status === "Closed" ? "ok" : "brand"}>{p.status}</Badge></td>
              </tr>
            ))}
            {!pos.length && <tr><td colSpan={7} className="py-4 text-center text-steel-muted">No POs yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ─────────────────────────── CAPEX ─────────────────────────── */

function CapexTab({ capex, canWrite, reload, setMsg, projectId, token }: any) {
  const [row, setRow] = useState({ srNo: "", description: "", packageName: "", stakeholder: "", budgetedAmount: "", workOrderValue: "" });
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/finance/${projectId}/capex`, { method: "POST", token, body: JSON.stringify(row) });
      setRow({ srNo: "", description: "", packageName: "", stakeholder: "", budgetedAmount: "", workOrderValue: "" });
      setMsg("Capex line added.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add failed");
    }
  }
  const total = capex.reduce((s: number, r: any) => s + Number(r.budgetedAmount || 0), 0);
  return (
    <div className="space-y-3">
      {canWrite && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Add CAPEX line</h3>
          <form onSubmit={add} className="grid md:grid-cols-6 gap-2">
            <Input placeholder="Sr" value={row.srNo} onChange={(e) => setRow({ ...row, srNo: e.target.value })} />
            <Input placeholder="Description" value={row.description} onChange={(e) => setRow({ ...row, description: e.target.value })} required />
            <Input placeholder="Package (e.g. Civil)" value={row.packageName} onChange={(e) => setRow({ ...row, packageName: e.target.value })} />
            <Input placeholder="Stakeholder" value={row.stakeholder} onChange={(e) => setRow({ ...row, stakeholder: e.target.value })} />
            <Input placeholder="Budgeted (₹)" type="number" value={row.budgetedAmount} onChange={(e) => setRow({ ...row, budgetedAmount: e.target.value })} />
            <Input placeholder="Work order (₹)" type="number" value={row.workOrderValue} onChange={(e) => setRow({ ...row, workOrderValue: e.target.value })} />
            <Button type="submit" className="md:col-span-6">Add line</Button>
          </form>
        </Card>
      )}
      <Card>
        <h3 className="font-semibold text-sm mb-2">CAPEX lines — total {money(total)}</h3>
        <table className="w-full text-xs">
          <thead className="text-left text-steel-muted">
            <tr><th>Sr</th><th>Description</th><th>Package</th><th>Stakeholder</th><th className="text-right">Budgeted</th><th className="text-right">Work Order</th></tr>
          </thead>
          <tbody>
            {capex.map((r: any) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-1.5">{r.srNo || "—"}</td>
                <td>{r.description}</td>
                <td>{r.packageName || "—"}</td>
                <td>{r.stakeholder || "—"}</td>
                <td className="text-right">{money(r.budgetedAmount)}</td>
                <td className="text-right">{money(r.workOrderValue)}</td>
              </tr>
            ))}
            {!capex.length && <tr><td colSpan={6} className="py-4 text-center text-steel-muted">No CAPEX lines yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ─────────────────────────── Purchase Orders ─────────────────────────── */

function PoTab({ pos, canWrite, reload, setMsg, projectId, token }: any) {
  const [form, setForm] = useState({ poNumber: "", poDate: "", vendorName: "", workTrade: "", packageName: "", originalValue: "", amendedValue: "", retentionPct: "5", advancePct: "0", panNumber: "", gstNumber: "", payableTo: "" });
  const [file, setFile] = useState<File | null>(null);
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append("file", file);
      await api(`/api/finance/${projectId}/po`, { method: "POST", token, body: fd });
      setForm({ poNumber: "", poDate: "", vendorName: "", workTrade: "", packageName: "", originalValue: "", amendedValue: "", retentionPct: "5", advancePct: "0", panNumber: "", gstNumber: "", payableTo: "" });
      setFile(null);
      setMsg("PO added; attachment (if any) saved to 09.01 folder.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add failed");
    }
  }
  return (
    <div className="space-y-3">
      {canWrite && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Add Purchase Order</h3>
          <form onSubmit={add} className="grid md:grid-cols-4 gap-2">
            <Input placeholder="PO Number" value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} required />
            <Input placeholder="PO Date" type="date" value={form.poDate} onChange={(e) => setForm({ ...form, poDate: e.target.value })} />
            <Input placeholder="Vendor name" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} required />
            <Input placeholder="Work / Trade" value={form.workTrade} onChange={(e) => setForm({ ...form, workTrade: e.target.value })} />
            <Input placeholder="Package (Civil, PEB, MEP…)" value={form.packageName} onChange={(e) => setForm({ ...form, packageName: e.target.value })} />
            <Input placeholder="Original value (₹)" type="number" value={form.originalValue} onChange={(e) => setForm({ ...form, originalValue: e.target.value })} required />
            <Input placeholder="Amended value (₹)" type="number" value={form.amendedValue} onChange={(e) => setForm({ ...form, amendedValue: e.target.value })} />
            <Input placeholder="Retention %" type="number" value={form.retentionPct} onChange={(e) => setForm({ ...form, retentionPct: e.target.value })} />
            <Input placeholder="Advance %" type="number" value={form.advancePct} onChange={(e) => setForm({ ...form, advancePct: e.target.value })} />
            <Input placeholder="PAN" value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value })} />
            <Input placeholder="GST No." value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
            <Input placeholder="Payable to" value={form.payableTo} onChange={(e) => setForm({ ...form, payableTo: e.target.value })} />
            <label className="md:col-span-3 text-xs text-steel-muted">
              PO attachment (PDF / scan)
              <input type="file" accept=".pdf,image/*" className="block mt-1 text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <Button type="submit">Add PO</Button>
          </form>
        </Card>
      )}
      <Card>
        <h3 className="font-semibold text-sm mb-2">Purchase Orders</h3>
        <table className="w-full text-xs">
          <thead className="text-left text-steel-muted">
            <tr><th>PO</th><th>Date</th><th>Vendor</th><th>Trade</th><th className="text-right">Original</th><th className="text-right">Amended</th><th className="text-right">Billed</th><th>RAs</th><th>Status</th></tr>
          </thead>
          <tbody>
            {pos.map((p: any) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-1.5">{p.poNumber}</td>
                <td>{d(p.poDate)}</td>
                <td>{p.vendorName}</td>
                <td>{p.workTrade || "—"}</td>
                <td className="text-right">{money(p.originalValue)}</td>
                <td className="text-right">{money(p.amendedValue)}</td>
                <td className="text-right">{money(p.totalBilledWithoutGst)}</td>
                <td>{p._count?.raBills ?? 0}</td>
                <td><Badge tone={p.status === "Closed" ? "ok" : "brand"}>{p.status}</Badge></td>
              </tr>
            ))}
            {!pos.length && <tr><td colSpan={9} className="py-4 text-center text-steel-muted">No POs yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ─────────────────────────── RA Bill ─────────────────────────── */

function RaTab({ ras, pos, canWrite, reload, setMsg, projectId, token }: any) {
  const [form, setForm] = useState({ purchaseOrderId: "", raNumber: "", invoiceNumber: "", invoiceDate: "", discipline: "", vendorName: "", description: "", againstBillRaised: "", priceVariation: "", totalInvoiceWithoutGst: "", gstAmount: "", totalInvoiceWithGst: "", advanceAdjusted: "", retentionAmount: "", otherRecoveries: "", netAmountPayable: "" });
  const [file, setFile] = useState<File | null>(null);
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append("file", file);
      await api(`/api/finance/${projectId}/ra`, { method: "POST", token, body: fd });
      setForm({ purchaseOrderId: "", raNumber: "", invoiceNumber: "", invoiceDate: "", discipline: "", vendorName: "", description: "", againstBillRaised: "", priceVariation: "", totalInvoiceWithoutGst: "", gstAmount: "", totalInvoiceWithGst: "", advanceAdjusted: "", retentionAmount: "", otherRecoveries: "", netAmountPayable: "" });
      setFile(null);
      setMsg("RA bill added; cumulative recomputed; attachment saved to 09.01 folder.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add failed");
    }
  }
  return (
    <div className="space-y-3">
      {canWrite && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Add RA Bill</h3>
          <form onSubmit={add} className="grid md:grid-cols-4 gap-2">
            <Select value={form.purchaseOrderId} onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}>
              <option value="">Link PO (optional)</option>
              {pos.map((p: any) => (
                <option key={p.id} value={p.id}>{p.poNumber} · {p.vendorName}</option>
              ))}
            </Select>
            <Input placeholder="RA number (RA-01)" value={form.raNumber} onChange={(e) => setForm({ ...form, raNumber: e.target.value })} required />
            <Input placeholder="Invoice number" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
            <Input placeholder="Invoice date" type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
            <Input placeholder="Vendor name" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} />
            <Input placeholder="Discipline (Civil, PEB…)" value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} />
            <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input placeholder="Against bill raised" type="number" value={form.againstBillRaised} onChange={(e) => setForm({ ...form, againstBillRaised: e.target.value })} />
            <Input placeholder="Price variation" type="number" value={form.priceVariation} onChange={(e) => setForm({ ...form, priceVariation: e.target.value })} />
            <Input placeholder="Total (w/o GST)" type="number" value={form.totalInvoiceWithoutGst} onChange={(e) => setForm({ ...form, totalInvoiceWithoutGst: e.target.value })} />
            <Input placeholder="GST amount" type="number" value={form.gstAmount} onChange={(e) => setForm({ ...form, gstAmount: e.target.value })} />
            <Input placeholder="Total (with GST)" type="number" value={form.totalInvoiceWithGst} onChange={(e) => setForm({ ...form, totalInvoiceWithGst: e.target.value })} />
            <Input placeholder="Advance adjusted" type="number" value={form.advanceAdjusted} onChange={(e) => setForm({ ...form, advanceAdjusted: e.target.value })} />
            <Input placeholder="Retention" type="number" value={form.retentionAmount} onChange={(e) => setForm({ ...form, retentionAmount: e.target.value })} />
            <Input placeholder="Other recoveries" type="number" value={form.otherRecoveries} onChange={(e) => setForm({ ...form, otherRecoveries: e.target.value })} />
            <Input placeholder="Net payable" type="number" value={form.netAmountPayable} onChange={(e) => setForm({ ...form, netAmountPayable: e.target.value })} />
            <label className="md:col-span-3 text-xs text-steel-muted">
              Invoice attachment
              <input type="file" accept=".pdf,image/*" className="block mt-1 text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <Button type="submit">Add RA bill</Button>
          </form>
        </Card>
      )}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between">
          <span className="font-semibold text-sm">RA Bill register</span>
          <span className="text-[11px] text-steel-muted">{ras.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-white">
              <tr><th className="p-2">RA</th><th>Invoice</th><th>Date</th><th>PO</th><th>Discipline</th><th className="text-right">Against</th><th className="text-right">Price Var</th><th className="text-right">w/o GST</th><th className="text-right">w/ GST</th><th className="text-right">Adv adj</th><th className="text-right">Retention</th><th className="text-right">Net</th><th className="text-right">Cumulative</th><th>COP</th><th>Status</th></tr>
            </thead>
            <tbody>
              {ras.map((r: any) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-1.5 px-2">{r.raNumber}</td>
                  <td>{r.invoiceNumber || "—"}</td>
                  <td>{d(r.invoiceDate)}</td>
                  <td>{r.purchaseOrder?.poNumber || "—"}</td>
                  <td>{r.discipline || "—"}</td>
                  <td className="text-right">{money(r.againstBillRaised)}</td>
                  <td className="text-right">{money(r.priceVariation)}</td>
                  <td className="text-right">{money(r.totalInvoiceWithoutGst)}</td>
                  <td className="text-right">{money(r.totalInvoiceWithGst)}</td>
                  <td className="text-right">{money(r.advanceAdjusted)}</td>
                  <td className="text-right">{money(r.retentionAmount)}</td>
                  <td className="text-right">{money(r.netAmountPayable)}</td>
                  <td className="text-right">{money(r.cumulativeBillTotal)}</td>
                  <td>{r.copNo || "—"}</td>
                  <td><Badge tone={r.status === "Paid" ? "ok" : r.status === "Rejected" ? "danger" : "brand"}>{r.status}</Badge></td>
                </tr>
              ))}
              {!ras.length && <tr><td colSpan={15} className="py-4 text-center text-steel-muted">No RA bills yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────── COP ─────────────────────────── */

function CopTab({ cops, pos, ras, canWrite, reload, setMsg, projectId, token }: any) {
  const [form, setForm] = useState({ certificateNumber: "", certificateType: "Against - RA", certificateDate: "", contractor: "", workTrade: "", budgetCode: "", purchaseOrderId: "", poNumberDate: "", originalWoValue: "", amendmentNo: "", amendedWoValue: "", invoiceNoDate: "", raBillId: "", amountCertified: "", amountPayable: "", gstAmount: "", retentionAmount: "", panNumber: "", gstNumber: "", payableTo: "", remarks: "" });
  const [file, setFile] = useState<File | null>(null);
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append("file", file);
      await api(`/api/finance/${projectId}/cop`, { method: "POST", token, body: fd });
      setForm({ certificateNumber: "", certificateType: "Against - RA", certificateDate: "", contractor: "", workTrade: "", budgetCode: "", purchaseOrderId: "", poNumberDate: "", originalWoValue: "", amendmentNo: "", amendedWoValue: "", invoiceNoDate: "", raBillId: "", amountCertified: "", amountPayable: "", gstAmount: "", retentionAmount: "", panNumber: "", gstNumber: "", payableTo: "", remarks: "" });
      setFile(null);
      setMsg("COP created; attachment (if any) saved to 09.05; RA linked if you selected one.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add failed");
    }
  }
  return (
    <div className="space-y-3">
      {canWrite && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Certify a payment (COP)</h3>
          <form onSubmit={add} className="grid md:grid-cols-4 gap-2">
            <Input placeholder="Cert No. (01/N.K.INFRA/2025)" value={form.certificateNumber} onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })} required />
            <Input placeholder="Cert type (Against - RA / Advance)" value={form.certificateType} onChange={(e) => setForm({ ...form, certificateType: e.target.value })} />
            <Input placeholder="Cert date" type="date" value={form.certificateDate} onChange={(e) => setForm({ ...form, certificateDate: e.target.value })} />
            <Input placeholder="Contractor" value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} required />
            <Input placeholder="Work / Trade" value={form.workTrade} onChange={(e) => setForm({ ...form, workTrade: e.target.value })} />
            <Input placeholder="Budget code" value={form.budgetCode} onChange={(e) => setForm({ ...form, budgetCode: e.target.value })} />
            <Select value={form.purchaseOrderId} onChange={(e) => setForm({ ...form, purchaseOrderId: e.target.value })}>
              <option value="">Link PO</option>
              {pos.map((p: any) => (
                <option key={p.id} value={p.id}>{p.poNumber} · {p.vendorName}</option>
              ))}
            </Select>
            <Input placeholder="PO No. & date (text)" value={form.poNumberDate} onChange={(e) => setForm({ ...form, poNumberDate: e.target.value })} />
            <Input placeholder="Original WO value" type="number" value={form.originalWoValue} onChange={(e) => setForm({ ...form, originalWoValue: e.target.value })} />
            <Input placeholder="Amendment no." value={form.amendmentNo} onChange={(e) => setForm({ ...form, amendmentNo: e.target.value })} />
            <Input placeholder="Amended WO value" type="number" value={form.amendedWoValue} onChange={(e) => setForm({ ...form, amendedWoValue: e.target.value })} />
            <Input placeholder="Invoice No. & date" value={form.invoiceNoDate} onChange={(e) => setForm({ ...form, invoiceNoDate: e.target.value })} />
            <Select value={form.raBillId} onChange={(e) => setForm({ ...form, raBillId: e.target.value })}>
              <option value="">Link RA (optional)</option>
              {ras.map((r: any) => (
                <option key={r.id} value={r.id}>{r.raNumber} · {r.invoiceNumber || "no invoice"}</option>
              ))}
            </Select>
            <Input placeholder="Amount certified" type="number" value={form.amountCertified} onChange={(e) => setForm({ ...form, amountCertified: e.target.value })} />
            <Input placeholder="Amount payable" type="number" value={form.amountPayable} onChange={(e) => setForm({ ...form, amountPayable: e.target.value })} />
            <Input placeholder="GST" type="number" value={form.gstAmount} onChange={(e) => setForm({ ...form, gstAmount: e.target.value })} />
            <Input placeholder="Retention" type="number" value={form.retentionAmount} onChange={(e) => setForm({ ...form, retentionAmount: e.target.value })} />
            <Input placeholder="PAN" value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value })} />
            <Input placeholder="GST No." value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
            <Input placeholder="Payable to" value={form.payableTo} onChange={(e) => setForm({ ...form, payableTo: e.target.value })} />
            <TextArea rows={2} placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="md:col-span-4" />
            <label className="md:col-span-3 text-xs text-steel-muted">
              Certificate PDF (optional)
              <input type="file" accept=".pdf,image/*" className="block mt-1 text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <Button type="submit">Create COP</Button>
          </form>
        </Card>
      )}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between">
          <span className="font-semibold text-sm">Certificate of Payment · register</span>
          <span className="text-[11px] text-steel-muted">{cops.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-white">
              <tr><th className="p-2">COP</th><th>Type</th><th>Date</th><th>Contractor</th><th>PO</th><th>RA</th><th className="text-right">Certified</th><th className="text-right">Payable</th><th>Status</th></tr>
            </thead>
            <tbody>
              {cops.map((c: any) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-1.5 px-2">{c.certificateNumber}</td>
                  <td>{c.certificateType || "—"}</td>
                  <td>{d(c.certificateDate)}</td>
                  <td>{c.contractor}</td>
                  <td>{c.purchaseOrder?.poNumber || "—"}</td>
                  <td>{c.raBill?.raNumber || "—"}</td>
                  <td className="text-right">{money(c.amountCertified)}</td>
                  <td className="text-right">{money(c.amountPayable)}</td>
                  <td><Badge tone={c.status === "Paid" ? "ok" : c.status === "Rejected" ? "danger" : "brand"}>{c.status}</Badge></td>
                </tr>
              ))}
              {!cops.length && <tr><td colSpan={9} className="py-4 text-center text-steel-muted">No COPs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────── Payment Summary ─────────────────────────── */

function PaymentSummaryTab({ summary }: any) {
  const rows: any[] = summary?.paymentSummary || [];
  const totalOriginal = rows.reduce((s, r) => s + Number(r.originalValue || 0), 0);
  const totalBilled = rows.reduce((s, r) => s + Number(r.billedWithoutGst || 0), 0);
  const totalBalance = rows.reduce((s, r) => s + Number(r.balance || 0), 0);
  return (
    <Card padding={false}>
      <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between">
        <span className="font-semibold text-sm">Payment Summary — per PO / vendor</span>
        <span className="text-[11px] text-steel-muted">{rows.length} POs</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-xs">
          <thead className="text-left text-steel-muted bg-white">
            <tr><th className="p-2">PO</th><th>Vendor</th><th>Trade</th><th className="text-right">Original</th><th className="text-right">Amended</th><th className="text-right">Billed (w/o GST)</th><th className="text-right">Billed (w GST)</th><th className="text-right">Net Payable</th><th className="text-right">Retention</th><th className="text-right">Adv. adjusted</th><th className="text-right">Balance</th><th>RA count</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.poId} className="border-t border-line">
                <td className="py-1.5 px-2">{r.poNumber}</td>
                <td>{r.vendorName}</td>
                <td>{r.workTrade || "—"}</td>
                <td className="text-right">{money(r.originalValue)}</td>
                <td className="text-right">{money(r.amendedValue)}</td>
                <td className="text-right">{money(r.billedWithoutGst)}</td>
                <td className="text-right">{money(r.billedWithGst)}</td>
                <td className="text-right">{money(r.netPayable)}</td>
                <td className="text-right">{money(r.retention)}</td>
                <td className="text-right">{money(r.advanceAdj)}</td>
                <td className="text-right">{money(r.balance)}</td>
                <td>{r.raCount}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="border-t-2 border-ink font-semibold">
                <td colSpan={3} className="p-2">TOTAL</td>
                <td className="text-right">{money(totalOriginal)}</td>
                <td></td>
                <td className="text-right">{money(totalBilled)}</td>
                <td colSpan={4}></td>
                <td className="text-right">{money(totalBalance)}</td>
                <td></td>
              </tr>
            )}
            {!rows.length && <tr><td colSpan={12} className="py-4 text-center text-steel-muted">Add POs & RA bills to see the Payment Summary.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ─────────────────────────── Audit ─────────────────────────── */

function AuditTab({ canWrite, projectId, token, setMsg }: any) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  async function dump() {
    setBusy(true);
    try {
      const r = await api<any>(`/api/finance/${projectId}/audit-dump`, { method: "POST", token });
      setResult(r);
      setMsg(`Dumped ${r.uploaded} audit sheets to 09.01 + _Registers @ ${new Date(r.at).toLocaleTimeString()}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Dump failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h3 className="font-semibold text-sm mb-2">Finance audit sheets → SharePoint</h3>
      <p className="text-xs text-steel-muted mb-3">
        Regenerates <code>Capex-Log</code>, <code>PurchaseOrder-Log</code>, <code>RA-Bill-Log</code>, <code>COP-Log</code>, and{" "}
        <code>Payment-Summary</code> as CSVs in <code>09.01_Interim_Bill_Verification_Certification/</code> and{" "}
        <code>09.08_Cost_Reporting_and_Reconciliation/</code>, plus mirrors to <code>_Registers/</code>. Idempotent — never overwrites; timestamps files on conflict.
      </p>
      {canWrite ? (
        <Button type="button" onClick={() => void dump()} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh finance audit sheets"}
        </Button>
      ) : (
        <Badge tone="warn">Admin / office only</Badge>
      )}
      {result && (
        <ul className="mt-3 text-xs space-y-0.5">
          {result.registers?.map((r: string) => (
            <li key={r}>
              ✓ <code>{r}</code>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
