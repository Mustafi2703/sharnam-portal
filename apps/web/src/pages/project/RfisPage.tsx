import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams, useSearchParams, useLocation } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { RfiFieldChecklist, RfiProgressBar, RfiStageStepper } from "../../components/RfiProgressBar";
import { rfiComposeProgress, rfiProgress } from "../../lib/rfiProgress";
import {
  checklistFamilyForRfiKind,
  defaultRfiKindForModule,
  isModuleScopedRfi,
  rfiKindFromSearch,
  rfiKindPillsForScope,
  rfiListKindFilter,
  rfiModuleScope,
  rfiPageCopy,
  type RfiKindFilter,
} from "../../lib/rfiModuleScope";
import { getActiveWorkspace } from "../../workspaces";

type RfiKind = RfiKindFilter;

export default function RfisPage() {
  const { id } = useParams();
  const location = useLocation();
  const [search] = useSearchParams();
  const { token, user } = useAuth();
  const [rfis, setRfis] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [kindFilter, setKindFilter] = useState<RfiKind>(() => {
    const q = search.get("kind") as RfiKind | null;
    if (q) return q;
    const ws = getActiveWorkspace();
    if (ws === "quality") return "QualityInspection";
    if (ws === "drawings") return "DrawingChecklist";
    if (ws === "comms") return "RequestForInformation";
    return "All";
  });
  const [matrixCanRespond, setMatrixCanRespond] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    question: "",
    rfiKind: "RequestForInformation",
    assignedToId: "",
    linkedDrawingId: "",
    linkedAssignmentId: "",
    linkedChecklistItemId: "",
    responsibleVendorId: "",
    attachmentNote: "",
    scheduleImpact: "None",
    costImpact: "None",
  });
  const [answer, setAnswer] = useState("");
  const [siteAssignments, setSiteAssignments] = useState<any[]>([]);
  const [drawingAssignments, setDrawingAssignments] = useState<any[]>([]);
  const [qiAssignments, setQiAssignments] = useState<any[]>([]);
  const [safetyAssignments, setSafetyAssignments] = useState<any[]>([]);
  const createFormRef = useRef<HTMLDivElement>(null);

  const isClient = user?.role === "client";
  const canCreate = !!user;
  const canRespond = matrixCanRespond;
  const canClose = matrixCanRespond;

  const moduleScope = rfiModuleScope(location.pathname, location.search);
  const moduleScoped = isModuleScopedRfi(moduleScope);
  const pageCopy = rfiPageCopy(moduleScope, kindFilter);
  const kindPills = rfiKindPillsForScope(moduleScope);

  const load = async () => {
    const [rPayload, u, d, aSite, aDraw, aQi, aSaf, v] = await Promise.all([
      api<any>(`/api/rfis/project/${id}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>(`/api/drawings/project/${id}`, { token }),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=SiteExecution`, { token }).catch(() => ({
        assignments: [],
      })),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=DrawingCheck`, { token }).catch(() => ({
        assignments: [],
      })),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=QualityInspection`, { token }).catch(() => ({
        assignments: [],
      })),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=Safety`, { token }).catch(() => ({
        assignments: [],
      })),
      api<any[]>(`/api/vendors/project/${id}`, { token }).catch(() => []),
    ]);
    const list = Array.isArray(rPayload) ? rPayload : rPayload.rfis || [];
    setRfis(list);
    setMatrixCanRespond(Array.isArray(rPayload) ? true : !!rPayload.canRespond);
    setUsers(u);
    setDrawings(d);
    setSiteAssignments(aSite.assignments || []);
    setDrawingAssignments(aDraw.assignments || []);
    setQiAssignments(aQi.assignments || []);
    setSafetyAssignments(aSaf.assignments || []);
    setVendors(Array.isArray(v) ? v.map((row: any) => row.vendor || row) : []);
    if (!active && list[0]) setActive(list[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    const q = rfiKindFromSearch(search);
    if (q) {
      setKindFilter(q);
      return;
    }
    const def = defaultRfiKindForModule(moduleScope);
    if (def) setKindFilter(def);
  }, [search, moduleScope]);

  useEffect(() => {
    if (!moduleScoped) return;
    const locked =
      moduleScope === "quality"
        ? "QualityInspection"
        : moduleScope === "safety"
          ? "SafetyChecklist"
          : kindFilter === "RequestForInformation"
            ? "RequestForInformation"
            : "DrawingChecklist";
    setForm((f) => ({
      ...f,
      rfiKind: locked,
      linkedDrawingId: locked === "QualityInspection" ? "" : f.linkedDrawingId,
    }));
    if (locked !== "RequestForInformation") setKindFilter(locked as RfiKind);
  }, [moduleScoped, moduleScope, kindFilter]);

  useEffect(() => {
    const subject = search.get("subject");
    const body = search.get("body");
    const drawingId = search.get("drawingId");
    const location = search.get("location");
    if (!subject && !body && !drawingId && !location) return;
    const question =
      body && location ? `${body}\n\nLocation: ${location}` : body || (location ? `Location: ${location}` : "");
    setForm((f) => ({
      ...f,
      rfiKind: "RequestForInformation",
      subject: subject || f.subject,
      question: question || f.question,
      linkedDrawingId: drawingId || f.linkedDrawingId,
    }));
    if (search.get("compose") === "1") {
      window.setTimeout(() => createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  }, [search]);

  useEffect(() => {
    if (kindFilter === "QualityInspection") {
      setForm((f) => ({ ...f, rfiKind: "QualityInspection" }));
    } else if (kindFilter === "DrawingChecklist") {
      setForm((f) => ({ ...f, rfiKind: "DrawingChecklist" }));
    } else if (kindFilter === "SafetyChecklist") {
      setForm((f) => ({ ...f, rfiKind: "SafetyChecklist" }));
    } else if (kindFilter === "RequestForInformation" || kindFilter === "All") {
      setForm((f) => ({ ...f, rfiKind: "RequestForInformation" }));
    }
  }, [kindFilter]);

  const needsChecklist =
    form.rfiKind === "DrawingChecklist" ||
    form.rfiKind === "QualityInspection" ||
    form.rfiKind === "SafetyChecklist";
  const checklistOptions =
    form.rfiKind === "QualityInspection"
      ? qiAssignments
      : form.rfiKind === "SafetyChecklist"
        ? safetyAssignments
        : form.rfiKind === "DrawingChecklist"
          ? drawingAssignments
          : siteAssignments;

  const filtered = useMemo(() => {
    return rfis.filter((r) => {
      const statusOk = statusFilter === "All" || r.status === statusFilter;
      const kind = r.rfiKind || "RequestForInformation";
      const effectiveKind = rfiListKindFilter(moduleScope, kindFilter);
      const kindOk =
        effectiveKind === "All" ||
        kind === effectiveKind ||
        (effectiveKind === "RequestForInformation" && (kind === "Manual" || kind === "RequestForInformation"));
      return statusOk && kindOk;
    });
  }, [rfis, statusFilter, kindFilter, moduleScope]);

  const selected = rfis.find((r) => r.id === active);
  const selectedProgress = selected ? rfiProgress(selected) : null;
  const composeProgress = rfiComposeProgress(form);

  const fillFamily = checklistFamilyForRfiKind(selected?.rfiKind);
  const fillLink = selected?.linkedAssignmentId
    ? `/projects/${id}/checklist/fill/${selected.linkedAssignmentId}?family=${fillFamily}`
    : selected?.rfiKind === "QualityInspection"
      ? `/projects/${id}/inspections?sheet=qi`
      : selected?.rfiKind === "DrawingChecklist"
        ? `/projects/${id}/drawings/checklist-master`
        : selected?.rfiKind === "SafetyChecklist"
          ? `/projects/${id}/safety/checklist-master`
          : `/projects/${id}/checklist`;

  return (
    <div className="space-y-6 min-w-0">
      <PageHeader
        eyebrow={pageCopy.eyebrow}
        title={isClient ? "Concerns & RFIs" : pageCopy.title}
        subtitle={isClient ? "Raise a concern anytime. Matrix parties or office respond and close." : pageCopy.subtitle}
      />

      {!isClient && (moduleScoped ? kindPills.length > 1 : true) && (
      <div className="flex flex-wrap gap-2">
        {(moduleScoped ? kindPills : [
          ["All", "All"],
          ["RequestForInformation", "Ask (PMC)"],
          ["DrawingChecklist", "Request checklist fill"],
          ["QualityInspection", "Request QI fill"],
          ["SafetyChecklist", "Safety checklist fill"],
          ["ClientConcern", "Client"],
        ] as [RfiKind, string][]).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-md px-3 py-2 text-sm font-semibold border ${
              kindFilter === k ? "bg-brand text-white border-brand" : "bg-white border-line text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      )}

      {canCreate && (
        <div ref={createFormRef}>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold">{isClient ? "Raise concern" : "Create request"}</h3>
            {!isClient && form.rfiKind === "RequestForInformation" && (
              <span className="text-[11px] text-steel-muted">{composeProgress}% complete</span>
            )}
          </div>
          {!isClient && form.rfiKind === "RequestForInformation" && (
            <div className="mb-3">
              <RfiProgressBar progress={rfiProgress({ ...form, responses: [] })} compact />
            </div>
          )}
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (needsChecklist && !form.linkedAssignmentId) {
                alert("Select the checklist this fill request is for.");
                return;
              }
              const assignment = checklistOptions.find((a) => a.id === form.linkedAssignmentId);
              await api(`/api/rfis/project/${id}`, {
                method: "POST",
                token,
                body: JSON.stringify({
                  ...form,
                  linkedChecklistItemId: assignment?.template?.id || form.linkedChecklistItemId || null,
                  linkedAssignmentId: form.linkedAssignmentId || null,
                  rfiKind: isClient ? "ClientConcern" : form.rfiKind,
                }),
              });
              setForm({
                ...form,
                subject: "",
                question: "",
                linkedAssignmentId: "",
                linkedChecklistItemId: "",
                attachmentNote: "",
              });
              await load();
            }}
          >
            {!isClient && !moduleScoped && (
              <Select value={form.rfiKind} onChange={(e) => setForm({ ...form, rfiKind: e.target.value, linkedAssignmentId: "" })}>
                <option value="RequestForInformation">Ask — Request for Information (PMC)</option>
                <option value="DrawingChecklist">Request drawing checklist fill</option>
                <option value="QualityInspection">Request QI fill (Quality module)</option>
                <option value="SafetyChecklist">Safety checklist fill (Safety module)</option>
              </Select>
            )}
            <Input required placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <TextArea
              required
              rows={3}
              placeholder={
                isClient
                  ? "Describe your concern"
                  : form.rfiKind === "QualityInspection"
                    ? "Describe what the assignee should inspect and any location / grid reference."
                    : form.rfiKind === "DrawingChecklist"
                      ? "Ask assignee to fill the linked Drawing Check Master checklist (drawing revision optional)."
                      : form.rfiKind === "SafetyChecklist"
                        ? "Describe the safety checklist fill required on site."
                        : form.rfiKind === "RequestForInformation"
                          ? "What information do you need?"
                          : "Ask matrix parties / vendor to open and fill the linked checklist."
              }
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
            {!isClient && (
              <div className="grid sm:grid-cols-2 gap-2">
                {needsChecklist && (
                  <Select
                    value={form.linkedAssignmentId}
                    onChange={(e) => setForm({ ...form, linkedAssignmentId: e.target.value })}
                  >
                    <option value="">Checklist to fill *</option>
                    {checklistOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.template?.name || a.id}
                      </option>
                    ))}
                  </Select>
                )}
                {needsChecklist && (
                  <Select value={form.responsibleVendorId} onChange={(e) => setForm({ ...form, responsibleVendorId: e.target.value })}>
                    <option value="">Responsible vendor (optional)</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                  <option value="">Assignee</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} · {u.role}
                    </option>
                  ))}
                </Select>
                {!moduleScoped || form.rfiKind === "DrawingChecklist" ? (
                  <Select value={form.linkedDrawingId} onChange={(e) => setForm({ ...form, linkedDrawingId: e.target.value })}>
                    <option value="">Linked drawing (optional)</option>
                    {drawings.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.drawingNumber} — {d.title}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <Input
                  placeholder="Attachment / note"
                  value={form.attachmentNote}
                  onChange={(e) => setForm({ ...form, attachmentNote: e.target.value })}
                />
                {!moduleScoped && (
                <Select value={form.scheduleImpact} onChange={(e) => setForm({ ...form, scheduleImpact: e.target.value })}>
                  {["None", "Low", "Medium", "High"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
                )}
              </div>
            )}
            <p className="text-xs text-steel-muted">
              {form.rfiKind === "QualityInspection"
                ? "Quality QI checklists only — assignee and office can fill. No drawing module link required."
                : form.rfiKind === "DrawingChecklist"
                  ? "Drawing Check Master only — use Drawings → Checklist manager. Quality & Safety have separate masters."
                  : form.rfiKind === "SafetyChecklist"
                    ? "Safety checklists only — use Safety → Checklist master."
                    : form.rfiKind === "RequestForInformation"
                      ? "PMC / drawing clarification — matrix parties respond / close."
                      : "Fillers: Communication Matrix parties, assignee, and responsible vendor."}
            </p>
            <Button type="submit">
              {isClient ? "Submit concern" : moduleScope === "quality" ? "Request QI fill" : moduleScope === "drawings" && form.rfiKind === "DrawingChecklist" ? "Request checklist fill" : "Open RFI"}
            </Button>
          </form>
        </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {["All", "Open", "Answered", "Closed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs ${statusFilter === s ? "bg-brand text-white" : "bg-white border border-line"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line font-semibold bg-sand/40">Log</div>
          <ul className="divide-y divide-line max-h-[60vh] overflow-y-auto">
            {filtered.map((r) => {
              const prog = rfiProgress(r);
              return (
              <button
                key={r.id}
                className={`w-full text-left px-4 py-3 ${active === r.id ? "bg-brand-soft" : "hover:bg-sand/30"}`}
                onClick={() => setActive(r.id)}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-[11px] text-brand">{r.number}</span>
                  <Badge tone={r.status === "Open" ? "warn" : r.status === "Closed" ? "ok" : "neutral"}>{r.status}</Badge>
                </div>
                <div className="font-medium text-sm mt-1">{r.subject}</div>
                <div className="mt-2">
                  <RfiProgressBar progress={prog} compact showLabel={false} />
                </div>
                <div className="text-[11px] text-steel-muted mt-1.5">
                  {r.rfiKind || "RequestForInformation"} · {prog.stage} · BIC: {r.ballInCourt}
                  {r.vendor ? ` · ${r.vendor.name}` : ""}
                </div>
              </button>
            );
            })}
            {!filtered.length && <li className="p-4 text-sm text-steel-muted">No items.</li>}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-steel-muted text-sm">Select an item</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-xs text-brand">{selected.number}</div>
                <h2 className="font-display text-2xl mt-1">{selected.subject}</h2>
                {selectedProgress && (
                  <div className="mt-3 space-y-2">
                    <RfiStageStepper progress={selectedProgress} />
                    <RfiProgressBar progress={selectedProgress} />
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge tone="brand">{selected.rfiKind || "RequestForInformation"}</Badge>
                  <Badge tone="brand">Ball: {selected.ballInCourt}</Badge>
                  <Badge>{selected.status}</Badge>
                  {selected.drawing && <Badge tone="neutral">{selected.drawing.drawingNumber}</Badge>}
                  {selected.vendor && <Badge tone="ok">Vendor: {selected.vendor.name}</Badge>}
                </div>
              </div>
              {selectedProgress && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Record completeness</h3>
                  <RfiFieldChecklist progress={selectedProgress} />
                </div>
              )}
              <div className="rounded-xl bg-sand/40 p-4 text-sm whitespace-pre-wrap">{selected.question}</div>
              {(selected.linkedAssignmentId || selected.linkedChecklistItemId) &&
                (selected.rfiKind === "DrawingChecklist" || selected.rfiKind === "QualityInspection") && (
                <div className="rounded-lg border-2 border-brand bg-brand-soft/40 p-4 text-sm space-y-3">
                  <div className="font-semibold text-xs uppercase tracking-wider text-brand">Fill this checklist</div>
                  <p className="text-steel-muted text-xs leading-relaxed">
                    Open the fill form to answer Yes/No/N.A., upload photos & docs, and attach or upload a drawing / revision if needed.
                  </p>
                  <Link to={fillLink}>
                    <Button type="button" className="!text-sm">
                      Fill checklist form →
                    </Button>
                  </Link>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm mb-2">Responses</h3>
                <ul className="space-y-2">
                  {selected.responses?.map((resp: any) => (
                    <li key={resp.id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="text-xs text-steel-muted">
                        {resp.respondedBy.fullName} · {new Date(resp.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1">{resp.responseText}</div>
                    </li>
                  ))}
                </ul>
              </div>
              {canRespond && selected.status !== "Closed" && (
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await api(`/api/rfis/${selected.id}/respond`, {
                      method: "POST",
                      token,
                      body: JSON.stringify({ responseText: answer, isOfficialResponse: true }),
                    });
                    setAnswer("");
                    await load();
                  }}
                >
                  <TextArea rows={3} placeholder="Official response (matrix party)" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
                  <div className="flex gap-2">
                    <Button type="submit">Submit response</Button>
                    {canClose && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          await api(`/api/rfis/${selected.id}`, {
                            method: "PATCH",
                            token,
                            body: JSON.stringify({ status: "Closed", ballInCourt: "Creator" }),
                          });
                          await load();
                        }}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </form>
              )}
              {!canRespond && selected.status !== "Closed" && (
                <p className="text-xs text-steel-muted bg-sand/50 p-3 rounded-lg">
                  Respond / close is for Communication Matrix parties — ask Sharnam office under Comms → Matrix.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
