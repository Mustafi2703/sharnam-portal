import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { OfficeClockInCard } from "../components/OfficeClockInCard";
import { Badge, Card } from "../components/ui";
import { ReportExportButtons } from "../components/ReportExportButtons";
import { ModuleIcon, type ModuleIconKey } from "../components/icons";
import { WORKSPACE_PROJECT_KEY } from "../workspaces";

type PortfolioProject = {
  id: string;
  code: string;
  name: string;
  status: string;
  location?: string | null;
  clientName?: string | null;
  openInfoRfis: number;
  openInspections: number;
  openFillRequests: number;
  upcomingMeetings: number;
  nextMeeting: { title: string; at: string } | null;
  openNcrs: number;
  openSafety: number;
  drawingsTotal: number;
  drawingsGfc: number;
};

const INFO_KINDS = ["RequestForInformation", "Manual", "ClientConcern"];
const INSPECTION_KINDS = ["QualityIR", "SafetyIR", "ActivityInspection"];
const DONE = ["Closed", "Approved", "Rejected", "Cancelled", "Withdrawn"];

/** Where each dashboard number opens. */
const LINKS = {
  info: (id: string) => `/projects/${id}/rfis?kind=RequestForInformation`,
  infoOne: (id: string, rfi: string) => `/projects/${id}/rfis?kind=RequestForInformation&rfi=${rfi}`,
  inspections: (id: string) => `/projects/${id}/inspection-register`,
  inspectionOne: (id: string, kind: string) =>
    `/projects/${id}/inspection-register?tab=${kind === "SafetyIR" ? "safety-ir" : kind === "ActivityInspection" ? "activity" : "quality-ir"}`,
  fills: (id: string) => `/projects/${id}/rfis`,
  meetings: (id: string) => `/projects/${id}/comms?tab=agenda`,
  ncr: (id: string) => `/projects/${id}/inspections?sheet=car-register`,
  safety: (id: string) => `/projects/${id}/safety`,
  drawings: (id: string) => `/projects/${id}/drawings/register`,
  project: (id: string) => `/projects/${id}`,
};

const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";
const fmtDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const daysOpen = (d?: string) => (d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000)) : 0);

function CountLink({ to, value, tone = "neutral" }: { to: string; value: number; tone?: "warn" | "danger" | "ok" | "neutral" }) {
  const cls =
    value === 0
      ? "text-steel-muted"
      : tone === "danger"
        ? "text-red-700 bg-red-50 border-red-200"
        : tone === "warn"
          ? "text-amber-800 bg-amber-50 border-amber-200"
          : tone === "ok"
            ? "text-emerald-800 bg-emerald-50 border-emerald-200"
            : "text-ink bg-sand/50 border-line";
  return (
    <Link to={to} className={`inline-flex min-w-[2.25rem] justify-center rounded-md border px-2 py-0.5 font-semibold tabular-nums hover:ring-2 hover:ring-brand/30 ${value === 0 ? "border-transparent" : cls}`}>
      {value}
    </Link>
  );
}

