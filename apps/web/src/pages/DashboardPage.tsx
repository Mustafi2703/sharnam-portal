import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHero } from "../components/ui";
import { WORKSPACE_PROJECT_KEY } from "../workspaces";

type Project = { id: string; code: string; name: string; status: string };

/** Workday / SAP-style ops dashboard — alerts, KPI tiles, CSS charts, then modules */
export default function DashboardPage() {
  const { user, token } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_PROJECT_KEY) || "" : "")
  );
  const [openRfis, setOpenRfis] = useState<any[]>([]);
  const [diaryHint, setDiaryHint] = useState("");
  const [safetyOpen, setSafetyOpen] = useState(0);
  const [busy, setBusy] = useState(true);

  const selected = projects.find((p) => p.id === projectId) || projects[0];
  const pid = selected?.id;

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
      api(`/api/diary/project/${pid}`, { token }).catch(() => null),
      api<{ stats?: { open?: number } }>(`/api/safety/project/${pid}`, { token }).catch(() => null),
    ])
      .then(([r, d, s]) => {
        const list = Array.isArray(r) ? r : r.rfis || [];
        setOpenRfis(list.filter((x: any) => x.status === "Open" || x.status === "Draft"));
        const logs = Array.isArray(d) ? d : (d as any)?.logs || (d as any)?.entries || [];
        setDiaryHint(
          logs[0]
            ? `Latest day log ${new Date(logs[0].logDate || logs[0].createdAt || Date.now()).toLocaleDateString()}`
            : "No day log yet"
        );
        setSafetyOpen(s?.stats?.open ?? 0);
      })
      .finally(() => setBusy(false));
  }, [pid, token]);

  const rfiPct = Math.min(100, openRfis.length * 12 + 8);
  const safetyPct = Math.min(100, safetyOpen * 15 + 10);
  const health = Math.max(12, 100 - openRfis.length * 8 - safetyOpen * 6);

  const stats = useMemo(
    () => [
      { label: "Open RFIs", value: openRfis.length, tone: "danger" as const, to: pid ? `/projects/${pid}/rfis` : "/workspace" },
      { label: "Safety open", value: safetyOpen, tone: "warn" as const, to: pid ? `/projects/${pid}/safety` : "/workspace" },
      { label: "Project health", value: `${health}%`, tone: "ok" as const, to: "/workspace" },
      { label: "Day log", value: diaryHint.includes("No") ? "—" : "Live", tone: "brand" as const, to: pid ? `/projects/${pid}/diary` : "/workspace" },
    ],
    [openRfis.length, safetyOpen, health, diaryHint, pid]
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHero
        title={`Hello, ${user?.fullName?.split(" ")[0] || "there"}`}
        subtitle="Modern SAP / Workday-style ops desk — review open work, then switch into a module."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{user?.portal || user?.role}</Badge>
            <Link to="/workspace">
              <Button type="button" className="!bg-amber-500 !text-white hover:!bg-amber-600">
                Switch module →
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="!p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted block mb-2">Active project</label>
        <select
          className="w-full max-w-lg rounded-xl border border-line bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400/40 outline-none"
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

      {busy && <p className="text-sm text-steel-muted">Loading workspace metrics…</p>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="block">
            <div className="sap-stat h-full hover:border-amber-300 transition">
              <div className="text-[10px] uppercase tracking-wider text-steel-muted font-semibold">{s.label}</div>
              <div className="text-2xl font-display mt-2 tabular-nums">{s.value}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold text-ink mb-4">Workload mix</h3>
          <div className="flex items-center gap-6">
            <div className="sap-donut shrink-0" style={{ ["--pct" as string]: `${health}%` }} />
            <ul className="space-y-3 text-sm flex-1">
              <li>
                <div className="flex justify-between mb-1">
                  <span>Open RFIs pressure</span>
                  <span className="tabular-nums text-steel-muted">{rfiPct}%</span>
                </div>
                <div className="sap-bar-track">
                  <div className="sap-bar-fill" style={{ width: `${rfiPct}%` }} />
                </div>
              </li>
              <li>
                <div className="flex justify-between mb-1">
                  <span>Safety attention</span>
                  <span className="tabular-nums text-steel-muted">{safetyPct}%</span>
                </div>
                <div className="sap-bar-track">
                  <div className="sap-bar-fill" style={{ width: `${safetyPct}%`, background: "linear-gradient(90deg,#dc2626,#f59e0b)" }} />
                </div>
              </li>
            </ul>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-ink mb-3">Quick actions</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {[
              { label: "Select module", to: "/workspace", primary: true },
              { label: "Quality Ask", to: pid ? `/projects/${pid}/rfis?kind=QualityInspection` : "/workspace" },
              { label: "Safety Ask", to: pid ? `/projects/${pid}/rfis?kind=SafetyChecklist` : "/workspace" },
              { label: "Checklist logs", to: pid ? `/projects/${pid}/checklist-logs` : "/workspace" },
              { label: "Master", to: "/master", hide: user?.role !== "admin" && user?.role !== "office" },
              { label: "Module access", to: "/roles", hide: user?.role !== "admin" },
            ]
              .filter((a) => !a.hide)
              .map((a) => (
                <Link key={a.label} to={a.to}>
                  <Button type="button" variant={a.primary ? "primary" : "secondary"} className="w-full !justify-start">
                    {a.label}
                  </Button>
                </Link>
              ))}
          </div>
          <p className="text-xs text-steel-muted mt-4">{diaryHint}</p>
        </Card>
      </div>

      {!!openRfis.length && (
        <Card padding={false}>
          <div className="px-5 py-3 border-b border-line bg-slate-50 font-semibold text-sm">Open RFIs</div>
          <ul className="divide-y divide-line text-sm">
            {openRfis.slice(0, 6).map((r) => (
              <li key={r.id} className="px-5 py-3 flex justify-between gap-3">
                <span className="font-mono text-xs text-brand">{r.number}</span>
                <span className="truncate text-steel-muted">{r.subject || r.title || "—"}</span>
                <Badge tone="danger">{r.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
