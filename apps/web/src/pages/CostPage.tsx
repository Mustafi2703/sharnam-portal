import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatINR } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHeader } from "../components/ui";

export default function CostPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tab, setTab] = useState<"budget" | "monitoring" | "cashflow" | "rates" | "boq">("monitoring");
  const canEdit = user?.role === "admin" || user?.role === "office";
  const clientBlocked = user?.role === "client";

  const load = () => api(`/api/cost/${id}/summary`, { token }).then(setSummary);

  useEffect(() => {
    if (!clientBlocked) void load();
  }, [id, token]);

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
          title="Cost & cashflow"
          subtitle="Measurement sheet (Monitoring), cashflow periods, and budget — seeded from Cashflow Dashboard.xlsx. Scroll panels keep large BOQ lists usable."
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          ["Budgeted", summary.totals.budgeted],
          ["Work order", summary.totals.workOrder],
          ["Certified", summary.totals.certified],
          ["Planned CF", summary.totals.planned],
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
        <Badge tone="neutral">{summary.monitoring?.length || 0} measurement lines</Badge>
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
        <div className="space-y-3">
          <p className="text-sm text-steel-muted">
            Measurement items from the Monitoring sheet — parent narrative rows without UOM/rate are skipped so the
            register stays usable.
          </p>
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
          <p className="text-sm text-steel-muted">
            Upload BOQ Excel (Sr / Description / Qty / Rate / Unit / Amount). Imports land in measurement / monitoring.
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
              <Button type="submit">Import BOQ</Button>
            </form>
          )}
          <ul className="text-sm space-y-2 list-roomy">
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
                No rows — re-seed or import BOQ / measurement.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
