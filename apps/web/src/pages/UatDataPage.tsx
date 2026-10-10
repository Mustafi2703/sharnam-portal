import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";
import { StatusNote } from "../components/StatusNote";

type Load = { status: "idle" | "running" | "done" | "failed"; startedAt?: string; finishedAt?: string; startedBy?: string; summary?: Record<string, unknown>; error?: string };

type MailState = { live: boolean; source: "hosting" | "admin" | "off"; allow: string[] };

/** Portal email for UAT: on only for the test mailboxes SPDC owns; everyone else stays held. */
function MailSwitchCard({ token }: { token: string | null }) {
  const [state, setState] = useState<MailState | null>(null);
  const [allow, setAllow] = useState("");
  const [testTo, setTestTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<MailState>("/api/uat-data/mail", { token })
      .then((m) => {
        setState(m);
        setAllow(m.allow.join(", "));
      })
      .catch(() => undefined);
  }, [token]);
  async function save(live: boolean) {
    setBusy(true);
    setNote("");
    try {
      const m = await api<MailState>("/api/uat-data/mail", { method: "PUT", token, body: JSON.stringify({ live, allow }), headers: { "Content-Type": "application/json" } });
      setState(m);
      setAllow(m.allow.join(", "));
      setNote(live ? "Email is on — only the listed test mailboxes receive mail." : "Email is off — everything is held.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  async function sendTest() {
    setBusy(true);
    try {
      await api("/api/uat-data/mail/test", { method: "POST", token, body: JSON.stringify({ to: testTo }), headers: { "Content-Type": "application/json" } });
      setNote(`Test mail sent to ${testTo}.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">4. Test Email</h3>
        {state ? <Badge tone={state.live ? "ok" : "neutral"}>{state.source === "hosting" ? "On (hosting, all recipients)" : state.live ? "On (test list only)" : "Off — held"}</Badge> : null}
      </div>
      <p className="text-xs text-steel-muted">Use mailboxes SPDC owns for UAT. Mail is sent only to the addresses or @domains listed here; every other recipient (clients, vendors, .demo logins) stays held. Switch it off when UAT ends.</p>
      <Input label="Test mailboxes or @domains (comma separated)" value={allow} onChange={(e) => setAllow(e.target.value)} placeholder="uat1@spdc.in, @yourtestdomain.com" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || state?.source === "hosting"} onClick={() => void save(true)}>Switch email on</Button>
        <Button type="button" variant="secondary" disabled={busy || state?.source === "hosting"} onClick={() => void save(false)}>Switch email off</Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Input label="Send a test mail to" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="uat1@spdc.in" />
        <Button type="button" variant="secondary" disabled={busy || !testTo || !state?.live} onClick={() => void sendTest()}>Send test mail</Button>
      </div>
      {note ? <p className="text-sm">{note}</p> : null}
    </Card>
  );
}

/** Simulated working days: every register gets a day's activity; removable in one click. */
function SimulateCard({ token }: { token: string | null }) {
  const [projects, setProjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [days, setDays] = useState(5);
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<{ status: string; done: number; total: number; summary: Record<string, number>; error?: string; projectCode?: string } | null>(null);
  const [note, setNote] = useState("");
  const project = projects.find((p) => p.id === projectId);
  useEffect(() => {
    void api<{ id: string; code: string; name: string }[]>("/api/uat-data/projects", { token }).then(setProjects).catch(() => undefined);
    void api<any>("/api/uat-data/simulate/status", { token }).then(setState).catch(() => undefined);
  }, [token]);
  useEffect(() => {
    if (state?.status !== "running") return;
    const t = setInterval(() => void api<any>("/api/uat-data/simulate/status", { token }).then(setState).catch(() => undefined), 3000);
    return () => clearInterval(t);
  }, [state?.status, token]);
  async function run(path: "simulate" | "simulate/remove") {
    setNote("");
    try {
      const out = await api<any>(`/api/uat-data/${path}`, { method: "POST", token, body: JSON.stringify({ projectId, days, confirm }), headers: { "Content-Type": "application/json" } });
      if (path === "simulate") setState(out);
      else setNote(`Removed: ${Object.entries(out.removed).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing to remove"}.`);
      setConfirm("");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed");
    }
  }
  return (
    <Card className="space-y-3">
      <h3 className="font-semibold">5. Simulate Working Days</h3>
      <p className="text-xs text-steel-muted">
        Fills the project as a running site would, one day at a time (Sundays skipped): site observations and instructions with photos, NCR / CAR raised and closed, cube groups with 7- and 28-day results, quality / site / safety checklist fills with photos, F-01 requests,
        daily safety log and safety records, and Civil DPR lines that carry forward day to day. Everything is tagged [SIM] — "Remove simulated data" takes out only that. Use a UAT project, not live work.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-steel-muted">
          Project
          <select className="block mt-1 rounded-lg border border-line bg-white px-3 py-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Choose…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>
        <Input label="Days (ending today, max 30)" type="number" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        <Input label={project ? `Type ${project.code} to confirm` : "Type the project code"} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!projectId || !confirm || state?.status === "running"} onClick={() => void run("simulate")}>
          Simulate days
        </Button>
        <Button type="button" variant="danger" disabled={!projectId || !confirm} onClick={() => void run("simulate/remove")}>
          Remove simulated data
        </Button>
      </div>
      {state && state.status !== "idle" ? (
        <p className="text-sm">
          {state.status === "running" ? `Simulating ${state.projectCode}… ${state.done}/${state.total} days` : state.status === "done" ? `Done — ${state.projectCode}:` : `Failed: ${state.error}`}{" "}
          {Object.entries(state.summary || {}).map(([k, v]) => `${v} ${k}`).join(" · ")}
        </p>
      ) : null}
      {note ? <p className="text-sm">{note}</p> : null}
    </Card>
  );
}

/** Which environment am I on? */
function EnvironmentCard({ token }: { token: string | null }) {
  const [env, setEnv] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    void api<any>("/api/uat-data/environment", { token }).then(setEnv).catch((e) => setErr(e instanceof Error ? e.message : "Could not load"));
  }, [token]);
  const live = env && env.sharePoint?.live;
  return (
    <Card className="space-y-2">
      <h3 className="font-semibold">0. Environment</h3>
      {err ? <p className="text-sm text-danger">{err}</p> : null}
      {env ? (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="text-steel-muted">Commit</span> <strong className="font-mono">{env.commit}</strong> · {env.nodeEnv || "—"}</p>
          <p><span className="text-steel-muted">Database</span> <strong className="font-mono">{env.database.name || "—"}</strong> on {env.database.host || "—"}</p>
          <p><span className="text-steel-muted">Rows</span> {env.counts.users} logins ({env.counts.activeUsers} active) · {env.counts.projects} projects · {env.counts.candidates} candidates · {env.counts.offers} offers · {env.counts.employees} employee files</p>
          <p><span className="text-steel-muted">SharePoint</span> {live ? <Badge tone="ok">live</Badge> : <Badge tone="warn">local copy only</Badge>} {env.sharePoint?.site ? env.sharePoint.site.replace(/^https?:\/\//, "") : ""}</p>
          <p><span className="text-steel-muted">Email</span> {env.mail?.live ? <Badge tone="ok">on ({env.mail.source})</Badge> : <Badge tone="neutral">held</Badge>}</p>
          <p><span className="text-steel-muted">Server time</span> {new Date(env.serverTime).toLocaleString()}</p>
        </div>
      ) : !err ? <p className="text-sm text-steel-muted">Loading…</p> : null}
    </Card>
  );
}

/** Every `employee` login is a consultant (needs a company) or SPDC staff — decide each one. */
function EmployeeRoleCard({ token }: { token: string | null }) {
  type Row = { id: string; email: string; fullName: string; department: string; designation: string; company: string; linked: boolean; suggestion: string };
  const [rows, setRows] = useState<Row[] | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  async function load() {
    try {
      const r = await api<Row[]>("/api/uat-data/employee-role-audit", { token });
      setRows(r);
      setChoice(Object.fromEntries(r.map((x) => [x.id, x.suggestion])));
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not load");
    }
  }
  async function apply() {
    const items = (rows || []).filter((r) => choice[r.id] && choice[r.id] !== "keep").map((r) => ({ userId: r.id, action: choice[r.id] }));
    if (!items.length) return setNote("Nothing to change.");
    try {
      const out = await api<any>("/api/uat-data/employee-role-audit/apply", { method: "POST", token, body: JSON.stringify({ items }), headers: { "Content-Type": "application/json" } });
      setNote(`Updated ${out.done}.${out.failed?.length ? ` Failed: ${out.failed.join("; ")}` : ""}`);
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed");
    }
  }
  return (
    <Card className="space-y-3">
      <h3 className="font-semibold">9. Employee Role Cleanup</h3>
      <p className="text-xs text-steel-muted">
        "Employee" is only for consultants / stakeholders, and they must be linked to a company. Anything else is SPDC staff and should be Office, HR or Site. Each login below is either a consultant, SPDC staff, or already linked. Pick what each should be, then apply.
        Job titles are separate (the designation field) — they never change the login role.
      </p>
      <Button type="button" variant="secondary" onClick={() => void load()}>{rows ? "Refresh" : "Check employee logins"}</Button>
      {rows ? (
        <div className="divide-y divide-line border border-line rounded-lg max-h-80 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <strong>{r.fullName}</strong>
              <span className="font-mono text-xs text-steel-muted">{r.email}</span>
              <span className="text-xs text-steel-muted">{r.company || [r.designation, r.department].filter(Boolean).join(" · ") || "no details"}</span>
              <select className="ml-auto rounded-lg border border-line bg-white px-2 py-1 text-xs" value={choice[r.id] || "keep"} onChange={(e) => setChoice({ ...choice, [r.id]: e.target.value })}>
                <option value="keep">Leave as is</option>
                <option value="link-consultant">Consultant — link to company</option>
                <option value="office">SPDC office</option>
                <option value="site_employee">SPDC site</option>
                <option value="hr">SPDC HR</option>
              </select>
            </div>
          ))}
          {!rows.length ? <p className="px-3 py-2 text-sm text-steel-muted">No `employee` logins.</p> : null}
        </div>
      ) : null}
      {rows?.length ? <Button type="button" onClick={() => void apply()}>Apply choices</Button> : null}
      {note ? <p className="text-sm">{note}</p> : null}
    </Card>
  );
}

