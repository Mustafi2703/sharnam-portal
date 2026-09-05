import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { evaluateAllRows, normalizeCell, type SheetCell } from "@sharnam/shared";
import { api } from "../api";
import { CostRegisterShell } from "./CostRegisterShell";
import { RegisterSheetCell } from "./RegisterSheetCell";
import { RegisterEmptyRow } from "./RegisterSheetFrame";
import { Button } from "./ui";

type Props = {
  token: string;
  bidPackageId: string;
  slotId: string;
  title: string;
  sheetLabel?: string;
  canEdit: boolean;
  onSaved?: () => void;
  onClose?: () => void;
};

function colEditable(header: string, canEdit: boolean): boolean {
  if (!canEdit) return false;
  const h = String(header).toLowerCase();
  if (h.includes("description") || h.includes("sr") || h.includes("unit")) return false;
  return h.includes("rate") || h.includes("qty") || h.includes("quantity") || h.includes("weight") || h.includes("amount") || h.includes("remark");
}

function cellDisplay(cell?: SheetCell): string {
  if (!cell) return "";
  const c = cell.computed ?? cell.raw;
  return c == null ? "" : String(c);
}

/** Inline R2 BOQ register — loads via CRM slot API (auto-creates sheet if missing). */
export function CrmBidBoqRegister({
  token,
  bidPackageId,
  slotId,
  title,
  sheetLabel,
  canEdit,
  onSaved,
  onClose,
}: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetCell[][]>([]);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const s = await api<{ sheetId: string; headers: string[]; rows: unknown[][]; canWrite?: boolean }>(
        `/api/crm/bid-packages/${bidPackageId}/vendor-boq/${slotId}/sheet`,
        { token }
      );
      setSheetId(s.sheetId);
      const parsed = evaluateAllRows((s.rows || []).map((row) => row.map((cell) => normalizeCell(cell))));
      setHeaders(s.headers || []);
      setRows(parsed);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load BOQ");
      setHeaders([]);
      setRows([]);
    }
  }, [bidPackageId, slotId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCols = useMemo(() => {
    return headers
      .map((h, i) => ({ h, i }))
      .filter(({ h, i }) => {
        if (!h || /^column \d+$/i.test(h)) {
          return rows.some((r) => String(r[i]?.raw ?? "").trim());
        }
        return true;
      })
      .slice(0, 12);
  }, [headers, rows]);

  async function persist(nextRows: SheetCell[][]) {
    if (!sheetId) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/crm/bid-packages/${bidPackageId}/vendor-boq/${slotId}/sheet`, {
        method: "PUT",
        token,
        body: JSON.stringify({ headers, rows: nextRows }),
      });
      setMsg("Saved · comparative updated");
      onSaved?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function queueSave(nextRows: SheetCell[][]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(nextRows), 400);
  }

  function patchCell(rowIdx: number, colIdx: number, value: string) {
    setRows((prev) => {
      const next = prev.map((r) => r.map((c) => ({ ...c })));
      while (next.length <= rowIdx) next.push(headers.map(() => ({ raw: "" })));
      if (!next[rowIdx]) next[rowIdx] = headers.map(() => ({ raw: "" }));
      while (next[rowIdx].length <= colIdx) next[rowIdx].push({ raw: "" });
      next[rowIdx][colIdx] = { raw: value };
      const evaluated = evaluateAllRows(next);
      queueSave(evaluated);
      return evaluated;
    });
  }

  if (loadError) {
    return (
      <CostRegisterShell title={title} subtitle="BOQ load failed" sheetKind="monitoring">
        <div className="p-4 space-y-3">
          <p className="text-sm text-warn">{loadError}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
            {onClose && (
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </CostRegisterShell>
    );
  }

  return (
    <CostRegisterShell
      title={title}
      subtitle={sheetLabel ? `${sheetLabel} · R2 discipline BOQ` : "R2 discipline BOQ · white cells editable"}
      sheetKind="monitoring"
      toolbar={
        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-steel-muted">
            {rows.length} rows · {canEdit ? "Edit rates / qty / amount — saves on blur" : "Read-only"}
          </span>
          <div className="flex gap-2">
            {msg && <span className="text-ok font-semibold">{msg}</span>}
            {busy && <span className="text-steel-muted">Saving…</span>}
            {onClose && (
              <Button type="button" variant="secondary" className="!text-xs !py-1" onClick={onClose}>
                Close BOQ
              </Button>
            )}
          </div>
        </div>
      }
    >
      <table className="sheet-register__table min-w-max">
        <thead>
          <tr>
            {visibleCols.map(({ h, i }) => (
              <th key={i} className="text-left whitespace-nowrap">
                {h || `Col ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!rows.length && <RegisterEmptyRow colSpan={visibleCols.length || 1} message="Loading BOQ template…" />}
          {rows.map((row, ri) => {
            const line = row.map((c) => String(c.raw ?? "")).join(" ").trim();
            if (!line) return null;
            return (
              <tr key={ri}>
                {visibleCols.map(({ h, i }) => (
                  <td key={i} className="align-top">
                    <RegisterSheetCell
                      value={cellDisplay(row[i])}
                      disabled={!colEditable(h, canEdit)}
                      type={
                        h.toLowerCase().includes("rate") ||
                        h.toLowerCase().includes("qty") ||
                        h.toLowerCase().includes("amount")
                          ? "number"
                          : "text"
                      }
                      className="min-w-[4rem]"
                      onCommit={(v) => patchCell(ri, i, v)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </CostRegisterShell>
  );
}
