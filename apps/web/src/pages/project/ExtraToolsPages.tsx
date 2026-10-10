import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { StatusNote } from "../../components/StatusNote";
import { downloadAuthFile } from "../../lib/downloadReport";
import { useDrawingPicklists, withCurrent } from "../../lib/drawingPicklists";

export function CoordinationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusDrawingId = searchParams.get("drawingId") || "";
  const { token, user } = useAuth();
  const picklists = useDrawingPicklists(id, token);
  const [rows, setRows] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [matrixPeople, setMatrixPeople] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    discipline: "MEP",
    location: "",
    priority: "Medium",
    assignedToName: "",
    assignedToEmail: "",
    dueDate: "",
    linkedDrawingId: "",
    ballInCourt: "Assignee",
  });
  const [filter, setFilter] = useState("All");
  const [msg, setMsg] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);
  // New issues start on the project's first discipline once its pick-list has loaded.
  useEffect(() => {
    const first = picklists.lists.disciplines[0];
    if (picklists.loaded && first && form.discipline === "MEP" && !picklists.lists.disciplines.includes("MEP")) {
      setForm((f) => ({ ...f, discipline: first }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picklists.loaded]);
  const canEdit =
    user?.role === "admin" ||
    user?.role === "office" ||
    user?.role === "employee" ||
    user?.role === "site_employee";

  const load = async () => {
    const [o, d, tech, commercial] = await Promise.all([
      api<any>(`/api/directory/project/${id}/overview`, { token }),
      api<any[]>(`/api/drawings/project/${id}`, { token }).catch(() => []),
      api<any[]>(`/api/comms/contacts/${id}?kind=TECHNICAL`, { token }).catch(() => []),
      api<any[]>(`/api/comms/contacts/${id}?kind=COMMERCIAL`, { token }).catch(() => []),
    ]);
    setRows(o.coordination || []);
    setDrawings(d);
    const people = [...tech, ...commercial].filter((c) => !c.isSectionHeader && (c.personName || c.email));
    const seen = new Set<string>();
    setMatrixPeople(
      people.filter((c) => {
        const key = `${c.email || ""}|${c.personName || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    );
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const sheetRows = focusDrawingId ? rows.filter((r) => r.linkedDrawingId === focusDrawingId) : rows;
  const filtered = sheetRows.filter((r) => filter === "All" || r.status === filter);
  const openCount = sheetRows.filter((r) => r.status === "Open").length;
  const focusDrawing = focusDrawingId ? drawings.find((d) => d.id === focusDrawingId) : null;

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

  useEffect(() => {
    if (!focusDrawingId) return;
    setForm((f) => (f.linkedDrawingId === focusDrawingId ? f : { ...f, linkedDrawingId: focusDrawingId }));
  }, [focusDrawingId]);

  async function patchIssue(id: string, body: Record<string, unknown>) {
    await api(`/api/directory/coordination/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
    await load();
  }

  function escalateToRfiCompose(issue: {
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

  async function sendFollowUp(issueId: string) {
    setFollowBusy(true);
    setMsg("");
    try {
      const r = await api<{ issue: any; autoEscalated?: boolean; rfi?: { number: string } }>(
        `/api/directory/coordination/${issueId}/follow-up`,
        { method: "POST", token }
      );
      setMsg(
        (r as { needsRfi?: boolean }).needsRfi || (r.issue.followUpCount ?? 0) >= 5
          ? `Follow-up ${r.issue.followUpCount}/5 sent to the assignee. That was the last follow-up — escalate to RFI if there is still no action.`
          : `Follow-up ${r.issue.followUpCount}/5 emailed to the assignee`
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Follow-up failed");
    } finally {
      setFollowBusy(false);
    }
  }

  async function escalateToRfiApi(issueId: string) {
    setFollowBusy(true);
    setMsg("");
    try {
      const r = await api<{ rfi: { id: string; number: string } }>(`/api/directory/coordination/${issueId}/escalate-rfi`, {
        method: "POST",
        token,
      });
      setMsg(`Escalated to RFI ${r.rfi.number} — it is on the RFI register and the RFI form is filed on SharePoint.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Escalation failed");
    } finally {
      setFollowBusy(false);
    }
  }

  async function uploadCoordDocument(issueId: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await api(`/api/directory/coordination/${issueId}/documents`, { method: "POST", token, body: fd });
    setMsg(`Document ${file.name} attached to issue`);
    await load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Drawings module"
        title="Design coordination"
        subtitle="Log the issue against a drawing and assign someone from the communication matrix — they are emailed. Send up to five follow-ups; escalate to an RFI at any point (or after the fifth follow-up). The register is kept on SharePoint."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="warn">{openCount} open</Badge>
            <Badge tone="ok">{rows.length - openCount} closed</Badge>
            {user?.role === "admin" || user?.role === "office" ? (
              <label className="inline-flex items-center rounded-xl border border-line bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-sm hover:border-[var(--wd-accent,var(--color-brand))] cursor-pointer">
                Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f || !id) return;
                    const fd = new FormData();
                    fd.append("file", f);
                    setMsg("Importing the design coordination register…");
                    void api<{ created: number; updated: number; unmatchedDrawings: string[] }>(
                      `/api/directory/project/${id}/coordination/import`,
                      { method: "POST", token, body: fd, timeoutMs: 120_000 },
                    )
                      .then(async (out) => {
                        setMsg(
                          `Imported — ${out.created} new, ${out.updated} updated. No emails were sent.` +
                            (out.unmatchedDrawings.length ? ` Drawing numbers not found: ${out.unmatchedDrawings.join(", ")}.` : ""),
                        );
                        await load();
                      })
                      .catch((err) => setMsg(err instanceof Error ? err.message : "Import failed"));
                  }}
                />
              </label>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="!text-xs"
              onClick={() =>
                downloadAuthFile(`/api/directory/project/${id}/coordination/register.xlsx`, token, "Design-Coordination-Register.xlsx").catch(
                  (err) => setMsg(err instanceof Error ? err.message : "Could not download the register"),
                )
              }
            >
              Register Excel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!text-xs"
              onClick={() =>
                downloadAuthFile(`/api/directory/project/${id}/coordination/register.pdf`, token, "Design-Coordination-Register.pdf").catch(
                  (err) => setMsg(err instanceof Error ? err.message : "Could not download the register"),
                )
              }
            >
              Register PDF
            </Button>
          </div>
        }
      />

      <StatusNote msg={msg} />

      <Card className="!p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm">Coordination by drawing</h3>
            <p className="text-xs text-steel-muted mt-0.5">
              Open a sheet to log issues against that GFC. Unlinked issues stay under All drawings.
            </p>
          </div>
          {focusDrawingId && (
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => setSearchParams({})}>
              All drawings
            </Button>
          )}
        </div>
        {focusDrawing && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Working on {focusDrawing.drawingNumber} · {focusDrawing.title}
              {sheetRows.length ? ` — ${sheetRows.length} issue(s)` : " — no issues yet, log the first below"}
            </p>
          </div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {drawings.map((d) => {
            const issues = rows.filter((r) => r.linkedDrawingId === d.id);
            const open = issues.filter((r) => r.status === "Open").length;
            const on = focusDrawingId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                className={`text-left rounded-lg border px-3 py-2 ${
                  on ? "border-brand bg-brand-soft/40" : "border-line bg-paper hover:bg-sand/40"
                }`}
                onClick={() => setSearchParams({ drawingId: d.id })}
              >
                <div className="font-mono text-xs font-semibold text-brand">{d.drawingNumber}</div>
                <div className="text-xs text-ink truncate">{d.title}</div>
                <div className="text-[11px] text-steel-muted mt-1">
                  {issues.length
                    ? `${open} open · ${issues.length} logged`
                    : "Needs coordination — log first issue"}
                </div>
              </button>
            );
          })}
          {!drawings.length && (
            <p className="text-xs text-steel-muted sm:col-span-3">
              Add GFC rows first on the{" "}
              <Link to={`/projects/${id}/drawings`} className="font-semibold text-brand">
                GFC register
              </Link>
              .
            </p>
          )}
        </div>
      </Card>

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
          <li>Select the issue, the drawing type, then the drawing, and assign a vendor, consultant, or SPDC person from the communication matrix.</li>
          <li>Logging the issue emails the assignee and the matrix To and Cc.</li>
          <li>Use <strong>Send follow-up</strong> on the logged issue. It goes to the assignee.</li>
          <li>
            <strong>Close</strong> when resolved. Use <strong>Escalate to RFI</strong> at any time — or after the fifth follow-up with no action.
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
              if (!form.assignedToEmail) {
                setMsg("Select an assignee from the communication matrix.");
                return;
              }
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
                assignedToEmail: "",
                dueDate: "",
                linkedDrawingId: "",
                ballInCourt: "Assignee",
              });
              await load();
              if (created?.id) setSelectedId(created.id);
            }}
          >
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">Issue</span>
              <Input required placeholder="What needs coordinating" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">Drawing type</span>
            <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value, linkedDrawingId: "" })}>
              {withCurrent(picklists.lists.disciplines, form.discipline).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            </label>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {withCurrent(picklists.lists.coordinationPriorities, form.priority).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Input placeholder="Location / grid" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Assign from communication matrix
              </span>
              <Select
                value={form.assignedToEmail}
                onChange={(e) => {
                  const person = matrixPeople.find((c) => (c.email || "") === e.target.value);
                  setForm({
                    ...form,
                    assignedToEmail: e.target.value,
                    assignedToName: person?.personName || form.assignedToName,
                  });
                }}
              >
                <option value="">— Vendor, consultant, or SPDC staff —</option>
                {["PMC", "Consultant", "Contractor", "Client", "Other"].map((section) => {
                  const group = matrixPeople.filter((c) => (c.orgSection || "Other") === section && c.email);
                  if (!group.length) return null;
                  const label =
                    section === "PMC" ? "SPDC / PMC" : section === "Contractor" ? "Vendors / contractors" : `${section}s`;
                  return (
                    <optgroup key={section} label={label}>
                      {group.map((c) => (
                        <option key={c.id} value={c.email}>
                          {c.personName || c.email} · {c.orgName || c.company || section}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </Select>
              {!matrixPeople.length && (
                <p className="text-xs text-amber-800 mt-1">Upload the communication matrix so vendors, consultants, and SPDC staff can be selected.</p>
              )}
            </label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Drawing
              </span>
              <Select value={form.linkedDrawingId} onChange={(e) => setForm({ ...form, linkedDrawingId: e.target.value })}>
                <option value="">— Select a {form.discipline || "GFC"} drawing —</option>
                {(() => {
                  const want = form.discipline.toLowerCase();
                  const matched = drawings.filter((d) => {
                    const disc = String(d.discipline || "").toLowerCase();
                    if (!want) return true;
                    if (disc === want) return true;
                    if (want.startsWith("arch") && disc.startsWith("arch")) return true;
                    return disc.includes(want) || want.includes(disc);
                  });
                  const options = matched.length ? matched : drawings;
                  if (!options.length) return null;
                  return (
                    <optgroup label={matched.length ? `${form.discipline} drawings` : "All GFC sheets"}>
                      {options.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.drawingNumber} · {d.currentRev || "—"} — {d.title}
                          {drawingHasPreviewFile(d) ? "" : " (no PDF yet)"}
                        </option>
                      ))}
                    </optgroup>
                  );
                })()}
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
            <div className="sm:col-span-2 space-y-2">
              <p className="text-xs text-steel-muted">
                Logging sends email to the assignee and copies the communication-matrix To and Cc.
              </p>
              <Button type="submit" className="!bg-sky-600 !font-medium">
                Log issue
              </Button>
            </div>
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
                    {selected.followUpCount ? ` · ${selected.followUpCount}/5 follow-ups` : ""}
                  </p>
                  {selected.assignedToEmail && (
                    <p className="text-xs text-steel-muted mt-1">Follow-up email: {selected.assignedToEmail}</p>
                  )}
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
                        className="!text-xs !bg-amber-400 !text-ink !font-medium"
                        disabled={followBusy || (selected.followUpCount ?? 0) >= 5}
                        onClick={() => void sendFollowUp(selected.id)}
                      >
                        Send follow-up ({selected.followUpCount ?? 0}/5)
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        className="!text-xs !bg-amber-600 !font-medium"
                        disabled={followBusy}
                        onClick={() => {
                          const n = selected.followUpCount ?? 0;
                          if (
                            n < 5 &&
                            !window.confirm(
                              `Only ${n} of 5 follow-ups sent. Escalate this issue to an RFI now? The assignee and matrix are notified.`,
                            )
                          ) {
                            return;
                          }
                          return escalateToRfiApi(selected.id);
                        }}
                      >
                        Escalate to RFI
                      </Button>
                      <Button type="button" variant="ghost" className="!text-xs" onClick={() => escalateToRfiCompose(selected)}>
                        Open RFI form
                      </Button>
                      <Select
                        aria-label="Reassign issue"
                        className="!text-xs !py-1.5 !w-56"
                        value=""
                        disabled={followBusy}
                        onChange={(e) => {
                          const email = e.target.value;
                          if (!email) return;
                          const person = matrixPeople.find((c) => (c.email || "") === email);
                          const name = person?.personName || email;
                          if (!window.confirm(`Reassign "${selected.title}" to ${name}? They will be emailed.`)) return;
                          setFollowBusy(true);
                          return patchIssue(selected.id, { assignedToEmail: email, assignedToName: name })
                            .then(() => setMsg(`Reassigned to ${name} — email sent.`))
                            .catch((err) => setMsg(err instanceof Error ? err.message : "Could not reassign"))
                            .finally(() => setFollowBusy(false));
                        }}
                      >
                        <option value="">Reassign to…</option>
                        {matrixPeople
                          .filter((c) => c.email && c.email !== selected.assignedToEmail)
                          .map((c) => (
                            <option key={c.id || c.email} value={c.email}>
                              {c.personName || c.email} · {c.orgName || c.company || c.orgSection || ""}
                            </option>
                          ))}
                      </Select>
                      <Button type="button" variant="secondary" className="!text-xs" onClick={() => docRef.current?.click()}>
                        Attach DMS file
                      </Button>
                      <input
                        ref={docRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadCoordDocument(selected.id, f);
                          e.target.value = "";
                        }}
                      />
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
                  {canEdit && selected.status === "Escalated" && selected.escalatedRfiId && (
                    <Link to={`/projects/${id}/rfis?view=register&rfi=${selected.escalatedRfiId}`} className="text-xs font-semibold text-brand">
                      View linked RFI →
                    </Link>
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

              {selected.documents?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-line">
                  <p className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-2">DMS attachments</p>
                  <ul className="text-sm space-y-1">
                    {selected.documents.map((d: { id: string; fileUrl: string; fileName?: string | null }) => (
                      <li key={d.id}>
                        <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-brand font-medium">
                          {d.fileName || "Document"}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
            <div className="flex flex-col gap-2 flex-1 min-h-[360px]">
              <DrawingFileViewer
                {...(revisionPreview?.pdf || revisionPreview?.dwg
                  ? { revision: revisionPreview }
                  : { preview: drawingPreview! })}
                variant="inline"
                className="flex-1 min-h-[360px]"
              />
            </div>
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
