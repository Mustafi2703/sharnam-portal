import { useEffect, useMemo, useRef, useState } from "react";
import { DrawingMarkupPanel } from "../../components/DrawingMarkupPanel";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { api } from "../../api";
import { downloadAuthFile } from "../../lib/downloadReport";
import { useAuth } from "../../auth";
import { useDrawingPicklists, withCurrent } from "../../lib/drawingPicklists";
import { DrawingPackMenu } from "../../components/DrawingPackMenu";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { StatusNote } from "../../components/StatusNote";
import { SearchableSelect } from "../../components/SearchableSelect";
import { RfiFieldChecklist, RfiProgressBar, RfiStageStepper } from "../../components/RfiProgressBar";
import { InspectionRequestReference } from "../../components/InspectionRequestReference";
import { DrawingRfiRegisterTable } from "../../components/DrawingRfiRegisterTable";
import { RfiDeleteButton } from "../../components/RfiDeleteButton";
import { SpdcRfiFormView } from "../../components/SpdcRfiFormView";
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
  rfiKindAllowedInModuleScope,
  rfiLogTitle,
  rfiModuleScope,
  rfiPageCopy,
  rfiSearchForKind,
  canonicalRfiKind,
  type RfiKindFilter,
} from "../../lib/rfiModuleScope";
import { openChecklistFillWindow, openFamilyChecklistFill } from "../../lib/checklistFillWindow";
import { getActiveWorkspace } from "../../workspaces";
import { formatUiText } from "../../lib/formatUiText";

type RfiKind = RfiKindFilter;

type PersonOption = {
  value: string;
  label: string;
  sublabel?: string;
  keywords?: string;
  group: string;
  noEmail?: boolean;
  disabled?: boolean;
};

const MATRIX_GROUP_ORDER = ["Matrix - Client", "Matrix - Consultant", "Matrix - Contractor", "Matrix - PMC", "Matrix - Other"];

function matrixGroupLabel(orgSection?: string | null): string {
  const s = String(orgSection || "").trim();
  if (s === "Client" || s === "Consultant" || s === "Contractor" || s === "PMC") return `Matrix - ${s}`;
  return "Matrix - Other";
}

function splitAssigneeKey(key: string): ["user" | "contact" | "", string] {
  if (key.startsWith("user:")) return ["user", key.slice(5)];
  if (key.startsWith("contact:")) return ["contact", key.slice(8)];
  return ["", ""];
}

/** Published revisions of a drawing, oldest first (the API returns them in upload order). */
function publishedRevisions(drawing: any): any[] {
  return (drawing?.revisions || []).filter((r: any) => r?.published);
}

/** Matrix contact assignee shown in the existing "responsible party" spots, tagged so it is not mistaken for a portal user. */
function withMatrixAssignee(r: any) {
  if (!r || r.assignedTo || !r.assigneeName) return r;
  return { ...r, matrixAssignee: true, assignedTo: { fullName: r.assigneeName } };
}

