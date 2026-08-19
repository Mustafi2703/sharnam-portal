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
  const [busy, setBusy] = useState(false);

  const canCreate = !!user && user.role !== "client";
  const formRef = registerFormRefForTab(tab);
  const formKind = kindForRegisterTab(tab === "hse-register" ? "safety-ir" : tab);

  const load = async () => {
    const kinds = INSPECTION_KINDS.join(",");
    const [payload, u] = await Promise.all([
      api<any>(`/api/rfis/project/${id}?kind=${kinds}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
    ]);
    const list = Array.isArray(payload) ? payload : payload.rfis || [];
    setRows(list);
    setUsers(u);
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

  const selected = rows.find((r) => r.id === active);

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
        subtitle="SPDC Request for Inspection, Safety clearance, and Activity checklists — registers maintained live. Drawing references are text-only; use Drawings → Ask (PMC RFI) for linked drawing files."
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
        <Link to={`/projects/${id}/rfis?kind=RequestForInformation`} className="text-brand underline">
          Drawings → RFI register
        </Link>
        <span className="text-steel-muted">·</span>
        <Link to={`/projects/${id}/rfis?kind=QualityInspection`} className="text-brand underline">
          Request QI checklist fill
        </Link>
        <span className="text-steel-muted">·</span>
        <Link to={`/projects/${id}/rfis?kind=SafetyChecklist`} className="text-brand underline">
          Safety checklist fill
        </Link>
      </div>

      {tab !== "hse-register" && canCreate && (
        <SpdcInspectionFormPanel
          formKind={formKind}
          users={users}
          qualityIrOptions={tab === "safety-ir" ? qualityIrOptions : []}
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
        </Card>
      )}

      <p className="text-[10px] text-steel-muted">
        Templates: {QUALITY_IR_FORM.workbook} · {SAFETY_IR_FORM.workbook} · {ACTIVITY_CHECKLIST_FORM.workbook}
      </p>
    </div>
  );
}
