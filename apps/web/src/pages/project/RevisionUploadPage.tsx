import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { canManageDrawings } from "../../permissions";
import { Badge, Button, Card, FileField, Input, PageHeader, Select } from "../../components/ui";

/** Full Procore-style page — upload a new revision for a drawing */
export default function RevisionUploadPage() {
  const { id, drawingId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [drawing, setDrawing] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState(drawingId || "");
  const [revisionNumber, setRevisionNumber] = useState("R1");
  const [revisionLabel, setRevisionLabel] = useState("");
  const [publish, setPublish] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const canUpload = canManageDrawings(user?.role);

  useEffect(() => {
    if (!id) return;
    api<any[]>(`/api/drawings/project/${id}`, { token }).then((list) => {
      setDrawings(list);
      const pick = drawingId || list[0]?.id || "";
      setSelectedId(pick);
    });
  }, [id, token, drawingId]);

  useEffect(() => {
    const d = drawings.find((x) => x.id === selectedId);
    setDrawing(d || null);
    if (d) {
      const next = `R${Math.min(d.revisions?.length || 0, 5)}`;
      setRevisionNumber(next);
      setRevisionLabel(`${next} — ${new Date().toLocaleDateString()}`);
    }
  }, [selectedId, drawings]);

  if (!canUpload) {
    return (
      <Card>
        <p className="text-sm text-steel-muted">Clients cannot upload revisions. View drawings from the GFC register.</p>
        <Link to={`/projects/${id}/drawings`} className="text-brand text-sm font-semibold mt-3 inline-block">
          ← Drawing register
        </Link>
      </Card>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !file) return;
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("revisionNumber", revisionNumber);
      fd.append("revisionLabel", revisionLabel || revisionNumber);
      fd.append("publish", String(publish));
      fd.append("file", file);
      await api(`/api/drawings/${selectedId}/revisions`, { method: "POST", token, body: fd });
      setMsg("Revision uploaded and logged on the GFC register.");
      setFile(null);
      setTimeout(() => navigate(`/projects/${id}/drawings`), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="Drawings · Procore-style"
        title="Upload revision"
        subtitle="Add R1–R5 (or later) to a GFC sheet. Published sheets stay unlocked for further revisions."
        actions={
          <Link to={`/projects/${id}/drawings`}>
            <Button type="button" variant="secondary">
              Back to register
            </Button>
          </Link>
        }
      />

      <Card className="!p-0 overflow-hidden">
        <div className="px-5 py-3 bg-procore-navy text-white flex justify-between items-center">
          <div>
            <div className="text-sm font-semibold">Revision upload</div>
            <div className="text-[11px] text-white/70">File + revision metadata · audit log</div>
          </div>
          {drawing?.isPublished ? <Badge tone="ok">Published</Badge> : <Badge tone="warn">Draft</Badge>}
        </div>
        <form className="p-5 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Drawing</span>
            <Select className="mt-1.5" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required>
              <option value="">Select drawing…</option>
              {drawings.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.drawingNumber} · {d.title} ({d.currentRev})
                </option>
              ))}
            </Select>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Revision</span>
              <Input className="mt-1.5" required value={revisionNumber} onChange={(e) => setRevisionNumber(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Label</span>
              <Input className="mt-1.5" value={revisionLabel} onChange={(e) => setRevisionLabel(e.target.value)} />
            </label>
          </div>
          <FileField
            file={file}
            onChange={setFile}
            label="Browse PDF / image"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg"
            hint="Required · logged with date on the register"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Set as current published revision
          </label>
          {error && <p className="text-sm text-danger bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}
          {msg && <p className="text-sm text-ok bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">{msg}</p>}
          <Button type="submit" disabled={busy || !file || !selectedId} className="w-full !py-3">
            {busy ? "Uploading…" : "Upload revision"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
