import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { Button, Input, Select, TextArea } from "./ui";
import { CostRegisterShell } from "./CostRegisterShell";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { MON_COLUMN_GROUPS, monitoringColClass } from "../lib/costSheetColumns";
import { monitoringBandEmpty, MON_DATA_COLS } from "../lib/costBandRows";

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
  className?: string;
  singlePackage?: string;
  addOpen?: boolean;
  onAddClose?: () => void;
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

function SectionBandLabel({ section }: { section: string }) {
  if (!section || section === "General") return <span className="text-steel-muted italic">General</span>;
  const parts = section.split(" › ").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return <span className="boq-section-label">{section}</span>;
  return (
    <span className="boq-section-label flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-steel-muted font-semibold">{parts[0]}</span>
      <span>{parts.slice(1).join(" › ")}</span>
    </span>
  );
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
  siteQtyOnly,
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
  siteQtyOnly?: boolean;
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
      className="register-modal z-[70]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="register-modal__panel register-modal__panel--2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="register-modal__head">
          <div>
            <h2 id={titleId} className="font-display text-lg sm:text-xl text-ink">
              {title}
            </h2>
            <p className="text-xs text-steel-muted mt-1">
              {siteQtyOnly ? "Update achieved quantity for this BOQ line" : "Edit description, rates, and quantities"}
            </p>
          </div>
          <Button type="button" variant="ghost" className="!px-2 !py-1 !text-xs" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="register-modal__body space-y-4">
          {canFullEdit && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <label className="block sm:col-span-2 text-xs font-semibold uppercase tracking-wider text-steel-muted">
                Section
                <Input
                  className="mt-1"
                  value={draft.section || ""}
                  onChange={(e) => onChange({ ...draft, section: e.target.value })}
                  placeholder="SECTION A — EARTH WORK"
                />
              </label>
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
          )}

          <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
            Description
            {canFullEdit ? (
              <TextArea
                className="mt-1 !min-h-[8rem]"
                rows={6}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
            {!siteQtyOnly && (
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
            )}
            <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
              Achieved qty
              <Input
                className="mt-1 boq-achieved-input"
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
  className = "",
  singlePackage,
  addOpen = false,
  onAddClose,
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
  const siteQtyOnly = canSiteEdit && !canFullEdit;
  const canEditGfc = canFullEdit;
  const canEditAchieved = canFullEdit || canSiteEdit;
  const headers = [...MON_HEADERS];

  const grouped = useMemo(() => {
    const groups: { key: string; section: string; items: MonLine[] }[] = [];
    for (const r of rows) {
      const pkg = r.packageName?.trim() || "General";
      const section = r.section?.trim() || "";
      const key = section ? `${pkg} › ${section}` : pkg;
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(r);
      else groups.push({ key, section, items: [r] });
    }
    return groups;
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
      onAddClose?.();
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
      const patch: Record<string, unknown> = siteQtyOnly
        ? { achievedQty: Number(editDraft.achievedQty || 0) }
        : {
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

  const colSpan = (canTouch ? headers.length + 1 : headers.length);

  function monitoringSectionRow(section: string, items: MonLine[]) {
    const hasSection = Boolean(section.trim());
    if (!hasSection && singlePackage) return null;
    return (
      <tr className="boq-section-row">
        <td className={monitoringColClass(0, { sticky: true, extra: "text-left" })}>
          {items[0]?.packageName || ""}
        </td>
        {monitoringBandEmpty(1, "sr")}
        <td className={monitoringColClass(2, { extra: "text-left boq-desc-col" })}>
          {canFullEdit ? (
            <CellInput
              key={`sec-${items[0]?.id || "x"}-${section}`}
              value={section}
              className="boq-section-input"
              onCommit={(v) => void renameSection(items, v)}
            />
          ) : hasSection ? (
            <SectionBandLabel section={section} />
          ) : (
            <span className="boq-section-label">{items[0]?.packageName || ""}</span>
          )}
        </td>
        {Array.from({ length: MON_DATA_COLS - 3 }, (_, i) => monitoringBandEmpty(i + 3, `mon-b-${i + 3}`))}
        {canTouch && <td className="boq-actions-col" />}
      </tr>
    );
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 ${className}`.trim()}>
      {msg && <p className="text-sm text-brand font-medium shrink-0 px-1">{msg}</p>}

      {canFullEdit && (
        <RegisterEntryModal
          open={addOpen}
          title="Add monitoring line"
          onClose={() => onAddClose?.()}
          onSave={() => void addLine()}
          saving={adding}
          size="2xl"
          saveLabel="Add line"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              placeholder="Description *"
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
          </div>
        </RegisterEntryModal>
      )}

      <CostRegisterShell
        sheetKind="monitoring"
        title={`BOQ / Monitoring${singlePackage ? ` — ${singlePackage}` : ""}`}
        subtitle={
          siteQtyOnly
            ? `${rows.length} lines · ${grouped.length} sections · edit Achieved Qty (white cells) — all monitoring columns visible`
            : `${rows.length} lines · ${grouped.length} sections · all ${headers.length} SPDC monitoring columns visible`
        }
      >
          <table className="cube-register__table register-editor-pro cost-register-table boq-editor__table min-w-[128rem]">
            <thead className="cost-register-thead">
              <tr className="cost-col-group-row">
                {MON_COLUMN_GROUPS.map((g) => (
                  <th key={g.key} colSpan={g.to - g.from + 1} className={`cost-col-group cost-col--${g.key}`}>
                    {g.label}
                  </th>
                ))}
                {canTouch && (
                  <th rowSpan={2} className="boq-actions-col">
                    Actions
                  </th>
                )}
              </tr>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={h}
                    className={monitoringColClass(i, {
                      achieved: h === "Achieved Qty",
                      sticky: i === 0,
                      extra: `text-left ${i >= 4 ? "num" : ""} ${h === "Item of Work" ? "boq-desc-col min-w-[14rem]" : ""}`,
                    })}
                  >
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
              {grouped.map(({ key, section, items }) => (
                <Fragment key={key}>
                  {monitoringSectionRow(section, items)}
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
                        <td className={monitoringColClass(0, { sticky: true, extra: "text-left align-top" })}>{b.packageName}</td>
                        <td className={monitoringColClass(1, { extra: "whitespace-nowrap" })}>{b.itemNo ?? "—"}</td>
                        <td className={monitoringColClass(2, { extra: "boq-desc-col" })}>
                          <div className="boq-desc" title={b.description}>
                            {b.description || "—"}
                          </div>
                        </td>
                        <td className={monitoringColClass(3)}>{b.uom ?? "—"}</td>
                        <td className={monitoringColClass(4, { extra: "num rupee" })}>{formatInr(b.rate)}</td>
                        <td className={monitoringColClass(5, { extra: "num" })}>
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
                        <td className={monitoringColClass(6, { extra: "num" })}>
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
                        <td className={monitoringColClass(7, { extra: "num" })}>
                          {canEditGfc ? (
                            <CellInput
                              type="number"
                              value={b.gfcQty}
                              onCommit={(v) => void patchLine(b.id, { gfcQty: Number(v) || 0 })}
                            />
                          ) : (
                            formatQty(b.gfcQty)
                          )}
                        </td>
                        <td className={monitoringColClass(8, { achieved: true, extra: "num" })}>
                          {canEditAchieved ? (
                            <CellInput
                              type="number"
                              className={siteQtyOnly ? "boq-achieved-input" : undefined}
                              value={b.achievedQty}
                              onCommit={(v) => void patchLine(b.id, { achievedQty: Number(v) || 0 })}
                            />
                          ) : (
                            formatQty(b.achievedQty)
                          )}
                        </td>
                        <td className={monitoringColClass(9, { extra: "num" })}>{formatQty(b.excessQty)}</td>
                        <td className={monitoringColClass(10, { extra: "num" })}>{formatQty(b.savingQty)}</td>
                        <td className={monitoringColClass(11, { extra: "num" })}>
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
                        <td className={monitoringColClass(12, { extra: "num rupee" })}>{formatInr(boqCost)}</td>
                        <td className={monitoringColClass(13, { extra: "num rupee" })}>{formatInr(extraCost)}</td>
                        <td className={monitoringColClass(14, { extra: "num rupee" })}>{formatInr(gfcCost)}</td>
                        <td className={monitoringColClass(15, { extra: "num rupee" })}>{formatInr(achCost)}</td>
                        <td className={monitoringColClass(16, { extra: "num rupee" })}>{formatInr(b.excessCost ?? Math.max(0, gfcCost - boqCost))}</td>
                        <td className={monitoringColClass(17, { extra: "num rupee" })}>{formatInr(b.savingCost ?? Math.max(0, boqCost - gfcCost))}</td>
                        <td className={monitoringColClass(18, { extra: "num rupee" })}>{formatInr(certCost)}</td>
                        <td className={monitoringColClass(19, { extra: "num" })}>{formatPct(b.pctBoq)}</td>
                        <td className={monitoringColClass(20, { extra: "num" })}>{formatPct(b.pctGfc)}</td>
                        <td className={monitoringColClass(21, { extra: "num" })}>{formatPct((b.pctAchieved || 0) * 100)}</td>
                        <td className={monitoringColClass(22, { extra: "num" })}>{formatPct(b.pctCertified)}</td>
                        <td className={monitoringColClass(23, { extra: "num rupee" })}>{formatInr(b.evBoq ?? achCost)}</td>
                        <td className={monitoringColClass(24, { extra: "num rupee" })}>{formatInr(b.evGfc ?? achCost)}</td>
                        <td className={monitoringColClass(25, { extra: "num rupee" })}>{formatInr(b.evCertified ?? certCost)}</td>
                        <td className={monitoringColClass(26, { extra: "num rupee" })}>{formatInr(b.actualCost ?? achCost)}</td>
                        <td className={monitoringColClass(27, { extra: "num" })}>{formatIdx(b.cpi)}</td>
                        <td className={monitoringColClass(28)}>{b.cpiStatus || "—"}</td>
                        <td className={monitoringColClass(29, { extra: "num rupee" })}>{formatInr(b.etcBoq)}</td>
                        <td className={monitoringColClass(30, { extra: "num rupee" })}>{formatInr(b.etcGfc)}</td>
                        <td className={monitoringColClass(31, { extra: "num rupee" })}>{formatInr(b.etcCertified)}</td>
                        <td className={monitoringColClass(32, { extra: "num rupee" })}>{formatInr(b.eac ?? boqCost)}</td>
                        <td className={monitoringColClass(33, { extra: "num rupee" })}>{formatInr(b.vac)}</td>
                        <td className={monitoringColClass(34, { extra: "num rupee" })}>{formatInr(b.varBoqGfc)}</td>
                        <td className={monitoringColClass(35, { extra: "num rupee" })}>{formatInr(b.varGfcAchieved)}</td>
                        <td className={monitoringColClass(36, { extra: "num rupee" })}>{formatInr(b.varGfcCertified)}</td>
                        <td className={monitoringColClass(37, { extra: "num" })}>{formatIdx(b.overrunBoq)}</td>
                        <td className={monitoringColClass(38, { extra: "num" })}>{formatIdx(b.overrunGfc)}</td>
                        <td className={monitoringColClass(39, { extra: "num" })}>{formatIdx(b.overrunCertified)}</td>
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
      </CostRegisterShell>

      <EditLineModal
        open={!!editLine}
        title={editLine ? `Edit line ${editLine.itemNo || ""}`.trim() : "Edit line"}
        draft={editDraft}
        packages={packages}
        canFullEdit={canFullEdit}
        siteQtyOnly={siteQtyOnly}
        busy={editBusy}
        error={editError}
        onChange={setEditDraft}
        onClose={() => setEditLine(null)}
        onSave={() => void saveEdit()}
      />
    </div>
  );
}
