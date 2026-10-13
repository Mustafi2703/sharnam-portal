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
  /** Shown in the Type column, e.g. "RFI", "Quality IR", "QI fill". */
  typeLabel?: string;
};

const IR_TAB: Record<string, string> = { QualityIR: "quality-ir", SafetyIR: "safety-ir", ActivityInspection: "activity-checklist" };
const TYPE_LABEL: Record<string, string> = {
  RequestForInformation: "RFI",
  Manual: "RFI",
  DrawingChecklist: "Drawing check fill",
  QualityInspection: "QI fill request",
  SafetyChecklist: "Safety fill request",
  SiteExecution: "Site checklist fill",
  QualityIR: "Quality IR",
  SafetyIR: "Safety IR",
  ActivityInspection: "Activity checklist",
  ClientConcern: "Client concern",
};

type Props = {
  projectId: string;
  token?: string | null;
  config: ModuleFileConfig;
};

type ReportRow = {
  id: string;
  /** DPR: log date · WPR: week ending (YYYY-MM-DD) */
  date: string;
  discipline?: string;
  reportNumber?: number | null;
  status: string;
  publishedAt?: string | null;
  publishedPath?: string | null;
  publishedUrl?: string | null;
  updatedAt?: string;
};

const fmtDay = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const isoDay = (d: string) => new Date(d).toISOString().slice(0, 10);

