import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";

export function CoordinationPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    discipline: "MEP",
    location: "",
    priority: "Medium",
  });
  const [filter, setFilter] = useState("All");
  const canEdit =
    user?.role === "admin" ||
    user?.role === "office" ||
    user?.role === "employee" ||
    user?.role === "site_employee";

  const load = () =>
    api<any>(`/api/directory/project/${id}/overview`, { token }).then((o) => setRows(o.coordination || []));

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = rows.filter((r) => filter === "All" || r.status === filter);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Design"
        title="Design coordination"
        subtitle="Clash and coordination issues across Architecture, Structural, MEP, and Civil — open / close status."
      />

      {canEdit && (
        <Card>
          <h3 className="font-semibold mb-3">Raise coordination issue</h3>
          <form
            className="grid sm:grid-cols-2 gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/api/directory/project/${id}/coordination`, {
                method: "POST",
                token,
                body: JSON.stringify(form),
              });
              setForm({ title: "", description: "", discipline: "MEP", location: "", priority: "Medium" });
              await load();
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

      <div className="flex gap-1">
        {["All", "Open", "Closed"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-xs border ${filter === f ? "bg-procore-navy text-white" : "bg-white border-line"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card padding={false}>
        <ul className="divide-y">
          {filtered.map((r) => (
            <li key={r.id} className="px-4 py-3 flex flex-wrap justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-steel-muted mt-0.5">
                  {r.discipline} · {r.priority}
                  {r.location ? ` · ${r.location}` : ""}
                </div>
                {r.description && <p className="text-xs text-steel-muted mt-1">{r.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={r.status === "Open" ? "warn" : "ok"}>{r.status}</Badge>
                {canEdit && r.status === "Open" && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="!text-xs !py-1"
                    onClick={async () => {
                      await api(`/api/directory/coordination/${r.id}`, {
                        method: "PATCH",
                        token,
                        body: JSON.stringify({ status: "Closed" }),
                      });
                      await load();
                    }}
                  >
                    Close
                  </Button>
                )}
              </div>
            </li>
          ))}
          {!filtered.length && <li className="p-4 text-sm text-steel-muted">No coordination issues.</li>}
        </ul>
      </Card>
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
            <input className="sm:col-span-2 text-sm" type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
