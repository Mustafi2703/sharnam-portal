import { useMemo, useState, Fragment } from "react";
import { api } from "../api";
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
  contractorOk?: boolean;
  pmcOk?: boolean;
  clientOk?: boolean;
  status?: string;
};

type Props = {
  projectId: string;
  token?: string | null;
  rows: QapRow[];
  canEdit: boolean;
  onUpdated: () => void | Promise<void>;
  showWeekFilter?: boolean;
};

/** Quality Assurance Plan - Detail sheet layout (matches client Excel). */
export function QapDetailRegister({ projectId, token, rows, canEdit, onUpdated, showWeekFilter = true }: Props) {
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

  const grouped = useMemo(() => {
    const map = new Map<string, QapRow[]>();
    for (const row of filtered) {
      const key = row.section || row.activity || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries());
  }, [filtered]);

  async function patchRow(id: string, body: Record<string, unknown>) {
    await api(`/api/checklist/project/${projectId}/qap/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    await onUpdated();
  }

  return (
    <Card padding={false}>
      <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm text-left">Quality Assurance Plan — Detail</h3>
          <p className="text-xs text-steel-muted mt-1 text-left">
            Same columns as client QAP sheet — activity sections, frequency, conformance code, contractor / PMC / client sign-off, records & remarks.
          </p>
        </div>
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

      <div className="sheet-register overflow-x-auto max-h-[70vh]">
        <table className="sheet-register__table min-w-[72rem] w-full text-xs">
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr>
              <th className="text-left w-12">Sr</th>
              <th className="text-left min-w-[10rem]">Description / Material</th>
              <th className="text-left min-w-[7rem]">Frequency</th>
              <th className="text-left min-w-[8rem]">Code</th>
              <th className="text-left min-w-[7rem]">Test agency</th>
              <th className="text-left">Ctr performer</th>
              <th className="text-left">Ctr checker</th>
              <th className="text-left">PMC</th>
              <th className="text-left">Client</th>
              <th className="text-left min-w-[8rem]">Records</th>
              <th className="text-left min-w-[7rem]">Remarks</th>
              <th className="text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([section, sectionRows]) => (
              <Fragment key={section}>
                <tr className="bg-brand-soft/40">
                  <td colSpan={12} className="text-left font-semibold text-brand-dark py-2 px-3">
                    {section}
                  </td>
                </tr>
                {sectionRows.map((q) => (
                  <tr key={q.id}>
                    <td className="text-left font-mono tabular-nums">{q.srNo || "·"}</td>
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[10rem]"
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
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[6rem]"
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
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[7rem]"
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
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[6rem]"
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
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[5rem]"
                          defaultValue={q.contractorPerformer || ""}
                          onBlur={(e) => {
                            if (e.target.value === (q.contractorPerformer || "")) return;
                            void patchRow(q.id, { contractorPerformer: e.target.value, contractorOk: !!e.target.value });
                          }}
                        />
                      ) : (
                        q.contractorPerformer || "—"
                      )}
                    </td>
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[5rem]"
                          defaultValue={q.contractorChecker || ""}
                          onBlur={(e) => {
                            if (e.target.value === (q.contractorChecker || "")) return;
                            void patchRow(q.id, { contractorChecker: e.target.value, contractorOk: !!e.target.value });
                          }}
                        />
                      ) : (
                        q.contractorChecker || "—"
                      )}
                    </td>
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[5rem]"
                          defaultValue={q.pmcRole || ""}
                          onBlur={(e) => {
                            if (e.target.value === (q.pmcRole || "")) return;
                            void patchRow(q.id, { pmcRole: e.target.value, pmcOk: /review|witness|yes/i.test(e.target.value) });
                          }}
                        />
                      ) : (
                        q.pmcRole || (q.pmcOk ? "✓" : "·")
                      )}
                    </td>
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[5rem]"
                          defaultValue={q.clientRole || ""}
                          onBlur={(e) => {
                            if (e.target.value === (q.clientRole || "")) return;
                            void patchRow(q.id, { clientRole: e.target.value, clientOk: /witness|random|yes/i.test(e.target.value) });
                          }}
                        />
                      ) : (
                        q.clientRole || (q.clientOk ? "✓" : "·")
                      )}
                    </td>
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[7rem]"
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
                    <td className="text-left align-top">
                      {canEdit ? (
                        <Input
                          className="!py-1 !text-xs min-w-[6rem]"
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
                    <td className="text-left align-top whitespace-nowrap">
                      <Badge tone={q.status === "Done" ? "ok" : "warn"}>{q.status || "Open"}</Badge>
                      {canEdit && q.status !== "Done" && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="!py-0.5 !px-1.5 !text-[10px] ml-1"
                          onClick={() => void patchRow(q.id, { status: "Done", pmcOk: true, clientOk: true })}
                        >
                          Done
                        </Button>
                      )}
                      {canEdit && q.status === "Done" && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="!py-0.5 !px-1.5 !text-[10px] ml-1"
                          onClick={() => void patchRow(q.id, { status: "Open" })}
                        >
                          Reopen
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {!grouped.length && (
              <tr>
                <td colSpan={12} className="empty text-left">
                  No QAP detail rows — re-run <code>npm run db:seed</code> with Quality Dashboard / Week 50 workbooks.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
