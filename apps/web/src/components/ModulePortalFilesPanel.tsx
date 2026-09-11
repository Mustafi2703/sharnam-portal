import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { downloadAuthFile } from "../lib/downloadReport";
import { Badge, Button, Card } from "./ui";
import type { ModuleFileConfig } from "../lib/moduleIsoFolders";

type PortalRow = {
  id: string;
  kind: "rfi" | "ncr";
  ref: string;
  title: string;
  status: string;
  updated?: string;
  portalPath: string;
  downloadPath?: string;
};

type Props = {
  projectId: string;
  token?: string | null;
  config: ModuleFileConfig;
};

/** Live portal records for a module — RFIs, NCR/CAR with links to forms and branded exports. */
export function ModulePortalFilesPanel({ projectId, token, config }: Props) {
  const [rows, setRows] = useState<PortalRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      setErr("");
      const out: PortalRow[] = [];
      try {
        if (config.rfiKinds?.length) {
          const kinds = config.rfiKinds.join(",");
          const r = await api<{ rfis: any[] }>(`/api/rfis/project/${projectId}?kind=${encodeURIComponent(kinds)}`, {
            token,
          });
          for (const x of r.rfis || []) {
            out.push({
              id: x.id,
              kind: "rfi",
              ref: x.number || "RFI",
              title: x.subject || x.title || "—",
              status: x.status || "Open",
              updated: x.updatedAt || x.createdAt,
              portalPath: `/projects/${projectId}/rfis?kind=${encodeURIComponent(x.rfiKind || "All")}`,
              downloadPath: `/api/rfis/${x.id}/download.xlsx`,
            });
          }
        }
        if (config.showQualityNcr || config.showSafetyNcr) {
          const dash = await api<any>(`/api/checklist/project/${projectId}/quality-dashboard`, { token }).catch(() => null);
          const ncrs = dash?.ncrs || dash?.qualityNcrs || [];
          for (const n of ncrs) {
            const isSafety = /safety|hse|sncr/i.test(String(n.recordType || n.title || n.number || ""));
            if (isSafety && !config.showSafetyNcr) continue;
            if (!isSafety && !config.showQualityNcr) continue;
            out.push({
              id: n.id,
              kind: "ncr",
              ref: n.number || n.code || "NCR",
              title: n.description || n.title || "—",
              status: n.status || "Open",
              updated: n.updatedAt || n.issueDate,
              portalPath: `/projects/${projectId}/ncr-form/quality/${n.id}`,
              downloadPath: `/api/checklist/project/${projectId}/ncr/${n.id}/export.xlsx`,
            });
          }
        }
        if (!cancelled) setRows(out.slice(0, 40));
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load portal records");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, token, config.rfiKinds, config.showQualityNcr, config.showSafetyNcr]);

  const grouped = useMemo(() => {
    const rfis = rows.filter((r) => r.kind === "rfi");
    const ncrs = rows.filter((r) => r.kind === "ncr");
    return { rfis, ncrs };
  }, [rows]);

  if (!config.rfiKinds?.length && !config.showQualityNcr && !config.showSafetyNcr && !config.registerExports?.length) return null;

  const registerExports = (config.registerExports || []).filter((r) => r.downloadPath);

  return (
    <Card className="!p-0 overflow-hidden shrink-0">
      {registerExports.length > 0 && (
        <div className="px-4 py-3 border-b border-line bg-brand/5 flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-ink">Register workbooks</h3>
            <p className="text-xs text-steel-muted mt-0.5">
              Download branded XLSX or refresh DMS — files drop into ISO folders above on publish / Dump logs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {registerExports.map((r) => (
              <Button
                key={r.label}
                type="button"
                variant="secondary"
                className="!text-xs"
                onClick={() =>
                  void downloadAuthFile(
                    r.downloadPath.replace(":projectId", projectId),
                    token ?? null,
                    `${r.label.replace(/\s+/g, "-")}.xlsx`
                  )
                }
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Portal records</h3>
          <p className="text-xs text-steel-muted mt-0.5">
            Forms and registers from this module — open in portal or download XLSX. Closed items are also filed to SharePoint above.
          </p>
        </div>
        {config.rfiKinds?.length ? (
          <Link to={`/projects/${projectId}/rfis`} className="text-xs font-semibold text-brand">
            Full RFI register →
          </Link>
        ) : null}
      </div>
      {err && <p className="text-xs text-danger px-4 py-2">{err}</p>}
      {busy ? (
        <p className="text-sm text-steel-muted px-4 py-6">Loading portal records…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-steel-muted px-4 py-6">No RFIs or NCR/CAR rows yet for this module.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-steel-muted border-b border-line bg-white">
                <th className="py-2 px-4">Type</th>
                <th className="py-2 pr-3">Ref</th>
                <th className="py-2 pr-3 min-w-[12rem]">Subject</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...grouped.rfis, ...grouped.ncrs].map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-b border-line/60 hover:bg-sand/30">
                  <td className="py-2 px-4 text-xs uppercase text-steel-muted">{r.kind === "rfi" ? "RFI" : "NCR/CAR"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.ref}</td>
                  <td className="py-2 pr-3">{r.title}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={/closed|approved|pass/i.test(r.status) ? "ok" : /open|draft/i.test(r.status) ? "warn" : "neutral"}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="py-2 px-4 text-right whitespace-nowrap">
                    <Link to={r.portalPath} className="text-xs font-semibold text-brand mr-3">
                      Open
                    </Link>
                    {r.downloadPath && token ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="!text-xs !py-0 !px-1"
                        onClick={() => void downloadAuthFile(r.downloadPath!, token, `${r.ref}.xlsx`)}
                      >
                        XLSX
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
