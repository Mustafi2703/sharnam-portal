import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, TextArea } from "../components/ui";
import { BrandMark } from "../components/Brand";

type Item = { id: string; itemCode?: string; description: string; section?: string };
type LineResponse = { answer: string; remarks: string; photos: File[]; docs: File[] };

/** Spacious Procore-style fill form: pick drawing → pick revision → fill lines with evidence */
export default function ChecklistFillPage() {
  const { id: projectId, assignmentId } = useParams();
  const [search] = useSearchParams();
  const family = search.get("family") || "SiteExecution";
  const { token, user } = useAuth();
  const [assignment, setAssignment] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [drawingId, setDrawingId] = useState("");
  const [revisionId, setRevisionId] = useState("");
  const [responses, setResponses] = useState<Record<string, LineResponse>>({});
  const [remarks, setRemarks] = useState("");
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [msg, setMsg] = useState("");
  const canFill = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");

  const emptyLine = (): LineResponse => ({ answer: "", remarks: "", photos: [], docs: [] });

  const load = async () => {
    const [a, d] = await Promise.all([
      api<any>(`/api/checklist/assignments/${assignmentId}`, { token }),
      api<any[]>(`/api/drawings/project/${projectId}`, { token }),
    ]);
    setAssignment(a);
    const published = d.filter((x) => x.isPublished && (x.revisions?.length || 0) > 0);
    setDrawings(published.length ? published : d);
    const init: Record<string, LineResponse> = {};
    a.template.items.forEach((i: Item) => {
      init[i.id] = emptyLine();
    });
    setResponses(init);
  };

  useEffect(() => {
    void load();
  }, [assignmentId, projectId, token]);

  const selectedDrawing = drawings.find((d) => d.id === drawingId);
  const revs = useMemo(() => {
    const list = [...(selectedDrawing?.revisions || [])];
    return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedDrawing]);

  useEffect(() => {
    if (revs[0] && !revs.some((r: any) => r.id === revisionId)) {
      setRevisionId(revs[0].id);
    }
    if (!drawingId) setRevisionId("");
  }, [drawingId, revs]);

  const items: Item[] = assignment?.template?.items || [];
  const sections = useMemo(() => Array.from(new Set(items.map((i) => i.section || "General"))), [items]);
  const answered = Object.values(responses).filter((r) => r.answer).length;
  const selectedRev = revs.find((r: any) => r.id === revisionId);

  function patchLine(itemId: string, patch: Partial<LineResponse>) {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || emptyLine()), ...patch },
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const payload: Record<string, { answer: string; remarks: string }> = {};
      const itemComments: Record<string, string> = {};
      Object.entries(responses).forEach(([id, r]) => {
        payload[id] = { answer: r.answer, remarks: r.remarks };
        if (r.remarks?.trim()) itemComments[id] = r.remarks.trim();
      });

      const fd = new FormData();
      fd.append("responsesJson", JSON.stringify(payload));
      fd.append("itemCommentsJson", JSON.stringify(itemComments));
      if (drawingId) fd.append("drawingId", drawingId);
      if (revisionId) fd.append("revisionId", revisionId);
      if (selectedRev?.revisionNumber) fd.append("revisionNumber", selectedRev.revisionNumber);
      fd.append("remarks", remarks);
      fd.append("status", "Submitted");
      if (photos) {
        Array.from(photos).forEach((f) => fd.append("photos", f));
      }
      let lineFiles = 0;
      Object.entries(responses).forEach(([id, r]) => {
        r.photos.forEach((f) => {
          fd.append(`item_${id}_photo`, f);
          lineFiles += 1;
        });
        r.docs.forEach((f) => {
          fd.append(`item_${id}_doc`, f);
          lineFiles += 1;
        });
      });
      await api(`/api/checklist/assignments/${assignmentId}/submit`, {
        method: "POST",
        token,
        body: fd,
      });
      const overall = photos?.length || 0;
      setMsg(
        overall + lineFiles
          ? `Submitted with ${lineFiles} line attachment(s)${overall ? ` + ${overall} overall` : ""}.`
          : "Submitted — audit log updated."
      );
      setPhotos(null);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function downloadAuditCsv() {
    const res = await fetch(
      `/api/checklist/project/${projectId}/export.csv?type=${encodeURIComponent(family)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checklist-audit-${family}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-sand">
      <header className="sticky top-0 z-30 bg-white border-b border-line">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark size="sm" tagTone="light" compact showTag={false} />
            <span className="text-xs text-steel-muted truncate">
              {assignment?.project?.code} · Checklist form
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{family === "QualityInspection" ? "Quality inspection" : "Final Index"}</Badge>
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => void downloadAuditCsv()}>
              CSV audit log
            </Button>
            <Link
              to={`/projects/${projectId}/${family === "QualityInspection" ? "quality-inspections" : "checklist"}`}
              className="text-xs font-semibold text-brand"
            >
              Close
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-8">
        {!assignment ? (
          <p className="text-sm text-steel-muted">Loading…</p>
        ) : (
          <>
            <PageHeader
              eyebrow={assignment.template.category}
              title={assignment.template.name}
              subtitle="Fill each line with Yes/No/N.A., comment, photos, and docs. Drawing / revision is optional context. Intended fillers: Communication Matrix parties and the responsible vendor on the fill RFI."
              actions={
                <div className="text-right">
                  <div className="text-2xl font-display text-brand">
                    {answered}/{items.length}
                  </div>
                  <div className="text-[11px] text-steel-muted font-mono uppercase">answered</div>
                </div>
              }
            />

            <div className="grid lg:grid-cols-[300px_1fr] gap-8 items-start">
              <aside className="space-y-5 sticky top-20">
                <Card className="brand-frame !p-5">
                  <h3 className="font-semibold text-sm mb-3">Drawing (optional)</h3>
                  <div className="scroll-panel space-y-2 list-roomy pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawingId("");
                        setRevisionId("");
                      }}
                      className={`w-full text-left border px-3 py-3 transition ${
                        !drawingId ? "selected-ring border-brand" : "border-line hover:border-brand/40"
                      }`}
                    >
                      <div className="text-sm font-medium">No drawing linked</div>
                      <div className="text-[11px] text-steel-muted mt-1">Fill without a sheet</div>
                    </button>
                    {drawings.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDrawingId(d.id)}
                        className={`w-full text-left border px-3 py-3 transition ${
                          drawingId === d.id ? "selected-ring border-brand" : "border-line hover:border-brand/40"
                        }`}
                      >
                        <div className="font-mono text-[11px] text-brand">{d.drawingNumber}</div>
                        <div className="text-sm font-medium mt-1 leading-snug">{d.title}</div>
                        <div className="text-[11px] text-steel-muted mt-1">Current {d.currentRev}</div>
                      </button>
                    ))}
                    {!drawings.length && (
                      <p className="text-xs text-steel-muted leading-relaxed">
                        No drawings on this project yet — you can still submit the checklist.
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="!p-5">
                  <h3 className="font-semibold text-sm mb-3">Revision (optional)</h3>
                  <div className="space-y-2">
                    {revs.map((r: any) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRevisionId(r.id)}
                        className={`w-full text-left border px-3 py-2.5 text-sm ${
                          revisionId === r.id ? "selected-ring border-brand" : "border-line"
                        }`}
                      >
                        <span className="font-mono font-semibold">{r.revisionNumber}</span>
                        <span className="text-xs text-steel-muted ml-2">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                        {r.uploadedBy?.fullName && (
                          <div className="text-[11px] text-steel-muted mt-0.5">by {r.uploadedBy.fullName}</div>
                        )}
                      </button>
                    ))}
                    {drawingId && !revs.length && <p className="text-xs text-steel-muted">No revisions on this sheet.</p>}
                    {!drawingId && <p className="text-xs text-steel-muted">Select a drawing first.</p>}
                  </div>
                </Card>

                <Card className="!p-5">
                  <h3 className="font-semibold text-sm mb-3">Audit log</h3>
                  <ul className="scroll-panel space-y-3 text-sm pr-1">
                    {(assignment.submissions || []).map((s: any) => (
                      <li key={s.id} className="border-b border-line pb-3">
                        <div className="flex justify-between gap-2">
                          <Badge tone={s.status === "Approved" ? "ok" : "brand"}>{s.status}</Badge>
                          <span className="text-[11px] font-mono text-steel-muted">
                            {new Date(s.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 font-medium">{s.submittedBy?.fullName}</div>
                        <div className="text-xs text-steel-muted">
                          {s.drawing?.drawingNumber || "—"} · {s.revisionNumber || s.drawing?.currentRev || "—"}
                          {s.photos?.length ? ` · ${s.photos.length} file(s)` : ""}
                        </div>
                      </li>
                    ))}
                    {!assignment.submissions?.length && (
                      <li className="text-xs text-steel-muted">No fills yet.</li>
                    )}
                  </ul>
                </Card>
              </aside>

              <form onSubmit={submit} className="surface brand-frame p-6 sm:p-8 space-y-6">
                <div className="pb-4 border-b border-line flex flex-wrap gap-3 justify-between">
                  <div>
                    <div className="text-xs font-mono uppercase text-steel-muted">Form applies to</div>
                    <div className="font-semibold mt-1">
                      {selectedDrawing
                        ? `${selectedDrawing.drawingNumber} · ${selectedRev?.revisionNumber || "—"}`
                        : "No drawing (OK)"}
                    </div>
                  </div>
                  <Input
                    className="max-w-xs"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Overall remarks"
                  />
                </div>

                <div className="scroll-panel-lg space-y-8 pr-1">
                  {sections.map((section) => (
                    <section key={section} className="space-y-4">
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mark">{section}</h3>
                      {items
                        .filter((i) => (i.section || "General") === section)
                        .map((item) => {
                          const line = responses[item.id] || emptyLine();
                          return (
                            <div key={item.id} className="border border-line bg-white p-5 space-y-3">
                              <div className="text-[15px] leading-relaxed font-medium">
                                {item.itemCode && <span className="font-mono text-brand mr-2">{item.itemCode}</span>}
                                {item.description}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {["Yes", "No", "N.A."].map((ans) => {
                                  const on = line.answer === ans;
                                  return (
                                    <button
                                      key={ans}
                                      type="button"
                                      onClick={() => patchLine(item.id, { answer: ans })}
                                      className={`rounded-sm px-4 py-2 text-sm font-medium border ${
                                        on
                                          ? ans === "Yes"
                                            ? "bg-emerald-50 border-emerald-300 text-ok"
                                            : ans === "No"
                                              ? "bg-red-50 border-red-300 text-danger"
                                              : "bg-amber-50 border-amber-300 text-warn"
                                          : "bg-sand border-line text-steel-muted"
                                      }`}
                                    >
                                      {ans}
                                    </button>
                                  );
                                })}
                              </div>
                              <TextArea
                                rows={2}
                                placeholder="Comment for this checklist item"
                                value={line.remarks}
                                onChange={(e) => patchLine(item.id, { remarks: e.target.value })}
                              />
                              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                                <label className="text-xs text-steel-muted block">
                                  Photos
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="block mt-1 text-xs w-full"
                                    onChange={(e) =>
                                      patchLine(item.id, {
                                        photos: e.target.files ? Array.from(e.target.files) : [],
                                      })
                                    }
                                  />
                                  {line.photos.length > 0 && (
                                    <span className="block mt-1 text-[11px] text-ink">
                                      {line.photos.map((f) => f.name).join(", ")}
                                    </span>
                                  )}
                                </label>
                                <label className="text-xs text-steel-muted block">
                                  Documents
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.txt,application/pdf"
                                    multiple
                                    className="block mt-1 text-xs w-full"
                                    onChange={(e) =>
                                      patchLine(item.id, {
                                        docs: e.target.files ? Array.from(e.target.files) : [],
                                      })
                                    }
                                  />
                                  {line.docs.length > 0 && (
                                    <span className="block mt-1 text-[11px] text-ink">
                                      {line.docs.map((f) => f.name).join(", ")}
                                    </span>
                                  )}
                                </label>
                              </div>
                            </div>
                          );
                        })}
                    </section>
                  ))}
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-line">
                  <label className="text-sm text-steel-muted">
                    Overall photos / docs
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      multiple
                      className="block mt-1 text-xs"
                      onChange={(e) => setPhotos(e.target.files)}
                    />
                  </label>
                  {canFill && (
                    <Button type="submit">
                      Submit checklist form
                    </Button>
                  )}
                  {msg && <span className="text-sm text-steel-muted">{msg}</span>}
                </div>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
