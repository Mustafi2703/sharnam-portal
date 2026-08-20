import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { Button, Input, Select, TextArea } from "./ui";

export type MonLine = {
  id: string;
  packageName: string;
  section?: string | null;
  itemNo?: string | null;
  description: string;
  uom?: string | null;
  rate: number;
  boqQty: number;
  extraQty: number;
  gfcQty: number;
  achievedQty: number;
  certifiedQty: number;
  excessQty: number;
  savingQty: number;
  boqCost?: number;
  extraItemCost?: number;
  gfcCost?: number;
  achievedCost?: number;
  excessCost?: number;
  savingCost?: number;
  certifiedInvoiceCost?: number;
  pctBoq?: number;
  pctGfc?: number;
  pctAchieved?: number;
  pctCertified?: number;
  evBoq?: number;
  evGfc?: number;
  evCertified?: number;
  actualCost?: number;
  cpi?: number;
  cpiStatus?: string | null;
  etcBoq?: number;
  etcGfc?: number;
  etcCertified?: number;
  eac?: number;
  vac?: number;
  varBoqGfc?: number;
  varGfcAchieved?: number;
  varGfcCertified?: number;
  overrunBoq?: number;
  overrunGfc?: number;
  overrunCertified?: number;
};

type Props = {
  projectId: string;
  token: string | null;
  rows: MonLine[];
  packages: string[];
  canFullEdit: boolean;
  canSiteEdit: boolean;
  onChanged: () => void;
};

type Draft = ReturnType<typeof emptyDraft>;

const emptyDraft = (pkg: string) => ({
  packageName: pkg || "Civil",
  section: "",
  itemNo: "",
  description: "",
  uom: "",
  rate: 0,
  boqQty: 0,
  extraQty: 0,
  gfcQty: 0,
  achievedQty: 0,
});

function formatPct(n: number | null | undefined) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "—";
  return `${v.toFixed(1)}%`;
}

function formatIdx(n: number | null | undefined) {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "—";
  return v.toFixed(3);
}

const MON_HEADERS = [
  "Package",
  "ITEM NO.",
  "Item of Work",
  "UOM",
  "RATE ₹",
  "BOQ Qty",
  "Extra Items Qty",
  "GFC Qty",
  "Achieved Qty",
  "Excess Qty (BOQ vs GFC)",
  "Saving Qty (BOQ vs GFC)",
  "Certified Qty (Invoice)",
  "BOQ Cost ₹",
  "Extra Item Cost ₹",
  "GFC Cost ₹",
  "Achieved Cost ₹",
  "Excess Cost ₹",
  "Saving Cost ₹",
  "Certified Invoice Cost ₹",
  "% Progress BOQ",
  "% Progress GFC",
  "% Progress Achieved",
  "% Progress Certified",
  "EV vs BOQ ₹",
  "EV vs GFC ₹",
  "EV vs Certified ₹",
  "AC ₹",
  "CPI",
  "CPI Status",
  "ETC BOQ ₹",
  "ETC GFC ₹",
  "ETC Certified ₹",
  "EAC ₹",
  "VAC ₹",
  "Var BOQ vs GFC ₹",
  "Var GFC vs Achieved ₹",
  "Var GFC vs Certified ₹",
  "Overrun BOQ",
  "Overrun GFC",
  "Overrun Certified",
] as const;

/** Keep BOQ numbers readable — trim long float tails. */
export function formatQty(n: number | null | undefined, digits = 3): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  const fixed = Number(v.toFixed(digits));
  return String(fixed);
}

