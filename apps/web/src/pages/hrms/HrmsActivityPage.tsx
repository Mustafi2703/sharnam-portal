import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card } from "../../components/ui";

type AuditRow = {
  id: string;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  metaJson?: string | null;
  createdAt: string;
  user?: { fullName?: string; email?: string; role?: string } | null;
};

type RuntimeRow = {
  id: string;
  at: string;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
  status?: number;
  method?: string;
  path?: string;
  userEmail?: string;
  detail?: string;
};

/** HRMS activity — staff actions + API failures visible without Office Audit. */
export default function HrmsActivityPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [runtime, setRuntime] = useState<RuntimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
          Employee create, assign, leave, letters, and recruitment writes land here. Runtime rows are API failures from this server process — they reset on restart.
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

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold">
          Runtime errors ({runtime.length})
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-steel-muted">Loading…</p>
        ) : runtime.length === 0 ? (
          <p className="px-4 py-8 text-sm text-steel-muted">No API failures recorded since this server started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-sand/30 text-left text-xs uppercase tracking-wide text-steel-muted">
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2 font-semibold">Level</th>
                  <th className="px-4 py-2 font-semibold">Source</th>
                  <th className="px-4 py-2 font-semibold">What happened</th>
                </tr>
              </thead>
              <tbody>
                {runtime.map((row) => (
                  <tr key={row.id} className="border-b border-line/60 align-top">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-steel-muted">
                      {new Date(row.at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={row.level === "error" ? "warn" : "brand"}>{row.level}</Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{row.source}</td>
                    <td className="px-4 py-2.5">
                      <div>{row.message}</div>
                      {row.userEmail ? <div className="text-xs text-steel-muted">{row.userEmail}</div> : null}
                      {row.detail ? (
                        <pre className="mt-1 text-[11px] text-steel-muted whitespace-pre-wrap break-words max-h-28 overflow-y-auto">
                          {row.detail}
                        </pre>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold">
          HRMS actions ({events.length})
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-steel-muted">Loading…</p>
        ) : events.length === 0 ? (
          <p className="px-4 py-8 text-sm text-steel-muted">
            No HRMS audit rows yet. Create a staff login or assign someone to a project, then refresh.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-sand/30 text-left text-xs uppercase tracking-wide text-steel-muted">
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2 font-semibold">Who</th>
                  <th className="px-4 py-2 font-semibold">Action</th>
                  <th className="px-4 py-2 font-semibold">Record</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-line/60">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-steel-muted">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.user?.fullName || "—"}
                      {e.user?.email ? <div className="text-xs text-steel-muted">{e.user.email}</div> : null}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{e.action}</td>
                    <td className="px-4 py-2.5 text-steel-muted text-xs">
                      {[e.entity, e.entityId ? e.entityId.slice(0, 10) : ""].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
