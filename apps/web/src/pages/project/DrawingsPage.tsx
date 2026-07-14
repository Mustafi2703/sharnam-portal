import { FormEvent, Fragment, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { canManageDrawings, isClientViewOnly } from "../../permissions";
import { Badge, Button, Card, FileField, Input, PageHeader, Select } from "../../components/ui";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function DrawingsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [drawings, setDrawings] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "Architecture",
    revisionNumber: "Rev A",
    publish: true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [revForm, setRevForm] = useState({ revisionNumber: "", revisionLabel: "", publish: true });
  const [revFile, setRevFile] = useState<File | null>(null);
  const canUpload = canManageDrawings(user?.role);
  const clientOnly = isClientViewOnly(user?.role);

  const load = async () => {
    const d = await api<any[]>(`/api/drawings/project/${id}`, { token });
    setDrawings(d);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const disciplines = ["All", ...Array.from(new Set(drawings.map((d) => d.discipline)))];
  const filtered = filter === "All" ? drawings : drawings.filter((d) => d.discipline === filter);
  const uploadTarget = drawings.find((d) => d.id === uploadForId);

  async function exportCsv() {
    const res = await fetch(`${API_BASE}/api/drawings/project/${id}/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      setMsg("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gfc-drawing-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function registerDrawing(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (file) fd.append("file", file);
      await api(`/api/drawings/project/${id}`, { method: "POST", token, body: fd });
      setForm({ drawingNumber: "", title: "", discipline: form.discipline, revisionNumber: "Rev A", publish: true });
      setFile(null);
      setShowRegister(false);
      setMsg("Drawing saved to GFC register.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadRevision(e: FormEvent) {
    e.preventDefault();
    if (!uploadForId) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("revisionNumber", revForm.revisionNumber || "Rev next");
      fd.append("revisionLabel", revForm.revisionLabel || revForm.revisionNumber);
      fd.append("publish", String(revForm.publish));
      if (revFile) fd.append("file", revFile);
      await api(`/api/drawings/${uploadForId}/revisions`, { method: "POST", token, body: fd });
      setUploadForId(null);
      setRevFile(null);
      setRevForm({ revisionNumber: "", revisionLabel: "", publish: true });
      setExpandedId(uploadForId);
      setMsg("Revision uploaded.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Revision upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Approval & GFC Drawing Log"
        title="Drawing register"
        subtitle={
          clientOnly
            ? "Published sheets only. Upload and publish stay with Sharnam office."
            : "Interactive register with revision history. Expand a row to audit versions or upload the next revision."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void exportCsv()}>
              Export CSV
            </Button>
            {canUpload && (
              <Button
                type="button"
                variant={showRegister ? "secondary" : "primary"}
                onClick={() => setShowRegister((v) => !v)}
              >
                {showRegister ? "Close form" : "Register sheet"}
              </Button>
            )}
          </div>
        }
      />

      {msg && (
        <p className={`text-sm rounded-lg px-3 py-2 ${msg.includes("fail") || msg.includes("Fail") ? "bg-red-50 text-danger" : "bg-brand-soft text-brand-dark"}`}>
          {msg}
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {disciplines.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFilter(d)}
            className={`rounded px-3 py-1 text-xs font-medium border transition ${
              filter === d
                ? "bg-procore-navy text-white border-procore-navy"
                : "bg-white border-line text-ink hover:border-brand/40"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {canUpload && showRegister && (
        <Card>
          <h3 className="font-semibold text-ink mb-1">Register new drawing</h3>
          <p className="text-xs text-steel-muted mb-4">
            Creates a GFC log row and stores the file under this project’s Drawings folder.
          </p>
          <form className="grid sm:grid-cols-2 gap-3" onSubmit={registerDrawing}>
            <Input required placeholder="Drawing number (e.g. A-101)" value={form.drawingNumber} onChange={(e) => setForm({ ...form, drawingNumber: e.target.value })} />
            <Input required placeholder="Drawing title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              {["Architecture", "Structural", "MEP", "Civil"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Input placeholder="Revision (Rev A)" value={form.revisionNumber} onChange={(e) => setForm({ ...form, revisionNumber: e.target.value })} />
            <div className="sm:col-span-2">
              <FileField file={file} onChange={setFile} label="Attach drawing" accept=".pdf,.dwg,.png,.jpg,.jpeg" hint="Required for a tracked revision file" />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
              Publish now (unlocks checklists & QA gate)
            </label>
            <Button type="submit" disabled={busy || !file} className="sm:col-span-2">
              {busy ? "Saving…" : "Save to GFC register"}
            </Button>
          </form>
        </Card>
      )}

      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-procore-navy text-white flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">GFC register</div>
            <div className="text-[11px] text-white/70">{filtered.length} sheets · click a row for revision audit</div>
          </div>
          <Badge tone="neutral">{drawings.filter((d) => d.isPublished).length} published</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead className="bg-sand text-left text-[11px] uppercase tracking-wide text-steel-muted">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Sr</th>
                <th className="px-3 py-2.5 font-semibold">Drawing No</th>
                <th className="px-3 py-2.5 font-semibold">Title</th>
                <th className="px-3 py-2.5 font-semibold">Discipline</th>
                <th className="px-3 py-2.5 font-semibold">Rev</th>
                <th className="px-3 py-2.5 font-semibold">Rev date</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Revs</th>
                <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const latest = d.revisions?.[0];
                const open = expandedId === d.id;
                return (
                  <Fragment key={d.id}>
                    <tr
                      className={`border-t border-line hover:bg-brand-soft/30 ${open ? "bg-brand-soft/40" : ""}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono text-brand text-xs font-semibold">{d.drawingNumber}</td>
                      <td className="px-3 py-2.5 font-medium">{d.title}</td>
                      <td className="px-3 py-2.5 text-xs">{d.discipline}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{d.currentRev}</td>
                      <td className="px-3 py-2.5 text-xs text-steel-muted">
                        {latest ? new Date(latest.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={d.isPublished ? "ok" : "warn"}>{d.isPublished ? "Published" : d.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{d.revisions?.length || 0}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="ghost"
                            className="!px-2 !py-1 !text-xs"
                            onClick={() => setExpandedId(open ? null : d.id)}
                          >
                            {open ? "Hide revs" : "Revisions"}
                          </Button>
                          {canUpload && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="!px-2 !py-1 !text-xs"
                              onClick={() => {
                                setUploadForId(d.id);
                                setExpandedId(d.id);
                                const nextRev = `Rev ${String.fromCharCode(65 + Math.min((d.revisions?.length || 0), 25))}`;
                                setRevForm({ revisionNumber: nextRev, revisionLabel: `${nextRev} — update`, publish: true });
                                setRevFile(null);
                              }}
                            >
                              Upload rev
                            </Button>
                          )}
                          {canUpload && !d.isPublished && (
                            <Button
                              type="button"
                              variant="primary"
                              className="!px-2 !py-1 !text-xs"
                              onClick={async () => {
                                await api(`/api/drawings/${d.id}/publish`, { method: "POST", token });
                                await load();
                              }}
                            >
                              Publish
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-line bg-[#f8fafc]">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <h4 className="text-xs font-mono uppercase tracking-wide text-steel-muted">
                              Revision audit — {d.drawingNumber}
                            </h4>
                            {latest?.fileUrl && (
                              <a
                                className="text-xs font-semibold text-brand hover:underline"
                                href={latest.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open latest file →
                              </a>
                            )}
                          </div>
                          <ul className="space-y-2">
                            {(d.revisions || []).map((r: any, idx: number) => (
                              <li
                                key={r.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm"
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold">
                                    {r.revisionNumber}
                                    {idx === 0 ? <span className="ml-2 text-[10px] font-mono text-brand">CURRENT</span> : null}
                                  </div>
                                  <div className="text-xs text-steel-muted">
                                    {r.revisionLabel || "—"} · {new Date(r.createdAt).toLocaleString()}
                                    {r.uploadedBy?.fullName ? ` · ${r.uploadedBy.fullName}` : ""}
                                  </div>
                                  {r.fileName && <div className="text-[11px] font-mono mt-0.5 truncate">{r.fileName}</div>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge tone={r.published ? "ok" : "neutral"}>{r.published ? "Live" : "Draft"}</Badge>
                                  {r.fileUrl && (
                                    <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand font-medium">
                                      File
                                    </a>
                                  )}
                                </div>
                              </li>
                            ))}
                            {!d.revisions?.length && <li className="text-sm text-steel-muted">No revision files yet.</li>}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-steel-muted">
                    No drawings in this filter. {canUpload ? "Use Register sheet to add the first GFC entry." : ""}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {canUpload && uploadForId && uploadTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3 sm:p-6">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto !shadow-xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="font-mono text-[11px] text-brand">{uploadTarget.drawingNumber}</div>
                <h3 className="font-semibold text-lg">Upload revision</h3>
                <p className="text-xs text-steel-muted mt-1">
                  Current: {uploadTarget.currentRev} · {uploadTarget.revisions?.length || 0} revision(s) on file
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setUploadForId(null)}>
                Close
              </Button>
            </div>
            <form className="space-y-3" onSubmit={uploadRevision}>
              <Input
                required
                placeholder="Revision number"
                value={revForm.revisionNumber}
                onChange={(e) => setRevForm({ ...revForm, revisionNumber: e.target.value })}
              />
              <Input
                placeholder="Label (e.g. Rev B — structural update)"
                value={revForm.revisionLabel}
                onChange={(e) => setRevForm({ ...revForm, revisionLabel: e.target.value })}
              />
              <FileField
                file={revFile}
                onChange={setRevFile}
                label="Choose revision file"
                accept=".pdf,.dwg,.png,.jpg,.jpeg"
                hint="PDF preferred for GFC distribution"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={revForm.publish}
                  onChange={(e) => setRevForm({ ...revForm, publish: e.target.checked })}
                />
                Publish as current (supersedes prior live revision)
              </label>
              <Button type="submit" disabled={busy || !revFile} className="w-full">
                {busy ? "Uploading…" : "Upload revision"}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {clientOnly && (
        <Card>
          <h3 className="font-semibold mb-1">Client access</h3>
          <p className="text-sm text-steel-muted">
            You can expand revision history on published sheets. Drawings cannot be uploaded or published from the client portal — raise concerns under RFIs instead.
          </p>
        </Card>
      )}
    </div>
  );
}
