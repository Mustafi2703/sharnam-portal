import { useMemo, useState, useEffect, Fragment } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  QAP_LEGENDS,
  qapStatusRowClass,
  remarksCellClass,
} from "../lib/inspectionRequestForms";
import { preferWeekLabel, weekMatchesFilter } from "../lib/qapWeek";
import { useLocalRegisterRows } from "../hooks/useLocalRegisterRows";
import { RegisterScrollArea } from "./RegisterScrollArea";
import { RegisterSheetCell } from "./RegisterSheetCell";
import { QapPickerLists } from "./QapPickerLists";
import { QAP_PICKERS } from "@sharnam/shared";
import { RegisterBrandHeader } from "./RegisterBrandHeader";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { Badge, Button, Card, Input, Select } from "./ui";

function formatDayLabel(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(raw + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  if (/^\d{5,}$/.test(raw)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Number(raw));
    return epoch.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  return raw.length > 8 ? raw.slice(0, 8) : raw;
}

type QapRow = {
  id: string;
  weekLabel: string;
  srNo?: string | null;
  section?: string | null;
  activity: string;
  description?: string | null;
  frequency?: string | null;
  codeOfConformance?: string | null;
  testAgency?: string | null;
  contractorPerformer?: string | null;
  contractorChecker?: string | null;
  pmcRole?: string | null;
  clientRole?: string | null;
  records?: string | null;
  remarks?: string | null;
  dailyChecks?: string | null;
  contractorOk?: boolean;
  pmcOk?: boolean;
  clientOk?: boolean;
  status?: string;
  qapLineId?: string | null;
  isHeader?: boolean;
  ir?: {
    due?: number | null;
    dueLabel?: string;
    raised?: number;
    approved?: number;
    latestResult?: string;
    irCount?: number;
    qapLineId?: string | null;
  } | null;
};

type QapRoleName = {
  roleLabel: string;
  party: string;
  userName?: string | null;
  vendorName?: string | null;
  contactName?: string | null;
  mapped?: boolean;
};

const QAP_STATUS_FILTERS = [
  "Not started",
  "In progress",
  "Completed",
  "Rejected - re-offer",
  "Overdue",
  "Awaiting client",
] as const;

type LineIr = {
  id: string;
  number?: string;
  date?: string;
  location?: string;
  result?: string;
  status?: string;
};

export type QapProjectMeta = {
  id?: string;
  name?: string;
  code?: string;
  clientName?: string;
  designConsultant?: string;
  contractorName?: string;
  pmcName?: string | null;
  location?: string | null;
  clientLogoUrl?: string | null;
  startDate?: string | null;
};

type Props = {
  projectId: string;
  token?: string | null;
  rows: QapRow[];
  canEdit: boolean;
  onUpdated: () => void | Promise<void>;
  showWeekFilter?: boolean;
  project?: QapProjectMeta | null;
  loading?: boolean;
  onProjectUpdated?: () => void | Promise<void>;
  initialStatus?: string;
};

function qapBadgeTone(status?: string | null): "ok" | "warn" | "danger" | "neutral" {
  const s = status || "";
  if (s === "Completed" || s === "Done") return "ok";
  if (s === "Overdue" || /reject/i.test(s)) return "danger";
  if (s === "In progress" || s === "Awaiting client") return "warn";
  return "neutral";
}

function resultBadge(raw?: string | null): string {
  const c = String(raw || "").trim().charAt(0).toUpperCase();
  if (c === "A" || c === "B" || c === "C" || c === "D") return c;
  return "Pending";
}

function isGroupHeader(row: QapRow): boolean {
  if (row.isHeader || row.status === "Header") return true;
  const noFreq = !String(row.frequency || "").trim();
  const noRoles = ![row.contractorPerformer, row.contractorChecker, row.pmcRole, row.clientRole].some((v) =>
    String(v || "").trim()
  );
  return !row.ir && noFreq && noRoles;
}

function RolePerson({ party, label, roles }: { party: string; label?: string | null; roles: QapRoleName[] }) {
  const lab = String(label || "").trim();
  if (!lab) return null;
  const hit = roles.find((r) => r.party === party && r.roleLabel.trim().toLowerCase() === lab.toLowerCase());
  const name = hit?.userName || hit?.vendorName || hit?.contactName;
  if (!name) return null;
  return (
    <div className="px-1 pt-0.5 text-[10px] leading-tight text-brand-dark truncate" title={lab}>
      {name}
    </div>
  );
}

/** Quality Assurance Plan — full client Excel layout; inline edit only. */
export function QapDetailRegister({
  projectId,
  token,
  rows,
  canEdit,
  onUpdated,
  showWeekFilter = true,
  project,
  loading,
  onProjectUpdated,
  initialStatus = "",
}: Props) {
  const { localRows, mergeRow } = useLocalRegisterRows(rows);
  const [weekFilter, setWeekFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [patchErr, setPatchErr] = useState("");
  const [editRow, setEditRow] = useState<QapRow | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [roles, setRoles] = useState<QapRoleName[]>([]);
  const [irDrawer, setIrDrawer] = useState<{ lineId: string; title: string } | null>(null);
  const [irList, setIrList] = useState<LineIr[]>([]);
  const [irBusy, setIrBusy] = useState(false);

  useEffect(() => {
    if (initialStatus) setStatusFilter(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void api<{ roles?: QapRoleName[] }>(`/api/checklist/project/${projectId}/qap/roles`, { token })
      .then((out) => {
        if (!cancelled) setRoles(out.roles || []);
      })
      .catch(() => {
        if (!cancelled) setRoles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, token]);

  const weeks = useMemo(() => {
    const set = new Set<string>();
    localRows.forEach((r) => r.weekLabel && set.add(r.weekLabel));
    return Array.from(set).sort().reverse();
  }, [localRows]);

  useEffect(() => {
    if (!showWeekFilter) return;
    if (weeks.length && !weekFilter) setWeekFilter(preferWeekLabel(weeks));
  }, [weeks, weekFilter, showWeekFilter]);

  const filtered = useMemo(() => {
    if (!showWeekFilter) return localRows;
    return localRows.filter((r) => weekMatchesFilter(r.weekLabel, weekFilter));
  }, [localRows, weekFilter, showWeekFilter]);

  const visible = useMemo(() => {
    if (!statusFilter) return filtered;
    return filtered.filter((r) => (r.status || "Not started") === statusFilter);
  }, [filtered, statusFilter]);

  /** Week 50 Excel always has 7 QC-log day columns — show them even when rows have no ticks yet. */
  const dayLabels = useMemo(() => {
    const set = new Set<string>();
    for (const r of filtered) {
      if (!r.dailyChecks) continue;
      try {
        Object.keys(JSON.parse(r.dailyChecks)).forEach((k) => set.add(k));
      } catch {
        /* ignore */
      }
    }
    const fromData = Array.from(set).sort();
    if (fromData.length >= 7) return fromData.slice(0, 7);
    if (fromData.length > 0) {
      const out = [...fromData];
      let i = 1;
      while (out.length < 7) {
        const pad = `Day ${i++}`;
        if (!out.includes(pad)) out.push(pad);
      }
      return out;
    }
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  }, [filtered]);

  function sectionLabel(row: QapRow): string {
    return (row.section || row.activity || "General").trim();
  }

  function parseDaily(q: QapRow): Record<string, boolean> {
    if (!q.dailyChecks) return {};
    try {
      return JSON.parse(q.dailyChecks) as Record<string, boolean>;
    } catch {
      return {};
    }
  }

  async function patchRow(id: string, body: Record<string, unknown>, refreshTotals = false) {
    const prev = localRows.find((r) => r.id === id);
    if (!prev) return;
    mergeRow(id, body as Partial<QapRow>);
    setPatchErr("");
    try {
      await api(`/api/checklist/project/${projectId}/qap/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      if (refreshTotals) await onUpdated();
    } catch (err) {
      mergeRow(id, prev);
      setPatchErr(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deleteRow(id: string) {
    if (!window.confirm("Delete this QAP line?")) return;
    setPatchErr("");
    try {
      await api(`/api/checklist/project/${projectId}/qap/${id}`, { method: "DELETE", token });
      if (editRow?.id === id) setEditRow(null);
      await onUpdated();
    } catch (err) {
      setPatchErr(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function saveEdit() {
    if (!editRow) return;
    setEditBusy(true);
    setPatchErr("");
    try {
      await patchRow(editRow.id, {
        srNo: editRow.srNo || null,
        section: editRow.section || editRow.activity,
        activity: editRow.section || editRow.activity,
        description: editRow.description || "",
        frequency: editRow.frequency || null,
        codeOfConformance: editRow.codeOfConformance || null,
        testAgency: editRow.testAgency || null,
        contractorPerformer: editRow.contractorPerformer || null,
        contractorChecker: editRow.contractorChecker || null,
        pmcRole: editRow.pmcRole || null,
        clientRole: editRow.clientRole || null,
        records: editRow.records || null,
        remarks: editRow.remarks || null,
      }, true);
      setEditRow(null);
    } finally {
      setEditBusy(false);
    }
  }

  const colSpan = 15 + dayLabels.length + (canEdit ? 1 : 0);

  async function openIrs(row: QapRow) {
    const lineId = row.qapLineId || row.ir?.qapLineId;
    if (!lineId) return;
    setIrDrawer({
      lineId,
      title: [row.section || row.activity, row.description].filter(Boolean).join(" - ") || "QAP line",
    });
    setIrBusy(true);
    setIrList([]);
    try {
      const out = await api<{ irs?: LineIr[] }>(`/api/checklist/project/${projectId}/qap/line/${lineId}/irs`, { token });
      setIrList(out.irs || []);
    } catch (err) {
      setPatchErr(err instanceof Error ? err.message : "Could not load IRs");
      setIrDrawer(null);
    } finally {
      setIrBusy(false);
    }
  }

  const legend = (
    <>
      <div className="text-[10px] font-bold uppercase text-brand-dark mb-1 px-1">Legends</div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] leading-tight px-1 max-h-24 overflow-y-auto">
        {QAP_LEGENDS.map(([abbr, full]) => (
          <div key={abbr} className="truncate" title={full}>
            <span className="font-bold text-brand-dark">{abbr}</span>
            <span className="text-steel-muted"> — {full}</span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <QapPickerLists rows={rows} />
      <Card padding={false} className="spdc-register-panel register-editor-panel register-panel-fill relative flex flex-col min-w-0 w-full">
        {loading && (
          <div className="spdc-register-loading" aria-live="polite">
            Loading QAP register…
          </div>
        )}

        <div className="shrink-0">
          <RegisterBrandHeader
            title="Quality Assurance Plan"
            project={project}
            token={token}
            canEdit={canEdit}
            onProjectUpdated={onProjectUpdated}
            legend={legend}
          />
        </div>

        {patchErr && (
          <p className="text-xs text-danger bg-red-50 px-4 py-2 border-b border-line shrink-0">{patchErr}</p>
        )}

        <div className="px-4 py-2 border-b border-line bg-sand/40 shrink-0 flex flex-wrap gap-2 items-center">
          {showWeekFilter && weeks.length > 1 ? (
            <Select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="!w-auto min-w-[8rem]" aria-label="Week">
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          ) : null}
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-auto min-w-[11rem]" aria-label="Status">
            <option value="">All</option>
            {QAP_STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <div className="register-scroll-hint shrink-0 px-4 py-1.5 border-b border-line">
          Scroll ↔ for Records, Remarks and daily QC logs · ↕ for all activity lines · saves on blur
        </div>

        <div className="sheet-register register-sheet-shell flex flex-col min-w-0 w-full border-t border-line">
          <RegisterScrollArea tall className="qap-register__scroll sheet-register__scroll scrollbars-visible">
            <table className="qap-register__table register-editor-pro min-w-[110rem]">
              <thead className="spdc-register-thead">
                <tr>
                  <th rowSpan={2} className="text-left qap-sticky-sr">
                    Sr.No.
                  </th>
                  <th rowSpan={2} className="text-left qap-sticky-activity">
                    Activity
                  </th>
                  <th rowSpan={2} className="text-left min-w-[12rem]">
                    Description of Activity / Material
                  </th>
                  <th rowSpan={2} className="text-left min-w-[7rem]">
                    Frequency of check
                  </th>
                  <th rowSpan={2} className="text-left min-w-[8rem]">
                    Code of Conformance
                  </th>
                  <th rowSpan={2} className="text-left min-w-[7rem]">
                    Test agency
                  </th>
                  <th colSpan={2} className="text-center spdc-th-contractor">
                    Contractor
                  </th>
                  <th colSpan={1} className="text-center spdc-th-pmc">
                    PMC
                  </th>
                  <th colSpan={1} className="text-center spdc-th-client">
                    CLIENT
                  </th>
                  <th rowSpan={2} className="text-left min-w-[10rem]">
                    Records and documents to be Maintained
                  </th>
                  <th rowSpan={2} className="text-left min-w-[7rem]">
                    Remarks if any
                  </th>
                  <th colSpan={dayLabels.length} className="text-center qap-th-daily">
                    Quality Control Logs
                  </th>
                  <th rowSpan={2} className="text-left min-w-[8rem]">
                    Due / Raised / Approved
                  </th>
                  <th rowSpan={2} className="text-left min-w-[7rem]">
                    IRs
                  </th>
                  <th rowSpan={2} className="text-left min-w-[5rem]">
                    Status
                  </th>
                  {canEdit && <th rowSpan={2} className="w-28">Edit / Delete</th>}
                </tr>
                <tr>
                  <th className="spdc-th-contractor spdc-th-sub">Performer</th>
                  <th className="spdc-th-contractor spdc-th-sub">Checker</th>
                  <th className="spdc-th-pmc spdc-th-sub">Checker</th>
                  <th className="spdc-th-client spdc-th-sub">Checker</th>
                  {dayLabels.map((d) => (
                    <th key={d} className="text-center min-w-[2.75rem] align-middle qap-th-daily-sub" title={d}>
                      {formatDayLabel(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((q, rowIdx) => {
                  const section = sectionLabel(q);
                  const prevSection = rowIdx > 0 ? sectionLabel(visible[rowIdx - 1]) : "";
                  const header = isGroupHeader(q);
                  const lineId = q.qapLineId || q.ir?.qapLineId || "";
                  const dueText = q.ir?.dueLabel || (q.ir?.due != null ? String(q.ir.due) : "");
                  const latest = resultBadge(q.ir?.latestResult);
                  const showSectionBand = section !== prevSection;
                  const isFirstInSection = showSectionBand;
                  const showActivity = isFirstInSection || !!q.srNo;
                  const srDisplay = q.srNo || (isFirstInSection ? "·" : "");
                  return (
                    <Fragment key={q.id}>
                      {showSectionBand && (
                        <tr className="qap-section-band">
                          <td colSpan={colSpan}>
                            {section}
                            {q.srNo ? ` · Sr ${q.srNo}` : ""}
                          </td>
                        </tr>
                      )}
                      <tr className={`${qapStatusRowClass(q.status)} ${header ? "qap-line-header" : ""}`.trim()}>
                        <td className="text-left font-mono tabular-nums qap-sticky-sr align-top">
                          <RegisterSheetCell
                            value={srDisplay}
                            disabled={!canEdit}
                            className="min-w-[2.5rem]"
                            onCommit={(v) => void patchRow(q.id, { srNo: v || null })}
                          />
                        </td>
                        <td className="text-left align-top qap-sticky-activity font-semibold text-brand-dark">
                          {canEdit ? (
                            <RegisterSheetCell
                              value={showActivity ? section : q.activity || ""}
                              disabled={!canEdit}
                              className="min-w-[8rem] font-semibold"
                              onCommit={(v) => void patchRow(q.id, { section: v, activity: v })}
                            />
                          ) : showActivity ? (
                            section
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="text-left align-top border border-line px-1 py-0.5">
                          <RegisterSheetCell
                            value={q.description || q.activity}
                            disabled={!canEdit}
                            className="min-w-[11rem]"
                            onCommit={(v) => void patchRow(q.id, { description: v })}
                          />
                        </td>
                        <td className="text-left align-top border border-line px-1 py-0.5">
                          <RegisterSheetCell
                            value={q.frequency || ""}
                            list="qap-pick-frequency"
                            disabled={!canEdit}
                            onCommit={(v) => void patchRow(q.id, { frequency: v || null })}
                          />
                        </td>
                        <td className="text-left align-top border border-line px-1 py-0.5">
                          <RegisterSheetCell
                            value={q.codeOfConformance || ""}
                            list="qap-pick-codeOfConformance"
                            disabled={!canEdit}
                            onCommit={(v) => void patchRow(q.id, { codeOfConformance: v || null })}
                          />
                        </td>
                        <td className="text-left align-top border border-line px-1 py-0.5">
                          <RegisterSheetCell
                            value={q.testAgency || ""}
                            list="qap-pick-testAgency"
                            disabled={!canEdit}
                            onCommit={(v) => void patchRow(q.id, { testAgency: v || null })}
                          />
                        </td>
                        <td className="text-left align-top qap-col-contractor">
                          <RegisterSheetCell
                            value={q.contractorPerformer || ""}
                            list="qap-pick-contractorPerformer"
                            disabled={!canEdit}
                            className="min-w-[4.5rem]"
                            placeholder="P / C"
                            onCommit={(v) =>
                              void patchRow(q.id, {
                                contractorPerformer: v || null,
                                contractorOk: !!(v || q.contractorChecker),
                              })
                            }
                          />
                          <RolePerson party="Contractor" label={q.contractorPerformer} roles={roles} />
                        </td>
                        <td className="text-left align-top qap-col-contractor">
                          <RegisterSheetCell
                            value={q.contractorChecker || ""}
                            list="qap-pick-contractorChecker"
                            disabled={!canEdit}
                            className="min-w-[4.5rem]"
                            placeholder="C"
                            onCommit={(v) =>
                              void patchRow(q.id, {
                                contractorChecker: v || null,
                                contractorOk: !!(v || q.contractorPerformer),
                              })
                            }
                          />
                          <RolePerson party="Contractor" label={q.contractorChecker} roles={roles} />
                        </td>
                        <td className="text-left align-top qap-col-pmc">
                          <RegisterSheetCell
                            value={q.pmcRole || ""}
                            list="qap-pick-pmcRole"
                            disabled={!canEdit}
                            className="min-w-[4.5rem]"
                            placeholder="R / W / A"
                            onCommit={(v) =>
                              void patchRow(q.id, {
                                pmcRole: v || null,
                                pmcOk: /review|witness|yes|approve/i.test(v),
                              })
                            }
                          />
                          <RolePerson party="PMC" label={q.pmcRole} roles={roles} />
                        </td>
                        <td className="text-left align-top qap-col-client">
                          <RegisterSheetCell
                            value={q.clientRole || ""}
                            list="qap-pick-clientRole"
                            disabled={!canEdit}
                            className="min-w-[4.5rem]"
                            placeholder="W / RA"
                            onCommit={(v) =>
                              void patchRow(q.id, {
                                clientRole: v || null,
                                clientOk: /witness|random|yes|approve/i.test(v),
                              })
                            }
                          />
                          <RolePerson party="Client" label={q.clientRole} roles={roles} />
                        </td>
                        <td className="text-left align-top border border-line px-1 py-0.5 min-w-[10rem]">
                          <RegisterSheetCell
                            value={q.records || ""}
                            list="qap-pick-records"
                            disabled={!canEdit}
                            className="min-w-[9rem]"
                            onCommit={(v) => void patchRow(q.id, { records: v || null })}
                          />
                        </td>
                        <td className={`text-left align-top border border-line px-1 py-0.5 min-w-[7rem] ${remarksCellClass(q.remarks)}`}>
                          <RegisterSheetCell
                            value={q.remarks || ""}
                            list="qap-pick-remarks"
                            disabled={!canEdit}
                            className="min-w-[6rem]"
                            onCommit={(v) => void patchRow(q.id, { remarks: v || null })}
                          />
                        </td>
                        {dayLabels.map((d) => {
                          const daily = parseDaily(q);
                          const checked = !!daily[d];
                          return (
                            <td key={d} className={`text-center align-top ${checked ? "qap-daily-done" : ""}`}>
                              {canEdit ? (
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = { ...parseDaily(q), [d]: e.target.checked };
                                    void patchRow(q.id, { dailyChecks: next }, true);
                                  }}
                                />
                              ) : checked ? (
                                "✓"
                              ) : (
                                "·"
                              )}
                            </td>
                          );
                        })}
                        <td className="text-left align-top border border-line px-1 py-1 text-[11px] whitespace-nowrap">
                          {header ? (
                            <span className="text-steel-muted">Group</span>
                          ) : (
                            <span>
                              {dueText || "-"} / {q.ir?.raised ?? 0} / {q.ir?.approved ?? 0}
                            </span>
                          )}
                        </td>
                        <td className="text-left align-top border border-line px-1 py-1 whitespace-nowrap">
                          {header ? (
                            <span className="text-[10px] uppercase tracking-wide text-steel-muted">Group label</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                className="text-xs font-semibold text-brand underline"
                                disabled={!lineId}
                                onClick={() => void openIrs(q)}
                              >
                                {q.ir?.irCount ?? 0}
                              </button>
                              <Badge tone={latest === "A" ? "ok" : latest === "C" ? "danger" : latest === "B" ? "warn" : "neutral"}>
                                {latest}
                              </Badge>
                              {lineId ? (
                                <Link to={`/projects/${projectId}/inspection-register?tab=quality-ir&lock=quality&qapLineId=${lineId}`}>
                                  <Button type="button" variant="secondary" className="!py-0.5 !px-1 !text-[9px]">
                                    Raise IR
                                  </Button>
                                </Link>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="text-left align-top border border-line px-1 py-0.5 whitespace-nowrap">
                          <Badge tone={qapBadgeTone(q.status)}>{q.status || "Not started"}</Badge>
                        </td>
                        {canEdit && (
                          <td className="align-top whitespace-nowrap">
                            <button
                              type="button"
                              className="text-xs font-semibold text-brand mr-2"
                              onClick={() => setEditRow({ ...q })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-danger"
                              onClick={() => void deleteRow(q.id)}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    </Fragment>
                  );
                })}
                {!visible.length && (
                  <tr>
                    <td colSpan={colSpan} className="empty text-left border border-line p-4">
                      No QAP detail rows — upload the client QAP Excel, or load the demo template from Admin → UAT Data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </RegisterScrollArea>
        </div>
      </Card>

      <RegisterEntryModal
        open={Boolean(canEdit && editRow)}
        title={`Edit QAP line${editRow?.srNo ? ` · Sr ${editRow.srNo}` : ""}`}
        onClose={() => setEditRow(null)}
        onSave={() => void saveEdit()}
        saving={editBusy}
        size="3xl"
        saveLabel="Save line"
      >
        {editRow && (
          <div className="register-form-grid register-form-grid--wide">
            {(
              [
                ["srNo", "Sr. No."],
                ["section", "Activity / section"],
                ["description", "Description"],
                ["frequency", "Frequency of check"],
                ["codeOfConformance", "Code of conformance"],
                ["testAgency", "Test agency"],
                ["contractorPerformer", "Contractor performer"],
                ["contractorChecker", "Contractor checker"],
                ["pmcRole", "PMC checker (R / W / A)"],
                ["clientRole", "Client checker (W / RA)"],
                ["records", "Records"],
                ["remarks", "Remarks"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="register-form-field">
                <span>{label}</span>
                <Input
                  value={String(editRow[key] ?? "")}
                  list={key in QAP_PICKERS ? `qap-pick-${key}` : undefined}
                  onChange={(e) => setEditRow({ ...editRow, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        )}
      </RegisterEntryModal>

      {irDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Inspection requests">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={() => setIrDrawer(null)} />
          <aside className="relative h-full w-full max-w-md bg-white border-l border-line shadow-xl flex flex-col">
            <div className="px-4 py-3 border-b border-line flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-steel-muted font-semibold">Inspection requests</div>
                <div className="text-sm font-semibold text-ink truncate">{irDrawer.title}</div>
              </div>
              <Button type="button" variant="secondary" className="!text-xs" onClick={() => setIrDrawer(null)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {irBusy ? <p className="text-sm text-steel-muted">Loading IRs...</p> : null}
              {!irBusy && !irList.length ? <p className="text-sm text-steel-muted">No inspection requests on this line yet.</p> : null}
              {irList.map((ir) => (
                <div key={ir.id} className="rounded-lg border border-line p-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      className="font-mono text-xs font-semibold text-brand underline"
                      to={`/projects/${projectId}/inspection-register?tab=quality-ir&lock=quality&rfi=${ir.id}`}
                      onClick={() => setIrDrawer(null)}
                    >
                      {ir.number || ir.id}
                    </Link>
                    <Badge tone={resultBadge(ir.result) === "A" ? "ok" : resultBadge(ir.result) === "C" ? "danger" : "neutral"}>
                      {ir.result || "Pending"}
                    </Badge>
                  </div>
                  <div className="text-xs text-steel-muted">
                    {ir.date ? String(ir.date).slice(0, 10) : "-"}
                    {ir.location ? ` · ${ir.location}` : ""}
                    {ir.status ? ` · ${ir.status}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