/** Published DPR / WPR register — one row per report with maker link, SharePoint copy and downloads. */
function PublishedReportsPanel({ projectId, token, kind }: { projectId: string; token?: string | null; kind: "dpr" | "wpr" }) {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setErr("");
    api<any[]>(`/api/${kind}-maker/${projectId}/recent`, { token })
      .then((list) => {
        if (cancelled) return;
        setRows(
          (list || []).map((x) => ({
            id: x.id,
            date: kind === "dpr" ? x.logDate : x.weekEnding,
            discipline: x.discipline,
            reportNumber: x.reportNumber,
            status: x.status || "Draft",
            publishedAt: x.publishedAt,
            publishedPath: x.publishedPath,
            publishedUrl: x.publishedUrl,
            updatedAt: x.updatedAt,
          }))
        );
      })
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : "Failed to load reports"))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, token, kind]);

  const shown = rows.filter((r) => (filter === "all" ? true : filter === "published" ? /published/i.test(r.status) : !/published/i.test(r.status)));
  const published = rows.filter((r) => /published/i.test(r.status)).length;
  const makerPath = (r: ReportRow) =>
    kind === "dpr"
      ? `/projects/${projectId}/dpr-maker?date=${isoDay(r.date)}&discipline=${encodeURIComponent(r.discipline || "CIVIL")}`
      : `/projects/${projectId}/wpr-maker?end=${isoDay(r.date)}`;
  const downloads = (r: ReportRow): { label: string; path: string; name: string }[] => {
    const day = isoDay(r.date);
    if (kind === "dpr") {
      const disc = encodeURIComponent(r.discipline || "CIVIL");
      return [{ label: "XLSX", path: `/api/dpr-maker/${projectId}/download.xlsx?date=${day}&discipline=${disc}`, name: `DPR-${r.discipline || "CIVIL"}-${day}.xlsx` }];
    }
    return [
      { label: "XLSX", path: `/api/wpr-maker/${projectId}/download.xlsx?end=${day}`, name: `WPR-${day}.xlsx` },
      { label: "Client pack", path: `/api/wpr-maker/${projectId}/download-client.xlsx?end=${day}`, name: `WPR-ClientPack-${day}.xlsx` },
      { label: "PPTX", path: `/api/wpr-maker/${projectId}/download.pptx?end=${day}`, name: `WPR-${day}.pptx` },
      { label: "PDF", path: `/api/wpr-maker/${projectId}/download.pdf?end=${day}`, name: `WPR-${day}.pdf` },
    ];
  };

  return (
    <Card className="!p-0 overflow-hidden shrink-0">
      <div className="px-4 py-3 border-b border-line bg-brand/5 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{kind === "dpr" ? "Daily Progress Reports" : "Weekly Progress Reports"}</h3>
          <p className="text-xs text-steel-muted mt-0.5">
            {published} published · {rows.length - published} draft — open the report in the maker, its SharePoint copy, or download the branded files. The folder browser below shows the same files in SharePoint.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "published", "draft"] as const).map((f) => (
            <Button key={f} type="button" variant={filter === f ? "primary" : "ghost"} className="!text-xs !py-1 !px-2 capitalize" onClick={() => setFilter(f)}>
              {f}
            </Button>
          ))}
          <Link to={`/projects/${projectId}/${kind}-maker`} className="text-xs font-semibold text-brand ml-2">
            Open {kind.toUpperCase()} maker →
          </Link>
        </div>
      </div>
      {err && <p className="text-xs text-danger px-4 py-2">{err}</p>}
      {busy ? (
        <p className="text-sm text-steel-muted px-4 py-6">Loading reports…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-steel-muted px-4 py-6">No {kind.toUpperCase()}s yet — publish one from the maker and it appears here with its SharePoint copy.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-steel-muted border-b border-line bg-white">
                <th className="py-2 px-4">{kind === "dpr" ? "Date" : "Week ending"}</th>
                <th className="py-2 pr-3">{kind === "dpr" ? "Discipline" : "Report no."}</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Published</th>
                <th className="py-2 pr-3 min-w-[14rem]">SharePoint file</th>
                <th className="py-2 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-line/60 hover:bg-sand/30">
                  <td className="py-2 px-4 font-medium">{fmtDay(r.date)}</td>
                  <td className="py-2 pr-3 text-xs">{kind === "dpr" ? r.discipline || "CIVIL" : r.reportNumber != null ? `WPR-${String(r.reportNumber).padStart(2, "0")}` : "—"}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={/published/i.test(r.status) ? "ok" : "warn"}>{r.status}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs text-steel-muted">{r.publishedAt ? new Date(r.publishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                  <td className="py-2 pr-3 text-xs">
                    {r.publishedPath ? (
                      r.publishedUrl ? (
                        <a href={r.publishedUrl} target="_blank" rel="noreferrer" className="text-brand font-semibold break-all" title={r.publishedPath}>
                          {r.publishedPath.split("/").pop()}
                        </a>
                      ) : (
                        <span className="text-steel-muted break-all" title={r.publishedPath}>{r.publishedPath.split("/").pop()}</span>
                      )
                    ) : (
                      <span className="text-steel-muted">not published</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right whitespace-nowrap">
                    <Link to={makerPath(r)} className="text-xs font-semibold text-brand mr-2">
                      Open
                    </Link>
                    {token
                      ? downloads(r).map((d) => (
                          <Button key={d.label} type="button" variant="ghost" className="!text-xs !py-0 !px-1" onClick={() => void downloadAuthFile(d.path, token, d.name)}>
                            {d.label}
                          </Button>
                        ))
                      : null}
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
            const kind = String(x.rfiKind || "RequestForInformation");
            const irTab = IR_TAB[kind];
            const isRfi = kind === "RequestForInformation" || kind === "Manual" || kind === "ClientConcern";
            out.push({
              id: x.id,
              kind: "rfi",
              typeLabel: TYPE_LABEL[kind] || "Request",
              ref: x.irNumber || x.number || "RFI",
              title: x.subject || x.title || "—",
              status: x.status || "Open",
              updated: x.updatedAt || x.createdAt,
              // Inspection requests live on the inspection register; RFIs open in their module with the row selected.
              portalPath: irTab
                ? `/projects/${projectId}/inspection-register?tab=${irTab}`
                : `/projects/${projectId}/rfis?${isRfi ? "view=register" : `kind=${encodeURIComponent(kind)}`}&rfi=${x.id}`,
              // RFI → SPDC RFI form; inspection → SPDC Request for Inspection form; fill requests have no form of their own.
              downloadPath: irTab ? `/api/rfis/${x.id}/inspection.xlsx` : isRfi ? `/api/rfis/${x.id}/download.xlsx` : undefined,
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

  if (config.reportKind) return <PublishedReportsPanel projectId={projectId} token={token} kind={config.reportKind} />;
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
                  <td className="py-2 px-4 text-xs uppercase text-steel-muted">{r.typeLabel || (r.kind === "rfi" ? "RFI" : "NCR/CAR")}</td>
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
