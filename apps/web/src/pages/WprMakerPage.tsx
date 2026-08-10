import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";

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

                  {sec.headers && sec.headers.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-sand/40 uppercase tracking-widest text-[9px]">
                          <tr>
                            {sec.headers.map((h, i) => (
                              <th key={i} className="p-1.5 text-left">{h}</th>
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
                  )}

                  {sec.photos && (
                    <div>
                      <label className="text-xs text-steel-muted block mb-1">SharePoint image paths (one per line)</label>
                      <textarea
                        className="w-full min-h-[70px] rounded-lg border border-line bg-white px-3 py-2 text-xs font-mono"
                        value={(sec.photos || []).join("\n")}
                        onChange={(e) => updateSection(key, { photos: e.target.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) })}
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => addRow(key)}>+ Add row</Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

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
