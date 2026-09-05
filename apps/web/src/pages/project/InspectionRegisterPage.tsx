import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import { InspectionRegisterTable, registerFormRefForTab } from "../../components/InspectionRegisterTable";
import { SpdcInspectionFormPanel } from "../../components/SpdcInspectionFormPanel";
import {
  ACTIVITY_CHECKLIST_FORM,
  HSE_REGISTER_REF,
  INSPECTION_KINDS,
  QUALITY_IR_FORM,
  SAFETY_IR_FORM,
  kindForRegisterTab,
  parseFormDataJson,
  type InspectionRegisterTab,
} from "../../lib/inspectionRequestForms";
import { openChecklistFillWindow } from "../../lib/checklistFillWindow";

const TABS: { key: InspectionRegisterTab; label: string; doc: string }[] = [
  { key: "quality-ir", label: "Quality IR (F-01)", doc: "SPDC/QA/F-01" },
  { key: "safety-ir", label: "Safety IR (F-01)", doc: "SPDC/HSE/F-01" },
  { key: "activity-checklist", label: "Activity checklist (F-02)", doc: "SPDC/QA/F-02" },
  { key: "hse-register", label: "HSE register", doc: "HSE Register" },
];

function tabFromSearch(search: URLSearchParams): InspectionRegisterTab {
  const t = search.get("tab");
  if (t === "safety-ir" || t === "activity-checklist" || t === "hse-register") return t;
  return "quality-ir";
}

