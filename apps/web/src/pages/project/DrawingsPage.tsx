import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { canManageDrawings, isClientViewOnly } from "../../permissions";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import { UploadModal } from "../../components/UploadModal";

const API_BASE = import.meta.env.VITE_API_URL || "";
const REV_SLOTS = ["R0", "R1", "R2", "R3", "R4", "R5"] as const;

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fileKind(nameOrUrl?: string | null) {
  const n = (nameOrUrl || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp)(\?|$)/.test(n)) return "image";
  if (/\.pdf(\?|$)/.test(n)) return "pdf";
  return "other";
}

export default function DrawingsPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [drawings, setDrawings] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ title: string; fileUrl: string; fileName?: string } | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    drawingNumber: "",
    title: "",
    discipline: "Architecture",
    buildingArea: "",
    tlNo: "",
    revisionNumber: "R0",
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

  useEffect(() => {
    if (searchParams.get("upload") === "1" && canUpload) {
      setShowRegister(true);
      setFormError("");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, canUpload, setSearchParams]);

  const disciplines = ["All", ...Array.from(new Set(drawings.map((d) => d.discipline)))];
  const filtered = useMemo(
    () => (filter === "All" ? drawings : drawings.filter((d) => d.discipline === filter)),
    [drawings, filter]
  );
  const uploadTarget = drawings.find((d) => d.id === uploadForId);

  async function exportCsv() {
    const res = await fetch(`${API_BASE}/api/drawings/project/${id}/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return setMsg("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gfc-drawing-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function registerDrawing(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setFormError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (file) fd.append("file", file);
      await api(`/api/drawings/project/${id}`, { method: "POST", token, body: fd });
      setForm({
        drawingNumber: "",
        title: "",
        discipline: form.discipline,
        buildingArea: "",
        tlNo: "",
        revisionNumber: "R0",
        publish: true,
      });
      setFile(null);
      setShowRegister(false);
      setMsg("Drawing saved to GFC register.");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function closeRegister() {
    setShowRegister(false);
    setFile(null);
    setFormError("");
  }

  async function uploadRevision(e: FormEvent) {
    e.preventDefault();
    if (!uploadForId) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("revisionNumber", revForm.revisionNumber);
      fd.append("revisionLabel", revForm.revisionLabel || revForm.revisionNumber);
      fd.append("publish", String(revForm.publish));
      if (revFile) fd.append("file", revFile);
      await api(`/api/drawings/${uploadForId}/revisions`, { method: "POST", token, body: fd });
      setUploadForId(null);
      setRevFile(null);
      setExpandedId(uploadForId);
      setMsg("Revision uploaded — date logged on the register.");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Revision upload failed");
    } finally {
      setBusy(false);
    }
  }

  function openUploadRev(d: any) {
    const next = `R${Math.min(d.revisions?.length || 0, 5)}`;
    setUploadForId(d.id);
    setExpandedId(d.id);
    setRevForm({
      revisionNumber: next,
      revisionLabel: `${next} — ${new Date().toLocaleDateString()}`,
      publish: true,
    });
    setRevFile(null);
  }

  const viewerKind = fileKind(viewer?.fileName || viewer?.fileUrl);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Approval & GFC Drawing Log"
        title="Drawing register"
        subtitle={
          clientOnly
            ? "View published sheets and revision dates. Clients cannot upload."
            : "GFC-style log with R0–R5 dates. After publish, upload more revisions anytime. View PDFs/images in the reader."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void exportCsv()}>
              Export GFC CSV
            </Button>
            {canUpload && (
              <Button
                type="button"
                onClick={() => {
                  setShowRegister(true);
                  setFormError("");
                }}
              >
                Upload drawing
              </Button>
            )}
          </div>
        }
      />

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      <div className="flex flex-wrap gap-1">
        {disciplines.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setFilter(d)}
            className={`rounded px-3 py-1 text-xs font-medium border ${
              filter === d ? "bg-procore-navy text-white border-procore-navy" : "bg-white border-line"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {canUpload && (
        <UploadModal
          open={showRegister}
          title="Upload drawing"
          context={`Project · GFC register · ${form.discipline}`}
          file={file}
          onFile={setFile}
          accept=".pdf,.png,.jpg,.jpeg,.dwg,.webp"
          primaryLabel={form.publish ? "Upload & publish" : "Upload to register"}
          busy={busy}
          error={formError}
          onClose={closeRegister}
          onSubmit={registerDrawing}
          fields={[
            {
              kind: "text",
              name: "drawingNumber",
              label: "Drawing no.",
              required: true,
              placeholder: "A-101",
              value: form.drawingNumber,
              onChange: (v) => setForm({ ...form, drawingNumber: v }),
            },
            {
              kind: "text",
              name: "title",
              label: "Title",
              required: true,
              placeholder: "Ground floor plan",
              value: form.title,
              onChange: (v) => setForm({ ...form, title: v }),
            },
            {
              kind: "select",
              name: "discipline",
              label: "Discipline",
              value: form.discipline,
              onChange: (v) => setForm({ ...form, discipline: v }),
              options: ["Architecture", "Structural", "MEP", "Civil"],
            },
            {
              kind: "text",
              name: "buildingArea",
              label: "Building / Area",
              placeholder: "Block A",
              value: form.buildingArea,
              onChange: (v) => setForm({ ...form, buildingArea: v }),
            },
            {
              kind: "text",
              name: "tlNo",
              label: "TL No",
              value: form.tlNo,
              onChange: (v) => setForm({ ...form, tlNo: v }),
            },
            {
              kind: "text",
              name: "revisionNumber",
              label: "First revision",
              placeholder: "R0",
              value: form.revisionNumber,
              onChange: (v) => setForm({ ...form, revisionNumber: v }),
            },
            {
              kind: "checkbox",
              name: "publish",
              label: "Publish now (unlocks checklist fills for engineers)",
              checked: form.publish,
              onChange: (v) => setForm({ ...form, publish: v }),
            },
          ]}
        />
      )}

      <Card padding={false} className="overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-procore-navy text-white flex justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">INDORE · Drawing register</div>
            <div className="text-[11px] text-white/70">Discipline · Area · TL · DWG · R0–R5 dates · browse / revisions</div>
          </div>
          <Badge tone="neutral">{drawings.filter((d) => d.isPublished).length} published</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-sand text-left text-[10px] uppercase tracking-wide text-steel-muted">
              <tr>
                <th className="px-2 py-2">Discipline</th>
                <th className="px-2 py-2">Building/Area</th>
                <th className="px-2 py-2">TL No</th>
                <th className="px-2 py-2">DWG. No.</th>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Browse</th>
                {REV_SLOTS.map((r) => (
                  <th key={r} className="px-2 py-2 text-center">
                    {r}
                  </th>
                ))}
                <th className="px-2 py-2 text-center">Total</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const revsAsc = [...(d.revisions || [])].sort(
                  (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                const latest = revsAsc[revsAsc.length - 1];
                const open = expandedId === d.id;
                return (
                  <Fragment key={d.id}>
                    <tr className={`border-t border-line ${open ? "bg-brand-soft/30" : "hover:bg-sand/40"}`}>
                      <td className="px-2 py-2 text-xs">{d.discipline}</td>
                      <td className="px-2 py-2 text-xs">{d.buildingArea || "—"}</td>
                      <td className="px-2 py-2 text-xs font-mono">{d.tlNo || "—"}</td>
                      <td className="px-2 py-2 font-mono text-xs text-brand font-semibold">{d.drawingNumber}</td>
                      <td className="px-2 py-2 font-medium max-w-[180px]">{d.title}</td>
                      <td className="px-2 py-2">
                        {latest?.fileUrl ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-brand hover:underline"
                            onClick={() =>
                              setViewer({
                                title: `${d.drawingNumber} · ${d.currentRev}`,
                                fileUrl: latest.fileUrl,
                                fileName: latest.fileName,
                              })
                            }
                          >
                            Open
                          </button>
                        ) : (
                          <span className="text-xs text-steel-muted">—</span>
                        )}
                      </td>
                      {REV_SLOTS.map((_, i) => (
                        <td key={i} className="px-2 py-2 text-[11px] text-center font-mono text-steel-muted whitespace-nowrap">
                          {revsAsc[i] ? fmtDate(revsAsc[i].createdAt) : "—"}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-mono text-xs">{revsAsc.length}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button type="button" variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => setExpandedId(open ? null : d.id)}>
                            {open ? "Hide log" : "Log"}
                          </Button>
                          {canUpload && (
                            <Button type="button" variant="secondary" className="!px-2 !py-1 !text-xs" onClick={() => openUploadRev(d)}>
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
                                setMsg("Published — checklists unlock. You can still upload further revisions.");
                                await load();
                              }}
                            >
                              Publish
                            </Button>
                          )}
                          {d.isPublished && <Badge tone="ok">Pub</Badge>}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-line bg-[#f8fafc]">
                        <td colSpan={15} className="px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <h4 className="text-xs font-mono uppercase tracking-wide text-steel-muted">
                              Upload log — {d.drawingNumber} ({d.currentRev})
                            </h4>
                            {canUpload && (
                              <Button type="button" className="!text-xs !py-1" onClick={() => openUploadRev(d)}>
                                + Next revision
                              </Button>
                            )}
                          </div>
                          <ul className="space-y-2">
                            {revsAsc.map((r: any, idx: number) => (
                              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
                                <div>
                                  <div className="font-semibold">
                                    {r.revisionNumber || `R${idx}`}
                                    {idx === revsAsc.length - 1 && <span className="ml-2 text-[10px] text-brand font-mono">CURRENT</span>}
                                  </div>
                                  <div className="text-xs text-steel-muted">
                                    {fmtDate(r.createdAt)} · {r.revisionLabel || "—"}
                                    {r.uploadedBy?.fullName ? ` · ${r.uploadedBy.fullName}` : ""}
                                  </div>
                                  {r.fileName && <div className="text-[11px] font-mono mt-0.5">{r.fileName}</div>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge tone={r.published ? "ok" : "neutral"}>{r.published ? "Live" : "Draft"}</Badge>
                                  {r.fileUrl && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="!text-xs !px-2 !py-1"
                                      onClick={() =>
                                        setViewer({
                                          title: `${d.drawingNumber} · ${r.revisionNumber}`,
                                          fileUrl: r.fileUrl,
                                          fileName: r.fileName,
                                        })
                                      }
                                    >
                                      View
                                    </Button>
                                  )}
                                </div>
                              </li>
                            ))}
                            {!revsAsc.length && <li className="text-sm text-steel-muted">No uploads yet.</li>}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={15} className="px-4 py-10 text-center text-sm text-steel-muted">
                    No drawings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {canUpload && uploadForId && uploadTarget && (
        <UploadModal
          open={!!uploadForId}
          title="Upload revision"
          context={`${uploadTarget.drawingNumber} · current ${uploadTarget.currentRev} · ${uploadTarget.revisions?.length || 0} file(s)`}
          file={revFile}
          onFile={setRevFile}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg"
          primaryLabel="Upload & log date"
          busy={busy}
          error={formError}
          onClose={() => {
            setUploadForId(null);
            setRevFile(null);
            setFormError("");
          }}
          onSubmit={uploadRevision}
          fields={[
            {
              kind: "text",
              name: "revisionNumber",
              label: "Revision",
              required: true,
              placeholder: "R1",
              value: revForm.revisionNumber,
              onChange: (v) => setRevForm({ ...revForm, revisionNumber: v }),
            },
            {
              kind: "text",
              name: "revisionLabel",
              label: "Label / note",
              value: revForm.revisionLabel,
              onChange: (v) => setRevForm({ ...revForm, revisionLabel: v }),
            },
            {
              kind: "checkbox",
              name: "publish",
              label: "Set as current published revision",
              checked: revForm.publish,
              onChange: (v) => setRevForm({ ...revForm, publish: v }),
            },
          ]}
        />
      )}

      {viewer && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line bg-procore-navy text-white">
              <div className="min-w-0">
                <div className="font-semibold truncate">{viewer.title}</div>
                <div className="text-[11px] text-white/70 truncate">{viewer.fileName || viewer.fileUrl}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={viewer.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline text-white/90">
                  Open tab
                </a>
                <Button type="button" variant="secondary" className="!py-1 !text-xs" onClick={() => setViewer(null)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-[50vh] bg-sand/60">
              {viewerKind === "image" && (
                <img src={viewer.fileUrl} alt={viewer.title} className="max-h-[75vh] mx-auto object-contain p-4" />
              )}
              {viewerKind === "pdf" && (
                <iframe title={viewer.title} src={viewer.fileUrl} className="w-full h-[75vh] border-0" />
              )}
              {viewerKind === "other" && (
                <div className="p-8 text-center space-y-3">
                  <p className="text-sm text-steel-muted">Preview not available for this file type. Download or open in a new tab.</p>
                  <a href={viewer.fileUrl} className="text-brand font-semibold" target="_blank" rel="noreferrer">
                    Download / open file →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
