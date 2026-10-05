import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";
import { StatusNote } from "../components/StatusNote";

type Load = { status: "idle" | "running" | "done" | "failed"; startedAt?: string; finishedAt?: string; startedBy?: string; summary?: Record<string, unknown>; error?: string };

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
    </div>
  );
}