/** Role map — the UAT logins against the role and company link each must have. */
function RoleMapCard({ token }: { token: string | null }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [note, setNote] = useState("");
  async function load() {
    try {
      setRows(await api<any[]>("/api/uat-data/role-map", { token }));
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not load");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  async function fix(email: string) {
    setNote("");
    try {
      const out = await api<any>("/api/uat-data/role-map/apply", { method: "POST", token, body: JSON.stringify({ email }), headers: { "Content-Type": "application/json" } });
      setNote(`${email} is now ${out.role}${out.linked ? `, linked to ${out.linked}` : ""}.`);
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not fix");
    }
  }
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">8. Role Map</h3>
        <Button type="button" variant="secondary" onClick={() => void load()}>Re-check</Button>
      </div>
      <p className="text-xs text-steel-muted">
        The role comes from the company type in the CRM directory: Client → client (read-only), Consultant / Designer / PMC → employee linked to the company, Contractor / vendor → vendor, SPDC staff → site_employee / hr / office, SPDC admin → admin.
        Anything that does not match is listed with the reason; <strong>Fix</strong> sets the role, switches the login on and links the company by e-mail.
      </p>
      <div className="divide-y divide-line border border-line rounded-lg">
        {(rows || []).map((r) => (
          <div key={r.email} className="px-3 py-2 text-sm space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={r.ok ? "ok" : "warn"}>{r.ok ? "OK" : "Check"}</Badge>
              <strong>{r.label}</strong>
              <span className="font-mono text-xs text-steel-muted">{r.email}</span>
              <span className="text-xs">expects <strong>{r.expectedRole}</strong>{r.expectedParty ? ` · ${r.expectedParty} company` : ""}</span>
              {!r.ok && r.found ? <Button type="button" className="!text-xs !py-1" onClick={() => void fix(r.email)}>Fix</Button> : null}
            </div>
            <div className="text-xs text-steel-muted">
              {r.found ? `now: ${r.role} · ${r.portal} portal · ${r.isActive ? "active" : "off"}${r.company ? ` · ${r.company}` : ""} · ${r.projects.length ? r.projects.join(", ") : "no projects"}` : "not created yet"}
            </div>
            {r.issues.length ? <ul className="list-disc pl-5 text-xs text-steel-muted">{r.issues.map((i: string) => <li key={i}>{i}</li>)}</ul> : null}
          </div>
        ))}
        {!rows ? <p className="px-3 py-2 text-sm text-steel-muted">Loading…</p> : null}
      </div>
      {note ? <p className="text-sm">{note}</p> : null}
    </Card>
  );
}

