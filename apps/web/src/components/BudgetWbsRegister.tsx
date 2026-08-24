import { useEffect, useRef, useState } from "react";
import { api, formatINR } from "../api";
import { Button, Card, Input, TextArea } from "./ui";

export type BudgetLine = {
  id: string;
  srNo?: string | null;
  description: string;
  stakeholder?: string | null;
  budgetedAmount: number;
  workOrderAmount: number;
  certifiedAmount: number;
  forecastedAmount: number;
  forecastReduction?: number;
  nonTendered?: number;
  steelExcess?: number;
  steelSaving?: number;
  cementExcess?: number;
  cementSaving?: number;
  tilesExcess?: number;
  tilesSaving?: number;
  grossTotal?: number;
  remarks?: string | null;
};

type Props = {
  projectId: string;
  token: string | null;
  rows: BudgetLine[];
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
};

const empty = () => ({
  srNo: "",
  description: "",
  stakeholder: "",
  budgetedAmount: 0,
  workOrderAmount: 0,
  certifiedAmount: 0,
  forecastedAmount: 0,
  forecastReduction: 0,
  nonTendered: 0,
  steelExcess: 0,
  steelSaving: 0,
  cementExcess: 0,
  cementSaving: 0,
  tilesExcess: 0,
  tilesSaving: 0,
  grossTotal: 0,
  remarks: "",
});

