import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button } from "./ui";

type GraphHealth = {
  configured: boolean;
  mockOneDrive: boolean;
  tokenOk: boolean;
  siteOk: boolean;
  siteUrl: string | null;
  driveName: string | null;
  error: string | null;
};

export function SharePointStatusBanner({ compact }: { compact?: boolean }) {
  const { token } = useAuth();
  const [health, setHealth] = useState<GraphHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [probeMsg, setProbeMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    void api<GraphHealth>("/api/graph/status", { token })
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [token]);

  const live = health && health.configured && !health.mockOneDrive && health.tokenOk && health.siteOk;

  async function probe() {
    setBusy(true);
    setProbeMsg("");
    try {
      const r = await api<{ ok: boolean; items?: unknown[]; error?: string }>("/api/graph/test-sharepoint", {
        method: "POST",
        token,
      });
      setProbeMsg(r.ok ? `SharePoint OK · ${r.items?.length ?? 0} library items at root` : r.error || "Probe failed");
    } catch (err) {
      setProbeMsg(err instanceof Error ? err.message : "Probe failed");
    } finally {
      setBusy(false);
    }
  }

  if (!health) return null;

  if (live) {
    return compact ? (
      <Badge tone="ok">SharePoint live · {health.driveName || "Documents"}</Badge>
    ) : (
      <div className="rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>SharePoint connected.</strong> Publish saves to{" "}
          <code className="text-xs font-mono">{health.siteUrl}</code>
          {health.driveName ? ` · ${health.driveName}` : ""}.
        </span>
        <Badge tone="ok">Live</Badge>
      </div>
    );
  }

  return compact ? (
    <Badge tone="warn">Mock drive — set MOCK_ONEDRIVE=false</Badge>
  ) : (
    <div className="rounded-lg border border-warn/40 bg-warn/5 px-4 py-3 text-sm space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <strong>SharePoint not live.</strong> Files save locally until Azure Graph is configured on the server.
          {!health.configured && (
            <p className="text-xs text-steel-muted mt-1">
              Missing: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
            </p>
          )}
          {health.configured && health.mockOneDrive && (
            <p className="text-xs text-steel-muted mt-1">
              Set <code className="font-mono">MOCK_ONEDRIVE=false</code> and{" "}
              <code className="font-mono">SHAREPOINT_SITE_URL=https://spdcsmb.sharepoint.com/sites/SharnamProjects</code> on
              Hostinger (see <code className="font-mono">.env.hostinger.example</code>).
            </p>
          )}
          {health.error && <p className="text-xs text-danger mt-1">{health.error}</p>}
          {probeMsg && <p className="text-xs mt-1">{probeMsg}</p>}
        </div>
        <div className="flex gap-2 items-center">
          <Badge tone="warn">Mock / offline</Badge>
          {health.configured && (
            <Button type="button" variant="secondary" onClick={() => void probe()} disabled={busy}>
              Test SharePoint
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
