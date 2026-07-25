import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHeader } from "../components/ui";
import { WORKSPACE_PROJECT_KEY } from "../workspaces";

type Project = { id: string; code: string; name: string; status: string };

type AlertBox = {
  tone: "danger" | "warn" | "brand";
  title: string;
  detail: string;
  to: string;
};

/** Post-login ops desk — open RFIs / issues / diary alerts, then go to modules */
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
        setDiaryHint(logs[0] ? `Latest day log ${new Date(logs[0].logDate || logs[0].createdAt || Date.now()).toLocaleDateString()}` : "No day log yet");
        setSafetyOpen(s?.stats?.open ?? 0);
      })
      .finally(() => setBusy(false));
  }, [pid, token]);

  const alerts: AlertBox[] = useMemo(() => {
    if (!pid) return [];
    const boxes: AlertBox[] = [];
    if (openRfis.length) {
      boxes.push({
        tone: "danger",
        title: `${openRfis.length} open RFI / request`,
        detail: openRfis
          .slice(0, 3)
          .map((r) => r.number)
          .join(" · "),
        to: `/projects/${pid}/rfis`,
      });
    }
    if (safetyOpen > 0) {
      boxes.push({
        tone: "warn",
        title: `${safetyOpen} open safety items`,
        detail: "Review Safety dashboard and Safety RFIs.",
        to: `/projects/${pid}/safety`,
      });
    }
    boxes.push({
      tone: "brand",
      title: "Day log",
      detail: diaryHint,
      to: `/projects/${pid}/diary`,
    });
    boxes.push({
      tone: "warn",
      title: "Quality · Request for Information",
      detail: "Raise or fill QI requests for this project.",
      to: `/projects/${pid}/rfis?kind=QualityInspection`,
    });
    boxes.push({
      tone: "danger",
      title: "Safety · Request for Information",
      detail: "Raise or fill Safety checklist RFIs.",
      to: `/projects/${pid}/rfis?kind=SafetyChecklist`,
    });
    return boxes;
  }, [pid, openRfis, safetyOpen, diaryHint]);

  const isClient = user?.role === "client";

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-0">
      <PageHeader
        eyebrow="Ops dashboard"
        title={`Hello, ${user?.fullName?.split(" ")[0] || "there"}`}
        subtitle="Open issues first — then choose a module. Pilot and UAT use one isolated project."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="brand">{user?.portal || user?.role}</Badge>
            <Link to="/workspace">
              <Button type="button">Select module →</Button>
            </Link>
            {(user?.role === "admin" || user?.role === "office") && (
              <Link to="/master">
                <Button type="button" variant="secondary">
                  Master
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <Card className="!p-4">
        <label className="text-sm font-semibold text-ink block mb-2">Active project</label>
        <select
          className="w-full max-w-lg rounded-[var(--ui-radius-sm,10px)] border border-line bg-white px-3 py-2.5 text-sm"
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

      {busy && <p className="text-sm text-steel-muted">Loading alerts…</p>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {alerts.map((a) => (
          <Link key={a.title} to={a.to} className="block group">
            <Card
              className={`h-full !p-5 border-l-4 transition group-hover:shadow-md ${
                a.tone === "danger"
                  ? "border-l-mark"
                  : a.tone === "warn"
                    ? "border-l-warn"
                    : "border-l-brand"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wider text-steel-muted mb-1">Alert</div>
              <div className="font-display text-lg font-semibold text-ink">{a.title}</div>
              <p className="text-sm text-steel-muted mt-2 leading-relaxed">{a.detail}</p>
              <div className="mt-4 text-sm font-semibold text-brand">Open →</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="!p-6 bg-brand-soft/40 border-brand/20">
        <h2 className="font-display text-xl font-semibold">Next: module selection</h2>
        <p className="text-sm text-steel-muted mt-2 max-w-2xl">
          {isClient
            ? "Open Modules for Drawings (view), concerns, and reports."
            : "Open Modules for Drawings, Quality, Safety, Progress, Field, Comms, Cost, and Reports. Master stays for Office setup."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/workspace">
            <Button type="button">Go to modules</Button>
          </Link>
          {pid && (
            <Link to={`/projects/${pid}`}>
              <Button type="button" variant="secondary">
                Project home
              </Button>
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