/** Rupee amount with ₹ icon — Cost monitoring money columns. */
export function formatInr(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "₹0";
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

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

function lineToDraft(line: MonLine): Draft {
  return {
    packageName: line.packageName || "Civil",
    section: line.section || "",
    itemNo: line.itemNo || "",
    description: line.description || "",
    uom: line.uom || "",
    rate: Number(line.rate) || 0,
    boqQty: Number(line.boqQty) || 0,
    extraQty: Number(line.extraQty) || 0,
    gfcQty: Number(line.gfcQty) || 0,
    achievedQty: Number(line.achievedQty) || 0,
  };
}

function EditLineModal({
  open,
  title,
  draft,
  packages,
  canFullEdit,
  busy,
  error,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  draft: Draft;
  packages: string[];
  canFullEdit: boolean;
  busy?: boolean;
  error?: string;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("input,textarea,select,button")?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-ink/45 flex items-end sm:items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-xl border border-line bg-paper shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b border-line bg-paper">
          <div>
            <h2 id={titleId} className="font-display text-xl text-ink">
              {title}
            </h2>
            <p className="text-xs text-steel-muted mt-1">Edit description, rates, and quantities</p>
          </div>
          <Button type="button" variant="ghost" className="!px-2 !py-1 !text-xs" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="p-5 space-y-3">
          {canFullEdit && (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
                Package
                <Select
                  className="mt-1"
                  value={draft.packageName || ""}
                  onChange={(e) => onChange({ ...draft, packageName: e.target.value })}
                >
                  {(packages.length ? packages : ["Civil"]).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
                Section
                <Input
                  className="mt-1"
                  value={draft.section || ""}
                  onChange={(e) => onChange({ ...draft, section: e.target.value })}
                  placeholder="SECTION A — EARTH WORK"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
                  Item no
                  <Input
                    className="mt-1"
                    value={draft.itemNo || ""}
                    onChange={(e) => onChange({ ...draft, itemNo: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
                  UOM
                  <Input
                    className="mt-1"
                    value={draft.uom || ""}
                    onChange={(e) => onChange({ ...draft, uom: e.target.value })}
                  />
                </label>
              </div>
            </>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
            Description
            {canFullEdit ? (
              <TextArea
                className="mt-1 !min-h-[7rem]"
                rows={5}
                value={draft.description || ""}
                onChange={(e) => onChange({ ...draft, description: e.target.value })}
                placeholder="Full BOQ description…"
              />
            ) : (
              <p className="mt-1 text-sm text-ink font-medium normal-case tracking-normal leading-relaxed whitespace-pre-wrap">
                {draft.description || "—"}
              </p>
            )}
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {canFullEdit && (
              <>
                <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
                  Rate
                  <Input
                    className="mt-1"
                    type="number"
                    step="any"
                    value={String(draft.rate ?? "")}
                    onChange={(e) => onChange({ ...draft, rate: Number(e.target.value) })}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
                  BOQ qty
                  <Input
                    className="mt-1"
                    type="number"
                    step="any"
                    value={String(draft.boqQty ?? "")}
                    onChange={(e) => onChange({ ...draft, boqQty: Number(e.target.value) })}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
                  Extra qty
                  <Input
                    className="mt-1"
                    type="number"
                    step="any"
                    value={String(draft.extraQty ?? "")}
                    onChange={(e) => onChange({ ...draft, extraQty: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
            <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
              GFC qty
              <Input
                className="mt-1"
                type="number"
                step="any"
                value={String(draft.gfcQty ?? "")}
                onChange={(e) => onChange({ ...draft, gfcQty: Number(e.target.value) })}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
              Achieved qty
              <Input
                className="mt-1"
                type="number"
                step="any"
                value={String(draft.achievedQty ?? "")}
                onChange={(e) => onChange({ ...draft, achievedQty: Number(e.target.value) })}
              />
            </label>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" disabled={busy} onClick={onSave}>
              {busy ? "Saving…" : "Save line"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BoqMonitoringEditor({
  projectId,
  token,
  rows,
  packages,
  canFullEdit,
  canSiteEdit,
  onChanged,
}: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft(packages[0] || "Civil"));
  const [adding, setAdding] = useState(false);
  const [editLine, setEditLine] = useState<MonLine | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(() => emptyDraft(packages[0] || "Civil"));
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const canTouch = canFullEdit || canSiteEdit;

  const grouped = useMemo(() => {
    const map = new Map<string, MonLine[]>();
    for (const r of rows) {
      const key = r.section?.trim() || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()];
  }, [rows]);

  async function patchLine(id: string, patch: Record<string, unknown>, reload = true) {
    setSavingId(id);
    setMsg("");
    try {
      await api(`/api/cost/monitoring/${id}`, { method: "PATCH", token, body: JSON.stringify(patch) });
      if (reload) onChanged();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  async function renameSection(items: MonLine[], nextRaw: string) {
    const next = nextRaw.trim() || null;
    setMsg("");
    try {
      await Promise.all(
        items.map((line) =>
          api(`/api/cost/monitoring/${line.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ section: next }),
          })
        )
      );
      onChanged();
    } catch (e: any) {
      setMsg(e?.message || "Section rename failed");
    }
  }

  async function addLine() {
    if (!draft.description?.trim()) {
      setMsg("Description is required");
      return;
    }
    setAdding(true);
    setMsg("");
    try {
      await api(`/api/cost/${projectId}/monitoring`, {
        method: "POST",
        token,
        body: JSON.stringify({
          packageName: draft.packageName || "Civil",
          section: draft.section || null,
          itemNo: draft.itemNo || null,
          description: draft.description,
          uom: draft.uom || null,
          rate: Number(draft.rate || 0),
          boqQty: Number(draft.boqQty || 0),
          extraQty: Number(draft.extraQty || 0),
          gfcQty: Number(draft.gfcQty || 0),
          achievedQty: Number(draft.achievedQty || 0),
        }),
      });
      setDraft(emptyDraft(draft.packageName || packages[0] || "Civil"));
      onChanged();
      setMsg("Line added");
    } catch (e: any) {
      setMsg(e?.message || "Could not add line");
    } finally {
      setAdding(false);
    }
  }

  async function removeLine(id: string) {
    if (!canFullEdit) return;
    if (!confirm("Delete this BOQ line?")) return;
    setSavingId(id);
    try {
      await api(`/api/cost/monitoring/${id}`, { method: "DELETE", token });
      onChanged();
    } catch (e: any) {
      setMsg(e?.message || "Delete failed");
    } finally {
      setSavingId(null);
    }
  }

  function openEdit(line: MonLine) {
    setEditLine(line);
    setEditDraft(lineToDraft(line));
    setEditError("");
  }

  async function saveEdit() {
    if (!editLine) return;
    if (canFullEdit && !editDraft.description?.trim()) {
      setEditError("Description is required");
      return;
    }
    setEditBusy(true);
    setEditError("");
    try {
      const patch: Record<string, unknown> = {
        gfcQty: Number(editDraft.gfcQty || 0),
        achievedQty: Number(editDraft.achievedQty || 0),
      };
      if (canFullEdit) {
        Object.assign(patch, {
          packageName: editDraft.packageName || "Civil",
          section: editDraft.section || null,
          itemNo: editDraft.itemNo || null,
          description: editDraft.description,
          uom: editDraft.uom || null,
          rate: Number(editDraft.rate || 0),
          boqQty: Number(editDraft.boqQty || 0),
          extraQty: Number(editDraft.extraQty || 0),
        });
      }
      await api(`/api/cost/monitoring/${editLine.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      setEditLine(null);
      onChanged();
      setMsg("Line updated");
    } catch (e: any) {
      setEditError(e?.message || "Save failed");
    } finally {
      setEditBusy(false);
    }
  }

  const colSpan = (canTouch ? MON_HEADERS.length + 1 : MON_HEADERS.length);

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-brand font-medium">{msg}</p>}

      {canFullEdit && (
        <div className="boq-add-panel rounded-[var(--ui-radius,14px)] border border-line bg-paper p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-semibold text-sm">Add BOQ line</h3>
            <span className="text-[11px] text-steel-muted uppercase tracking-wider">Section · item · quantities · all SPDC columns on save</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Select
              value={draft.packageName || ""}
              onChange={(e) => setDraft({ ...draft, packageName: e.target.value })}
            >
              {(packages.length ? packages : ["Civil"]).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Input
              placeholder="Section (e.g. SECTION A — EARTH WORK)"
              value={draft.section || ""}
              onChange={(e) => setDraft({ ...draft, section: e.target.value })}
            />
            <Input
              placeholder="Item no"
              value={draft.itemNo || ""}
              onChange={(e) => setDraft({ ...draft, itemNo: e.target.value })}
            />
            <Input
              placeholder="UOM"
              value={draft.uom || ""}
              onChange={(e) => setDraft({ ...draft, uom: e.target.value })}
            />
            <TextArea
              className="sm:col-span-2 lg:col-span-4 !min-h-[4.5rem]"
              rows={3}
              placeholder="Description"
              value={draft.description || ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <Input
              type="number"
              step="any"
              placeholder="Rate"
              value={String(draft.rate ?? "")}
              onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })}
            />
            <Input
              type="number"
              step="any"
              placeholder="BOQ qty"
              value={String(draft.boqQty ?? "")}
              onChange={(e) => setDraft({ ...draft, boqQty: Number(e.target.value) })}
            />
            <Input
              type="number"
              step="any"
              placeholder="Extra qty"
              value={String(draft.extraQty ?? "")}
              onChange={(e) => setDraft({ ...draft, extraQty: Number(e.target.value) })}
            />
            <Input
              type="number"
              step="any"
              placeholder="GFC qty"
              value={String(draft.gfcQty ?? "")}
              onChange={(e) => setDraft({ ...draft, gfcQty: Number(e.target.value) })}
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="button" disabled={adding} onClick={() => void addLine()}>
                {adding ? "Adding…" : "Add line"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="sheet-register w-full boq-editor">
        <div className="sheet-register__head">
          <span>BOQ / Monitoring — editable register</span>
          <span className="text-steel-muted font-normal normal-case tracking-normal">
            {rows.length} lines · {grouped.length} sections · all SPDC Monitoring columns (qty · cost · progress · EV · CPI · ETC)
          </span>
        </div>
        <div className="sheet-register__scroll">
          <table className="sheet-register__table boq-editor__table">
            <thead>
              <tr>
                {MON_HEADERS.map((h, i) => (
                  <th key={h} className={i === 0 ? "sticky-col" : i >= 4 ? "num" : i === 2 ? "boq-desc-col" : undefined}>
                    {h.includes("(") ? (
                      <>
                        {h.split("(")[0].trim()}
                        <br />
                        <span className="font-normal">({h.split("(")[1]}</span>
                      </>
                    ) : (
                      h
                    )}
                  </th>
                ))}
                {canTouch && <th className="boq-actions-col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {grouped.map(([section, items]) => (
                <Fragment key={section}>
                  <tr className="boq-section-row">
                    <td colSpan={colSpan} className="sticky-col">
                      {canFullEdit ? (
                        <CellInput
                          key={`sec-${section}-${items.map((i) => i.id).join(",")}`}
                          value={section === "General" ? "" : section}
                          className="boq-section-input"
                          onCommit={(v) => void renameSection(items, v)}
                        />
                      ) : (
                        <span className="boq-section-label">{section}</span>
                      )}
                    </td>
                  </tr>
                  {items.map((b) => {
                    const busy = savingId === b.id;
                    const rate = Number(b.rate) || 0;
                    const boqCost = b.boqCost ?? b.boqQty * rate;
                    const extraCost = b.extraItemCost ?? b.extraQty * rate;
                    const gfcCost = b.gfcCost ?? b.gfcQty * rate;
                    const achCost = b.achievedCost ?? b.achievedQty * rate;
                    const certCost = b.certifiedInvoiceCost ?? b.certifiedQty * rate;
                    return (
                      <tr key={b.id} className={`boq-line-row ${busy ? "opacity-60" : ""}`}>
                        <td className="sticky-col">{b.packageName}</td>
                        <td className="whitespace-nowrap">{b.itemNo ?? "—"}</td>
                        <td className="boq-desc-col">
                          <div className="boq-desc" title={b.description}>
                            {b.description || "—"}
                          </div>
                        </td>
                        <td>{b.uom ?? "—"}</td>
                        <td className="num rupee">{formatInr(b.rate)}</td>
                        <td className="num">
                          {canFullEdit ? (
                            <CellInput
                              type="number"
                              value={b.boqQty}
                              onCommit={(v) => void patchLine(b.id, { boqQty: Number(v) || 0 })}
                            />
                          ) : (
                            formatQty(b.boqQty)
                          )}
                        </td>
                        <td className="num">
                          {canFullEdit ? (
                            <CellInput
                              type="number"
                              value={b.extraQty}
                              onCommit={(v) => void patchLine(b.id, { extraQty: Number(v) || 0 })}
                            />
                          ) : (
                            formatQty(b.extraQty)
                          )}
                        </td>
                        <td className="num">
                          {canTouch ? (
                            <CellInput
                              type="number"
                              value={b.gfcQty}
                              onCommit={(v) => void patchLine(b.id, { gfcQty: Number(v) || 0 })}
                            />
                          ) : (
                            formatQty(b.gfcQty)
                          )}
                        </td>
                        <td className="num">
                          {canTouch ? (
                            <CellInput
                              type="number"
                              value={b.achievedQty}
                              onCommit={(v) => void patchLine(b.id, { achievedQty: Number(v) || 0 })}
                            />
                          ) : (
                            formatQty(b.achievedQty)
                          )}
                        </td>
                        <td className="num">{formatQty(b.excessQty)}</td>
                        <td className="num">{formatQty(b.savingQty)}</td>
                        <td className="num">
                          {canFullEdit ? (
                            <CellInput
                              type="number"
                              value={b.certifiedQty}
                              onCommit={(v) => void patchLine(b.id, { certifiedQty: Number(v) || 0 })}
                            />
                          ) : (
                            formatQty(b.certifiedQty)
                          )}
                        </td>
                        <td className="num rupee">{formatInr(boqCost)}</td>
                        <td className="num rupee">{formatInr(extraCost)}</td>
                        <td className="num rupee">{formatInr(gfcCost)}</td>
                        <td className="num rupee">{formatInr(achCost)}</td>
                        <td className="num rupee">{formatInr(b.excessCost ?? Math.max(0, gfcCost - boqCost))}</td>
                        <td className="num rupee">{formatInr(b.savingCost ?? Math.max(0, boqCost - gfcCost))}</td>
                        <td className="num rupee">{formatInr(certCost)}</td>
                        <td className="num">{formatPct(b.pctBoq)}</td>
                        <td className="num">{formatPct(b.pctGfc)}</td>
                        <td className="num">{formatPct((b.pctAchieved || 0) * 100)}</td>
                        <td className="num">{formatPct(b.pctCertified)}</td>
                        <td className="num rupee">{formatInr(b.evBoq ?? achCost)}</td>
                        <td className="num rupee">{formatInr(b.evGfc ?? achCost)}</td>
                        <td className="num rupee">{formatInr(b.evCertified ?? certCost)}</td>
                        <td className="num rupee">{formatInr(b.actualCost ?? achCost)}</td>
                        <td className="num">{formatIdx(b.cpi)}</td>
                        <td>{b.cpiStatus || "—"}</td>
                        <td className="num rupee">{formatInr(b.etcBoq)}</td>
                        <td className="num rupee">{formatInr(b.etcGfc)}</td>
                        <td className="num rupee">{formatInr(b.etcCertified)}</td>
                        <td className="num rupee">{formatInr(b.eac ?? boqCost)}</td>
                        <td className="num rupee">{formatInr(b.vac)}</td>
                        <td className="num rupee">{formatInr(b.varBoqGfc)}</td>
                        <td className="num rupee">{formatInr(b.varGfcAchieved)}</td>
                        <td className="num rupee">{formatInr(b.varGfcCertified)}</td>
                        <td className="num">{formatIdx(b.overrunBoq)}</td>
                        <td className="num">{formatIdx(b.overrunGfc)}</td>
                        <td className="num">{formatIdx(b.overrunCertified)}</td>
                        {canTouch && (
                          <td className="boq-actions-col">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="boq-edit-btn"
                                disabled={busy}
                                onClick={() => openEdit(b)}
                              >
                                Edit
                              </button>
                              {canFullEdit && (
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-red-600 hover:underline"
                                  disabled={busy}
                                  onClick={() => void removeLine(b.id)}
                                >
                                  Del
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={colSpan} className="empty">
                    No BOQ lines yet — add a line or Load budget template (Budget tab / Monitoring).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditLineModal
        open={!!editLine}
        title={editLine ? `Edit line ${editLine.itemNo || ""}`.trim() : "Edit line"}
        draft={editDraft}
        packages={packages}
        canFullEdit={canFullEdit}
        busy={editBusy}
        error={editError}
        onChange={setEditDraft}
        onClose={() => setEditLine(null)}
        onSave={() => void saveEdit()}
      />
    </div>
  );
}
