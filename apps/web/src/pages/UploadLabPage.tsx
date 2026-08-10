/**
 * Upload Lab — admin test desk for photo · PDF markup · drawing · signature uploads.
 * Proves the UI ↔ SharePoint pipeline before Hostinger production cutover.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";
import { EvidencePanel, type EvidenceItem } from "../components/EvidencePanel";
import { FilePickButton } from "../components/FilePickButton";

type DriveItem = { name: string; path: string; type: "folder" | "file"; url?: string };
type GraphHealth = {
  tokenOk?: boolean;
  siteOk?: boolean;
  driveId?: string;
  siteUrl?: string;
  error?: string;
};

const LAB_FOLDER = "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/UploadLab";

function fileUrl(path: string, url?: string | null) {
  if (url?.startsWith("http")) return url;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${apiBase()}${path}`;
  return `${apiBase()}/uploads/onedrive/${path}`;
}

function isPdf(name: string) {
  return /\.pdf(\?|$)/i.test(name);
}
function isImage(name: string) {
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(name);
}

export default function UploadLabPage() {
  const { token, user } = useAuth();
  const canManage =
    user?.role === "admin" || user?.role === "office" || user?.role === "site_employee";

  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [health, setHealth] = useState<GraphHealth | null>(null);
  const [photos, setPhotos] = useState<EvidenceItem[]>([]);
  const [attachments, setAttachments] = useState<EvidenceItem[]>([]);
  const [signatures, setSignatures] = useState<EvidenceItem[]>([]);
  const [drawings, setDrawings] = useState<EvidenceItem[]>([]);
  const [recent, setRecent] = useState<DriveItem[]>([]);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [viewer, setViewer] = useState<{ title: string; url: string; kind: "pdf" | "image" | "other" } | null>(null);

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);

  const loadMeta = useCallback(async () => {
    const [st, h, projs] = await Promise.all([
      api<any>("/api/site-test/status", { token }).catch(() => null),
      api<GraphHealth>("/api/graph/status", { token }).catch(() => null),
      api<any[]>("/api/projects", { token }).catch(() => []),
    ]);
    setStatus(st);
    setHealth(h);
    setProjects(projs);
    if (!projectId && projs[0]?.id) setProjectId(projs[0].id);
  }, [token, projectId]);

  const loadRecent = useCallback(async () => {
    if (!projectId) return;
    const list = await api<{ items: DriveItem[] }>(`/api/site-test/${projectId}/list?folder=${encodeURIComponent(LAB_FOLDER)}`, { token }).catch(() => ({ items: [] }));
    setRecent(list.items || []);
  }, [projectId, token]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  async function probeSharePoint() {
    setMsg("Probing SharePoint…");
    try {
      const r = await api<any>("/api/graph/test-sharepoint", { method: "POST", token });
      setHealth(r.health || null);
      setMsg(r.ok ? `SharePoint OK · ${r.items?.length || 0} root items` : "SharePoint probe failed");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Probe failed");
    }
  }

  async function ensureTree() {
    if (!project?.code) return;
    setBusy(true);
    try {
      await api("/api/graph/ensure-project-tree", { method: "POST", token, body: JSON.stringify({ projectCode: project.code }) });
      setMsg(`SharePoint tree ensured for ${project.code}`);
      await loadRecent();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Tree setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitAll() {
    if (!projectId) return setMsg("Pick a project first");
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("folder", LAB_FOLDER);
      if (note.trim()) fd.append("note", note.trim());
      if (location.trim()) fd.append("location", location.trim());

      // Re-fetch files from evidence state isn't possible (only paths stored) —
      // uploads happen immediately per EvidencePanel callbacks; this submits note/location only
      // if user didn't use inline uploads. For lab, we batch pending via separate state below.

      const res = await api<any>(`/api/site-test/${projectId}/upload`, { method: "POST", token, body: fd });
      setMsg(`Saved to ${res.provider === "sharepoint" ? "SharePoint" : "mock drive"} · ${res.items?.length || 0} item(s)`);
      await loadRecent();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(kind: "photos" | "documents" | "drawings" | "signature", files: File[], extra?: Record<string, string>) {
    if (!projectId) throw new Error("Pick a project first");
    const fd = new FormData();
    fd.append("folder", LAB_FOLDER);
    if (note.trim()) fd.append("note", note.trim());
    if (location.trim()) fd.append("location", location.trim());
    if (extra) Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    const field = kind === "signature" ? "signature" : kind;
    for (const f of files) fd.append(field, f, f.name);
    const res = await api<any>(`/api/site-test/${projectId}/upload`, { method: "POST", token, body: fd });
    return res;
  }

  async function onUploadPhotos(files: File[], caption: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await uploadFiles("photos", files, caption ? { caption } : undefined);
      const added: EvidenceItem[] = (res.items || [])
        .filter((i: any) => i.kind === "photo")
        .map((i: any) => ({ path: i.path, caption, kind: "photo" as const, takenAt: new Date().toISOString() }));
      setPhotos((p) => [...p, ...added]);
      setMsg(`Photo(s) → ${res.provider} · ${added.length} saved`);
      await loadRecent();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadAttachment(file: File) {
    setBusy(true);
    try {
      const res = await uploadFiles("documents", [file]);
      const item = (res.items || []).find((i: any) => i.kind === "document");
      if (item) setAttachments((a) => [...a, { path: item.path, kind: "pdf" }]);
      setMsg(`PDF/doc → ${res.provider} · ${item?.path || file.name}`);
      await loadRecent();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "PDF upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadSignature(file: File, role: string) {
    setBusy(true);
    try {
      const res = await uploadFiles("signature", [file], { role });
      const item = (res.items || []).find((i: any) => i.kind === "signature");
      if (item) setSignatures((s) => [...s, { path: item.path, kind: "signature", caption: role }]);
      setMsg(`Signature (${role}) → ${res.provider}`);
      await loadRecent();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Signature upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadDrawingFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    try {
      const res = await uploadFiles("drawings", [file]);
      const item = (res.items || []).find((i: any) => i.kind === "drawing");
      if (item) setDrawings((d) => [...d, { path: item.path, kind: "pdf" }]);
      setMsg(`Drawing → ${res.provider} · ${item?.path || file.name}`);
      await loadRecent();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Drawing upload failed");
    } finally {
      setBusy(false);
    }
  }

  function openViewer(item: DriveItem) {
    const url = fileUrl(item.path, item.url);
    const kind = isPdf(item.name) ? "pdf" : isImage(item.name) ? "image" : "other";
    setViewer({ title: item.name, url, kind });
  }

  if (!canManage) {
    return (
      <div className="p-8 text-center text-steel-muted max-w-md mx-auto">
        Upload Lab is for admin, office, and site users testing photo / PDF flows on mobile.
      </div>
    );
  }

  const liveMode = status && !status.mockOneDrive && status.graphConfigured;
  const spOk = health?.tokenOk && health?.siteOk;

  return (
    <div className="space-y-5 min-w-0">
      <PageHeader
        eyebrow="Integration test"
        title="Upload Lab"
        subtitle="Open on your phone: tap Camera, mark up a PDF, upload a drawing — all saved to SharePoint UploadLab."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={liveMode && spOk ? "ok" : liveMode ? "warn" : "neutral"}>
              {liveMode ? (spOk ? "SharePoint live" : "Graph configured · probing…") : "Mock drive"}
            </Badge>
            <Button variant="secondary" type="button" onClick={() => void probeSharePoint()} disabled={busy}>
              Test Graph
            </Button>
          </div>
        }
      />

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 space-y-3">
          <h3 className="font-semibold text-sm">Connection</h3>
          <dl className="text-xs space-y-1.5">
            <div className="flex justify-between gap-2">
              <dt className="text-steel-muted">Mode</dt>
              <dd>{status?.mockOneDrive ? "Mock OneDrive" : "SharePoint"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel-muted">Graph configured</dt>
              <dd>{status?.graphConfigured ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel-muted">Token</dt>
              <dd>{health?.tokenOk ? "OK" : "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel-muted">Site</dt>
              <dd className="truncate max-w-[180px]">{health?.siteUrl || status?.siteUrl || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-steel-muted">Mailbox</dt>
              <dd>{status?.mailbox || "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="lg:col-span-2 space-y-3">
          <h3 className="font-semibold text-sm">Project sandbox</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs font-semibold uppercase tracking-widest text-steel-muted flex-1 min-w-[200px]">
              Project
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1">
                <option value="">Select…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </Select>
            </label>
            <Button type="button" variant="secondary" disabled={busy || !project} onClick={() => void ensureTree()}>
              Ensure SP tree
            </Button>
            <Button type="button" variant="secondary" disabled={busy || !projectId} onClick={() => void loadRecent()}>
              Refresh list
            </Button>
          </div>
          <p className="text-xs text-steel-muted font-mono break-all">{LAB_FOLDER}</p>
        </Card>
      </div>

      <Card>
        <EvidencePanel
          title="Upload evidence"
          folderHint={project ? `${project.code} / ${LAB_FOLDER}` : LAB_FOLDER}
          photos={photos}
          attachments={attachments}
          signatures={signatures}
          busy={busy}
          onUploadPhotos={onUploadPhotos}
          onUploadAttachment={onUploadAttachment}
          onUploadSignature={onUploadSignature}
          onRemovePhoto={(i) => setPhotos((p) => p.filter((_, k) => k !== i))}
          onRemoveAttachment={(i) => setAttachments((a) => a.filter((_, k) => k !== i))}
          onRemoveSignature={(i) => setSignatures((s) => s.filter((_, k) => k !== i))}
        />
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold text-sm">Drawing upload (PDF / DWG)</h3>
        <p className="text-xs text-steel-muted">GFC-style sheets land in UploadLab/Drawings on SharePoint.</p>
        <FilePickButton accept=".pdf,.dwg,application/pdf" disabled={busy} onPick={(files) => void onUploadDrawingFiles(files)}>
          Choose drawing file
        </FilePickButton>
        {drawings.length > 0 && (
          <ul className="text-xs divide-y">
            {drawings.map((d, i) => (
              <li key={i} className="py-2 font-mono truncate">{d.path}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold text-sm">Note & GPS (optional)</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Location / grid" value={location} onChange={(e) => setLocation(e.target.value)} />
          <TextArea placeholder="Test note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>
        <Button type="button" variant="secondary" disabled={busy || (!note.trim() && !location.trim())} onClick={() => void submitAll()}>
          Save note only
        </Button>
      </Card>

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm flex justify-between items-center">
          <span>Recent in SharePoint ({recent.length})</span>
          <span className="text-xs font-normal text-steel-muted">Click to preview</span>
        </div>
        <ul className="divide-y max-h-72 overflow-y-auto">
          {recent.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-xs hover:bg-sand/50 flex items-center gap-2"
                onClick={() => item.type === "file" && openViewer(item)}
                disabled={item.type === "folder"}
              >
                <Badge tone={item.type === "folder" ? "neutral" : "brand"}>{item.type}</Badge>
                <span className="truncate font-mono">{item.name}</span>
              </button>
            </li>
          ))}
          {!recent.length && <li className="px-4 py-6 text-sm text-steel-muted text-center">No files yet — upload above.</li>}
        </ul>
      </Card>

      {viewer && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setViewer(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-ink text-white">
              <div className="min-w-0">
                <div className="font-semibold truncate">{viewer.title}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={viewer.url} target="_blank" rel="noreferrer" className="text-xs underline">Open tab</a>
                <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={() => setViewer(null)}>Close</Button>
              </div>
            </div>
            <div className="flex-1 min-h-[50vh] bg-sand/60">
              {viewer.kind === "image" && <img src={viewer.url} alt={viewer.title} className="max-h-[75vh] mx-auto object-contain p-4" />}
              {viewer.kind === "pdf" && <iframe title={viewer.title} src={viewer.url} className="w-full h-[75vh] border-0" />}
              {viewer.kind === "other" && (
                <div className="p-8 text-center">
                  <a href={viewer.url} className="text-brand font-semibold" target="_blank" rel="noreferrer">Download / open →</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