function CellNum({
  value,
  disabled,
  onCommit,
}: {
  value: number | null | undefined;
  disabled?: boolean;
  onCommit: (n: number) => void;
}) {
  return (
    <input
      type="number"
      step="any"
      disabled={disabled}
      defaultValue={Number(value) || 0}
      className="boq-cell-input"
      onBlur={(e) => {
        const n = Number(e.target.value) || 0;
        if (n !== (Number(value) || 0)) onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** SPDC Budget WBS — full columns from Budget tab + add line + load template. */
export function BudgetWbsRegister({ projectId, token, rows, canEdit, onChanged }: Props) {
  const [form, setForm] = useState(empty());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const autoSyncRef = useRef(false);

  useEffect(() => {
    if (!canEdit || autoSyncRef.current || !projectId) return;
    if (rows.length >= 5) return;
    autoSyncRef.current = true;
    void syncTemplate(true);
  }, [canEdit, rows.length, projectId]);

  async function syncTemplate(silent = false) {
    setBusy(true);
    if (!silent) setMsg("");
    try {
      const out = await api<{ budget: number; monitoring: number; mb: number; bbs: number; source: string }>(
        `/api/cost/${projectId}/sync-template`,
        { method: "POST", token }
      );
      setMsg(
        `Loaded ${out.source}: Budget ${out.budget} · Monitoring ${out.monitoring} · MB ${out.mb} · BBS ${out.bbs}`
      );
      await onChanged();
    } catch (e: any) {
      if (!silent) setMsg(e?.message || "Template sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, patch: Record<string, unknown>) {
    setSavingId(id);
    try {
      await api(`/api/cost/budget/${id}`, { method: "PATCH", token, body: JSON.stringify(patch) });
      await onChanged();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function addLine() {
    if (!form.description.trim()) {
      setMsg("Description is required");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/cost/${projectId}/budget`, {
        method: "POST",
        token,
        body: JSON.stringify({
          ...form,
          srNo: form.srNo || null,
          stakeholder: form.stakeholder || null,
          remarks: form.remarks || null,
        }),
      });
      setForm(empty());
      setMsg("Budget line added");
      await onChanged();
    } catch (e: any) {
      setMsg(e?.message || "Could not add line");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this budget line?")) return;
    setSavingId(id);
    try {
      await api(`/api/cost/budget/${id}`, { method: "DELETE", token });
      await onChanged();
    } catch (e: any) {
      setMsg(e?.message || "Delete failed");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="register-page-fill flex flex-col gap-4 min-w-0">
      {msg && <p className="text-sm text-brand font-medium shrink-0">{msg}</p>}

      {canEdit && (
        <Card className="!p-4 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm">Budget WBS — SPDC columns</h3>
              <p className="text-xs text-steel-muted mt-0.5">
                From <code className="font-mono">SPDC_Budget_Arvind 49.xls</code> Budget tab — same load pattern as QAP / Cube.
              </p>
            </div>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void syncTemplate(false)}>
              {busy ? "Loading…" : "Load budget template"}
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input placeholder="Sr No" value={form.srNo} onChange={(e) => setForm({ ...form, srNo: e.target.value })} />
            <Input
              placeholder="Stakeholder"
              value={form.stakeholder}
              onChange={(e) => setForm({ ...form, stakeholder: e.target.value })}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {(
              [
                ["budgetedAmount", "Budgeted"],
                ["workOrderAmount", "WO Amount"],
                ["certifiedAmount", "Certified"],
                ["forecastedAmount", "Forecast +"],
                ["forecastReduction", "Forecast −"],
                ["nonTendered", "Non-tendered"],
                ["steelExcess", "Steel excess"],
                ["steelSaving", "Steel saving"],
                ["cementExcess", "Cement excess"],
                ["cementSaving", "Cement saving"],
                ["tilesExcess", "Tiles excess"],
                ["tilesSaving", "Tiles saving"],
                ["grossTotal", "Gross total"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-[10px] uppercase text-steel-muted font-semibold">
                {label}
                <Input
                  className="mt-1"
                  type="number"
                  step="any"
                  value={String(form[key] ?? "")}
                  onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) || 0 })}
                />
              </label>
            ))}
            <TextArea
              className="sm:col-span-2 lg:col-span-4 !min-h-[3.5rem]"
              placeholder="Remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="button" disabled={busy} onClick={() => void addLine()}>
                Add budget line
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="sheet-register w-full budget-wbs-panel register-panel-fill flex flex-col">
        <div className="sheet-register__head shrink-0">
          <span>Budget WBS</span>
          <span className="text-steel-muted font-normal normal-case tracking-normal">
            {rows.length} rows · Sr · Stakeholder · Budgeted · WO · Certified · Forecast ± · Non-tendered · BRD · Gross · Remarks
          </span>
        </div>
        <div className="sheet-register__scroll register-sheet-viewport">
          <table className="sheet-register__table">
            <thead>
              <tr>
                <th className="sticky-col">Sr</th>
                <th>Description</th>
                <th>Stakeholder</th>
                <th className="num">Budgeted</th>
                <th className="num">WO Amount</th>
                <th className="num">Certified</th>
                <th className="num">Forecast +</th>
                <th className="num">Forecast −</th>
                <th className="num">Non-tendered</th>
                <th className="num">Steel Ex</th>
                <th className="num">Steel Sv</th>
                <th className="num">Cement Ex</th>
                <th className="num">Cement Sv</th>
                <th className="num">Tiles Ex</th>
                <th className="num">Tiles Sv</th>
                <th className="num">Gross Total</th>
                <th>Remarks</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const busyRow = savingId === b.id;
                return (
                  <tr key={b.id} className={busyRow ? "opacity-60" : undefined}>
                    <td className="sticky-col">{b.srNo || "—"}</td>
                    <td className="wrap">{b.description}</td>
                    <td>{b.stakeholder || "—"}</td>
                    {(
                      [
                        "budgetedAmount",
                        "workOrderAmount",
                        "certifiedAmount",
                        "forecastedAmount",
                        "forecastReduction",
                        "nonTendered",
                        "steelExcess",
                        "steelSaving",
                        "cementExcess",
                        "cementSaving",
                        "tilesExcess",
                        "tilesSaving",
                        "grossTotal",
                      ] as const
                    ).map((key) => (
                      <td key={key} className="num">
                        {canEdit ? (
                          <CellNum value={b[key]} onCommit={(n) => void patch(b.id, { [key]: n })} />
                        ) : (
                          formatINR(Number(b[key]) || 0)
                        )}
                      </td>
                    ))}
                    <td className="wrap text-xs">{b.remarks || "—"}</td>
                    {canEdit && (
                      <td>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-600 hover:underline"
                          disabled={busyRow}
                          onClick={() => void remove(b.id)}
                        >
                          Del
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={canEdit ? 18 : 17} className="empty">
                    No budget lines — Load budget template or add a line.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
