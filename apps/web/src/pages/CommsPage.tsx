import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";

export default function CommsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [tab, setTab] = useState<"matrix" | "log" | "meetings">("meetings");
  const [matrix, setMatrix] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [logForm, setLogForm] = useState({ subject: "", body: "", toRoles: "client", channel: "In-App" });
  const [schedule, setSchedule] = useState({
    title: "Weekly Site Coordination",
    meetingDate: new Date().toISOString().slice(0, 16),
    location: "Site cabin / Teams",
  });
  const [itemDesc, setItemDesc] = useState("");
  const [itemCategory, setItemCategory] = useState("General");
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const canSchedule =
    user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";
  const canEdit = user?.role === "admin" || user?.role === "office" || user?.role === "employee";

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

  const selected = meetings.find((m) => m.id === activeMeeting);

  async function createMeeting(e: FormEvent) {
    e.preventDefault();
    const m = await api<any>(`/api/comms/meetings/${id}`, {
      method: "POST",
      token,
      body: JSON.stringify({
        title: schedule.title,
        meetingDate: new Date(schedule.meetingDate).toISOString(),
        location: schedule.location,
        status: "Scheduled",
      }),
    });
    setActiveMeeting(m.id);
    setTab("meetings");
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand">
          ← Project
        </Link>
        <PageHeader
          eyebrow="Project communications"
          title="Communications & meetings"
          subtitle="Matrix, message log, and scheduled meetings with MoM open/close tracking."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["meetings", "Meetings"],
            ["log", "Comm log"],
            ["matrix", "Matrix"],
          ] as const
        ).map(([k, label]) => (
          <Button key={k} type="button" variant={tab === k ? "primary" : "secondary"} onClick={() => setTab(k)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "matrix" && (
        <Card padding={false} className="overflow-x-auto">
          <div className="px-4 py-3 border-b font-semibold bg-sand/50">Communication matrix</div>
          <table className="w-full text-sm">
            <thead className="bg-sand/30 text-left text-xs uppercase text-steel-muted">
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
                <tr key={r.id} className="border-t border-line">
                  <td className="p-3">{r.communicationType}</td>
                  <td className="p-3 capitalize">{r.fromRole.replace("_", " ")}</td>
                  <td className="p-3 capitalize">{r.toRole.replace("_", " ")}</td>
                  <td className="p-3">{r.frequency}</td>
                  <td className="p-3">{r.channel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "log" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-3">Message log</h3>
            <ul className="text-sm space-y-2 max-h-80 overflow-y-auto mb-4">
              {logs.map((l) => (
                <li key={l.id} className="border-b border-line pb-2">
                  <div className="font-medium">{l.subject}</div>
                  <div className="text-xs text-steel-muted">
                    {l.fromUser} → {l.toRoles} · {l.channel} · {new Date(l.sentAt).toLocaleString()}
                  </div>
                  {l.body && <p className="mt-1 text-steel-muted">{l.body}</p>}
                </li>
              ))}
              {!logs.length && <li className="text-steel-muted">No messages yet.</li>}
            </ul>
          </Card>
          {canEdit && (
            <Card>
              <h3 className="font-semibold mb-3">Log communication</h3>
              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/api/comms/logs/${id}`, { method: "POST", token, body: JSON.stringify(logForm) });
                  setLogForm({ subject: "", body: "", toRoles: "client", channel: "In-App" });
                  await load();
                }}
              >
                <Input required placeholder="Subject" value={logForm.subject} onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })} />
                <TextArea rows={3} placeholder="Body" value={logForm.body} onChange={(e) => setLogForm({ ...logForm, body: e.target.value })} />
                <Select value={logForm.toRoles} onChange={(e) => setLogForm({ ...logForm, toRoles: e.target.value })}>
                  {["client", "office", "site_employee", "vendor"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
                <Select value={logForm.channel} onChange={(e) => setLogForm({ ...logForm, channel: e.target.value })}>
                  {["In-App", "Email", "WhatsApp", "Call"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <Button type="submit" className="w-full">
                  Log message
                </Button>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === "meetings" && (
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4">
          {canSchedule && (
            <Card>
              <h3 className="font-semibold mb-3">Schedule meeting</h3>
              <form className="space-y-2" onSubmit={createMeeting}>
                <Input required value={schedule.title} onChange={(e) => setSchedule({ ...schedule, title: e.target.value })} placeholder="Title" />
                <Input
                  required
                  type="datetime-local"
                  value={schedule.meetingDate}
                  onChange={(e) => setSchedule({ ...schedule, meetingDate: e.target.value })}
                />
                <Input value={schedule.location} onChange={(e) => setSchedule({ ...schedule, location: e.target.value })} placeholder="Location / Teams link" />
                <Button type="submit" className="w-full">
                  Schedule
                </Button>
              </form>
              <div className="mt-5">
                <div className="text-xs font-mono uppercase text-steel-muted mb-2">Upcoming / past</div>
                <ul className="space-y-1 max-h-56 overflow-y-auto">
                  {meetings.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${
                        activeMeeting === m.id ? "border-brand bg-brand-soft" : "border-line hover:bg-sand/40"
                      }`}
                      onClick={() => setActiveMeeting(m.id)}
                    >
                      <div className="font-medium">{m.title}</div>
                      <div className="text-[11px] text-steel-muted flex justify-between gap-2">
                        <span>{new Date(m.meetingDate).toLocaleString()}</span>
                        <Badge tone={m.status === "Closed" ? "ok" : "warn"}>{m.status}</Badge>
                      </div>
                    </button>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          <Card>
            {!selected && <p className="text-sm text-steel-muted">Select or schedule a meeting</p>}
            {selected && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selected.title}</h3>
                  <p className="text-sm text-steel-muted">
                    {new Date(selected.meetingDate).toLocaleString()}
                    {selected.location ? ` · ${selected.location}` : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge>{selected.status}</Badge>
                    <Badge tone="brand">{selected.items?.length || 0} MoM items</Badge>
                  </div>
                </div>
                <ul className="space-y-2">
                  {selected.items?.map((i: any) => (
                    <li key={i.id} className="flex justify-between gap-2 border-b border-line pb-2 text-sm">
                      <span>
                        <Badge tone="neutral">{i.category}</Badge>{" "}
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded mr-1 ${
                            i.resolutionStatus === "Closed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {i.resolutionStatus}
                        </span>
                        {i.description}
                      </span>
                      {canSchedule && i.resolutionStatus !== "Closed" && (
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
                {canSchedule && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
                        {["General", "Safety", "Quality", "Schedule", "Design"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </Select>
                      <Input className="flex-1" placeholder="MoM / action item" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
                      <Button
                        type="button"
                        variant="dark"
                        onClick={async () => {
                          if (!itemDesc.trim()) return;
                          await api(`/api/comms/meetings/${selected.id}/items`, {
                            method: "POST",
                            token,
                            body: JSON.stringify({ description: itemDesc, category: itemCategory }),
                          });
                          setItemDesc("");
                          await load();
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          await api(`/api/comms/meetings/${selected.id}`, {
                            method: "PATCH",
                            token,
                            body: JSON.stringify({ status: "Closed" }),
                          });
                          await load();
                        }}
                      >
                        Close meeting
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={async () => {
                          const next = await api<any>(`/api/comms/meetings/${selected.id}/carry-over`, {
                            method: "POST",
                            token,
                            body: JSON.stringify({ meetingDate: new Date().toISOString() }),
                          });
                          setActiveMeeting(next.id);
                          await load();
                        }}
                      >
                        Carry open items →
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
