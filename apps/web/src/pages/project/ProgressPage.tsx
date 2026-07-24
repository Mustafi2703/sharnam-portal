import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";

type Tab = "overview" | "milestones" | "planned" | "monthly" | "hindrance" | "risk" | "legal";

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function pct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

function inr(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

/** Simple dual/single bar chart from sheet-style series */
function BarChart({
  title,
  items,
  valueKey = "value",
  compareKey,
  maxBars = 10,
}: {
  title: string;
  items: any[];
  valueKey?: string;
  compareKey?: string;
  maxBars?: number;
}) {
  const rows = (items || []).slice(0, maxBars);
  const max = Math.max(
    1,
    ...rows.map((r) => Math.max(Number(r[valueKey]) || 0, compareKey ? Number(r[compareKey]) || 0 : 0))
  );
  return (
    <Card className="!p-4 h-full flex flex-col min-h-[140px]">
      <h3 className="text-sm font-semibold text-ink mb-3">{title}</h3>
      {!rows.length ? (
        <p className="text-sm text-steel-muted">No chart data.</p>
      ) : (
        <div className="space-y-2.5 flex-1">
          {rows.map((r) => {
            const a = Number(r[valueKey]) || 0;
            const b = compareKey ? Number(r[compareKey]) || 0 : 0;
            return (
              <div key={r.label} className="grid grid-cols-[110px_1fr_auto] gap-2 items-center text-xs">
                <div className="truncate text-steel-muted" title={r.label}>
                  {r.label}
                </div>
                <div className="space-y-1">
                  <div className="h-2 rounded-sm bg-line overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${(a / max) * 100}%` }} />
                  </div>
                  {compareKey != null && (
                    <div className="h-2 rounded-sm bg-line overflow-hidden">
                      <div className="h-full bg-mark/80" style={{ width: `${(b / max) * 100}%` }} />
                    </div>
                  )}
                </div>
                <div className="font-mono text-[11px] text-right whitespace-nowrap">
                  {compareKey != null ? `${Math.round(a)} / ${Math.round(b)}` : Number.isInteger(a) ? a : a.toFixed(2)}
                </div>
              </div>
            );
          })}
          {compareKey != null && (
            <div className="flex gap-3 text-[10px] uppercase tracking-wide text-steel-muted pt-1">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-brand inline-block rounded-sm" /> Planned / primary
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-mark/80 inline-block rounded-sm" /> Actual / compare
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ProgressPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [verify, setVerify] = useState<any>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const tab = (searchParams.get("tab") as Tab) || "overview";
  const canEdit =
    user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";
  const canVerify = user?.role === "admin" || user?.role === "office" || user?.role === "employee";

  const [hindranceForm, setHindranceForm] = useState({
    description: "",
    location: "",
    activity: "",
    category: "Design & Technical",
    type: "",
    occurredAt: "",
    daysImpacted: "",
    delayType: "Overlapping Delay",
    accountable: "",
    status: "Open",
  });
  const [riskForm, setRiskForm] = useState({
    code: "",
    name: "",
    category: "Execution",
    opportunityThreat: "Threat",
    probability: "3",
    consequence: "3",
    costImpact: "",
    description: "",
  });
  const [mileForm, setMileForm] = useState({
    code: "",
    category: "",
    activity: "",
    plannedStart: "",
    plannedEnd: "",
    plannedDays: "",
    actualDays: "",
    weightage: "",
    pctComplete: "",
    status: "In Progress",
  });
  const [legalForm, setLegalForm] = useState({
    approvalId: "",
    category: "Labour Compliance",
    authority: "",
    description: "",
    packageName: "",
    status: "Submitted",
    responsible: "Contractor",
  });

  const load = () => api(`/api/progress/${id}/summary`, { token }).then(setData);

  async function runVerify() {
    if (!canVerify) return;
    setVerifyBusy(true);
    try {
      const report = await api(`/api/progress/${id}/verify`, { token });
      setVerify(report);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setVerifyBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    if (canVerify && tab === "overview") void runVerify();
  }, [id, token, canVerify, tab]);

  const setTab = (t: Tab) => {
    if (t === "overview") setSearchParams({});
    else setSearchParams({ tab: t });
  };

  const tabs: { key: Tab; label: string }[] = useMemo(
    () => [
      { key: "overview", label: "Dashboard" },
      { key: "milestones", label: "Milestones" },
      { key: "planned", label: "Planned vs Actual" },
      { key: "monthly", label: "Monthly progress" },
      { key: "hindrance", label: "Hindrance" },
      { key: "risk", label: "Risk" },
      { key: "legal", label: "Legal approvals" },
    ],
    []
  );

  if (!data) return <div className="text-steel-muted py-10">Loading progress sheets…</div>;

  async function addHindrance(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api(`/api/progress/${id}/hindrances`, {
      method: "POST",
      token,
      body: JSON.stringify({
        ...hindranceForm,
        daysImpacted: Number(hindranceForm.daysImpacted || 0),
        occurredAt: hindranceForm.occurredAt || undefined,
      }),
    });
    setHindranceForm({
      description: "",
      location: "",
      activity: "",
      category: "Design & Technical",
      type: "",
      occurredAt: "",
      daysImpacted: "",
      delayType: "Overlapping Delay",
      accountable: "",
      status: "Open",
    });
    setMsg("Hindrance logged");
    await load();
  }

  async function addRisk(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api(`/api/progress/${id}/risks`, {
      method: "POST",
      token,
      body: JSON.stringify({
        ...riskForm,
        probability: Number(riskForm.probability),
        consequence: Number(riskForm.consequence),
        costImpact: Number(riskForm.costImpact || 0),
      }),
    });
    setRiskForm({
      code: "",
      name: "",
      category: "Execution",
      opportunityThreat: "Threat",
      probability: "3",
      consequence: "3",
      costImpact: "",
      description: "",
    });
    setMsg("Risk added");
    await load();
  }

  async function addMilestone(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api(`/api/progress/${id}/milestones`, {
      method: "POST",
      token,
      body: JSON.stringify({
        ...mileForm,
        plannedDays: Number(mileForm.plannedDays || 0),
        actualDays: Number(mileForm.actualDays || 0),
        weightage: Number(mileForm.weightage || 0),
        pctComplete: Number(mileForm.pctComplete || 0) > 1 ? Number(mileForm.pctComplete) / 100 : Number(mileForm.pctComplete || 0),
      }),
    });
    setMileForm({
      code: "",
      category: "",
      activity: "",
      plannedStart: "",
      plannedEnd: "",
      plannedDays: "",
      actualDays: "",
      weightage: "",
      pctComplete: "",
      status: "In Progress",
    });
    setMsg("Milestone added");
    await load();
  }

  async function addLegal(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    await api(`/api/progress/${id}/legal`, { method: "POST", token, body: JSON.stringify(legalForm) });
    setLegalForm({
      approvalId: "",
      category: "Labour Compliance",
      authority: "",
      description: "",
      packageName: "",
      status: "Submitted",
      responsible: "Contractor",
    });
    setMsg("Legal approval row added");
    await load();
  }

  return (
    <div className="space-y-5 w-full min-w-0">
      <div className="w-full">
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project
        </Link>
        <PageHeader
          eyebrow="Progress module"
          title="Progress"
          subtitle="One tool at a time — use the sub-tool chips above for Overview, Milestones, Hindrance, Risk, and more. Calm Workday-style KPIs on Overview."
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              <Badge tone="brand">{pct(data.totals.projectProgressPct)} weighted</Badge>
              {canVerify && (
                <Button type="button" variant="secondary" disabled={verifyBusy} onClick={() => void runVerify()}>
                  {verifyBusy ? "Verifying…" : "Verify vs Excel"}
                </Button>
              )}
            </div>
          }
        />
      </div>

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      {verify && (
        <Card className={`!p-4 border ${verify.ok ? "border-ok/40" : "border-danger/40"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-steel-muted">Backend vs Excel packs</div>
              <div className="font-semibold mt-0.5">
                {verify.ok ? "All tracked Progress data matches source sheets" : "Mismatches found — check failed rows"}
              </div>
            </div>
            <Badge tone={verify.ok ? "ok" : "danger"}>
              {verify.summary.passed}/{verify.summary.total} passed
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-steel-muted border-b border-line">
                  <th className="py-2 pr-3">Check</th>
                  <th className="py-2 pr-3">Expected (Excel)</th>
                  <th className="py-2 pr-3">Actual (DB)</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {verify.checks.map((c: any) => (
                  <tr key={c.key} className="border-b border-line/60">
                    <td className="py-1.5 pr-3">{c.label}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{String(c.expected)}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{String(c.actual)}</td>
                    <td className="py-1.5">
                      <Badge tone={c.ok ? "ok" : "danger"}>{c.ok ? "OK" : "Fail"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 w-full">
        {[
          ["Milestones", data.totals.milestones],
          ["Delayed", data.totals.delayed],
          ["Open hindrance", data.totals.openHindrance],
          ["Open risks", data.totals.openRisk],
          ["Legal approved", `${data.totals.legalApproved}/${data.totals.legal}`],
        ].map(([label, val]) => (
          <Card key={label as string} className="!p-4">
            <div className="text-[10px] uppercase tracking-wider text-steel-muted">{label}</div>
            <div className="text-2xl font-display mt-1">{val as string | number}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-sm px-4 py-2 text-sm font-medium border transition ${
              tab === t.key ? "bg-brand text-white border-brand" : "bg-white border-line text-ink hover:border-brand/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4 w-full">
          <div className="rounded-sm border border-line bg-paper p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ok">Workday overview</p>
                <h3 className="font-display text-lg text-ink">Key registers at a glance</h3>
              </div>
              <Link to={`/projects/${id}/hub/progress`} className="text-sm font-semibold text-brand">
                All Progress tools →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {(
                [
                  ["Milestones", data.charts.milestoneByStatus, "milestones"],
                  ["Hindrance", data.charts.hindranceByStatus, "hindrance"],
                  ["Risk", data.charts.riskByStatus, "risk"],
                  ["Legal", data.charts.legalByStatus, "legal"],
                ] as const
              ).map(([title, items, tabKey]) => {
                const rows = items || [];
                const total = rows.reduce((s: number, r: any) => s + (Number(r.value) || 0), 0);
                const open = rows.find((r: any) => /open|active|pending/i.test(String(r.label || "")));
                return (
                  <Link
                    key={title}
                    to={`/projects/${id}/progress?tab=${tabKey}`}
                    className="block rounded-sm border border-line bg-sand/50 p-4 hover:border-brand/40 transition"
                  >
                    <div className="text-[11px] font-mono uppercase tracking-wider text-steel-muted">{title}</div>
                    <div className="mt-2 text-2xl font-display text-ink">{total}</div>
                    <div className="text-xs text-steel-muted mt-1">
                      {open ? `${open.label}: ${open.value}` : "Open tool →"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 w-full">
            <Card>
              <h3 className="font-semibold text-sm mb-3">Recent hindrances</h3>
              <div className="scroll-panel max-h-64 space-y-2 text-sm">
                {data.hindrances.slice(0, 8).map((h: any) => (
                  <div key={h.id} className="flex justify-between gap-2 border-b border-line py-2">
                    <span className="truncate">{h.description}</span>
                    <Badge tone={h.status === "Open" ? "danger" : "ok"}>{h.status}</Badge>
                  </div>
                ))}
                {!data.hindrances?.length && <p className="text-steel-muted text-sm">No hindrances seeded.</p>}
              </div>
            </Card>
            <Card>
              <h3 className="font-semibold text-sm mb-3">Top risks by severity</h3>
              <div className="scroll-panel max-h-64 space-y-2 text-sm">
                {data.risks.slice(0, 8).map((r: any) => (
                  <div key={r.id} className="flex justify-between gap-2 border-b border-line py-2">
                    <span className="truncate">
                      {r.code ? `${r.code} · ` : ""}
                      {r.name}
                    </span>
                    <span className="font-mono text-xs">Sev {r.severity}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "milestones" && (
        <div className="space-y-4">
          {canEdit && (
            <Card>
              <h3 className="font-semibold text-sm mb-3">Add milestone</h3>
              <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={addMilestone}>
                <Input placeholder="Code (M11)" value={mileForm.code} onChange={(e) => setMileForm({ ...mileForm, code: e.target.value })} />
                <Input placeholder="Phase" value={mileForm.category} onChange={(e) => setMileForm({ ...mileForm, category: e.target.value })} />
                <Input
                  className="sm:col-span-2"
                  placeholder="Milestone name"
                  value={mileForm.activity}
                  onChange={(e) => setMileForm({ ...mileForm, activity: e.target.value })}
                  required
                />
                <Input type="date" value={mileForm.plannedStart} onChange={(e) => setMileForm({ ...mileForm, plannedStart: e.target.value })} />
                <Input type="date" value={mileForm.plannedEnd} onChange={(e) => setMileForm({ ...mileForm, plannedEnd: e.target.value })} />
                <Input placeholder="Plan days" value={mileForm.plannedDays} onChange={(e) => setMileForm({ ...mileForm, plannedDays: e.target.value })} />
                <Input placeholder="Actual days" value={mileForm.actualDays} onChange={(e) => setMileForm({ ...mileForm, actualDays: e.target.value })} />
                <Input placeholder="Weightage" value={mileForm.weightage} onChange={(e) => setMileForm({ ...mileForm, weightage: e.target.value })} />
                <Input placeholder="% complete 0–1" value={mileForm.pctComplete} onChange={(e) => setMileForm({ ...mileForm, pctComplete: e.target.value })} />
                <Select value={mileForm.status} onChange={(e) => setMileForm({ ...mileForm, status: e.target.value })}>
                  {["Completed", "Delayed", "In Progress", "Not Started"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Button type="submit">Save milestone</Button>
              </form>
            </Card>
          )}
          <Card className="overflow-x-auto !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold">Milestone register · sheet columns</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line bg-white">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 pr-3">Phase</th>
                  <th className="py-2.5 pr-3">Name</th>
                  <th className="py-2.5 pr-3">Plan start</th>
                  <th className="py-2.5 pr-3">Plan end</th>
                  <th className="py-2.5 pr-3">P/A days</th>
                  <th className="py-2.5 pr-3">Var</th>
                  <th className="py-2.5 pr-3">Wt</th>
                  <th className="py-2.5 pr-3">%</th>
                  <th className="py-2.5 pr-3">Stakeholder</th>
                  <th className="py-2.5 pr-3">Zone</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.milestones.map((m: any) => (
                  <tr key={m.id} className="border-b border-line/70 hover:bg-sand/40">
                    <td className="py-2 px-3 font-mono text-xs">{m.code || "—"}</td>
                    <td className="py-2 pr-3">{m.category || "—"}</td>
                    <td className="py-2 pr-3 font-medium">{m.activity}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(m.plannedStart)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(m.plannedEnd)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {m.plannedDays}/{m.actualDays}
                    </td>
                    <td className="py-2 pr-3">{m.varianceDays}</td>
                    <td className="py-2 pr-3">{m.weightage}</td>
                    <td className="py-2 pr-3">{pct(m.pctComplete)}</td>
                    <td className="py-2 pr-3">{m.stakeholder || "—"}</td>
                    <td className="py-2 pr-3">{m.zone || "—"}</td>
                    <td className="py-2 px-3">
                      <Badge tone={/delay/i.test(m.status) ? "danger" : /complete/i.test(m.status) ? "ok" : "warn"}>{m.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "planned" && (
        <div className="space-y-4 w-full">
          <div className="grid lg:grid-cols-2 gap-4 w-full">
            <BarChart title="Cashflow planned vs actual" items={data.charts.cashflow} valueKey="planned" compareKey="actual" />
            <BarChart title="Manpower shortage %" items={data.charts.manpower.map((m: any) => ({ label: m.label, value: (m.shortagePct || 0) * 100 }))} />
          </div>
          <Card className="overflow-x-auto !p-0 w-full">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold">Project cashflow · Planned Vs Actual</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">Month</th>
                  <th className="py-2.5 pr-3">RA</th>
                  <th className="py-2.5 pr-3">Planned</th>
                  <th className="py-2.5 pr-3">Actual</th>
                  <th className="py-2.5 px-3">%</th>
                </tr>
              </thead>
              <tbody>
                {data.plannedActual.map((p: any) => (
                  <tr key={p.id} className="border-b border-line/70">
                    <td className="py-2 px-3 font-medium">{p.periodLabel}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{p.packageName}</td>
                    <td className="py-2 pr-3">{inr(p.plannedAmount)}</td>
                    <td className="py-2 pr-3">{inr(p.actualAmount)}</td>
                    <td className="py-2 px-3">{pct(p.actualPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="overflow-x-auto !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold">Weekly manpower</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">Trade</th>
                  <th className="py-2.5 pr-3">Required</th>
                  <th className="py-2.5 pr-3">Available</th>
                  <th className="py-2.5 pr-3">Shortage</th>
                  <th className="py-2.5 px-3">% shortage</th>
                </tr>
              </thead>
              <tbody>
                {data.manpower.map((m: any) => (
                  <tr key={m.id} className="border-b border-line/70">
                    <td className="py-2 px-3">{m.trade}</td>
                    <td className="py-2 pr-3">{m.required}</td>
                    <td className="py-2 pr-3">{m.available}</td>
                    <td className="py-2 pr-3">{m.shortage}</td>
                    <td className="py-2 px-3">{pct(m.shortagePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="overflow-x-auto !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold">
              Planned vs Actual quantity register ({data.activityLines.length} lines)
            </div>
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 pr-3">Tower</th>
                  <th className="py-2.5 pr-3">Activity</th>
                  <th className="py-2.5 pr-3">Unit</th>
                  <th className="py-2.5 pr-3">Plan start</th>
                  <th className="py-2.5 pr-3">Plan end</th>
                  <th className="py-2.5 pr-3">BOQ</th>
                  <th className="py-2.5 pr-3">GFC</th>
                  <th className="py-2.5 pr-3">Executed</th>
                  <th className="py-2.5 pr-3">Balance</th>
                  <th className="py-2.5 pr-3">Wk plan</th>
                  <th className="py-2.5 pr-3">Wk act</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.activityLines.map((a: any) => (
                  <tr key={a.id} className="border-b border-line/70">
                    <td className="py-2 px-3 font-mono text-xs">{a.srNo}</td>
                    <td className="py-2 pr-3">{a.tower || "—"}</td>
                    <td className="py-2 pr-3">{a.activity}</td>
                    <td className="py-2 pr-3">{a.unit || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(a.plannedStart)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(a.plannedEnd)}</td>
                    <td className="py-2 pr-3">{a.boqQty}</td>
                    <td className="py-2 pr-3">{a.gfcQty}</td>
                    <td className="py-2 pr-3">{Number(a.executedQty).toFixed(2)}</td>
                    <td className="py-2 pr-3">{Number(a.balanceQty).toFixed(2)}</td>
                    <td className="py-2 pr-3">{a.weeklyPlanned}</td>
                    <td className="py-2 pr-3">{a.weeklyActual}</td>
                    <td className="py-2 px-3">{a.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "monthly" && (
        <div className="space-y-4">
          <BarChart title="SOR / observation closure" items={data.charts.sor} valueKey="closed" compareKey="open" />
          <Card className="overflow-x-auto !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold">Monthly Progress · SOR Log</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">Observation</th>
                  <th className="py-2.5 pr-3">Total</th>
                  <th className="py-2.5 pr-3">Open</th>
                  <th className="py-2.5 pr-3">Closed</th>
                  <th className="py-2.5 px-3">Closure rate</th>
                </tr>
              </thead>
              <tbody>
                {data.sorStats.map((s: any) => (
                  <tr key={s.id} className="border-b border-line/70">
                    <td className="py-2 px-3 font-medium">{s.observation}</td>
                    <td className="py-2 pr-3">{s.total}</td>
                    <td className="py-2 pr-3">{s.openCount}</td>
                    <td className="py-2 pr-3">{s.closedCount}</td>
                    <td className="py-2 px-3">{pct(s.closureRate)}</td>
                  </tr>
                ))}
                {!data.sorStats.length && (
                  <tr>
                    <td colSpan={5} className="py-6 px-3 text-steel-muted">
                      No monthly SOR rows — re-seed from Monthly Progress Dashboard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "hindrance" && (
        <div className="space-y-4">
          <BarChart title="Hindrance by critical activity" items={data.charts.hindranceByActivity} />
          {canEdit && (
            <Card>
              <h3 className="font-semibold text-sm mb-3">Log hindrance</h3>
              <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={addHindrance}>
                <Input
                  className="sm:col-span-2"
                  placeholder="Description"
                  value={hindranceForm.description}
                  onChange={(e) => setHindranceForm({ ...hindranceForm, description: e.target.value })}
                  required
                />
                <Input placeholder="Location" value={hindranceForm.location} onChange={(e) => setHindranceForm({ ...hindranceForm, location: e.target.value })} />
                <Input placeholder="Activity affected" value={hindranceForm.activity} onChange={(e) => setHindranceForm({ ...hindranceForm, activity: e.target.value })} />
                <Select value={hindranceForm.category} onChange={(e) => setHindranceForm({ ...hindranceForm, category: e.target.value })}>
                  {["Design & Technical", "Approval", "Execution", "Material Procurement", "Client"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </Select>
                <Input placeholder="Type of hindrance" value={hindranceForm.type} onChange={(e) => setHindranceForm({ ...hindranceForm, type: e.target.value })} />
                <Input type="date" value={hindranceForm.occurredAt} onChange={(e) => setHindranceForm({ ...hindranceForm, occurredAt: e.target.value })} />
                <Input placeholder="Days impacted" value={hindranceForm.daysImpacted} onChange={(e) => setHindranceForm({ ...hindranceForm, daysImpacted: e.target.value })} />
                <Select value={hindranceForm.delayType} onChange={(e) => setHindranceForm({ ...hindranceForm, delayType: e.target.value })}>
                  <option>Overlapping Delay</option>
                  <option>Non-overlapping Delay</option>
                </Select>
                <Input placeholder="Accountable" value={hindranceForm.accountable} onChange={(e) => setHindranceForm({ ...hindranceForm, accountable: e.target.value })} />
                <Select value={hindranceForm.status} onChange={(e) => setHindranceForm({ ...hindranceForm, status: e.target.value })}>
                  <option>Open</option>
                  <option>Resolved</option>
                </Select>
                <Button type="submit">Add to register</Button>
              </form>
            </Card>
          )}
          <Card className="overflow-x-auto !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold">Hindrance register</div>
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 pr-3">Location</th>
                  <th className="py-2.5 pr-3">Activity</th>
                  <th className="py-2.5 pr-3">Category</th>
                  <th className="py-2.5 pr-3">Type</th>
                  <th className="py-2.5 pr-3">Occurred</th>
                  <th className="py-2.5 pr-3">Resolved</th>
                  <th className="py-2.5 pr-3">Days</th>
                  <th className="py-2.5 pr-3">Delay type</th>
                  <th className="py-2.5 pr-3">Accountable</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.hindrances.map((h: any) => (
                  <tr key={h.id} className="border-b border-line/70">
                    <td className="py-2 px-3 max-w-[220px] truncate" title={h.description}>
                      {h.description}
                    </td>
                    <td className="py-2 pr-3">{h.location || "—"}</td>
                    <td className="py-2 pr-3">{h.activity || "—"}</td>
                    <td className="py-2 pr-3">{h.category || "—"}</td>
                    <td className="py-2 pr-3 max-w-[160px] truncate">{h.type || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(h.occurredAt)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(h.resolvedAt)}</td>
                    <td className="py-2 pr-3">{h.daysImpacted}</td>
                    <td className="py-2 pr-3">{h.delayType || "—"}</td>
                    <td className="py-2 pr-3">{h.accountable || "—"}</td>
                    <td className="py-2 px-3">
                      <Badge tone={h.status === "Open" ? "danger" : "ok"}>{h.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "risk" && (
        <div className="space-y-4">
          <BarChart title="Risk by status" items={data.charts.riskByStatus} />
          {canEdit && (
            <Card>
              <h3 className="font-semibold text-sm mb-3">Identify risk</h3>
              <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={addRisk}>
                <Input placeholder="Code (R11)" value={riskForm.code} onChange={(e) => setRiskForm({ ...riskForm, code: e.target.value })} />
                <Input placeholder="Name" value={riskForm.name} onChange={(e) => setRiskForm({ ...riskForm, name: e.target.value })} required />
                <Select value={riskForm.category} onChange={(e) => setRiskForm({ ...riskForm, category: e.target.value })}>
                  {["Execution", "Planning/ Scope", "Communications", "Schedule", "Estimating", "Controlling"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <Select value={riskForm.opportunityThreat} onChange={(e) => setRiskForm({ ...riskForm, opportunityThreat: e.target.value })}>
                  <option>Threat</option>
                  <option>Opportunity</option>
                  <option>Both</option>
                </Select>
                <Input type="number" min={1} max={5} placeholder="Probability 1–5" value={riskForm.probability} onChange={(e) => setRiskForm({ ...riskForm, probability: e.target.value })} />
                <Input type="number" min={1} max={5} placeholder="Consequence 1–5" value={riskForm.consequence} onChange={(e) => setRiskForm({ ...riskForm, consequence: e.target.value })} />
                <Input placeholder="Cost impact ₹" value={riskForm.costImpact} onChange={(e) => setRiskForm({ ...riskForm, costImpact: e.target.value })} />
                <TextArea
                  className="sm:col-span-2 lg:col-span-3"
                  rows={2}
                  placeholder="Detailed description"
                  value={riskForm.description}
                  onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })}
                />
                <Button type="submit">Add risk</Button>
              </form>
            </Card>
          )}
          <Card className="overflow-x-auto !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold">Risk register</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 pr-3">Category</th>
                  <th className="py-2.5 pr-3">O/T</th>
                  <th className="py-2.5 pr-3">Name</th>
                  <th className="py-2.5 pr-3">P</th>
                  <th className="py-2.5 pr-3">C</th>
                  <th className="py-2.5 pr-3">Severity</th>
                  <th className="py-2.5 pr-3">Cost</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.risks.map((r: any) => (
                  <tr key={r.id} className="border-b border-line/70">
                    <td className="py-2 px-3 font-mono text-xs">{r.code || "—"}</td>
                    <td className="py-2 pr-3">{r.category || "—"}</td>
                    <td className="py-2 pr-3">{r.opportunityThreat}</td>
                    <td className="py-2 pr-3 max-w-xs">
                      <div className="font-medium">{r.name}</div>
                      {r.description && <div className="text-xs text-steel-muted line-clamp-2 mt-0.5">{r.description}</div>}
                    </td>
                    <td className="py-2 pr-3">{r.probability}</td>
                    <td className="py-2 pr-3">{r.consequence}</td>
                    <td className="py-2 pr-3 font-semibold">{r.severity}</td>
                    <td className="py-2 pr-3">{inr(r.costImpact)}</td>
                    <td className="py-2 px-3">
                      <Badge tone={r.status === "Open" ? "danger" : "ok"}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "legal" && (
        <div className="space-y-4">
          <BarChart title="Legal approvals by status" items={data.charts.legalByStatus} />
          {canEdit && (
            <Card>
              <h3 className="font-semibold text-sm mb-3">Add legal approval</h3>
              <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={addLegal}>
                <Input placeholder="Approval ID (LA-31)" value={legalForm.approvalId} onChange={(e) => setLegalForm({ ...legalForm, approvalId: e.target.value })} />
                <Input placeholder="Category" value={legalForm.category} onChange={(e) => setLegalForm({ ...legalForm, category: e.target.value })} />
                <Input placeholder="Authority" value={legalForm.authority} onChange={(e) => setLegalForm({ ...legalForm, authority: e.target.value })} />
                <Input
                  className="sm:col-span-2"
                  placeholder="Description"
                  value={legalForm.description}
                  onChange={(e) => setLegalForm({ ...legalForm, description: e.target.value })}
                  required
                />
                <Input placeholder="Package / building" value={legalForm.packageName} onChange={(e) => setLegalForm({ ...legalForm, packageName: e.target.value })} />
                <Select value={legalForm.status} onChange={(e) => setLegalForm({ ...legalForm, status: e.target.value })}>
                  {["Approved", "Submitted", "Delayed", "In Progress", "Not Submitted"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Input placeholder="Responsible" value={legalForm.responsible} onChange={(e) => setLegalForm({ ...legalForm, responsible: e.target.value })} />
                <Button type="submit">Add row</Button>
              </form>
            </Card>
          )}
          <Card className="overflow-x-auto !p-0">
            <div className="px-4 py-3 border-b border-line bg-sand/50 text-sm font-semibold">Legal Approval Tracker</div>
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 pr-3">Category</th>
                  <th className="py-2.5 pr-3">Authority</th>
                  <th className="py-2.5 pr-3">Description</th>
                  <th className="py-2.5 pr-3">Package</th>
                  <th className="py-2.5 pr-3">Submitted</th>
                  <th className="py-2.5 pr-3">Required</th>
                  <th className="py-2.5 pr-3">Received</th>
                  <th className="py-2.5 pr-3">Delay</th>
                  <th className="py-2.5 pr-3">Responsible</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.legalApprovals.map((l: any) => (
                  <tr key={l.id} className="border-b border-line/70">
                    <td className="py-2 px-3 font-mono text-xs">{l.approvalId}</td>
                    <td className="py-2 pr-3">{l.category || "—"}</td>
                    <td className="py-2 pr-3">{l.authority || "—"}</td>
                    <td className="py-2 pr-3 max-w-[240px]">{l.description}</td>
                    <td className="py-2 pr-3">{l.packageName || "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(l.submissionDate)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(l.requiredBy)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(l.receivedDate)}</td>
                    <td className="py-2 pr-3">{l.delayDays}</td>
                    <td className="py-2 pr-3">{l.responsible || "—"}</td>
                    <td className="py-2 px-3">
                      <Badge tone={/approved/i.test(l.status) ? "ok" : /delay/i.test(l.status) ? "danger" : "warn"}>{l.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
