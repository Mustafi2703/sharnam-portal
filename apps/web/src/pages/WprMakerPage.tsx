import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Input, Select } from "../components/ui";
import { MakerToolHeader } from "../components/MakerToolHeader";
import { FilePickButton } from "../components/FilePickButton";
import { SignaturePad } from "../components/SignaturePad";
import { WprDashboardCharts, type WprCharts } from "../components/WprDashboardCharts";
import { MakerRecentPanel, fileNameFromPublishedPath } from "../components/MakerRecentPanel";
import { SharePointStatusBanner } from "../components/SharePointStatusBanner";
import { mergeWprCharts } from "../lib/wprChartFallback";

/**
 * WPR Maker — editable weekly progress report per project × weekEnding.
 * Mirrors the SPDC_Arvind Limited_WPR_50.pptx section list. Each section
 * has a title, free-text notes, and an editable table of rows. Publishes
 * to the SharePoint WPR folder as a multi-sheet XLSX pack.
 */

const SECTION_ORDER: string[] = [
  "brief",
  "stakeholders",
  "mobilisation",
  "communicationMatrix",
  "projectDashboard",
  "criticalAreas",
  "capex",
  "prTracker",
  "invoiceTracker",
  "hindrance",
  "risk",
  "legal",
  "drawingRegister",
  "designStatus",
  "procurement",
  "milestones",
  "manpowerHistogram",
  "weeklyExecuted",
  "cashflow",
  "quality",
  "cubeTest",
  "safety",
  "plannedVsActual",
  "valueAddition",
  "materialStock",
  "progressPictures",
];

type Section = {
  title: string;
  notes?: string;
  headers?: string[];
  rows?: (string | number | null)[][];
  photos?: string[];
};
type Sections = { [k: string]: Section };
type Header = {
  projectName?: string;
  projectCode?: string;
  reportNumber?: number;
  weekStart?: string;
  weekEnd?: string;
  clientName?: string;
  designConsultant?: string;
  contractorName?: string;
  location?: string;
  pmc?: string;
};
type Pack = {
  projectId: string;
  projectCode: string;
  weekStart: string;
  weekEnd: string;
  rangePreset?: string;
  reportNumber?: number;
  header: Header;
  sections: Sections;
  packExtras?: { attachments?: { path: string; caption?: string; url?: string }[]; signatures?: { path: string; role: string; url?: string }[] };
  charts?: WprCharts;
  status: string;
  publishedAt?: string | null;
  publishedPath?: string | null;
  publishedUrl?: string | null;
};

