import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";
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
  const { token } = useAuth();
  const [weekEnd, setWeekEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
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

  async function uploadSectionPhoto(key: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pack) return;
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
      e.target.value = "";
    }
  }
  function removeSectionPhoto(key: string, idx: number) {
    if (!pack) return;
    const sec = pack.sections[key];
    if (!sec?.photos) return;
    updateSection(key, { photos: sec.photos.filter((_, i) => i !== idx) });
  }

  async function uploadPackAttachment(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
      e.target.value = "";
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

  if (!pack) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="WPR Maker" title="Weekly Progress Report" subtitle="Loading…" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="WPR Maker · SPDC pack"
        title={`Weekly Progress Report — Week ending ${new Date(weekEnd).toDateString().slice(4)}`}
        subtitle="24-section editable pack pre-seeded from live modules (Communication Matrix, RFIs, Milestones, Drawings, Cashflow, QAP, Safety, Cubes…). Edit any section, then publish an XLSX pack to the SharePoint WPR folder."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone={pack.status === "Published" ? "ok" : "warn"}>{pack.status}</Badge>
            <button className="text-sm font-semibold text-brand underline" onClick={downloadXlsx} disabled={busy}>Download XLSX</button>
          </div>
        }
      />

      <Card className="space-y-3">
        <div className="grid md:grid-cols-4 gap-2">
          <label className="text-xs text-steel-muted">
            Week ending
            <Input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
          </label>
          <label className="text-xs text-steel-muted">
            Report number
            <Input type="number" placeholder="50" value={reportNumber} onChange={(e) => setReportNumber(e.target.value)} />
          </label>
          <div className="md:col-span-2 flex items-end justify-end gap-2">
            <Button onClick={save} disabled={busy}>Save draft</Button>
            <Button onClick={publish} disabled={busy} variant="secondary">Publish to SharePoint</Button>
          </div>
        </div>
        {msg && <p className="text-xs text-ok">{msg}</p>}
      </Card>

      <div className="space-y-3">
        {SECTION_ORDER.map((key) => {
          const sec = pack.sections[key] || { title: key };
          const open = expanded.has(key);
          const rowCount = sec.rows?.length || 0;
          const colCount = sec.headers?.length || sec.rows?.[0]?.length || 0;
          return (
            <Card key={key} padding={false}>
              <button
                type="button"
                onClick={() => toggle(key)}
                className="w-full flex items-center justify-between p-3 bg-sand/40 hover:bg-sand/70 transition"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs font-mono text-steel-muted">{SECTION_ORDER.indexOf(key) + 1}.</span>
                  <span className="font-semibold text-left">{sec.title}</span>
                </span>
                <span className="text-xs text-steel-muted">
                  {rowCount} row{rowCount === 1 ? "" : "s"} · {open ? "Hide" : "Edit"}
                </span>
              </button>
              {open && (
                <div className="p-3 space-y-3">
                  <label className="text-xs text-steel-muted block">
                    Notes / commentary
                    <textarea
                      className="mt-1 w-full min-h-[70px] rounded-lg border border-line bg-white px-3 py-2 text-sm"
                      value={sec.notes || ""}
                      onChange={(e) => updateSection(key, { notes: e.target.value })}
                    />
                  </label>

                  {(sec.headers?.length || sec.rows?.length) ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-sand/40 uppercase tracking-widest text-[9px]">
                          <tr>
                            {(sec.headers || []).map((h, i) => (
                              <th key={i} className="p-1.5 text-left align-top">
                                <div className="flex flex-col gap-1">
                                  <input
                                    className="w-full px-1.5 py-1 rounded border border-line bg-white text-[10px] font-semibold uppercase"
                                    value={h}
                                    onChange={(e) => renameSectionColumn(key, i, e.target.value)}
                                  />
                                  <button
                                    className="text-[10px] text-danger self-start"
                                    type="button"
                                    onClick={() => removeSectionColumn(key, i)}
                                  >
                                    Remove column
                                  </button>
                                </div>
                              </th>
                            ))}
                            <th className="p-1.5 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sec.rows || []).map((row, ri) => (
                            <tr key={ri} className="border-t border-line">
                              {Array.from({ length: colCount }, (_, ci) => (
                                <td key={ci} className="p-1">
                                  <input
                                    className="w-full px-2 py-1 rounded border border-line text-xs"
                                    value={row[ci] == null ? "" : String(row[ci])}
                                    onChange={(e) => updateCell(key, ri, ci, e.target.value)}
                                  />
                                </td>
                              ))}
                              <td className="p-1.5 text-danger cursor-pointer" onClick={() => removeRow(key, ri)}>✕</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-steel-muted">Photos ({(sec.photos || []).length})</label>
                      <label className="text-xs text-brand font-semibold cursor-pointer">
                        + Take / choose photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => uploadSectionPhoto(key, e)}
                        />
                      </label>
                    </div>
                    {(sec.photos || []).length > 0 ? (
                      <ul className="text-[11px] font-mono divide-y">
                        {(sec.photos || []).map((p, i) => (
                          <li key={i} className="py-1 flex justify-between gap-2">
                            <span className="truncate">{p}</span>
                            <button type="button" className="text-danger" onClick={() => removeSectionPhoto(key, i)}>✕</button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-steel-muted">No photos yet. Uploads go to <span className="font-mono">10.01_Progress_Reporting_MIS/photos/{key}/</span></p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="secondary" onClick={() => addRow(key)}>+ Add row</Button>
                    <Button variant="secondary" onClick={() => addSectionColumn(key)}>+ Add column</Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Sign-off & attachments — mirrors the SPDC WPR sign-off slide */}
      <Card className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-steel-muted">Sign-off & attachments</h3>
          <p className="text-xs text-steel-muted mt-0.5">
            Uploads land in the WPR MIS folder: <span className="font-mono">10.01_Progress_Reporting_MIS/attachments</span> &nbsp;·&nbsp; <span className="font-mono">/signatures</span>
          </p>
        </div>

        <section className="rounded-lg border border-line p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted">PDF attachments ({attachments.length})</h4>
            <span className="text-[11px] text-steel-muted">Weekly report PDF · signed MoM · risk log export</span>
          </div>
          <label className="text-xs text-steel-muted">
            Upload PDF (or any file)
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={uploadPackAttachment} className="block mt-1 text-xs" />
          </label>
          {attachments.length > 0 && (
            <ul className="mt-1 text-xs divide-y">
              {attachments.map((p, i) => (
                <li key={i} className="py-2 flex justify-between gap-2 items-center">
                  <div className="min-w-0">
                    <div className="font-mono truncate">{p.path}</div>
                    {p.caption && <div className="text-steel-muted">{p.caption}</div>}
                  </div>
                  <button className="text-danger text-sm" onClick={() => setAttachments((a) => a.filter((_, k) => k !== i))} title="Remove">✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-line p-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted">Sign-off ({signatures.length})</h4>
            <span className="text-[11px] text-steel-muted">Signatures for this week</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <SignaturePad label="PMC sign"        personName="PMC"        height={140} onCapture={(f) => f && uploadPackSignature(f, "pmc")} />
            <SignaturePad label="Client sign"     personName="Client"     height={140} onCapture={(f) => f && uploadPackSignature(f, "client")} />
            <SignaturePad label="Contractor sign" personName="Contractor" height={140} onCapture={(f) => f && uploadPackSignature(f, "contractor")} />
          </div>
          {signatures.length > 0 && (
            <ul className="mt-1 text-xs divide-y">
              {signatures.map((p, i) => (
                <li key={i} className="py-2 flex justify-between gap-2 items-center">
                  <div className="min-w-0">
                    <div className="font-mono truncate">{p.path}</div>
                    <div className="text-steel-muted">{p.role}</div>
                  </div>
                  <button className="text-danger text-sm" onClick={() => setSignatures((s) => s.filter((_, k) => k !== i))} title="Remove">✕</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Card>

      {recent.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-2">Recent WPR packs</h3>
          <ul className="text-sm divide-y">
            {recent.map((r) => (
              <li key={r.id} className="py-1.5 flex justify-between items-center">
                <span className="font-mono text-xs">Week ending {new Date(r.weekEnding).toISOString().slice(0, 10)} · No {r.reportNumber || "—"}</span>
                <span>
                  <Badge tone={r.status === "Published" ? "ok" : "warn"}>{r.status}</Badge>
                  {r.publishedPath && (
                    <span className="text-xs text-steel-muted ml-2 truncate max-w-[280px] inline-block align-middle">
                      {r.publishedPath}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
