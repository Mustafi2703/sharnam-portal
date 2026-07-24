import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, formatINR } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";

type CostTab = "budget" | "monitoring" | "cashflow" | "rates" | "boq" | "bills" | "mb" | "bbs";
const COST_TABS: CostTab[] = ["budget", "monitoring", "cashflow", "rates", "boq", "bills", "mb", "bbs"];

function SheetTable({
  title,
  headers,
  rows,
  stickyFirst = true,
}: {
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  stickyFirst?: boolean;
}) {
  return (
    <div className="sheet-register w-full">
      {title && (
        <div className="sheet-register__head">
          <span>{title}</span>
          <span className="text-steel-muted font-normal normal-case tracking-normal">{rows.length} rows</span>
        </div>
      )}
      <div className="sheet-register__scroll">
        <table className="sheet-register__table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={h} className={stickyFirst && i === 0 ? "sticky-col" : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={`${stickyFirst && j === 0 ? "sticky-col" : ""} ${j <= 1 ? "wrap" : ""}`}>
                    {c ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={headers.length} className="empty">
                  No rows in this sheet yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CostPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [billsData, setBillsData] = useState<{ bills: any[]; totals: any } | null>(null);
  const [parties, setParties] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [structureName, setStructureName] = useState("New structure");
  const [msg, setMsg] = useState("");
  const [cfView, setCfView] = useState<"chart" | "forecast" | "tracking" | "all">("chart");
  const rawTab = searchParams.get("tab") || "monitoring";
  const tab: CostTab = COST_TABS.includes(rawTab as CostTab) ? (rawTab as CostTab) : "monitoring";
  const pkgFilter = searchParams.get("pkg") || "All";
  const setTab = (next: CostTab, pkg?: string) => {
    const nextParams: Record<string, string> = {};
    if (next !== "monitoring") nextParams.tab = next;
    const p = pkg ?? pkgFilter;
    if (p && p !== "All") nextParams.pkg = p;
    setSearchParams(nextParams);
  };
  const setPkg = (p: string) => setTab(tab, p);
  const [billForm, setBillForm] = useState({
    vendorId: "",
    vendorName: "",
    pmcPartyId: "",
    billNo: "",
    amount: "",
    gstAmount: "",
    copNo: "",
    description: "",
    status: "Submitted",
  });
  const [mbForm, setMbForm] = useState({
    packageName: "Dormitory Civil",
    srNo: "",
    description: "",
    nos1: "1",
    nos2: "1",
    length: "",
    width: "",
    height: "",
    unit: "Cmt",
  });

  useEffect(() => {
    if (pkgFilter !== "All") setMbForm((f) => ({ ...f, packageName: pkgFilter }));
  }, [pkgFilter]);
  const canEdit = user?.role === "admin" || user?.role === "office" || user?.role === "employee";
  const clientBlocked = user?.role === "client";

  const load = () => {
    const q = pkgFilter !== "All" ? `?package=${encodeURIComponent(pkgFilter)}` : "";
    return api(`/api/cost/${id}/summary${q}`, { token }).then(setSummary);
  };
  const loadBills = () => api<{ bills: any[]; totals: any }>(`/api/cost/${id}/bills`, { token }).then(setBillsData);

  async function downloadSheet(kind: string) {
    const q = pkgFilter !== "All" ? `?package=${encodeURIComponent(pkgFilter)}` : "";
    const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/cost/${id}/download/${kind}.csv${q}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-${pkgFilter === "All" ? "all" : pkgFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(`Downloaded ${kind} sheet (open in Excel)`);
  }

  useEffect(() => {
    if (!clientBlocked) {
      void load();
      void loadBills();
      api<any[]>(`/api/vendors/project/${id}`, { token })
        .then((rows) => setParties(rows.map((r: any) => r.vendor || r).filter(Boolean)))
        .catch(() =>
          api<any[]>("/api/vendors", { token }).then(setParties).catch(() => setParties([]))
        );
    }
  }, [id, token, clientBlocked, pkgFilter]);

  const contractors = useMemo(() => parties.filter((p) => p.partyType === "Contractor"), [parties]);
  const vendors = useMemo(() => parties.filter((p) => p.partyType === "Vendor" || !p.partyType), [parties]);
  const pmcParties = useMemo(() => parties.filter((p) => p.partyType === "PMC"), [parties]);

  const packages = useMemo(() => ["All", ...(summary?.packages || [])], [summary]);
  const monPackages = useMemo(
    () => (summary?.sheetTools?.monitoring || []).map((m: any) => m.packageName),
    [summary]
  );
  const mbPackages = useMemo(() => (summary?.sheetTools?.mb || []).map((m: any) => m.packageName), [summary]);
  const bbsPackages = useMemo(() => (summary?.sheetTools?.bbs || []).map((m: any) => m.packageName), [summary]);

  const mbRows = useMemo(() => summary?.mbLines || [], [summary]);
  const bbsRows = useMemo(() => summary?.bbsLines || [], [summary]);
  const monRows = useMemo(() => summary?.monitoring || [], [summary]);

  const cashflowRows = useMemo(() => {
    if (cfView === "chart") return summary?.cashflowChart?.length ? summary.cashflowChart : summary?.cashflow || [];
    if (cfView === "forecast") return summary?.cashflowForecast || [];
    if (cfView === "tracking") return summary?.cashflowTracking || [];
    return summary?.cashflow || [];
  }, [summary, cfView]);

  if (clientBlocked) {
    return (
      <div className="space-y-4 w-full">
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project
        </Link>
        <p className="text-steel-muted">Cost tracking is not available on the client portal.</p>
      </div>
    );
  }

  if (!summary) return <div className="text-steel-muted py-10">Loading cost sheets…</div>;

  const tabs = [
    ["monitoring", "BOQ / Monitoring"],
    ["mb", "MB sheets"],
    ["bbs", "BBS"],
    ["budget", "Budget WBS"],
    ["cashflow", "Cashflow"],
    ["rates", "Rate diff"],
    ["bills", "COP / Bills"],
    ["boq", "Structure upload"],
  ] as const;

  async function addMb(e: FormEvent) {
    e.preventDefault();
    await api(`/api/cost/${id}/mb`, {
      method: "POST",
      token,
      body: JSON.stringify({
        ...mbForm,
        nos1: Number(mbForm.nos1 || 0),
        nos2: Number(mbForm.nos2 || 1),
        length: Number(mbForm.length || 0),
        width: Number(mbForm.width || 0),
        height: Number(mbForm.height || 0),
      }),
    });
    setMsg("MB line added");
    await load();
  }

  const packageTools =
    tab === "monitoring" ? monPackages : tab === "mb" ? mbPackages : tab === "bbs" ? bbsPackages : [];

  return (
    <div className="space-y-5 w-full min-w-0">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project
        </Link>
        <PageHeader
          eyebrow="Cost module"
          title="Cost"
          subtitle="One tool at a time — use the sub-tool chips above (Monitoring, MB, BBS, Budget, Cashflow, Bills). Workday-style sheet registers."
          actions={
            <div className="flex flex-wrap gap-2">
              {(tab === "monitoring" || tab === "boq") && (
                <Button type="button" variant="secondary" onClick={() => downloadSheet("boq")}>
                  Download BOQ CSV
                </Button>
              )}
              {tab === "mb" && (
                <Button type="button" variant="secondary" onClick={() => downloadSheet("mb")}>
                  Download MB CSV
                </Button>
              )}
              {tab === "bbs" && (
                <Button type="button" variant="secondary" onClick={() => downloadSheet("bbs")}>
                  Download BBS CSV
                </Button>
              )}
              {tab === "budget" && (
                <Button type="button" variant="secondary" onClick={() => downloadSheet("budget")}>
                  Download Budget
                </Button>
              )}
              {tab === "cashflow" && (
                <Button type="button" variant="secondary" onClick={() => downloadSheet("cashflow")}>
                  Download Cashflow
                </Button>
              )}
              {tab === "rates" && (
                <Button type="button" variant="secondary" onClick={() => downloadSheet("rates")}>
                  Download rates
                </Button>
              )}
            </div>
          }
        />
      </div>

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          ["Budgeted", summary.totals.budgeted],
          ["Work order", summary.totals.workOrder],
          ["Certified", summary.totals.certified],
          ["MB qty total", summary.totals.mbQty],
          ["BBS weight kg", summary.totals.bbsWeightKg],
          ["Bills pending", billsData?.totals?.pending ?? 0],
        ].map(([label, val]) => (
          <Card key={label as string} className="!p-4">
            <div className="text-[10px] uppercase tracking-wider text-steel-muted">{label}</div>
            <div className="text-lg font-display mt-1">
              {typeof label === "string" && /qty|weight|kg/i.test(label)
                ? Number(val).toLocaleString("en-IN", { maximumFractionDigits: 1 })
                : formatINR(val as number)}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-sm px-3 sm:px-4 py-2 text-sm font-medium border transition ${
              tab === k ? "bg-brand text-white border-brand" : "bg-white border-line text-ink hover:border-brand/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {["monitoring", "mb", "bbs"].includes(tab) && (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-steel-muted font-mono">
            Package tools (from SPDC Budget sheets)
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPkg("All")}
              className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
                pkgFilter === "All" ? "bg-procore-navy text-white border-procore-navy" : "bg-white border-line"
              }`}
            >
              All packages
            </button>
            {packageTools.map((p: string) => (
              <button
                key={p}
                type="button"
                onClick={() => setPkg(p)}
                className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border max-w-[220px] truncate ${
                  pkgFilter === p ? "bg-procore-navy text-white border-procore-navy" : "bg-white border-line hover:border-brand/40"
                }`}
                title={p}
              >
                {p}
                {tab === "monitoring" && summary.monByPackage?.[p] != null ? ` (${summary.monByPackage[p]})` : ""}
                {tab === "mb" && summary.mbByPackage?.[p]?.lines != null
                  ? ` (${summary.mbByPackage[p].lines})`
                  : ""}
                {tab === "bbs" && summary.bbsByPackage?.[p]?.lines != null
                  ? ` (${summary.bbsByPackage[p].lines})`
                  : ""}
              </button>
            ))}
            {!packageTools.length &&
              packages
                .filter((p: string) => p !== "All")
                .map((p: string) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPkg(p)}
                    className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
                      pkgFilter === p ? "bg-procore-navy text-white border-procore-navy" : "bg-white border-line"
                    }`}
                  >
                    {p}
                  </button>
                ))}
          </div>
        </div>
      )}

      {tab === "monitoring" && (
        <div className="space-y-3">
          <p className="text-sm text-steel-muted">
            Cost tracking BOQ vs GFC — fill GFC on site; excess / saving computes. Packages from Budget workbook Monitoring sheets.
          </p>
          <SheetTable
            title="Measurement / monitoring register"
            headers={["Package", "Item", "Description", "UOM", "Rate", "BOQ", "Extra", "GFC", "Achieved", "Excess", "Saving"]}
            rows={monRows.map((b: any) => [
              b.packageName,
              b.itemNo,
              b.description,
              b.uom,
              b.rate,
              b.boqQty,
              b.extraQty,
              b.gfcQty,
              b.achievedQty,
              b.excessQty,
              b.savingQty,
            ])}
          />
        </div>
      )}

      {tab === "mb" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(summary.mbByPackage || {}).map(([pkg, v]: [string, any]) => (
              <Card key={pkg} className="!p-3">
                <div className="text-[10px] uppercase text-steel-muted">{pkg}</div>
                <div className="font-display text-xl mt-1">{Number(v.qty).toLocaleString("en-IN", { maximumFractionDigits: 1 })}</div>
                <div className="text-xs text-steel-muted">{v.lines} MB lines</div>
              </Card>
            ))}
          </div>
          {canEdit && (
            <Card>
              <h3 className="font-semibold text-sm mb-3">Add MB line</h3>
              <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={addMb}>
                <Select value={mbForm.packageName} onChange={(e) => setMbForm({ ...mbForm, packageName: e.target.value })}>
                  {(summary.packages || ["Dormitory Civil", "Electric", "Plumbing", "UGWT"]).map((p: string) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
                <Input placeholder="Sr" value={mbForm.srNo} onChange={(e) => setMbForm({ ...mbForm, srNo: e.target.value })} />
                <Input
                  className="sm:col-span-2"
                  placeholder="Description"
                  value={mbForm.description}
                  onChange={(e) => setMbForm({ ...mbForm, description: e.target.value })}
                  required
                />
                <Input placeholder="Nos" value={mbForm.nos1} onChange={(e) => setMbForm({ ...mbForm, nos1: e.target.value })} />
                <Input placeholder="Length" value={mbForm.length} onChange={(e) => setMbForm({ ...mbForm, length: e.target.value })} />
                <Input placeholder="Width" value={mbForm.width} onChange={(e) => setMbForm({ ...mbForm, width: e.target.value })} />
                <Input placeholder="Height" value={mbForm.height} onChange={(e) => setMbForm({ ...mbForm, height: e.target.value })} />
                <Button type="submit">Add to MB</Button>
              </form>
            </Card>
          )}
          <SheetTable
            title="Measurement book (MB)"
            headers={["Package", "Sr", "Description", "Nos", "L", "W", "H", "Qty", "Unit"]}
            rows={mbRows.map((b: any) => [
              b.packageName,
              b.srNo,
              b.description,
              b.nos1,
              b.length,
              b.width,
              b.height,
              b.qty,
              b.unit,
            ])}
          />
        </div>
      )}

      {tab === "bbs" && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(summary.bbsByPackage || {}).map(([pkg, v]: [string, any]) => (
              <Card key={pkg} className="!p-3">
                <div className="text-[10px] uppercase text-steel-muted">{pkg}</div>
                <div className="font-display text-xl mt-1">{Number(v.weightKg).toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg</div>
                <div className="text-xs text-steel-muted">{v.lines} bars</div>
              </Card>
            ))}
          </div>
          <SheetTable
            title="Bar bending schedule (BBS)"
            headers={["Package", "Mark", "Dia mm", "Shape", "Length", "Nos", "Total L", "Weight kg", "Location"]}
            rows={bbsRows.map((b: any) => [
              b.packageName,
              b.barMark,
              b.diameterMm,
              b.shape,
              b.lengthMm,
              b.nos,
              b.totalLength,
              b.weightKg,
              b.location,
            ])}
          />
        </div>
      )}

      {tab === "budget" && (
        <SheetTable
          title="Budget WBS"
          headers={["Sr", "Description", "Stakeholder", "Budgeted", "WO", "Certified", "Forecast"]}
          rows={summary.budget.map((b: any) => [
            b.srNo,
            b.description,
            b.stakeholder,
            formatINR(b.budgetedAmount),
            formatINR(b.workOrderAmount),
            formatINR(b.certifiedAmount),
            formatINR(b.forecastedAmount),
          ])}
        />
      )}

      {tab === "cashflow" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["chart", "Cash Flow Chart"],
                ["forecast", "Forecast"],
                ["tracking", "Tracking"],
                ["all", "All rows"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCfView(k)}
                className={`rounded-sm px-2.5 py-1.5 text-xs font-medium border ${
                  cfView === k ? "bg-procore-navy text-white border-procore-navy" : "bg-white border-line"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-steel-muted">
            From <code className="font-mono">Cashflow - Dashboard.xlsx</code> — Chart / Forecast / Tracking sheets.
          </p>
          <SheetTable
            title={`Cashflow · ${cfView}`}
            headers={["Period", "Package / sheet", "Planned", "Actual", "Progress"]}
            rows={cashflowRows.map((b: any) => [
              b.periodLabel,
              b.packageName,
              formatINR(b.plannedAmount),
              formatINR(b.actualAmount),
              `${Math.round((b.progressPct || 0) * 100)}%`,
            ])}
          />
        </div>
      )}

      {tab === "rates" && (
        <SheetTable
          title="Rate difference (Steel / Cement / Tiles)"
          headers={["Material", "Description", "Vendor", "Qty", "Basic", "Purchase", "Excess", "Saving"]}
          rows={summary.rateDiffs.map((b: any) => [
            b.materialType,
            b.description,
            b.vendorName,
            b.qty,
            b.basicRate,
            b.purchaseRate,
            formatINR(b.excessAmount),
            formatINR(b.savingAmount),
          ])}
        />
      )}

      {tab === "bills" && (
        <div className="space-y-4">
          {canEdit && (
            <Card>
              <h3 className="font-semibold mb-2">Vendor / contractor bill · COP</h3>
              <p className="text-xs text-steel-muted mb-3">Select contractor or vendor and PMC from directory.</p>
              <form
                className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const party = parties.find((p) => p.id === billForm.vendorId);
                  await api(`/api/cost/${id}/bills`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({
                      vendorId: billForm.vendorId || null,
                      vendorName: party?.name || billForm.vendorName || "Vendor",
                      billNo: billForm.billNo,
                      amount: Number(billForm.amount || 0),
                      gstAmount: Number(billForm.gstAmount || 0),
                      copNo: billForm.copNo,
                      description: [
                        billForm.description,
                        billForm.pmcPartyId
                          ? `PMC: ${parties.find((p) => p.id === billForm.pmcPartyId)?.name || ""}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      status: billForm.status,
                    }),
                  });
                  setBillForm({
                    vendorId: "",
                    vendorName: "",
                    pmcPartyId: "",
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
                <Select
                  value={billForm.vendorId}
                  onChange={(e) => setBillForm({ ...billForm, vendorId: e.target.value })}
                  required
                >
                  <option value="">Contractor / vendor…</option>
                  <optgroup label="Contractors">
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Vendors">
                    {vendors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                </Select>
                <Select value={billForm.pmcPartyId} onChange={(e) => setBillForm({ ...billForm, pmcPartyId: e.target.value })}>
                  <option value="">PMC (optional)…</option>
                  {pmcParties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Input required placeholder="Bill no." value={billForm.billNo} onChange={(e) => setBillForm({ ...billForm, billNo: e.target.value })} />
                <Input required placeholder="Amount" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} />
                <Input placeholder="GST" value={billForm.gstAmount} onChange={(e) => setBillForm({ ...billForm, gstAmount: e.target.value })} />
                <Input placeholder="COP / RA no." value={billForm.copNo} onChange={(e) => setBillForm({ ...billForm, copNo: e.target.value })} />
                <Input
                  className="sm:col-span-2 lg:col-span-3"
                  placeholder="Description"
                  value={billForm.description}
                  onChange={(e) => setBillForm({ ...billForm, description: e.target.value })}
                />
                <Button type="submit" className="sm:col-span-2 lg:col-span-3">
                  Add bill
                </Button>
              </form>
            </Card>
          )}
          <SheetTable
            title="COP / bill register"
            headers={["Bill no", "Vendor", "COP", "Amount", "GST", "Status", "Date"]}
            rows={(billsData?.bills || []).map((b: any) => [
              b.billNo,
              b.vendorName,
              b.copNo || "—",
              formatINR(b.amount),
              formatINR(b.gstAmount),
              b.status,
              new Date(b.billDate).toLocaleDateString("en-IN"),
            ])}
          />
        </div>
      )}

      {tab === "boq" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-2">Upload structure / BOQ</h3>
            <p className="text-xs text-steel-muted mb-3">
              Multiple structures per project — each upload creates monitoring lines under a package name (feeds MB totals).
            </p>
            {canEdit && (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!file) return;
                  const fd = new FormData();
                  fd.append("file", file);
                  fd.append("packageName", structureName || "Imported structure");
                  await api(`/api/cost/${id}/structure/import`, { method: "POST", token, body: fd });
                  setFile(null);
                  setMsg(`Imported structure: ${structureName}`);
                  await load();
                }}
              >
                <Input
                  placeholder="Structure / package name"
                  value={structureName}
                  onChange={(e) => setStructureName(e.target.value)}
                  required
                />
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <Button type="submit" disabled={!file}>
                  Upload BOQ for structure
                </Button>
              </form>
            )}
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">Import batches</h3>
            <ul className="text-sm space-y-2 max-h-72 overflow-y-auto">
              {summary.boqBatches.map((b: any) => (
                <li key={b.id} className="border border-line px-3 py-2 rounded-sm">
                  <div className="font-medium">{b.fileName}</div>
                  <div className="text-xs text-steel-muted">
                    {b.rowCount} rows · {new Date(b.createdAt).toLocaleString("en-IN")}
                  </div>
                </li>
              ))}
              {!summary.boqBatches.length && <li className="text-steel-muted">No imports yet.</li>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
