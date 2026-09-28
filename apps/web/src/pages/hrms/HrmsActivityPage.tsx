import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card } from "../../components/ui";

type AuditRow = {
  id: string;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  createdAt: string;
  user?: { fullName?: string; email?: string; role?: string } | null;
};

type RuntimeRow = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
  userEmail?: string;
  detail?: string;
};

type LogKind = "actions" | "errors" | null;

/** HRMS activity — counts on the page, the full log inside a window. */
export default function HrmsActivityPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [runtime, setRuntime] = useState<RuntimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState<LogKind>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const pack = await api<{ events: AuditRow[]; runtime: RuntimeRow[] }>("/api/hrm/activity", { token });
      setEvents(Array.isArray(pack.events) ? pack.events : []);
      setRuntime(Array.isArray(pack.runtime) ? pack.runtime : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load HRMS activity");
      setEvents([]);
      setRuntime([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-steel-muted max-w-2xl">
          Staff changes and API failures are kept here. Open a log to read the rows. The page itself stays short.
        </p>
        <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>
      {loadError ? (
        <p className="text-sm rounded-lg px-3 py-2 bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] text-danger border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)]">
          {loadError}
        </p>
      ) : null}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="!p-4">
          <p className="text-xs uppercase tracking-wide text-steel-muted">Runtime errors</p>
          <p className="text-2xl font-semibold mt-1">{loading ? "…" : runtime.length}</p>
          <p className="text-xs text-steel-muted mt-1">API failures since this server started.</p>
          <Button type="button" className="mt-3" variant="secondary" onClick={() => setOpen("errors")} disabled={loading}>
            Open error log
          </Button>
        </Card>
        <Card className="!p-4">
          <p className="text-xs uppercase tracking-wide text-steel-muted">HRMS actions</p>
          <p className="text-2xl font-semibold mt-1">{loading ? "…" : events.length}</p>
          <p className="text-xs text-steel-muted mt-1">Who changed recruitment, letters, leave, and payroll.</p>
          <Button type="button" className="mt-3" onClick={() => setOpen("actions")} disabled={loading}>
            Open action log
          </Button>
        </Card>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/45" role="dialog" aria-modal="true" aria-label="HRMS log">
          <div className="bg-paper border border-line rounded-xl w-full max-w-5xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
              <p className="font-semibold text-sm">{open === "errors" ? `Runtime errors (${runtime.length})` : `HRMS actions (${events.length})`}</p>
              <Button type="button" variant="secondary" onClick={() => setOpen(null)}>Close</Button>
            </div>
            <div className="overflow-auto">
              {open === "errors" ? (
                <table className="min-w-[720px] w-full text-sm">
                  <thead className="sticky top-0 bg-sand/80 text-left text-xs uppercase tracking-wide text-steel-muted">
                    <tr>
                      <th>When</th>
                      <th>Level</th>
                      <th>Source</th>
                      <th>What happened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runtime.map((row) => (
                      <tr key={row.id} className="border-t border-line align-top">
                        <td className="whitespace-nowrap text-xs text-steel-muted">{new Date(row.at).toLocaleString("en-IN")}</td>
                        <td><Badge tone={row.level === "error" ? "warn" : "brand"}>{row.level}</Badge></td>
                        <td className="font-mono text-xs">{row.source}</td>
                        <td>
                          <div>{row.message}</div>
                          {row.userEmail ? <div className="text-xs text-steel-muted">{row.userEmail}</div> : null}
                        </td>
                      </tr>
                    ))}
                    {!runtime.length && (
                      <tr><td colSpan={4} className="py-8 text-center text-sm text-steel-muted">No API failures recorded since this server started.</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-[720px] w-full text-sm">
                  <thead className="sticky top-0 bg-sand/80 text-left text-xs uppercase tracking-wide text-steel-muted">
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th>Action</th>
                      <th>Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-t border-line">
                        <td className="whitespace-nowrap text-xs text-steel-muted">{new Date(e.createdAt).toLocaleString("en-IN")}</td>
                        <td>
                          {e.user?.fullName || "—"}
                          {e.user?.email ? <div className="text-xs text-steel-muted">{e.user.email}</div> : null}
                        </td>
                        <td className="font-medium">{e.action}</td>
                        <td className="text-steel-muted text-xs">{[e.entity, e.entityId ? e.entityId.slice(0, 10) : ""].filter(Boolean).join(" · ") || "—"}</td>
                      </tr>
                    ))}
                    {!events.length && (
                      <tr><td colSpan={4} className="py-8 text-center text-sm text-steel-muted">No HRMS actions yet.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
