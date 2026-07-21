import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, formatINR } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";

export default function CostPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [billsData, setBillsData] = useState<{ bills: any[]; totals: any } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<"budget" | "monitoring" | "cashflow" | "rates" | "boq" | "bills">(
    searchParams.get("tab") === "bills" ? "bills" : "monitoring"
  );
  const [billForm, setBillForm] = useState({
    vendorName: "",
    billNo: "",
    amount: "",
    gstAmount: "",
    copNo: "",
    description: "",
    status: "Submitted",
  });
  const canEdit = user?.role === "admin" || user?.role === "office" || user?.role === "employee";
  const clientBlocked = user?.role === "client";

  const load = () => api(`/api/cost/${id}/summary`, { token }).then(setSummary);
  const loadBills = () => api<{ bills: any[]; totals: any }>(`/api/cost/${id}/bills`, { token }).then(setBillsData);

  useEffect(() => {
    if (!clientBlocked) {
      void load();
      void loadBills();
    }
  }, [id, token, clientBlocked]);

  if (clientBlocked) {
    return (
      <div className="space-y-4">
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project
        </Link>
        <p className="text-steel-muted">Cost tracking is not available on the client portal.</p>
      </div>
    );
  }

  if (!summary) return <div className="text-steel-muted py-10">Loading cost dashboard…</div>;

  const tabs = [
    ["monitoring", "Measurement"],
    ["bills", "COP / Bills"],
    ["cashflow", "Cashflow"],
    ["budget", "Budget WBS"],
    ["rates", "Rate diff"],
    ["boq", "BOQ import"],
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <Link to={`/workspace`} className="text-sm text-brand font-medium">
          ← Workspaces
        </Link>
        <PageHeader
          eyebrow="Finance"
          title="Cost, COP & bill tracker"
          subtitle="Measurement, vendor bill / COP entries, cashflow and budget — Procore-style registers."
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          ["Budgeted", summary.totals.budgeted],
          ["Work order", summary.totals.workOrder],
          ["Certified", summary.totals.certified],
          ["Bills pending", billsData?.totals?.pending ?? 0],
          ["Actual CF", summary.totals.actual],
        ].map(([label, val]) => (
          <Card key={label as string} className="!p-4">
            <div className="text-[10px] uppercase tracking-wider text-steel-muted font-mono">{label}</div>
            <div className="text-lg font-display mt-2">{formatINR(val as number)}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-sm px-4 py-2 text-sm font-medium border transition ${
              tab === k ? "bg-brand text-white border-brand" : "bg-white border-line text-ink hover:border-brand/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bills" && (
        <div className="space-y-4">
          {canEdit && (
            <Card>
              <h3 className="font-semibold mb-2">Vendor bill entry</h3>
              <p className="text-xs text-steel-muted mb-3">
                COP / RA bill tracker — enter vendor bills, link COP no., move status to Certified / Paid.
              </p>
              <form
                className="grid sm:grid-cols-2 gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/api/cost/${id}/bills`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({
                      ...billForm,
                      amount: Number(billForm.amount || 0),
                      gstAmount: Number(billForm.gstAmount || 0),
                    }),
                  });
                  setBillForm({
                    vendorName: "",
                    billNo: "",
                    amount: "",
                    gstAmount: "",
                    copNo: "",
                    description: "",
                    status: "Submitted",
                  });
                  await loadBills();
                }}
              >
                <Input
                  required
                  placeholder="Vendor name"
                  value={billForm.vendorName}
                  onChange={(e) => setBillForm({ ...billForm, vendorName: e.target.value })}
                />
                <Input
                  required
                  placeholder="Bill no."
                  value={billForm.billNo}
                  onChange={(e) => setBillForm({ ...billForm, billNo: e.target.value })}
                />
                <Input
                  required
                  placeholder="Amount"
                  value={billForm.amount}
                  onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
                />
                <Input
                  placeholder="GST"
                  value={billForm.gstAmount}
                  onChange={(e) => setBillForm({ ...billForm, gstAmount: e.target.value })}
                />
                <Input
                  placeholder="COP / RA no."
                  value={billForm.copNo}
                  onChange={(e) => setBillForm({ ...billForm, copNo: e.target.value })}
                />
                <Select value={billForm.status} onChange={(e) => setBillForm({ ...billForm, status: e.target.value })}>
                  {["Draft", "Submitted", "Under review", "Certified", "Paid", "Rejected"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Input
                  className="sm:col-span-2"
                  placeholder="Description"
                  value={billForm.description}
                  onChange={(e) => setBillForm({ ...billForm, description: e.target.value })}
                />
                <Button type="submit" className="sm:col-span-2">
                  Add vendor bill
                </Button>
              </form>
            </Card>
          )}
          <Table
            headers={["Bill no", "Vendor", "COP", "Amount", "GST", "Status", "Date"]}
            rows={(billsData?.bills || []).map((b: any) => [
              b.billNo,
              b.vendorName,
              b.copNo || "—",
              formatINR(b.amount),
              formatINR(b.gstAmount),
              b.status,
              new Date(b.billDate).toLocaleDateString(),
            ])}
          />
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {(billsData?.bills || [])
                .filter((b) => b.status === "Submitted" || b.status === "Under review")
                .slice(0, 8)
                .map((b) => (
                  <Button
                    key={b.id}
                    type="button"
                    variant="secondary"
                    className="!text-xs"
                    onClick={async () => {
                      await api(`/api/cost/bills/${b.id}`, {
                        method: "PATCH",
                        token,
                        body: JSON.stringify({ status: "Certified" }),
                      });
                      await loadBills();
                    }}
                  >
                    Certify {b.billNo}
                  </Button>
                ))}
            </div>
          )}
        </div>
      )}

      {tab === "budget" && (
        <Table
          headers={["Sr", "Description", "Stakeholder", "Budgeted", "WO", "Certified"]}
          rows={summary.budget.map((b: any) => [
            b.srNo,
            b.description,
            b.stakeholder,
            formatINR(b.budgetedAmount),
            formatINR(b.workOrderAmount),
            formatINR(b.certifiedAmount),
          ])}
        />
      )}
      {tab === "monitoring" && (
        <div className="space-y-3">
          <p className="text-sm text-steel-muted">Measurement items from the Monitoring sheet.</p>
          <Table
            headers={["Item", "Description", "UOM", "Rate", "BOQ Qty", "GFC", "Achieved", "Excess", "BOQ Cost"]}
            rows={summary.monitoring.map((b: any) => [
              b.itemNo,
              b.description,
              b.uom,
              b.rate,
              b.boqQty,
              b.gfcQty,
              b.achievedQty,
              b.excessQty,
              formatINR(b.boqCost),
            ])}
          />
        </div>
      )}
      {tab === "cashflow" && (
        <Table
          headers={["Period", "Package", "Planned", "Actual", "Progress"]}
          rows={summary.cashflow.map((b: any) => [
            b.periodLabel,
            b.packageName,
            formatINR(b.plannedAmount),
            formatINR(b.actualAmount),
            `${Math.round((b.progressPct || 0) * 100)}%`,
          ])}
        />
      )}
      {tab === "rates" && (
        <Table
          headers={["Material", "Vendor", "Qty", "Basic", "Purchase", "Excess", "Saving"]}
          rows={summary.rateDiffs.map((b: any) => [
            b.materialType,
            b.vendorName,
            b.qty,
            b.basicRate,
            b.purchaseRate,
            formatINR(b.excessAmount),
            formatINR(b.savingAmount),
          ])}
        />
      )}
      {tab === "boq" && (
        <Card className="space-y-4">
          <p className="text-sm text-steel-muted">Upload BOQ Excel. Imports land in measurement / monitoring.</p>
          {canEdit && (
            <form
              className="flex flex-wrap gap-2 items-center"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!file) return;
                const fd = new FormData();
                fd.append("file", file);
                await api(`/api/cost/${id}/boq/import`, { method: "POST", token, body: fd });
                setFile(null);
                await load();
                setTab("monitoring");
              }}
            >
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Button type="submit">Import BOQ</Button>
            </form>
          )}
          <ul className="text-sm space-y-2">
            {summary.boqBatches.map((b: any) => (
              <li key={b.id} className="border border-line px-3 py-2">
                {b.fileName} · {b.rowCount} rows · {new Date(b.createdAt).toLocaleString()}
              </li>
            ))}
            {!summary.boqBatches.length && <li className="text-steel-muted">No imports yet.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number | null | undefined)[][] }) {
  return (
    <div className="overflow-x-auto border border-line bg-white scroll-panel-lg">
      <table className="w-full text-sm">
        <thead className="bg-brand-soft/60 text-left sticky top-0">
          <tr>
            {headers.map((h) => (
              <th key={h} className="p-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-steel-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line hover:bg-sand/50">
              {r.map((c, j) => (
                <td key={j} className="p-3 max-w-md">
                  <span className={j === 1 ? "line-clamp-3 whitespace-normal" : "truncate block"}>{c ?? "—"}</span>
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="p-6 text-steel-muted" colSpan={headers.length}>
                No rows yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
