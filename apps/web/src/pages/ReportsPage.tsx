import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

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
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <h1 className="font-display text-4xl mt-1">Reports</h1>
        <p className="text-steel-muted">Daily pack and weekly client stub.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-2xl bg-white border border-black/5 p-4">
          <h2 className="font-semibold">Daily report</h2>
          {daily ? (
            <div className="text-sm mt-3 space-y-2">
              <p>Date: {new Date(daily.date).toDateString()}</p>
              <p>Diary: {daily.diary ? daily.diary.status : "No log"}</p>
              <p>Checklist submissions: {daily.checklistSubmissions?.length || 0}</p>
              <p>Activity events: {daily.activity?.length || 0}</p>
            </div>
          ) : (
            <p className="text-steel-muted text-sm mt-2">Loading…</p>
          )}
        </section>
        <section className="rounded-2xl bg-white border border-black/5 p-4">
          <h2 className="font-semibold">Weekly report</h2>
          {weekly ? (
            <div className="text-sm mt-3 space-y-2">
              <p>
                {new Date(weekly.start).toDateString()} – {new Date(weekly.end).toDateString()}
              </p>
              <ul className="list-disc pl-5">
                <li>Diary days: {weekly.summary.diaryDays}</li>
                <li>Checklists submitted: {weekly.summary.checklistsSubmitted}</li>
                <li>Approved: {weekly.summary.checklistsApproved}</li>
                <li>Meetings: {weekly.summary.meetings}</li>
                <li>Open meeting items: {weekly.summary.openMeetingItems}</li>
              </ul>
              <div
                className="mt-4 rounded-xl bg-sand/40 p-3"
                dangerouslySetInnerHTML={{ __html: weekly.htmlStub }}
              />
            </div>
          ) : (
            <p className="text-steel-muted text-sm mt-2">Loading…</p>
          )}
        </section>
      </div>
    </div>
  );
}
