import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams, useSearchParams, useLocation } from "react-router-dom";
import { api } from "../../api";
import { downloadAuthFile } from "../../lib/downloadReport";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { RfiFieldChecklist, RfiProgressBar, RfiStageStepper } from "../../components/RfiProgressBar";
import { InspectionRequestReference } from "../../components/InspectionRequestReference";
import { DrawingRfiRegisterTable } from "../../components/DrawingRfiRegisterTable";
import { rfiComposeProgress, rfiProgress } from "../../lib/rfiProgress";
import { spdcFormDataFromCompose, spdcRegisterDashboard } from "../../lib/rfiRegisterColumns";
import { rfiUsesDrawingLink } from "../../lib/inspectionRequestForms";
import {
  checklistFamilyForRfiKind,
  defaultRfiKindForModule,
  isModuleScopedRfi,
  isDrawingRfiRegisterMode,
  isRfiComposeMode,
  rfiKindFromSearch,
  rfiKindPillsForScope,
  rfiListKindFilter,
  rfiModuleScope,
  rfiPageCopy,
  type RfiKindFilter,
} from "../../lib/rfiModuleScope";
import { openChecklistFillWindow } from "../../lib/checklistFillWindow";
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
    package: "P1-CIVIL",
    discipline: "Structural",
    category: "",
    location: "",
    priority: "NORMAL",
    specClause: "",
    contractorSolution: "",
  });
  const [answer, setAnswer] = useState("");
  const [siteAssignments, setSiteAssignments] = useState<any[]>([]);
  const [drawingAssignments, setDrawingAssignments] = useState<any[]>([]);
  const [qiAssignments, setQiAssignments] = useState<any[]>([]);
  const [safetyAssignments, setSafetyAssignments] = useState<any[]>([]);
  const [activityAssignments, setActivityAssignments] = useState<any[]>([]);
  const [registerDetailOpen, setRegisterDetailOpen] = useState(false);

  useEffect(() => {
    if (!registerDetailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [registerDetailOpen]);
  const createFormRef = useRef<HTMLDivElement>(null);

  const isClient = user?.role === "client";
  const canCreate = !!user;
  const canRespond = matrixCanRespond;
  const canClose = matrixCanRespond;

  const moduleScope = rfiModuleScope(location.pathname, location.search);
  const moduleScoped = isModuleScopedRfi(moduleScope);
  const composeMode = isRfiComposeMode(search);
  const registerMode = isDrawingRfiRegisterMode(moduleScope, search);
  const pageCopy = rfiPageCopy(moduleScope, registerMode ? "All" : kindFilter);
  const kindPills = rfiKindPillsForScope(moduleScope);

  const load = async () => {
    const [rPayload, u, d, aSite, aDraw, aQi, aSaf, aAct, v] = await Promise.all([
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
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=ActivityInspection`, { token }).catch(() => ({
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
    setActivityAssignments(aAct.assignments || []);
    setVendors(Array.isArray(v) ? v.map((row: any) => row.vendor || row) : []);
    if (!active && list[0]) setActive(list[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    if (search.get("view") === "register") {
      setKindFilter("All");
      return;
    }
    const q = rfiKindFromSearch(search);
    if (q) {
      setKindFilter(q);
      return;
    }
    const def = defaultRfiKindForModule(moduleScope);
    if (def) setKindFilter(def);
  }, [search, moduleScope]);

  useEffect(() => {
    if (!moduleScoped || registerMode) return;
    const locked =
      moduleScope === "quality"
        ? kindFilter === "SiteExecution"
          ? "SiteExecution"
          : "QualityInspection"
        : moduleScope === "safety"
          ? "SafetyChecklist"
          : moduleScope === "inspection"
            ? (kindFilter as string)
            : composeMode && kindFilter === "RequestForInformation"
              ? "RequestForInformation"
              : composeMode && kindFilter === "DrawingChecklist"
                ? "DrawingChecklist"
                : "DrawingChecklist";
    setForm((f) => ({
      ...f,
      rfiKind: locked,
      linkedDrawingId: locked === "QualityInspection" ? "" : f.linkedDrawingId,
    }));
    if (locked !== "RequestForInformation" && !registerMode) setKindFilter(locked as RfiKind);
  }, [moduleScoped, moduleScope, kindFilter, composeMode, registerMode]);

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
    } else if (kindFilter === "QualityIR" || kindFilter === "SafetyIR" || kindFilter === "ActivityInspection" || kindFilter === "SiteExecution") {
      setForm((f) => ({ ...f, rfiKind: kindFilter, linkedDrawingId: "" }));
    } else if (kindFilter === "RequestForInformation" || kindFilter === "All") {
      setForm((f) => ({ ...f, rfiKind: "RequestForInformation" }));
    }
  }, [kindFilter]);

  const needsChecklist =
    form.rfiKind === "DrawingChecklist" ||
    form.rfiKind === "QualityInspection" ||
    form.rfiKind === "SafetyChecklist" ||
    form.rfiKind === "QualityIR" ||
    form.rfiKind === "SafetyIR" ||
    form.rfiKind === "ActivityInspection" ||
    form.rfiKind === "SiteExecution" ||
    (form.rfiKind === "RequestForInformation" && moduleScope === "drawings");
  const checklistOptions =
    form.rfiKind === "QualityInspection" || form.rfiKind === "QualityIR"
      ? qiAssignments
      : form.rfiKind === "SafetyChecklist" || form.rfiKind === "SafetyIR"
        ? safetyAssignments
        : form.rfiKind === "DrawingChecklist" || form.rfiKind === "RequestForInformation"
          ? drawingAssignments
          : form.rfiKind === "ActivityInspection"
            ? activityAssignments
            : siteAssignments;

  const filtered = useMemo(() => {
    return rfis.filter((r) => {
      const statusOk = statusFilter === "All" || r.status === statusFilter;
      const kind = r.rfiKind || "RequestForInformation";
      const effectiveKind = rfiListKindFilter(moduleScope, kindFilter);
      const kindOk =
        effectiveKind === "All"
          ? moduleScope === "drawings"
            ? kind === "DrawingChecklist" ||
              kind === "RequestForInformation" ||
              kind === "Manual" ||
              kind === "RequestForInformation"
            : true
          : kind === effectiveKind ||
            (effectiveKind === "RequestForInformation" && (kind === "Manual" || kind === "RequestForInformation"));
      return statusOk && kindOk;
    });
  }, [rfis, statusFilter, kindFilter, moduleScope]);

  const selected = rfis.find((r) => r.id === active);
  const selectedProgress = selected ? rfiProgress(selected) : null;
  const composeProgress = rfiComposeProgress(form);
  const registerDashboard = useMemo(() => spdcRegisterDashboard(filtered), [filtered]);

  const fillFamily = checklistFamilyForRfiKind(selected?.rfiKind);

  function openFillForm() {
    if (!id || !selected?.linkedAssignmentId) return;
    openChecklistFillWindow(id, selected.linkedAssignmentId, fillFamily);
  }

  return (
    <div className={registerMode ? "page-stack--register rfi-register-page flex flex-col flex-1 min-h-0 overflow-hidden gap-2 pb-2 min-w-0" : "space-y-6 min-w-0"}>
      <PageHeader
        eyebrow={pageCopy.eyebrow}
        title={isClient ? "Concerns & RFIs" : pageCopy.title}
        subtitle={isClient ? "Raise a concern anytime. Matrix parties or office respond and close." : pageCopy.subtitle}
      />

      {!isClient && registerMode && (
        <Card className="!p-4 bg-sand/30 border-brand/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Drawing RFI register</h3>
              <p className="text-xs text-steel-muted mt-1">
                Live log — select a row to view. Raise new entries on separate compose pages.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  void downloadAuthFile(`/api/rfis/project/${id}/register.xlsx`, token, `RFI-Register.xlsx`)
                }
              >
                Download SPDC form + register
              </Button>
              <Link to={`/projects/${id}/rfis?kind=RequestForInformation&compose=1`}>
                <Button type="button">Ask (PMC RFI)</Button>
              </Link>
              <Link to={`/projects/${id}/rfis?kind=DrawingChecklist&compose=1`}>
                <Button type="button" variant="secondary">
                  Request checklist fill
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {!isClient && composeMode && moduleScope === "drawings" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link to={`/projects/${id}/rfis?view=register`} className="text-brand underline font-medium">
            ← Back to RFI register
          </Link>
        </div>
      )}

      {!isClient && (moduleScoped && !registerMode ? kindPills.length > 1 : !registerMode && true) && (
      <div className="flex flex-wrap gap-2">
        {(moduleScoped ? kindPills : [
          ["All", "All"],
          ["RequestForInformation", "Ask (PMC)"],
          ["DrawingChecklist", "Request checklist fill"],
          ["QualityInspection", "Request QI fill"],
          ["SafetyChecklist", "Safety checklist fill"],
          ["ActivityInspection", "Activity checklist"],
          ["SiteExecution", "Field checklist fill"],
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

      {canCreate && !registerMode && (
        <div ref={createFormRef}>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold">
              {isClient
                ? "Raise concern"
                : composeMode && form.rfiKind === "RequestForInformation"
                  ? "Ask (PMC RFI)"
                  : composeMode && form.rfiKind === "DrawingChecklist"
                    ? "Request drawing checklist fill"
                    : "Create request"}
            </h3>
            {!isClient && form.rfiKind === "RequestForInformation" && (
              <span className="text-[11px] text-steel-muted">{composeProgress}% complete</span>
            )}
          </div>
          {!isClient && form.rfiKind === "RequestForInformation" && (
            <div className="mb-3">
              <RfiProgressBar progress={rfiProgress({ ...form, responses: [] })} compact />
            </div>
          )}
          {(form.rfiKind === "QualityInspection" || form.rfiKind === "SafetyChecklist") && (
            <div className="mb-3">
              <InspectionRequestReference
                rfiKind={form.rfiKind}
                projectId={id}
                onApplyTemplate={(subject, question) => setForm((f) => ({ ...f, subject, question }))}
              />
            </div>
          )}
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (needsChecklist && !form.linkedAssignmentId) {
                alert(
                  form.rfiKind === "RequestForInformation"
                    ? "Select the Drawing Check checklist to attach to this information request."
                    : "Select the checklist this fill request is for."
                );
                return;
              }
              const assignment = checklistOptions.find((a) => a.id === form.linkedAssignmentId);
              const linkedDrawing = drawings.find((d) => d.id === form.linkedDrawingId);
              const formDataJson =
                moduleScope === "drawings" || form.rfiKind === "RequestForInformation" || form.rfiKind === "DrawingChecklist"
                  ? spdcFormDataFromCompose({
                      package: form.package,
                      discipline: form.discipline,
                      category: form.category,
                      location: form.location,
                      drawingRef: linkedDrawing?.drawingNumber,
                      drawingRev: linkedDrawing?.currentRev,
                      specClause: form.specClause,
                      priority: form.priority,
                      contractorSolution: form.contractorSolution,
                      queryRaised: form.question,
                    })
                  : undefined;
              await api(`/api/rfis/project/${id}`, {
                method: "POST",
                token,
                body: JSON.stringify({
                  ...form,
                  formDataJson,
                  linkedChecklistItemId: assignment?.template?.id || form.linkedChecklistItemId || null,
                  linkedAssignmentId: form.linkedAssignmentId || null,
                  linkedDrawingId: rfiUsesDrawingLink(form.rfiKind) ? form.linkedDrawingId || null : null,
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
                <option value="ActivityInspection">Activity inspection checklist</option>
                <option value="SiteExecution">Field / site checklist fill</option>
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
                          ? "What information do you need from the consultant / client?"
                          : "Ask matrix parties / vendor to open and fill the linked checklist."
              }
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
            {!isClient && moduleScope === "drawings" && (form.rfiKind === "RequestForInformation" || form.rfiKind === "DrawingChecklist") && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 rounded-lg border border-line bg-sand/30 p-3">
                <p className="sm:col-span-2 lg:col-span-4 text-[10px] font-mono uppercase tracking-wider text-steel-muted">
                  SPDC register fields (04_RFI_REGISTER)
                </p>
                <Select value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })}>
                  {["P1-CIVIL", "P2-PEB", "Package A", "Package B"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
                <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
                  {["Structural", "Architectural", "Civil", "MEP", "PEB"].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
                <Input
                  placeholder="Category (e.g. Drawing discrepancy)"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <Input
                  placeholder="Location / grid"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {["CRITICAL", "HIGH", "NORMAL"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
                <Input
                  placeholder="Spec clause"
                  value={form.specClause}
                  onChange={(e) => setForm({ ...form, specClause: e.target.value })}
                />
                <Input
                  placeholder="Contractor proposed solution (optional)"
                  value={form.contractorSolution}
                  onChange={(e) => setForm({ ...form, contractorSolution: e.target.value })}
                  className="sm:col-span-2"
                />
              </div>
            )}
            {!isClient && (
              <div className="grid sm:grid-cols-2 gap-2">
                {needsChecklist && (
                  <Select
                    required
                    value={form.linkedAssignmentId}
                    onChange={(e) => setForm({ ...form, linkedAssignmentId: e.target.value })}
                  >
                    <option value="">
                      {form.rfiKind === "RequestForInformation"
                        ? "Drawing Check checklist to attach *"
                        : "Checklist to fill *"}
                    </option>
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
                {!isClient && rfiUsesDrawingLink(form.rfiKind) ? (
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
                ? "Quality QI checklists only — assignee and office can fill. Drawing ref is text-only; use Ask (PMC RFI) to link a drawing file."
                : form.rfiKind === "DrawingChecklist"
                  ? "Drawing Check Master only — use Drawings → Checklist manager. Quality & Safety have separate masters."
                  : form.rfiKind === "SafetyChecklist"
                    ? "Safety checklists only — use Safety → Checklist master. No drawing file attachment."
                    : form.rfiKind === "RequestForInformation"
                      ? "PMC / drawing clarification — link drawing revision and attach one Drawing Check checklist per RFI."
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

      {registerMode && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
          {[
            ["Total RFIs", registerDashboard.total],
            ["Awaiting response", registerDashboard.awaiting],
            ["OVERDUE (SLA)", registerDashboard.overdue],
            ["Answered — open", registerDashboard.answeredOpen],
            ["Closed", registerDashboard.closed],
          ].map(([label, val]) => (
            <Card key={label as string} className="!p-4">
              <div className="text-[10px] uppercase text-steel-muted font-mono">{label}</div>
              <div className="text-2xl font-display mt-1">{val as number}</div>
            </Card>
          ))}
        </div>
      )}

      {registerMode ? (
        <div className="register-tab-body flex-1 min-h-0 flex flex-col min-w-0 register-tab-body--sheet">
          <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden min-w-0">
            <DrawingRfiRegisterTable
              rows={filtered}
              activeId={active}
              onSelect={(rid) => {
                setActive(rid);
                setRegisterDetailOpen(true);
              }}
            />
          </div>
        </div>
      ) : (
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
                (selected.rfiKind === "DrawingChecklist" ||
                  selected.rfiKind === "QualityInspection" ||
                  selected.rfiKind === "RequestForInformation" ||
                  selected.rfiKind === "SafetyChecklist" ||
                  selected.rfiKind === "ActivityInspection" ||
                  selected.rfiKind === "SiteExecution") && (
                <div className="rounded-lg border-2 border-brand bg-brand-soft/40 p-4 text-sm space-y-3">
                  <div className="font-semibold text-xs uppercase tracking-wider text-brand">Fill this checklist</div>
                  <p className="text-steel-muted text-xs leading-relaxed">
                    Same link is emailed when the RFI is raised. Answer Yes/No/N.A., add photos, Submit for review.
                    Office opens Branded PDF/Excel on the fill log, then Approve + close RFI (or Reject).
                  </p>
                  <Button type="button" className="!text-sm" onClick={openFillForm}>
                    Fill checklist form →
                  </Button>
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
      )}

      {registerDetailOpen &&
        selected &&
        registerMode &&
        createPortal(
          <div className="register-modal" role="dialog" aria-modal="true" onClick={() => setRegisterDetailOpen(false)}>
            <div className="register-modal__panel register-modal__panel--2xl" onClick={(e) => e.stopPropagation()}>
              <div className="register-modal__head">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-brand">{selected.number}</div>
                  <h3 className="font-display text-lg mt-0.5 truncate">{selected.subject}</h3>
                </div>
                <button
                  type="button"
                  className="text-steel-muted hover:text-ink text-2xl leading-none px-2 shrink-0"
                  onClick={() => setRegisterDetailOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="register-modal__body">
                {selectedProgress && (
                  <div className="space-y-2">
                    <RfiStageStepper progress={selectedProgress} />
                    <RfiProgressBar progress={selectedProgress} />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge tone="brand">{selected.rfiKind || "RequestForInformation"}</Badge>
                  <Badge tone="brand">Ball: {selected.ballInCourt}</Badge>
                  <Badge>{selected.status}</Badge>
                  {selected.drawing && <Badge tone="neutral">{selected.drawing.drawingNumber}</Badge>}
                </div>
                <div className="rounded-xl bg-sand/40 p-4 text-sm whitespace-pre-wrap">{selected.question}</div>
                {(selected.linkedAssignmentId || selected.linkedChecklistItemId) && (
                  <div className="rounded-lg border-2 border-brand bg-brand-soft/40 p-4 text-sm space-y-3">
                    <div className="font-semibold text-xs uppercase tracking-wider text-brand">Fill checklist</div>
                    <Button type="button" className="!text-sm" onClick={openFillForm}>
                      Open checklist form →
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="!text-xs"
                    onClick={() =>
                      void downloadAuthFile(
                        `/api/rfis/${selected.id}/download.xlsx`,
                        token,
                        `${selected.number || "RFI"}.xlsx`
                      )
                    }
                  >
                    Download SPDC form
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!text-xs"
                    onClick={() =>
                      void downloadAuthFile(
                        `/api/rfis/${selected.id}/download.html`,
                        token,
                        `${selected.number || "RFI"}.html`
                      )
                    }
                  >
                    Print / PDF
                  </Button>
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2">Responses</h3>
                  <ul className="space-y-2">
                    {selected.responses?.map((resp: any) => (
                      <li key={resp.id} className="rounded-xl border border-line p-3 text-sm">
                        <div className="text-xs text-steel-muted mb-1">
                          {resp.respondedBy?.fullName || "—"} · {resp.official ? "Official" : "Note"}
                        </div>
                        <div className="whitespace-pre-wrap">{resp.text}</div>
                      </li>
                    ))}
                    {!selected.responses?.length && <li className="text-sm text-steel-muted">No responses yet.</li>}
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
