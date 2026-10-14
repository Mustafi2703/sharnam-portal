import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Button, Card, PageHeader } from "../../components/ui";
import { ReferenceSheetToolbar } from "../../components/ReferenceSheetToolbar";
import { ToolLink } from "../../components/ToolLink";
import { InspectionRegisterTable, registerFormRefForTab } from "../../components/InspectionRegisterTable";
import { SpdcInspectionFormPanel } from "../../components/SpdcInspectionFormPanel";
import { SpdcInspectionIrPanel } from "../../components/SpdcInspectionIrPanel";
import { RfiDeleteButton } from "../../components/RfiDeleteButton";
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
import { canonicalRfiKind, registerToolPath } from "../../lib/rfiModuleScope";

const ALL_TABS: { key: InspectionRegisterTab; label: string; doc: string; lock?: "quality" | "safety" }[] = [
  { key: "quality-ir", label: "Quality IR (F-01)", doc: "SPDC/QA/F-01", lock: "quality" },
  { key: "activity-checklist", label: "Activity checklist (F-02)", doc: "SPDC/QA/F-02", lock: "quality" },
  { key: "safety-ir", label: "Safety IR (F-01)", doc: "SPDC/HSE/F-01", lock: "safety" },
  { key: "hse-register", label: "HSE register", doc: "HSE Register", lock: "safety" },
];

function tabFromSearch(search: URLSearchParams): InspectionRegisterTab {
  const t = search.get("tab");
  if (t === "safety-ir" || t === "activity-checklist" || t === "hse-register") return t;
  return "quality-ir";
}

function lockFromSearch(search: URLSearchParams): "quality" | "safety" | null {
  const l = search.get("lock");
  if (l === "quality" || l === "safety") return l;
  return null;
}

