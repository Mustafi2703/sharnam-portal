/**
 * SharePoint / Graph status panel — surfaces the live provider mode so admins
 * can flip from "mock OneDrive" to real SharePoint for UAT and verify the
 * connection without shelling into the server.
 *
 * The API side (services/graph.ts + services/mockOneDrive.ts) already picks
 * SharePoint automatically when AZURE_TENANT_ID / CLIENT_ID / CLIENT_SECRET
 * are set and MOCK_ONEDRIVE is not "true".  This panel just tells you which
 * mode is active and gives a one-click connectivity test.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card } from "./ui";

type Health = {
  configured: boolean;
  mockOneDrive: boolean;
  mailbox: string | null;
  siteUrl: string | null;
  tokenOk: boolean;
  siteOk: boolean;
  siteId: string | null;
  siteName: string | null;
  driveId: string | null;
  driveName: string | null;
  rootItemCount: number | null;
  rootSample: { name: string; folder: boolean }[];
  error: string | null;
  checkedAt: string;
};

type Props = {
  token?: string;
};

export default function SharePointStatusPanel({ token }: Props) {
  const [status, setStatus] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const h = await api<Health>("/api/graph/status", { token });
      setStatus(h);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to load SharePoint status");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runTest() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ ok?: boolean; health?: Health; message?: string; error?: string; children?: unknown[] }>(
        "/api/graph/test-sharepoint",
        { method: "POST", token }
      );
      if (r.health) setStatus(r.health);
      if (r.ok) {
        setMsg(`✓ SharePoint online — ${r.children?.length ?? 0} items at the site root.`);
      } else {
        setMsg(`✗ ${r.error || r.message || "SharePoint test failed"}`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  const providerLabel = status?.configured && !status?.mockOneDrive
    ? "SharePoint (live)"
    : status?.configured
      ? "SharePoint configured, mock still active"
      : "Local mock OneDrive";

  const tone: "ok" | "warn" | "danger" | "neutral" =
    status?.configured && !status?.mockOneDrive && status?.tokenOk && status?.siteOk
      ? "ok"
      : status?.configured
        ? "warn"
        : "neutral";

  return (
    <Card className="sm:col-span-2 !p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base">Storage backend</h3>
          <p className="text-xs text-steel-muted">
            Where every uploaded file (drawings, RA bills, invoices, MoM, letters, HRMS docs) is stored.
          </p>
        </div>
        <Badge tone={tone}>{providerLabel}</Badge>
      </div>

      {status && (
        <div className="text-xs text-steel-muted grid sm:grid-cols-2 gap-y-1 gap-x-4 border border-line rounded-sm p-3 bg-paper">
          <div>
            <strong>Graph token:</strong>{" "}
            {status.tokenOk ? <span className="text-ok">OK</span> : <span className="text-danger">not acquired</span>}
          </div>
          <div>
            <strong>SharePoint site:</strong>{" "}
            {status.siteOk ? <span className="text-ok">reachable</span> : <span className="text-danger">unreachable</span>}
          </div>
          <div>
            <strong>Site URL:</strong> {status.siteUrl ? <code className="font-mono">{status.siteUrl}</code> : "—"}
          </div>
          <div>
            <strong>Mailbox:</strong> {status.mailbox || "—"}
          </div>
          <div>
            <strong>Drive:</strong> {status.driveName ? <>{status.driveName} · <code className="font-mono">{status.driveId?.slice(0, 12)}…</code></> : "—"}
          </div>
          <div>
            <strong>Root items:</strong> {status.rootItemCount ?? "—"}
          </div>
          <div className="sm:col-span-2 text-[10px] text-steel-muted">
            Last checked {new Date(status.checkedAt).toLocaleString("en-IN")}
          </div>
          {status.error && <div className="sm:col-span-2 text-danger">{status.error}</div>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Refresh status
        </Button>
        <Button type="button" onClick={runTest} disabled={busy || !status?.configured}>
          {busy ? "Testing…" : "Run SharePoint connectivity test"}
        </Button>
      </div>

      {msg && <p className="text-xs text-steel">{msg}</p>}

      {(!status?.configured || status?.mockOneDrive) && (
        <div className="text-xs bg-brand-soft border border-brand/30 rounded-sm p-3 space-y-2">
          <div className="font-semibold text-brand uppercase tracking-wide text-[10px]">
            How to switch to live SharePoint for UAT
          </div>
          <ol className="space-y-1 list-decimal ml-4 text-steel">
            <li>
              Register a Microsoft Entra ID app for Sharnam Portal (Azure Portal → Entra ID → App registrations → New).
            </li>
            <li>
              Grant application-level Graph permissions: <code>Sites.ReadWrite.All</code>, <code>Files.ReadWrite.All</code>, <code>Mail.Send</code>. Admin-consent from the tenant.
            </li>
            <li>
              Create a client secret. Copy the Tenant ID, Client ID, and Secret Value.
            </li>
            <li>
              Create (or pick) the SharePoint site for the PMC. Copy its full URL — e.g. <code>https://sharnam.sharepoint.com/sites/SharnamProjects</code>.
            </li>
            <li>
              Add to <code>.env</code> (dev) or Hostinger env panel (prod):
              <pre className="mt-1 p-2 bg-white border border-line rounded-sm font-mono whitespace-pre-wrap">
{`MOCK_ONEDRIVE=false
AZURE_TENANT_ID=…
AZURE_CLIENT_ID=…
AZURE_CLIENT_SECRET=…
SHAREPOINT_SITE_URL=https://<tenant>.sharepoint.com/sites/<sitename>
GRAPH_MAIL_FROM=pmc-portal@<tenant>.onmicrosoft.com
GRAPH_MAIL_ENABLED=true`}
              </pre>
            </li>
            <li>
              Restart the API. Come back and press <strong>Run SharePoint connectivity test</strong> — you should see "SharePoint online" and the site's root items.
            </li>
            <li>
              Everything already uploaded via mock stays on disk under <code>uploads/onedrive/&lt;projectCode&gt;/</code>. New uploads go to SharePoint; the mock is a fallback if the Graph call fails so no upload is ever lost.
            </li>
          </ol>
        </div>
      )}
    </Card>
  );
}
