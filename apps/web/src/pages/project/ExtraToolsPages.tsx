import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { DrawingFileViewer } from "../../components/DrawingFileViewer";
import {
  currentDrawingRevision,
  drawingHasPreviewFile,
  drawingPreviewFromRecord,
  revisionPreviewFromRecord,
} from "../../lib/drawingPreview";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";

export function CoordinationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    discipline: "MEP",
    location: "",
    priority: "Medium",
    assignedToName: "",
    dueDate: "",
    linkedDrawingId: "",
    ballInCourt: "Assignee",
  });
  const [filter, setFilter] = useState("All");
  const canEdit =
    user?.role === "admin" ||
    user?.role === "office" ||
    user?.role === "employee" ||
    user?.role === "site_employee";

  const load = async () => {
    const [o, d] = await Promise.all([
      api<any>(`/api/directory/project/${id}/overview`, { token }),
      api<any[]>(`/api/drawings/project/${id}`, { token }).catch(() => []),
    ]);
    setRows(o.coordination || []);
    setDrawings(d);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = rows.filter((r) => filter === "All" || r.status === filter);
  const openCount = rows.filter((r) => r.status === "Open").length;

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((r) => r.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((r) => r.id === selectedId) || null;
  const linkedDrawing = selected?.linkedDrawingId
    ? drawings.find((d) => d.id === selected.linkedDrawingId)
    : null;
  const linkedRevision = linkedDrawing ? currentDrawingRevision(linkedDrawing) : null;
  const drawingPreview = linkedDrawing ? drawingPreviewFromRecord(linkedDrawing) : null;
  const revisionPreview =
    linkedDrawing && linkedRevision ? revisionPreviewFromRecord(linkedDrawing, linkedRevision) : null;

  const drawingsWithFiles = useMemo(() => drawings.filter((d) => drawingHasPreviewFile(d)), [drawings]);

  const [linkDrawingId, setLinkDrawingId] = useState("");
  useEffect(() => {
    setLinkDrawingId(selected?.linkedDrawingId || "");
  }, [selected?.id, selected?.linkedDrawingId]);

  async function patchIssue(id: string, body: Record<string, unknown>) {
    await api(`/api/directory/coordination/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
    await load();
  }

  function escalateToRfi(issue: {
    title?: string;
    description?: string;
    discipline?: string;
    location?: string;
    linkedDrawingId?: string;
  }) {
    const params = new URLSearchParams({
      kind: "RequestForInformation",
      compose: "1",
      subject: issue.title || "Design coordination issue",
    });
    if (issue.description) params.set("body", issue.description);
    if (issue.discipline) params.set("discipline", issue.discipline);
    if (issue.location) params.set("location", issue.location);
    if (issue.linkedDrawingId) params.set("drawingId", issue.linkedDrawingId);
    navigate(`/projects/${id}/rfis?${params.toString()}`);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Drawings module"
        title="Design coordination"
        subtitle="Log clash / design conflicts, preview the linked GFC sheet in a separate viewer, then escalate to Ask RFI. Drawing PDFs live in SharePoint — use Drawing files for folder browse."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="warn">{openCount} open</Badge>
            <Badge tone="ok">{rows.length - openCount} closed</Badge>
          </div>
        }
      />

      <Card className="border-brand/20 bg-gradient-to-r from-brand-soft/40 to-paper">
        <h3 className="text-sm font-semibold mb-2">How to use this page</h3>
        <ol className="text-sm text-steel-muted space-y-1.5 list-decimal list-inside">
          <li>
            Upload the GFC sheet first on{" "}
            <Link to={`/projects/${id}/drawings`} className="text-brand font-semibold">
              GFC register
            </Link>{" "}
            ({drawingsWithFiles.length} of {drawings.length} drawings have a PDF/DWG).
          </li>
          <li>Log an issue and pick <strong>Linked GFC drawing</strong> from the dropdown — that drives the PDF preview on the right.</li>
          <li>Select an issue in the register → use <strong>Link / change drawing</strong> if you forgot to link when logging.</li>
          <li>
            <strong>Close</strong> when resolved on site, or <strong>Escalate to Ask RFI</strong> for formal consultant response.
          </li>
        </ol>
      </Card>

      {canEdit && (
        <Card>
          <h3 className="font-semibold mb-3">Raise coordination issue</h3>
          <form
            className="grid sm:grid-cols-2 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const created = await api<any>(`/api/directory/project/${id}/coordination`, {
                method: "POST",
                token,
                body: JSON.stringify(form),
              });
              setForm({
                title: "",
                description: "",
                discipline: "MEP",
                location: "",
                priority: "Medium",
                assignedToName: "",
                dueDate: "",
                linkedDrawingId: "",
                ballInCourt: "Assignee",
              });
              await load();
              if (created?.id) setSelectedId(created.id);
            }}
          >
            <Input className="sm:col-span-2" required placeholder="Issue title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              {["Architecture", "Structural", "MEP", "Civil"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {["Low", "Medium", "High"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Input placeholder="Location / grid" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Assignee name" value={form.assignedToName} onChange={(e) => setForm({ ...form, assignedToName: e.target.value })} />
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Linked GFC drawing (for PDF preview)
              </span>
              <Select value={form.linkedDrawingId} onChange={(e) => setForm({ ...form, linkedDrawingId: e.target.value })}>
                <option value="">— Select drawing with uploaded file —</option>
                {drawingsWithFiles.length > 0 && (
                  <optgroup label="Ready for preview">
                    {drawingsWithFiles.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.drawingNumber} · {d.currentRev || "—"} — {d.title}
                      </option>
                    ))}
                  </optgroup>
                )}
                {drawings.filter((d) => !drawingHasPreviewFile(d)).length > 0 && (
                  <optgroup label="No file yet — upload on GFC register first">
                    {drawings
                      .filter((d) => !drawingHasPreviewFile(d))
                      .map((d) => (
                        <option key={d.id} value={d.id} disabled>
                          {d.drawingNumber} — {d.title} (no PDF/DWG)
                        </option>
                      ))}
                  </optgroup>
                )}
              </Select>
            </label>
            <Select value={form.ballInCourt} onChange={(e) => setForm({ ...form, ballInCourt: e.target.value })}>
              {["Assignee", "Creator", "Consultant", "Contractor", "PMC"].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
            <TextArea
              className="sm:col-span-2"
              rows={2}
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Button type="submit" className="sm:col-span-2">
              Log issue
            </Button>
          </form>
        </Card>
      )}

      <div className="flex gap-1 flex-wrap">
        {["All", "Open", "Closed"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1.5 text-xs border ${filter === f ? "bg-procore-navy text-white" : "bg-white border-line"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid xl:grid-cols-2 gap-4 min-h-[480px]">
        <Card padding={false} className="flex flex-col min-h-[420px]">
          <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm">Coordination register</div>
          <ul className="divide-y flex-1 overflow-y-auto">
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-4 py-3 text-sm transition hover:bg-brand-soft/40 ${
                    selectedId === r.id ? "bg-brand-soft/70 border-l-4 border-brand" : ""
                  }`}
                >
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-steel-muted mt-1">
                    {r.discipline} · {r.priority}
                    {r.location ? ` · ${r.location}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone={r.status === "Open" ? "warn" : "ok"}>{r.status}</Badge>
                    {r.linkedDrawingId && <Badge tone="brand">Linked drawing</Badge>}
                  </div>
                </button>
              </li>
            ))}
            {!filtered.length && <li className="p-4 text-sm text-steel-muted">No coordination issues.</li>}
          </ul>
        </Card>

        <div className="flex flex-col gap-4 min-h-[420px]">
          {selected ? (
            <Card className="shrink-0">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{selected.title}</h3>
                  <p className="text-xs text-steel-muted mt-1">
                    {selected.discipline} · {selected.priority}
                    {selected.location ? ` · ${selected.location}` : ""}
                    {selected.assignedToName ? ` · ${selected.assignedToName}` : ""}
                  </p>
                  {selected.description && (
                    <p className="text-sm text-steel-muted mt-2 leading-relaxed">{selected.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="neutral">BIC: {selected.ballInCourt || "Assignee"}</Badge>
                    {linkedDrawing && (
                      <Badge tone="brand">
                        {linkedDrawing.drawingNumber} · {linkedDrawing.currentRev || "—"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  {revisionPreview?.pdf && (
                    <Button type="button" variant="secondary" className="!text-xs" onClick={() => setViewerOpen(true)}>
                      Full-screen PDF
                    </Button>
                  )}
                  {canEdit && selected.status === "Open" && (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        className="!text-xs"
                        onClick={() => escalateToRfi(selected)}
                      >
                        Escalate to Ask RFI
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="!text-xs"
                        onClick={() => void patchIssue(selected.id, { status: "Closed" })}
                      >
                        Close issue
                      </Button>
                    </>
                  )}
                  {canEdit && selected.status === "Closed" && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="!text-xs"
                      onClick={() => void patchIssue(selected.id, { status: "Open" })}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className="mt-4 pt-4 border-t border-line grid sm:grid-cols-[1fr_auto] gap-2 items-end">
                  <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                      Link / change GFC drawing
                    </span>
                    <Select value={linkDrawingId} onChange={(e) => setLinkDrawingId(e.target.value)}>
                      <option value="">No linked drawing</option>
                      {drawingsWithFiles.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.drawingNumber} · {d.currentRev || "—"} — {d.title}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!text-xs"
                    disabled={linkDrawingId === (selected.linkedDrawingId || "")}
                    onClick={() => void patchIssue(selected.id, { linkedDrawingId: linkDrawingId || null })}
                  >
                    Save link
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-steel-muted">Select an issue to preview the linked drawing and escalate.</p>
            </Card>
          )}

          {revisionPreview?.pdf || revisionPreview?.dwg || drawingPreview ? (
            <DrawingFileViewer
              {...(revisionPreview?.pdf || revisionPreview?.dwg
                ? { revision: revisionPreview }
                : { preview: drawingPreview! })}
              variant="inline"
              className="flex-1 min-h-[360px]"
            />
          ) : (
            <Card className="flex-1 grid place-items-center text-center p-8">
              <div className="text-sm text-steel-muted max-w-md space-y-3">
                {!selected?.linkedDrawingId ? (
                  <>
                    <p>No drawing linked yet.</p>
                    <p className="text-xs">
                      When logging an issue, choose <strong>Linked GFC drawing</strong>, or select the issue above and use{" "}
                      <strong>Link / change GFC drawing</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <p>Linked drawing has no PDF/DWG file yet.</p>
                    <Link to={`/projects/${id}/drawings`} className="inline-block text-brand font-semibold text-sm">
                      Upload on GFC register →
                    </Link>
                  </>
                )}
                <Link to={`/projects/${id}/drawings/library`} className="inline-block text-xs text-steel-muted underline">
                  Or browse Drawing files (SharePoint folders)
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>

      {viewerOpen && revisionPreview && (
        <DrawingFileViewer revision={revisionPreview} variant="modal" onClose={() => setViewerOpen(false)} />
      )}
    </div>
  );
}

const SUBMITTAL_TYPES = ["Product Data", "Shop Drawing", "Sample", "Mixed", "Other"];
const SUBMITTAL_STATUSES = ["Draft", "Submitted", "Under Review", "Revise & Resubmit", "Approved", "Rejected"];

/** Procore-like submittal register with workflow */
export function SubmittalsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({
    title: "",
    submittalType: "Product Data",
    specSection: "",
    description: "",
    dueDate: "",
    revisionNumber: "0",
  });
  const canCreate = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");
  const canReview = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const list = await api<any[]>(`/api/directory/project/${id}/submittals`, { token });
    setRows(list);
    if (!active && list[0]) setActive(list[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = rows.filter((r) => filter === "All" || r.status === filter);
  const selected = rows.find((r) => r.id === active);

  async function transition(status: string, ballInCourt?: string) {
    if (!selected) return;
    await api(`/api/directory/submittals/${selected.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        status,
        ballInCourt: ballInCourt || (status === "Approved" ? "Closed" : status === "Submitted" ? "Reviewer" : selected.ballInCourt),
        revisionNumber:
          status === "Revise & Resubmit" ? String(Number(selected.revisionNumber || 0) + 1) : selected.revisionNumber,
      }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals · Procore-style"
        title="Submittals"
        subtitle="Draft → Submit → Under review → Approve / Revise. Ball-in-court workflow for product data, shop drawings, and samples."
      />

      {canCreate && (
        <Card>
          <h3 className="font-semibold mb-3">Create submittal</h3>
          <form
            className="grid sm:grid-cols-2 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/api/directory/project/${id}/submittals`, {
                method: "POST",
                token,
                body: JSON.stringify(form),
              });
              setForm({ title: "", submittalType: "Product Data", specSection: "", description: "", dueDate: "", revisionNumber: "0" });
              await load();
            }}
          >
            <Input className="sm:col-span-2" required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.submittalType} onChange={(e) => setForm({ ...form, submittalType: e.target.value })}>
              {SUBMITTAL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Input placeholder="Spec section" value={form.specSection} onChange={(e) => setForm({ ...form, specSection: e.target.value })} />
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <Input placeholder="Rev #" value={form.revisionNumber} onChange={(e) => setForm({ ...form, revisionNumber: e.target.value })} />
            <TextArea className="sm:col-span-2" rows={2} placeholder="Description / package notes" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button type="submit" className="sm:col-span-2">
              Create draft
            </Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-1">
        {["All", ...SUBMITTAL_STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded px-3 py-1 text-xs border ${filter === s ? "bg-procore-navy text-white" : "bg-white border-line"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm">Register</div>
          <ul className="divide-y max-h-[60vh] overflow-y-auto">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`w-full text-left px-4 py-3 text-sm ${active === r.id ? "bg-brand-soft" : "hover:bg-sand/40"}`}
                onClick={() => setActive(r.id)}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-[11px] text-brand">{r.number}</span>
                  <Badge>{r.status}</Badge>
                </div>
                <div className="font-medium mt-1">{r.title}</div>
                <div className="text-[11px] text-steel-muted mt-0.5">
                  {r.submittalType} · Rev {r.revisionNumber} · BIC {r.ballInCourt}
                </div>
              </button>
            ))}
            {!filtered.length && <li className="p-4 text-sm text-steel-muted">No submittals.</li>}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-sm text-steel-muted">Select a submittal</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-xs text-brand">{selected.number}</div>
                <h2 className="font-display text-2xl mt-1">{selected.title}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge tone="brand">{selected.status}</Badge>
                  <Badge>BIC: {selected.ballInCourt}</Badge>
                  <Badge tone="neutral">{selected.submittalType}</Badge>
                  <Badge tone="neutral">Rev {selected.revisionNumber}</Badge>
                </div>
              </div>
              {selected.description && <p className="text-sm bg-sand/40 p-3 rounded-lg">{selected.description}</p>}
              <div className="text-xs text-steel-muted">
                Spec: {selected.specSection || "—"} · Due: {selected.dueDate ? new Date(selected.dueDate).toLocaleDateString() : "—"}
              </div>
              {selected.reviewerNotes && (
                <div className="border border-line rounded-lg p-3 text-sm">
                  <div className="text-[11px] uppercase text-steel-muted font-semibold">Reviewer notes</div>
                  {selected.reviewerNotes}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
                {canCreate && selected.status === "Draft" && (
                  <Button type="button" onClick={() => void transition("Submitted", "Reviewer")}>
                    Submit for review
                  </Button>
                )}
                {canReview && ["Submitted", "Under Review"].includes(selected.status) && (
                  <>
                    <Button type="button" onClick={() => void transition("Under Review", "Reviewer")}>
                      Mark under review
                    </Button>
                    <Button type="button" onClick={() => void transition("Approved", "Closed")}>
                      Approve
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void transition("Revise & Resubmit", "Submitter")}>
                      Revise & resubmit
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => void transition("Rejected", "Closed")}>
                      Reject
                    </Button>
                  </>
                )}
                {canCreate && selected.status === "Revise & Resubmit" && (
                  <Button type="button" onClick={() => void transition("Submitted", "Reviewer")}>
                    Resubmit
                  </Button>
                )}
              </div>
              {canReview && (
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    await api(`/api/directory/submittals/${selected.id}`, {
                      method: "PATCH",
                      token,
                      body: JSON.stringify({ reviewerNotes: String(fd.get("notes") || "") }),
                    });
                    await load();
                  }}
                >
                  <TextArea name="notes" rows={2} placeholder="Reviewer notes" defaultValue={selected.reviewerNotes || ""} />
                  <Button type="submit" variant="secondary">
                    Save notes
                  </Button>
                </form>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Procore-like photo albums with file upload */
export function PhotosPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [photos, setPhotos] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [album, setAlbum] = useState("Site Progress");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [trade, setTrade] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filterAlbum, setFilterAlbum] = useState("All");
  const canUpload = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");

  const load = async () => {
    const res = await api<{ photos: any[]; albums: any[] }>(`/api/directory/project/${id}/photos`, { token });
    setPhotos(res.photos || []);
    setAlbums(res.albums || []);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = useMemo(
    () => (filterAlbum === "All" ? photos : photos.filter((p) => p.album === filterAlbum)),
    [photos, filterAlbum]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Media · field capture"
        title="Photos"
        subtitle="Album-based site photos (Procore-style). Upload images into albums — used with diary, RFIs, and checklists."
      />

      {canUpload && (
        <Card>
          <h3 className="font-semibold mb-3">Upload photo</h3>
          <form
            className="grid sm:grid-cols-2 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.append("album", album);
              fd.append("description", description);
              fd.append("location", location);
              fd.append("trade", trade);
              if (file) fd.append("file", file);
              await api(`/api/directory/project/${id}/photos`, { method: "POST", token, body: fd });
              setDescription("");
              setFile(null);
              await load();
            }}
          >
            <Input placeholder="Album (e.g. Site Progress, Safety, Structure)" value={album} onChange={(e) => setAlbum(e.target.value)} />
            <Input placeholder="Location / grid" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Input placeholder="Trade" value={trade} onChange={(e) => setTrade(e.target.value)} />
            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input className="sm:col-span-2 text-sm" type="file" accept="image/*,.pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button type="submit" className="sm:col-span-2" disabled={!file && !description}>
              Upload to album
            </Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setFilterAlbum("All")}
          className={`rounded px-3 py-1 text-xs border ${filterAlbum === "All" ? "bg-procore-navy text-white" : "bg-white border-line"}`}
        >
          All ({photos.length})
        </button>
        {albums.map((a) => (
          <button
            key={a.album}
            type="button"
            onClick={() => setFilterAlbum(a.album)}
            className={`rounded px-3 py-1 text-xs border ${filterAlbum === a.album ? "bg-procore-navy text-white" : "bg-white border-line"}`}
          >
            {a.album} ({a._count})
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <Card key={p.id} padding={false} className="overflow-hidden">
            <div className="aspect-[4/3] bg-sand flex items-center justify-center border-b border-line">
              {p.fileUrl && /\.(png|jpe?g|gif|webp)$/i.test(p.fileUrl) ? (
                <img src={p.fileUrl} alt={p.description || "Photo"} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <div className="text-3xl text-steel-muted/40">▣</div>
                  <a href={p.fileUrl} className="text-xs text-brand font-semibold" target="_blank" rel="noreferrer">
                    Open file
                  </a>
                </div>
              )}
            </div>
            <div className="p-3 space-y-1">
              <Badge tone="brand">{p.album}</Badge>
              <div className="text-sm font-medium">{p.description || "Photo"}</div>
              <div className="text-[11px] text-steel-muted">
                {[p.location, p.trade].filter(Boolean).join(" · ") || "—"} · {new Date(p.createdAt).toLocaleString()}
              </div>
            </div>
          </Card>
        ))}
        {!filtered.length && <p className="text-sm text-steel-muted col-span-full">No photos yet — upload into an album.</p>}
      </div>
    </div>
  );
}
