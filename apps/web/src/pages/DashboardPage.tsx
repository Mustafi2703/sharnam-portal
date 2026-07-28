import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHero } from "../components/ui";
import { WORKSPACE_PROJECT_KEY } from "../workspaces";

type Project = { id: string; code: string; name: string; status: string };
type Tab = "rfis" | "comms" | "logs" | "safety";

const TABS: { id: Tab; label: string }[] = [
  { id: "rfis", label: "RFIs" },
  { id: "comms", label: "Comms" },
  { id: "logs", label: "Checklist logs" },
  { id: "safety", label: "Safety" },
];

/** Parikh-style desk: hero + stat tiles, then tabs to address work; Modules for detail */
export default function DashboardPage() {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "rfis";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : "")
  );
  const [openRfis, setOpenRfis] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [safetyOpen, setSafetyOpen] = useState(0);
  const [busy, setBusy] = useState(true);

  const selected = projects.find((p) => p.id === projectId) || projects[0];
  const pid = selected?.id;
  const firstName = user?.fullName?.split(" ")[0] || "there";

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
      api<{ rfis: any[] } | any[]>(`/api/rfis/project/${pid}`, { token }).catch(() => ({ rfis: [] })),
      api(`/api/comms/meetings/${pid}`, { token }).catch(() => []),
      api<any[]>(`/api/checklist/project/${pid}/submissions`, { token }).catch(() => []),
      api<{ stats?: { open?: number } }>(`/api/safety/project/${pid}`, { token }).catch(() => null),
    ])
      .then(([r, m, l, s]) => {
        const list = Array.isArray(r) ? r : r.rfis || [];
        setOpenRfis(list.filter((x: any) => x.status === "Open" || x.status === "Draft"));
        setMeetings(Array.isArray(m) ? m.slice(0, 20) : []);
        setLogs(Array.isArray(l) ? l.slice(0, 20) : []);
        setSafetyOpen(s?.stats?.open ?? 0);
      })
      .finally(() => setBusy(false));
  }, [pid, token]);

  const stats = [
    { label: "Open RFIs", value: openRfis.length, color: "bg-rose-500", tab: "rfis" as Tab },
    { label: "Meetings", value: meetings.length, color: "bg-[#1e3a5f]", tab: "comms" as Tab },
    { label: "Checklist fills", value: logs.length, color: "bg-amber-500", tab: "logs" as Tab },
    { label: "Safety open", value: safetyOpen, color: "bg-orange-600", tab: "safety" as Tab },
  ];

  return (
    <div className="space-y-5">
      <PageHero
        title={`Welcome back, ${firstName}`}
        subtitle="Address open RFIs, Comms, and checklist logs here. Open Modules for full project detail."
        actions={
          <Link to="/workspace">
            <Button type="button" className="!bg-amber-500 hover:!bg-amber-600 !text-white">
              Modules →
            </Button>
          </Link>
        }
      />

      <Card className="!p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted block mb-2">Project</label>
        <select
          className="w-full max-w-md rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25"
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
      </Card>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <button key={s.label} type="button" className="stat-tile w-full text-left" onClick={() => setSearchParams({ tab: s.tab })}>
            <div className={`stat-tile__icon ${s.color}`}>{String(s.value).slice(0, 3)}</div>
            <div className="min-w-0">
              <p className="text-sm text-slate-500 truncate">{s.label}</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums">{s.value}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSearchParams({ tab: t.id })}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
              tab === t.id
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                : "bg-white border-line text-steel-muted hover:border-amber-400/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {busy && <p className="text-sm text-steel-muted">Loading…</p>}

      {tab === "rfis" && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line bg-slate-50 flex justify-between items-center">
            <span className="font-semibold text-sm">Open RFIs</span>
            {pid && (
              <Link to={`/projects/${pid}/rfis`} className="text-sm font-semibold text-amber-600 hover:text-amber-700">
                Open in module →
              </Link>
            )}
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {openRfis.map((r) => (
              <li key={r.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50/80">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-amber-600 mr-2">{r.number}</span>
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
              <Link to={`/projects/${pid}/comms`} className="text-sm font-semibold text-amber-600">
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
              <Link to={`/projects/${pid}/checklist-logs`} className="text-sm font-semibold text-amber-600">
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
                <Button type="button" className="!bg-amber-500 hover:!bg-amber-600">
                  Open Safety module
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
