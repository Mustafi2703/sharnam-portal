import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { ReferenceSheetToolbar } from "../../components/ReferenceSheetToolbar";
import { RegisterEntryModal } from "../../components/RegisterEntryModal";
import { RegisterEmptyRow, RegisterSheetFrame } from "../../components/RegisterSheetFrame";
import { LineChart } from "../../components/ColumnChart";
import { PieChart } from "../../components/PieChart";
import { UploadModal } from "../../components/UploadModal";
import { downloadAuthFile } from "../../lib/downloadReport";
import { formatUiText } from "../../lib/formatUiText";

type Tab =
  | "dashboard"
  | "plan"
  | "findings"
  | "site-walk"
  | "folder-sample"
  | "dc-interview"
  | "kpi-dashboard"
  | "iso-map"
  | "subjects"
  | "trend"
  | "role-kra";

const TABS: { key: Tab; label: string; sheet?: string }[] = [
  { key: "dashboard", label: "Audit dashboard", sheet: "DASHBOARD" },
  { key: "plan", label: "Audit plan", sheet: "PLAN" },
  { key: "findings", label: "Findings", sheet: "FINDINGS" },
  { key: "site-walk", label: "Site walk", sheet: "SITE_WALK" },
  { key: "folder-sample", label: "Folder sample", sheet: "FOLDER_SAMPLE" },
  { key: "dc-interview", label: "DC interview", sheet: "DC_INTERVIEW" },
  { key: "kpi-dashboard", label: "KPI dashboard", sheet: "00_KPI_DASHBOARD" },
  { key: "iso-map", label: "ISO folder map", sheet: "01_ISO_FOLDER_MAP" },
  { key: "subjects", label: "Subject data", sheet: "03_SUBJECT_DATA" },
  { key: "trend", label: "Weekly trend", sheet: "04_TREND" },
  { key: "role-kra", label: "Role KRA", sheet: "06_ROLE_KRA" },
];

const ISO_AREAS = [
  "01_CONTEXT_AND_GOVERNANCE",
  "02_PLANNING",
  "03_SUPPORT_AND_RESOURCES",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT",
  "05_PROCUREMENT_AND_CONTRACTS",
  "06_STATUTORY_AND_LAND",
  "07_EXECUTION_AND_DELIVERY",
  "08_QUALITY_HSE_AND_ENVIRONMENT",
  "09_COMMERCIAL_AND_CHANGE",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT",
];

const FINDING_BLANK = {
  description: "",
  severity: "Minor",
  source: "Site walk",
  folderLocation: "",
  refNo: "",
  photoRef: "",
  rootCause: "",
  correctiveAction: "",
  preventiveAction: "",
  owner: "",
  verifiedBy: "",
  status: "Open",
  dueDate: "",
  closedAt: "",
  subjectCode: "",
};

function sectionForTab(tab: Tab) {
  if (tab === "site-walk") return "SiteWalk";
  if (tab === "dc-interview") return "DcInterview";
  if (tab === "folder-sample") return "FolderSample";
  return "";
}

const CRITICAL_WALK = new Set([2, 6, 11, 12, 17]);

function sourceLabel(dataSource: string | null | undefined) {
  if (dataSource?.startsWith("portal:")) return `Portal - ${dataSource.slice("portal:".length)}`;
  return "Typed";
}

function defaultFindingSeverity(section: string, itemNo: number, score: number) {
  if (section === "SiteWalk" && score === 0 && CRITICAL_WALK.has(itemNo)) return "Critical";
  if (score === 0) return "Major";
  return "Minor";
}

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  const fraction = value > 1 ? value / 100 : value;
  return `${Math.round(fraction * 1000) / 10}%`;
}

function ragTone(rag: string): "danger" | "warn" | "ok" | "neutral" {
  const v = (rag || "").toUpperCase();
  if (v === "RED" || v === "FAIL" || v === "CRITICAL") return "danger";
  if (v === "AMBER" || v === "PASS WITH ACTIONS") return "warn";
  if (v === "GREEN" || v === "PASS") return "ok";
  return "neutral";
}

