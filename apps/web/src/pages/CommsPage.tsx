import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea, WorkflowStrip } from "../components/ui";
import { CommsMatrixPanel } from "../components/CommsMatrixPanel";
import { ReferenceSheetToolbar } from "../components/ReferenceSheetToolbar";
import { isToolWindow } from "../lib/moduleToolWindow";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const tabRaw = searchParams.get("tab") || "matrix";
  const tab: Tab =
    tabRaw === "agenda" || tabRaw === "mom" || tabRaw === "followup" || tabRaw === "log" ? tabRaw : "matrix";
  const setTab = (t: Tab) => {
    if (t === "matrix") setSearchParams({});
    else setSearchParams({ tab: t });
  };
  const [contacts, setContacts] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [matrixKind, setMatrixKind] = useState<"TECHNICAL" | "COMMERCIAL">("TECHNICAL");
  const [logs, setLogs] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [itemDesc, setItemDesc] = useState("");
  const [itemCategory, setItemCategory] = useState("Agenda");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [schedule, setSchedule] = useState({
    title: "Weekly Site Coordination",
    meetingDate: new Date().toISOString().slice(0, 16),
    location: "Site cabin / Microsoft Teams",
    durationMins: "60",
    attendeeEmails: "",
    createTeams: true,
  });
  const [logForm, setLogForm] = useState({ subject: "", body: "", toRoles: "client", channel: "In-App" });

  const canEdit =
    user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";

  const load = async () => {
    const [l, meet, techContacts, commContacts, p] = await Promise.all([
      api<any[]>(`/api/comms/logs/${id}`, { token }),
      api<any[]>(`/api/comms/meetings/${id}`, { token }),
      api<any[]>(`/api/comms/contacts/${id}?kind=TECHNICAL`, { token }).catch(() => []),
      api<any[]>(`/api/comms/contacts/${id}?kind=COMMERCIAL`, { token }).catch(() => []),
      api<any>(`/api/projects/${id}`, { token }).catch(() => null),
    ]);
    setLogs(l);
    setMeetings(meet);
    setProject(p);

    if (canEdit && techContacts.length === 0 && commContacts.length === 0) {
      try {
        await api(`/api/comms/contacts/${id}/sync-from-directory`, { method: "POST", token }).catch(() => null);
        let [tech2, comm2] = await Promise.all([
          api<any[]>(`/api/comms/contacts/${id}?kind=TECHNICAL`, { token }).catch(() => []),
          api<any[]>(`/api/comms/contacts/${id}?kind=COMMERCIAL`, { token }).catch(() => []),
        ]);
        if (!tech2.length && !comm2.length) {
          await api(`/api/comms/contacts/${id}/seed-bpcl`, {
            method: "POST",
            token,
            body: JSON.stringify({ force: false, both: true }),
          });
          [tech2, comm2] = await Promise.all([
            api<any[]>(`/api/comms/contacts/${id}?kind=TECHNICAL`, { token }),
            api<any[]>(`/api/comms/contacts/${id}?kind=COMMERCIAL`, { token }),
          ]);
        }
        setContacts(matrixKind === "COMMERCIAL" ? comm2 : tech2);
        const allEmails = [...tech2, ...comm2]
          .filter((r: any) => !r.isSectionHeader && r.email)
          .map((r: any) => r.email.trim())
          .filter(Boolean);
        if (allEmails.length) {
          setSchedule((s) => ({ ...s, attendeeEmails: Array.from(new Set(allEmails)).join(", ") }));
        }
      } catch {
        setContacts(matrixKind === "COMMERCIAL" ? commContacts : techContacts);
      }
    } else {
      setContacts(matrixKind === "COMMERCIAL" ? commContacts : techContacts);
      const allEmails = [...techContacts, ...commContacts]
        .filter((r: any) => !r.isSectionHeader && r.email)
        .map((r: any) => r.email.trim())
        .filter(Boolean);
      if (allEmails.length) {
        setSchedule((s) => ({ ...s, attendeeEmails: Array.from(new Set(allEmails)).join(", ") }));
      }
    }

    if (!activeMeeting && meet[0]) setActiveMeeting(meet[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token, matrixKind]);

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
          durationMins: Number(schedule.durationMins) || 60,
          attendeeEmails: schedule.attendeeEmails.trim() || undefined,
          createTeams: schedule.createTeams,
        }),
      });
      setActiveMeeting(m.id);
      setTab("agenda");
      setMsg(
        m.invite?.email?.skipped
          ? "Meeting created — email skipped (check project email settings)."
          : m.invite?.error
            ? `Meeting created — invite failed: ${m.invite.error}`
            : m.invite?.teamsJoinUrl
              ? "Meeting created — one formatted invite sent with Microsoft Teams join link."
              : m.invite?.email
                ? "Meeting created — one formatted invite email sent to all attendees."
                : "Meeting created in Agenda stage — add invite emails to send Teams invite."
      );
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
      setMsg("Agenda generated and emailed to communication matrix contacts.");
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
      setMsg("MoM started — matrix contacts notified. Add action items against the agenda.");
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
      setMsg("Follow-up meeting created — open actions carried over; matrix contacts notified.");
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
          title="Meetings · MoM"
          subtitle="Simple flow: set Matrix (who) → Create meeting → Agenda → MoM (minutes + actions) → Follow-up. Use Ask (PMC RFI) for questions — not inside MoM."
          actions={
            isToolWindow() ? undefined : (
            <div className="flex flex-wrap gap-2">
              <Link to={`/projects/${id}/hub/comms`}>
                <Button type="button" variant="secondary">
                  Comms hub
                </Button>
              </Link>
              <Link to={`/projects/${id}/email`}>
                <Button type="button" variant="ghost" className="!text-xs">
                  Outlook →
                </Button>
              </Link>
              <Link to={`/projects/${id}/rfis?kind=RequestForInformation`}>
                <Button type="button" variant="ghost" className="!text-xs">
                  Ask (PMC RFI) →
                </Button>
              </Link>
            </div>
            )
          }
        />
      </div>

      <WorkflowStrip
        active={flowActive}
        steps={[
          { label: "Matrix", hint: "Who is involved" },
          { label: "Create meeting", hint: "Then agenda" },
          { label: "MoM", hint: "Minutes + actions" },
          { label: "Follow-up", hint: "Open actions" },
        ]}
      />

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      {tab === "matrix" && id && (
        <CommsMatrixPanel
          projectId={id}
          token={token!}
          project={project}
          matrixKind={matrixKind}
          onMatrixKindChange={setMatrixKind}
          contacts={contacts}
          canEdit={canEdit}
          onReload={load}
          onMsg={setMsg}
        />
      )}

      {(tab === "agenda" || tab === "mom" || tab === "followup") && (
        <div className="space-y-3">
        <ReferenceSheetToolbar
          sheetLabel={tab === "agenda" ? "Agenda meetings" : tab === "mom" ? "Minutes of meeting" : "Follow-up actions"}
          rowCount={listForTab.length}
          canEdit={canEdit && tab === "agenda"}
          onAddRow={tab === "agenda" ? () => document.getElementById("add-meeting-form")?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined}
          addRowLabel="+ Add meeting"
        />
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
              <form id="add-meeting-form" className="p-3 border-t border-line space-y-2" onSubmit={createMeeting}>
                <Input value={schedule.title} onChange={(e) => setSchedule({ ...schedule, title: e.target.value })} />
                <Input
                  type="datetime-local"
                  value={schedule.meetingDate}
                  onChange={(e) => setSchedule({ ...schedule, meetingDate: e.target.value })}
                />
                <Input
                  value={schedule.location}
                  onChange={(e) => setSchedule({ ...schedule, location: e.target.value })}
                  placeholder="Location (site cabin / Microsoft Teams)"
                />
                <Input
                  type="number"
                  min={15}
                  max={480}
                  value={schedule.durationMins}
                  onChange={(e) => setSchedule({ ...schedule, durationMins: e.target.value })}
                  placeholder="Duration (minutes)"
                />
                <Input
                  value={schedule.attendeeEmails}
                  onChange={(e) => setSchedule({ ...schedule, attendeeEmails: e.target.value })}
                  placeholder="Attendee emails (TO + CC from both matrices)"
                />
                <label className="flex items-center gap-2 text-xs text-steel-muted px-1">
                  <input
                    type="checkbox"
                    checked={schedule.createTeams}
                    onChange={(e) => setSchedule({ ...schedule, createTeams: e.target.checked })}
                  />
                  Schedule Microsoft Teams via Graph
                </label>
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
                        {selected.durationMins ? ` · ${selected.durationMins} min` : ""}
                      </p>
                      {selected.teamsJoinUrl && (
                        <a
                          href={selected.teamsJoinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-2 text-xs font-semibold text-[#6264a7] hover:underline"
                        >
                          Join Microsoft Teams →
                        </a>
                      )}
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
                        {(selected.status === "Follow-up" || tab === "followup") && (
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              setMsg("");
                              try {
                                const r = await api<{ to: string[]; openCount: number }>(
                                  `/api/comms/meetings/${selected.id}/send-follow-up`,
                                  { method: "POST", token, body: "{}" },
                                );
                                setMsg(`Follow-up sent to ${r.to.length} recipient(s) · ${r.openCount} open action(s).`);
                              } catch (err) {
                                setMsg(err instanceof Error ? err.message : String(err));
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            Send follow-up
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            window.open(`/api/comms/meetings/${selected.id}/download.html?token=${encodeURIComponent(token || "")}`, "_blank", "noopener")
                          }
                        >
                          Open MoM (print → PDF)
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            const url = `/api/comms/meetings/${selected.id}/download.xlsx?token=${encodeURIComponent(token || "")}`;
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "";
                            a.click();
                          }}
                        >
                          Download MoM .xlsx
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={async () => {
                            const extra = prompt(
                              "Extra recipients (comma-separated, optional). All communication matrix contacts are included automatically."
                            );
                            setBusy(true);
                            setMsg("");
                            try {
                              const r = await api<{ to: string[] }>(`/api/comms/meetings/${selected.id}/email`, {
                                method: "POST",
                                token,
                                body: JSON.stringify({ emails: extra || "" }),
                              });
                              setMsg(`MoM queued to ${r.to.length} recipient(s) (matrix + action owners).`);
                            } catch (err) {
                              setMsg(err instanceof Error ? err.message : String(err));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Email MoM to attendees
                        </Button>
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
                        if (!itemDesc.trim() || busy) return;
                        setBusy(true);
                        setMsg("");
                        try {
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
                        } catch (err) {
                          setMsg(err instanceof Error ? err.message : "Could not add item — check connection and retry.");
                        } finally {
                          setBusy(false);
                        }
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
                        placeholder={
                          tab === "agenda"
                            ? "Add agenda line…"
                            : tab === "followup"
                              ? "Add follow-up action…"
                              : "Add action / MoM line…"
                        }
                        value={itemDesc}
                        onChange={(e) => setItemDesc(e.target.value)}
                      />
                      <Button type="submit" disabled={busy || !itemDesc.trim()}>{busy ? "Adding…" : "Add"}</Button>
                    </form>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
        </div>
      )}

      {tab === "log" && (
        <div className="space-y-4">
          <ReferenceSheetToolbar
            sheetLabel="Communication log"
            rowCount={logs.length}
            canEdit={canEdit}
            onAddRow={canEdit ? () => document.getElementById("add-comm-log")?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined}
            addRowLabel="+ Add log"
          />
          {canEdit && (
            <Card id="add-comm-log">
              <h3 className="font-semibold mb-3">Log communication</h3>
              <form
                className="space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (busy) return;
                  setBusy(true);
                  setMsg("");
                  try {
                    await api(`/api/comms/logs/${id}`, { method: "POST", token, body: JSON.stringify(logForm) });
                    setLogForm({ ...logForm, subject: "", body: "" });
                    await load();
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Could not save log — check connection and retry.");
                  } finally {
                    setBusy(false);
                  }
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
