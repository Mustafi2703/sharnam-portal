import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function CommsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [matrix, setMatrix] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [logForm, setLogForm] = useState({ subject: "", body: "", toRoles: "client" });
  const [meetingTitle, setMeetingTitle] = useState("Weekly Site Coordination");
  const [itemDesc, setItemDesc] = useState("");
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const canEdit = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [m, l, meet] = await Promise.all([
      api<any[]>(`/api/comms/matrix/${id}`, { token }),
      api<any[]>(`/api/comms/logs/${id}`, { token }),
      api<any[]>(`/api/comms/meetings/${id}`, { token }),
    ]);
    setMatrix(m);
    setLogs(l);
    setMeetings(meet);
    if (!activeMeeting && meet[0]) setActiveMeeting(meet[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <h1 className="font-display text-4xl mt-1">Communications</h1>
        <p className="text-steel-muted">Matrix, message log, and light meetings / MoM with carry-over.</p>
      </div>

      <section className="rounded-2xl bg-white border border-black/5 overflow-x-auto">
        <div className="p-4 font-semibold">Communication matrix</div>
        <table className="w-full text-sm">
          <thead className="bg-sand/50 text-left">
            <tr>
              <th className="p-3">Type</th>
              <th className="p-3">From</th>
              <th className="p-3">To</th>
              <th className="p-3">Frequency</th>
              <th className="p-3">Channel</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((r) => (
              <tr key={r.id} className="border-t border-black/5">
                <td className="p-3">{r.communicationType}</td>
                <td className="p-3 capitalize">{r.fromRole.replace("_", " ")}</td>
                <td className="p-3 capitalize">{r.toRole.replace("_", " ")}</td>
                <td className="p-3">{r.frequency}</td>
                <td className="p-3">{r.channel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-2xl bg-white border border-black/5 p-4 space-y-3">
          <h2 className="font-semibold">Communication log</h2>
          <ul className="text-sm space-y-2 max-h-64 overflow-y-auto">
            {logs.map((l) => (
              <li key={l.id} className="border-b border-black/5 pb-2">
                <div className="font-medium">{l.subject}</div>
                <div className="text-steel-muted text-xs">
                  {l.fromUser} → {l.toRoles} · {new Date(l.sentAt).toLocaleString()}
                </div>
                {l.body && <p className="mt-1">{l.body}</p>}
              </li>
            ))}
          </ul>
          {canEdit && (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await api(`/api/comms/logs/${id}`, { method: "POST", token, body: JSON.stringify(logForm) });
                setLogForm({ subject: "", body: "", toRoles: "client" });
                await load();
              }}
            >
              <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Subject" value={logForm.subject} onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })} required />
              <textarea className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Body" value={logForm.body} onChange={(e) => setLogForm({ ...logForm, body: e.target.value })} />
              <button className="rounded-xl bg-brand text-white px-3 py-2 text-sm">Log message</button>
            </form>
          )}
        </section>

        <section className="rounded-2xl bg-white border border-black/5 p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Meetings / MoM</h2>
            {canEdit && (
              <button
                className="text-sm text-brand"
                onClick={async () => {
                  const m = await api<any>(`/api/comms/meetings/${id}`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ title: meetingTitle, meetingDate: new Date().toISOString() }),
                  });
                  setActiveMeeting(m.id);
                  await load();
                }}
              >
                + Meeting
              </button>
            )}
          </div>
          <input className="w-full rounded-xl border px-3 py-2 text-sm" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} />
          <select className="w-full rounded-xl border px-3 py-2 text-sm" value={activeMeeting || ""} onChange={(e) => setActiveMeeting(e.target.value)}>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · {m.status}
              </option>
            ))}
          </select>
          {activeMeeting && (
            <>
              <ul className="text-sm space-y-2">
                {meetings
                  .find((m) => m.id === activeMeeting)
                  ?.items?.map((i: any) => (
                    <li key={i.id} className="flex justify-between gap-2 items-start border-b border-black/5 pb-2">
                      <span>
                        <span
                          className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded mr-2 ${
                            i.resolutionStatus === "Closed" || i.resolutionStatus === "Resolved"
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {i.resolutionStatus}
                        </span>
                        {i.description}
                      </span>
                      {canEdit && i.resolutionStatus !== "Closed" && i.resolutionStatus !== "Resolved" && (
                        <button
                          type="button"
                          className="text-xs text-brand shrink-0"
                          onClick={async () => {
                            await api(`/api/comms/meetings/items/${i.id}`, {
                              method: "PATCH",
                              token,
                              body: JSON.stringify({ resolutionStatus: "Closed" }),
                            });
                            await load();
                          }}
                        >
                          Close
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
              {canEdit && activeMeeting && (
                <button
                  type="button"
                  className="text-sm text-brand"
                  onClick={async () => {
                    await api(`/api/comms/meetings/${activeMeeting}`, {
                      method: "PATCH",
                      token,
                      body: JSON.stringify({ status: "Closed" }),
                    });
                    await load();
                  }}
                >
                  Mark meeting closed
                </button>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <input className="flex-1 rounded-xl border px-3 py-2 text-sm" placeholder="Agenda / minute item" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
                  <button
                    className="rounded-xl bg-steel text-white px-3 py-2 text-sm"
                    onClick={async () => {
                      await api(`/api/comms/meetings/${activeMeeting}/items`, {
                        method: "POST",
                        token,
                        body: JSON.stringify({ description: itemDesc }),
                      });
                      setItemDesc("");
                      await load();
                    }}
                  >
                    Add
                  </button>
                </div>
              )}
              {canEdit && (
                <button
                  className="text-sm text-brand"
                  onClick={async () => {
                    const next = await api<any>(`/api/comms/meetings/${activeMeeting}/carry-over`, {
                      method: "POST",
                      token,
                      body: JSON.stringify({ meetingDate: new Date().toISOString() }),
                    });
                    setActiveMeeting(next.id);
                    await load();
                  }}
                >
                  Carry open items to follow-up meeting
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
