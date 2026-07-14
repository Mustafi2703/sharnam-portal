import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHeader } from "../components/ui";

export default function ReportsPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [daily, setDaily] = useState<any>(null);
  const [weekly, setWeekly] = useState<any>(null);

  useEffect(() => {
    void Promise.all([
      api(`/api/reports/daily/${id}`, { token }).then(setDaily),
      api(`/api/reports/weekly/${id}`, { token }).then(setWeekly),
    ]);
  }, [id, token]);

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="print:hidden">
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <PageHeader
          eyebrow="Client pack"
          title="Reports"
          subtitle="Printable daily site pack and weekly summary for owners."
          actions={
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
          }
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-semibold text-lg">Daily report</h2>
          {daily ? (
            <div className="text-sm mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">{new Date(daily.date).toDateString()}</Badge>
                <Badge tone={daily.diary ? "ok" : "warn"}>{daily.diary ? `Diary: ${daily.diary.status}` : "No diary"}</Badge>
              </div>
              {daily.diary && (
                <div className="rounded-xl bg-sand/40 p-3 space-y-1">
                  <div>Weather: {daily.diary.weatherCondition || "—"}</div>
                  <div>Manpower entries: {daily.diary.manpower?.length || 0}</div>
                  <div>Equipment entries: {daily.diary.equipment?.length || 0}</div>
                  <div>Notes: {daily.diary.notes?.length || 0}</div>
                </div>
              )}
              <div>
                <div className="font-semibold text-xs uppercase tracking-wide text-steel-muted mb-1">Checklist submissions</div>
                <ul className="space-y-1">
                  {(daily.checklistSubmissions || []).map((s: any) => (
                    <li key={s.id} className="flex justify-between gap-2 border-b border-line py-1">
                      <span>{s.assignment?.template?.name}</span>
                      <Badge tone={s.status === "Approved" ? "ok" : "neutral"}>{s.status}</Badge>
                    </li>
                  ))}
                  {!daily.checklistSubmissions?.length && <li className="text-steel-muted">None today</li>}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-xs uppercase tracking-wide text-steel-muted mb-1">Activity</div>
                <ul className="max-h-40 overflow-y-auto text-xs space-y-1 font-mono">
                  {(daily.activity || []).slice(0, 15).map((a: any) => (
                    <li key={a.id}>
                      {new Date(a.createdAt).toLocaleTimeString()} · {a.action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-steel-muted text-sm mt-2">Loading…</p>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-lg">Weekly report</h2>
          {weekly ? (
            <div className="text-sm mt-4 space-y-3">
              <p className="text-steel-muted">
                {new Date(weekly.start).toDateString()} – {new Date(weekly.end).toDateString()}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-line p-3">
                  <div className="text-2xl font-display">{weekly.summary.diaryDays}</div>
                  <div className="text-xs text-steel-muted">Diary days</div>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <div className="text-2xl font-display">{weekly.summary.checklistsSubmitted}</div>
                  <div className="text-xs text-steel-muted">Checklists</div>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <div className="text-2xl font-display text-ok">{weekly.summary.checklistsApproved}</div>
                  <div className="text-xs text-steel-muted">Approved</div>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <div className="text-2xl font-display">{weekly.summary.meetings}</div>
                  <div className="text-xs text-steel-muted">Meetings</div>
                </div>
              </div>
              <p className="text-xs">
                Open MoM items: <strong>{weekly.summary.openMeetingItems}</strong>
              </p>
              <div className="rounded-xl bg-sand/40 p-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: weekly.htmlStub }} />
            </div>
          ) : (
            <p className="text-steel-muted text-sm mt-2">Loading…</p>
          )}
        </Card>
      </div>
    </div>
  );
}