export default function RfisPage() {
  const { id } = useParams();
  const location = useLocation();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const picklists = useDrawingPicklists(id, token);
  const [rfis, setRfis] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [drawingsLoaded, setDrawingsLoaded] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [directoryMembers, setDirectoryMembers] = useState<any[]>([]);
  const [matrixContacts, setMatrixContacts] = useState<any[]>([]);
  const [composeBusy, setComposeBusy] = useState(false);
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
  const [syncNote, setSyncNote] = useState("");
  const [form, setForm] = useState({
    subject: "",
    question: "",
    rfiKind: "RequestForInformation",
    /** "user:<id>" for a portal user, "contact:<id>" for a communication-matrix contact */
    assigneeKey: "",
    linkedDrawingId: "",
    linkedRevisionId: "",
    linkedAssignmentId: "",
    linkedChecklistItemId: "",
    responsibleVendorId: "",
    attachmentNote: "",
    scheduleImpact: "None",
    costImpact: "None",
    package: "",
    discipline: "",
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
  const [projectMeta, setProjectMeta] = useState<{ name?: string; code?: string; clientName?: string | null } | null>(null);

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
  const canCreate = !!user && user.role !== "client";

  const moduleScope = rfiModuleScope(location.pathname, location.search);
  const moduleScoped = isModuleScopedRfi(moduleScope);
  const composeMode = isRfiComposeMode(search);
  const registerMode = isDrawingRfiRegisterMode(moduleScope, search);
  const pageCopy = rfiPageCopy(moduleScope, registerMode ? "All" : kindFilter);
  const kindPills = rfiKindPillsForScope(moduleScope);

  const load = async () => {
    const [rPayload, d, aSite, aDraw, aQi, aSaf, aAct, v, overview, project, techContacts, commercialContacts] = await Promise.all([
      api<any>(`/api/rfis/project/${id}`, { token }),
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
      api<{ members?: any[]; vendors?: any[] }>(`/api/directory/project/${id}/overview`, { token }).catch(() => null),
      api<{ name?: string; code?: string; clientName?: string | null }>(`/api/projects/${id}`, { token }).catch(() => null),
      api<any[]>(`/api/comms/contacts/${id}?kind=TECHNICAL`, { token }).catch(() => []),
      api<any[]>(`/api/comms/contacts/${id}?kind=COMMERCIAL`, { token }).catch(() => []),
    ]);
    const list = Array.isArray(rPayload) ? rPayload : rPayload.rfis || [];
    setRfis(list);
    setMatrixCanRespond(Array.isArray(rPayload) ? true : !!rPayload.canRespond);
    setProjectMeta(project);
    setDrawings(d);
    setDrawingsLoaded(true);
    setSiteAssignments(aSite.assignments || []);
    setDrawingAssignments(aDraw.assignments || []);
    setQiAssignments(aQi.assignments || []);
    setSafetyAssignments(aSaf.assignments || []);
    setActivityAssignments(aAct.assignments || []);
    const dirVendors = (overview?.vendors || []).map((row: any) => row.vendor || row).filter((row: any) => row?.id);
    const fromAssign = Array.isArray(v) ? v.map((row: any) => row.vendor || row) : [];
    const byId = new Map<string, any>();
    for (const row of [...dirVendors, ...fromAssign]) {
      if (row?.id) byId.set(row.id, row);
    }
    setVendors([...byId.values()]);
    setDirectoryMembers(overview?.members || []);
    setMatrixContacts([...(techContacts || []), ...(commercialContacts || [])].filter((c: any) => c && !c.isSectionHeader));
    if (!search.get("rfi") && !active && list[0]) setActive(list[0].id);
  };

  // Deep link ?rfi=<id> (e-mails, coordination escalation): select it, or reopen it in the module it belongs to.
  const wantedRfi = search.get("rfi");
  useEffect(() => {
    if (!wantedRfi || !rfis.length) return;
    const target = rfis.find((r: any) => r.id === wantedRfi);
    if (!target) return;
    if (moduleScoped && !rfiKindAllowedInModuleScope(moduleScope, target.rfiKind)) {
      navigate(`/projects/${id}/rfis${rfiSearchForKind(target.rfiKind, target.id)}`, { replace: true });
      return;
    }
    setActive(target.id);
  }, [wantedRfi, rfis, moduleScoped, moduleScope, id, navigate]);

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "sharnam-checklist-filled" && e.data.projectId === id) void load();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [id]);

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

  // Drawings compose only — Quality/Safety IR forms live on their register tools.
  useEffect(() => {
    if (!moduleScoped || registerMode) return;
    if (moduleScope === "quality" || moduleScope === "safety" || moduleScope === "inspection") return;
    const locked =
      String(kindFilter) === "RequestForInformation" ? "RequestForInformation" : "DrawingChecklist";
    setForm((f) => ({ ...f, rfiKind: locked }));
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

  // IR / inspection products → owning register log (no duplicate raise UI on /rfis).
  useEffect(() => {
    if (!id) return;
    const k = search.get("kind");
    if (k === "QualityIR" || k === "QualityInspection") {
      navigate(`/projects/${id}/inspection-register?tab=quality-ir&lock=quality`, { replace: true });
    } else if (k === "ActivityInspection") {
      navigate(`/projects/${id}/inspection-register?tab=activity-checklist&lock=quality`, { replace: true });
    } else if (k === "SafetyIR" || k === "SafetyChecklist") {
      navigate(`/projects/${id}/inspection-register?tab=safety-ir&lock=safety`, { replace: true });
    } else if (moduleScope === "quality" && !k && search.get("view") !== "register") {
      navigate(`/projects/${id}/inspection-register?tab=quality-ir&lock=quality`, { replace: true });
    } else if (moduleScope === "safety" && !k) {
      navigate(`/projects/${id}/inspection-register?tab=safety-ir&lock=safety`, { replace: true });
    }
  }, [id, search, navigate, moduleScope]);

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
    form.rfiKind === "SiteExecution";
  /** Ask (PMC RFI) is clarification only — a Drawing Check checklist can be attached but is optional. */
  const showChecklistPicker = needsChecklist || (form.rfiKind === "RequestForInformation" && moduleScope === "drawings");
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
      if (moduleScoped && !rfiKindAllowedInModuleScope(moduleScope, kind)) return false;
      const effectiveKind = rfiListKindFilter(moduleScope, kindFilter);
      const kindCanon = canonicalRfiKind(kind);
      const filterCanon = canonicalRfiKind(effectiveKind);
      const kindOk =
        effectiveKind === "All"
          ? moduleScope === "drawings"
            ? kindCanon === "DrawingChecklist" || kindCanon === "RequestForInformation"
            : moduleScope === "home"
              ? true
              : rfiKindAllowedInModuleScope(moduleScope, kind)
          : kindCanon === filterCanon ||
            (filterCanon === "RequestForInformation" && kindCanon === "RequestForInformation");
      return statusOk && kindOk;
    });
  }, [rfis, statusFilter, kindFilter, moduleScope, moduleScoped]);

  const selected = rfis.find((r) => r.id === active);
  const canRespond = selected?.canAnswer ?? matrixCanRespond;
  const canClose = selected?.canClose ?? false;
  const selectedProgress = selected ? rfiProgress(selected) : null;
  /** Drawings RFI (SPDC RFI form): drawing + published revision required. */
  const drawingsRfi = !isClient && form.rfiKind === "RequestForInformation";
  const [assigneeType, assigneeRefId] = splitAssigneeKey(form.assigneeKey);
  const composeProgressState = rfiComposeProgress(
    {
      ...form,
      assignedToId: assigneeType === "user" ? assigneeRefId : "",
      assigneeContactId: assigneeType === "contact" ? assigneeRefId : "",
      drawingRev: publishedRevisions(drawings.find((d) => d.id === form.linkedDrawingId)).find(
        (r: any) => r.id === form.linkedRevisionId
      )?.revisionNumber,
    },
    { requireDrawing: drawingsRfi }
  );
  const registerDashboard = useMemo(() => spdcRegisterDashboard(filtered), [filtered]);
  /** Register / detail views show a matrix contact assignee where there is no portal user. */
  const registerRows = useMemo(() => filtered.map(withMatrixAssignee), [filtered]);
  const selectedView = selected ? withMatrixAssignee(selected) : selected;

  const publishedDrawings = useMemo(() => drawings.filter((d) => publishedRevisions(d).length > 0), [drawings]);
  const composeDrawing = drawings.find((d) => d.id === form.linkedDrawingId) || null;
  const composeRevisions = publishedRevisions(composeDrawing);
  const composeRevision = composeRevisions.find((r: any) => r.id === form.linkedRevisionId) || null;
  const disciplineLocked = drawingsRfi && !!composeDrawing?.discipline;
  const noPublishedDrawings = drawingsRfi && drawingsLoaded && publishedDrawings.length === 0;

  // Discipline starts on the first value of the project's pick-list.
  useEffect(() => {
    const first = picklists.lists.disciplines[0];
    if (!picklists.loaded || !first) return;
    setForm((f) => (f.discipline ? f : { ...f, discipline: first }));
  }, [picklists.loaded, picklists.lists.disciplines]);

  useEffect(() => {
    if (!picklists.loaded || picklists.packages.length !== 1) return;
    setForm((f) => (f.package ? f : { ...f, package: picklists.packages[0] }));
  }, [picklists.loaded, picklists.packages]);

  // A chosen drawing pre-selects its latest published revision and sets the discipline.
  useEffect(() => {
    if (!form.linkedDrawingId) return;
    const d = drawings.find((x) => x.id === form.linkedDrawingId);
    if (!d) return;
    const revs = publishedRevisions(d);
    setForm((f) => {
      if (f.linkedDrawingId !== d.id) return f;
      const revOk = revs.some((r: any) => r.id === f.linkedRevisionId);
      const nextRev = revOk ? f.linkedRevisionId : revs[revs.length - 1]?.id || "";
      const nextDiscipline = d.discipline || f.discipline;
      if (nextRev === f.linkedRevisionId && nextDiscipline === f.discipline) return f;
      return { ...f, linkedRevisionId: nextRev, discipline: nextDiscipline };
    });
  }, [form.linkedDrawingId, drawings]);

  const personOptions = useMemo(() => {
    const users = directoryMembers
      .map((m: any) => m.user || m)
      .filter((u: any) => u?.id);
    const seenEmails = new Set<string>();
    const userOptions: PersonOption[] = [];
    for (const u of users) {
      const email = String(u.email || "").trim().toLowerCase();
      if (email) {
        if (seenEmails.has(email)) continue;
        seenEmails.add(email);
      }
      userOptions.push({
        value: `user:${u.id}`,
        label: u.fullName || u.email || u.id,
        sublabel: ["Portal users", u.role, u.email].filter(Boolean).join(" · "),
        keywords: `${u.email || ""} ${u.phone || ""} ${u.role || ""}`,
        group: "Portal users",
      });
    }
    const emailedNames = new Set(
      matrixContacts
        .filter((c: any) => String(c.email || "").trim())
        .map((c: any) => `${String(c.personName || "").trim().toLowerCase()}|${String(c.orgName || "").trim().toLowerCase()}`)
    );
    const seenNoEmail = new Set<string>();
    const contactOptions: PersonOption[] = [];
    for (const c of matrixContacts) {
      const name = String(c.personName || "").trim();
      const email = String(c.email || "").trim();
      if (!name && !email) continue;
      const group = matrixGroupLabel(c.orgSection);
      if (email) {
        const key = email.toLowerCase();
        if (seenEmails.has(key)) continue;
        seenEmails.add(key);
      } else {
        const key = `${name.toLowerCase()}|${String(c.orgName || "").trim().toLowerCase()}`;
        if (emailedNames.has(key) || seenNoEmail.has(key)) continue;
        seenNoEmail.add(key);
      }
      contactOptions.push({
        value: `contact:${c.id}`,
        label: email ? name || email : `${name} (no email)`,
        sublabel: [group, email || "No email", c.orgName || c.company].filter(Boolean).join(" · "),
        keywords: `${email} ${c.orgName || ""} ${c.company || ""} ${c.designation || ""} ${c.orgSection || ""}`,
        group,
        noEmail: !email,
        disabled: !email,
      });
    }
    const order = ["Portal users", ...MATRIX_GROUP_ORDER];
    return [...userOptions, ...contactOptions].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  }, [directoryMembers, matrixContacts]);

  function pickAssignee(next: string) {
    setForm((f) => ({ ...f, assigneeKey: next }));
  }

  const vendorOptions = useMemo(
    () =>
      vendors.map((v: any) => ({
        value: v.id,
        label: v.name,
        sublabel: [v.partyType, v.trade, v.primaryContactName].filter(Boolean).join(" · "),
        keywords: `${v.email || ""} ${v.trade || ""} ${v.city || ""} ${v.primaryContactName || ""}`,
      })),
    [vendors]
  );

  const fillFamily = checklistFamilyForRfiKind(selected?.rfiKind);

  function openFillForm() {
    if (!id) return;
    if (selected?.linkedAssignmentId) {
      openChecklistFillWindow(id, selected.linkedAssignmentId, fillFamily, {
        resumeDraft: true,
        drawingId: selected.linkedDrawingId || selected.drawing?.id || undefined,
        rfi: selected.number,
      });
      return;
    }
    void openFamilyChecklistFill(id, fillFamily || "SiteExecution", token, { preferAssignmentFill: true });
  }

  const useSpdcForm =
    !!selected &&
    (canonicalRfiKind(selected.rfiKind) === "RequestForInformation" ||
      canonicalRfiKind(selected.rfiKind) === "DrawingChecklist");

  return (
    <div
      className={
        registerMode
          ? "page-stack--register rfi-register-page flex flex-col flex-1 min-h-0 overflow-hidden gap-2 pb-2 min-w-0"
          : "rfi-desk-page page-scroll-full space-y-6 min-w-0"
      }
    >
      <PageHeader
        eyebrow={pageCopy.eyebrow}
        title={isClient ? "Concerns & RFIs" : pageCopy.title}
        subtitle={isClient ? "View-only register — SPDC office and matrix parties respond and close." : pageCopy.subtitle}
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
                Download register
              </Button>
              {id ? <DrawingPackMenu projectId={id} token={token} canPublish={user?.role === "admin" || user?.role === "office"} /> : null}
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


      {!isClient && !composeMode && (moduleScoped && !registerMode ? kindPills.length > 1 : !registerMode && true) && (
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
              <span className="text-[11px] text-steel-muted">{composeProgressState.pct}% complete</span>
            )}
          </div>
          {!isClient && form.rfiKind === "RequestForInformation" && (
            <div className="mb-3">
              <RfiProgressBar progress={composeProgressState} compact />
            </div>
          )}
          {noPublishedDrawings && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
              <p className="font-semibold">{formatUiText("Upload a GFC drawing first")}</p>
              <p className="text-xs mt-1">
                An RFI is raised against a published drawing revision. This project has none yet.{" "}
                <Link to={`/projects/${id}/drawings`} className="font-semibold text-brand underline">
                  {formatUiText("Open the Approval & GFC Log")}
                </Link>
              </p>
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
              if (composeBusy) return;
              if (drawingsRfi && (!composeDrawing || !composeRevision)) {
                setSyncNote(
                  noPublishedDrawings
                    ? "Upload a GFC drawing first. An RFI needs a published drawing revision."
                    : "Pick the linked drawing and its revision."
                );
                return;
              }
              if (needsChecklist && !form.linkedAssignmentId) {
                alert(
                  form.rfiKind === "RequestForInformation"
                    ? "Select the Drawing Check checklist to attach to this information request."
                    : "Select the checklist this fill request is for."
                );
                return;
              }
              if (needsChecklist && !form.assigneeKey && !form.responsibleVendorId) {
                alert("Search the project directory and pick a named person or a vendor company to fill this.");
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
                      drawingRev: drawingsRfi ? composeRevision?.revisionNumber : linkedDrawing?.currentRev,
                      specClause: form.specClause,
                      priority: form.priority,
                      contractorSolution: form.contractorSolution,
                      queryRaised: form.question,
                    })
                  : undefined;
              setComposeBusy(true);
              try {
                const formBody: Record<string, unknown> = { ...form };
                delete formBody.assigneeKey;
                const created = await api<{ sharePointExports?: { kind: string; path: string }[] }>(`/api/rfis/project/${id}`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    ...formBody,
                    formDataJson,
                    assignedToId: assigneeType === "user" ? assigneeRefId : null,
                    assigneeContactId: assigneeType === "contact" ? assigneeRefId : null,
                    linkedChecklistItemId: assignment?.template?.id || form.linkedChecklistItemId || null,
                    linkedAssignmentId: form.linkedAssignmentId || null,
                    linkedDrawingId: rfiUsesDrawingLink(form.rfiKind) ? form.linkedDrawingId || null : null,
                    linkedRevisionId: drawingsRfi ? form.linkedRevisionId || null : null,
                    rfiKind: isClient ? "ClientConcern" : form.rfiKind,
                  }),
                });
                const paths = (created.sharePointExports || []).map((e) => e.path).filter(Boolean);
                const fillNote = needsChecklist
                  ? " A draft is now on the checklist fill log for the assigned vendor / site person."
                  : "";
                setSyncNote(
                  (paths.length
                    ? `Written to SharePoint (sheet + print/PDF): ${paths.join(" · ")}`
                    : "Request saved and pinged. SharePoint write will retry on the next raise or close.") + fillNote
                );
                setForm({
                  ...form,
                  subject: "",
                  question: "",
                  linkedAssignmentId: "",
                  linkedChecklistItemId: "",
                  assigneeKey: "",
                  responsibleVendorId: "",
                  attachmentNote: "",
                });
                await load();
              } catch (err) {
                setSyncNote(err instanceof Error ? err.message : "Could not raise the fill request.");
              } finally {
                setComposeBusy(false);
              }
            }}
          >
            {!isClient && !moduleScoped && (
              <Select
                label="Request type"
                value={form.rfiKind}
                onChange={(e) => setForm({ ...form, rfiKind: e.target.value, linkedAssignmentId: "" })}
              >
                <option value="RequestForInformation">Ask - Request for Information (PMC)</option>
                <option value="DrawingChecklist">Request drawing checklist fill</option>
                <option value="QualityInspection">Request QI fill (Quality module)</option>
                <option value="SafetyChecklist">Safety checklist fill (Safety module)</option>
                <option value="ActivityInspection">Activity inspection checklist</option>
                <option value="SiteExecution">Field / site checklist fill</option>
              </Select>
            )}
            <Input
              required
              aria-required
              label="Subject *"
              placeholder={isClient ? "e.g. Water seepage near the store room" : "e.g. Beam depth clash at grid C4"}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <TextArea
              required
              aria-required
              rows={3}
              label={isClient ? "Concern *" : "Query raised *"}
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
                  SPDC/QMS/F-RFI-01 - same fields as SPDC_RFI_Form_and_Register.xlsx
                </p>
                <Select label="Package" value={form.package} onChange={(e) => setForm({ ...form, package: e.target.value })}>
                  <option value="">{formatUiText(picklists.packages.length ? "Select package" : "No packages yet")}</option>
                  {withCurrent(picklists.packages, form.package).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
                {!picklists.packages.length && picklists.loaded ? (
                  <p className="sm:col-span-2 lg:col-span-4 text-xs text-steel-muted">
                    {formatUiText("No packages on this project. Add them in Project set-up.")}{" "}
                    {user?.role === "admin" || user?.role === "office" ? (
                      <Link to={`/projects/${id}/setup`} className="font-semibold text-brand underline">
                        {formatUiText("Project set-up")}
                      </Link>
                    ) : null}
                  </p>
                ) : null}
                <Select
                  label="Discipline"
                  value={form.discipline}
                  disabled={disciplineLocked}
                  hint={disciplineLocked ? formatUiText("Set from the linked drawing") : undefined}
                  onChange={(e) => setForm({ ...form, discipline: e.target.value })}
                >
                  {!form.discipline ? <option value="">{formatUiText("Select discipline")}</option> : null}
                  {withCurrent(picklists.lists.disciplines, form.discipline).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
                <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">{formatUiText("Select category")}</option>
                  {withCurrent(picklists.lists.rfiCategories, form.category).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <Input
                  label="Location / grid"
                  placeholder="e.g. Grid C4, Level +3.00"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
                <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {withCurrent(picklists.lists.rfiPriorities, form.priority).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
                <Input
                  label="Spec clause"
                  placeholder="e.g. IS 456 cl. 26.4"
                  value={form.specClause}
                  onChange={(e) => setForm({ ...form, specClause: e.target.value })}
                />
                <TextArea
                  rows={2}
                  required={form.rfiKind === "RequestForInformation"}
                  aria-required={form.rfiKind === "RequestForInformation"}
                  label={form.rfiKind === "RequestForInformation" ? "Contractor proposed solution *" : "Contractor proposed solution (optional)"}
                  hint={
                    form.rfiKind === "RequestForInformation"
                      ? "Required on the SPDC RFI form. An RFI without a proposed solution is returned unanswered."
                      : undefined
                  }
                  placeholder="What the contractor proposes"
                  value={form.contractorSolution}
                  onChange={(e) => setForm({ ...form, contractorSolution: e.target.value })}
                  fieldClassName="sm:col-span-2"
                />
              </div>
            )}
            {!isClient && (
              <div className="grid sm:grid-cols-2 gap-2">
                {showChecklistPicker && (
                  <Select
                    required={needsChecklist}
                    aria-required={needsChecklist}
                    label={form.rfiKind === "RequestForInformation" ? "Drawing Check checklist (optional)" : "Checklist to fill *"}
                    value={form.linkedAssignmentId}
                    onChange={(e) => setForm({ ...form, linkedAssignmentId: e.target.value })}
                  >
                    <option value="">{formatUiText("Select checklist")}</option>
                    {checklistOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.template?.name || a.id}
                      </option>
                    ))}
                  </Select>
                )}
                {showChecklistPicker && (
                  <label className="ui-field">
                    <span className="ui-field__label">{formatUiText("Vendor from project directory")}</span>
                    <SearchableSelect
                      options={vendorOptions}
                      value={form.responsibleVendorId}
                      onChange={(responsibleVendorId) => setForm({ ...form, responsibleVendorId })}
                      searchPlaceholder="Search vendor / contractor by name…"
                    />
                  </label>
                )}
                <label className="ui-field">
                  <span className="ui-field__label">
                    {formatUiText(needsChecklist && !form.responsibleVendorId ? "Named person *" : "Named person")}
                  </span>
                  <SearchableSelect
                    options={personOptions}
                    value={form.assigneeKey}
                    onChange={pickAssignee}
                    searchPlaceholder="Search by name, email or company…"
                    required={needsChecklist && !form.responsibleVendorId}
                  />
                  <span className="ui-field__hint">
                    Portal users and communication matrix contacts. People with no email stay greyed out.{" "}
                    <Link to={`/projects/${id}/comms?tab=matrix`} className="font-semibold text-brand underline">
                      {formatUiText("Open the communication matrix")}
                    </Link>
                  </span>
                </label>
                {!isClient && rfiUsesDrawingLink(form.rfiKind) ? (
                  <Select
                    label={drawingsRfi ? "Linked drawing and revision *" : "Linked drawing (optional)"}
                    required={drawingsRfi}
                    aria-required={drawingsRfi}
                    disabled={noPublishedDrawings}
                    value={form.linkedDrawingId}
                    onChange={(e) => setForm({ ...form, linkedDrawingId: e.target.value, linkedRevisionId: "" })}
                  >
                    <option value="">{formatUiText("Select drawing")}</option>
                    {(drawingsRfi ? publishedDrawings : drawings).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.drawingNumber} - {d.title}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {drawingsRfi && composeDrawing ? (
                  <Select
                    label="Revision *"
                    required
                    aria-required
                    value={form.linkedRevisionId}
                    hint={formatUiText("Latest published revision is selected")}
                    onChange={(e) => setForm({ ...form, linkedRevisionId: e.target.value })}
                  >
                    <option value="">{formatUiText("Select revision")}</option>
                    {composeRevisions.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.revisionNumber}
                        {r.revisionLabel ? ` - ${r.revisionLabel}` : ""}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <Input
                  label="Attachment / note"
                  placeholder="e.g. Site photo ref or sketch no."
                  value={form.attachmentNote}
                  onChange={(e) => setForm({ ...form, attachmentNote: e.target.value })}
                />
                {!moduleScoped && (
                <Select label="Schedule impact" value={form.scheduleImpact} onChange={(e) => setForm({ ...form, scheduleImpact: e.target.value })}>
                  {picklists.lists.impactLevels.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
                )}
              </div>
            )}
            <p className="text-xs text-steel-muted">
              {form.rfiKind === "QualityInspection"
                ? "Quality QI — send the fill to a named person or a vendor from this project's directory. They get the ping and the fill log."
                : form.rfiKind === "DrawingChecklist"
                  ? "Drawing Check Master only — use Drawings → Checklist manager. Quality & Safety have separate masters."
                  : form.rfiKind === "SafetyChecklist"
                    ? "Safety fill — send to a named person or a vendor from this project's directory. No drawing file attachment."
                    : form.rfiKind === "RequestForInformation"
                      ? "PMC / drawing clarification - link the drawing and revision. Attaching a Drawing Check checklist is optional."
                      : "Pick a named directory person or an assigned vendor. The request is emailed and lands on their fill inbox."}
            </p>
            <Button type="submit" disabled={composeBusy || noPublishedDrawings}>
              {isClient ? "Submit concern" : moduleScope === "quality" ? "Request QI fill" : moduleScope === "drawings" && form.rfiKind === "DrawingChecklist" ? "Request checklist fill" : "Open RFI"}
            </Button>
            <StatusNote msg={syncNote} compact />
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
              rows={registerRows}
              activeId={active}
              onSelect={(rid) => {
                setActive(rid);
                setRegisterDetailOpen(true);
              }}
            />
          </div>
        </div>
      ) : (
      <div className="grid lg:grid-cols-[320px_1fr] gap-4 items-start">
        <Card padding={false} className="lg:sticky lg:top-2 flex flex-col max-h-[min(70vh,42rem)] overflow-hidden">
          <div className="px-4 py-3 border-b border-line font-semibold bg-sand/40 shrink-0 flex items-center justify-between gap-2">
            <span>{rfiLogTitle(moduleScope)}</span>
            <span className="text-[11px] font-mono text-steel-muted font-normal">{filtered.length}</span>
          </div>
          <ul className="divide-y divide-line flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbars-visible">
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
                  {r.assignedTo?.fullName ? ` · ${r.assignedTo.fullName}` : r.assigneeName ? ` · ${r.assigneeName}` : ""}
                  {r.matrixAssignee || (!r.assignedTo && r.assigneeName) ? (
                    <Badge tone="neutral" className="ml-1">Matrix</Badge>
                  ) : null}
                </div>
              </button>
            );
            })}
            {!filtered.length && <li className="p-4 text-sm text-steel-muted">No items.</li>}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-steel-muted text-sm">Select an item</p>}
          {selected && useSpdcForm && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <RfiDeleteButton
                  rfi={selected}
                  token={token}
                  role={user?.role}
                  onDeleted={async () => {
                    setActive(null);
                    await load();
                  }}
                />
              </div>
              <SpdcRfiFormView
                rfi={selectedView}
                project={projectMeta}
                token={token}
                canRespond={canRespond}
                canClose={canClose}
                projectId={id}
                onReload={load}
              />
            </div>
          )}
          {selected && !useSpdcForm && (
            <div className="space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-xs text-brand">{selected.number}</div>
                  <RfiDeleteButton
                    rfi={selected}
                    token={token}
                    role={user?.role}
                    onDeleted={async () => {
                      setActive(null);
                      await load();
                    }}
                  />
                </div>
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
                  {selected.assignedTo?.fullName && <Badge tone="neutral">Assignee: {selected.assignedTo.fullName}</Badge>}
                  {(selected.matrixAssignee || selected.assigneeContactId) && (
                    <Badge tone="neutral">Matrix</Badge>
                  )}
                </div>
              </div>
              {selectedProgress && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Record completeness</h3>
                  <RfiFieldChecklist progress={selectedProgress} />
                </div>
              )}
              <div className="rounded-xl bg-sand/40 p-4 text-sm whitespace-pre-wrap">{selected.question}</div>
              {id && selected.linkedDrawingId ? (
                <DrawingMarkupPanel projectId={id} targetType="rfi" targetId={selected.id} drawingId={selected.linkedDrawingId} token={token} />
              ) : null}
              {(selected.linkedAssignmentId || selected.linkedChecklistItemId) && (
                <div className="rounded-lg border-2 border-brand bg-brand-soft/40 p-4 text-sm space-y-3">
                  <div className="font-semibold text-xs uppercase tracking-wider text-brand">Fill this checklist</div>
                  <p className="text-steel-muted text-xs leading-relaxed">
                    This request is already on the fill log for the assigned vendor / site person.
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
                        {resp.respondedBy?.fullName || "—"} · {new Date(resp.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap">{resp.responseText}</div>
                    </li>
                  ))}
                  {!selected.responses?.length && <li className="text-sm text-steel-muted">No responses yet.</li>}
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
                  <TextArea
                    rows={3}
                    label="Official response *"
                    aria-required
                    placeholder="Answer from the assigned party"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    required
                  />
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
                        Close after checking the answer
                      </Button>
                    )}
                  </div>
                </form>
              )}
              {!canRespond && selected.status !== "Closed" && (
                <p className="text-xs text-steel-muted bg-sand/50 p-3 rounded-lg">
                  The assigned party answers. The person who raised the RFI closes it after checking that answer. Sharnam office can answer or close.
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
                <div className="flex flex-wrap justify-end gap-2 mb-2">
                  <RfiDeleteButton
                    rfi={selected}
                    token={token}
                    role={user?.role}
                    onDeleted={async () => {
                      setRegisterDetailOpen(false);
                      setActive(null);
                      await load();
                    }}
                  />
                </div>
                {useSpdcForm ? (
                  <SpdcRfiFormView
                    rfi={selectedView}
                    project={projectMeta}
                    token={token}
                    canRespond={canRespond}
                    canClose={canClose}
                    projectId={id}
                    onReload={load}
                  />
                ) : (
                  <div className="space-y-4">
                    {selectedProgress && (
                      <div className="space-y-2">
                        <RfiStageStepper progress={selectedProgress} />
                        <RfiProgressBar progress={selectedProgress} />
                      </div>
                    )}
                    <div className="rounded-xl bg-sand/40 p-4 text-sm whitespace-pre-wrap">{selected.question}</div>
                    {id && selected.linkedDrawingId ? (
                      <DrawingMarkupPanel
                        projectId={id}
                        targetType="rfi"
                        targetId={selected.id}
                        drawingId={selected.linkedDrawingId}
                        token={token}
                      />
                    ) : null}
                    <div>
                      <h3 className="font-semibold text-sm mb-2">Responses</h3>
                      <ul className="space-y-2">
                        {selected.responses?.map((resp: any) => (
                          <li key={resp.id} className="rounded-xl border border-line p-3 text-sm">
                            <div className="text-xs text-steel-muted mb-1">
                              {resp.respondedBy?.fullName || "—"} ·{" "}
                              {resp.isOfficialResponse ? "Official" : "Note"}
                            </div>
                            <div className="whitespace-pre-wrap">{resp.responseText}</div>
                          </li>
                        ))}
                        {!selected.responses?.length && (
                          <li className="text-sm text-steel-muted">No responses yet.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
