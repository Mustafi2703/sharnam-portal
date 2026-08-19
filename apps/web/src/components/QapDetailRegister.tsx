import { useMemo, useState, Fragment } from "react";
import { api } from "../api";
import { QAP_LEGENDS, remarksCellClass } from "../lib/inspectionRequestForms";
import { Badge, Button, Card, Input, Select } from "./ui";

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
};

/** Quality Assurance Plan — client Excel layout (header, legends, activity grid, remarks colour). */
export function QapDetailRegister({
  projectId,
  token,
  rows,
  canEdit,
  onUpdated,
  showWeekFilter = true,
  project,
}: Props) {
  const weeks = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.weekLabel && set.add(r.weekLabel));
    return Array.from(set).sort().reverse();
  }, [rows]);
  const [weekFilter, setWeekFilter] = useState(weeks[0] || "");

  const filtered = useMemo(() => {
    if (!showWeekFilter || !weekFilter) return rows;
    return rows.filter((r) => r.weekLabel === weekFilter);
  }, [rows, weekFilter, showWeekFilter]);

  const dayLabels = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (!r.dailyChecks) continue;
      try {
        Object.keys(JSON.parse(r.dailyChecks)).forEach((k) => set.add(k));
      } catch {
        /* ignore */
      }
    }
    return Array.from(set).sort();
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, QapRow[]>();
    for (const row of filtered) {
      const key = `${row.srNo || ""}|${row.section || row.activity || "General"}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function parseDaily(q: QapRow): Record<string, boolean> {
    if (!q.dailyChecks) return {};
    try {
      return JSON.parse(q.dailyChecks) as Record<string, boolean>;
    } catch {
      return {};
    }
  }

  async function patchRow(id: string, body: Record<string, unknown>) {
    await api(`/api/checklist/project/${projectId}/qap/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    await onUpdated();
  }

  const pmConsultant = "Sharnam Project Management Consultants";
  const colSpan = 11 + dayLabels.length + 1;

  return (
    <Card padding={false} className="overflow-hidden">
      {/* Excel-style header block */}
      <div className="border-b border-line bg-white">
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
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] leading-tight px-1">
              {QAP_LEGENDS.map(([abbr, full]) => (
                <div key={abbr} className="truncate" title={full}>
                  <span className="font-bold text-brand-dark">{abbr}</span>
                  <span className="text-steel-muted"> — {full}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 text-xs border-b border-line">
          {[
            ["Project", project?.name || "—"],
            ["Client", project?.clientName || "—"],
            ["Design Consultant", project?.designConsultant || "—"],
            ["PM Consultant", pmConsultant],
            ["Contractor", project?.contractorName || "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex border-r border-line last:border-r-0">
              <span className="shrink-0 px-2 py-1.5 bg-sand/60 font-semibold text-steel-muted min-w-[7rem] border-r border-line">
                {label}
              </span>
              <span className="px-2 py-1.5 text-ink truncate" title={String(value)}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-steel-muted text-left">
          Same grid as client QAP Week 50 — activity, frequency, conformance, contractor / PMC / client sign-off, records & remarks.
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

      <div className="sheet-register overflow-x-auto max-h-[72vh]">
        <table className="sheet-register__table min-w-[88rem] w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-brand text-white">
              <th rowSpan={2} className="text-left w-10 border border-brand-dark/30 px-1 py-1">
                Sr.No.
              </th>
              <th rowSpan={2} className="text-left min-w-[8rem] border border-brand-dark/30 px-1 py-1">
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
              {dayLabels.length > 0 && (
                <th rowSpan={2} colSpan={dayLabels.length} className="text-center border border-brand-dark/30 px-1 py-1">
                  Daily checks
                </th>
              )}
              <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                Status
              </th>
            </tr>
            <tr className="bg-brand text-white text-[10px]">
              <th className="border border-brand-dark/30 px-1 py-0.5">Performer</th>
              <th className="border border-brand-dark/30 px-1 py-0.5">Checker</th>
              <th className="border border-brand-dark/30 px-1 py-0.5 bg-emerald-800/40">Checker</th>
              <th className="border border-brand-dark/30 px-1 py-0.5 bg-amber-900/40">Checker</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([groupKey, sectionRows]) => {
              const first = sectionRows[0];
              const activityLabel = first.section || first.activity || groupKey.split("|")[1] || "General";
              const srNo = first.srNo || "";
              return (
                <Fragment key={groupKey}>
                  {sectionRows.map((q, idx) => (
                    <tr key={q.id} className={idx % 2 === 0 ? "bg-white" : "bg-sand/20"}>
                      <td className="text-left font-mono tabular-nums border border-line px-1 py-0.5 align-top">
                        {idx === 0 ? srNo || "·" : ""}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5 font-semibold text-brand-dark">
                        {idx === 0 ? activityLabel : ""}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5">
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[11rem]"
                            defaultValue={q.description || q.activity}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v === (q.description || q.activity)) return;
                              void patchRow(q.id, { description: v });
                            }}
                          />
                        ) : (
                          q.description || q.activity
                        )}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5">
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[6rem]"
                            defaultValue={q.frequency || ""}
                            onBlur={(e) => {
                              if (e.target.value === (q.frequency || "")) return;
                              void patchRow(q.id, { frequency: e.target.value });
                            }}
                          />
                        ) : (
                          q.frequency || "—"
                        )}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5">
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[7rem]"
                            defaultValue={q.codeOfConformance || ""}
                            onBlur={(e) => {
                              if (e.target.value === (q.codeOfConformance || "")) return;
                              void patchRow(q.id, { codeOfConformance: e.target.value });
                            }}
                          />
                        ) : (
                          q.codeOfConformance || "—"
                        )}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5">
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[6rem]"
                            defaultValue={q.testAgency || ""}
                            onBlur={(e) => {
                              if (e.target.value === (q.testAgency || "")) return;
                              void patchRow(q.id, { testAgency: e.target.value });
                            }}
                          />
                        ) : (
                          q.testAgency || "—"
                        )}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5 bg-blue-50/50">
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[4.5rem] bg-white"
                            defaultValue={q.contractorPerformer || ""}
                            onBlur={(e) => {
                              if (e.target.value === (q.contractorPerformer || "")) return;
                              void patchRow(q.id, {
                                contractorPerformer: e.target.value,
                                contractorOk: !!(e.target.value || q.contractorChecker),
                              });
                            }}
                          />
                        ) : (
                          q.contractorPerformer || "—"
                        )}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5 bg-blue-50/50">
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[4.5rem] bg-white"
                            defaultValue={q.contractorChecker || ""}
                            onBlur={(e) => {
                              if (e.target.value === (q.contractorChecker || "")) return;
                              void patchRow(q.id, {
                                contractorChecker: e.target.value,
                                contractorOk: !!(e.target.value || q.contractorPerformer),
                              });
                            }}
                          />
                        ) : (
                          q.contractorChecker || "—"
                        )}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5 bg-emerald-50/60">
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[4.5rem] bg-white"
                            defaultValue={q.pmcRole || ""}
                            onBlur={(e) => {
                              if (e.target.value === (q.pmcRole || "")) return;
                              void patchRow(q.id, {
                                pmcRole: e.target.value,
                                pmcOk: /review|witness|yes|approve/i.test(e.target.value),
                              });
                            }}
                          />
                        ) : (
                          q.pmcRole || (q.pmcOk ? "✓" : "·")
                        )}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5 bg-amber-50/60">
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[4.5rem] bg-white"
                            defaultValue={q.clientRole || ""}
                            onBlur={(e) => {
                              if (e.target.value === (q.clientRole || "")) return;
                              void patchRow(q.id, {
                                clientRole: e.target.value,
                                clientOk: /witness|random|yes|approve/i.test(e.target.value),
                              });
                            }}
                          />
                        ) : (
                          q.clientRole || (q.clientOk ? "✓" : "·")
                        )}
                      </td>
                      <td className="text-left align-top border border-line px-1 py-0.5">
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[7rem]"
                            defaultValue={q.records || ""}
                            onBlur={(e) => {
                              if (e.target.value === (q.records || "")) return;
                              void patchRow(q.id, { records: e.target.value });
                            }}
                          />
                        ) : (
                          q.records || "—"
                        )}
                      </td>
                      <td className={`text-left align-top border border-line px-1 py-0.5 ${remarksCellClass(q.remarks)}`}>
                        {canEdit ? (
                          <Input
                            className="!py-0.5 !text-[11px] min-w-[5rem] bg-white/80"
                            defaultValue={q.remarks || ""}
                            onBlur={(e) => {
                              if (e.target.value === (q.remarks || "")) return;
                              void patchRow(q.id, { remarks: e.target.value });
                            }}
                          />
                        ) : (
                          q.remarks || "—"
                        )}
                      </td>
                      {dayLabels.map((d) => {
                        const daily = parseDaily(q);
                        const checked = !!daily[d];
                        return (
                          <td key={d} className="text-center align-top border border-line px-0.5 py-0.5">
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
                            onClick={() => void patchRow(q.id, { status: "Done", remarks: q.remarks || "Completed" })}
                          >
                            Done
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {!grouped.length && (
              <tr>
                <td colSpan={colSpan} className="empty text-left border border-line p-4">
                  No QAP detail rows — re-run <code>npm run db:seed</code> with Quality Assurance Plan Week 50 workbook.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
