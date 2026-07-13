import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatINR } from "../api";
import { useAuth } from "../auth";

export default function CostPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<"budget" | "monitoring" | "cashflow" | "rates" | "boq">("budget");
  const canEdit = user?.role === "admin" || user?.role === "office";
  const clientBlocked = user?.role === "client";

  const load = () => api(`/api/cost/${id}/summary`, { token }).then(setSummary);

  useEffect(() => {
    if (!clientBlocked) void load();
  }, [id, token]);

  if (clientBlocked) {
    return (
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <p className="mt-4 text-steel-muted">Cost tracking is not available on the client portal.</p>
      </div>
    );
  }

  if (!summary) return <div className="text-steel-muted">Loading cost dashboard…</div>;

  const tabs = [
    ["budget", "Budget WBS"],
    ["monitoring", "Monitoring"],
    ["cashflow", "Cashflow"],
    ["rates", "Rate diff"],
    ["boq", "BOQ import"],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <h1 className="font-display text-4xl mt-1">Cost Tracking</h1>
        <p className="text-steel-muted">Cashflow dashboard + Parikh-style BOQ import.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Budgeted", summary.totals.budgeted],
          ["Work order", summary.totals.workOrder],
          ["Certified", summary.totals.certified],
          ["Planned CF", summary.totals.planned],
          ["Actual CF", summary.totals.actual],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-2xl bg-white border border-black/5 p-4">
            <div className="text-xs uppercase tracking-wider text-steel-muted">{label}</div>
            <div className="text-lg font-semibold mt-1">{formatINR(val as number)}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? "bg-brand text-white" : "bg-white border border-black/10"}`}
          >
            {label}
          </button>
        ))}
      </div>

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
        <Table
          headers={["Item", "Description", "UOM", "Rate", "BOQ Qty", "GFC", "Achieved", "BOQ Cost"]}
          rows={summary.monitoring.slice(0, 50).map((b: any) => [
            b.itemNo,
            b.description,
            b.uom,
            b.rate,
            b.boqQty,
            b.gfcQty,
            b.achievedQty,
            formatINR(b.boqCost),
          ])}
        />
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
        <div className="rounded-2xl bg-white border border-black/5 p-4 space-y-3">
          <p className="text-sm text-steel-muted">
            Upload BOQ Excel (Sr / Description / Qty / Rate / Unit / Amount). Parser adapted from Parikh procurement.
          </p>
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
              <button className="rounded-xl bg-brand text-white px-4 py-2 text-sm">Import BOQ</button>
            </form>
          )}
          <ul className="text-sm space-y-1">
            {summary.boqBatches.map((b: any) => (
              <li key={b.id}>
                {b.fileName} · {b.rowCount} rows · {new Date(b.createdAt).toLocaleString()}
              </li>
            ))}
            {!summary.boqBatches.length && <li className="text-steel-muted">No imports yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number | null | undefined)[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-sand/50 text-left">
          <tr>
            {headers.map((h) => (
              <th key={h} className="p-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-black/5">
              {r.map((c, j) => (
                <td key={j} className="p-3 max-w-xs truncate">
                  {c ?? "—"}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="p-4 text-steel-muted" colSpan={headers.length}>
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
