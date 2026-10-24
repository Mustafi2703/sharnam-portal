import { useEffect, useMemo, useRef, useState } from "react";
import { DrawingMarkupPanel } from "../../components/DrawingMarkupPanel";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, mediaUrl } from "../../api";
import { UploadModal } from "../../components/UploadModal";
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
import { SearchableSelect } from "../../components/SearchableSelect";
import { downloadAuthFile } from "../../lib/downloadReport";
import { useDrawingPicklists, withCurrent } from "../../lib/drawingPicklists";
import { formatUiText } from "../../lib/formatUiText";

const COORDINATION_ASSIGNEE_GROUPS = ["SPDC / PMC", "Clients", "Consultants", "Vendors / contractors"] as const;
type CoordinationAssigneeGroup = (typeof COORDINATION_ASSIGNEE_GROUPS)[number];

type CoordinationAssignee = {
  key: string;
  personName: string;
  orgName: string;
  email: string;
  group: CoordinationAssigneeGroup;
  source: "matrix" | "directory";
};

const ASSIGNEE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normName(s: unknown) {
  return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function groupForSection(section: unknown): CoordinationAssigneeGroup {
  const s = String(section || "").trim();
  if (s === "PMC") return "SPDC / PMC";
  if (s === "Client") return "Clients";
  if (s === "Consultant" || s === "Designer") return "Consultants";
  return "Vendors / contractors";
}

/**
 * Everyone who can be assigned a coordination issue: communication-matrix contacts plus the primary contact
 * of each company in the project directory. De-duplicated by email; rows without a usable email are kept
 * (shown disabled) unless they are only a company placeholder for an org that already has an emailed person.
 */
function buildCoordinationAssignees(contacts: any[], vendors: any[]): CoordinationAssignee[] {
  const candidates: CoordinationAssignee[] = [];
  for (const c of contacts) {
    if (!c || c.isSectionHeader) continue;
    const personName = String(c.personName || "").trim();
    const email = String(c.email || "").trim();
    if (!personName && !email) continue;
    candidates.push({
      key: `matrix:${c.id}`,
      personName,
      orgName: String(c.orgName || c.company || "").trim(),
      email: ASSIGNEE_EMAIL_RE.test(email) ? email : "",
      group: groupForSection(c.orgSection),
      source: "matrix",
    });
  }
  for (const v of vendors) {
    if (!v?.id) continue;
    const email = String(v.email || "").trim();
    candidates.push({
      key: `vendor:${v.id}`,
      personName: String(v.primaryContactName || v.name || "").trim(),
      orgName: String(v.name || "").trim(),
      email: ASSIGNEE_EMAIL_RE.test(email) ? email : "",
      group: groupForSection(v.partyType),
      source: "directory",
    });
  }
  const emailedOrgs = new Set(candidates.filter((c) => c.email).map((c) => normName(c.orgName)));
  const seenEmails = new Set<string>();
  const seenNoEmail = new Set<string>();
  const out: CoordinationAssignee[] = [];
  for (const c of candidates) {
    if (c.email) {
      const k = c.email.toLowerCase();
      if (seenEmails.has(k)) continue;
      seenEmails.add(k);
      out.push(c);
      continue;
    }
    const org = normName(c.orgName);
    const placeholder = !c.personName || normName(c.personName) === org;
    if (placeholder && emailedOrgs.has(org)) continue;
    const k = `${normName(c.personName)}|${org}`;
    if (seenNoEmail.has(k)) continue;
    seenNoEmail.add(k);
    out.push(c);
  }
  return out;
}

function assigneeOptionLabel(c: CoordinationAssignee) {
  const name = c.personName || c.orgName || c.email;
  const org = c.orgName && normName(c.orgName) !== normName(name) ? ` · ${c.orgName}` : "";
  return `${name}${org}${c.email ? "" : " (no email)"}`;
}

export function CoordinationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusDrawingId = searchParams.get("drawingId") || "";
  const { token, user } = useAuth();
  const picklists = useDrawingPicklists(id, token);
  const [rows, setRows] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [drawingsLoaded, setDrawingsLoaded] = useState(false);
  const [matrixPeople, setMatrixPeople] = useState<CoordinationAssignee[]>([]);
  const logView = searchParams.get("view") === "log";
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
  const [issueAnswer, setIssueAnswer] = useState("");
  const [logBusy, setLogBusy] = useState(false);
  const [markupDraft, setMarkupDraft] = useState<File | null>(null);
  const [markupModal, setMarkupModal] = useState(false);
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
  const missingFields = [
    !form.title.trim() ? "Issue" : "",
    !form.linkedDrawingId ? "GFC Drawing" : "",
    !form.assignedToEmail ? "Assignee" : "",
  ].filter(Boolean);

  const load = async () => {
    const [o, d, tech, commercial, projectVendors] = await Promise.all([
      api<any>(`/api/directory/project/${id}/overview`, { token }),
      api<any[]>(`/api/drawings/project/${id}`, { token }).catch(() => []),
      api<any[]>(`/api/comms/contacts/${id}?kind=TECHNICAL`, { token }).catch(() => []),
      api<any[]>(`/api/comms/contacts/${id}?kind=COMMERCIAL`, { token }).catch(() => []),
      api<any[]>(`/api/vendors/project/${id}`, { token }).catch(() => []),
    ]);
    setRows(o.coordination || []);
    setDrawings(d);
    setDrawingsLoaded(true);
    const vendorsById = new Map<string, any>();
    for (const row of [...(o.vendors || []), ...(projectVendors || [])]) {
      const v = row?.vendor || row;
      if (v?.id) vendorsById.set(v.id, v);
    }
    setMatrixPeople(buildCoordinationAssignees([...tech, ...commercial], [...vendorsById.values()]));
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
  useEffect(() => {
    setIssueAnswer(selected?.responseText || "");
  }, [selected?.id, selected?.responseText]);
  const linkedDrawing = selected?.linkedDrawingId
    ? drawings.find((d) => d.id === selected.linkedDrawingId)
    : null;
  const linkedRevision = linkedDrawing ? currentDrawingRevision(linkedDrawing) : null;
  const drawingPreview = linkedDrawing ? drawingPreviewFromRecord(linkedDrawing) : null;
  const revisionPreview =
    linkedDrawing && linkedRevision ? revisionPreviewFromRecord(linkedDrawing, linkedRevision) : null;

  const gfcOptions = useMemo(
    () =>
      drawings.map((d) => ({
        value: d.id as string,
        label: `${d.drawingNumber} · ${d.currentRev || "—"} — ${d.title}`,
        sublabel: [d.discipline, drawingHasPreviewFile(d) ? "PDF on file" : "No PDF yet"].filter(Boolean).join(" · "),
        keywords: `${d.drawingNumber || ""} ${d.title || ""} ${d.discipline || ""}`,
      })),
    [drawings],
  );

  const [linkDrawingId, setLinkDrawingId] = useState("");
  useEffect(() => {
    setLinkDrawingId(selected?.linkedDrawingId || "");
  }, [selected?.id, selected?.linkedDrawingId]);

  useEffect(() => {
    if (!focusDrawingId) return;
    setForm((f) => (f.linkedDrawingId === focusDrawingId ? f : { ...f, linkedDrawingId: focusDrawingId }));
  }, [focusDrawingId]);

  async function submitIssueAnswer(issueId: string) {
    const text = issueAnswer.trim();
    if (!text) {
      setMsg("Write the answer before submitting.");
      return;
    }
    setFollowBusy(true);
    setMsg("");
    try {
      await api(`/api/directory/coordination/${issueId}/answer`, {
        method: "POST",
        token,
        body: JSON.stringify({ responseText: text }),
      });
      setMsg("Answer saved. The checker can close the issue after reviewing it.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save the answer");
    } finally {
      setFollowBusy(false);
    }
  }

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
          ? `Follow-up ${r.issue.followUpCount}/5 sent. Raise to RFI is now available on this issue.`
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

  function viewSearch(log: boolean) {
    const q = new URLSearchParams();
    if (log) q.set("view", "log");
    if (focusDrawingId) q.set("drawingId", focusDrawingId);
    const s = q.toString();
    return s ? `?${s}` : "";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Drawings module"
        title={logView ? "Coordination Log" : "Design Coordination"}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="warn">{openCount} open</Badge>
            <Badge tone="ok">{rows.length - openCount} closed</Badge>
            {canEdit ? (
              <Link to={{ search: viewSearch(!logView) }}>
                <Button type="button" variant="secondary" className="!text-xs">
                  {logView ? "Raise coordination issue" : "Coordination log"}
                </Button>
              </Link>
            ) : null}
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

      {logView && focusDrawing ? (
        <Card className="!p-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Showing issues on {focusDrawing.drawingNumber} · {focusDrawing.title}
          </p>
          <Button type="button" variant="secondary" className="!text-xs" onClick={() => setSearchParams({ view: "log" })}>
            All drawings
          </Button>
        </Card>
      ) : null}

      {!logView && (
      <>
      {canEdit && drawingsLoaded && !drawings.length && (
        <Card className="border-amber-300 bg-amber-50">
          <h3 className="font-semibold text-amber-900">{formatUiText("Add a GFC Drawing First")}</h3>
          <Link to={`/projects/${id}/drawings`} className="inline-block mt-3">
            <Button type="button">Open Approval & GFC Log</Button>
          </Link>
        </Card>
      )}

      {canEdit && drawings.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-3">Raise coordination issue</h3>
          <form
            className="grid sm:grid-cols-2 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (logBusy) return;
              if (missingFields.length) {
                setMsg(`Fill in: ${missingFields.join(", ")}.`);
                return;
              }
              setLogBusy(true);
              setMsg("");
              try {
                const sheet = drawings.find((d) => d.id === form.linkedDrawingId);
                const created = await api<any>(`/api/directory/project/${id}/coordination`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    ...form,
                    discipline: sheet?.discipline || form.discipline || "Architecture",
                  }),
                });
                if (markupDraft && created?.id) {
                  const fd = new FormData();
                  fd.append("file", markupDraft);
                  fd.append("targetType", "coordination");
                  fd.append("targetId", created.id);
                  fd.append("drawingId", form.linkedDrawingId);
                  await api(`/api/drawings/project/${id}/markups/upload`, { method: "POST", token, body: fd, timeoutMs: 180_000 });
                }
                setMarkupDraft(null);
                setForm({
                  title: "",
                  description: "",
                  discipline: form.discipline,
                  location: "",
                  priority: "Medium",
                  assignedToName: "",
                  assignedToEmail: "",
                  dueDate: "",
                  linkedDrawingId: focusDrawingId || "",
                  ballInCourt: "Assignee",
                });
                await load();
                if (created?.id) setSelectedId(created.id);
                setMsg("Issue logged.");
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Could not log the issue");
              } finally {
                setLogBusy(false);
              }
            }}
          >
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-ink block mb-1.5">{formatUiText("Issue *")}</span>
              <Input
                required
                aria-required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-ink block mb-1.5">{formatUiText("GFC Drawing *")}</span>
              <SearchableSelect
                required
                options={gfcOptions}
                value={form.linkedDrawingId}
                placeholder="Select a Drawing"
                searchPlaceholder="Drawing Number or Title"
                onChange={(value) => {
                  const sheet = drawings.find((d) => d.id === value);
                  setForm({
                    ...form,
                    linkedDrawingId: value,
                    discipline: sheet?.discipline || form.discipline || "Architecture",
                  });
                }}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-ink block mb-1.5">{formatUiText("Assignee *")}</span>
              <Select
                required
                aria-required
                value={form.assignedToEmail}
                onChange={(e) => {
                  const person = matrixPeople.find((c) => c.email === e.target.value);
                  setForm({
                    ...form,
                    assignedToEmail: e.target.value,
                    assignedToName: person ? person.personName || person.orgName || person.email : "",
                  });
                }}
              >
                <option value="">{formatUiText("Select Vendor, Contractor, or Consultant")}</option>
                {COORDINATION_ASSIGNEE_GROUPS.map((group) => {
                  const people = matrixPeople.filter((c) => c.group === group);
                  if (!people.length) return null;
                  return (
                    <optgroup key={group} label={formatUiText(group)}>
                      {people.map((c) => (
                        <option key={c.key} value={c.email || c.key} disabled={!c.email}>
                          {assigneeOptionLabel(c)}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </Select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-ink block mb-1.5">{formatUiText("Question")}</span>
              <TextArea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <div className="sm:col-span-2 rounded-lg border border-line bg-paper p-3 space-y-2">
              <div className="text-xs font-semibold text-ink">{formatUiText("Marked-up Drawing")}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" className="!text-xs" onClick={() => setMarkupModal(true)}>
                  {markupDraft ? "Change Marked-up File" : "Attach Marked-up Drawing"}
                </Button>
                {markupDraft ? <span className="text-xs text-ink">{markupDraft.name}</span> : null}
                {markupDraft ? (
                  <button type="button" className="text-xs text-steel-muted underline" onClick={() => setMarkupDraft(null)}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Button type="submit" disabled={logBusy || missingFields.length > 0} className="!bg-sky-600 !font-medium">
                {logBusy ? "Logging…" : "Log Issue"}
              </Button>
              {missingFields.length ? (
                <p className="text-xs text-amber-800" role="status">
                  Still needed: {missingFields.join(", ")}
                </p>
              ) : null}
            </div>
          </form>
          <UploadModal
            open={markupModal}
            title="Upload marked-up drawing"
            context=""
            file={markupDraft}
            onFile={setMarkupDraft}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,application/pdf,image/*"
            fields={[]}
            primaryLabel="Attach to this issue"
            onClose={() => setMarkupModal(false)}
            onSubmit={(e) => {
              e.preventDefault();
              setMarkupModal(false);
            }}
          />
        </Card>
      )}
      </>
      )}

      <div className="flex gap-1 flex-wrap">
        {["All", "Open", "Answered", "Closed"].map((f) => (
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
                    <Badge tone={r.status === "Open" ? "warn" : r.status === "Answered" ? "brand" : "ok"}>{r.status}</Badge>
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
                  {selected.responseText && (
                    <div className="mt-3 rounded-lg border border-line bg-sand/40 p-3 text-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-steel-muted">Answer on file</p>
                      <p className="mt-1 whitespace-pre-wrap">{selected.responseText}</p>
                      {selected.respondedByName && (
                        <p className="text-xs text-steel-muted mt-1">
                          {selected.respondedByName}
                          {selected.respondedAt ? ` · ${new Date(selected.respondedAt).toLocaleString("en-IN")}` : ""}
                        </p>
                      )}
                    </div>
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
                        disabled={followBusy || (selected.followUpCount ?? 0) < 5}
                        title={(selected.followUpCount ?? 0) < 5 ? "Send 5 follow-ups before raising this issue to an RFI" : undefined}
                        onClick={() => void escalateToRfiApi(selected.id)}
                      >
                        Raise to RFI
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="!text-xs"
                        disabled={(selected.followUpCount ?? 0) < 5}
                        title={(selected.followUpCount ?? 0) < 5 ? "Send 5 follow-ups before opening an RFI" : undefined}
                        onClick={() => escalateToRfiCompose(selected)}
                      >
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
                          const person = matrixPeople.find((c) => c.email === email);
                          const name = person?.personName || person?.orgName || email;
                          if (!window.confirm(`Reassign "${selected.title}" to ${name}? They will be emailed.`)) return;
                          setFollowBusy(true);
                          return patchIssue(selected.id, { assignedToEmail: email, assignedToName: name })
                            .then(() => setMsg(`Reassigned to ${name} — email sent.`))
                            .catch((err) => setMsg(err instanceof Error ? err.message : "Could not reassign"))
                            .finally(() => setFollowBusy(false));
                        }}
                      >
                        <option value="">Reassign to…</option>
                        {COORDINATION_ASSIGNEE_GROUPS.map((group) => {
                          const people = matrixPeople.filter(
                            (c) => c.group === group && c.email && c.email !== selected.assignedToEmail,
                          );
                          if (!people.length) return null;
                          return (
                            <optgroup key={group} label={formatUiText(group)}>
                              {people.map((c) => (
                                <option key={c.key} value={c.email}>
                                  {assigneeOptionLabel(c)}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
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
                    </>
                  )}
                  {canEdit && selected.responseText && selected.status !== "Closed" && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="!text-xs"
                      onClick={() => void patchIssue(selected.id, { status: "Closed" })}
                    >
                      Close after checking the answer
                    </Button>
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

              {selected.status !== "Closed" &&
                (canEdit ||
                  (user?.id && user.id === selected.assignedToId) ||
                  (user?.email &&
                    selected.assignedToEmail &&
                    user.email.toLowerCase() === String(selected.assignedToEmail).toLowerCase())) && (
                <form
                  className="mt-4 pt-4 border-t border-line space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitIssueAnswer(selected.id);
                  }}
                >
                  <TextArea
                    rows={3}
                    label="Answer"
                    placeholder="The assigned party writes the answer. Sharnam office can answer if they are the ones who should reply."
                    value={issueAnswer}
                    onChange={(e) => setIssueAnswer(e.target.value)}
                    required
                  />
                  <Button type="submit" className="!text-xs" disabled={followBusy}>
                    {followBusy ? "Saving…" : "Submit answer"}
                  </Button>
                </form>
              )}

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

              {id ? (
                <div className="mt-4 pt-4 border-t border-line">
                  <DrawingMarkupPanel projectId={id} targetType="coordination" targetId={selected.id} drawingId={selected.linkedDrawingId} token={token} />
                </div>
              ) : null}

              {canEdit && (
                <div className="mt-4 pt-4 border-t border-line grid sm:grid-cols-[1fr_auto] gap-2 items-end">
                  <label className="block">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                      Linked GFC drawing
                    </span>
                    <SearchableSelect
                      options={gfcOptions}
                      value={linkDrawingId}
                      placeholder="Search the Approval & GFC Log"
                      searchPlaceholder="Drawing number or title"
                      onChange={setLinkDrawingId}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!text-xs"
                    disabled={!linkDrawingId || linkDrawingId === (selected.linkedDrawingId || "")}
                    onClick={() =>
                      void patchIssue(selected.id, { linkedDrawingId: linkDrawingId }).catch((err) =>
                        setMsg(err instanceof Error ? err.message : "Could not save the drawing link"),
                      )
                    }
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
                      Upload on Approval & GFC Log →
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

type SitePhoto = {
  id: string;
  fileUrl: string;
  sharePointUrl?: string | null;
  album: string;
  description?: string | null;
  location?: string | null;
  shotDate?: string | null;
  createdAt: string;
};

function siteDay(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function todayOnSite(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Day-wise site photos. Take a picture or upload from the phone; each day is filed on the project drive. */
export function PhotosPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [day, setDay] = useState(todayOnSite);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const canUpload = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");

  const load = async () => {
    const res = await api<{ photos: SitePhoto[]; days: string[] }>(`/api/directory/project/${id}/photos`, { token });
    setPhotos(res.photos || []);
    setDays(res.days || []);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const dayPhotos = useMemo(
    () => photos.filter((p) => (siteDay(p.shotDate) || (/^\d{4}-\d{2}-\d{2}$/.test(p.album) ? p.album : "") || siteDay(p.createdAt)) === day),
    [photos, day]
  );

  function addFiles(list: FileList | null) {
    const next = [...(list || [])].filter((f) => f.type.startsWith("image/"));
    if (next.length) setFiles((cur) => [...cur, ...next]);
  }

  async function uploadDay() {
    if (!files.length) return;
    setBusy(true);
    setMsg("");
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("shotDate", day);
        fd.append("description", description);
        fd.append("location", location);
        fd.append("file", file);
        await api(`/api/directory/project/${id}/photos`, { method: "POST", token, body: fd });
      }
      setFiles([]);
      setDescription("");
      setLocation("");
      setOpen(false);
      setMsg(`${files.length} photo${files.length === 1 ? "" : "s"} filed for ${day}.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(photoId: string) {
    if (!window.confirm("Remove this photo from the project?")) return;
    await api(`/api/directory/photos/${photoId}`, { method: "DELETE", token });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Site photos"
        title="Photos"
        subtitle="One day at a time. Take a photo on the phone or choose pictures already on it. Each day is kept here and filed on the project drive under Daily Site Records."
        actions={
          canUpload ? (
            <Button type="button" onClick={() => setOpen(true)}>
              Add photos
            </Button>
          ) : null
        }
      />
      {msg ? <StatusNote msg={msg} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted">
          Day
          <Input className="mt-1" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            className={`rounded px-3 py-1 text-xs border ${day === d ? "bg-procore-navy text-white" : "bg-white border-line"}`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {dayPhotos.map((p) => (
          <Card key={p.id} padding={false} className="overflow-hidden">
            <div className="aspect-[4/3] bg-sand flex items-center justify-center border-b border-line">
              <img src={mediaUrl(p.fileUrl)} alt={p.description || "Site photo"} className="w-full h-full object-cover" />
            </div>
            <div className="p-3 space-y-1">
              <div className="text-sm font-medium" data-preserve-case>
                {p.description || "Site photo"}
              </div>
              <div className="text-[11px] text-steel-muted" data-preserve-case>
                {[p.location, day].filter(Boolean).join(" · ")}
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                {p.sharePointUrl ? (
                  <a href={p.sharePointUrl} className="text-xs text-brand font-semibold" target="_blank" rel="noreferrer">
                    Open in drive
                  </a>
                ) : (
                  <span className="text-[11px] text-steel-muted">Filed to the project drive folder for this day</span>
                )}
                {canUpload ? (
                  <button type="button" className="text-xs text-red-700" onClick={() => void removePhoto(p.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
        {!dayPhotos.length && (
          <p className="text-sm text-steel-muted col-span-full">No photos for {day}. Add photos for this day.</p>
        )}
      </div>

      <UploadModal
        open={open}
        title="Add site photos"
        context={`Filed under Daily Site Records / photos / ${day}`}
        file={files[0] || null}
        onFile={() => undefined}
        canSubmit={files.length > 0}
        accept="image/*"
        filePicker={
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => cameraRef.current?.click()}>
                Take photo
              </Button>
              <Button type="button" variant="secondary" onClick={() => galleryRef.current?.click()}>
                Upload from phone
              </Button>
            </div>
            <input ref={cameraRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={(e) => addFiles(e.target.files)} />
            <input ref={galleryRef} className="hidden" type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} />
            {files.length ? (
              <p className="text-[12px] text-steel-muted" data-preserve-case>
                {files.map((f) => f.name).join(", ")}
              </p>
            ) : (
              <p className="text-[12px] text-steel-muted">Take a photo with the camera, or choose pictures already on the phone.</p>
            )}
          </div>
        }
        fields={[
          { kind: "text", name: "day", label: "Day", inputType: "date", value: day, onChange: setDay },
          { kind: "text", name: "description", label: "Caption", value: description, onChange: setDescription, placeholder: "What is in the photo" },
          { kind: "text", name: "location", label: "Location", value: location, onChange: setLocation, placeholder: "Block, floor, grid" },
        ]}
        primaryLabel={busy ? "Uploading…" : `Upload ${files.length || ""}`.trim()}
        busy={busy}
        error={msg && open ? msg : ""}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        onSubmit={(e) => {
          e.preventDefault();
          void uploadDay();
        }}
      />
    </div>
  );
}
