import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { canManageDrawings } from "../../permissions";
import { DrawingPreCheckPanel } from "../../components/DrawingPreCheckPanel";
import { Badge, Button, Card, FileField, Input, PageHeader, Select } from "../../components/ui";

/** Full Procore-style page — Drawing Check Master first, then upload revision */
export default function RevisionUploadPage() {
  const { id, drawingId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [drawing, setDrawing] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState(drawingId || "");
  const [revisionNumber, setRevisionNumber] = useState("R1");
  const [revisionLabel, setRevisionLabel] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [publish, setPublish] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
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
    if (!unlockToken) {
      setError("Complete Drawing Check Master first.");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("revisionNumber", revisionNumber);
      fd.append("revisionLabel", revisionLabel || revisionNumber);
      fd.append("publish", String(publish));
      fd.append("file", file);
      fd.append("unlockToken", unlockToken);
      if (plannedDate) fd.append("plannedDate", plannedDate);
      await api(`/api/drawings/${selectedId}/revisions`, { method: "POST", token, body: fd });
      setMsg("Revision uploaded — planned vs actual logged on GFC register.");
      setFile(null);
      setUnlockToken(null);
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
        eyebrow="Drawings · GFC"
        title="Upload revision"
        subtitle="Drawing Check Master opens first. After it passes, attach the sheet with planned date — actual is logged on upload."
        actions={<Badge tone="brand">Check → Upload</Badge>}
      />

      {!unlockToken && id && (
        <DrawingPreCheckPanel projectId={id} onUnlocked={(tok) => setUnlockToken(tok)} onCancel={() => navigate(`/projects/${id}/drawings`)} />
      )}

      {unlockToken && (
        <Card>
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="text-xs text-steel-muted block">
              Drawing
              <Select className="mt-1" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} required>
                {drawings.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.drawingNumber} — {d.title}
                  </option>
                ))}
              </Select>
            </label>
            {drawing && (
              <p className="text-sm text-steel-muted">
                Current rev <strong>{drawing.currentRev}</strong> · {drawing.revisions?.length || 0} revision(s) on register
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-steel-muted block">
                Revision no.
                <Input className="mt-1" value={revisionNumber} onChange={(e) => setRevisionNumber(e.target.value)} required />
              </label>
              <label className="text-xs text-steel-muted block">
                Label
                <Input className="mt-1" value={revisionLabel} onChange={(e) => setRevisionLabel(e.target.value)} />
              </label>
              <label className="text-xs text-steel-muted block">
                Planned date
                <Input className="mt-1" type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
              </label>
              <label className="text-xs text-steel-muted flex items-center gap-2 pt-6">
                <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
                Publish on upload
              </label>
            </div>
            <FileField file={file} onChange={setFile} accept=".pdf,.png,.jpg,.jpeg,.dwg,.webp" label="Sheet file" />
            {error && <p className="text-sm text-danger">{error}</p>}
            {msg && <p className="text-sm text-brand">{msg}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !file}>
                {busy ? "Uploading…" : "Upload revision"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setUnlockToken(null)}>
                Re-do check
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