/** Remove every login except Voltamp members, admins, protected accounts and you — preview first. */
function CleanLoginsCard({ token }: { token: string | null }) {
  type Row = { id: string; email: string; fullName: string; role: string; why: string };
  const [plan, setPlan] = useState<{ voltamp: string[]; keep: Row[]; hr: Row[]; other: Row[] } | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setNote("");
    try {
      const p = await api<any>("/api/uat-data/logins-cleanup-preview", { token });
      setPlan(p);
      setPick(p.other.map((r: Row) => r.id)); // staff with HR records stay unticked
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not load");
    }
  }
  async function run() {
    if (!window.confirm(`Remove ${pick.length} login(s)? They lose project access and any HR profile; the address becomes free to re-add. Payslips and attendance history stay on file.`)) return;
    setBusy(true);
    try {
      const out = await api<any>("/api/uat-data/logins-cleanup", { method: "POST", token, body: JSON.stringify({ userIds: pick, confirm }), headers: { "Content-Type": "application/json" } });
      setNote(`Removed ${out.removed} login(s). ${out.kept} kept.`);
      setConfirm("");
      await load();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  const toggle = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const list = (title: string, rows: Row[], hint: string) => (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title} ({rows.length})</h4>
        <span className="flex gap-2 text-xs">
          <button type="button" className="text-brand font-semibold" onClick={() => setPick((p) => [...new Set([...p, ...rows.map((r) => r.id)])])}>Tick all</button>
          <button type="button" className="text-steel-muted" onClick={() => setPick((p) => p.filter((id) => !rows.some((r) => r.id === id)))}>Clear</button>
        </span>
      </div>
      <p className="text-xs text-steel-muted mb-1">{hint}</p>
      <div className="max-h-64 overflow-y-auto divide-y divide-line border border-line rounded-lg">
        {rows.map((r) => (
          <label key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={pick.includes(r.id)} onChange={() => toggle(r.id)} />
            <span className="font-medium">{r.fullName}</span>
            <span className="font-mono text-xs text-steel-muted">{r.email}</span>
            <Badge tone="neutral">{r.role}</Badge>
            <span className="text-xs text-steel-muted">{r.why}</span>
          </label>
        ))}
        {!rows.length ? <p className="px-3 py-2 text-sm text-steel-muted">None.</p> : null}
      </div>
    </div>
  );
  return (
    <Card className="space-y-3">
      <h3 className="font-semibold">7. Clean Logins</h3>
      <p className="text-xs text-steel-muted">
        Keeps Voltamp project members, admins, protected SPDC / UAT accounts and you. Everything else is listed below for removal — removed logins lose project access and their HR profile, and the address can be added again. Payslips and attendance history stay on file.
        Staff with an HR record or payslips are listed separately and start unticked.
      </p>
      <Button type="button" variant="secondary" onClick={() => void load()}>{plan ? "Refresh list" : "Preview what would be removed"}</Button>
      {plan ? (
        <div className="space-y-3">
          <p className="text-sm">
            Keeping <strong>{plan.keep.length}</strong>: {plan.keep.slice(0, 12).map((k) => k.fullName).join(", ")}
            {plan.keep.length > 12 ? "…" : ""}. Voltamp project: {plan.voltamp.join(", ") || "not found yet — only admins, protected accounts and you are kept"}.
          </p>
          {list("Logins with no HR record", plan.other, "Client / vendor / consultant logins, test users and staff without payroll data. Ticked by default.")}
          {list("Staff with an HR record or payslips", plan.hr, "Real SPDC staff data — review carefully. Unticked by default.")}
          <div className="flex flex-wrap items-end gap-2">
            <Input label="Type REMOVE to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button type="button" variant="danger" disabled={busy || !pick.length || confirm !== "REMOVE"} onClick={() => void run()}>
              {busy ? "Removing…" : `Remove ${pick.length} login(s)`}
            </Button>
          </div>
        </div>
      ) : null}
      {note ? <p className="text-sm">{note}</p> : null}
    </Card>
  );
}