function dateInput(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function kraInput(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  const n = Number(value);
  return String(n <= 1 ? Math.round(n * 1000) / 10 : n);
}

export default function AuditKpiPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const tabRaw = searchParams.get("tab");
  const tab: Tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as Tab) : "dashboard";
  const selectedAuditId = searchParams.get("audit") || "";
  const unlinkedOnly = searchParams.get("unlinked") === "1";
  const [data, setData] = useState<any>(null);
  const [audits, setAudits] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [kras, setKras] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [driveNotice, setDriveNotice] = useState("");
  const [allFindings, setAllFindings] = useState<any[]>([]);
  const [kraFilter, setKraFilter] = useState("");
  const [findingAuditFilter, setFindingAuditFilter] = useState("");
  const [linkChecklistId, setLinkChecklistId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const canEdit = user?.role === "admin" || user?.role === "office" || user?.role === "employee";

  const [findingForm, setFindingForm] = useState({ ...FINDING_BLANK });
  const [findingEditId, setFindingEditId] = useState<string | null>(null);
  const [findingModalOpen, setFindingModalOpen] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [trendModalOpen, setTrendModalOpen] = useState(false);
  const [kraModalOpen, setKraModalOpen] = useState(false);
  const [checklistForm, setChecklistForm] = useState({ prompt: "", locationChecked: "", walkSection: "" });
  const [subjectForm, setSubjectForm] = useState({
    isoArea: ISO_AREAS[0],
    name: "",
    custodian: "HO",
    folder: "",
    recordsCount: "",
    openCount: "",
    closedCount: "",
    overdueCount: "",
    oldestOpenDays: "",
    kraScore: "",
  });
  const [trendForm, setTrendForm] = useState({
    weekEnding: "",
    recordsCount: "",
    openCount: "",
    closedCount: "",
    pctClosed: "",
    overdueCount: "",
    subjectsRed: "",
    kraScore: "",
    oldestOpenDays: "",
    notYetUsed: "",
    comment: "",
  });
  const [kraForm, setKraForm] = useState({ roleKey: "", kraNo: "", description: "", lineKind: "kra", target: "" });
  const [evidenceFor, setEvidenceFor] = useState<any>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceError, setEvidenceError] = useState("");

  const auditQuery = selectedAuditId ? `auditId=${encodeURIComponent(selectedAuditId)}` : "";

  const load = async () => {
    const dashQ = auditQuery ? `?${auditQuery}` : "";
    const [dash, auditList] = await Promise.all([
      api(`/api/audit-kpi/project/${id}/dashboard${dashQ}`, { token }),
      api<{ audits: any[] }>(`/api/audit-kpi/project/${id}/audits`, { token }),
    ]);
    setData(dash);
    setAudits(auditList.audits || []);
    if (tab === "subjects" || tab === "kpi-dashboard" || tab === "iso-map" || tab === "role-kra") {
      const s = await api<{ subjects: any[] }>(`/api/audit-kpi/project/${id}/subjects`, { token });
      setSubjects(s.subjects || []);
    }
    if (tab === "role-kra") {
      const k = await api<{ kras: any[]; roles: any[] }>(`/api/audit-kpi/project/${id}/role-kra`, { token });
      setKras(k.kras || []);
      setRoles(k.roles || []);
    }
    if (tab === "trend") {
      const t = await api<{ weeks: any[] }>(`/api/audit-kpi/project/${id}/trend`, { token });
      setWeeks(t.weeks || []);
    }
    if (tab === "findings" || tab === "site-walk" || tab === "folder-sample") {
      const f = await api<{ findings: any[] }>(`/api/audit-kpi/project/${id}/findings`, { token });
      setAllFindings(f.findings || []);
    }
    if (tab === "plan") {
      const c = await api<{ items: any[] }>(`/api/audit-kpi/project/${id}/checklist${dashQ}`, { token });
      setChecklist((c.items || []).filter((row) => String(row.section).startsWith("Plan")));
    }
    const sec = sectionForTab(tab);
    if (sec) {
      const q = [auditQuery, `section=${sec}`].filter(Boolean).join("&");
      const c = await api<{ items: any[] }>(`/api/audit-kpi/project/${id}/checklist?${q}`, { token });
      setChecklist(c.items || []);
    }
    if (tab === "folder-sample") {
      const sug = await api<{ suggestions: any[]; notice?: string | null }>(`/api/audit-kpi/project/${id}/drive-suggestions`, { token });
      setSuggestions(sug.suggestions || []);
      setDriveNotice(sug.notice || "");
    }
  };

  useEffect(() => {
    if (!id || !token) return;
    void load().catch((e) => setMsg(String(e.message || e)));
  }, [id, token, tab, selectedAuditId]);

  const ragPie = useMemo(() => {
    const c = data?.totals?.ragCounts || {};
    return [
      { label: "RED", value: c.RED || 0, color: "#DC2626" },
      { label: "AMBER", value: c.AMBER || 0, color: "#D97706" },
      { label: "GREEN", value: c.GREEN || 0, color: "#16A34A" },
      { label: "UNUSED", value: c.UNUSED || 0, color: "#94A3B8" },
    ].filter((x) => x.value > 0);
  }, [data]);

  const findingPie = useMemo(() => {
    if (!data?.totals) return [];
    return [
      { label: "Open", value: data.totals.openFindings || 0, color: "#DC2626" },
      { label: "Closed", value: data.totals.closedFindings || 0, color: "#16A34A" },
    ].filter((x) => x.value > 0);
  }, [data]);

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const dl = (ext: "csv" | "xlsx", sheet: string) => {
    if (!id || !token) return;
    const q = auditQuery ? `?${auditQuery}` : "";
    void downloadAuthFile(`/api/audit-kpi/project/${id}/download/${sheet}.${ext}${q}`, token, `Sharnam-${sheet}.${ext}`);
  };

  const uploadPack = tab === "subjects" || tab === "role-kra" || tab === "kpi-dashboard" || tab === "iso-map" || tab === "trend" ? "kpi" : "site-audit";

  const uploadSheet = async (file: File) => {
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("pack", uploadPack);
      const out = await api<{ stats: Record<string, number> }>(`/api/audit-kpi/project/${id}/upload`, {
        token,
        method: "POST",
        body: fd,
      });
      setMsg(`Imported. ${out.stats.findings ?? 0} findings, ${out.stats.subjects ?? 0} subjects, ${out.stats.checklist ?? 0} checklist rows.`);
      await load();
    } catch (e: any) {
      setMsg(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const loadTemplates = async () => {
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ stats: Record<string, number> }>(`/api/audit-kpi/project/${id}/resync`, { token, method: "POST" });
      setMsg(`Added ${out.stats.checklistAdded ?? out.stats.checklist ?? 0} checklist rows, ${out.stats.subjectsAdded ?? 0} subjects, ${out.stats.krasAdded ?? 0} role lines. Existing scores were left as they are.`);
      await load();
    } catch (e: any) {
      setMsg(e.message || "Could not load sheet rows");
    } finally {
      setBusy(false);
    }
  };

  const saveHeader = async (patch: Record<string, string>) => {
    if (!canEdit) return;
    const auditId = selectedAuditId || data?.audit?.id || "";
    const q = auditId ? `?auditId=${encodeURIComponent(auditId)}` : "";
    await api(`/api/audit-kpi/project/${id}/header${q}`, { token, method: "PATCH", body: JSON.stringify({ ...patch, auditId }) });
    await load();
  };

  const openRaise = (row: any, score: number) => {
    const section = String(row.section || (tab === "folder-sample" ? "FolderSample" : "SiteWalk"));
    const refNo = section === "FolderSample" ? `F-${String(row.itemNo).padStart(2, "0")}` : `W-${String(row.itemNo).padStart(2, "0")}`;
    setLinkChecklistId(row.id);
    setFindingEditId(null);
    setFindingForm({
      ...FINDING_BLANK,
      description: row.observed || row.detail?.defects || row.prompt || "",
      severity: defaultFindingSeverity(section, Number(row.itemNo), score),
      source: section === "FolderSample" ? "Folder sample" : "Site walk",
      folderLocation: row.locationChecked || row.detail?.folder || "",
      refNo,
      photoRef: row.photoRef || "",
    });
    setFindingModalOpen(true);
  };

  const openFinding = (row?: any) => {
    setLinkChecklistId(null);
    if (!row) {
      setFindingEditId(null);
      setFindingForm({ ...FINDING_BLANK });
    } else {
      setFindingEditId(row.id);
      setFindingForm({
        description: row.description || "",
        severity: row.severity || "Minor",
        source: row.source || "Site walk",
        folderLocation: row.folderLocation || "",
        refNo: row.refNo || "",
        photoRef: row.photoRef || "",
        rootCause: row.rootCause || "",
        correctiveAction: row.correctiveAction || "",
        preventiveAction: row.preventiveAction || "",
        owner: row.owner || "",
        verifiedBy: row.verifiedBy || "",
        status: row.status || "Open",
        dueDate: dateInput(row.dueDate),
        closedAt: dateInput(row.closedAt),
        subjectCode: row.subjectCode || "",
      });
    }
    setFindingModalOpen(true);
  };

  const saveFinding = async () => {
    setBusy(true);
    try {
      const auditId = selectedAuditId || data?.audit?.id || "";
      let saved: { findingNo?: string } | null = null;
      if (findingEditId) {
        await api(`/api/audit-kpi/findings/${findingEditId}`, { token, method: "PATCH", body: JSON.stringify(findingForm) });
      } else {
        saved = await api<{ findingNo: string }>(`/api/audit-kpi/project/${id}/findings`, {
          token,
          method: "POST",
          body: JSON.stringify({ ...findingForm, siteAuditId: auditId }),
        });
      }
      if (linkChecklistId && saved?.findingNo) {
        await api(`/api/audit-kpi/checklist/${linkChecklistId}`, {
          token,
          method: "PATCH",
          body: JSON.stringify({ detail: { findingRef: saved.findingNo } }),
        });
      }
      setFindingModalOpen(false);
      setLinkChecklistId(null);
      await load();
      setMsg(findingEditId ? "Finding updated." : "Finding added.");
    } catch (err: any) {
      setMsg(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const saveSubject = async () => {
    setBusy(true);
    try {
      await api(`/api/audit-kpi/project/${id}/subjects`, { token, method: "POST", body: JSON.stringify(subjectForm) });
      setSubjectForm({ ...subjectForm, name: "", folder: "", recordsCount: "", openCount: "", closedCount: "", overdueCount: "", oldestOpenDays: "", kraScore: "" });
      setSubjectModalOpen(false);
      await load();
      setMsg("Subject row added. RAG is calculated from the figures.");
    } catch (err: any) {
      setMsg(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const patchSubject = async (subjectId: string, patch: Record<string, unknown>) => {
    await api(`/api/audit-kpi/subjects/${subjectId}`, { token, method: "PATCH", body: JSON.stringify(patch) });
    await load();
  };

  const saveChecklist = async (itemId: string, patch: Record<string, unknown>) => {
    await api(`/api/audit-kpi/checklist/${itemId}`, { token, method: "PATCH", body: JSON.stringify(patch) });
    await load();
  };

  const saveChecklistRow = async () => {
    const sec = tab === "plan" ? "PlanDay" : sectionForTab(tab);
    if (!sec || !id) return;
    setBusy(true);
    try {
      await api(`/api/audit-kpi/project/${id}/checklist`, {
        token,
        method: "POST",
        body: JSON.stringify({
          section: sec,
          prompt: checklistForm.prompt,
          locationChecked: checklistForm.locationChecked || null,
          detail: checklistForm.walkSection ? { walkSection: checklistForm.walkSection } : undefined,
        }),
      });
      setChecklistForm({ prompt: "", locationChecked: "", walkSection: "" });
      setChecklistModalOpen(false);
      await load();
      setMsg("Row added.");
    } catch (err: any) {
      setMsg(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const saveTrend = async () => {
    setBusy(true);
    try {
      await api(`/api/audit-kpi/project/${id}/trend`, { token, method: "POST", body: JSON.stringify(trendForm) });
      setTrendModalOpen(false);
      await load();
      setMsg("Trend week saved. Movement in overdue is the difference from the previous week.");
    } catch (err: any) {
      setMsg(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const saveKra = async () => {
    setBusy(true);
    try {
      await api(`/api/audit-kpi/project/${id}/role-kra`, { token, method: "POST", body: JSON.stringify(kraForm) });
      setKraModalOpen(false);
      await load();
      setMsg("KRA line saved.");
    } catch (err: any) {
      setMsg(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const acceptSuggestion = async (row: any) => {
    setBusy(true);
    try {
      await api(`/api/audit-kpi/project/${id}/drive-accept`, {
        token,
        method: "POST",
        body: JSON.stringify({ kind: row.kind, path: row.path, area: row.area, folder: row.folder, name: row.name }),
      });
      await load();
      setMsg(row.kind === "file" ? "File accepted onto the folder sample. Score stays blank until you inspect it." : "Folder accepted onto the folder sample. No score was added.");
    } catch (err: any) {
      setMsg(err.message || "Could not accept");
    } finally {
      setBusy(false);
    }
  };

  const submitEvidence = async (e: FormEvent) => {
    e.preventDefault();
    if (!evidenceFor || !evidenceFile) return;
    setBusy(true);
    setEvidenceError("");
    try {
      const fd = new FormData();
      fd.append("file", evidenceFile);
      await api(`/api/audit-kpi/checklist/${evidenceFor.id}/evidence`, { token, method: "POST", body: fd });
      setEvidenceFor(null);
      setEvidenceFile(null);
      await load();
      setMsg("Evidence filed on the project drive under the audit programme folder.");
    } catch (err: any) {
      setEvidenceError(err.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const checklistTab = tab === "site-walk" || tab === "dc-interview" || tab === "folder-sample" || tab === "plan";
  const currentSheet = TABS.find((t) => t.key === tab)?.sheet || "";
  const score = data?.auditScore;
  const kpi = data?.kpi;
  const auditHeader = data?.audit;

  const scoresLocked = String(data?.audit?.status || "").toLowerCase() === "closed";
  const activeAuditId = selectedAuditId || data?.audit?.id || "";
  const auditFindings = (allFindings.length ? allFindings : data?.findings || []).filter(
    (row: any) => !activeAuditId || row.siteAuditId === activeAuditId || row.siteAudit?.id === activeAuditId
  );
  const visibleChecklist = unlinkedOnly
    ? checklist.filter((row) => (row.score === 0 || row.score === 1) && !row.detail?.findingRef)
    : checklist;

  const pickAudit = (auditId: string) => {
    const next = new URLSearchParams(searchParams);
    if (auditId) next.set("audit", auditId);
    else next.delete("audit");
    setSearchParams(next, { replace: true });
  };

  const createAudit = async () => {
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ audit: { id: string; auditRef?: string }; checklistAdded: number }>(`/api/audit-kpi/project/${id}/audits`, {
        token,
        method: "POST",
        body: JSON.stringify({}),
      });
      pickAudit(out.audit.id);
      setMsg(`Audit ${out.audit.auditRef || ""} created with ${out.checklistAdded} template rows.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const captureWeek = async (force = false) => {
    setBusy(true);
    setMsg("");
    try {
      const q = force ? "?force=1" : "";
      await api(`/api/audit-kpi/project/${id}/trend/snapshot${q}`, { token, method: "POST" });
      setMsg(force ? "This week was overwritten from the dashboard." : "This week was captured from the dashboard.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const cell = (value: string, onSave: (v: string) => void, opts?: { type?: string }) =>
    canEdit ? (
      <input
        className="register-sheet-cell w-full min-w-[6rem]"
        type={opts?.type || "text"}
        defaultValue={value}
        onBlur={(e) => {
          if (e.target.value !== value) void onSave(e.target.value);
        }}
      />
    ) : (
      value || "-"
    );

  const scoreControl = (row: any, section: "SiteWalk" | "FolderSample") =>
    canEdit && !scoresLocked ? (
      <Select
        value={row.score == null ? "" : String(row.score)}
        onChange={(e) => {
          const value = e.target.value;
          void saveChecklist(row.id, { score: value }).then(() => {
            const n = Number(value);
            if ((n === 0 || n === 1) && !row.detail?.findingRef) openRaise({ ...row, section }, n);
          });
        }}
      >
        <option value="">Blank</option>
        <option value="2">2</option>
        <option value="1">1</option>
        <option value="0">0</option>
        <option value="N/A">N/A</option>
      </Select>
    ) : (
      row.score ?? "-"
    );

  const findingRefControl = (row: any, section: "SiteWalk" | "FolderSample") => (
    <div>
      {canEdit && !scoresLocked ? (
        <Select
          value={row.detail?.findingRef || ""}
          onChange={(e) => {
            if (e.target.value === "__new") openRaise({ ...row, section }, Number(row.score ?? 0));
            else void saveChecklist(row.id, { detail: { findingRef: e.target.value } });
          }}
        >
          <option value="">Blank</option>
          <option value="__new">Raise new</option>
          {auditFindings.map((finding: any) => (
            <option key={finding.id} value={finding.findingNo}>{finding.findingNo}</option>
          ))}
        </Select>
      ) : (
        row.detail?.findingRef || "-"
      )}
      {row.score != null && row.score >= 2 && row.detail?.findingRef && (
        <div className="text-xs text-steel-muted mt-1">Score now met - review and close</div>
      )}
    </div>
  );

  return (
    <div className={tab !== "dashboard" && tab !== "kpi-dashboard" ? "page-stack--register flex flex-col flex-1 min-h-0 overflow-hidden gap-2 pb-2" : "page-stack"}>
      <div className="shrink-0">
        <PageHeader
          title="Audit & KPI"
          subtitle="Fill the site audit pack and the master KPI dashboard for this project. Scores and RAG come from the registers."
        />
        {canEdit && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void loadTemplates()}>
              Reload missing template rows
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void createAudit()}>
              New audit
            </Button>
            {(tab === "kpi-dashboard" || tab === "subjects") && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg("");
                  try {
                    const r = await api<{ updated: number; subjects: number; manual: number }>(`/api/audit-kpi/project/${id}/refresh`, { method: "POST", token });
                    setMsg(`Updated ${r.updated} of ${r.subjects} subjects from portal records. ${r.manual} are typed by hand.`);
                    await load();
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Refresh from portal records
              </Button>
            )}
            {tab === "trend" && (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void captureWeek(false)}>
                Capture this week
              </Button>
            )}
            {msg && <span className="text-xs text-steel-muted">{msg}</span>}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="text-xs text-steel-muted">Audit</span>
            <Select className="mt-1 min-w-[16rem]" value={activeAuditId} onChange={(e) => pickAudit(e.target.value)}>
              {!audits.length && <option value="">No audit yet</option>}
              {audits.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.auditRef || row.title} · {row.status} · {pct(row.overall)} · {row.verdict}
                </option>
              ))}
            </Select>
          </label>
          {data?.audit && (
            <p className="text-xs text-steel-muted pb-2">
              {data.audit.auditRef || "Audit"} · {dateInput(data.audit.auditDate || data.audit.plannedDate) || "No date"} · {data.audit.status}
              {scoresLocked ? " · scores are read-only" : ""}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 shrink-0">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`chip ${tab === t.key ? "chip--active" : ""}`} onClick={() => setTab(t.key)}>
            {formatUiText(t.label)}
          </button>
        ))}
      </div>

      {tab === "dashboard" && score && (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {[
              ["Folders", score.folders],
              ["Walk checks", score.walkChecks],
              ["Scored", score.scored],
              ["Not met", score.notMet],
              ["Overall score", pct(score.overall)],
              ["Critical findings", score.critical],
              ["Folder score", pct(score.folderScore)],
              ["Site walk score", pct(score.walkScore)],
              ["Findings raised", score.findingsRaised],
              ["Findings open", score.findingsOpen],
            ].map(([label, value]) => (
              <Card key={String(label)} className="p-4">
                <p className="text-xs text-steel-muted">{formatUiText(String(label))}</p>
                <p className="text-2xl font-semibold">{value}</p>
              </Card>
            ))}
            <Card className="p-4">
              <p className="text-xs text-steel-muted">{formatUiText("Verdict")}</p>
              <p className="mt-2"><Badge tone={ragTone(score.verdict)}>{score.verdict}</Badge></p>
              <p className="text-xs text-steel-muted mt-2">Pass at 90% with no critical finding. Pass with actions from 75%. Fail below 75% or if any finding is critical.</p>
            </Card>
          </div>
          {auditHeader && (
            <Card className="p-4 mb-6">
              <h3 className="font-medium mb-3">{formatUiText("Audit header")}</h3>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  ["auditRef", "Audit ref"],
                  ["leadAuditor", "Auditor"],
                  ["documentController", "Document controller"],
                  ["projectManager", "Project manager"],
                  ["independentOfProject", "Independent of this project"],
                  ["areasWalked", "Areas walked"],
                  ["accompaniedBy", "Accompanied by"],
                  ["interviewee", "Interviewee"],
                  ["intervieweeRole", "Interviewee role"],
                ].map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    <span className="text-xs text-steel-muted">{formatUiText(label)}</span>
                    <Input
                      className="mt-1"
                      defaultValue={auditHeader[key] || ""}
                      disabled={!canEdit}
                      onBlur={(e) => void saveHeader({ [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="block text-sm">
                  <span className="text-xs text-steel-muted">{formatUiText("Status")}</span>
                  <Select
                    className="mt-1"
                    value={auditHeader.status || "Planned"}
                    disabled={!canEdit}
                    onChange={(e) => void saveHeader({ status: e.target.value })}
                  >
                    {["Planned", "In progress", "Closed"].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </Select>
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-steel-muted">{formatUiText("Date")}</span>
                  <Input
                    className="mt-1"
                    type="date"
                    defaultValue={dateInput(auditHeader.plannedDate)}
                    disabled={!canEdit}
                    onBlur={(e) => void saveHeader({ plannedDate: e.target.value })}
                  />
                </label>
              </div>
            </Card>
          )}
          <RegisterSheetFrame title="Site walk score by section" sheetLabel="DASHBOARD" rowCount={score.sections?.length || 0}>
            <table className="sheet-register__table min-w-[40rem]">
              <thead>
                <tr>
                  {["Section", "Checks", "Met", "Not met", "Score"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(score.sections || []).map((row: any) => (
                  <tr key={row.title}>
                    <td className="wrap">{row.title}</td>
                    <td>{row.checks}</td>
                    <td>{row.met}</td>
                    <td>{row.notMet}</td>
                    <td>{pct(row.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RegisterSheetFrame>
          {score.unlinkedLow > 0 && (
            <Card className="p-4 mb-6">
              <button
                type="button"
                className="text-sm text-left"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set("tab", "site-walk");
                  next.set("unlinked", "1");
                  setSearchParams(next, { replace: true });
                }}
              >
                {score.unlinkedLow} scores below 2 have no finding
              </button>
            </Card>
          )}
          <RegisterSheetFrame title="Audit history" sheetLabel="DASHBOARD" rowCount={audits.length} className="mt-6">
            <table className="sheet-register__table min-w-[48rem]">
              <thead>
                <tr>
                  {["Date", "Auditor", "Overall score", "Critical findings", "Verdict", "Open findings"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits.map((row) => (
                  <tr key={row.id}>
                    <td>{dateInput(row.auditDate || row.plannedDate) || "-"}</td>
                    <td>{row.leadAuditor || "-"}</td>
                    <td>{pct(row.overall)}</td>
                    <td>{row.critical}</td>
                    <td><Badge tone={ragTone(row.verdict)}>{row.verdict}</Badge></td>
                    <td>{row.openFindings}</td>
                  </tr>
                ))}
                {!audits.length && <RegisterEmptyRow colSpan={6} />}
              </tbody>
            </table>
          </RegisterSheetFrame>
          {findingPie.length > 0 && (
            <Card className="p-4 mt-6 max-w-md">
              <PieChart title="Findings status" items={findingPie} size={180} />
            </Card>
          )}
        </>
      )}

      {tab === "dashboard" && !score && (
        <p className="text-sm text-steel-muted">No rows. Click Reload missing template rows.</p>
      )}

      {tab === "kpi-dashboard" && kpi && (
        <>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {[
              ["Subjects", kpi.subjects],
              ["Records", kpi.records],
              ["Open", kpi.open],
              ["Closed", kpi.closed],
              ["% closed", pct(kpi.pctClosed)],
              ["Avg KRA score", kpi.kraScored ? `${pct(kpi.avgKra)} (${kpi.kraScored} of ${kpi.subjects} scored)` : "Not scored"],
              ["Overdue items", kpi.overdueItems],
              ["Subjects red", kpi.red],
              ["Subjects amber", kpi.amber],
              ["Subjects green", kpi.green],
              ["In use", kpi.inUse],
              ["Not yet used", kpi.unused],
            ].map(([label, value]) => (
              <Card key={String(label)} className="p-4">
                <p className="text-xs text-steel-muted">{formatUiText(String(label))}</p>
                <p className="text-2xl font-semibold">{value}</p>
              </Card>
            ))}
          </div>
          <RegisterSheetFrame title="Performance by ISO area" sheetLabel="02_ISO_AREA_ROLLUP" rowCount={kpi.areas?.length || 0} className="mb-6">
            <table className="sheet-register__table min-w-[56rem]">
              <thead>
                <tr>
                  {["ISO area", "Folders", "Subjects", "Records", "Open", "Overdue", "% closed", "KRA", "RAG"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(kpi.areas || []).map((row: any) => (
                  <tr key={row.isoArea}>
                    <td className="wrap">{row.isoArea}</td>
                    <td>{row.folders}</td>
                    <td>{row.subjects}</td>
                    <td>{row.records}</td>
                    <td>{row.open}</td>
                    <td>{row.overdue}</td>
                    <td>{pct(row.pctClosed)}</td>
                    <td>{pct(row.kraScore)}</td>
                    <td><Badge tone={ragTone(row.rag)}>{row.rag}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RegisterSheetFrame>
          <RegisterSheetFrame title="Document control health" sheetLabel="00_KPI_DASHBOARD" rowCount={kpi.health?.length || 0}>
            <table className="sheet-register__table min-w-[40rem]">
              <thead>
                <tr>
                  {["Indicator", "Value", "Target", "Source"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(kpi.health || []).map((row: any) => (
                  <tr key={row.indicator}>
                    <td className="wrap">{row.indicator}</td>
                    <td>
                      {typeof row.value === "number" && (row.indicator.toLowerCase().includes("rate") || row.indicator.toLowerCase().includes("kra"))
                        ? pct(row.value)
                        : row.value}
                    </td>
                    <td>{row.target}</td>
                    <td>{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RegisterSheetFrame>
          {ragPie.length > 0 && (
            <Card className="p-4 mt-6 max-w-md">
              <PieChart title="Subject RAG" items={ragPie} size={180} />
            </Card>
          )}
          <Card className="p-4 mt-6">
            <h3 className="font-medium mb-2">{formatUiText("How the figures update")}</h3>
            <p className="text-sm text-steel-muted">
              Type records, open, closed, overdue, oldest open days, and KRA score on Subject data. Percent closed and RAG calculate from those figures. A subject with no records stays unused. Any overdue item, or an item open more than 30 days, is red. More than 14 days open is amber. A KRA score under 75% is amber only when a score has been entered. A blank KRA is not scored.
            </p>
            <p className="text-sm text-steel-muted mt-2">
              Subjects marked Portal are counted from this project's records on every refresh. All other subjects are typed on Subject data.
            </p>
          </Card>
        </>
      )}

      {tab !== "dashboard" && tab !== "kpi-dashboard" && (
        <ReferenceSheetToolbar
          sheetLabel={currentSheet}
          rowCount={
            tab === "findings"
              ? data?.findings?.length
              : tab === "subjects" || tab === "iso-map"
                ? subjects.length
                : tab === "role-kra"
                  ? kras.length
                  : tab === "trend"
                    ? weeks.length
                    : checklist.length
          }
          canEdit={canEdit}
          onAddRow={
            !canEdit
              ? undefined
              : tab === "findings"
                ? () => openFinding()
                : tab === "subjects"
                  ? () => setSubjectModalOpen(true)
                  : tab === "trend"
                    ? () => setTrendModalOpen(true)
                    : tab === "role-kra"
                      ? () => setKraModalOpen(true)
                      : checklistTab
                        ? () => setChecklistModalOpen(true)
                        : undefined
          }
          onUpload={canEdit && tab !== "trend" && tab !== "iso-map" ? uploadSheet : undefined}
          uploadHint="Upload SITE_AUDIT_Pack.xlsx or MASTER_KPI_DASHBOARD.xlsx. Existing scores and typed figures are kept."
          onDownloadCsv={() => {
            if (tab === "findings") dl("csv", "findings");
            else if (tab === "subjects") dl("csv", "subjects");
            else if (sectionForTab(tab)) dl("csv", tab);
          }}
          onDownloadXlsx={() => {
            if (tab === "findings") dl("xlsx", "findings");
            else if (tab === "subjects") dl("xlsx", "subjects");
            else if (tab === "role-kra") dl("xlsx", "role-kra");
            else if (sectionForTab(tab)) dl("xlsx", tab);
          }}
          busy={busy}
          message={msg}
        />
      )}

      {tab === "findings" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="shrink-0 mb-2">
            <Select value={findingAuditFilter} onChange={(e) => setFindingAuditFilter(e.target.value)}>
              <option value="">All audits</option>
              {audits.map((row) => (
                <option key={row.id} value={row.id}>{row.auditRef || row.id}</option>
              ))}
            </Select>
          </div>
          <RegisterSheetFrame title="Audit findings register" sheetLabel={currentSheet} rowCount={allFindings.length} className="flex-1 min-h-0">
            <table className="sheet-register__table min-w-[72rem]">
              <thead>
                <tr>
                  {["#", "Audit ref", "Ref", "Source", "Location", "Finding", "Severity", "Status", "Owner", "Target", "Days open", "Overdue", ""].map((h) => (
                    <th key={h || "edit"}>{h ? formatUiText(h) : ""}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFindings.filter((f) => !findingAuditFilter || f.siteAuditId === findingAuditFilter).map((f: any) => (
                  <tr key={f.id}>
                    <td>{f.srNo}</td>
                    <td>{f.siteAudit?.auditRef || "-"}</td>
                    <td>{f.findingNo}</td>
                    <td>{f.source}</td>
                    <td className="wrap">{f.folderLocation}</td>
                    <td className="wrap">{f.description}</td>
                    <td><Badge tone={f.severity === "Critical" ? "danger" : "neutral"}>{f.severity}</Badge></td>
                    <td>{f.status}</td>
                    <td>{f.owner}</td>
                    <td>{dateInput(f.dueDate)}</td>
                    <td>{f.daysOpen ?? "-"}</td>
                    <td>{f.overdue || "-"}</td>
                    <td>{canEdit && <Button type="button" variant="secondary" onClick={() => openFinding(f)}>Edit</Button>}</td>
                  </tr>
                ))}
                {!allFindings.length && <RegisterEmptyRow colSpan={13} />}
              </tbody>
            </table>
          </RegisterSheetFrame>
        </div>
      )}

      {tab === "site-walk" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
          <RegisterSheetFrame title="Site walk inspection" sheetLabel={currentSheet} rowCount={checklist.length} className="flex-1 min-h-0">
            <table className="sheet-register__table min-w-[64rem]">
              <thead>
                <tr>
                  {["#", "What to look at", "Location checked", "Observed", "Score", "Photo ref", "Finding ref", "Evidence"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleChecklist.map((row) => (
                  <tr key={`${row.id}-${row.updatedAt}`}>
                    <td>{row.itemNo}</td>
                    <td className="wrap">
                      {row.detail?.walkSection && <div className="text-xs text-steel-muted">{row.detail.walkSection}</div>}
                      {row.prompt}
                    </td>
                    <td>{cell(row.locationChecked || "", (v) => saveChecklist(row.id, { locationChecked: v }))}</td>
                    <td>{cell(row.observed || "", (v) => saveChecklist(row.id, { observed: v }))}</td>
                    <td>{scoreControl(row, "SiteWalk")}</td>
                    <td>{row.photoRef || "-"}</td>
                    <td>{findingRefControl(row, "SiteWalk")}</td>
                    <td>
                      {row.evidenceUrl && (
                        <a className="text-brand text-xs mr-2" href={row.evidenceUrl} target="_blank" rel="noreferrer">
                          {formatUiText("Open")}
                        </a>
                      )}
                      {canEdit && (
                        <Button type="button" variant="secondary" onClick={() => { setEvidenceFor(row); setEvidenceFile(null); setEvidenceError(""); }}>
                          Upload evidence
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!checklist.length && <RegisterEmptyRow colSpan={8} />}
              </tbody>
            </table>
          </RegisterSheetFrame>
        </div>
      )}

      {tab === "folder-sample" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden gap-3">
          <Card className="p-4 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="font-medium">{formatUiText("Folders and files on this project")}</h3>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const sug = await api<{ suggestions: any[]; notice?: string | null }>(`/api/audit-kpi/project/${id}/drive-suggestions?refresh=1`, { token });
                    setSuggestions(sug.suggestions || []);
                    setDriveNotice(sug.notice || "");
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Refresh from SharePoint
              </Button>
            </div>
            {driveNotice && <p className="text-sm text-steel-muted mb-2">{driveNotice}</p>}
            <p className="text-xs text-steel-muted mb-3">Accept a folder or file into the sample register. A sampled folder with no files is flagged. Nothing is scored until you enter 2, 1, 0, or N/A.</p>
            <div className="max-h-48 overflow-auto">
              <table className="sheet-register__table min-w-[40rem]">
                <thead>
                  <tr>
                    {["Kind", "Area", "Name", "Files", "Newest", "Sample", ""].map((h) => (
                      <th key={h || "act"}>{h ? formatUiText(h) : ""}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suggestions.filter((s) => s.kind === "folder" || s.emptyInSharePoint || !s.accepted).slice(0, 60).map((s) => (
                    <tr key={`${s.kind}-${s.path}`}>
                      <td>{s.kind}</td>
                      <td className="wrap">{s.area}</td>
                      <td className="wrap">
                        {s.kind === "file" && s.url ? (
                          <a className="text-brand" href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
                        ) : s.name}
                        {s.emptyInSharePoint ? <div className="text-xs text-steel-muted">Empty in SharePoint</div> : null}
                      </td>
                      <td>{s.fileCount ?? "-"}</td>
                      <td>{s.newestAt ? dateInput(s.newestAt) : "-"}</td>
                      <td>{s.sampleMatch ? "Sampled" : "-"}</td>
                      <td>{canEdit && <Button type="button" variant="secondary" disabled={busy} onClick={() => void acceptSuggestion(s)}>Accept</Button>}</td>
                    </tr>
                  ))}
                  {!suggestions.length && <RegisterEmptyRow colSpan={7} />}
                </tbody>
              </table>
            </div>
          </Card>
          <RegisterSheetFrame title="Folder sampling" sheetLabel={currentSheet} rowCount={checklist.length} className="flex-1 min-h-0">
            <table className="sheet-register__table min-w-[80rem]">
              <thead>
                <tr>
                  {["#", "Area", "Folder", "Custodian", "Subject", "Sample to take", "Sampled", "Defects", "Score", "Finding ref"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleChecklist.map((row) => (
                  <tr key={`${row.id}-${row.updatedAt}`}>
                    <td>{row.itemNo}</td>
                    <td>{row.detail?.area || row.detail?.areaName}</td>
                    <td className="wrap">{row.detail?.folder}</td>
                    <td>{row.detail?.custodian}</td>
                    <td className="wrap">{row.prompt}</td>
                    <td className="wrap">{row.detail?.sampleToTake}</td>
                    <td>{cell(row.detail?.sampled || "", (v) => saveChecklist(row.id, { detail: { sampled: v } }))}</td>
                    <td>{cell(row.detail?.defects || "", (v) => saveChecklist(row.id, { detail: { defects: v } }))}</td>
                    <td>{scoreControl(row, "FolderSample")}</td>
                    <td>{findingRefControl(row, "FolderSample")}</td>
                  </tr>
                ))}
                {!checklist.length && <RegisterEmptyRow colSpan={10} />}
              </tbody>
            </table>
          </RegisterSheetFrame>
        </div>
      )}

      {tab === "dc-interview" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
          <RegisterSheetFrame title="Document controller interview" sheetLabel={currentSheet} rowCount={checklist.length} className="flex-1 min-h-0">
            <table className="sheet-register__table min-w-[56rem]">
              <thead>
                <tr>
                  {["#", "Question", "Answer given", "Evidence shown", "Follow up"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checklist.map((row) => (
                  <tr key={`${row.id}-${row.updatedAt}`}>
                    <td>{row.itemNo}</td>
                    <td className="wrap">
                      {row.detail?.questionGroup && <div className="text-xs text-steel-muted">{row.detail.questionGroup}</div>}
                      {row.prompt}
                    </td>
                    <td>{cell(row.observed || "", (v) => saveChecklist(row.id, { observed: v }))}</td>
                    <td>{cell(row.response || "", (v) => saveChecklist(row.id, { response: v }))}</td>
                    <td>{cell(row.notes || "", (v) => saveChecklist(row.id, { notes: v }))}</td>
                  </tr>
                ))}
                {!checklist.length && <RegisterEmptyRow colSpan={5} />}
              </tbody>
            </table>
          </RegisterSheetFrame>
        </div>
      )}

      {tab === "plan" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-auto gap-4">
          {[
            ["PlanDesk", "Before you go"],
            ["PlanDay", "The day"],
            ["PlanAfter", "After the audit"],
          ].map(([section, title]) => {
            const rows = checklist.filter((row) => row.section === section);
            return (
              <RegisterSheetFrame key={section} title={title} sheetLabel="PLAN" rowCount={rows.length}>
                <table className="sheet-register__table min-w-[48rem]">
                  <thead>
                    <tr>
                      {(section === "PlanDay" ? ["Time", "Activity", "What you are testing", "Sheet", "Done"] : ["When", "Do this", "Why it matters", "Done", "Notes"]).map((h) => (
                        <th key={h}>{formatUiText(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.id}-${row.updatedAt}`}>
                        <td>{row.detail?.when}</td>
                        <td className="wrap">{row.prompt}</td>
                        <td className="wrap">{section === "PlanDay" ? row.detail?.testing : row.detail?.why}</td>
                        {section === "PlanDay" ? <td>{row.detail?.sheetRef}</td> : (
                          <td>
                            {canEdit ? (
                              <Select value={row.response || ""} onChange={(e) => void saveChecklist(row.id, { response: e.target.value })}>
                                <option value="">—</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </Select>
                            ) : (
                              row.response || "—"
                            )}
                          </td>
                        )}
                        <td>
                          {section === "PlanDay" ? (
                            canEdit ? (
                              <Select value={row.response || ""} onChange={(e) => void saveChecklist(row.id, { response: e.target.value })}>
                                <option value="">—</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </Select>
                            ) : (
                              row.response || "—"
                            )
                          ) : (
                            cell(row.notes || "", (v) => saveChecklist(row.id, { notes: v }))
                          )}
                        </td>
                      </tr>
                    ))}
                    {!rows.length && <RegisterEmptyRow colSpan={5} />}
                  </tbody>
                </table>
              </RegisterSheetFrame>
            );
          })}
        </div>
      )}

      {tab === "subjects" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="shrink-0 mb-2">
            <Select value={kraFilter} onChange={(e) => setKraFilter(e.target.value)}>
              <option value="">All KRA</option>
              <option value="unscored">KRA not scored</option>
            </Select>
          </div>
          {!subjects.length && <p className="text-sm text-steel-muted mb-2">No rows. Click Reload missing template rows.</p>}
          <RegisterSheetFrame title="KPI subject data" sheetLabel={currentSheet} rowCount={subjects.length} className="flex-1 min-h-0">
            <table className="sheet-register__table min-w-[80rem]">
              <thead>
                <tr>
                  {["#", "ISO area", "Folder", "Subject", "Custodian", "Source", "Records", "Open", "Closed", "Overdue", "Oldest open", "KRA %", "% closed", "RAG"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subjects.filter((s) => kraFilter !== "unscored" || s.kraScore == null).map((s) => {
                  const portal = String(s.dataSource || "").startsWith("portal:");
                  const figure = (value: string, onSave: (v: string) => void) =>
                    portal || !canEdit ? <span>{value || "0"}</span> : cell(value, onSave, { type: "number" });
                  return (
                  <tr key={`${s.id}-${s.updatedAt}`}>
                    <td>{s.srNo}</td>
                    <td className="wrap">{s.isoArea}</td>
                    <td className="wrap">{s.folder}</td>
                    <td className="wrap">{s.name}</td>
                    <td>{s.custodian}</td>
                    <td>{sourceLabel(s.dataSource)}</td>
                    <td>{figure(String(s.recordsCount ?? 0), (v) => patchSubject(s.id, { recordsCount: v }))}</td>
                    <td>{figure(String(s.openCount ?? 0), (v) => patchSubject(s.id, { openCount: v }))}</td>
                    <td>{figure(String(s.closedCount ?? 0), (v) => patchSubject(s.id, { closedCount: v }))}</td>
                    <td>{figure(String(s.overdueCount ?? 0), (v) => patchSubject(s.id, { overdueCount: v }))}</td>
                    <td>{figure(s.oldestOpenDays == null ? "" : String(s.oldestOpenDays), (v) => patchSubject(s.id, { oldestOpenDays: v }))}</td>
                    <td>
                      {s.kraScore == null && <div className="text-xs text-steel-muted">Not scored</div>}
                      {canEdit ? cell(kraInput(s.kraScore), (v) => patchSubject(s.id, { kraScore: v })) : kraInput(s.kraScore) || "Not scored"}
                    </td>
                    <td>{pct(s.pctClosed)}</td>
                    <td><Badge tone={ragTone(s.rag)}>{s.rag}</Badge></td>
                  </tr>
                  );
                })}
                {!subjects.length && <RegisterEmptyRow colSpan={14} />}
              </tbody>
            </table>
          </RegisterSheetFrame>
        </div>
      )}

      {tab === "iso-map" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
          <RegisterSheetFrame title="ISO folder map" sheetLabel={currentSheet} rowCount={subjects.length} className="flex-1 min-h-0">
            <table className="sheet-register__table min-w-[56rem]">
              <thead>
                <tr>
                  {["ISO area", "Folder", "ISO clause", "Custodian", "Subject", "RAG"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td className="wrap">{s.isoArea}</td>
                    <td className="wrap">{s.folder}</td>
                    <td>{s.isoClause}</td>
                    <td>{s.custodian}</td>
                    <td className="wrap">{s.name}</td>
                    <td><Badge tone={ragTone(s.rag)}>{s.rag}</Badge></td>
                  </tr>
                ))}
                {!subjects.length && <RegisterEmptyRow colSpan={6} />}
              </tbody>
            </table>
          </RegisterSheetFrame>
        </div>
      )}

      {tab === "trend" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden gap-3">
          <Card className="p-4 shrink-0">
            <LineChart
              title="Overdue and percent closed"
              items={weeks.map((w) => ({
                label: String(w.weekEnding || "").slice(5),
                overdue: w.overdueCount || 0,
                pctClosed: Math.round((Number(w.pctClosed) || 0) * (Number(w.pctClosed) > 1 ? 1 : 100)),
              }))}
              series={[
                { key: "overdue", label: "Overdue", color: "#C0352B" },
                { key: "pctClosed", label: "% closed", color: "#0F766E" },
              ]}
              emptyText="Capture this week to start the trend."
            />
          </Card>
          <RegisterSheetFrame title="Weekly trend log" sheetLabel={currentSheet} rowCount={weeks.length} className="flex-1 min-h-0">
            <table className="sheet-register__table min-w-[64rem]">
              <thead>
                <tr>
                  {["Week ending", "Source", "Records", "Open", "Closed", "% closed", "Overdue", "Subjects red", "KRA score", "Oldest open", "Not yet used", "Movement in overdue", "Comment"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.id}>
                    <td>{w.weekEnding}</td>
                    <td>{w.source === "auto" ? "Auto" : "Typed"}</td>
                    <td>{w.recordsCount ?? "-"}</td>
                    <td>{w.openCount ?? "-"}</td>
                    <td>{w.closedCount ?? "-"}</td>
                    <td>{pct(w.pctClosed)}</td>
                    <td>{w.overdueCount ?? "-"}</td>
                    <td>{w.subjectsRed ?? "-"}</td>
                    <td>{w.kraScore == null ? "Not scored" : pct(w.kraScore)}</td>
                    <td>{w.oldestOpenDays ?? "-"}</td>
                    <td>{w.notYetUsed ?? "-"}</td>
                    <td>{w.movement ?? "-"}</td>
                    <td className="wrap">{w.comment}</td>
                  </tr>
                ))}
                {!weeks.length && <RegisterEmptyRow colSpan={13} />}
              </tbody>
            </table>
          </RegisterSheetFrame>
        </div>
      )}

      {tab === "role-kra" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden gap-3">
          {!kras.length && <p className="text-sm text-steel-muted">No rows. Click Reload missing template rows.</p>}
          <p className="text-sm text-steel-muted shrink-0">Score each KRA 1 to 5; the role passes at an average of 3.5.</p>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 shrink-0">
            {roles.map((role) => (
              <Card key={role.roleKey} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{role.roleKey}</p>
                  <Badge tone={ragTone(role.result)}>{role.result}</Badge>
                </div>
                <p className="text-xs text-steel-muted mt-2">Holder: {role.holder || "-"}</p>
                <p className="text-xs text-steel-muted">Subjects owned: {role.subjectCount}. Red-rated: {role.redCount}.</p>
                <p className="text-xs text-steel-muted">Avg KRA (subjects): {role.subjectKraScored ? pct(role.avgKra) : "Not scored"}</p>
                <p className="text-sm mt-1">KRA average (1-5): {role.kraAverage == null ? "Not scored" : Math.round(role.kraAverage * 10) / 10} ({role.kraScored} of {role.kraLines})</p>
              </Card>
            ))}
          </div>
          <RegisterSheetFrame title="Role KRA matrix" sheetLabel={currentSheet} rowCount={kras.length} className="flex-1 min-h-0">
            <table className="sheet-register__table min-w-[64rem]">
              <thead>
                <tr>
                  {["Role", "Line", "What good looks like", "Target / consequence", "Holder", "Self", "Reviewer", "Score / actual", "RAG", "Subjects", "Red"].map((h) => (
                    <th key={h}>{formatUiText(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kras.map((k) => (
                  <tr key={`${k.id}-${k.updatedAt}`}>
                    <td>{k.roleKey}</td>
                    <td>{k.kraNo}</td>
                    <td className="wrap">{k.description}</td>
                    <td className="wrap">{k.target || k.consequence}</td>
                    <td>{k.lineKind === "owns" ? cell(k.holder || "", (v) => api(`/api/audit-kpi/role-kra/${k.id}`, { token, method: "PATCH", body: JSON.stringify({ holder: v }) }).then(() => load())) : k.holder}</td>
                    <td>{k.lineKind === "kra" && canEdit ? (
                      <Select value={k.selfScore || ""} onChange={(e) => void api(`/api/audit-kpi/role-kra/${k.id}`, { token, method: "PATCH", body: JSON.stringify({ selfScore: e.target.value }) }).then(() => load())}>
                        <option value="">Blank</option>
                        {["1", "2", "3", "4", "5"].map((n) => <option key={n}>{n}</option>)}
                      </Select>
                    ) : k.lineKind === "kra" ? (k.selfScore || "-") : "-"}</td>
                    <td>{k.lineKind === "kra" && canEdit ? (
                      <Select value={k.reviewerScore || ""} onChange={(e) => void api(`/api/audit-kpi/role-kra/${k.id}`, { token, method: "PATCH", body: JSON.stringify({ reviewerScore: e.target.value }) }).then(() => load())}>
                        <option value="">Blank</option>
                        {["1", "2", "3", "4", "5"].map((n) => <option key={n}>{n}</option>)}
                      </Select>
                    ) : k.lineKind === "kra" ? (k.reviewerScore || "-") : "-"}</td>
                    <td>
                      {k.lineKind === "kra"
                        ? (k.score || "-")
                        : k.lineKind === "kpi"
                          ? cell(k.actual || "", (v) => api(`/api/audit-kpi/role-kra/${k.id}`, { token, method: "PATCH", body: JSON.stringify({ actual: v }) }).then(() => load()))
                          : (k.subjectKraScored ? pct(k.avgKra) : "Not scored")}
                    </td>
                    <td>
                      {k.lineKind === "kpi" && k.ragAutomatic
                        ? <Badge tone={ragTone(k.periodRag)}>{k.periodRag}</Badge>
                        : k.lineKind === "kpi"
                          ? cell(k.periodRag || "", (v) => api(`/api/audit-kpi/role-kra/${k.id}`, { token, method: "PATCH", body: JSON.stringify({ periodRag: v }) }).then(() => load()))
                          : "-"}
                    </td>
                    <td>{k.subjectCount}</td>
                    <td>{k.redCount}</td>
                  </tr>
                ))}
                {!kras.length && <RegisterEmptyRow colSpan={11} />}
              </tbody>
            </table>
          </RegisterSheetFrame>
        </div>
      )}

      <RegisterEntryModal open={findingModalOpen} title={linkChecklistId ? "Raise finding" : findingEditId ? "Edit finding" : "Add finding"} onClose={() => { setFindingModalOpen(false); setLinkChecklistId(null); }} onSave={saveFinding} saving={busy} size="xl">
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Finding")}</span>
          <TextArea value={findingForm.description} onChange={(e) => setFindingForm({ ...findingForm, description: e.target.value })} required />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Source")}</span>
            <Select value={findingForm.source} onChange={(e) => setFindingForm({ ...findingForm, source: e.target.value })}>
              {["Site walk", "Folder sample", "DC interview"].map((v) => <option key={v}>{v}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Severity")}</span>
            <Select value={findingForm.severity} onChange={(e) => setFindingForm({ ...findingForm, severity: e.target.value })}>
              {["Critical", "Major", "Minor", "Observation"].map((v) => <option key={v}>{v}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Status")}</span>
            <Select value={findingForm.status} onChange={(e) => setFindingForm({ ...findingForm, status: e.target.value })}>
              {["Open", "Under Rectification", "Closed"].map((v) => <option key={v}>{v}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Ref no")}</span>
            <Input value={findingForm.refNo} onChange={(e) => setFindingForm({ ...findingForm, refNo: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Folder / location")}</span>
            <Input value={findingForm.folderLocation} onChange={(e) => setFindingForm({ ...findingForm, folderLocation: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Photo ref")}</span>
            <Input value={findingForm.photoRef} onChange={(e) => setFindingForm({ ...findingForm, photoRef: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Owner")}</span>
            <Input value={findingForm.owner} onChange={(e) => setFindingForm({ ...findingForm, owner: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Verified by")}</span>
            <Input value={findingForm.verifiedBy} onChange={(e) => setFindingForm({ ...findingForm, verifiedBy: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Target date")}</span>
            <Input type="date" value={findingForm.dueDate} onChange={(e) => setFindingForm({ ...findingForm, dueDate: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">{formatUiText("Closed on")}</span>
            <Input type="date" value={findingForm.closedAt} onChange={(e) => setFindingForm({ ...findingForm, closedAt: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-steel-muted">{formatUiText("KPI subject code")}</span>
            <Input value={findingForm.subjectCode} onChange={(e) => setFindingForm({ ...findingForm, subjectCode: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Root cause")}</span>
          <TextArea value={findingForm.rootCause} onChange={(e) => setFindingForm({ ...findingForm, rootCause: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Corrective action")}</span>
          <TextArea value={findingForm.correctiveAction} onChange={(e) => setFindingForm({ ...findingForm, correctiveAction: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Preventive action")}</span>
          <TextArea value={findingForm.preventiveAction} onChange={(e) => setFindingForm({ ...findingForm, preventiveAction: e.target.value })} />
        </label>
      </RegisterEntryModal>

      <RegisterEntryModal open={subjectModalOpen} title="Add subject" onClose={() => setSubjectModalOpen(false)} onSave={saveSubject} saving={busy} size="xl">
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("ISO area")}</span>
          <Select value={subjectForm.isoArea} onChange={(e) => setSubjectForm({ ...subjectForm, isoArea: e.target.value })}>
            {ISO_AREAS.map((v) => <option key={v}>{v}</option>)}
          </Select>
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Subject name")}</span>
          <Input value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Folder")}</span>
          <Input value={subjectForm.folder} onChange={(e) => setSubjectForm({ ...subjectForm, folder: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Custodian")}</span>
          <Select value={subjectForm.custodian} onChange={(e) => setSubjectForm({ ...subjectForm, custodian: e.target.value })}>
            {["HO", "SITE", "BOTH"].map((v) => <option key={v}>{v}</option>)}
          </Select>
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          {([
            ["recordsCount", "Records"],
            ["openCount", "Open"],
            ["closedCount", "Closed"],
            ["overdueCount", "Overdue"],
            ["oldestOpenDays", "Oldest open days"],
            ["kraScore", "KRA percent"],
          ] as const).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs text-steel-muted">{formatUiText(label)}</span>
              <Input value={subjectForm[key]} onChange={(e) => setSubjectForm({ ...subjectForm, [key]: e.target.value })} />
            </label>
          ))}
        </div>
      </RegisterEntryModal>

      <RegisterEntryModal open={checklistModalOpen} title="Add row" onClose={() => setChecklistModalOpen(false)} onSave={saveChecklistRow} saving={busy} size="xl">
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText(tab === "folder-sample" ? "Subject" : "Prompt")}</span>
          <TextArea value={checklistForm.prompt} onChange={(e) => setChecklistForm({ ...checklistForm, prompt: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText(tab === "folder-sample" ? "Folder" : "Location")}</span>
          <Input value={checklistForm.locationChecked} onChange={(e) => setChecklistForm({ ...checklistForm, locationChecked: e.target.value })} />
        </label>
      </RegisterEntryModal>

      <RegisterEntryModal open={trendModalOpen} title="Add trend week" onClose={() => setTrendModalOpen(false)} onSave={saveTrend} saving={busy} size="xl">
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Week ending")}</span>
          <Input type="date" value={trendForm.weekEnding} onChange={(e) => setTrendForm({ ...trendForm, weekEnding: e.target.value })} required />
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          {([
            ["recordsCount", "Records"],
            ["openCount", "Open"],
            ["closedCount", "Closed"],
            ["pctClosed", "Percent closed"],
            ["overdueCount", "Overdue"],
            ["subjectsRed", "Subjects red"],
            ["kraScore", "KRA percent"],
            ["oldestOpenDays", "Oldest open days"],
            ["notYetUsed", "Not yet used"],
          ] as const).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs text-steel-muted">{formatUiText(label)}</span>
              <Input value={trendForm[key]} onChange={(e) => setTrendForm({ ...trendForm, [key]: e.target.value })} />
            </label>
          ))}
        </div>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Comment")}</span>
          <TextArea value={trendForm.comment} onChange={(e) => setTrendForm({ ...trendForm, comment: e.target.value })} />
        </label>
      </RegisterEntryModal>

      <RegisterEntryModal open={kraModalOpen} title="Add KRA line" onClose={() => setKraModalOpen(false)} onSave={saveKra} saving={busy}>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Role")}</span>
          <Input value={kraForm.roleKey} onChange={(e) => setKraForm({ ...kraForm, roleKey: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Line")}</span>
          <Input value={kraForm.kraNo} placeholder="KRA1 or K1" onChange={(e) => setKraForm({ ...kraForm, kraNo: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Description")}</span>
          <TextArea value={kraForm.description} onChange={(e) => setKraForm({ ...kraForm, description: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">{formatUiText("Kind")}</span>
          <Select value={kraForm.lineKind} onChange={(e) => setKraForm({ ...kraForm, lineKind: e.target.value })}>
            <option value="kra">KRA</option>
            <option value="kpi">KPI</option>
          </Select>
        </label>
      </RegisterEntryModal>

      <UploadModal
        open={Boolean(evidenceFor)}
        title="Upload site walk evidence"
        context={evidenceFor ? `Check ${evidenceFor.itemNo} · filed under the audit programme folder` : undefined}
        file={evidenceFile}
        onFile={setEvidenceFile}
        accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx"
        filePicker={
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-xs text-steel-muted">{formatUiText("Take a photo")}</span>
              <input
                className="mt-1 block w-full text-sm"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-steel-muted">{formatUiText("Or choose a file")}</span>
              <input
                className="mt-1 block w-full text-sm"
                type="file"
                accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
              />
            </label>
            {evidenceFile && <p className="text-xs text-steel-muted">{evidenceFile.name}</p>}
          </div>
        }
        fields={[]}
        primaryLabel="Upload evidence"
        busy={busy}
        error={evidenceError}
        onClose={() => { setEvidenceFor(null); setEvidenceFile(null); setEvidenceError(""); }}
        onSubmit={submitEvidence}
      />
    </div>
  );
}
