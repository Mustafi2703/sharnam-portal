import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHero } from "../components/ui";
import { PieChart } from "../components/PieChart";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ModuleIcon, type ModuleIconKey } from "../components/icons";
import { WORKSPACE_PROJECT_KEY } from "../workspaces";

type Project = { id: string; code: string; name: string; status: string };
type Tab = "rfis" | "comms" | "logs" | "safety" | "analytics";

const TABS: { id: Tab; label: string; icon: ModuleIconKey }[] = [
  { id: "analytics", label: "Analytics", icon: "reports" },
  { id: "rfis", label: "RFIs", icon: "comms" },
  { id: "comms", label: "Comms", icon: "comms" },
  { id: "logs", label: "Checklist logs", icon: "quality" },
  { id: "safety", label: "Safety", icon: "safety" },
];

/** Workday-style analytics desk + action tabs; branded Excel/PDF exports */
export default function DashboardPage() {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "analytics";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : "")
  );
  const [analytics, setAnalytics] = useState<any>(null);
  const [openRfis, setOpenRfis] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [safetyOpen, setSafetyOpen] = useState(0);
  const [busy, setBusy] = useState(true);

  const selected = projects.find((p) => p.id === projectId) || projects[0];
  const pid = selected?.id;
  const firstName = user?.fullName?.split(" ")[0] || "there";
  const kpis = analytics?.kpis;

  useEffect(() => {
    api<Project[]>("/api/projects", { token })
      .then((list) => {
        setProjects(list);
        const stored = localStorage.getItem(WORKSPACE_PROJECT_KEY);
        if (stored && list.some((p) => p.id === stored)) setProjectId(stored);
        else if (list[0]) {
          setProjectId(list[0].id);
          localStorage.setItem(WORKSPACE_PROJECT_KEY, list[0].id);
        }
      })
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!pid) {
      setBusy(false);
      return;
    }
    setBusy(true);
    localStorage.setItem(WORKSPACE_PROJECT_KEY, pid);
    Promise.all([
      api<any>(`/api/reports/analytics/${pid}/pack`, { token }).catch(() => null),
      api<{ rfis: any[] } | any[]>(`/api/rfis/project/${pid}`, { token }).catch(() => ({ rfis: [] })),
      api(`/api/comms/meetings/${pid}`, { token }).catch(() => []),
      api<any[]>(`/api/checklist/project/${pid}/submissions`, { token }).catch(() => []),
      api<{ stats?: { open?: number } }>(`/api/safety/project/${pid}`, { token }).catch(() => null),
    ])
      .then(([a, r, m, l, s]) => {
        setAnalytics(a);
        const list = Array.isArray(r) ? r : (r as any)?.rfis || [];
        setOpenRfis(list.filter((x: any) => x.status === "Open" || x.status === "Draft"));
        setMeetings(Array.isArray(m) ? m.slice(0, 20) : []);
        setLogs(Array.isArray(l) ? l.slice(0, 20) : []);
        setSafetyOpen(s?.stats?.open ?? a?.kpis?.openSafety ?? 0);
      })
      .finally(() => setBusy(false));
  }, [pid, token]);

  const stats = [
    { label: "Open RFIs", value: kpis?.openRfis ?? openRfis.length, color: "bg-rose-500", tab: "rfis" as Tab, icon: "comms" as ModuleIconKey },
    { label: "Meetings", value: kpis?.meetings ?? meetings.length, color: "bg-[#126e82]", tab: "comms" as Tab, icon: "comms" as ModuleIconKey },
    { label: "Checklist fills", value: kpis?.checklistFills ?? logs.length, color: "bg-brand", tab: "logs" as Tab, icon: "quality" as ModuleIconKey },
    { label: "Safety open", value: kpis?.openSafety ?? safetyOpen, color: "bg-rose-600", tab: "safety" as Tab, icon: "safety" as ModuleIconKey },
    { label: "Published GFC", value: kpis?.publishedDrawings ?? 0, color: "bg-slate-700", tab: "analytics" as Tab, icon: "drawings" as ModuleIconKey },
    { label: "Delayed MS", value: kpis?.delayedMilestones ?? 0, color: "bg-amber-700", tab: "analytics" as Tab, icon: "progress" as ModuleIconKey },
  ];

  return (
    <div className="space-y-5">
      <PageHero
        title={`Analytics · ${firstName}`}
        subtitle="Workday-style project KPIs with live referenced data. Download branded Excel or PDF packs for clients."
        icon={<ModuleIcon name="dashboard" size={22} className="text-white" />}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <ReportExportButtons projectId={pid} kind="analytics" label="Full pack" />
            <Link to="/workspace">
              <Button type="button" variant="secondary" className="!bg-white/15 !text-white !border-white/30">
                Modules →
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="!p-4 flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div className="flex-1 min-w-0">
          <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted block mb-2">Project</label>
          <select
            className="w-full max-w-md rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            value={pid || ""}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {!projects.length && <option value="">No projects</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-steel-muted max-w-sm">
          Shareable client packs include the Sharnam logo. PDF = open HTML → Print → Save as PDF.
        </p>
      </Card>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {stats.map((s) => (
          <button key={s.label} type="button" className="stat-tile w-full text-left" onClick={() => setSearchParams({ tab: s.tab })}>
            <div className={`stat-tile__icon ${s.color}`}>
              <ModuleIcon name={s.icon} size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-steel-muted truncate">{s.label}</p>
              <p className="text-xl font-bold text-ink tabular-nums">{s.value}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSearchParams({ tab: t.id })}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold border transition ${
                tab === t.id
                  ? "bg-brand text-white border-brand"
                  : "bg-paper border-line text-steel-muted hover:border-brand/50"
              }`}
            >
              <ModuleIcon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>
        {tab === "rfis" && <ReportExportButtons projectId={pid} kind="rfis" compact />}
        {tab === "comms" && <ReportExportButtons projectId={pid} kind="comms" compact />}
        {tab === "logs" && <ReportExportButtons projectId={pid} kind="quality" compact />}
        {tab === "safety" && <ReportExportButtons projectId={pid} kind="safety" compact />}
      </div>

      {busy && <p className="text-sm text-steel-muted">Loading…</p>}

      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            <PieChart title="RFIs by status" items={analytics?.charts?.rfiByStatus || []} />
            <PieChart title="Safety by status" items={analytics?.charts?.safetyByStatus || []} />
            <PieChart title="Drawings publish" items={analytics?.charts?.drawingPublish || []} />
            <PieChart title="Milestones" items={analytics?.charts?.milestoneStatus || []} />
          </div>
          <Card className="!p-4">
            <div className="flex flex-wrap justify-between gap-3 items-start">
              <div>
                <h3 className="font-display text-lg text-ink">Client-ready analytics</h3>
                <p className="text-sm text-steel-muted mt-1 max-w-xl">
                  Full workbook includes Cover, KPIs, RFIs, Meetings, Checklist fills, Safety, Drawings, Milestones, and
                  Hindrances — all live referenced data with Sharnam branding.
                </p>
              </div>
              <ReportExportButtons projectId={pid} kind="analytics" label="Download" />
            </div>
          </Card>
        </div>
      )}

      {tab === "rfis" && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line bg-slate-50 flex justify-between items-center gap-2">
            <span className="font-semibold text-sm">Open RFIs</span>
            {pid && (
              <Link to={`/projects/${pid}/rfis`} className="text-sm font-semibold text-brand hover:text-brand-dark">
                Open in module →
              </Link>
            )}
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {openRfis.map((r) => (
              <li key={r.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/80">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-brand mr-2">{r.number}</span>
                  <span className="text-ink">{r.subject || r.title || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="danger">{r.status}</Badge>
                  {pid && (
                    <Link to={`/projects/${pid}/rfis`}>
                      <Button type="button" variant="secondary" className="!text-xs !py-1.5">
                        Address
                      </Button>
                    </Link>
                  )}
                </div>
              </li>
            ))}
            {!openRfis.length && !busy && <li className="px-4 py-8 text-center text-steel-muted">No open RFIs.</li>}
          </ul>
        </Card>
      )}

      {tab === "comms" && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line bg-slate-50 flex justify-between items-center">
            <span className="font-semibold text-sm">Meetings / MoM</span>
            {pid && (
              <Link to={`/projects/${pid}/comms`} className="text-sm font-semibold text-brand">
                Open Comms →
              </Link>
            )}
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {meetings.map((m: any) => (
              <li key={m.id} className="px-4 py-3 flex justify-between gap-2 hover:bg-slate-50/80">
                <span>{m.title || m.subject || "Meeting"}</span>
                <span className="text-steel-muted text-xs">
                  {m.meetingDate ? new Date(m.meetingDate).toLocaleDateString() : m.status || "—"}
                </span>
              </li>
            ))}
            {!meetings.length && !busy && <li className="px-4 py-8 text-center text-steel-muted">No meetings yet.</li>}
          </ul>
        </Card>
      )}

      {tab === "logs" && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line bg-slate-50 flex justify-between items-center">
            <span className="font-semibold text-sm">Recent checklist fills</span>
            {pid && (
              <Link to={`/projects/${pid}/checklist-logs`} className="text-sm font-semibold text-brand">
                Full log →
              </Link>
            )}
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {logs.map((s: any) => (
              <li key={s.id} className="px-4 py-3 flex flex-wrap justify-between gap-2 hover:bg-slate-50/80">
                <div>
                  <div className="font-medium">{s.assignment?.template?.name || "Checklist"}</div>
                  <div className="text-xs text-steel-muted">
                    {s.assignment?.template?.checklistType} · {s.submittedBy?.fullName || "—"}
                  </div>
                </div>
                <span className="text-xs text-steel-muted">{new Date(s.createdAt).toLocaleString()}</span>
              </li>
            ))}
            {!logs.length && !busy && <li className="px-4 py-8 text-center text-steel-muted">No fills logged yet.</li>}
          </ul>
        </Card>
      )}

      {tab === "safety" && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-500">Open safety items</div>
              <div className="text-3xl font-bold text-slate-800 mt-1 tabular-nums">{safetyOpen}</div>
            </div>
            {pid && (
              <Link to={`/projects/${pid}/safety`}>
                <Button type="button">Open Safety module</Button>
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