/** Find any login by e-mail (even one hidden from the lists) and bring it back. */
function FindLoginCard({ token }: { token: string | null }) {
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<any>(null);
  const [role, setRole] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  async function find() {
    setNote("");
    setFound(null);
    try {
      const out = await api<any>(`/api/uat-data/user?email=${encodeURIComponent(email.trim())}`, { token });
      setFound(out);
      setRole("");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Lookup failed");
    }
  }
  async function restore() {
    setNote("");
    try {
      const out = await api<any>("/api/uat-data/user/restore", { method: "POST", token, body: JSON.stringify({ email, role: role || undefined, password: password || undefined }), headers: { "Content-Type": "application/json" } });
      setNote(`Done — ${out.email} is ${out.isActive ? "active" : "off"} as ${out.role}. Reload Users to see it.`);
      setPassword("");
      await find();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not restore");
    }
  }
  return (
    <Card className="space-y-3">
      <h3 className="font-semibold">6. Find A Login</h3>
      <p className="text-xs text-steel-muted">Says "email already has a login" but you cannot see it in Users? Look it up here: it shows the role, whether it is switched off or marked removed, and why the lists skip it. Then bring it back.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Input label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        <Button type="button" variant="secondary" disabled={!email.trim()} onClick={() => void find()}>Find</Button>
      </div>
      {found && !found.found ? <p className="text-sm">No login with {found.email}. If "add user" still refuses it, the address is on a candidate or a vendor record instead.</p> : null}
      {found?.found ? (
        <div className="space-y-2 text-sm">
          <p>
            <strong>{found.fullName}</strong> · {found.email} · role <strong>{found.role}</strong> · {found.isActive ? "active" : "switched off"}
            {found.projects?.length ? ` · projects: ${found.projects.join(", ")}` : " · no projects"}
          </p>
          {found.hiddenBecause?.length ? (
            <ul className="list-disc pl-5 text-steel-muted">{found.hiddenBecause.map((r: string) => <li key={r}>{r}</li>)}</ul>
          ) : (
            <p className="text-steel-muted">Nothing hides this login — it should be on the lists.</p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold text-steel-muted">
              Set role (optional)
              <select className="block mt-1 rounded-lg border border-line bg-white px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Keep {found.role}</option>
                {["site_employee", "employee", "hr", "office", "client", "vendor"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <Input label="New password (optional, 8+ characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="button" onClick={() => void restore()}>Switch on / restore</Button>
          </div>
        </div>
      ) : null}
      {note ? <p className="text-sm">{note}</p> : null}
    </Card>
  );
}

/** Admin · UAT data — load the Arvind data SPDC shared, then clear test projects and test logins. */
export default function UatDataPage() {
  const { token, user } = useAuth();
  const [load, setLoad] = useState<Load>({ status: "idle" });
  const [arvind, setArvind] = useState<any[]>([]);
  const [preview, setPreview] = useState<{ keep: string[]; projects: any[]; testLogins: any[] } | null>(null);
  const [pickProjects, setPickProjects] = useState<string[]>([]);
  const [pickUsers, setPickUsers] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    try {
      const st = await api<{ load: Load; arvind: any[] }>("/api/uat-data/status", { token });
      setLoad(st.load);
      setArvind(st.arvind);
      setPreview(await api("/api/uat-data/cleanup-preview", { token }));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not load");
    }
  }, [token]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (load.status !== "running") return;
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [load.status, refresh]);

  if (user?.role !== "admin") {
    return <p className="text-sm text-steel-muted">Only an admin login can open the UAT data desk.</p>;
  }

  async function startLoad() {
    if (!window.confirm("Load the Arvind NTX and dormitory week data now? It takes a few minutes and files the registers to SharePoint. Emails stay on hold.")) return;
    setBusy("load");
    try {
      const out = await api<{ load: Load }>("/api/uat-data/load-arvind", { method: "POST", token });
      setLoad(out.load);
      setMsg("Loading the Arvind data… this page refreshes every few seconds.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy("");
    }
  }

  async function deleteProjects() {
    const rows = (preview?.projects || []).filter((p) => pickProjects.includes(p.id));
    if (!rows.length) return setMsg("Tick the test projects to delete.");
    if (confirmText.trim() !== "DELETE") return setMsg('Type DELETE in the box to confirm.');
    if (!window.confirm(`Permanently delete ${rows.length} project(s): ${rows.map((r) => r.code).join(", ")}? All their records go. This cannot be undone. SharePoint folders stay.`)) return;
    setBusy("projects");
    const done: string[] = [];
    const failed: string[] = [];
    for (const p of rows) {
      try {
        await api(`/api/projects/${p.id}`, { method: "DELETE", token, body: JSON.stringify({ confirmCode: p.code }) });
        done.push(p.code);
      } catch (err) {
        failed.push(`${p.code} (${err instanceof Error ? err.message : "failed"})`);
      }
    }
    setBusy("");
    setPickProjects([]);
    setConfirmText("");
    setMsg(`Deleted ${done.length}: ${done.join(", ") || "none"}.${failed.length ? ` Could not delete: ${failed.join("; ")}` : ""}`);
    await refresh();
  }

  async function deactivateLogins() {
    if (!pickUsers.length) return setMsg("Tick the test logins to switch off.");
    if (!window.confirm(`Switch off ${pickUsers.length} test login(s)? They can be switched back on under Access · Users.`)) return;
    setBusy("users");
    try {
      const out = await api<{ deactivated: number }>("/api/uat-data/deactivate-logins", { method: "POST", token, body: JSON.stringify({ userIds: pickUsers, confirm: "DEACTIVATE" }) });
      setMsg(`${out.deactivated} test login(s) switched off.`);
      setPickUsers([]);
      await refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not switch off");
    } finally {
      setBusy("");
    }
  }

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Office admin" title="UAT Data" subtitle="Load the Arvind week data SPDC shared, then clear leftover test projects and test logins before the client UAT." />

      <EnvironmentCard token={token} />
      <StatusNote msg={msg} onClose={() => setMsg("")} />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">1. Load The Arvind Data</h3>
            <p className="text-xs text-steel-muted max-w-2xl">
              Arvind NTX (week 3) and the Arvind dormitory (23–29 Jul): parties and communication matrix, drawing register and GFC log, QAP Week 50, checklist fills, DPR, WPR 52, budget, PR tracker, site materials and cashflow — from the SPDC sheets. Re-running updates the same two projects. Party logins get the UAT password Demo@1234; emails stay on hold.
            </p>
          </div>
          <Button type="button" disabled={busy === "load" || load.status === "running"} onClick={() => void startLoad()}>
            {load.status === "running" ? "Loading…" : "Load Arvind data"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs items-center">
          <Badge tone={load.status === "done" ? "ok" : load.status === "failed" ? "danger" : load.status === "running" ? "warn" : "neutral"}>{load.status}</Badge>
          {load.startedAt ? <span className="text-steel-muted">Started {new Date(load.startedAt).toLocaleString()} by {load.startedBy}</span> : null}
          {load.finishedAt ? <span className="text-steel-muted">· Finished {new Date(load.finishedAt).toLocaleString()}</span> : null}
          {load.error ? <span className="text-red-700">· {load.error}</span> : null}
        </div>
        {arvind.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {arvind.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-sand/40">
                <span className="font-mono text-xs text-brand mr-2">{p.code}</span>
                {p.name} <span className="text-[11px] text-steel-muted">· {p._count.drawings} drawings · {p._count.rfis} RFIs</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">2. Delete Test Projects</h3>
        <p className="text-xs text-steel-muted">Every project other than {preview?.keep.join(" and ")} is listed. Tick only the test ones. Deleting removes the project and all its records from the portal; SharePoint folders are left for you to tidy by hand.</p>
        <div className="divide-y divide-line border border-line rounded-lg">
          {(preview?.projects || []).map((p) => (
            <label key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm cursor-pointer">
              <input type="checkbox" checked={pickProjects.includes(p.id)} onChange={() => toggle(pickProjects, setPickProjects, p.id)} />
              <span className="font-mono text-xs text-brand">{p.code}</span>
              <span className="font-medium">{p.name}</span>
              <span className="text-[11px] text-steel-muted">
                {p.status} · {p._count.drawings} drawings · {p._count.rfis} RFIs · {p._count.members} members · created {new Date(p.createdAt).toLocaleDateString()}
              </span>
            </label>
          ))}
          {!preview?.projects.length && <p className="px-3 py-2 text-sm text-steel-muted">No other projects.</p>}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input label='Type DELETE to confirm' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <Button type="button" variant="danger" disabled={busy === "projects" || !pickProjects.length} onClick={() => void deleteProjects()}>
            {busy === "projects" ? "Deleting…" : `Delete ${pickProjects.length || ""} project(s)`}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">3. Switch Off Test Logins</h3>
        <p className="text-xs text-steel-muted">Logins with test-style emails (.test, example.com, .demo, no-login). Switching off is reversible under Access · Users. Real SPDC, client and vendor logins are not listed.</p>
        <div className="divide-y divide-line border border-line rounded-lg">
          {(preview?.testLogins || []).map((u) => (
            <label key={u.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm cursor-pointer">
              <input type="checkbox" checked={pickUsers.includes(u.id)} onChange={() => toggle(pickUsers, setPickUsers, u.id)} />
              <span className="font-medium">{u.fullName}</span>
              <span className="font-mono text-xs">{u.email}</span>
              <Badge tone="neutral">{u.role}</Badge>
            </label>
          ))}
          {!preview?.testLogins.length && <p className="px-3 py-2 text-sm text-steel-muted">No test logins found.</p>}
        </div>
        <Button type="button" variant="secondary" disabled={busy === "users" || !pickUsers.length} onClick={() => void deactivateLogins()}>
          {busy === "users" ? "Switching off…" : `Switch off ${pickUsers.length || ""} login(s)`}
        </Button>
      </Card>

      <MailSwitchCard token={token} />

      <SimulateCard token={token} />

      <FindLoginCard token={token} />

      <CleanLoginsCard token={token} />

      <RoleMapCard token={token} />

      <EmployeeRoleCard token={token} />
    </div>
  );
}
