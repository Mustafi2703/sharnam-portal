import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Input, PageHeader } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";
import { SignaturePad } from "../components/SignaturePad";

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
  reportNumber?: number;
  header: Header;
  sections: Sections;
  status: string;
  publishedAt?: string | null;
  publishedPath?: string | null;
};

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
  const [reportNumber, setReportNumber] = useState<string>("");
  const [pack, setPack] = useState<Pack | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["brief"]));
  const [recent, setRecent] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<{ path: string; caption?: string }[]>([]);
  const [signatures, setSignatures] = useState<{ path: string; role: string }[]>([]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setMsg("");
    try {
      const p = await api<Pack>(`/api/wpr-maker/${projectId}?end=${weekEnd}`, { token });
      setPack(p);
      setReportNumber(p.reportNumber != null ? String(p.reportNumber) : "");
      const r = await api<any[]>(`/api/wpr-maker/${projectId}/recent`, { token }).catch(() => []);
      setRecent(r);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [projectId, weekEnd, token]);

  useEffect(() => {
    const end = searchParams.get("end");
    if (end) setWeekEnd(end);
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

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
      const out = await api<{ path: string }>(`/api/wpr-maker/${projectId}/photo`, {
        method: "POST",
        token,
        body: fd,
      });
      const sec = pack.sections[key] || { title: key };
      updateSection(key, { photos: [...(sec.photos || []), out.path] });
      setMsg(`Photo uploaded to ${out.path}`);
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
      const out = await api<{ path: string; caption?: string }>(`/api/wpr-maker/${projectId}/attachment`, {
        method: "POST", token, body: fd,
      });
      setAttachments((a) => [...a, { path: out.path, caption: out.caption || file.name }]);
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
      const out = await api<{ path: string; role: string }>(`/api/wpr-maker/${projectId}/signature`, {
        method: "POST", token, body: fd,
      });
      setSignatures((s) => [...s, { path: out.path, role: out.role || role }]);
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
        body: JSON.stringify({
          weekEnding: weekEnd,
          reportNumber: reportNumber ? Number(reportNumber) : null,
          header: pack.header,
          sections: pack.sections,
        }),
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
      await api(`/api/wpr-maker/${projectId}/save`, {
        method: "POST",
        token,
        body: JSON.stringify({
          weekEnding: weekEnd,
          reportNumber: reportNumber ? Number(reportNumber) : null,
          header: pack.header,
          sections: pack.sections,
        }),
      });
      const out = await api<any>(`/api/wpr-maker/${projectId}/publish`, {
        method: "POST",
        token,
        body: JSON.stringify({ weekEnding: weekEnd }),
      });
      setMsg(`Published → ${out.publishedPath || out.url || "SharePoint"}${out.provider ? ` · ${out.provider}` : ""}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadXlsx() {
    if (!pack) return;
    const url = `${apiBase()}/api/wpr-maker/${projectId}/download.xlsx?end=${weekEnd}`;
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

  async function downloadPptx() {
    if (!pack) return;
    const url = `${apiBase()}/api/wpr-maker/${projectId}/download.pptx?end=${weekEnd}`;
    const fname = `WPR-${pack.projectCode}-${weekEnd}.pptx`;
    setBusy(true);
    try {
      await downloadWithAuth(url, token, fname);
      setMsg("WPR PowerPoint downloaded — matches SPDC section list (24 slides).");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  if (!pack) {
    return (
      <div className="maker-shell space-y-4">
        <PageHeader eyebrow="WPR Maker" title="Weekly Progress Report" subtitle="Loading…" />
      </div>
    );
  }

  return (
    <div className="maker-shell space-y-5 pb-24">
      <PageHeader
        eyebrow="WPR Maker · SPDC pack"
        title={`Weekly Progress Report — Week ending ${new Date(weekEnd).toDateString().slice(4)}`}
        subtitle="24-section editable pack. Edit any section, then publish an XLSX pack to SharePoint."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone={pack.status === "Published" ? "ok" : "warn"}>{pack.status}</Badge>
            <button className="text-sm font-semibold text-brand underline" onClick={downloadXlsx} disabled={busy}>Download XLSX</button>
            <button className="text-sm font-semibold text-brand underline" onClick={downloadPptx} disabled={busy}>Download PPTX</button>
          </div>
        }
      />

      <div className="maker-section">
        <div className="maker-toolbar">
          <div className="maker-toolbar__field">
            <label>Week ending</label>
            <Input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
          </div>
          <div className="maker-toolbar__field">
            <label>Report number</label>
            <Input type="number" placeholder="50" value={reportNumber} onChange={(e) => setReportNumber(e.target.value)} />
          </div>
          <div className="maker-toolbar__actions">
            <Button onClick={save} disabled={busy}>Save draft</Button>
            <Button onClick={publish} disabled={busy} variant="secondary">Publish to SharePoint</Button>
          </div>
        </div>
        {msg && <p className="maker-flash maker-flash--ok mx-4 mb-4">{msg}</p>}
      </div>

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
                    <div className="maker-table-wrap">
                      <table className="maker-table">
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
                      <ul className="text-[11px] font-mono divide-y border border-line rounded-lg overflow-hidden">
                        {(sec.photos || []).map((p, i) => (
                          <li key={i} className="py-1.5 px-2 flex justify-between gap-2 bg-white">
                            <span className="truncate">{p}</span>
                            <button type="button" className="text-danger" onClick={() => removeSectionPhoto(key, i)}>✕</button>
                          </li>
                        ))}
                      </ul>
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
              <ul className="text-xs divide-y border border-line rounded-lg overflow-hidden bg-white">
                {signatures.map((p, i) => (
                  <li key={i} className="py-2 px-2 flex justify-between gap-2 items-center">
                    <div className="min-w-0">
                      <div className="font-mono truncate text-[11px]">{p.path}</div>
                      <div className="text-steel-muted">{p.role}</div>
                    </div>
                    <button className="text-danger text-sm" onClick={() => setSignatures((s) => s.filter((_, k) => k !== i))} title="Remove">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="maker-section maker-section--flush">
          <div className="maker-section__head">Recent WPR packs</div>
          <ul className="maker-list">
            {recent.map((r) => (
              <li key={r.id} className="maker-list__row">
                <div className="min-w-0">
                  <div className="maker-list__title">Week ending {new Date(r.weekEnding).toISOString().slice(0, 10)} · No {r.reportNumber || "—"}</div>
                  {r.publishedPath && <div className="maker-list__sub truncate">{r.publishedPath}</div>}
                </div>
                <Badge tone={r.status === "Published" ? "ok" : "warn"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="maker-sticky-bar">
        <Button onClick={save} disabled={busy}>Save draft</Button>
        <Button onClick={publish} disabled={busy} variant="secondary">Publish</Button>
        <Button type="button" variant="secondary" onClick={downloadXlsx} disabled={busy}>Export XLSX</Button>
        <Button type="button" variant="secondary" onClick={downloadPptx} disabled={busy}>Export PPTX</Button>
      </div>
    </div>
  );
}
