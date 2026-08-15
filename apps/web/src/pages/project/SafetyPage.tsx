import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { ReportExportButtons } from "../../components/ReportExportButtons";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";

const TYPES = ["Observation", "Near Miss", "Incident", "Toolbox Talk", "JHA", "NCR"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

export default function SafetyPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const ncrView = searchParams.get("view") === "ncr";
  const { token, user } = useAuth();
  const [data, setData] = useState<{ records: any[]; stats: any } | null>(null);
  const [dash, setDash] = useState<any>(null);
  const [filter, setFilter] = useState(ncrView ? "NCR" : "All");
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState({
    recordType: ncrView ? "NCR" : "Observation",
    title: "",
    description: "",
    severity: "Low",
    location: "",
    correctiveAction: "",
  });
  const [msg, setMsg] = useState("");
  const canCreate = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");
  const canClose = user?.role === "admin" || user?.role === "office" || user?.role === "site_employee";

  useEffect(() => {
    if (ncrView) {
      setFilter("NCR");
      setForm((f) => ({ ...f, recordType: "NCR" }));
    }
  }, [ncrView]);

  const load = async () => {
    const [res, d] = await Promise.all([
      api<{ records: any[]; stats: any }>(`/api/safety/project/${id}`, { token }),
      api(`/api/checklist/project/${id}/safety-dashboard`, { token }).catch(() => null),
    ]);
    setData(res);
    setDash(d);
    if (!active && res.records[0]) setActive(res.records[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = useMemo(() => {
    const rows = data?.records || [];
    if (ncrView) {
      return rows.filter((r) => /ncr/i.test(r.recordType || "") || /ncr/i.test(r.title || ""));
    }
    if (filter === "All") return rows;
    if (filter === "Open" || filter === "Closed") return rows.filter((r) => r.status === filter);
    return rows.filter((r) => r.recordType === filter);
  }, [data, filter, ncrView]);

  const selected = data?.records.find((r) => r.id === active);

  async function createRecord(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const row = await api<any>(`/api/safety/project/${id}`, {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setForm({
        recordType: ncrView ? "NCR" : "Observation",
        title: "",
        description: "",
        severity: "Low",
        location: "",
        correctiveAction: "",
      });
      setActive(row.id);
      setMsg("Safety record logged.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Safety module"
        title={ncrView ? "Safety NCR register" : "Safety dashboard & register"}
        subtitle={
          ncrView
            ? "Safety NCR sheet as a separate tool — log and close non-conformance records."
            : "Log observations / incidents. Create Safety checklists in Checklist master, raise SafetyChecklist RFI with checklist attached for the assignee to fill (3 photos)."
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="warn">{dash?.totals?.open ?? data?.stats.open ?? 0} open</Badge>
            <Badge tone="danger">{dash?.totals?.incidents ?? data?.stats.incidents ?? 0} incidents</Badge>
            <Badge tone="brand">{dash?.totals?.checklistFills ?? 0} checklist fills</Badge>
            <ReportExportButtons projectId={id} kind="safety" compact />
            <Link to={`/projects/${id}/checklist-logs?family=Safety`} className="text-sm font-semibold text-brand">
              Fill log & progress →
            </Link>
            <Link to={`/projects/${id}/checklist-master?family=Safety`} className="text-sm font-semibold text-brand">
              Safety checklists →
            </Link>
            <Link to={`/projects/${id}/rfis?kind=SafetyChecklist`} className="text-sm font-semibold text-brand">
              Raise fill RFI →
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setSearchParams({});
            setFilter("All");
          }}
          className={`rounded-sm px-3 py-1.5 text-sm font-medium border ${
            !ncrView ? "bg-brand text-white border-brand" : "bg-paper border-line text-ink"
          }`}
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchParams({ view: "ncr" });
            setFilter("NCR");
          }}
          className={`rounded-sm px-3 py-1.5 text-sm font-medium border ${
            ncrView ? "bg-brand text-white border-brand" : "bg-paper border-line text-ink"
          }`}
        >
          Safety NCR
        </button>
        <Link
          to={`/projects/${id}/hub/safety`}
          className="rounded-sm px-3 py-1.5 text-sm font-medium border border-line text-steel-muted"
        >
          Safety hub →
        </Link>
      </div>

      {!ncrView && dash && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Records", dash.totals.records],
              ["Open", dash.totals.open],
              ["Checklist fills", dash.totals.checklistFills],
              ["Open fill RFIs", dash.totals.openFillRfis],
            ].map(([l, v]) => (
              <Card key={l as string} className="!p-4">
                <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
                <div className="text-2xl font-display mt-1">{v as number}</div>
              </Card>
            ))}
          </div>
          <div className="rounded-sm border border-line bg-gradient-to-br from-[#F7F8FA] to-white p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted mb-3">Workday-style safety dashboard</p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <PieChart title="By record type" items={dash.charts?.byType || []} />
              <PieChart title="By severity" items={dash.charts?.bySeverity || []} />
              <PieChart title="By status" items={dash.charts?.byStatus || []} />
            </div>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2">{msg}</p>}

      {canCreate && (
        <Card>
          <h3 className="font-semibold mb-3">Log safety record</h3>
          <form className="grid sm:grid-cols-2 gap-3" onSubmit={createRecord}>
            <Select value={form.recordType} onChange={(e) => setForm({ ...form, recordType: e.target.value })}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input
              className="sm:col-span-2"
              required
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input placeholder="Location / grid" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input
              placeholder="Corrective action"
              value={form.correctiveAction}
              onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
            />
            <TextArea
              className="sm:col-span-2"
              rows={3}
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Button type="submit" className="sm:col-span-2">
              Save safety record
            </Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-1">
        {["All", "Open", "Closed", ...TYPES].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-xs font-medium border ${
              filter === f ? "bg-procore-navy text-white border-procore-navy" : "bg-white border-line"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b bg-sand/50 font-semibold text-sm">Safety log</div>
          <ul className="divide-y max-h-[60vh] overflow-y-auto">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`w-full text-left px-4 py-3 ${active === r.id ? "bg-brand-soft" : "hover:bg-sand/40"}`}
                onClick={() => setActive(r.id)}
              >
                <div className="flex justify-between gap-2">
                  <span className="text-[11px] font-mono text-brand">{r.recordType}</span>
                  <Badge tone={r.status === "Open" ? "warn" : "ok"}>{r.status}</Badge>
                </div>
                <div className="font-medium text-sm mt-1">{r.title}</div>
                <div className="text-[11px] text-steel-muted mt-1">
                  {r.severity} · {new Date(r.occurredAt).toLocaleDateString()}
                </div>
              </button>
            ))}
            {!filtered.length && <li className="p-4 text-sm text-steel-muted">No records.</li>}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-sm text-steel-muted">Select a safety record</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge tone="brand">{selected.recordType}</Badge>
                  <Badge tone={selected.status === "Open" ? "warn" : "ok"}>{selected.status}</Badge>
                  <Badge
                    tone={
                      selected.severity === "Critical" || selected.severity === "High" ? "danger" : "neutral"
                    }
                  >
                    {selected.severity}
                  </Badge>
                </div>
                <h2 className="text-xl font-semibold">{selected.title}</h2>
                <p className="text-sm text-steel-muted mt-1">
                  Reported by {selected.reportedBy?.fullName} · {new Date(selected.occurredAt).toLocaleString()}
                  {selected.location ? ` · ${selected.location}` : ""}
                </p>
              </div>
              {selected.description && (
                <div className="rounded-lg bg-sand/50 p-3 text-sm whitespace-pre-wrap">{selected.description}</div>
              )}
              {selected.correctiveAction && (
                <div>
                  <div className="text-xs font-mono uppercase text-steel-muted mb-1">Corrective action</div>
                  <p className="text-sm">{selected.correctiveAction}</p>
                </div>
              )}
              {canClose && selected.status === "Open" && (
                <Button
                  type="button"
                  variant="dark"
                  onClick={async () => {
                    await api(`/api/safety/${selected.id}`, {
                      method: "PATCH",
                      token,
                      body: JSON.stringify({ status: "Closed" }),
                    });
                    await load();
                  }}
                >
                  Close record
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
