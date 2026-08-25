/**
 * Measurement book — SPDC MB sheet (cube-style register, inline editable).
 */
import { useState } from "react";
import { api } from "../api";
import { Button } from "./ui";
import { formatQty } from "./BoqMonitoringEditor";
import { CostRegisterShell } from "./CostRegisterShell";
import { RegisterSheetCell } from "./RegisterSheetCell";
import { MB_COLUMN_GROUPS, mbColClass } from "../lib/costSheetColumns";
import { mbBandEmpty, MB_DATA_COLS } from "../lib/costBandRows";
import { mbRowBandClass, mbRowKind, type MbRowKind } from "../lib/costSheetRows";

export type MbRow = {
  id: string;
  packageName: string;
  srNo?: string | null;
  itemCode?: string | null;
  description: string;
  rowKind?: string | null;
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
  singlePackage?: string;
  canFullEdit: boolean;
  canSiteEdit: boolean;
  onChanged: () => void;
};

function mbDimEmpty(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => mbBandEmpty(from + i, `mb-d-${from + i}`));
}

function bandLabel(kind: MbRowKind, b: MbRow) {
  if (kind === "total") return <span className="boq-total-label">{b.description}</span>;
  if (kind === "description") return <span className="boq-desc-label">{b.description}</span>;
  const labelClass =
    kind === "item" ? "boq-section-label" : kind === "subsection" || kind === "subitem" ? "boq-subsection-label" : "boq-note-label";
  return (
    <span className={labelClass}>
      {kind === "subitem" ? "" : b.srNo ? `${b.srNo} · ` : ""}
      {b.description}
      {b.remark ? ` — ${b.remark}` : ""}
    </span>
  );
}