function resolveMediaUrl(ref: string): string {
  if (!ref) return "";
  if (/^https?:\/\//i.test(ref)) return ref;
  if (ref.startsWith("/")) return `${apiBase()}${ref}`;
  return `${apiBase()}/uploads/${ref}`;
}

function savePayload(
  weekEnd: string,
  rangePreset: string,
  weekStart: string,
  reportNumber: string,
  pack: Pack,
  attachments: { path: string; caption?: string; url?: string }[],
  signatures: { path: string; role: string; url?: string }[]
) {
  return {
    weekEnding: weekEnd,
    preset: rangePreset,
    start: rangePreset === "custom" && weekStart ? weekStart : undefined,
    reportNumber: reportNumber ? Number(reportNumber) : null,
    header: pack.header,
    sections: pack.sections,
    packExtras: {
      attachments: attachments.map((a) => ({ ...a, url: a.url || resolveMediaUrl(a.path) })),
      signatures: signatures.map((s) => ({ ...s, url: s.url || resolveMediaUrl(s.path) })),
    },
  };
}

const RANGE_PRESETS = [
  { value: "week", label: "This week (7 days)" },
  { value: "last14", label: "Last 14 days" },
  { value: "last28", label: "Last 4 weeks" },
  { value: "last56", label: "Last 8 weeks" },
  { value: "custom", label: "Custom range" },
];

async function downloadWithAuth(url: string, token: string | null | undefined, filename: string) {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export default function WprMakerPage() {
  const { id: projectId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const [weekEnd, setWeekEnd] = useState<string>(
    () => searchParams.get("end") || new Date().toISOString().slice(0, 10)
  );
  const [weekStart, setWeekStart] = useState<string>(() => searchParams.get("start") || "");
  const [rangePreset, setRangePreset] = useState<string>(() => searchParams.get("preset") || "week");
  const [viewTab, setViewTab] = useState<"dashboard" | "sections">("dashboard");
  const [reportNumber, setReportNumber] = useState<string>("");
  const [pack, setPack] = useState<Pack | null>(null);
  const [charts, setCharts] = useState<WprCharts | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["brief"]));
  const [recent, setRecent] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<{ path: string; caption?: string; url?: string }[]>([]);
  const [signatures, setSignatures] = useState<{ path: string; role: string; url?: string }[]>([]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setMsg("");
    try {
      const qs = new URLSearchParams({ end: weekEnd, preset: rangePreset });
      if (rangePreset === "custom" && weekStart) qs.set("start", weekStart);
      const p = await api<Pack>(`/api/wpr-maker/${projectId}?${qs}`, { token });
      setPack(p);
      setCharts(p.charts || null);
      setAttachments(p.packExtras?.attachments || []);
      setSignatures(p.packExtras?.signatures || []);
      if (p.weekStart) setWeekStart(p.weekStart.slice(0, 10));
      setReportNumber(p.reportNumber != null ? String(p.reportNumber) : "");
      const r = await api<any[]>(`/api/wpr-maker/${projectId}/recent`, { token }).catch(() => []);
      setRecent(r);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [projectId, weekEnd, weekStart, rangePreset, token]);

  useEffect(() => {
    const end = searchParams.get("end");
    const start = searchParams.get("start");
    const preset = searchParams.get("preset");
    if (end) setWeekEnd(end);
    if (start) setWeekStart(start);
    if (preset) setRangePreset(preset);
  }, [searchParams]);

  async function refreshFromLive() {
    if (!pack) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ sections: Sections; charts: WprCharts }>(`/api/wpr-maker/${projectId}/refresh`, {
        method: "POST",
        token,
        body: JSON.stringify({
          weekEnding: weekEnd,
          start: rangePreset === "custom" && weekStart ? weekStart : undefined,
          preset: rangePreset,
          reportNumber: reportNumber ? Number(reportNumber) : null,
        }),
      });
      setPack({ ...pack, sections: out.sections });
      setCharts(out.charts);
      setMsg("WPR regenerated from live portal data (Progress, DPR, Quality, Safety, Drawings, Cost).");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const displayCharts = useMemo(
    () => (pack ? mergeWprCharts(pack, charts) : null),
    [pack, charts]
  );

  function updateSection(key: string, patch: Partial<Section>) {
    if (!pack) return;
    const current = pack.sections[key] || { title: key };
    setPack({
      ...pack,
      sections: { ...pack.sections, [key]: { ...current, ...patch } },
    });
  }
  function toggle(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  }

  function addRow(key: string) {
    if (!pack) return;
    const sec = pack.sections[key] || { title: key };
    const cols = sec.headers?.length || sec.rows?.[0]?.length || 3;
    updateSection(key, { rows: [...(sec.rows || []), Array(cols).fill("")] });
  }
  function removeRow(key: string, idx: number) {
    if (!pack) return;
    const sec = pack.sections[key];
    if (!sec?.rows) return;
    updateSection(key, { rows: sec.rows.filter((_, i) => i !== idx) });
  }
  function updateCell(key: string, r: number, c: number, val: string) {
    if (!pack) return;
    const sec = pack.sections[key];
    if (!sec?.rows) return;
    const rows = sec.rows.map((row) => row.slice());
    rows[r][c] = val;
    updateSection(key, { rows });
  }

  async function uploadSectionPhoto(key: string, file: File) {
    if (!pack) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("weekEnding", weekEnd);
      fd.append("sectionKey", key);
      const out = await api<{ path: string; url?: string }>(`/api/wpr-maker/${projectId}/photo`, {
        method: "POST",
        token,
        body: fd,
      });
      const sec = pack.sections[key] || { title: key };
      const photoRef = out.url || out.path;
      updateSection(key, { photos: [...(sec.photos || []), photoRef] });
      setMsg(`Photo uploaded — ${photoRef}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(false);
    }
  }
  function removeSectionPhoto(key: string, idx: number) {
    if (!pack) return;
    const sec = pack.sections[key];
    if (!sec?.photos) return;
    updateSection(key, { photos: sec.photos.filter((_, i) => i !== idx) });
  }

  async function uploadPackAttachment(file: File) {
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("caption", file.name);
      fd.append("weekEnding", weekEnd);
      const out = await api<{ path: string; caption?: string; url?: string }>(`/api/wpr-maker/${projectId}/attachment`, {
        method: "POST", token, body: fd,
      });
      setAttachments((a) => [...a, { path: out.path, caption: out.caption || file.name, url: out.url }]);
      setMsg(`Attachment uploaded → ${out.path}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Attachment upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPackSignature(file: File, role: string) {
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("signature", file);
      fd.append("weekEnding", weekEnd);
      fd.append("role", role);
      const out = await api<{ path: string; role: string; url?: string }>(`/api/wpr-maker/${projectId}/signature`, {
        method: "POST", token, body: fd,
      });
      setSignatures((s) => [...s, { path: out.path, role: out.role || role, url: out.url }]);
      setMsg(`Signature saved · ${role} → ${out.path}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Signature save failed");
    } finally {
      setBusy(false);
    }
  }
  function addSectionColumn(key: string) {
    if (!pack) return;
    const sec = pack.sections[key] || { title: key };
    const headers = [...(sec.headers || []), `Column ${((sec.headers || []).length + 1)}`];
    const rows = (sec.rows || []).map((r) => [...r, ""]);
    updateSection(key, { headers, rows });
  }
  function renameSectionColumn(key: string, colIdx: number, name: string) {
    if (!pack) return;
    const sec = pack.sections[key];
    if (!sec?.headers) return;
    const headers = sec.headers.slice();
    headers[colIdx] = name;
    updateSection(key, { headers });
  }
  function removeSectionColumn(key: string, colIdx: number) {
    if (!pack) return;
    const sec = pack.sections[key];
    if (!sec?.headers) return;
    const headers = sec.headers.filter((_, i) => i !== colIdx);
    const rows = (sec.rows || []).map((r) => r.filter((_, i) => i !== colIdx));
    updateSection(key, { headers, rows });
  }

  async function save() {
    if (!pack) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/wpr-maker/${projectId}/save`, {
        method: "POST",
        token,
        body: JSON.stringify(savePayload(weekEnd, rangePreset, weekStart, reportNumber, pack, attachments, signatures)),
      });
      setMsg("Saved draft.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!pack) return;
    setBusy(true);
    setMsg("");
    try {
      const payload = savePayload(weekEnd, rangePreset, weekStart, reportNumber, pack, attachments, signatures);
      await api(`/api/wpr-maker/${projectId}/save`, { method: "POST", token, body: JSON.stringify(payload) });
      const out = await api<{ publishedUrl?: string; sharePointUrl?: string; publishedPath?: string; url?: string }>(
        `/api/wpr-maker/${projectId}/publish`,
        { method: "POST", token, body: JSON.stringify(payload) },
      );
      const link = out.publishedUrl || out.sharePointUrl || out.url;
      setMsg(link ? `Published · ${out.publishedPath || "SharePoint"}` : `Published → ${out.publishedPath || "SharePoint"}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadXlsx() {
    if (!pack) return;
    const qs = new URLSearchParams({ end: weekEnd, preset: rangePreset });
    if (rangePreset === "custom" && pack.weekStart) qs.set("start", pack.weekStart.slice(0, 10));
    const url = `${apiBase()}/api/wpr-maker/${projectId}/download.xlsx?${qs}`;
    const fname = `WPR-${pack.projectCode}-${weekEnd}.xlsx`;
    setBusy(true);
    try {
      await downloadWithAuth(url, token, fname);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadClientXlsx() {
    if (!pack) return;
    const qs = new URLSearchParams({ end: weekEnd, preset: rangePreset });
    if (rangePreset === "custom" && pack.weekStart) qs.set("start", pack.weekStart.slice(0, 10));
    const url = `${apiBase()}/api/wpr-maker/${projectId}/download-client.xlsx?${qs}`;
    const fname = `WPR-ClientPack-${pack.projectCode}-${weekEnd}.xlsx`;
    setBusy(true);
    try {
      await downloadWithAuth(url, token, fname);
      setMsg("Client WPR workbook downloaded — WPR File.xlsx tabs filled from live data.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPptx() {
    if (!pack) return;
    const qs = new URLSearchParams({ end: weekEnd, preset: rangePreset });
    if (rangePreset === "custom" && pack.weekStart) qs.set("start", pack.weekStart.slice(0, 10));
    const url = `${apiBase()}/api/wpr-maker/${projectId}/download.pptx?${qs}`;
    const fname = `WPR-${pack.projectCode}-${weekEnd}.pptx`;
    setBusy(true);
    try {
      await downloadWithAuth(url, token, fname);
      setMsg("WPR PowerPoint downloaded — includes native charts (S-curve, milestones, manpower, cashflow, quality, safety).");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  if (!pack) {
    return (
      <div className="maker-shell wpr-maker page-scroll-full page-stack--register flex flex-col gap-0 pb-0 safe-bottom">
        <div className="maker-shell__body space-y-4 px-0.5 py-3 pb-6">
          <MakerToolHeader eyebrow="WPR Maker" title="Weekly Progress Report" description="Loading report pack…" busy />
          <p className="text-sm text-steel-muted text-center py-8">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="maker-shell wpr-maker page-scroll-full page-stack--register flex flex-col gap-0 pb-0 safe-bottom">
      <div className="wpr-maker__chrome shrink-0 bg-paper border-b border-line space-y-2 px-1 py-2 -mx-0.5">
        <MakerToolHeader
          eyebrow="WPR"
          title="Weekly Progress Report"
          meta={pack.header.projectName || pack.projectCode}
          busy={busy}
          actions={<Badge tone={pack.status === "Published" ? "ok" : "warn"}>{pack.status}</Badge>}
        />

        <div className="maker-toolbar !py-0 !px-0 !bg-transparent !border-0 flex-wrap">
          <div className="maker-toolbar__field">
            <label>Period</label>
            <Select value={rangePreset} onChange={(e) => setRangePreset(e.target.value)}>
              {RANGE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>
          <div className="maker-toolbar__field">
            <label>Week ending</label>
            <Input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
          </div>
          {rangePreset === "custom" ? (
            <div className="maker-toolbar__field">
              <label>Start</label>
              <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
          ) : null}
          <div className="maker-toolbar__field">
            <label>Report no.</label>
            <Input type="number" placeholder="50" value={reportNumber} onChange={(e) => setReportNumber(e.target.value)} />
          </div>
          <div className="maker-toolbar__actions flex-wrap">
            <Button onClick={() => void load()} disabled={busy} variant="secondary">Load</Button>
            <Button onClick={refreshFromLive} disabled={busy} variant="secondary">Regenerate</Button>
            <Button onClick={save} disabled={busy} variant="secondary">Save</Button>
            <Button onClick={publish} disabled={busy}>Publish</Button>
            <button type="button" className="text-sm font-semibold text-brand underline px-1" onClick={downloadXlsx} disabled={busy}>XLSX</button>
            <button type="button" className="text-sm font-semibold text-brand underline px-1" onClick={downloadClientXlsx} disabled={busy}>Client</button>
            <button type="button" className="text-sm font-semibold text-brand underline px-1" onClick={downloadPptx} disabled={busy}>PPTX</button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${viewTab === "dashboard" ? "bg-brand text-white" : "text-steel-muted hover:bg-sand"}`}
            onClick={() => setViewTab("dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${viewTab === "sections" ? "bg-brand text-white" : "text-steel-muted hover:bg-sand"}`}
            onClick={() => setViewTab("sections")}
          >
            Sections
          </button>
        </div>

        {msg && <p className="text-xs text-brand-dark bg-brand-soft rounded px-2 py-1">{msg}</p>}
        {(pack.publishedUrl || pack.publishedPath) && (
          <p className="text-xs text-steel-muted">
            {pack.publishedUrl ? (
              <a href={pack.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-brand font-semibold underline">
                Open in SharePoint ↗
              </a>
            ) : (
              <span className="font-mono">{pack.publishedPath}</span>
            )}
          </p>
        )}
        <SharePointStatusBanner />
      </div>

      <div className="maker-shell__body space-y-5 scrollbars-visible px-0.5 py-3 pb-6">

      {viewTab === "dashboard" ? (
        <div className="maker-section p-4 min-h-[320px]">
          {displayCharts ? (
            <WprDashboardCharts charts={displayCharts} emptyHint={!charts?.scurve?.length && !charts?.milestones?.length} />
          ) : (
            <div className="text-sm text-steel-muted space-y-3">
              <p>Loading WPR dashboard…</p>
            </div>
          )}
          {!charts?.scurve?.length && (
            <div className="mt-4 p-3 rounded-lg border border-brand/30 bg-brand/5 text-sm">
              <p className="font-semibold text-brand mb-1">Charts need live data</p>
              <p className="text-steel-muted mb-2">
                Publish DPRs for this week, then click <strong>Regenerate from live data</strong> to fill milestone, manpower, and S-curve charts.
              </p>
              <Button onClick={refreshFromLive} disabled={busy} variant="secondary">
                Regenerate from live data
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {viewTab === "sections" ? (
      <div className="maker-accordion">
        {SECTION_ORDER.map((key) => {
          const sec = pack.sections[key] || { title: key };
          const open = expanded.has(key);
          const rowCount = sec.rows?.length || 0;
          const colCount = sec.headers?.length || sec.rows?.[0]?.length || 0;
          return (
            <div key={key} className="maker-accordion__item">
              <button
                type="button"
                onClick={() => toggle(key)}
                className="maker-accordion__trigger"
              >
                <span className="maker-accordion__title">
                  <span className="text-steel-muted font-mono text-xs mr-2">{SECTION_ORDER.indexOf(key) + 1}.</span>
                  {sec.title}
                </span>
                <span className="maker-accordion__meta">
                  {rowCount} row{rowCount === 1 ? "" : "s"} · {open ? "Hide" : "Edit"}
                </span>
              </button>
              {open && (
                <div className="maker-accordion__body space-y-3">
                  <label className="text-xs text-steel-muted block">
                    Notes / commentary
                    <textarea
                      className="maker-notes mt-1"
                      value={sec.notes || ""}
                      onChange={(e) => updateSection(key, { notes: e.target.value })}
                    />
                  </label>

                  {(sec.headers?.length || sec.rows?.length) ? (
                    <div
                      className={`maker-table-wrap maker-table-wrap--comfortable maker-table-wrap--scroll${
                        key === "capex" ? " maker-table-wrap--wide" : ""
                      }`}
                    >
                      <table className={`maker-table maker-table--comfortable${key === "capex" ? " maker-table--capex" : ""}`}>
                        <thead>
                          <tr>
                            {(sec.headers || []).map((h, i) => (
                              <th key={i}>
                                <input
                                  className="maker-table__head-input"
                                  value={h}
                                  onChange={(e) => renameSectionColumn(key, i, e.target.value)}
                                />
                                <button
                                  className="maker-table__remove-col"
                                  type="button"
                                  onClick={() => removeSectionColumn(key, i)}
                                >
                                  Remove column
                                </button>
                              </th>
                            ))}
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {(sec.rows || []).map((row, ri) => (
                            <tr key={ri}>
                              {Array.from({ length: colCount }, (_, ci) => (
                                <td key={ci}>
                                  <input
                                    className="maker-table__cell"
                                    value={row[ci] == null ? "" : String(row[ci])}
                                    onChange={(e) => updateCell(key, ri, ci, e.target.value)}
                                  />
                                </td>
                              ))}
                              <td>
                                <button type="button" className="maker-table__remove-row" onClick={() => removeRow(key, ri)} aria-label="Remove row">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div>
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                      <label className="text-xs text-steel-muted">Photos ({(sec.photos || []).length})</label>
                      <FilePickButton
                        accept="image/*"
                        capture="environment"
                        onPick={(files) => {
                          const file = files[0];
                          if (file) void uploadSectionPhoto(key, file);
                        }}
                      >
                        + Take / choose photo
                      </FilePickButton>
                    </div>
                    {(sec.photos || []).length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(sec.photos || []).map((p, i) => {
                          const isSlot = p.includes("[Upload") || p.startsWith("wpr-demo/");
                          const src = isSlot ? "" : resolveMediaUrl(p);
                          return (
                            <div key={i} className="relative group rounded-lg border border-line overflow-hidden bg-sand/30">
                              {src ? (
                                <a href={src} target="_blank" rel="noopener noreferrer" title="Open full size">
                                  <img src={src} alt="" className="w-full h-28 object-cover" loading="lazy" />
                                </a>
                              ) : (
                                <div className="w-full h-28 grid place-items-center text-[10px] text-steel-muted px-2 text-center border-2 border-dashed border-line/80 bg-white/60">
                                  Photo slot {i + 1}
                                  <span className="block text-[9px] mt-1">Upload to fill PPTX grid</span>
                                </div>
                              )}
                              <button
                                type="button"
                                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white text-xs"
                                onClick={() => removeSectionPhoto(key, i)}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-steel-muted">No photos yet.</p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="secondary" onClick={() => addRow(key)}>+ Add row</Button>
                    <Button variant="secondary" onClick={() => addSectionColumn(key)}>+ Add column</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      ) : null}

      {viewTab === "sections" ? (
      <div className="maker-section">
        <div className="maker-section__head">Sign-off & attachments</div>
        <div className="maker-section__body space-y-4">
          <section className="rounded-lg border border-line p-3 space-y-2 bg-sand/30">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted">PDF attachments ({attachments.length})</h4>
            </div>
            <FilePickButton accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onPick={(files) => {
              const file = files[0];
              if (file) void uploadPackAttachment(file);
            }}>
              Upload PDF or file
            </FilePickButton>
            {attachments.length > 0 && (
              <ul className="mt-1 text-xs divide-y border border-line rounded-lg overflow-hidden bg-white">
                {attachments.map((p, i) => (
                  <li key={i} className="py-2 px-2 flex justify-between gap-2 items-center">
                    <div className="min-w-0">
                      <div className="font-mono truncate text-[11px]">{p.path}</div>
                      {p.caption && <div className="text-steel-muted">{p.caption}</div>}
                    </div>
                    <button className="text-danger text-sm" onClick={() => setAttachments((a) => a.filter((_, k) => k !== i))} title="Remove">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-line p-3 space-y-3 bg-sand/30">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted">Sign-off ({signatures.length})</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <SignaturePad label="PMC sign" personName="PMC" height={140} onCapture={(f) => f && uploadPackSignature(f, "pmc")} />
              <SignaturePad label="Client sign" personName="Client" height={140} onCapture={(f) => f && uploadPackSignature(f, "client")} />
              <SignaturePad label="Contractor sign" personName="Contractor" height={140} onCapture={(f) => f && uploadPackSignature(f, "contractor")} />
            </div>
            {signatures.length > 0 && (
              <div className="grid sm:grid-cols-3 gap-3">
                {signatures.map((p, i) => (
                  <div key={i} className="rounded-lg border border-line bg-white p-2 space-y-1">
                    <div className="text-[10px] uppercase text-steel-muted">{p.role}</div>
                    <a href={resolveMediaUrl(p.url || p.path)} target="_blank" rel="noopener noreferrer">
                      <img src={resolveMediaUrl(p.url || p.path)} alt={p.role} className="w-full h-24 object-contain bg-sand/20" />
                    </a>
                    <button className="text-danger text-xs" onClick={() => setSignatures((s) => s.filter((_, k) => k !== i))}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      ) : null}

      <MakerRecentPanel
        title="Recent WPR packs"
        previewCount={5}
        items={recent.map((r) => ({
          id: r.id,
          title: `Week ending ${new Date(r.weekEnding).toISOString().slice(0, 10)} · No ${r.reportNumber || "—"}`,
          subtitle: r.publishedUrl ? "Open in SharePoint" : fileNameFromPublishedPath(r.publishedPath),
          href: r.publishedUrl || undefined,
          badge: { label: r.status, tone: r.status === "Published" ? "ok" : "warn" },
        }))}
      />

      </div>
    </div>
  );
}
