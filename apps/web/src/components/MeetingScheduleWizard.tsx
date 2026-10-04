import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";
import { formatUiText } from "../lib/formatUiText";
import { StatusNote } from "./StatusNote";
import { Button, Input, Select } from "./ui";

/**
 * New meeting — Procore-style: 1) build the agenda, 2) schedule it and pick who is invited
 * from the communication matrix (Technical + Commercial), each as To or Cc.
 */

type Contact = {
  id: string;
  matrixKind: string;
  orgSection: string;
  orgName?: string | null;
  isSectionHeader?: boolean;
  personName?: string | null;
  designation?: string | null;
  company?: string | null;
  email?: string | null;
  mailRole?: string | null;
};

export type MeetingAttendee = {
  email: string;
  name?: string | null;
  company?: string | null;
  section?: string | null;
  mailRole: "TO" | "CC";
};

const STANDARD_AGENDA = [
  "Safety / toolbox talk",
  "Drawing revisions & publish status",
  "Checklist / QI progress",
  "Open RFIs & concerns",
  "Site progress vs programme",
  "Vendor / material coordination",
  "AOB",
];

const SECTION_ORDER = ["Client", "PMC", "Consultant", "Contractor", "Other"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const T = formatUiText;

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(11, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingScheduleWizard({
  open,
  projectId,
  token,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  token: string | null;
  onClose: () => void;
  onCreated: (meeting: { id: string; invite?: Record<string, unknown> | null }, attendeeCount: number) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("Weekly Site Coordination");
  const [items, setItems] = useState<string[]>([""]);
  const [when, setWhen] = useState(defaultStart);
  const [duration, setDuration] = useState("60");
  const [location, setLocation] = useState("Site cabin / Microsoft Teams");
  const [teams, setTeams] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<string, "TO" | "CC">>({});
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setErr("");
    setLoading(true);
    void Promise.all([
      api<Contact[]>(`/api/comms/contacts/${projectId}?kind=TECHNICAL`, { token }).catch(() => []),
      api<Contact[]>(`/api/comms/contacts/${projectId}?kind=COMMERCIAL`, { token }).catch(() => []),
    ])
      .then(([tech, comm]) => setContacts([...tech, ...comm].filter((c) => !c.isSectionHeader && c.email)))
      .finally(() => setLoading(false));
  }, [open, projectId, token]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  // One row per email (a person can sit on both matrices).
  const people = useMemo(() => {
    const byEmail = new Map<string, Contact & { kinds: string[] }>();
    for (const c of contacts) {
      const email = String(c.email).trim().toLowerCase();
      const prev = byEmail.get(email);
      if (prev) {
        if (!prev.kinds.includes(c.matrixKind)) prev.kinds.push(c.matrixKind);
        if (c.mailRole === "TO") prev.mailRole = "TO";
      } else {
        byEmail.set(email, { ...c, email, kinds: [c.matrixKind] });
      }
    }
    return [...byEmail.values()];
  }, [contacts]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = people.filter((p) =>
      !q
        ? true
        : `${p.personName || ""} ${p.designation || ""} ${p.company || p.orgName || ""} ${p.email}`.toLowerCase().includes(q),
    );
    const map = new Map<string, typeof shown>();
    for (const p of shown) {
      const sec = SECTION_ORDER.includes(p.orgSection) ? p.orgSection : "Other";
      map.set(sec, [...(map.get(sec) || []), p]);
    }
    return SECTION_ORDER.filter((s) => map.has(s)).map((s) => ({ section: s, rows: map.get(s)! }));
  }, [people, query]);

  const extraEmails = useMemo(
    () =>
      extra
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    [extra],
  );
  const badExtra = extraEmails.filter((e) => !EMAIL_RE.test(e));

  const attendees: MeetingAttendee[] = useMemo(() => {
    const list: MeetingAttendee[] = people
      .filter((p) => picked[p.email!])
      .map((p) => ({
        email: p.email!,
        name: p.personName || null,
        company: p.company || p.orgName || null,
        section: p.orgSection,
        mailRole: picked[p.email!],
      }));
    for (const e of extraEmails) {
      if (EMAIL_RE.test(e) && !list.some((a) => a.email === e)) list.push({ email: e, mailRole: "TO" });
    }
    return list;
  }, [people, picked, extraEmails]);

  const toCount = attendees.filter((a) => a.mailRole === "TO").length;
  const ccCount = attendees.length - toCount;
  const agenda = items.map((s) => s.trim()).filter(Boolean);

  function toggle(email: string, role: "TO" | "CC") {
    setPicked((p) => {
      const next = { ...p };
      if (next[email]) delete next[email];
      else next[email] = role;
      return next;
    });
  }

  function setGroup(rows: { email?: string | null; mailRole?: string | null }[], on: boolean) {
    setPicked((p) => {
      const next = { ...p };
      for (const r of rows) {
        if (!r.email) continue;
        if (on) next[r.email] = next[r.email] || (r.mailRole === "TO" ? "TO" : "CC");
        else delete next[r.email];
      }
      return next;
    });
  }

  function next() {
    if (!title.trim()) return setErr("Enter a meeting title.");
    if (!agenda.length) return setErr("Add at least one agenda item, or use the standard agenda.");
    setErr("");
    setStep(2);
  }

  async function submit() {
    if (!when || Number.isNaN(new Date(when).getTime())) return setErr("Choose the meeting date and time.");
    if (badExtra.length) return setErr(`Check these emails: ${badExtra.join(", ")}`);
    if (!attendees.length) return setErr("Select at least one person to invite.");
    setErr("");
    setSaving(true);
    try {
      const m = await api<{ id: string; invite?: Record<string, unknown> | null }>(`/api/comms/meetings/${projectId}`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title.trim(),
          meetingDate: new Date(when).toISOString(),
          location,
          status: "Agenda",
          durationMins: Number(duration) || 60,
          createTeams: teams,
          agendaItems: agenda,
          attendees,
        }),
      });
      onCreated(m, attendees.length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not schedule the meeting");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="register-modal" role="dialog" aria-modal="true" aria-label="New meeting" onClick={onClose}>
      <div className="register-modal__panel register-modal__panel--2xl" onClick={(e) => e.stopPropagation()}>
        <div className="register-modal__head register-modal__head--brand">
          <h3 className="font-semibold text-ink text-base sm:text-lg">{T("New meeting")}</h3>
          <button type="button" className="text-steel-muted hover:text-ink text-2xl leading-none px-2" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="register-modal__body space-y-4">
          <ol className="meet-steps" aria-label="Steps">
            <li className={step === 1 ? "is-on" : "is-done"}>
              <span>1</span> {T("Agenda")}
            </li>
            <li className={step === 2 ? "is-on" : ""}>
              <span>2</span> {T("Schedule & invite")}
            </li>
          </ol>

          {step === 1 ? (
            <div className="space-y-4">
              <Input label="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="ui-field__label">{T("Agenda items")}</span>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" className="!py-1.5 !text-xs" onClick={() => setItems([...STANDARD_AGENDA])}>
                      {T("Use standard site agenda")}
                    </Button>
                    <Button type="button" variant="secondary" className="!py-1.5 !text-xs" onClick={() => setItems((l) => [...l, ""])}>
                      + {T("Add item")}
                    </Button>
                  </div>
                </div>
                <ol className="meet-agenda">
                  {items.map((line, i) => (
                    <li key={i}>
                      <span className="meet-agenda__n">{i + 1}</span>
                      <Input
                        aria-label={`Agenda item ${i + 1}`}
                        value={line}
                        placeholder="Agenda item"
                        onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setItems((l) => [...l.slice(0, i + 1), "", ...l.slice(i + 1)]);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="meet-agenda__btn"
                        aria-label="Move up"
                        disabled={i === 0}
                        onClick={() => setItems((l) => { const c = [...l]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="meet-agenda__btn"
                        aria-label="Move down"
                        disabled={i === items.length - 1}
                        onClick={() => setItems((l) => { const c = [...l]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c; })}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="meet-agenda__btn meet-agenda__btn--del"
                        aria-label="Remove item"
                        onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [""]))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Input label="Date & time" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                <Select label="Duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
                  {["30", "45", "60", "90", "120", "180"].map((m) => (
                    <option key={m} value={m}>
                      {m} {T("minutes")}
                    </option>
                  ))}
                </Select>
                <Input label="Location" fieldClassName="lg:col-span-2" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={teams} onChange={(e) => setTeams(e.target.checked)} />
                {T("Add a Microsoft Teams link to the invite")}
              </label>

              <div className="meet-people">
                <div className="meet-people__head">
                  <div>
                    <span className="font-semibold text-ink">{T("Invite from the communication matrix")}</span>
                    <span className="block text-xs text-steel-muted">
                      {attendees.length
                        ? `${attendees.length} ${T("selected")} · ${toCount} To · ${ccCount} Cc`
                        : T("Tick the people to invite. To / Cc follows the matrix and can be changed.")}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      aria-label="Search people"
                      placeholder="Search name, company, email"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="!w-56"
                    />
                    <Button type="button" variant="ghost" className="!py-1.5 !text-xs" onClick={() => setGroup(people, true)}>
                      {T("Select all")}
                    </Button>
                    <Button type="button" variant="ghost" className="!py-1.5 !text-xs" onClick={() => setPicked({})}>
                      {T("Clear")}
                    </Button>
                  </div>
                </div>

                <div className="meet-people__list">
                  {loading ? <p className="p-4 text-sm text-steel-muted">{T("Loading the communication matrix")}…</p> : null}
                  {!loading && !people.length ? (
                    <p className="p-4 text-sm text-steel-muted">
                      {T("No one with an email on this project's communication matrix yet. Add people on the Matrix tab, or type emails below.")}
                    </p>
                  ) : null}
                  {groups.map(({ section, rows }) => {
                    const allOn = rows.every((r) => picked[r.email!]);
                    return (
                      <section key={section}>
                        <label className="meet-people__section">
                          <input type="checkbox" checked={allOn} onChange={(e) => setGroup(rows, e.target.checked)} />
                          {T(section)} <span className="text-steel-muted font-normal">({rows.length})</span>
                        </label>
                        {rows.map((p) => {
                          const role = picked[p.email!];
                          return (
                            <div key={p.email} className={`meet-people__row${role ? " is-on" : ""}`}>
                              <label className="meet-people__who">
                                <input
                                  type="checkbox"
                                  checked={!!role}
                                  onChange={() => toggle(p.email!, p.mailRole === "TO" ? "TO" : "CC")}
                                />
                                <span className="min-w-0">
                                  <span className="meet-people__name">{p.personName || p.email}</span>
                                  <span className="meet-people__meta" data-preserve-case>
                                    {[p.designation, p.company || p.orgName, p.email].filter(Boolean).join(" · ")}
                                  </span>
                                </span>
                              </label>
                              {role ? (
                                <div className="meet-people__role" role="group" aria-label="To or Cc">
                                  {(["TO", "CC"] as const).map((r) => (
                                    <button
                                      key={r}
                                      type="button"
                                      className={role === r ? "is-on" : ""}
                                      onClick={() => setPicked((x) => ({ ...x, [p.email!]: r }))}
                                    >
                                      {r === "TO" ? "To" : "Cc"}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </section>
                    );
                  })}
                </div>
              </div>

              <Input
                label="Other emails (optional)"
                hint="Comma-separated. Added as To."
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
          )}

          <StatusNote msg={err} tone="warn" />
        </div>

        <div className="register-modal__foot">
          {step === 1 ? (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                {T("Cancel")}
              </Button>
              <Button type="button" onClick={next}>
                {T("Next: schedule & invite")} →
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={saving}>
                ← {T("Back to agenda")}
              </Button>
              <Button type="button" onClick={() => submit()} disabled={saving}>
                {saving ? T("Scheduling…") : `${T("Schedule & send invite")} (${attendees.length})`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
