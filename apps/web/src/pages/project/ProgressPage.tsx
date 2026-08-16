import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { ReportExportButtons } from "../../components/ReportExportButtons";
import { downloadAuthFile } from "../../lib/downloadReport";
import { BarChart, PieChart } from "../../components/PieChart";

type Tab =
  | "overview"
  | "milestones"
  | "planned"
  | "monthly"
  | "hindrance"
  | "risk"
  | "legal"
  | "scurve"
  | "schedule"
  | "msproject"
  | "procurement";

const READY_TABS: Record<
  "schedule" | "procurement",
  { title: string; sheet: string; blurb: string }
> = {
  schedule: {
    title: "Summary schedule",
    sheet: "Project summary schedule",
    blurb: "Upload + in-app PDF viewer will land here when the client schedule pack is shared.",
  },
  procurement: {
    title: "Procurement plan",
    sheet: "Procurement plan",
    blurb: "Line items + PDF viewer reserved for the client procurement pack.",
  },
};

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

export default function ProgressPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [verify, setVerify] = useState<any>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [paBusy, setPaBusy] = useState<"import" | "xlsx" | "pdf" | null>(null);
  const paImportRef = useRef<HTMLInputElement>(null);
  const [msProject, setMsProject] = useState<any>(null);
  const [msBusy, setMsBusy] = useState<"seed" | "import" | "xml" | null>(null);
  const msImportRef = useRef<HTMLInputElement>(null);
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

  const loadMsProject = () => api(`/api/progress/${id}/ms-project/summary`, { token }).then(setMsProject);

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

  useEffect(() => {
    if (tab === "scurve" || tab === "msproject") void loadMsProject();
  }, [id, token, tab]);

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

  async function importPlannedActual(file: File) {
    if (!id) return;
    setPaBusy("import");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const out = await api<{ cashflow: number; manpower: number; activityLines: number }>(
        `/api/progress/${id}/planned-actual/import`,
        { method: "POST", token, body: fd }
      );
      setMsg(
        `Planned vs Actual imported — ${out.activityLines} activities · ${out.cashflow} cashflow rows · ${out.manpower} manpower trades`
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setPaBusy(null);
    }
  }

  async function downloadPlannedActual(fmt: "xlsx" | "pdf") {
    if (!id) return;
    setPaBusy(fmt);
    setMsg("");
    try {
      if (fmt === "xlsx") {
        await downloadAuthFile(`/api/progress/${id}/planned-actual/download.xlsx`, token, `Planned-Vs-Actual.xlsx`);
        setMsg("Planned vs Actual Excel downloaded — matches client dashboard layout.");
      } else {
        await downloadAuthFile(`/api/progress/${id}/planned-actual/download.html`, token, `Planned-Vs-Actual.html`);
        setMsg("Dashboard HTML downloaded — open and Print → Save as PDF.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Download failed");
    } finally {
      setPaBusy(null);
    }
  }

  async function seedMsProjectDemo() {
    if (!id || !canEdit) return;
    setMsBusy("seed");
    setMsg("");
    try {
      const out = await api<{ taskCount: number; scurvePoints: number; fileUrl: string }>(
        `/api/progress/${id}/ms-project/seed-demo`,
        { method: "POST", token, body: "{}" }
      );
      setMsg(
        `MS Project demo seeded — ${out.taskCount} tasks · ${out.scurvePoints} S-curve weeks · XML saved to OneDrive`
      );
      await Promise.all([load(), loadMsProject()]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "MS Project seed failed");
    } finally {
      setMsBusy(null);
    }
  }

  async function importMsProject(file: File) {
    if (!id || !canEdit) return;
    setMsBusy("import");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const out = await api<{ taskCount: number; scurvePoints: number }>(
        `/api/progress/${id}/ms-project/import`,
        { method: "POST", token, body: fd }
      );
      setMsg(`MS Project imported — ${out.taskCount} tasks · ${out.scurvePoints} S-curve points`);
      await Promise.all([load(), loadMsProject()]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "MS Project import failed");
    } finally {
      setMsBusy(null);
    }
  }

  async function downloadMsProjectXml() {
    if (!id) return;
    setMsBusy("xml");
    try {
      await downloadAuthFile(`/api/progress/${id}/ms-project/download.xml`, token, `MS-Project-Schedule.xml`);
      setMsg("MS Project XML downloaded — open in Microsoft Project or re-import after edits.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Download failed");
    } finally {
      setMsBusy(null);
    }
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
          subtitle="Workday-style KPIs on Overview. Switch sub-tools using the module tabs above."
          actions={
            <div className="flex flex-wrap gap-2 items-center">
              <Badge tone="brand">{pct(data.totals.projectProgressPct)} weighted</Badge>
              <ReportExportButtons projectId={id} kind="progress" compact />
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
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
              {(
                [
                  ["Milestones", data.charts?.milestoneByStatus, "milestones"],
                  ["Hindrance", data.charts?.hindranceByStatus, "hindrance"],
                  ["Risk", data.charts?.riskByStatus, "risk"],
                  ["Legal", data.charts?.legalByStatus, "legal"],
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
            <div className="grid sm:grid-cols-2 xl:grid-cols-2 gap-3 min-w-0">
              <div className="min-w-0"><PieChart title="Milestones by status" items={data.charts?.milestoneByStatus || []} size={150} /></div>
              <div className="min-w-0"><PieChart title="Hindrance by status" items={data.charts?.hindranceByStatus || []} size={150} /></div>
              <div className="min-w-0"><PieChart title="Risk by status" items={data.charts?.riskByStatus || []} size={150} /></div>
              <div className="min-w-0"><PieChart title="Legal by status" items={data.charts?.legalByStatus || []} size={150} /></div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 w-full">
            <BarChart
              title="Cashflow planned vs actual"
              items={data.charts?.cashflow || []}
              valueKey="planned"
              compareKey="actual"
            />
            <BarChart title="Hindrance by activity" items={data.charts?.hindranceByActivity || []} />
          </div>
          <div className="grid md:grid-cols-2 gap-4 w-full min-w-0">
            <Card className="min-w-0 overflow-hidden flex flex-col">
              <h3 className="font-semibold text-sm mb-3 shrink-0">Recent hindrances</h3>
              <div className="scroll-panel max-h-64 min-h-0 space-y-0 text-sm pr-1">
                {data.hindrances.slice(0, 8).map((h: any) => (
                  <div key={h.id} className="flex items-start gap-2 border-b border-line py-2 min-w-0">
                    <span className="min-w-0 flex-1 text-ink leading-snug break-words line-clamp-2" title={h.description}>
                      {h.description}
                    </span>
                    <span className="shrink-0 mt-0.5">
                      <Badge tone={h.status === "Open" ? "danger" : "ok"}>{h.status}</Badge>
                    </span>
                  </div>
                ))}
                {!data.hindrances?.length && <p className="text-steel-muted text-sm py-2">No hindrances seeded.</p>}
              </div>
            </Card>
            <Card className="min-w-0 overflow-hidden flex flex-col">
              <h3 className="font-semibold text-sm mb-3 shrink-0">Top risks by severity</h3>
              <div className="scroll-panel max-h-64 min-h-0 space-y-0 text-sm pr-1">
                {[...(data.risks || [])]
                  .sort((a: any, b: any) => Number(b.severity || 0) - Number(a.severity || 0))
                  .slice(0, 8)
                  .map((r: any) => (
                    <div key={r.id} className="flex items-start gap-2 border-b border-line py-2 min-w-0">
                      <span
                        className="min-w-0 flex-1 text-ink leading-snug break-words line-clamp-2"
                        title={r.code ? `${r.code} · ${r.name}` : r.name}
                      >
                        {r.code ? `${r.code} · ` : ""}
                        {r.name}
                      </span>
                      <span className="shrink-0 mt-0.5">
                        <Badge tone={Number(r.severity) >= 15 ? "danger" : "warn"}>Sev {r.severity}</Badge>
                      </span>
                    </div>
                  ))}
                {!data.risks?.length && <p className="text-steel-muted text-sm py-2">No risks seeded.</p>}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "milestones" && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <PieChart title="Milestones by status" items={data.charts?.milestoneByStatus || []} />
            <BarChart
              title="Avg % complete by phase"
              items={(data.charts?.milestoneByPhase || []).map((x: any) => ({
                label: x.label,
                value: Math.round((Number(x.value) || 0) * 100),
              }))}
            />
          </div>
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
          <Card className="!p-4 flex flex-wrap gap-3 items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Planned Vs. Actual Dashboard</div>
              <p className="text-xs text-steel-muted mt-1 max-w-xl">
                Import the client Excel pack to refresh cashflow, manpower, and the activity register. Export generates
                the same three sheets from live portal data — feeds DPR auto-fill on matching BOQ lines.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                ref={paImportRef}
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                disabled={!!paBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importPlannedActual(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!!paBusy}
                className="!text-xs"
                onClick={() => paImportRef.current?.click()}
              >
                {paBusy === "import" ? "Importing…" : "Import Excel"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="!text-xs"
                disabled={!!paBusy}
                onClick={() => void downloadPlannedActual("xlsx")}
              >
                {paBusy === "xlsx" ? "…" : "Export Excel"}
              </Button>
              <Button
                type="button"
                className="!text-xs"
                disabled={!!paBusy}
                onClick={() => void downloadPlannedActual("pdf")}
              >
                {paBusy === "pdf" ? "…" : "Export PDF"}
              </Button>
            </div>
          </Card>
          <div className="grid lg:grid-cols-2 gap-4 w-full">
            <BarChart
              title="Cashflow planned vs actual"
              items={data.charts?.cashflow || []}
              valueKey="planned"
              compareKey="actual"
            />
            <BarChart
              title="Manpower shortage %"
              items={(data.charts?.manpower || []).map((m: any) => ({
                label: m.label,
                value: (m.shortagePct || 0) * 100,
              }))}
            />
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
          <BarChart
            title="SOR / observation closure"
            items={data.charts?.sor || []}
            valueKey="closed"
            compareKey="open"
          />
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
          <div className="grid md:grid-cols-2 gap-3">
            <PieChart title="Hindrance by status" items={data.charts?.hindranceByStatus || []} />
            <BarChart title="Hindrance by critical activity" items={data.charts?.hindranceByActivity || []} />
          </div>
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
          <div className="grid md:grid-cols-2 gap-3">
            <PieChart title="Risk by status" items={data.charts?.riskByStatus || []} />
            <BarChart title="Risk by severity" items={data.charts?.riskBySeverity || []} />
          </div>
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
          <div className="grid md:grid-cols-2 gap-3">
            <PieChart title="Legal by status" items={data.charts?.legalByStatus || []} />
            <BarChart title="Legal approvals by status" items={data.charts?.legalByStatus || []} />
          </div>
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

      {tab === "scurve" && (
        <div className="space-y-4">
          <Card className="!p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand mb-1">Schedule S-curve</p>
                <h3 className="font-display text-xl text-ink">Planned vs actual — cumulative %</h3>
                <p className="text-sm text-steel-muted mt-1 max-w-2xl">
                  Built from MS Project task baseline + % complete. Same weekly rows feed DPR dashboard charts and WPR progress slides.
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={!!msBusy} onClick={() => void seedMsProjectDemo()}>
                    {msBusy === "seed" ? "Seeding…" : "Seed demo MS Project + S-curve"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={!!msBusy} onClick={() => msImportRef.current?.click()}>
                    {msBusy === "import" ? "Importing…" : "Import MS Project XML"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={!!msBusy} onClick={() => void downloadMsProjectXml()}>
                    {msBusy === "xml" ? "Downloading…" : "Download XML"}
                  </Button>
                  <input
                    ref={msImportRef}
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importMsProject(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </div>
            {msProject?.connected && msProject.scurve?.length ? (
              <>
                <ProgressScurveChart
                  points={msProject.scurve.map((p: { periodLabel: string; plannedPct: number; actualPct: number }) => ({
                    label: p.periodLabel,
                    planned: p.plannedPct,
                    actual: p.actualPct,
                  }))}
                />
                <p className="text-xs text-steel-muted mt-3">
                  {msProject.scurvePoints} weekly points · {msProject.taskCount} tasks · file:{" "}
                  <span className="font-mono">{msProject.fileFolder}/{msProject.fileName}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-steel-muted py-8 text-center border border-dashed border-line rounded-lg">
                No S-curve yet — click <strong>Seed demo MS Project + S-curve</strong> or import a client XML export from Microsoft Project.
              </p>
            )}
          </Card>
          <Card className="!p-4">
            <p className="text-xs font-semibold text-ink mb-2">Connection to DPR / WPR</p>
            <ul className="text-sm text-steel-muted space-y-1 list-disc pl-4">
              <li>MS Project → <code className="text-xs">ProgressPlannedActual</code> (S-curve weekly %)</li>
              <li>Tasks → <code className="text-xs">ProgressActivityLine</code> → DPR planned qty hints</li>
              <li>DPR Maker dashboard charts read published DPR history + BOQ progress</li>
              <li>WPR Maker progress section reads milestones + hindrance + quality</li>
            </ul>
          </Card>
        </div>
      )}

      {tab === "msproject" && (
        <div className="space-y-4">
          <Card className="!p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand mb-1">MS Project connectivity</p>
                <h3 className="font-display text-xl text-ink">Task register · % complete · baseline</h3>
                <p className="text-sm text-steel-muted mt-1 max-w-2xl">
                  Import <strong>File → Save As → XML</strong> from Microsoft Project (desktop or Project for the web). MPP binary is not supported — use XML export.
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={!!msBusy} onClick={() => void seedMsProjectDemo()}>
                    {msBusy === "seed" ? "Seeding…" : "Seed demo schedule file"}
                  </Button>
                  <Button type="button" variant="secondary" disabled={!!msBusy} onClick={() => msImportRef.current?.click()}>
                    Import XML
                  </Button>
                  <Button type="button" variant="secondary" disabled={!!msBusy} onClick={() => void downloadMsProjectXml()}>
                    Download XML
                  </Button>
                </div>
              )}
            </div>
            {msProject?.tasks?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-steel-muted border-b border-line">
                      <th className="py-2 pr-3">WBS</th>
                      <th className="py-2 pr-3">Activity</th>
                      <th className="py-2 pr-3">Plan start</th>
                      <th className="py-2 pr-3">Plan finish</th>
                      <th className="py-2 pr-3">Days</th>
                      <th className="py-2 px-3">% complete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {msProject.tasks.map((t: { wbs: string; name: string; start?: string; finish?: string; durationDays: number; percentComplete: number }, i: number) => (
                      <tr key={i} className="border-b border-line/60">
                        <td className="py-2 pr-3 font-mono text-xs">{t.wbs}</td>
                        <td className="py-2 pr-3 max-w-[280px]">{t.name}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(t.start)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(t.finish)}</td>
                        <td className="py-2 pr-3">{Math.round(t.durationDays)}</td>
                        <td className="py-2 px-3">
                          <Badge tone={t.percentComplete >= 100 ? "ok" : t.percentComplete > 0 ? "brand" : "warn"}>
                            {Math.round(t.percentComplete)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-steel-muted py-8 text-center border border-dashed border-line rounded-lg">
                No MS Project tasks — seed demo or import client XML to populate this register.
              </p>
            )}
          </Card>
        </div>
      )}

      {tab in READY_TABS && (
        <Card className="!p-6 max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand mb-2">Awaiting client sheet</p>
          <h3 className="font-display text-xl text-ink">{READY_TABS[tab as keyof typeof READY_TABS].title}</h3>
          <p className="text-sm text-steel-muted mt-2 leading-relaxed">
            {READY_TABS[tab as keyof typeof READY_TABS].blurb}
          </p>
          <p className="mt-4 text-xs font-mono text-steel-muted">
            Sheet → {READY_TABS[tab as keyof typeof READY_TABS].sheet}
          </p>
          <Link to={`/projects/${id}/hub/progress`} className="inline-block mt-5 text-sm font-semibold text-brand">
            ← Progress hub
          </Link>
        </Card>
      )}
    </div>
  );
}

function ProgressScurveChart({ points }: { points: { label: string; planned: number; actual: number }[] }) {
  if (!points.length) return null;
  const w = 640;
  const h = 220;
  const pad = 36;
  const maxY = Math.max(100, ...points.flatMap((p) => [p.planned, p.actual])) * 1.08;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const planned = points.map((p, i) => `${i ? "L" : "M"} ${pad + i * step} ${y(p.planned)}`).join(" ");
  const actual = points.map((p, i) => `${i ? "L" : "M"} ${pad + i * step} ${y(p.actual)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="S-curve planned vs actual">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--color-line,#d5dadd)" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="var(--color-line,#d5dadd)" />
        <path d={planned} fill="none" stroke="#2563EB" strokeWidth="2.5" />
        <path d={actual} fill="none" stroke="#0F766E" strokeWidth="2.5" />
        {[0, 25, 50, 75, 100].filter((v) => v <= maxY).map((v) => (
          <g key={v}>
            <line x1={pad - 4} y1={y(v)} x2={w - pad} y2={y(v)} stroke="var(--color-line,#e8eaed)" strokeDasharray="4 4" />
            <text x={8} y={y(v) + 4} fontSize="9" fill="var(--color-steel-muted,#5c6578)">{v}%</text>
          </g>
        ))}
      </svg>
      <div className="flex gap-4 text-[11px] text-steel-muted mt-2">
        <span><span className="inline-block w-3 h-0.5 bg-[#2563EB] align-middle mr-1" />Planned (baseline)</span>
        <span><span className="inline-block w-3 h-0.5 bg-[#0F766E] align-middle mr-1" />Actual (% complete)</span>
      </div>
    </div>
  );
}