/** Dedicated inspection register — SPDC quality IR, safety IR, activity checklists, HSE register. */
export default function InspectionRegisterPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromSearch(searchParams);
  const { token, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [qiAssignments, setQiAssignments] = useState<any[]>([]);
  const [safetyAssignments, setSafetyAssignments] = useState<any[]>([]);
  const [activityAssignments, setActivityAssignments] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const canCreate = !!user && user.role !== "client";
  const formRef = registerFormRefForTab(tab);
  const formKind = kindForRegisterTab(tab === "hse-register" ? "safety-ir" : tab);

  const load = async () => {
    const kinds = INSPECTION_KINDS.join(",");
    const [payload, u, qi, saf, act] = await Promise.all([
      api<any>(`/api/rfis/project/${id}?kind=${kinds}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=QualityInspection`, { token }).catch(() => ({
        assignments: [],
      })),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=Safety`, { token }).catch(() => ({ assignments: [] })),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=ActivityInspection`, { token }).catch(() => ({
        assignments: [],
      })),
    ]);
    const list = Array.isArray(payload) ? payload : payload.rfis || [];
    setRows(list);
    setUsers(u);
    setQiAssignments(qi.assignments || []);
    setSafetyAssignments(saf.assignments || []);
    setActivityAssignments(act.assignments || []);
    if (!active && list[0]) setActive(list[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = useMemo(() => {
    if (tab === "hse-register") {
      return rows.filter((r) => r.rfiKind === "SafetyIR");
    }
    const kind = kindForRegisterTab(tab);
    return rows.filter((r) => r.rfiKind === kind);
  }, [rows, tab]);

  const qualityIrOptions = useMemo(
    () =>
      rows
        .filter((r) => r.rfiKind === "QualityIR")
        .map((r) => {
          const f = parseFormDataJson(r.formDataJson);
          const no = r.irNumber || f.irNumber || r.number;
          return { number: no, label: `${no} — ${f.activityDescription || r.subject}` };
        }),
    [rows],
  );

  const tabChecklist = useMemo(() => {
    if (tab === "safety-ir" || tab === "hse-register") {
      return {
        assignments: safetyAssignments,
        family: "Safety",
        master: `/projects/${id}/safety/checklist-master`,
        logs: `/projects/${id}/safety/checklist-logs`,
      };
    }
    if (tab === "activity-checklist") {
      return {
        assignments: activityAssignments,
        family: "ActivityInspection",
        master: `/projects/${id}/inspection/checklist-master`,
        logs: `/projects/${id}/inspection/checklist-logs`,
      };
    }
    return {
      assignments: qiAssignments,
      family: "QualityInspection",
      master: `/projects/${id}/quality/checklist-master`,
      logs: `/projects/${id}/quality/checklist-logs`,
    };
  }, [tab, qiAssignments, safetyAssignments, activityAssignments, id]);

  const selected = rows.find((r) => r.id === active);

  const checklistByRowId = useMemo(() => {
    const nameByAssignment = new Map<string, string>();
    for (const a of [...qiAssignments, ...safetyAssignments, ...activityAssignments]) {
      nameByAssignment.set(a.id, a.template?.name || a.id);
    }
    const out: Record<string, string> = {};
    for (const r of filtered) {
      if (r.linkedAssignmentId) {
        out[r.id] = nameByAssignment.get(r.linkedAssignmentId) || "Linked checklist";
      }
    }
    return out;
  }, [filtered, qiAssignments, safetyAssignments, activityAssignments]);

  function setTab(next: InspectionRegisterTab) {
    setSearchParams({ tab: next }, { replace: true });
  }

  async function raiseEntry(payload: {
    subject: string;
    question: string;
    rfiKind: string;
    irNumber: string;
    formDataJson: Record<string, string>;
    assignedToId: string;
    linkedAssignmentId: string;
  }) {
    setBusy(true);
    try {
      await api(`/api/rfis/project/${id}`, {
        method: "POST",
        token,
        body: JSON.stringify({
          subject: payload.subject,
          question: payload.question,
          rfiKind: payload.rfiKind,
          irNumber: payload.irNumber || null,
          formDataJson: payload.formDataJson,
          assignedToId: payload.assignedToId || null,
          linkedAssignmentId: payload.linkedAssignmentId || null,
          linkedChecklistItemId:
            tabChecklist.assignments.find((a) => a.id === payload.linkedAssignmentId)?.template?.id || null,
          linkedDrawingId: null,
        }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        eyebrow="Inspection module"
        title="Inspection register"
        subtitle="Quality, Safety, and Activity inspections — pick the checklist from master, fill it, then the sheet-style report downloads when the fill is submitted."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              tab === t.key ? "bg-brand text-white border-brand" : "bg-white border-sand text-steel hover:border-brand/40"
            }`}
          >
            {t.label}
            <span className="ml-1 opacity-70 font-mono text-[10px]">{t.doc}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link to={tabChecklist.master} className="text-brand underline">
          Checklist master
        </Link>
        <span className="text-steel-muted">·</span>
        <Link to={tabChecklist.logs} className="text-brand underline">
          Fill log / reports
        </Link>
        <span className="text-steel-muted">·</span>
        <Link to={`/projects/${id}/rfis?kind=QualityInspection`} className="text-brand underline">
          Request QI fill
        </Link>
        <span className="text-steel-muted">·</span>
        <Link to={`/projects/${id}/rfis?kind=SafetyChecklist`} className="text-brand underline">
          Safety checklist fill
        </Link>
        <span className="text-steel-muted">·</span>
        <Link to={`/projects/${id}/rfis?kind=SiteExecution`} className="text-brand underline">
          Field checklist fill
        </Link>
        {tab === "activity-checklist" && (
          <>
            <span className="text-steel-muted">·</span>
            <Link to={`/projects/${id}/rfis?kind=ActivityInspection&compose=1`} className="text-brand underline">
              Request activity checklist fill
            </Link>
          </>
        )}
      </div>

      {tab !== "hse-register" && canCreate && (
        <SpdcInspectionFormPanel
          formKind={formKind}
          users={users}
          qualityIrOptions={tab === "safety-ir" ? qualityIrOptions : []}
          checklistAssignments={tabChecklist.assignments}
          masterHref={tabChecklist.master}
          onSubmit={raiseEntry}
          busy={busy}
        />
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-semibold">
              {tab === "hse-register" ? HSE_REGISTER_REF.title : `${formRef.title} register`}
            </h3>
            <p className="text-xs text-steel-muted mt-0.5">
              {filtered.length} entr{filtered.length === 1 ? "y" : "ies"} · Ref: {formRef.workbook}
            </p>
          </div>
          {tab === "hse-register" && canCreate && (
            <Button variant="secondary" className="!text-xs" onClick={() => setTab("safety-ir")}>
              Raise safety IR
            </Button>
          )}
        </div>
        <InspectionRegisterTable
          rows={filtered}
          formRef={tab === "hse-register" ? SAFETY_IR_FORM : formRef}
          variant={tab === "hse-register" ? "hse" : "register"}
          activeId={active}
          onSelect={setActive}
          checklistByRowId={tab === "hse-register" ? undefined : checklistByRowId}
        />
      </Card>

      {selected && (
        <Card className="!p-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge tone="brand">{selected.rfiKind}</Badge>
            <span className="font-mono text-sm">{selected.irNumber || selected.number}</span>
            <Badge tone={selected.status === "Open" ? "warn" : "ok"}>{selected.status}</Badge>
          </div>
          <h4 className="font-semibold">{selected.subject}</h4>
          <pre className="text-xs whitespace-pre-wrap mt-2 text-steel-muted max-h-48 overflow-y-auto">{selected.question}</pre>
          {selected.formDataJson && (
            <p className="text-[10px] text-steel-muted mt-2">
              Drawing ref (text): {parseFormDataJson(selected.formDataJson).drawingRef || "—"}
            </p>
          )}
          {selected.linkedAssignmentId && id && (
            <Button
              type="button"
              className="!text-sm mt-3"
              onClick={() => openChecklistFillWindow(id, selected.linkedAssignmentId, tabChecklist.family)}
            >
              Fill linked checklist →
            </Button>
          )}
        </Card>
      )}

      <p className="text-[10px] text-steel-muted">
        Templates: {QUALITY_IR_FORM.workbook} · {SAFETY_IR_FORM.workbook} · {ACTIVITY_CHECKLIST_FORM.workbook}
      </p>
    </div>
  );
}
