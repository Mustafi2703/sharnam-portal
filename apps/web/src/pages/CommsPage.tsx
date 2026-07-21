import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea, WorkflowStrip } from "../components/ui";

type Tab = "matrix" | "agenda" | "mom" | "followup" | "log";

/**
 * Client video flow:
 * 1) Communication matrix
 * 2) Agenda generated BEFORE MoM
 * 3) MoM (minutes + actions)
 * 4) Follow-up from open actions
 */
export default function CommsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [tab, setTab] = useState<Tab>("matrix");
  const [matrix, setMatrix] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [itemDesc, setItemDesc] = useState("");
  const [itemCategory, setItemCategory] = useState("Agenda");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [matrixForm, setMatrixForm] = useState({
    communicationType: "Weekly coordination",
    fromRole: "office",
    toRole: "site_employee",
    frequency: "Weekly",
    channel: "Meeting",
  });
  const [schedule, setSchedule] = useState({
    title: "Weekly Site Coordination",
    meetingDate: new Date().toISOString().slice(0, 16),
    location: "Site cabin / Teams",
  });
  const [logForm, setLogForm] = useState({ subject: "", body: "", toRoles: "client", channel: "In-App" });

  const canEdit =
    user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";

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
  const agendaMeetings = useMemo(() => meetings.filter((m) => m.status === "Agenda" || m.status === "Scheduled"), [meetings]);
  const momMeetings = useMemo(() => meetings.filter((m) => m.status === "MoM"), [meetings]);
  const followMeetings = useMemo(() => meetings.filter((m) => m.status === "Follow-up"), [meetings]);

  const flowActive = tab === "matrix" ? 0 : tab === "agenda" ? 1 : tab === "mom" ? 2 : tab === "followup" ? 3 : 1;

  async function createMeeting(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const m = await api<any>(`/api/comms/meetings/${id}`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: schedule.title,
          meetingDate: new Date(schedule.meetingDate).toISOString(),
          location: schedule.location,
          status: "Agenda",
        }),
      });
      setActiveMeeting(m.id);
      setTab("agenda");
      setMsg("Meeting created in Agenda stage — generate agenda before MoM.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function generateAgenda() {
    if (!activeMeeting) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/comms/meetings/${activeMeeting}/generate-agenda`, { method: "POST", token, body: "{}" });
      setMsg("Agenda generated. Review items, then Start MoM.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function startMom() {
    if (!activeMeeting) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/comms/meetings/${activeMeeting}/start-mom`, { method: "POST", token, body: "{}" });
      setTab("mom");
      setItemCategory("Action");
      setMsg("MoM started — add action items against the agenda.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function createFollowUp() {
    if (!activeMeeting) return;
    setBusy(true);
    try {
      const next = await api<any>(`/api/comms/meetings/${activeMeeting}/carry-over`, {
        method: "POST",
        token,
        body: JSON.stringify({ meetingDate: new Date().toISOString() }),
      });
      setActiveMeeting(next.id);
      setTab("followup");
      setMsg("Follow-up meeting created from open actions.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const listForTab =
    tab === "agenda" ? agendaMeetings : tab === "mom" ? momMeetings : tab === "followup" ? followMeetings : meetings;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/workspace`} className="text-sm text-brand font-medium">
          ← Workspaces
        </Link>
        <PageHeader
          eyebrow="Communications"
          title="Matrix · Agenda · MoM · Follow-up"
          subtitle="Exact client flow: communication matrix, generate agenda before MoM, capture minutes/actions, then follow up open items."
        />
      </div>

      <WorkflowStrip
        active={flowActive}
        steps={[
          { label: "Matrix", hint: "Who talks to whom" },
          { label: "Agenda", hint: "Generate before MoM" },
          { label: "MoM", hint: "Minutes + actions" },
          { label: "Follow-up", hint: "Carry open actions" },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["matrix", "1 · Matrix"],
            ["agenda", "2 · Agenda"],
            ["mom", "3 · MoM"],
            ["followup", "4 · Follow-up"],
            ["log", "Comm log"],
          ] as const
        ).map(([k, label]) => (
          <Button key={k} type="button" variant={tab === k ? "primary" : "secondary"} onClick={() => setTab(k)}>
            {label}
          </Button>
        ))}
        <Link to={`/projects/${id}/reports`} className="ml-auto">
          <Button type="button" variant="ghost" className="!text-xs">
            DPR →
          </Button>
        </Link>
        <Link to={`/projects/${id}/rfis`}>
          <Button type="button" variant="ghost" className="!text-xs">
            RFIs →
          </Button>
        </Link>
      </div>

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      {tab === "matrix" && (
        <div className="space-y-4">
          {canEdit && (
            <Card>
              <h3 className="font-semibold mb-3">Add matrix row</h3>
              <form
                className="grid sm:grid-cols-2 gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/api/comms/matrix/${id}`, { method: "POST", token, body: JSON.stringify(matrixForm) });
                  await load();
                }}
              >
                <Input
                  placeholder="Communication type"
                  value={matrixForm.communicationType}
                  onChange={(e) => setMatrixForm({ ...matrixForm, communicationType: e.target.value })}
                />
                <Input
                  placeholder="Frequency"
                  value={matrixForm.frequency}
                  onChange={(e) => setMatrixForm({ ...matrixForm, frequency: e.target.value })}
                />
                <Select value={matrixForm.fromRole} onChange={(e) => setMatrixForm({ ...matrixForm, fromRole: e.target.value })}>
                  {["office", "site_employee", "vendor", "client", "employee"].map((r) => (
                    <option key={r} value={r}>
                      From · {r}
                    </option>
                  ))}
                </Select>
                <Select value={matrixForm.toRole} onChange={(e) => setMatrixForm({ ...matrixForm, toRole: e.target.value })}>
                  {["office", "site_employee", "vendor", "client", "employee"].map((r) => (
                    <option key={r} value={r}>
                      To · {r}
                    </option>
                  ))}
                </Select>
                <Select value={matrixForm.channel} onChange={(e) => setMatrixForm({ ...matrixForm, channel: e.target.value })}>
                  {["Meeting", "Email", "WhatsApp", "In-App"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <Button type="submit">Add to matrix</Button>
              </form>
            </Card>
          )}
          <Card padding={false} className="overflow-x-auto">
            <div className="px-4 py-3 border-b font-semibold bg-procore-navy text-white">Communication matrix</div>
            <table className="w-full text-sm">
              <thead className="bg-sand text-left text-[10px] uppercase text-steel-muted">
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
                    <td className="p-3 font-medium">{r.communicationType}</td>
                    <td className="p-3 capitalize">{r.fromRole.replace("_", " ")}</td>
                    <td className="p-3 capitalize">{r.toRole.replace("_", " ")}</td>
                    <td className="p-3">{r.frequency}</td>
                    <td className="p-3">{r.channel}</td>
                  </tr>
                ))}
                {!matrix.length && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-steel-muted text-sm">
                      No matrix rows yet — add who communicates with whom.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {(tab === "agenda" || tab === "mom" || tab === "followup") && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4">
          <Card padding={false} className="overflow-hidden h-fit">
            <div className="px-3 py-2.5 bg-procore-navy text-white text-sm font-semibold">
              {tab === "agenda" ? "Agenda meetings" : tab === "mom" ? "MoM meetings" : "Follow-ups"}
            </div>
            <ul className="divide-y divide-line max-h-[420px] overflow-y-auto">
              {listForTab.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-3 text-sm hover:bg-brand-soft/40 ${
                      activeMeeting === m.id ? "bg-brand-soft" : ""
                    }`}
                    onClick={() => setActiveMeeting(m.id)}
                  >
                    <div className="font-medium leading-snug">{m.title}</div>
                    <div className="text-[11px] text-steel-muted mt-1 font-mono">
                      {new Date(m.meetingDate).toLocaleString()} · {m.status}
                    </div>
                  </button>
                </li>
              ))}
              {!listForTab.length && <li className="p-4 text-sm text-steel-muted">None in this stage yet.</li>}
            </ul>
            {canEdit && tab === "agenda" && (
              <form className="p-3 border-t border-line space-y-2" onSubmit={createMeeting}>
                <Input value={schedule.title} onChange={(e) => setSchedule({ ...schedule, title: e.target.value })} />
                <Input
                  type="datetime-local"
                  value={schedule.meetingDate}
                  onChange={(e) => setSchedule({ ...schedule, meetingDate: e.target.value })}
                />
                <Button type="submit" disabled={busy} className="w-full !text-xs">
                  New meeting (Agenda)
                </Button>
              </form>
            )}
          </Card>

          <div className="space-y-4">
            {!selected ? (
              <Card>
                <p className="text-sm text-steel-muted">Select or create a meeting.</p>
              </Card>
            ) : (
              <>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge tone="brand">{selected.status}</Badge>
                      <h2 className="font-display text-xl mt-2">{selected.title}</h2>
                      <p className="text-sm text-steel-muted mt-1">
                        {new Date(selected.meetingDate).toLocaleString()}
                        {selected.location ? ` · ${selected.location}` : ""}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-2">
                        {selected.status === "Agenda" || selected.status === "Scheduled" ? (
                          <>
                            <Button type="button" variant="secondary" disabled={busy} onClick={() => void generateAgenda()}>
                              Generate agenda
                            </Button>
                            <Button type="button" disabled={busy} onClick={() => void startMom()}>
                              Start MoM
                            </Button>
                          </>
                        ) : null}
                        {selected.status === "MoM" && (
                          <Button type="button" disabled={busy} onClick={() => void createFollowUp()}>
                            Create follow-up
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                <Card padding={false} className="overflow-hidden">
                  <div className="px-4 py-3 border-b bg-sand/50 flex justify-between items-center">
                    <span className="font-semibold text-sm">
                      {tab === "agenda" ? "Agenda items (before MoM)" : tab === "mom" ? "MoM / action items" : "Follow-up actions"}
                    </span>
                    <span className="font-mono text-[11px] text-steel-muted">{selected.items?.length || 0} items</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {(selected.items || []).map((it: any) => (
                      <li key={it.id} className="px-4 py-3 flex flex-wrap justify-between gap-2 text-sm">
                        <div>
                          <Badge tone="neutral">{it.category}</Badge>
                          <div className="mt-1 font-medium">{it.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={it.resolutionStatus === "Open" ? "warn" : "ok"}>{it.resolutionStatus}</Badge>
                          {canEdit && it.resolutionStatus === "Open" && (
                            <Button
                              type="button"
                              variant="ghost"
                              className="!text-xs"
                              onClick={async () => {
                                await api(`/api/comms/meetings/items/${it.id}`, {
                                  method: "PATCH",
                                  token,
                                  body: JSON.stringify({ resolutionStatus: "Closed" }),
                                });
                                await load();
                              }}
                            >
                              Close
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                    {!(selected.items || []).length && (
                      <li className="p-6 text-sm text-steel-muted text-center">
                        {tab === "agenda" ? "Click Generate agenda before starting MoM." : "No items yet."}
                      </li>
                    )}
                  </ul>
                  {canEdit && (
                    <form
                      className="p-4 border-t border-line flex flex-wrap gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!itemDesc.trim()) return;
                        await api(`/api/comms/meetings/${selected.id}/items`, {
                          method: "POST",
                          token,
                          body: JSON.stringify({
                            description: itemDesc,
                            category: tab === "agenda" ? "Agenda" : tab === "followup" ? "Follow-up" : itemCategory,
                          }),
                        });
                        setItemDesc("");
                        await load();
                      }}
                    >
                      {tab === "mom" && (
                        <Select className="w-32" value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
                          <option value="Action">Action</option>
                          <option value="MoM">MoM note</option>
                          <option value="Agenda">Agenda</option>
                        </Select>
                      )}
                      <Input
                        className="flex-1 min-w-[180px]"
                        placeholder={tab === "agenda" ? "Add agenda line…" : "Add action / MoM line…"}
                        value={itemDesc}
                        onChange={(e) => setItemDesc(e.target.value)}
                      />
                      <Button type="submit">Add</Button>
                    </form>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "log" && (
        <div className="space-y-4">
          {canEdit && (
            <Card>
              <h3 className="font-semibold mb-3">Log communication</h3>
              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/api/comms/logs/${id}`, { method: "POST", token, body: JSON.stringify(logForm) });
                  setLogForm({ ...logForm, subject: "", body: "" });
                  await load();
                }}
              >
                <Input
                  required
                  placeholder="Subject"
                  value={logForm.subject}
                  onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })}
                />
                <TextArea
                  rows={3}
                  placeholder="Body"
                  value={logForm.body}
                  onChange={(e) => setLogForm({ ...logForm, body: e.target.value })}
                />
                <Button type="submit">Save log</Button>
              </form>
            </Card>
          )}
          <Card padding={false}>
            <ul className="divide-y divide-line">
              {logs.map((l) => (
                <li key={l.id} className="px-4 py-3">
                  <div className="font-medium text-sm">{l.subject}</div>
                  <div className="text-[11px] text-steel-muted font-mono mt-1">
                    {l.fromUser} → {l.toRoles} · {l.channel} · {new Date(l.sentAt).toLocaleString()}
                  </div>
                  {l.body && <p className="text-sm text-steel-muted mt-2">{l.body}</p>}
                </li>
              ))}
              {!logs.length && <li className="p-6 text-sm text-steel-muted text-center">No logs yet.</li>}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
