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
    </div>
  );
}
