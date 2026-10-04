import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea, WorkflowStrip } from "../components/ui";
import { CommsMatrixPanel } from "../components/CommsMatrixPanel";
import { ReferenceSheetToolbar } from "../components/ReferenceSheetToolbar";
import { SearchableSelect } from "../components/SearchableSelect";
import { UploadModal } from "../components/UploadModal";
import { isToolWindow } from "../lib/moduleToolWindow";
import { StatusNote } from "../components/StatusNote";
import { MeetingScheduleWizard } from "../components/MeetingScheduleWizard";

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
  const [itemOwnerId, setItemOwnerId] = useState("");
  const [itemDue, setItemDue] = useState("");
  const [people, setPeople] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [momOpen, setMomOpen] = useState(false);
  const [momFile, setMomFile] = useState<File | null>(null);
  const [momError, setMomError] = useState("");
  const [agendaDraft, setAgendaDraft] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  // "New meeting" from the right panel / hub links → ?new=1 opens the agenda wizard once.
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setWizardOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [logForm, setLogForm] = useState({ subject: "", body: "", toRoles: "client", channel: "In-App" });

  const canEdit =
    user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";

  const load = async () => {
    const [l, meet, techContacts, commContacts, p, overview] = await Promise.all([
      api<any[]>(`/api/comms/logs/${id}`, { token }),
      api<any[]>(`/api/comms/meetings/${id}`, { token }),
      api<any[]>(`/api/comms/contacts/${id}?kind=TECHNICAL`, { token }).catch(() => []),
      api<any[]>(`/api/comms/contacts/${id}?kind=COMMERCIAL`, { token }).catch(() => []),
      api<any>(`/api/projects/${id}`, { token }).catch(() => null),
      api<{ members?: any[] }>(`/api/directory/project/${id}/overview`, { token }).catch(() => null),
    ]);
    setLogs(l);
    setMeetings(meet);
    setProject(p);
    setPeople((overview?.members || []).map((m: any) => m.user || m).filter((u: any) => u?.id));

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
      } catch {
        setContacts(matrixKind === "COMMERCIAL" ? commContacts : techContacts);
      }
    } else {
      setContacts(matrixKind === "COMMERCIAL" ? commContacts : techContacts);
    }

    const want = searchParams.get("meeting");
    if (want && meet.some((m: any) => m.id === want)) setActiveMeeting(want);
    else if (!activeMeeting && meet[0]) setActiveMeeting(meet[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token, matrixKind]);

  const selected = meetings.find((m) => m.id === activeMeeting);
  const agendaMeetings = useMemo(() => meetings.filter((m) => m.status === "Agenda" || m.status === "Scheduled"), [meetings]);
  const momMeetings = useMemo(() => meetings.filter((m) => m.status === "MoM"), [meetings]);
  const followMeetings = useMemo(() => meetings.filter((m) => m.status === "Follow-up"), [meetings]);

  const flowActive = tab === "matrix" ? 0 : tab === "agenda" ? 1 : tab === "mom" ? 2 : tab === "followup" ? 3 : 1;

  async function generateAgenda() {
    if (!activeMeeting) return;
    setBusy(true);
    setMsg("");
    try {
      const lines = agendaDraft
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const hasAgenda = !!selected?.items?.some((it: any) => it.category === "Agenda");
      const out = await api<{ reused?: boolean; notify?: { skipped?: boolean } }>(
        `/api/comms/meetings/${activeMeeting}/generate-agenda`,
        {
          method: "POST",
          token,
          // Existing agenda → re-send it to the invitees instead of silently doing nothing.
          body: JSON.stringify({ items: lines, agendaNotes: agendaDraft || undefined, force: hasAgenda || undefined }),
        },
      );
      const who = selected?.attendeesJson ? "the invited attendees" : "the communication matrix";
      setMsg(
        out?.notify?.skipped
          ? "Agenda saved. No email went out — nobody on the invite list has an email yet."
          : hasAgenda
            ? `Agenda re-sent to ${who}.`
            : `Agenda published and sent to ${who}.`,
      );
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

  const personOptions = useMemo(
    () =>
      people.map((u: any) => ({
        value: u.id,
        label: u.fullName || u.email || u.id,
        sublabel: [u.role, u.email].filter(Boolean).join(" · "),
        keywords: `${u.email || ""} ${u.role || ""}`,
      })),
    [people]
  );

  async function uploadMom(e: FormEvent) {
    e.preventDefault();
    if (!activeMeeting || !momFile) return;
    setBusy(true);
    setMomError("");
    try {
      const fd = new FormData();
      fd.append("file", momFile);
      const updated = await api<any>(`/api/comms/meetings/${activeMeeting}/mom-file`, {
        method: "POST",
        token,
        body: fd,
      });
      setMomFile(null);
      setMomOpen(false);
      setTab("mom");
      setActiveMeeting(updated.id);
      setMsg(updated.momFileName ? `MoM file saved: ${updated.momFileName}. Add or follow up action points below.` : "MoM uploaded.");
      await load();
    } catch (err) {
      setMomError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const commsTabs: { id: Tab; label: string }[] = [
    { id: "matrix", label: "Matrix" },
    { id: "agenda", label: "Agenda" },
    { id: "mom", label: "MoM" },
    { id: "followup", label: "Follow-up" },
    { id: "log", label: "Log" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/workspace`} className="text-sm text-brand font-medium">
          ← Workspaces
        </Link>
        <PageHeader
          eyebrow="Communications"
          title="Meetings · MoM"
          subtitle="Set who is on the matrix, schedule the meeting and agenda, upload and keep MoM after it is held, then close follow-up points. Use Ask (PMC RFI) for drawing questions — not inside MoM."
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
          { label: "Agenda", hint: "Schedule + set agenda" },
          { label: "MoM", hint: "Upload minutes + actions" },
          { label: "Follow-up", hint: "Close discussed points" },
        ]}
      />

      <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 -mx-1 px-1">
        {commsTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold border min-h-10 ${
              tab === t.id ? "bg-brand text-white border-brand" : "bg-paper border-line text-ink"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <StatusNote msg={msg} />

      {id && (
        <MeetingScheduleWizard
          open={wizardOpen}
          projectId={id}
          token={token}
          onClose={() => setWizardOpen(false)}
          onCreated={(m, count) => {
            setWizardOpen(false);
            setActiveMeeting(m.id);
            setTab("agenda");
            const invite = (m.invite || {}) as {
              email?: { skipped?: boolean; transport?: string; error?: string };
              error?: string;
              teamsJoinUrl?: string;
            };
            const who = `${count} ${count === 1 ? "person" : "people"}`;
            setMsg(
              invite.error || invite.email?.error
                ? `Meeting scheduled — but the invite could not be sent: ${invite.error || invite.email?.error}`
                : invite.email?.skipped
                  ? `Meeting scheduled for ${who}. No invite was emailed — check the project email settings.`
                  : invite.email?.transport === "mock"
                    ? `Meeting scheduled for ${who}. The invite is logged and will be emailed once portal mail is switched on.`
                    : `Meeting scheduled — invite emailed to ${who}${invite.teamsJoinUrl ? " with a Teams link" : ""}.`,
            );
            void load();
          }}
        />
      )}

      {tab === "matrix" && id && (
        <CommsMatrixPanel
          projectId={id}
          token={token!}
          project={project}
          matrixKind={matrixKind}
          onMatrixKindChange={setMatrixKind}
          contacts={contacts}
          canEdit={canEdit}
          allowCreateCompany={user?.role === "admin" || user?.role === "office"}
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
          onAddRow={tab === "agenda" ? () => setWizardOpen(true) : undefined}
          addRowLabel="+ New meeting"
        />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] gap-4">
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
            {canEdit && tab === "agenda" && !listForTab.length && (
              <p className="p-3 border-t border-line text-[11px] text-steel-muted leading-snug">
                Use + New meeting: build the agenda first, then schedule it and pick attendees from the communication matrix.
              </p>
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
                      {(() => {
                        let list: { email: string; name?: string | null; company?: string | null; mailRole: string }[] = [];
                        try {
                          list = selected.attendeesJson ? JSON.parse(selected.attendeesJson) : [];
                        } catch {
                          list = [];
                        }
                        if (!list.length) return null;
                        return (
                          <div className="meet-attendees">
                            <span className="meet-attendees__label">
                              Invited ({list.length})
                            </span>
                            {list.map((a) => (
                              <span key={a.email} className={`meet-attendees__chip${a.mailRole === "CC" ? " is-cc" : ""}`} title={a.email} data-preserve-case>
                                {a.name || a.email}
                                {a.company ? <span className="opacity-70"> · {a.company}</span> : null}
                                <span className="meet-attendees__role">{a.mailRole === "CC" ? "Cc" : "To"}</span>
                              </span>
                            ))}
                          </div>
                        );
                      })()}
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
                      {selected.momFileUrl && (
                        <p className="text-xs mt-2">
                          <a
                            href={`${apiBase()}${selected.momFileUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-brand hover:underline"
                          >
                            Current MoM file: {selected.momFileName || "Open"}
                          </a>
                          {selected.momUploadedAt ? (
                            <span className="text-steel-muted">
                              {" "}
                              · {new Date(selected.momUploadedAt).toLocaleString()}
                            </span>
                          ) : null}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-2">
                        {selected.status === "Agenda" || selected.status === "Scheduled" ? (
                          <>
                            <Button type="button" variant="secondary" disabled={busy} onClick={() => void generateAgenda()}>
                              {selected.items?.some((it: any) => it.category === "Agenda") ? "Re-send agenda" : "Publish agenda"}
                            </Button>
                            <Button type="button" disabled={busy} onClick={() => void startMom()}>
                              Start MoM
                            </Button>
                            <Button type="button" variant="secondary" disabled={busy} onClick={() => { setMomError(""); setMomOpen(true); }}>
                              Upload MoM
                            </Button>
                          </>
                        ) : null}
                        {(selected.status === "MoM" || selected.status === "Follow-up") && (
                          <Button type="button" variant="secondary" disabled={busy} onClick={() => { setMomError(""); setMomOpen(true); }}>
                            {selected.momFileUrl ? "Replace MoM file" : "Upload MoM"}
                          </Button>
                        )}
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

                {canEdit && (selected.status === "Agenda" || selected.status === "Scheduled") && (
                  <Card>
                    <p className="text-xs font-semibold mb-2">Set agenda</p>
                    <TextArea
                      rows={4}
                      value={agendaDraft}
                      onChange={(e) => setAgendaDraft(e.target.value)}
                      placeholder="One agenda point per line. Publish to lock the list before the meeting. After the meeting, upload MoM and record actions."
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button type="button" disabled={busy} onClick={() => void generateAgenda()}>
                        Publish agenda
                      </Button>
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => { setMomError(""); setMomOpen(true); }}>
                        Upload MoM after meeting
                      </Button>
                    </div>
                  </Card>
                )}

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
                        <div className="min-w-0">
                          <Badge tone="neutral">{it.category}</Badge>
                          <div className="mt-1 font-medium">{it.description}</div>
                          <div className="text-[11px] text-steel-muted mt-1">
                            {it.assignedTo?.fullName ? `Owner: ${it.assignedTo.fullName}` : "No owner"}
                            {it.dueDate ? ` · Due ${new Date(it.dueDate).toLocaleDateString()}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={it.resolutionStatus === "Open" || it.resolutionStatus === "Carried Over" ? "warn" : "ok"}>
                            {it.resolutionStatus}
                          </Badge>
                          {canEdit && (it.resolutionStatus === "Open" || it.resolutionStatus === "Carried Over") && (
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
                          {canEdit && it.resolutionStatus === "Closed" && (tab === "followup" || tab === "mom") && (
                            <Button
                              type="button"
                              variant="ghost"
                              className="!text-xs"
                              onClick={async () => {
                                await api(`/api/comms/meetings/items/${it.id}`, {
                                  method: "PATCH",
                                  token,
                                  body: JSON.stringify({ resolutionStatus: "Open" }),
                                });
                                await load();
                              }}
                            >
                              Reopen
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
                              assignedToId: itemOwnerId || undefined,
                              dueDate: itemDue || undefined,
                            }),
                          });
                          setItemDesc("");
                          setItemOwnerId("");
                          setItemDue("");
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
                      {(tab === "mom" || tab === "followup") && (
                        <>
                          <div className="w-full sm:w-56">
                            <SearchableSelect
                              options={personOptions}
                              value={itemOwnerId}
                              onChange={setItemOwnerId}
                              searchPlaceholder="Owner from directory…"
                            />
                          </div>
                          <Input
                            type="date"
                            className="w-full sm:w-40"
                            value={itemDue}
                            onChange={(e) => setItemDue(e.target.value)}
                          />
                        </>
                      )}
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

      <UploadModal
        open={momOpen}
        title={selected?.momFileUrl ? "Replace MoM file" : "Upload minutes of meeting"}
        context={selected ? `${selected.title} · ${new Date(selected.meetingDate).toLocaleString()}` : undefined}
        file={momFile}
        onFile={setMomFile}
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.xlsx"
        fields={[]}
        primaryLabel={selected?.status === "Agenda" || selected?.status === "Scheduled" ? "Upload & start MoM" : "Save MoM file"}
        busy={busy}
        error={momError}
        onClose={() => {
          setMomOpen(false);
          setMomFile(null);
          setMomError("");
        }}
        onSubmit={(e) => void uploadMom(e)}
      />

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
