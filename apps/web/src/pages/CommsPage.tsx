import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea, WorkflowStrip } from "../components/ui";

type Tab = "matrix" | "agenda" | "mom" | "followup" | "log";

function roleLabel(role: string) {
  const map: Record<string, string> = {
    client: "Client",
    office: "Sharnam PMC",
    employee: "Design consultant",
    vendor: "Main contractor",
    site_employee: "Site / concrete works",
    admin: "Admin",
  };
  return map[role] || role.replace(/_/g, " ");
}

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
  const [contacts, setContacts] = useState<any[]>([]);
  const [matrixKind, setMatrixKind] = useState<"TECHNICAL" | "COMMERCIAL">("TECHNICAL");
  const [logs, setLogs] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [itemDesc, setItemDesc] = useState("");
  const [itemCategory, setItemCategory] = useState("Agenda");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [matrixForm, setMatrixForm] = useState({
    communicationType: "Technical coordination",
    fromRole: "office",
    toRole: "client",
    frequency: "Weekly",
    channel: "Meeting",
  });
  // Presets: Meeting only — RFIs live under Ask (PMC RFI), not as duplicate meeting channels
  const TOPIC_PRESETS = [
    { label: "Site Meeting", communicationType: "Site Meeting", channel: "Meeting", frequency: "Weekly" },
    { label: "Design Meeting", communicationType: "Design Meeting", channel: "Meeting", frequency: "Bi-weekly" },
    { label: "Commercial Meeting", communicationType: "Commercial Meeting", channel: "Meeting", frequency: "Monthly" },
  ];
  const [contactForm, setContactForm] = useState({
    orgSection: "Client",
    orgName: "",
    personName: "",
    designation: "",
    company: "",
    spoc: "",
    mobile: "",
    email: "",
    mailRole: "CC",
    officeAddress: "",
  });
  const ORG_ROLES = [
    { value: "client", label: "Client" },
    { value: "office", label: "Sharnam PMC" },
    { value: "employee", label: "Design consultant" },
    { value: "vendor", label: "Main contractor" },
    { value: "site_employee", label: "Site / concrete works" },
  ];
  const ORG_SECTIONS = ["Client", "PMC", "Consultant", "Contractor", "Other"];
  const [schedule, setSchedule] = useState({
    title: "Weekly Site Coordination",
    meetingDate: new Date().toISOString().slice(0, 16),
    location: "Site cabin / Teams",
  });
  const [logForm, setLogForm] = useState({ subject: "", body: "", toRoles: "client", channel: "In-App" });

  const canEdit =
    user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";

  const load = async () => {
    const [m, l, meet, c] = await Promise.all([
      api<any[]>(`/api/comms/matrix/${id}`, { token }),
      api<any[]>(`/api/comms/logs/${id}`, { token }),
      api<any[]>(`/api/comms/meetings/${id}`, { token }),
      api<any[]>(`/api/comms/contacts/${id}?kind=${matrixKind}`, { token }).catch(() => []),
    ]);
    setMatrix(m);
    setLogs(l);
    setMeetings(meet);
    setContacts(c);
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
          title="Meetings · MoM"
          subtitle="Simple flow: set Matrix (who) → Create meeting → Agenda → MoM (minutes + actions) → Follow-up. Use Ask (PMC RFI) for questions — not inside MoM."
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

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["matrix", "1 · Matrix"],
            ["agenda", "2 · Create / Agenda"],
            ["mom", "3 · MoM"],
            ["followup", "4 · Follow-up"],
            ["log", "Comm log"],
          ] as const
        ).map(([k, label]) => (
          <Button key={k} type="button" variant={tab === k ? "primary" : "secondary"} onClick={() => setTab(k)}>
            {label}
          </Button>
        ))}
        <Link to={`/projects/${id}/email`} className="ml-auto">
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

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      {tab === "matrix" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2 items-center">
            {(["TECHNICAL", "COMMERCIAL"] as const).map((k) => (
              <Button key={k} type="button" variant={matrixKind === k ? "primary" : "secondary"} onClick={() => setMatrixKind(k)}>
                {k === "TECHNICAL" ? "Technical matrix" : "Commercial matrix"}
              </Button>
            ))}
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                className="!text-sm"
                onClick={async () => {
                  await api(`/api/comms/contacts/${id}/seed-demo`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ matrixKind }),
                  });
                  setMsg(`${matrixKind} matrix seeded from project client / PMC / consultant / contractor.`);
                  await load();
                }}
              >
                Seed BPCL-style rows
              </Button>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="secondary"
                className="!text-sm"
                onClick={async () => {
                  const r = await api<{ created: number }>(`/api/comms/matrix/${id}/seed-standard`, {
                    method: "POST",
                    token,
                  });
                  setMsg(`Meeting + RFI topic matrix: added ${r.created} row(s).`);
                  await load();
                }}
              >
                Seed Meeting + RFI parties
              </Button>
            )}
          </div>

          <Card className="!bg-procore-navy !text-white !border-0">
            <div className="text-[11px] uppercase tracking-wider text-white/60">Subject</div>
            <div className="font-display text-xl mt-1">{matrixKind} COMMUNICATION MATRIX</div>
            <p className="text-sm text-white/75 mt-2">
              Per-project contact sheet — Name · Designation · Company · SPOC · Mobile · Email · TO/CC · Office address
              (same columns as your BPCL Excel).
            </p>
          </Card>

          {canEdit && (
            <Card>
              <h3 className="font-semibold mb-3">Add contact / org section</h3>
              <form
                className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await api(`/api/comms/contacts/${id}`, {
                    method: "POST",
                    token,
                    body: JSON.stringify({ ...contactForm, matrixKind, company: contactForm.company || contactForm.orgName }),
                  });
                  setContactForm({
                    orgSection: contactForm.orgSection,
                    orgName: contactForm.orgName,
                    personName: "",
                    designation: "",
                    company: "",
                    spoc: "",
                    mobile: "",
                    email: "",
                    mailRole: "CC",
                    officeAddress: "",
                  });
                  await load();
                }}
              >
                <Select value={contactForm.orgSection} onChange={(e) => setContactForm({ ...contactForm, orgSection: e.target.value })}>
                  {ORG_SECTIONS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Input placeholder="Organisation name" value={contactForm.orgName} onChange={(e) => setContactForm({ ...contactForm, orgName: e.target.value })} required />
                <Input placeholder="Person name" value={contactForm.personName} onChange={(e) => setContactForm({ ...contactForm, personName: e.target.value })} />
                <Input placeholder="Designation" value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} />
                <Input placeholder="Company" value={contactForm.company} onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })} />
                <Input placeholder="Single point of contact (SPOC)" value={contactForm.spoc} onChange={(e) => setContactForm({ ...contactForm, spoc: e.target.value })} />
                <Input placeholder="Mobile" value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} />
                <Input placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                <Select value={contactForm.mailRole} onChange={(e) => setContactForm({ ...contactForm, mailRole: e.target.value })}>
                  <option value="TO">TO</option>
                  <option value="CC">CC</option>
                </Select>
                <Input className="sm:col-span-2" placeholder="Office address" value={contactForm.officeAddress} onChange={(e) => setContactForm({ ...contactForm, officeAddress: e.target.value })} />
                <Button type="submit">Add to {matrixKind} matrix</Button>
              </form>
            </Card>
          )}

          <Card padding={false} className="overflow-x-auto">
            <div className="px-4 py-3 border-b font-semibold bg-procore-navy text-white flex justify-between gap-2">
              <span>{matrixKind} · Contact register</span>
              <span className="text-[11px] font-normal text-white/70">{contacts.length} rows</span>
            </div>
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-sand text-left text-[10px] uppercase tracking-wider text-steel-muted sticky top-0">
                <tr>
                  <th className="p-3">Sr</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Designation</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">SPOC</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">TO/CC</th>
                  <th className="p-3">Office address</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((r, idx) =>
                  r.isSectionHeader ? (
                    <tr key={r.id} className="bg-brand-soft/80 border-t border-line">
                      <td className="p-3 font-mono font-semibold text-brand">{String.fromCharCode(65 + (idx % 26))}</td>
                      <td className="p-3 font-semibold text-ink" colSpan={8}>
                        {r.orgName}
                        <span className="ml-2 text-xs font-normal text-steel-muted">({r.orgSection})</span>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="border-t border-line hover:bg-sand/40">
                      <td className="p-3 font-mono text-xs text-steel-muted">{r.sortOrder || idx + 1}</td>
                      <td className="p-3 font-medium">{r.personName || "—"}</td>
                      <td className="p-3">{r.designation || "—"}</td>
                      <td className="p-3">{r.company || r.orgName || "—"}</td>
                      <td className="p-3 text-xs">{r.spoc || "—"}</td>
                      <td className="p-3 font-mono text-xs">{r.mobile || "—"}</td>
                      <td className="p-3 text-xs break-all">{r.email || "—"}</td>
                      <td className="p-3">
                        <Badge tone={r.mailRole === "TO" ? "brand" : "neutral"}>{r.mailRole || "—"}</Badge>
                      </td>
                      <td className="p-3 text-xs text-steel-muted max-w-[180px]">{r.officeAddress || "—"}</td>
                    </tr>
                  )
                )}
                {!contacts.length && (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-steel-muted text-sm">
                      No contacts yet — click <strong>Seed BPCL-style rows</strong> or add people above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <details className="text-sm" open>
            <summary className="cursor-pointer font-semibold text-steel-muted">Topic routing — Meeting + RFI parties</summary>
            <Card className="mt-3 space-y-3 !p-4">
              <p className="text-xs text-steel-muted">
                Define who talks for Meetings and RFIs. Use <strong>Seed Meeting + RFI parties</strong> above, or add rows
                with presets.
              </p>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {TOPIC_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className="text-xs px-2.5 py-1.5 border border-line rounded-md hover:border-brand"
                      onClick={() =>
                        setMatrixForm({
                          ...matrixForm,
                          communicationType: p.communicationType,
                          channel: p.channel,
                          frequency: p.frequency,
                        })
                      }
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
              {canEdit && (
                <form
                  className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await api(`/api/comms/matrix/${id}`, { method: "POST", token, body: JSON.stringify(matrixForm) });
                    setMsg("Topic routing row added.");
                    await load();
                  }}
                >
                  <Input
                    value={matrixForm.communicationType}
                    onChange={(e) => setMatrixForm({ ...matrixForm, communicationType: e.target.value })}
                    placeholder="Type"
                  />
                  <Select value={matrixForm.fromRole} onChange={(e) => setMatrixForm({ ...matrixForm, fromRole: e.target.value })}>
                    {ORG_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  <Select value={matrixForm.toRole} onChange={(e) => setMatrixForm({ ...matrixForm, toRole: e.target.value })}>
                    {ORG_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  <Select value={matrixForm.channel} onChange={(e) => setMatrixForm({ ...matrixForm, channel: e.target.value })}>
                    <option value="Meeting">Meeting</option>
                    <option value="RFI">RFI</option>
                    <option value="Email">Email</option>
                  </Select>
                  <Button type="submit">Add row</Button>
                </form>
              )}
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
                      <td className="p-3">{roleLabel(r.fromRole)}</td>
                      <td className="p-3">{roleLabel(r.toRole)}</td>
                      <td className="p-3">{r.frequency}</td>
                      <td className="p-3">
                        <Badge tone={r.channel === "Meeting" ? "ok" : r.channel === "RFI" ? "brand" : "neutral"}>
                          {r.channel}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {!matrix.length && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-steel-muted text-sm">
                        No topic rows — seed Meeting + RFI parties.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </details>
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
