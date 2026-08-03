import { Fragment, useMemo, useState } from "react";
import { api } from "../api";
import { Button, Input, Select } from "./ui";

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
  excessQty: number;
  savingQty: number;
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
      defaultValue={String(value ?? "")}
      className={`boq-cell-input ${className}`}
      onBlur={(e) => {
        const next = e.target.value;
        if (next !== String(value ?? "")) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
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

  const colSpan = canFullEdit ? 12 : 11;

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-brand font-medium">{msg}</p>}

      {canFullEdit && (
        <div className="boq-add-panel rounded-[var(--ui-radius,14px)] border border-line bg-paper p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-semibold text-sm">Add BOQ line</h3>
            <span className="text-[11px] text-steel-muted uppercase tracking-wider">Section · item · quantities</span>
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
            <Input
              className="sm:col-span-2"
              placeholder="Description"
              value={draft.description || ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Rate"
              value={String(draft.rate ?? "")}
              onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="BOQ qty"
              value={String(draft.boqQty ?? "")}
              onChange={(e) => setDraft({ ...draft, boqQty: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Extra qty"
              value={String(draft.extraQty ?? "")}
              onChange={(e) => setDraft({ ...draft, extraQty: Number(e.target.value) })}
            />
            <Input
              type="number"
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
            {rows.length} lines · {grouped.length} sections
            {canTouch ? " · blur a cell to save" : ""}
          </span>
        </div>
        <div className="sheet-register__scroll">
          <table className="sheet-register__table boq-editor__table">
            <thead>
              <tr>
                <th className="sticky-col">Package</th>
                <th>Item</th>
                <th className="wrap">Description</th>
                <th>UOM</th>
                <th>Rate</th>
                <th>BOQ</th>
                <th>Extra</th>
                <th>GFC</th>
                <th>Achieved</th>
                <th>Excess</th>
                <th>Saving</th>
                {canFullEdit && <th />}
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
                    return (
                      <tr key={b.id} className={busy ? "opacity-60" : undefined}>
                        <td className="sticky-col">
                          {canFullEdit ? (
                            <CellInput
                              key={`${b.id}-pkg-${b.packageName}`}
                              value={b.packageName}
                              onCommit={(v) => void patchLine(b.id, { packageName: v })}
                            />
                          ) : (
                            b.packageName
                          )}
                        </td>
                        <td>
                          {canFullEdit ? (
                            <CellInput
                              key={`${b.id}-item-${b.itemNo}`}
                              value={b.itemNo}
                              onCommit={(v) => void patchLine(b.id, { itemNo: v || null })}
                            />
                          ) : (
                            b.itemNo ?? "—"
                          )}
                        </td>
                        <td className="wrap">
                          {canFullEdit ? (
                            <CellInput
                              key={`${b.id}-desc-${b.description}`}
                              value={b.description}
                              className="min-w-[180px]"
                              onCommit={(v) => void patchLine(b.id, { description: v })}
                            />
                          ) : (
                            b.description
                          )}
                        </td>
                        <td>
                          {canFullEdit ? (
                            <CellInput
                              key={`${b.id}-uom-${b.uom}`}
                              value={b.uom}
                              onCommit={(v) => void patchLine(b.id, { uom: v || null })}
                            />
                          ) : (
                            b.uom ?? "—"
                          )}
                        </td>
                        <td>
                          {canFullEdit ? (
                            <CellInput
                              key={`${b.id}-rate-${b.rate}`}
                              type="number"
                              value={b.rate}
                              onCommit={(v) => void patchLine(b.id, { rate: Number(v) || 0 })}
                            />
                          ) : (
                            b.rate
                          )}
                        </td>
                        <td>
                          {canFullEdit ? (
                            <CellInput
                              key={`${b.id}-boq-${b.boqQty}`}
                              type="number"
                              value={b.boqQty}
                              onCommit={(v) => void patchLine(b.id, { boqQty: Number(v) || 0 })}
                            />
                          ) : (
                            b.boqQty
                          )}
                        </td>
                        <td>
                          {canFullEdit ? (
                            <CellInput
                              key={`${b.id}-extra-${b.extraQty}`}
                              type="number"
                              value={b.extraQty}
                              onCommit={(v) => void patchLine(b.id, { extraQty: Number(v) || 0 })}
                            />
                          ) : (
                            b.extraQty
                          )}
                        </td>
                        <td>
                          {canTouch ? (
                            <CellInput
                              key={`${b.id}-gfc-${b.gfcQty}`}
                              type="number"
                              value={b.gfcQty}
                              onCommit={(v) => void patchLine(b.id, { gfcQty: Number(v) || 0 })}
                            />
                          ) : (
                            b.gfcQty
                          )}
                        </td>
                        <td>
                          {canTouch ? (
                            <CellInput
                              key={`${b.id}-ach-${b.achievedQty}`}
                              type="number"
                              value={b.achievedQty}
                              onCommit={(v) => void patchLine(b.id, { achievedQty: Number(v) || 0 })}
                            />
                          ) : (
                            b.achievedQty
                          )}
                        </td>
                        <td>{b.excessQty}</td>
                        <td>{b.savingQty}</td>
                        {canFullEdit && (
                          <td>
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-600 hover:underline"
                              disabled={busy}
                              onClick={() => void removeLine(b.id)}
                            >
                              Del
                            </button>
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
                    No BOQ lines yet — add a line or upload a structure sheet.
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