function Tile({ label, value, hint, icon, to }: { label: string; value: number | string; hint: string; icon: ModuleIconKey; to?: string }) {
  const body = (
    <div className="stat-tile w-full text-left h-full">
      <div className="stat-tile__icon bg-[#1E3A5F]">
        <ModuleIcon name={icon} size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-steel-muted leading-snug">{label}</p>
        <p className="text-2xl font-bold text-ink tabular-nums leading-tight">{value}</p>
        <p className="text-[11px] text-steel-muted leading-snug">{hint}</p>
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * Portal dashboard: every project the person can open, with the numbers that need action
 * (information RFIs and inspections kept separate), then the selected project's lists.
 */
export default function DashboardPage() {
  const { user, token } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState(() => {
    try {
      return localStorage.getItem(WORKSPACE_PROJECT_KEY) || "";
    } catch {
      return "";
    }
  });
  const [detail, setDetail] = useState<{ rfis: any[]; meetings: any[]; dues: any } | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const firstName = user?.fullName?.split(" ")[0] || "there";
  const readOnly = user?.role === "client";

  useEffect(() => {
    setLoading(true);
    api<{ projects: PortfolioProject[] }>("/api/reports/portfolio", { token })
      .then((out) => {
        setPortfolio(out.projects);
        setProjectId((cur) => (out.projects.some((p) => p.id === cur) ? cur : out.projects[0]?.id || ""));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your projects"))
      .finally(() => setLoading(false));
  }, [token]);

  const selected = portfolio.find((p) => p.id === projectId);

  useEffect(() => {
    if (!projectId) return;
    try {
      localStorage.setItem(WORKSPACE_PROJECT_KEY, projectId);
    } catch {
      /* ignore */
    }
    setDetailBusy(true);
    Promise.all([
      api<{ rfis: any[] } | any[]>(`/api/rfis/project/${projectId}`, { token }).catch(() => []),
      api<any[]>(`/api/comms/meetings/${projectId}`, { token }).catch(() => []),
      api<any>(`/api/reports/${projectId}/due-dates`, { token }).catch(() => null),
    ])
      .then(([r, m, d]) => {
        const list = Array.isArray(r) ? r : r?.rfis || [];
        setDetail({ rfis: list, meetings: Array.isArray(m) ? m : [], dues: d });
      })
      .finally(() => setDetailBusy(false));
  }, [projectId, token]);

  const totals = useMemo(
    () =>
      portfolio.reduce(
        (t, p) => ({
          info: t.info + p.openInfoRfis,
          insp: t.insp + p.openInspections,
          fills: t.fills + p.openFillRequests,
          meet: t.meet + p.upcomingMeetings,
          ncr: t.ncr + p.openNcrs,
          safety: t.safety + p.openSafety,
        }),
        { info: 0, insp: 0, fills: 0, meet: 0, ncr: 0, safety: 0 },
      ),
    [portfolio],
  );

  const openInfo = (detail?.rfis || []).filter((r) => INFO_KINDS.includes(r.rfiKind || "RequestForInformation") && !DONE.includes(r.status));
  const openInsp = (detail?.rfis || []).filter((r) => INSPECTION_KINDS.includes(r.rfiKind) && !DONE.includes(r.status));
  const upcoming = (detail?.meetings || [])
    .filter((m) => m.meetingDate && new Date(m.meetingDate).getTime() >= Date.now() - 12 * 3600_000 && m.status !== "Cancelled")
    .sort((a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime());
  const recentMeetings = (detail?.meetings || [])
    .filter((m) => m.meetingDate && new Date(m.meetingDate).getTime() < Date.now() - 12 * 3600_000)
    .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
    .slice(0, 3);

  if (user?.role === "vendor") return <Navigate to="/vendor-desk" replace />;

  return (
    <div className="space-y-5">
      {!readOnly && <OfficeClockInCard />}

      <div className="rounded-2xl bg-[linear-gradient(120deg,#1E3A5F,#0F766E)] text-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] opacity-80">Sharnam portal · {portfolio.length} project{portfolio.length === 1 ? "" : "s"}</p>
            <h1 className="font-display text-2xl mt-1">Hello {firstName}</h1>
            <p className="text-sm opacity-85 mt-1">What needs attention across your projects. Every number opens the register behind it.</p>
          </div>
          {selected && !readOnly ? <ReportExportButtons projectId={selected.id} kind="analytics" label={`${selected.code} pack`} /> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Tile label="Open RFIs — information" value={totals.info} hint="Questions awaiting an answer" icon="comms" to={selected ? LINKS.info(selected.id) : undefined} />
        <Tile label="Open inspections" value={totals.insp} hint="Quality / safety / activity IR" icon="quality" to={selected ? LINKS.inspections(selected.id) : undefined} />
        <Tile label="Checklist requests" value={totals.fills} hint="Fills asked for, not done" icon="quality" to={selected ? LINKS.fills(selected.id) : undefined} />
        <Tile label="Upcoming meetings" value={totals.meet} hint="Scheduled from today" icon="comms" to={selected ? LINKS.meetings(selected.id) : undefined} />
        <Tile label="Open NCR / CAR" value={totals.ncr} hint="Non-conformances open" icon="quality" to={selected ? LINKS.ncr(selected.id) : undefined} />
        <Tile label="Open safety items" value={totals.safety} hint="Observations / incidents open" icon="safety" to={selected ? LINKS.safety(selected.id) : undefined} />
      </div>

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-sm">All Projects</span>
          <span className="text-[11px] text-steel-muted">Click a project to see its lists below · click a number to open the register</span>
        </div>
        {error ? <p className="p-4 text-sm text-red-700">{error}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-steel-muted">
              <tr>
                <th className="p-3">Project</th>
                <th className="text-center">RFIs (info)</th>
                <th className="text-center">Inspections</th>
                <th className="text-center">Checklist requests</th>
                <th>Next meeting</th>
                <th className="text-center">NCR / CAR</th>
                <th className="text-center">Safety</th>
                <th className="text-center">GFC drawings</th>
                <th className="pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((p) => {
                const on = p.id === projectId;
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-line cursor-pointer ${on ? "bg-brand-soft/60" : "hover:bg-sand/30"}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a")) return;
                      setProjectId(p.id);
                    }}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${on ? "bg-brand" : "bg-line"}`} />
                        <span className="font-mono text-xs text-brand">{p.code}</span>
                        <span className="font-semibold">{p.name}</span>
                      </div>
                      <div className="text-[11px] text-steel-muted ml-4">
                        {[p.clientName, p.location].filter(Boolean).join(" · ") || "—"} · <Badge tone="neutral">{p.status}</Badge>
                      </div>
                    </td>
                    <td className="text-center"><CountLink to={LINKS.info(p.id)} value={p.openInfoRfis} tone="warn" /></td>
                    <td className="text-center"><CountLink to={LINKS.inspections(p.id)} value={p.openInspections} tone="warn" /></td>
                    <td className="text-center"><CountLink to={LINKS.fills(p.id)} value={p.openFillRequests} /></td>
                    <td>
                      {p.nextMeeting ? (
                        <Link to={LINKS.meetings(p.id)} className="text-xs hover:underline">
                          <span className="font-semibold">{fmtDateTime(p.nextMeeting.at)}</span>
                          <span className="block text-steel-muted truncate max-w-[200px]">{p.nextMeeting.title}</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-steel-muted">None scheduled</span>
                      )}
                    </td>
                    <td className="text-center"><CountLink to={LINKS.ncr(p.id)} value={p.openNcrs} tone="danger" /></td>
                    <td className="text-center"><CountLink to={LINKS.safety(p.id)} value={p.openSafety} tone="danger" /></td>
                    <td className="text-center text-xs">
                      <Link to={LINKS.drawings(p.id)} className="hover:underline">
                        <span className="font-semibold">{p.drawingsGfc}</span>
                        <span className="text-steel-muted"> / {p.drawingsTotal}</span>
                      </Link>
                    </td>
                    <td className="pr-3 text-right">
                      <Link to={LINKS.project(p.id)} className="text-xs font-semibold text-brand whitespace-nowrap">
                        Open project →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!portfolio.length && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-steel-muted">
                    {loading ? "Loading your projects…" : "You are not on any project yet. Ask the Sharnam office to add you."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg">
              <span className="font-mono text-sm text-brand mr-2">{selected.code}</span>
              {selected.name}
            </h2>
            {detailBusy ? <span className="text-xs text-steel-muted">Refreshing…</span> : null}
          </div>
          <div className="grid lg:grid-cols-3 gap-4 items-start">
            <Card padding={false}>
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <span className="font-semibold text-sm">Open RFIs — Information</span>
                <Link to={LINKS.info(selected.id)} className="text-xs font-semibold text-brand">Register →</Link>
              </div>
              <ul className="divide-y divide-line max-h-80 overflow-y-auto">
                {openInfo.slice(0, 12).map((r) => (
                  <li key={r.id}>
                    <Link to={LINKS.infoOne(selected.id, r.id)} className="block px-4 py-2.5 hover:bg-sand/30">
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="font-mono text-brand">{r.number}</span>
                        <span className={daysOpen(r.createdAt) > 7 ? "text-red-700 font-semibold" : "text-steel-muted"}>{daysOpen(r.createdAt)} days open</span>
                      </div>
                      <div className="text-sm font-medium truncate">{r.subject}</div>
                      <div className="text-[11px] text-steel-muted">
                        With: {r.ballInCourt || "—"}
                        {r.assignedTo?.fullName ? ` · ${r.assignedTo.fullName}` : ""}
                      </div>
                    </Link>
                  </li>
                ))}
                {!openInfo.length && <li className="px-4 py-4 text-sm text-steel-muted">No open information RFIs.</li>}
              </ul>
            </Card>

            <Card padding={false}>
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <span className="font-semibold text-sm">Open Inspection Requests</span>
                <Link to={LINKS.inspections(selected.id)} className="text-xs font-semibold text-brand">Register →</Link>
              </div>
              <ul className="divide-y divide-line max-h-80 overflow-y-auto">
                {openInsp.slice(0, 12).map((r) => (
                  <li key={r.id}>
                    <Link to={LINKS.inspectionOne(selected.id, r.rfiKind)} className="block px-4 py-2.5 hover:bg-sand/30">
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="font-mono text-brand">{r.number}</span>
                        <Badge tone="neutral">{r.rfiKind === "SafetyIR" ? "Safety" : r.rfiKind === "ActivityInspection" ? "Activity" : "Quality"}</Badge>
                      </div>
                      <div className="text-sm font-medium truncate">{r.subject}</div>
                      <div className="text-[11px] text-steel-muted">
                        {r.status} · raised {fmtDate(r.createdAt)}
                      </div>
                    </Link>
                  </li>
                ))}
                {!openInsp.length && <li className="px-4 py-4 text-sm text-steel-muted">No open inspection requests.</li>}
              </ul>
            </Card>

            <Card padding={false}>
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <span className="font-semibold text-sm">Meetings</span>
                <Link to={LINKS.meetings(selected.id)} className="text-xs font-semibold text-brand">All meetings →</Link>
              </div>
              <ul className="divide-y divide-line max-h-80 overflow-y-auto">
                {upcoming.slice(0, 6).map((m) => (
                  <li key={m.id} className="px-4 py-2.5">
                    <div className="text-xs font-semibold text-brand">{fmtDateTime(m.meetingDate)}</div>
                    <div className="text-sm font-medium truncate">{m.title}</div>
                    <div className="text-[11px] text-steel-muted">
                      {m.location || "Location not set"} · {m.status}
                      {m.teamsJoinUrl ? (
                        <a href={m.teamsJoinUrl} target="_blank" rel="noreferrer" className="ml-2 text-brand font-semibold">
                          Join
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
                {!upcoming.length && <li className="px-4 py-3 text-sm text-steel-muted">No meetings scheduled.</li>}
                {recentMeetings.length ? (
                  <li className="px-4 py-2 bg-sand/30 text-[10px] uppercase tracking-wider text-steel-muted">Recent</li>
                ) : null}
                {recentMeetings.map((m) => (
                  <li key={m.id} className="px-4 py-2 text-xs">
                    <span className="text-steel-muted">{fmtDate(m.meetingDate)}</span> · {m.title}
                    {m.momFileUrl ? <span className="ml-1 text-emerald-700 font-semibold">MoM filed</span> : <span className="ml-1 text-amber-700">MoM pending</span>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {detail?.dues && detail.dues.items?.length ? (
            <Card padding={false}>
              <div className="px-4 py-3 border-b border-line flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-sm">Due Dates</span>
                <span className="text-xs">
                  <span className="text-red-700 font-semibold">{detail.dues.overdue} overdue</span>
                  <span className="text-steel-muted"> · {detail.dues.dueSoon} in the next 21 days</span>
                </span>
              </div>
              <ul className="grid md:grid-cols-2 divide-y md:divide-y-0 divide-line text-sm">
                {detail.dues.items.slice(0, 10).map((item: any) => {
                  const overdue = item.due && new Date(item.due) < new Date();
                  return (
                    <li key={`${item.kind}-${item.id}`} className="px-4 py-2 flex justify-between gap-3 border-b border-line">
                      <Link to={item.href} className="min-w-0 truncate hover:underline">
                        <span className="font-mono text-[10px] text-brand mr-1">{item.kind}</span>
                        {item.title}
                      </Link>
                      <span className={`shrink-0 text-[11px] tabular-nums ${overdue ? "text-red-700 font-semibold" : "text-steel-muted"}`}>{fmtDate(item.due)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