/** Register tool for Quality / Safety — or overview when opened from Inspection hub. */
export default function InspectionRegisterPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const lockParam = lockFromSearch(searchParams);
  const tab = tabFromSearch(searchParams);
  const lock =
    lockParam ||
    (tab === "safety-ir" || tab === "hse-register"
      ? "safety"
      : tab === "quality-ir" || tab === "activity-checklist"
        ? "quality"
        : null);
  // Overview only when explicitly requested, or bare /inspection-register with no tab/lock.
  const overview =
    searchParams.get("overview") === "1" ||
    (!lockParam && searchParams.get("tab") == null && searchParams.get("overview") !== "0");
  const { token, user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [qiAssignments, setQiAssignments] = useState<any[]>([]);
  const [safetyAssignments, setSafetyAssignments] = useState<any[]>([]);
  const [activityAssignments, setActivityAssignments] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [project, setProject] = useState<any>(null);

  const canCreate = !!user && user.role !== "client";
  const formRef = registerFormRefForTab(tab);
  const formKind = kindForRegisterTab(tab === "hse-register" ? "safety-ir" : tab);

  const load = async () => {
    const kinds = INSPECTION_KINDS.join(",");
    const [payload, allUsers, contacts, qi, saf, act, proj] = await Promise.all([
      api<any>(`/api/rfis/project/${id}?kind=${kinds}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>(`/api/comms/contacts/${id}?kind=TECHNICAL`, { token }).catch(() =>
        api<any[]>(`/api/comms/contacts/${id}`, { token }).catch(() => [])
      ),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=QualityInspection`, { token }).catch(() => ({
        assignments: [],
      })),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=Safety`, { token }).catch(() => ({ assignments: [] })),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=ActivityInspection`, { token }).catch(() => ({
        assignments: [],
      })),
      api<any>(`/api/projects/${id}`, { token }).catch(() => null),
    ]);
    const list = Array.isArray(payload) ? payload : payload.rfis || [];
    setRows(list);

    const byId = new Map<string, { id: string; fullName: string; role?: string }>();
    for (const m of proj?.members || []) {
      const u = m.user;
      if (u?.id) byId.set(u.id, { id: u.id, fullName: u.fullName, role: m.role || u.role || "member" });
    }
    const contactList = Array.isArray(contacts) ? contacts : [];
    const emailToUser = new Map(
      (allUsers || [])
        .filter((u: any) => u.email)
        .map((u: any) => [String(u.email).trim().toLowerCase(), u] as const),
    );
    for (const c of contactList) {
      if (c.isSectionHeader || !c.email) continue;
      const u = emailToUser.get(String(c.email).trim().toLowerCase());
      if (u?.id && !byId.has(u.id)) {
        byId.set(u.id, {
          id: u.id,
          fullName: c.personName || u.fullName,
          role: `${c.orgSection || "Matrix"} · ${c.mailRole || "TO"}`,
        });
      }
    }
    // Fall back to all portal users if no project/matrix people resolved
    if (byId.size === 0) {
      for (const u of allUsers || []) {
        if (u?.id) byId.set(u.id, { id: u.id, fullName: u.fullName, role: u.role });
      }
    }
    setUsers(Array.from(byId.values()).sort((a, b) => a.fullName.localeCompare(b.fullName)));
    setQiAssignments(qi.assignments || []);
    setSafetyAssignments(saf.assignments || []);
    setActivityAssignments(act.assignments || []);
    setProject(proj);
    if (!active && list[0]) setActive(list[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = useMemo(() => {
    if (tab === "hse-register") {
      return rows.filter((r) => canonicalRfiKind(r.rfiKind) === "SafetyIR");
    }
    const kind = kindForRegisterTab(tab);
    return rows.filter((r) => canonicalRfiKind(r.rfiKind) === kind);
  }, [rows, tab]);

  // Deep-link `?rfi=` from overview / dashboard into the owning register row.
  useEffect(() => {
    const rfiId = searchParams.get("rfi");
    if (rfiId && rows.some((r) => r.id === rfiId)) setActive(rfiId);
  }, [searchParams, rows]);

  const qualityIrOptions = useMemo(
    () =>
      rows
        .filter((r) => canonicalRfiKind(r.rfiKind) === "QualityIR")
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
        master: `/projects/${id}/quality/site-checklist-master`,
        logs: `/projects/${id}/quality/site-checklist-logs`,
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
    const nextLock = ALL_TABS.find((t) => t.key === next)?.lock || lock;
    const q: Record<string, string> = { tab: next };
    if (nextLock) q.lock = nextLock;
    setSearchParams(q, { replace: true });
  }

  const visibleTabs = useMemo(() => {
    if (lock === "quality") return ALL_TABS.filter((t) => t.lock === "quality");
    if (lock === "safety") return ALL_TABS.filter((t) => t.lock === "safety");
    return ALL_TABS;
  }, [lock]);

  const openByStatus = useMemo(() => {
    const count = (kinds: string[]) =>
      rows.filter((r) => kinds.includes(canonicalRfiKind(r.rfiKind)) && /open|answer/i.test(String(r.status || ""))).length;
    const total = (kinds: string[]) => rows.filter((r) => kinds.includes(canonicalRfiKind(r.rfiKind))).length;
    return {
      quality: { open: count(["QualityIR"]), total: total(["QualityIR"]) },
      activity: { open: count(["ActivityInspection"]), total: total(["ActivityInspection"]) },
      safety: { open: count(["SafetyIR"]), total: total(["SafetyIR"]) },
    };
  }, [rows]);

  if (overview && id) {
    return (
      <div className="space-y-4 pb-8">
        <PageHeader
          eyebrow="Inspection overview"
          title="Inspection desk"
          subtitle="This table is an overview only. Raise, answer and close on the Quality or Safety registers — those are the real logs."
        />
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              title: "Quality — Request for Inspection (F-01)",
              meta: `${openByStatus.quality.open} open · ${openByStatus.quality.total} total`,
              href: registerToolPath(id, "quality-ir"),
              sheet: QUALITY_IR_FORM.workbook,
            },
            {
              title: "Quality — Activity checklist (F-02)",
              meta: `${openByStatus.activity.open} open · ${openByStatus.activity.total} total`,
              href: registerToolPath(id, "activity-f02"),
              sheet: ACTIVITY_CHECKLIST_FORM.workbook,
            },
            {
              title: "Safety — Safety IR (F-01) + HSE",
              meta: `${openByStatus.safety.open} open · ${openByStatus.safety.total} total`,
              href: registerToolPath(id, "safety-ir"),
              sheet: SAFETY_IR_FORM.workbook,
            },
          ].map((c) => (
            <Link key={c.href} to={c.href} className="block rounded-xl border border-line bg-paper p-4 hover:border-brand/50 hover:shadow-sm">
              <div className="font-semibold text-sm text-ink">{c.title}</div>
              <p className="text-xs text-steel-muted mt-1">{c.meta}</p>
              <p className="text-[10px] font-mono text-steel-muted mt-2 truncate">{c.sheet}</p>
              <p className="text-xs font-semibold text-brand mt-3">Open register →</p>
            </Link>
          ))}
        </div>
        <Card>
          <h3 className="font-semibold mb-2">All inspection requests (read-only overview)</h3>
          <p className="text-xs text-steel-muted mb-3">Click a row’s module link to work it in the owning register.</p>
          <ul className="divide-y divide-line text-sm">
            {rows.length === 0 && <li className="py-4 text-steel-muted">No inspection requests yet.</li>}
            {rows.map((r) => {
              const home = canonicalRfiKind(r.rfiKind);
              const href =
                home === "SafetyIR"
                  ? registerToolPath(id, "safety-ir") + `&rfi=${r.id}`
                  : home === "ActivityInspection"
                    ? registerToolPath(id, "activity-f02") + `&rfi=${r.id}`
                    : registerToolPath(id, "quality-ir") + `&rfi=${r.id}`;
              return (
                <li key={r.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      <span className="font-mono text-xs text-brand mr-2">{r.number || r.irNumber || "—"}</span>
                      {r.subject}
                    </div>
                    <div className="text-[11px] text-steel-muted">
                      {home} · {r.status || "Open"}
                    </div>
                  </div>
                  <Link to={href} className="text-xs font-semibold text-brand shrink-0">
                    Open in {home === "SafetyIR" ? "Safety" : "Quality"} →
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    );
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

  const ownerLabel = lock === "safety" ? "Safety module" : lock === "quality" ? "Quality module" : "Inspection";

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        eyebrow={`${ownerLabel} · register log`}
        title={
          tab === "hse-register"
            ? "HSE register"
            : tab === "safety-ir"
              ? "Safety IR register"
              : tab === "activity-checklist"
                ? "Activity checklist register (F-02)"
                : "Request for Inspection register (F-01)"
        }
        subtitle={
          lock === "safety"
            ? "Safety owns this log. Clearances and HSE findings stay here — not on Drawings or Quality."
            : "Quality owns this log. F-01 offers work for inspection; F-02 is the contractor self-check enclosure."
        }
      />

      <ReferenceSheetToolbar
        sheetLabel={tab === "hse-register" ? "HSE register" : `${formRef.title} register`}
        rowCount={filtered.length}
        canEdit={canCreate}
        onAddRow={
          canCreate
            ? () => {
                if (tab === "hse-register") {
                  setTab("safety-ir");
                  return;
                }
                document.getElementById("add-inspection-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            : undefined
        }
        addRowLabel={tab === "hse-register" ? "+ Raise Safety IR" : "+ Add to register"}
      />

      <div className="flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
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
        {id ? (
          <Link to={`/projects/${id}/inspection-register?overview=1`} className="px-3 py-1.5 text-xs text-steel-muted underline self-center">
            Overview desk
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs items-center text-steel-muted">
        <span className="text-[11px]">Checklist masters:</span>
        <ToolLink to={tabChecklist.master} className="text-brand underline" windowLabel="Checklist master">
          Open master
        </ToolLink>
        <span>·</span>
        <ToolLink to={tabChecklist.logs} className="text-brand underline" windowLabel="Fill log">
          Fill log
        </ToolLink>
      </div>

      {tab !== "hse-register" && canCreate && (
        <div id="add-inspection-form">
        <SpdcInspectionFormPanel
          formKind={formKind}
          users={users}
          qualityIrOptions={tab === "safety-ir" ? qualityIrOptions : []}
          checklistAssignments={tabChecklist.assignments}
          masterHref={tabChecklist.master}
          project={project}
          onSubmit={raiseEntry}
          busy={busy}
        />
        </div>
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
          onFillChecklist={
            id
              ? (row) => {
                  // Only fill when this IR already links a checklist — free-form catalog fill is not allowed.
                  if (row.linkedAssignmentId) {
                    openChecklistFillWindow(id, row.linkedAssignmentId, tabChecklist.family);
                  }
                }
              : undefined
          }
        />
      </Card>

      {selected && tab !== "hse-register" && id && (user?.role === "admin" || user?.role === "office") && (
        <div className="flex items-center justify-end gap-2 text-xs text-steel-muted">
          <span>
            Clean up the log: <span className="font-mono text-brand">{selected.number}</span>
          </span>
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
      )}

      {selected && tab !== "hse-register" && id && (
        <SpdcInspectionIrPanel
          rfi={selected}
          project={project}
          projectId={id}
          checklistFamily={tabChecklist.family}
          checklistName={checklistByRowId[selected.id]}
          checklistAssignments={tabChecklist.assignments}
          token={token}
          onUpdated={load}
        />
      )}

      <p className="text-[10px] text-steel-muted">
        Templates: {QUALITY_IR_FORM.workbook} · {SAFETY_IR_FORM.workbook} · {ACTIVITY_CHECKLIST_FORM.workbook}
      </p>
    </div>
  );
}