export function MbEntryTable({ projectId, token, rows, singlePackage, canFullEdit, canSiteEdit, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const canEditDims = canFullEdit || canSiteEdit;
  const colSpan = MB_DATA_COLS + 1;

  function bandRow(b: MbRow) {
    const kind = mbRowKind(b);
    const cls = mbRowBandClass(kind);

    if (kind === "total") {
      return (
        <tr key={b.id} className={cls}>
          {mbBandEmpty(0, "p")}
          {mbBandEmpty(1, "sr")}
          <td className={mbColClass(2, { sticky: true, extra: "text-left" })}>{bandLabel(kind, b)}</td>
          {mbDimEmpty(3, 7)}
          <td className={mbColClass(8, { extra: "text-left num font-semibold" })}>{b.qty ? formatQty(Number(b.qty)) : "—"}</td>
          <td className={mbColClass(9, { extra: "text-left" })}>{b.unit || "—"}</td>
          {mbBandEmpty(10, "ra")}
          {mbBandEmpty(11, "rm")}
          <td className="w-12" />
        </tr>
      );
    }

    const descExtra = kind === "subitem" ? "pl-5" : kind === "subsection" ? "pl-2" : "";
    return (
      <tr key={b.id} className={cls}>
        {mbBandEmpty(0, "p")}
        <td className={mbColClass(1, { extra: "text-left font-mono" })}>{b.srNo || "\u00a0"}</td>
        <td className={mbColClass(2, { sticky: true, extra: `text-left ${descExtra}` })}>{bandLabel(kind, b)}</td>
        {mbDimEmpty(3, 11)}
        <td className="w-12" />
      </tr>
    );
  }

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

  function cell(
    value: string | number | null | undefined,
    onSave: (v: string) => void,
    opts?: { type?: string; numeric?: boolean; disabled?: boolean; className?: string }
  ) {
    if (opts?.disabled) {
      if (opts.numeric && value != null && value !== "") {
        return <span className="cube-num tabular-nums">{formatQty(Number(value))}</span>;
      }
      return <span>{value ?? "—"}</span>;
    }
    return (
      <RegisterSheetCell
        type={opts?.type || (opts?.numeric ? "number" : "text")}
        value={opts?.numeric ? formatQty(Number(value) || 0) : String(value ?? "")}
        className={opts?.className}
        onCommit={onSave}
      />
    );
  }

  return (
    <CostRegisterShell
      sheetKind="mb"
      title={`Measurement Book (MB)${singlePackage ? ` — ${singlePackage}` : ""}`}
      subtitle={`${rows.length} lines · SPDC MB format — Sr · Description · Nos × L × W × H · Qty · UoM · RA-Bill · Remark`}
      footer={msg ? <p className="text-sm text-brand-dark bg-brand-soft px-4 py-2">{msg}</p> : undefined}
    >
      <table className="cube-register__table register-editor-pro cost-register-table min-w-[92rem]">
        <thead className="cost-register-thead">
          <tr className="cost-col-group-row">
            {MB_COLUMN_GROUPS.map((g) => (
              <th key={g.key} colSpan={g.to - g.from + 1} className={`cost-col-group cost-col--${g.key}`}>
                {g.label}
              </th>
            ))}
            <th rowSpan={2} className="w-12" />
          </tr>
          <tr>
            <th className={mbColClass(0, { sticky: true, extra: "text-left" })}>Package</th>
            <th className={mbColClass(1, { extra: "text-left" })}>SR No.</th>
            <th className={mbColClass(2, { extra: "text-left min-w-[12rem]" })}>Description</th>
            <th className={mbColClass(3, { extra: "text-center num" })}>No</th>
            <th className={mbColClass(4, { extra: "text-center num" })}>No</th>
            <th className={mbColClass(5, { extra: "text-left num" })}>Length</th>
            <th className={mbColClass(6, { extra: "text-left num" })}>Width</th>
            <th className={mbColClass(7, { extra: "text-left num" })}>Height</th>
            <th className={mbColClass(8, { extra: "text-left num" })}>Qty</th>
            <th className={mbColClass(9, { extra: "text-left" })}>UoM</th>
            <th className={mbColClass(10, { extra: "text-left" })}>RA-Bill</th>
            <th className={mbColClass(11, { extra: "text-left min-w-[8rem]" })}>Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const kind = mbRowKind(b);
            if (kind !== "data") {
              return bandRow(b);
            }
            return (
              <tr key={b.id} className={`boq-line-row ${busyId === b.id ? "opacity-60" : ""}`}>
                <td className={mbColClass(0, { sticky: true, extra: "text-left align-top" })}>
                  {cell(b.packageName, (v) => void patchLine(b.id, { packageName: v }), { disabled: !canFullEdit })}
                </td>
                <td className={mbColClass(1, { extra: "text-left align-top font-mono" })}>
                  {cell(b.srNo, (v) => void patchLine(b.id, { srNo: v }), { disabled: !canEditDims })}
                </td>
                <td className={mbColClass(2, { extra: "text-left align-top min-w-[12rem]" })}>
                  {cell(b.description, (v) => void patchLine(b.id, { description: v }), {
                    disabled: !canEditDims,
                    className: "min-w-[10rem] cost-row-desc",
                  })}
                </td>
                <td className={mbColClass(3, { extra: "text-left align-top num" })}>
                  {cell(b.nos1, (v) => void patchLine(b.id, { nos1: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                </td>
                <td className={mbColClass(4, { extra: "text-left align-top num" })}>
                  {cell(b.nos2, (v) => void patchLine(b.id, { nos2: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                </td>
                <td className={mbColClass(5, { extra: "text-left align-top num" })}>
                  {cell(b.length, (v) => void patchLine(b.id, { length: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                </td>
                <td className={mbColClass(6, { extra: "text-left align-top num" })}>
                  {cell(b.width, (v) => void patchLine(b.id, { width: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                </td>
                <td className={mbColClass(7, { extra: "text-left align-top num" })}>
                  {cell(b.height, (v) => void patchLine(b.id, { height: Number(v) || 0 }), { numeric: true, disabled: !canEditDims })}
                </td>
                <td className={mbColClass(8, { extra: "text-left align-top num font-medium" })}>
                  {cell(b.qty, (v) => void patchLine(b.id, { qty: Number(v) || 0 }), { numeric: true, disabled: !canFullEdit })}
                </td>
                <td className={mbColClass(9, { extra: "text-left align-top" })}>
                  {cell(b.unit, (v) => void patchLine(b.id, { unit: v }), { disabled: !canFullEdit })}
                </td>
                <td className={mbColClass(10, { extra: "text-left align-top" })}>
                  {cell(b.raBill, (v) => void patchLine(b.id, { raBill: v }), { disabled: !canFullEdit })}
                </td>
                <td className={mbColClass(11, { extra: "text-left align-top" })}>
                  {cell(b.remark, (v) => void patchLine(b.id, { remark: v }), { disabled: !canEditDims, className: "min-w-[6rem]" })}
                </td>
                <td className="text-left align-top">
                  {canFullEdit && (
                    <Button type="button" variant="ghost" className="!text-xs !py-0.5" onClick={() => void deleteLine(b.id)}>
                      Del
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={colSpan} className="empty text-left p-6">
                No MB rows — pick a package above, upload an MB sheet in setup, or add a row.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </CostRegisterShell>
  );
}
