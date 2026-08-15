/**
 * Measurement book — inline editable rows (SPDC MB sheet columns).
 */
import { useState } from "react";
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

const HEADERS = [
  "Package",
  "Sr No.",
  "Item code",
  "Description",
  "No",
  "No",
  "Length",
  "Width",
  "Height",
  "Qty.",
  "UoM.",
  "RA Bill",
  "Remark",
  "",
] as const;

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
    <div className="sheet-register w-full space-y-2">
      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}
      <div className="sheet-register__head">
        <span>Measurement book (MB)</span>
        <span className="text-steel-muted font-normal normal-case tracking-normal">{rows.length} rows · click cells to edit</span>
      </div>
      <div className="sheet-register__scroll">
        <table className="sheet-register__table">
          <thead>
            <tr>
              {HEADERS.map((h, i) => (
                <th key={`${h}-${i}`} className={i === 0 ? "sticky-col" : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className={busyId === b.id ? "opacity-60" : undefined}>
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
                <td>
                  {canEditDims ? (
                    <CellInput value={b.itemCode} onCommit={(v) => void patchLine(b.id, { itemCode: v })} />
                  ) : (
                    b.itemCode || b.srNo || "—"
                  )}
                </td>
                <td className="wrap min-w-[160px]">
                  {canEditDims ? (
                    <CellInput value={b.description} onCommit={(v) => void patchLine(b.id, { description: v })} />
                  ) : (
                    b.description
                  )}
                </td>
                <td>
                  {canEditDims ? (
                    <CellInput type="number" value={b.nos1} onCommit={(v) => void patchLine(b.id, { nos1: Number(v) || 0 })} />
                  ) : (
                    formatQty(b.nos1)
                  )}
                </td>
                <td>
                  {canEditDims ? (
                    <CellInput type="number" value={b.nos2} onCommit={(v) => void patchLine(b.id, { nos2: Number(v) || 0 })} />
                  ) : (
                    formatQty(b.nos2)
                  )}
                </td>
                <td>
                  {canEditDims ? (
                    <CellInput type="number" value={b.length} onCommit={(v) => void patchLine(b.id, { length: Number(v) || 0 })} />
                  ) : (
                    formatQty(b.length)
                  )}
                </td>
                <td>
                  {canEditDims ? (
                    <CellInput type="number" value={b.width} onCommit={(v) => void patchLine(b.id, { width: Number(v) || 0 })} />
                  ) : (
                    formatQty(b.width)
                  )}
                </td>
                <td>
                  {canEditDims ? (
                    <CellInput type="number" value={b.height} onCommit={(v) => void patchLine(b.id, { height: Number(v) || 0 })} />
                  ) : (
                    formatQty(b.height)
                  )}
                </td>
                <td>
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
            {!rows.length && (
              <tr>
                <td colSpan={HEADERS.length} className="empty">
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
