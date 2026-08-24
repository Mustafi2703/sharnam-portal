import { useMemo, useState, useEffect, Fragment } from "react";
import { api } from "../api";
import {
  QAP_LEGENDS,
  QAP_SIGN_CLIENT,
  QAP_SIGN_CONTRACTOR,
  QAP_SIGN_PMC,
  qapStatusRowClass,
  remarksCellClass,
} from "../lib/inspectionRequestForms";
import { preferWeekLabel, weekMatchesFilter } from "../lib/qapWeek";
import { useLocalRegisterRows } from "../hooks/useLocalRegisterRows";
import { RegisterSheetCell } from "./RegisterSheetCell";
import { RegisterBrandHeader } from "./RegisterBrandHeader";
import { Badge, Button, Card, Select } from "./ui";

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
  id?: string;
  name?: string;
  code?: string;
  clientName?: string;
  designConsultant?: string;
  contractorName?: string;
  clientLogoUrl?: string | null;
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
};

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
}: Props) {
  const { localRows, mergeRow } = useLocalRegisterRows(rows);
  const [weekFilter, setWeekFilter] = useState("");
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
      return <span className="text-[10px] font-semibold">{text}</span>;
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

  const colSpan = 11 + dayLabels.length;

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
      <Card padding={false} className="spdc-register-panel register-editor-panel register-panel-fill relative flex flex-col flex-1 min-h-0 overflow-hidden">
        {loading && <div className="spdc-register-loading">Loading QAP register…</div>}

        <RegisterBrandHeader
          title="Quality Assurance Plan"
          project={project}
          token={token}
          canEdit={canEdit}
          onProjectUpdated={onProjectUpdated}
          legend={legend}
        />

        {patchErr && (
          <p className="text-xs text-danger bg-red-50 px-4 py-2 border-b border-line shrink-0">{patchErr}</p>
        )}

        {showWeekFilter && weeks.length > 1 && (
          <div className="px-4 py-2 border-b border-line bg-sand/40 shrink-0">
            <Select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="!w-auto min-w-[8rem]">
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="register-scroll-hint shrink-0 px-4 py-1.5 border-b border-line">
          Scroll ↔ ↕ for full sheet · every white cell is editable · saves on blur
        </div>

        <div className="sheet-register register-sheet-shell flex flex-col border-t border-line">
          <div className="sheet-register__scroll register-sheet-viewport flex-1 min-h-0 overflow-auto">
            <table className="qap-register__table register-editor-pro min-w-[96rem]">
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
                  <th rowSpan={2} className="text-left min-w-[8rem]">
                    Records and documents to be Maintained
                  </th>
                  <th rowSpan={2} className="text-left min-w-[6rem]">
                    Remarks if any
                  </th>
                  {dayLabels.map((d) => (
                    <th
                      key={d}
                      rowSpan={2}
                      className="text-center min-w-[2.5rem] align-middle"
                      title={d}
                    >
                      {formatDayLabel(d)}
                    </th>
                  ))}
                  <th rowSpan={2} className="text-left">
                    Status
                  </th>
                </tr>
                <tr>
                  <th className="spdc-th-contractor spdc-th-sub">Performer</th>
                  <th className="spdc-th-contractor spdc-th-sub">Checker</th>
                  <th className="spdc-th-pmc spdc-th-sub">Checker</th>
                  <th className="spdc-th-client spdc-th-sub">Checker</th>
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
    </>
  );
}
