/**
 * Measurement book — inline editable rows (SPDC MB sheet columns).
 */
import { Fragment, useMemo, useState } from "react";
import { api } from "../api";
import { Button } from "./ui";
import { formatQty } from "./BoqMonitoringEditor";

export type MbRow = {
  id: string;
  packageName: string;
  srNo?: string | null;
  itemCode?: string | null;
  description: string;
  nos1?: number;
  nos2?: number;
  length?: number;
  width?: number;
  height?: number;
  qty?: number;
  unit?: string | null;
  raBill?: string | null;
  remark?: string | null;
};

type Props = {
  projectId: string;
  token?: string | null;
  rows: MbRow[];
  canFullEdit: boolean;
  canSiteEdit: boolean;
  onChanged: () => void;
};

function CellInput({
  value,
  disabled,
  type = "text",
  className = "",
  onCommit,
}: {
  value: string | number | null | undefined;
  disabled?: boolean;
  type?: string;
  className?: string;
  onCommit: (v: string) => void;
}) {
  return (
    <input
      type={type}
      disabled={disabled}
      defaultValue={type === "number" ? formatQty(Number(value) || 0) : String(value ?? "")}
      className={`boq-cell-input ${className}`}
      step={type === "number" ? "any" : undefined}
      onBlur={(e) => {
        const next = e.target.value;
        const prev = type === "number" ? formatQty(Number(value) || 0) : String(value ?? "");
        if (next !== prev) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function MbEntryTable({ projectId, token, rows, canFullEdit, canSiteEdit, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const canEditDims = canFullEdit || canSiteEdit;

  const grouped = useMemo(() => {
    const map = new Map<string, MbRow[]>();
    let lastHeading = "";
    for (const r of rows) {
      const sr = String(r.srNo || "").trim();
      const looksHeading = !sr || !/^\d/.test(sr);
      if (looksHeading && r.description) lastHeading = r.description;
      const key = r.itemCode || lastHeading || r.packageName || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()];
  }, [rows]);

  async function patchLine(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setMsg("");
    try {
      await api(`/api/cost/${projectId}/mb/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteLine(id: string) {
    if (!window.confirm("Delete this MB line?")) return;
    setBusyId(id);
    try {
      await api(`/api/cost/${projectId}/mb/${id}`, { method: "DELETE", token });
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="sheet-register w-full mb-entry-panel min-h-[20rem] flex flex-col">
      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}
      <div className="sheet-register__head">
        <span>Measurement book (MB) — SPDC columns</span>
        <span className="text-steel-muted font-normal normal-case tracking-normal">
          {rows.length} rows · grouped by item / heading · click cells to edit
        </span>
      </div>
      <div className="sheet-register__scroll min-h-[20rem]">
        <table className="sheet-register__table">
          <thead>
            <tr>
              <th className="sticky-col" rowSpan={2}>Package</th>
              <th rowSpan={2}>SR No.</th>
              <th rowSpan={2}>Description</th>
              <th colSpan={2}>No</th>
              <th rowSpan={2} className="num">Length</th>
              <th rowSpan={2} className="num">Width</th>
              <th rowSpan={2} className="num">Height</th>
              <th rowSpan={2} className="num">Qty.</th>
              <th rowSpan={2}>UoM.</th>
              <th rowSpan={2}>RA-BILL</th>
              <th rowSpan={2}>Remark</th>
              <th rowSpan={2} />
            </tr>
            <tr>
              <th className="num">No</th>
              <th className="num">No</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([heading, items]) => (
              <Fragment key={heading}>
                <tr className="boq-section-row">
                  <td colSpan={13} className="sticky-col">
                    <span className="boq-section-label">{heading}</span>
                  </td>
                </tr>
                {items.map((b) => (
                  <tr key={b.id} className={`boq-line-row ${busyId === b.id ? "opacity-60" : ""}`}>
                    <td className="sticky-col wrap">
                      {canFullEdit ? (
                        <CellInput value={b.packageName} onCommit={(v) => void patchLine(b.id, { packageName: v })} />
                      ) : (
                        b.packageName
                      )}
                    </td>
                    <td>
                      {canEditDims ? (
                        <CellInput value={b.srNo} onCommit={(v) => void patchLine(b.id, { srNo: v })} />
                      ) : (
                        b.srNo || "—"
                      )}
                    </td>
                    <td className="wrap min-w-[160px]">
                      {canEditDims ? (
                        <CellInput value={b.description} onCommit={(v) => void patchLine(b.id, { description: v })} />
                      ) : (
                        b.description
                      )}
                    </td>
                    <td className="num">
                      {canEditDims ? (
                        <CellInput type="number" value={b.nos1} onCommit={(v) => void patchLine(b.id, { nos1: Number(v) || 0 })} />
                      ) : (
                        formatQty(b.nos1)
                      )}
                    </td>
                    <td className="num">
                      {canEditDims ? (
                        <CellInput type="number" value={b.nos2} onCommit={(v) => void patchLine(b.id, { nos2: Number(v) || 0 })} />
                      ) : (
                        formatQty(b.nos2)
                      )}
                    </td>
                    <td className="num">
                      {canEditDims ? (
                        <CellInput type="number" value={b.length} onCommit={(v) => void patchLine(b.id, { length: Number(v) || 0 })} />
                      ) : (
                        formatQty(b.length)
                      )}
                    </td>
                    <td className="num">
                      {canEditDims ? (
                        <CellInput type="number" value={b.width} onCommit={(v) => void patchLine(b.id, { width: Number(v) || 0 })} />
                      ) : (
                        formatQty(b.width)
                      )}
                    </td>
                    <td className="num">
                      {canEditDims ? (
                        <CellInput type="number" value={b.height} onCommit={(v) => void patchLine(b.id, { height: Number(v) || 0 })} />
                      ) : (
                        formatQty(b.height)
                      )}
                    </td>
                    <td className="num">
                      {canFullEdit ? (
                        <CellInput type="number" value={b.qty} onCommit={(v) => void patchLine(b.id, { qty: Number(v) || 0 })} />
                      ) : (
                        formatQty(b.qty)
                      )}
                    </td>
                    <td>
                      {canFullEdit ? (
                        <CellInput value={b.unit} onCommit={(v) => void patchLine(b.id, { unit: v })} />
                      ) : (
                        b.unit || "—"
                      )}
                    </td>
                    <td>
                      {canFullEdit ? (
                        <CellInput value={b.raBill} onCommit={(v) => void patchLine(b.id, { raBill: v })} />
                      ) : (
                        b.raBill || "—"
                      )}
                    </td>
                    <td className="wrap">
                      {canEditDims ? (
                        <CellInput value={b.remark} onCommit={(v) => void patchLine(b.id, { remark: v })} />
                      ) : (
                        b.remark || "—"
                      )}
                    </td>
                    <td>
                      {canFullEdit && (
                        <Button type="button" variant="ghost" className="!text-xs !py-0.5" onClick={() => void deleteLine(b.id)}>
                          Del
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={13} className="empty">
                  No MB rows — import from master, upload Excel, or add a line above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
