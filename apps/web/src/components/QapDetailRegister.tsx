import { useMemo, useState, useEffect, Fragment } from "react";
import { api } from "../api";
import {
  QAP_LEGENDS,
  QAP_SIGN_CLIENT,
  QAP_SIGN_CONTRACTOR,
  QAP_SIGN_PMC,
  qapRoleCellClass,
  qapStatusRowClass,
  remarksCellClass,
} from "../lib/inspectionRequestForms";
import { preferWeekLabel, weekMatchesFilter } from "../lib/qapWeek";
import { useLocalRegisterRows } from "../hooks/useLocalRegisterRows";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { RegisterSheetCell } from "./RegisterSheetCell";
import { Badge, Button, Card, Input, Select, TextArea } from "./ui";

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
};

export type QapProjectMeta = {
  name?: string;
  code?: string;
  clientName?: string;
  designConsultant?: string;
  contractorName?: string;
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
};

function emptyEditForm(): Record<string, string> {
  return {
    description: "",
    frequency: "",
    codeOfConformance: "",
    testAgency: "",
    contractorPerformer: "",
    contractorChecker: "",
    pmcRole: "",
    clientRole: "",
    records: "",
    remarks: "",
    status: "Open",
  };
}

/** Quality Assurance Plan — client Excel layout with popup editor + stable inline cells. */
export function QapDetailRegister({
  projectId,
  token,
  rows,
  canEdit,
  onUpdated,
  showWeekFilter = true,
  project,
  loading,
}: Props) {
  const { localRows, mergeRow } = useLocalRegisterRows(rows);
  const [weekFilter, setWeekFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm());
  const [editDaily, setEditDaily] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [patchErr, setPatchErr] = useState("");

  const weeks = useMemo(() => {
    const set = new Set<string>();
    localRows.forEach((r) => r.weekLabel && set.add(r.weekLabel));
    return Array.from(set).sort().reverse();
  }, [localRows]);

  useEffect(() => {
    if (weeks.length && !weekFilter) setWeekFilter(preferWeekLabel(weeks));
  }, [weeks, weekFilter]);

  const filtered = useMemo(() => {
    if (!showWeekFilter || !weekFilter) return localRows.filter((r) => weekMatchesFilter(r.weekLabel, "Week 50"));
    return localRows.filter((r) => weekMatchesFilter(r.weekLabel, weekFilter));
  }, [localRows, weekFilter, showWeekFilter]);

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
    return Array.from(set).sort();
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

  function renderRoleChip(role?: string | null, fallbackOk?: boolean) {
    const text = (role || "").trim();
    if (text) {
      return <span className={qapRoleCellClass(text)}>{text}</span>;
    }
    return fallbackOk ? <span className="qap-role-approve">✓</span> : <span className="qap-role-empty">·</span>;
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

  function openEdit(q: QapRow) {
    setEditId(q.id);
    setEditForm({
      description: q.description || q.activity || "",
      frequency: q.frequency || "",
      codeOfConformance: q.codeOfConformance || "",
      testAgency: q.testAgency || "",
      contractorPerformer: q.contractorPerformer || "",
      contractorChecker: q.contractorChecker || "",
      pmcRole: q.pmcRole || "",
      clientRole: q.clientRole || "",
      records: q.records || "",
      remarks: q.remarks || "",
      status: q.status || "Open",
    });
    setEditDaily(parseDaily(q));
    setModalOpen(true);
  }

  async function saveModal() {
    if (!editId) return;
    setSaving(true);
    try {
      await patchRow(
        editId,
        {
          description: editForm.description,
          frequency: editForm.frequency || null,
          codeOfConformance: editForm.codeOfConformance || null,
          testAgency: editForm.testAgency || null,
          contractorPerformer: editForm.contractorPerformer || null,
          contractorChecker: editForm.contractorChecker || null,
          contractorOk: !!(editForm.contractorPerformer || editForm.contractorChecker),
          pmcRole: editForm.pmcRole || null,
          pmcOk: /review|witness|yes|approve/i.test(editForm.pmcRole),
          clientRole: editForm.clientRole || null,
          clientOk: /witness|random|yes|approve/i.test(editForm.clientRole),
          records: editForm.records || null,
          remarks: editForm.remarks || null,
          status: editForm.status,
          dailyChecks: editDaily,
        },
        true
      );
      setModalOpen(false);
      setEditId(null);
    } finally {
      setSaving(false);
    }
  }

  const pmConsultant = "Sharnam Project Management Consultants";
  const colSpan = 12 + dayLabels.length + (canEdit ? 1 : 0);

  return (
    <>
      <Card padding={false} className="spdc-register-panel relative">
        {loading && <div className="spdc-register-loading">Loading QAP register…</div>}

        <div className="border-b border-line bg-white shrink-0">
          <div className="grid lg:grid-cols-[8rem_1fr_14rem] gap-0 border-b border-line">
            <div className="p-3 border-r border-line bg-sand/50 flex items-center justify-center text-[10px] font-semibold text-steel-muted uppercase tracking-wide">
              Client LOGO
            </div>
            <div className="p-4 flex items-center justify-center border-r border-line">
              <h2 className="font-display text-lg sm:text-xl font-bold text-brand-dark tracking-tight">
                Quality Assurance Plan
              </h2>
            </div>
            <div className="p-2 bg-brand-soft/30">
              <div className="text-[10px] font-bold uppercase text-brand-dark mb-1 px-1">Legends</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] leading-tight px-1 max-h-24 overflow-y-auto">
                {QAP_LEGENDS.map(([abbr, full]) => (
                  <div key={abbr} className="truncate" title={full}>
                    <span className="font-bold text-brand-dark">{abbr}</span>
                    <span className="text-steel-muted"> — {full}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="spdc-register-meta">
            {(
              [
                ["Project", project?.name || "—", false],
                ["Client", project?.clientName || "—", true],
                ["Design Consultant", project?.designConsultant || "—", false],
                ["PM Consultant", pmConsultant, false],
                ["Contractor", project?.contractorName || "—", false],
              ] as const
            ).map(([label, value, highlightClient]) => (
              <div
                key={label}
                className={`spdc-register-meta__cell${highlightClient ? " spdc-register-meta__cell--client" : ""}`}
              >
                <span className="spdc-register-meta__label">{label}</span>
                <span className="spdc-register-meta__value" title={String(value)}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-2 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-steel-muted text-left">
            Excel-style register — click cells to edit inline, or <strong>Edit</strong> for full row popup ({filtered.length} lines).
          </p>
          {showWeekFilter && weeks.length > 1 && (
            <Select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="!w-auto min-w-[8rem]">
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          )}
        </div>

        {patchErr && (
          <p className="text-xs text-danger bg-red-50 px-4 py-2 border-b border-line shrink-0">{patchErr}</p>
        )}

        <div className="sheet-register flex-1 min-h-0 flex flex-col">
          <div className="sheet-register__scroll">
            <table className="qap-register__table min-w-[88rem]">
              <thead>
                <tr className="bg-brand text-white">
                  <th rowSpan={2} className="text-left qap-sticky-sr">
                    Sr.No.
                  </th>
                  <th rowSpan={2} className="text-left qap-sticky-activity">
                    Activity
                  </th>
                  <th rowSpan={2} className="text-left min-w-[12rem] border border-brand-dark/30 px-1 py-1">
                    Description of Activity / Material
                  </th>
                  <th rowSpan={2} className="text-left min-w-[7rem] border border-brand-dark/30 px-1 py-1">
                    Frequency of check
                  </th>
                  <th rowSpan={2} className="text-left min-w-[8rem] border border-brand-dark/30 px-1 py-1">
                    Code of Conformance
                  </th>
                  <th rowSpan={2} className="text-left min-w-[7rem] border border-brand-dark/30 px-1 py-1">
                    Test agency
                  </th>
                  <th colSpan={2} className="text-center border border-brand-dark/30 px-1 py-1 bg-brand-dark/20">
                    Contractor
                  </th>
                  <th colSpan={1} className="text-center border border-brand-dark/30 px-1 py-1 bg-emerald-800/40">
                    PMC
                  </th>
                  <th colSpan={1} className="text-center border border-brand-dark/30 px-1 py-1 bg-amber-900/40">
                    CLIENT
                  </th>
                  <th rowSpan={2} className="text-left min-w-[8rem] border border-brand-dark/30 px-1 py-1">
                    Records and documents to be Maintained
                  </th>
                  <th rowSpan={2} className="text-left min-w-[6rem] border border-brand-dark/30 px-1 py-1">
                    Remarks if any
                  </th>
                  {dayLabels.map((d) => (
                    <th
                      key={d}
                      rowSpan={2}
                      className="text-center min-w-[2.5rem] border border-brand-dark/30 px-0.5 py-1 align-middle"
                      title={d}
                    >
                      {formatDayLabel(d)}
                    </th>
                  ))}
                  <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                    Status
                  </th>
                  {canEdit && (
                    <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1 min-w-[4rem]">
                      Edit
                    </th>
                  )}
                </tr>
                <tr className="bg-brand text-white text-[10px]">
                  <th className="border border-brand-dark/30 px-1 py-0.5">Performer</th>
                  <th className="border border-brand-dark/30 px-1 py-0.5">Checker</th>
                  <th className="border border-brand-dark/30 px-1 py-0.5 bg-emerald-800/40">Checker</th>
                  <th className="border border-brand-dark/30 px-1 py-0.5 bg-amber-900/40">Checker</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, rowIdx) => {
                  const section = sectionLabel(q);
                  const prevSection = rowIdx > 0 ? sectionLabel(filtered[rowIdx - 1]) : "";
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
                      <tr className={qapStatusRowClass(q.status)}>
                        <td className="text-left font-mono tabular-nums qap-sticky-sr align-top">{srDisplay}</td>
                        <td className="text-left align-top qap-sticky-activity font-semibold text-brand-dark">
                          {showActivity ? section : ""}
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
                            disabled={!canEdit}
                            onCommit={(v) => void patchRow(q.id, { frequency: v || null })}
                          />
                        </td>
                        <td className="text-left align-top border border-line px-1 py-0.5">
                          <RegisterSheetCell
                            value={q.codeOfConformance || ""}
                            disabled={!canEdit}
                            onCommit={(v) => void patchRow(q.id, { codeOfConformance: v || null })}
                          />
                        </td>
                        <td className="text-left align-top border border-line px-1 py-0.5">
                          <RegisterSheetCell
                            value={q.testAgency || ""}
                            disabled={!canEdit}
                            onCommit={(v) => void patchRow(q.id, { testAgency: v || null })}
                          />
                        </td>
                        <td className="text-left align-top qap-col-contractor">
                          {canEdit ? (
                            <select
                              className="register-sheet-cell register-sheet-cell--select min-w-[4.5rem]"
                              value={q.contractorPerformer || ""}
                              onChange={(e) =>
                                void patchRow(q.id, {
                                  contractorPerformer: e.target.value || null,
                                  contractorOk: !!(e.target.value || q.contractorChecker),
                                })
                              }
                            >
                              {QAP_SIGN_CONTRACTOR.map((o) => (
                                <option key={`cp-${o || "x"}`} value={o}>
                                  {o || "—"}
                                </option>
                              ))}
                            </select>
                          ) : (
                            q.contractorPerformer || "—"
                          )}
                        </td>
                        <td className="text-left align-top qap-col-contractor">
                          {canEdit ? (
                            <select
                              className="register-sheet-cell register-sheet-cell--select min-w-[4.5rem]"
                              value={q.contractorChecker || ""}
                              onChange={(e) =>
                                void patchRow(q.id, {
                                  contractorChecker: e.target.value || null,
                                  contractorOk: !!(e.target.value || q.contractorPerformer),
                                })
                              }
                            >
                              {QAP_SIGN_CONTRACTOR.map((o) => (
                                <option key={`cc-${o || "x"}`} value={o}>
                                  {o || "—"}
                                </option>
                              ))}
                            </select>
                          ) : (
                            q.contractorChecker || "—"
                          )}
                        </td>
                        <td className="text-left align-top qap-col-pmc">
                          {canEdit ? (
                            <select
                              className="register-sheet-cell register-sheet-cell--select min-w-[4.5rem]"
                              value={q.pmcRole || ""}
                              onChange={(e) =>
                                void patchRow(q.id, {
                                  pmcRole: e.target.value || null,
                                  pmcOk: /review|witness|yes|approve/i.test(e.target.value),
                                })
                              }
                            >
                              {QAP_SIGN_PMC.map((o) => (
                                <option key={`pmc-${o || "x"}`} value={o}>
                                  {o || "—"}
                                </option>
                              ))}
                            </select>
                          ) : (
                            renderRoleChip(q.pmcRole, q.pmcOk)
                          )}
                        </td>
                        <td className="text-left align-top qap-col-client">
                          {canEdit ? (
                            <select
                              className="register-sheet-cell register-sheet-cell--select min-w-[4.5rem]"
                              value={q.clientRole || ""}
                              onChange={(e) =>
                                void patchRow(q.id, {
                                  clientRole: e.target.value || null,
                                  clientOk: /witness|random|yes|approve/i.test(e.target.value),
                                })
                              }
                            >
                              {QAP_SIGN_CLIENT.map((o) => (
                                <option key={`cl-${o || "x"}`} value={o}>
                                  {o || "—"}
                                </option>
                              ))}
                            </select>
                          ) : (
                            renderRoleChip(q.clientRole, q.clientOk)
                          )}
                        </td>
                        <td className="text-left align-top border border-line px-1 py-0.5">
                          <RegisterSheetCell
                            value={q.records || ""}
                            disabled={!canEdit}
                            onCommit={(v) => void patchRow(q.id, { records: v || null })}
                          />
                        </td>
                        <td className={`text-left align-top border border-line px-1 py-0.5 ${remarksCellClass(q.remarks)}`}>
                          <RegisterSheetCell
                            value={q.remarks || ""}
                            disabled={!canEdit}
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
                                    void patchRow(q.id, { dailyChecks: next });
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
                        <td className="text-left align-top border border-line px-1 py-0.5 whitespace-nowrap">
                          <Badge tone={q.status === "Done" ? "ok" : "warn"}>{q.status || "Open"}</Badge>
                          {canEdit && q.status !== "Done" && (
                            <Button
                              type="button"
                              variant="secondary"
                              className="!py-0.5 !px-1 !text-[9px] ml-0.5"
                              onClick={() => void patchRow(q.id, { status: "Done", remarks: q.remarks || "Completed" }, true)}
                            >
                              Done
                            </Button>
                          )}
                        </td>
                        {canEdit && (
                          <td className="text-left align-top border border-line px-1 py-0.5">
                            <Button type="button" variant="secondary" className="!py-0.5 !px-1.5 !text-[10px]" onClick={() => openEdit(q)}>
                              Edit
                            </Button>
                          </td>
                        )}
                      </tr>
                    </Fragment>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={colSpan} className="empty text-left border border-line p-4">
                      No QAP detail rows — use Load Week 50 template to import all activity lines.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <RegisterEntryModal
        open={modalOpen}
        title="Edit QAP line"
        size="xl"
        onClose={() => setModalOpen(false)}
        onSave={saveModal}
        saving={saving}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <TextArea
            className="sm:col-span-2 lg:col-span-3"
            rows={2}
            placeholder="Description of activity / material"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
          <Input placeholder="Frequency of check" value={editForm.frequency} onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })} />
          <Input placeholder="Code of conformance" value={editForm.codeOfConformance} onChange={(e) => setEditForm({ ...editForm, codeOfConformance: e.target.value })} />
          <Input placeholder="Test agency" value={editForm.testAgency} onChange={(e) => setEditForm({ ...editForm, testAgency: e.target.value })} />
          <Select value={editForm.contractorPerformer} onChange={(e) => setEditForm({ ...editForm, contractorPerformer: e.target.value })}>
            {QAP_SIGN_CONTRACTOR.map((o) => (
              <option key={o || "empty"} value={o}>
                {o || "Contractor performer —"}
              </option>
            ))}
          </Select>
          <Select value={editForm.contractorChecker} onChange={(e) => setEditForm({ ...editForm, contractorChecker: e.target.value })}>
            {QAP_SIGN_CONTRACTOR.map((o) => (
              <option key={`c-${o || "empty"}`} value={o}>
                {o || "Contractor checker —"}
              </option>
            ))}
          </Select>
          <Select value={editForm.pmcRole} onChange={(e) => setEditForm({ ...editForm, pmcRole: e.target.value })}>
            {QAP_SIGN_PMC.map((o) => (
              <option key={`p-${o || "empty"}`} value={o}>
                {o || "PMC checker —"}
              </option>
            ))}
          </Select>
          <Select value={editForm.clientRole} onChange={(e) => setEditForm({ ...editForm, clientRole: e.target.value })}>
            {QAP_SIGN_CLIENT.map((o) => (
              <option key={`cl-${o || "empty"}`} value={o}>
                {o || "Client checker —"}
              </option>
            ))}
          </Select>
          <Input placeholder="Records / documents" value={editForm.records} onChange={(e) => setEditForm({ ...editForm, records: e.target.value })} className="sm:col-span-2" />
          <TextArea className="sm:col-span-2 lg:col-span-3" rows={2} placeholder="Remarks" value={editForm.remarks} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} />
          <Select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
            <option>Open</option>
            <option>Done</option>
          </Select>
        </div>
        {dayLabels.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase text-steel-muted mb-2">Daily checks (Week 50)</div>
            <div className="flex flex-wrap gap-3">
              {dayLabels.map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={!!editDaily[d]}
                    onChange={(e) => setEditDaily({ ...editDaily, [d]: e.target.checked })}
                  />
                  {formatDayLabel(d)}
                </label>
              ))}
            </div>
          </div>
        )}
      </RegisterEntryModal>
    </>
  );
}
