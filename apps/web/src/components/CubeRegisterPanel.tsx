import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { groupCubeRows, fmtCubeDate, type CubeRow } from "../lib/cubeRegister";
import { cubeResultRowClass, fmtRegisterNum } from "../lib/inspectionRequestForms";
import { useLocalRegisterRows } from "../hooks/useLocalRegisterRows";
import { CubeRegisterAddForm, type CubeAddFormState } from "./CubeRegisterAddForm";
import { RegisterSheetCell } from "./RegisterSheetCell";
import { Badge, Button, Card, Select } from "./ui";
import { RegisterFilterBar } from "./RegisterFilterBar";
import { RegisterBrandHeader } from "./RegisterBrandHeader";
import type { RegisterBrandProject } from "./RegisterBrandHeader";

export type { CubeRow };

const emptyCube = (): CubeAddFormState => ({
  srNo: "",
  castDate: "",
  description: "",
  grade: "",
  testAgency: "",
  cubeWeight: "",
  testDate7: "",
  testDate28: "",
  load7: "",
  load28: "",
  strength7: "",
  strength28: "",
  avgStrength: "",
  result: "Pending",
});

function specimenPhase(c: CubeRow): "7D" | "28D" | "—" {
  if (c.load7) return "7D";
  if (c.load28) return "28D";
  if (c.strength7 != null) return "7D";
  if (c.strength28 != null) return "28D";
  return "—";
}

function rowStrength(c: CubeRow): number | null {
  const phase = specimenPhase(c);
  if (phase === "7D") return c.strength7 ?? (c.load7 ? c.strength : null) ?? null;
  if (phase === "28D") return c.strength28 ?? (c.load28 ? c.strength : null) ?? null;
  return c.strength ?? null;
}

type Props = {
  projectId: string;
  token?: string | null;
  rows: CubeRow[];
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
  project?: RegisterBrandProject | null;
  addOpen?: boolean;
  onAddClose?: () => void;
  onProjectUpdated?: () => void | Promise<void>;
};

/** SPDC CUBE REGISTER — full scroll sheet, inline editable cells, master-register add form. */
export function CubeRegisterPanel({ projectId, token, rows, canEdit, onChanged, project, addOpen, onAddClose, onProjectUpdated }: Props) {
  const { localRows, mergeRow } = useLocalRegisterRows(rows);
  const [form, setForm] = useState(emptyCube());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [patchErr, setPatchErr] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({
    grade: "All",
    result: "All",
    from: "",
    to: "",
    q: "",
  });
  const autoSyncRef = useRef(false);

  useEffect(() => {
    if (!canEdit || autoSyncRef.current || !projectId) return;
    const spdcLike = rows.filter((r) => r.castDate && r.grade).length;
    if (rows.length >= 100 && spdcLike >= 80) return;
    autoSyncRef.current = true;
    void syncTemplate(true);
  }, [canEdit, rows.length, projectId]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    localRows.forEach((r) => r.grade && set.add(r.grade));
    return Array.from(set).sort();
  }, [localRows]);

  const filtered = useMemo(() => {
    return localRows.filter((c) => {
      if (filters.grade !== "All" && (c.grade || "") !== filters.grade) return false;
      if (filters.result !== "All") {
        const res = (c.result || "Pending").toLowerCase();
        if (filters.result === "PASS" && !/pass/.test(res)) return false;
        if (filters.result === "FAIL" && !/fail/.test(res)) return false;
        if (filters.result === "Pending" && !/pending/.test(res)) return false;
      }
      const castDay = c.castDate ? c.castDate.slice(0, 10) : "";
      if (filters.from && castDay && castDay < filters.from) return false;
      if (filters.to && castDay && castDay > filters.to) return false;
      if (filters.q) {
        const hay = `${c.srNo} ${c.description} ${c.grade} ${c.testAgency || ""}`.toLowerCase();
        if (!hay.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
  }, [localRows, filters]);

  const grouped = useMemo(() => groupCubeRows(filtered), [filtered]);

  const stats = useMemo(() => {
    const pass = localRows.filter((r) => /pass/i.test(r.result || "")).length;
    const fail = localRows.filter((r) => /fail/i.test(r.result || "")).length;
    const pending = localRows.length - pass - fail;
    const groups = groupCubeRows(localRows).length;
    const agencies = new Set(localRows.map((r) => r.testAgency).filter(Boolean));
    return { pass, fail, pending, groups, agencies: agencies.size };
  }, [localRows]);

  async function syncTemplate(silent = false) {
    if (!silent) {
      setBusy(true);
      setMsg("");
    } else {
      setSyncing(true);
    }
    try {
      const out = await api<{ imported: number; groups: number }>(
        `/api/checklist/project/${projectId}/cubes/sync-template`,
        { method: "POST", token }
      );
      if (!silent) {
        setMsg(`Loaded ${out.imported} cube specimens in ${out.groups} footing groups from SPDC register.`);
      }
      await onChanged();
    } catch (err) {
      autoSyncRef.current = false;
      if (!silent) setMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      if (!silent) setBusy(false);
      setSyncing(false);
    }
  }

  async function patchCube(id: string, body: Record<string, unknown>, refresh = false) {
    const prev = localRows.find((r) => r.id === id);
    if (!prev) return;
    mergeRow(id, body as Partial<CubeRow>);
    setPatchErr("");
    try {
      await api(`/api/checklist/project/${projectId}/cubes/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      if (refresh) await onChanged();
    } catch (err) {
      mergeRow(id, prev);
      setPatchErr(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function submitCube(body: Record<string, unknown>) {
    await api(`/api/checklist/project/${projectId}/cubes`, { method: "POST", token, body: JSON.stringify(body) });
    await onChanged();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await submitCube({
        ...form,
        cubeWeight: form.cubeWeight ? Number(form.cubeWeight) : null,
        load7: form.load7 ? Number(form.load7) : null,
        load28: form.load28 ? Number(form.load28) : null,
        strength7: form.strength7 ? Number(form.strength7) : null,
        strength28: form.strength28 ? Number(form.strength28) : null,
        avgStrength: form.avgStrength ? Number(form.avgStrength) : null,
        testAgency: form.testAgency || null,
      });
      setForm(emptyCube());
      setMsg("Cube entry added.");
      onAddClose?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function cellInput(
    value: string,
    onSave: (v: string) => void,
    opts?: { type?: string; className?: string; numeric?: boolean; disabled?: boolean }
  ) {
    if (opts?.disabled || !canEdit) {
      if (opts?.type === "date" && value) return fmtCubeDate(value);
      if (opts?.numeric && value && value !== "—") {
        const n = Number(value);
        if (!Number.isNaN(n)) return <span className="cube-num">{fmtRegisterNum(n)}</span>;
      }
      return value || "—";
    }
    return (
      <RegisterSheetCell
        type={opts?.type || "text"}
        value={value}
        className={opts?.className}
        onCommit={onSave}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2 shrink-0">{msg}</p>}
      {patchErr && <p className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2 shrink-0">{patchErr}</p>}

      {canEdit && addOpen && (
        <CubeRegisterAddForm
          open={addOpen}
          busy={busy}
          form={form}
          onChange={setForm}
          onSubmit={onCreate}
          onClose={() => onAddClose?.()}
        />
      )}

      {localRows.length === 0 && !busy && !syncing && (
        <Card className="!p-3 border-amber-200 bg-amber-50 text-sm text-amber-900 shrink-0">
          Cube register is empty — loading SPDC template automatically, or click <strong>Load SPDC cube template</strong> in the register header.
        </Card>
      )}

      <Card padding={false} className="spdc-register-panel register-editor-panel register-panel-fill relative flex flex-col flex-1">
        {(syncing || busy) && localRows.length === 0 && (
          <div className="spdc-register-loading">Loading cube register…</div>
        )}

        <RegisterBrandHeader
          title="SPDC Cube Register"
          project={{ ...project, id: project?.id || projectId }}
          token={token}
          canEdit={canEdit}
          onProjectUpdated={onProjectUpdated}
          legend={
            <>
              <span className="font-bold text-brand-dark uppercase block mb-1 text-[10px]">Legend</span>
              <span className="inline-block mr-2 text-[10px]">
                <span className="cube-phase-7d px-1 rounded">7D</span> 7-day
              </span>
              <span className="inline-block mr-2 text-[10px]">
                <span className="cube-phase-28d px-1 rounded">28D</span> 28-day
              </span>
              <span className="inline-block text-ok text-[10px]">Pass</span>
              <span className="text-[10px]"> · </span>
              <span className="inline-block text-danger text-[10px]">Fail</span>
              <span className="text-[10px]"> · Pending</span>
            </>
          }
        />

        <div className="px-4 py-2 border-b border-line bg-sand/40 shrink-0 flex flex-wrap items-center justify-between gap-2">
          <div className="text-left min-w-0">
            <h3 className="font-semibold text-sm text-ink">
              Cube register — SPDC format ({filtered.length} specimens · {grouped.length} groups)
            </h3>
            <p className="text-[10px] text-steel-muted mt-0.5">
              Pass {stats.pass} · Fail {stats.fail} · Pending {stats.pending} · Agencies {stats.agencies}
            </p>
          </div>
          {canEdit && (
            <Button type="button" variant="secondary" className="!text-xs shrink-0" disabled={busy || syncing} onClick={() => void syncTemplate(false)}>
              Load SPDC cube template
            </Button>
          )}
        </div>

        <RegisterFilterBar
          fields={[
            { key: "grade", label: "Grade", type: "select", options: grades },
            { key: "result", label: "Result", type: "select", options: ["PASS", "FAIL", "Pending"] },
            { key: "from", label: "Cast from", type: "date" },
            { key: "to", label: "Cast to", type: "date" },
            { key: "q", label: "Search", type: "text", placeholder: "Sr, footing, agency…" },
          ]}
          values={filters}
          onChange={(k, v) => setFilters({ ...filters, [k]: v })}
          onClear={() => setFilters({ grade: "All", result: "All", from: "", to: "", q: "" })}
        />

        <div className="register-scroll-hint shrink-0 px-4 py-1.5 border-b border-line">
          Scroll ↔ ↕ for full sheet · every white cell is editable · saves on blur
        </div>

        <div className="sheet-register register-sheet-shell flex flex-col border-t border-line">
          <div className="sheet-register__scroll register-sheet-viewport">
            <table className="cube-register__table register-editor-pro min-w-[96rem]">
              <thead className="spdc-register-thead">
                <tr>
                  <th rowSpan={2} className="text-left">Sr. No.</th>
                  <th rowSpan={2} className="text-left">Date of Casting</th>
                  <th rowSpan={2} className="text-left min-w-[10rem]">Description</th>
                  <th rowSpan={2} className="text-left">Grade</th>
                  <th rowSpan={2} className="text-left min-w-[7rem]">Test agency</th>
                  <th rowSpan={2} className="text-left">Phase</th>
                  <th rowSpan={2} className="text-left">Weight (kg)</th>
                  <th colSpan={2} className="text-center">Testing Date</th>
                  <th colSpan={2} className="text-center">Load (kN)</th>
                  <th rowSpan={2} className="text-left">Strength (MPa)</th>
                  <th rowSpan={2} className="text-left">Avg Strength (MPa)</th>
                  <th rowSpan={2} className="text-left">Result</th>
                </tr>
                <tr>
                  <th className="spdc-th-sub text-center">7-day</th>
                  <th className="spdc-th-sub text-center">28-day</th>
                  <th className="spdc-th-sub text-center">7-day</th>
                  <th className="spdc-th-sub text-center">28-day</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const phase = specimenPhase(c);
                  const strength = rowStrength(c);
                  return (
                    <tr key={c.id} className={cubeResultRowClass(c.result)}>
                      <td className="text-left font-mono align-top">
                        {cellInput(c.srNo || "", (v) => void patchCube(c.id, { srNo: v || null }))}
                      </td>
                      <td className="text-left align-top">
                        {cellInput(c.castDate ? c.castDate.slice(0, 10) : "", (v) => void patchCube(c.id, { castDate: v || null }), {
                          type: "date",
                        })}
                      </td>
                      <td className="text-left align-top max-w-[14rem]">
                        {cellInput(c.description, (v) => void patchCube(c.id, { description: v }), { className: "min-w-[10rem]" })}
                      </td>
                      <td className="text-left align-top">
                        {cellInput(c.grade || "", (v) => void patchCube(c.id, { grade: v || null }))}
                      </td>
                      <td className="text-left align-top">
                        {cellInput(c.testAgency || "", (v) => void patchCube(c.id, { testAgency: v || null }))}
                      </td>
                      <td
                        className={`text-left font-mono align-top ${phase === "7D" ? "cube-phase-7d" : phase === "28D" ? "cube-phase-28d" : ""}`}
                      >
                        {phase}
                      </td>
                      <td className="text-left align-top">
                        {cellInput(c.cubeWeight != null ? String(c.cubeWeight) : "", (v) =>
                          void patchCube(c.id, { cubeWeight: v ? Number(v) : null }), { numeric: true })}
                      </td>
                      <td className="text-left align-top">
                        {cellInput((c.testDate7 || "").slice(0, 10), (v) => void patchCube(c.id, { testDate7: v || null }), {
                          type: "date",
                        })}
                      </td>
                      <td className="text-left align-top">
                        {cellInput((c.testDate28 || "").slice(0, 10), (v) => void patchCube(c.id, { testDate28: v || null }), {
                          type: "date",
                        })}
                      </td>
                      <td className="text-left align-top">
                        {cellInput(c.load7 != null ? String(c.load7) : "", (v) =>
                          void patchCube(c.id, { load7: v ? Number(v) : null }), { numeric: true })}
                      </td>
                      <td className="text-left align-top">
                        {cellInput(c.load28 != null ? String(c.load28) : "", (v) =>
                          void patchCube(c.id, { load28: v ? Number(v) : null }), { numeric: true })}
                      </td>
                      <td className="text-left align-top font-medium">
                        {cellInput(strength != null ? String(strength) : "", (v) => {
                          const n = v ? Number(v) : null;
                          if (phase === "7D") void patchCube(c.id, { strength7: n, strength: n });
                          else if (phase === "28D") void patchCube(c.id, { strength28: n, strength: n });
                          else void patchCube(c.id, { strength: n });
                        }, { numeric: true })}
                      </td>
                      <td className="text-left align-top">
                        {cellInput(c.avgStrength != null ? String(c.avgStrength) : "", (v) =>
                          void patchCube(c.id, { avgStrength: v ? Number(v) : null }), { numeric: true })}
                      </td>
                      <td className="text-left align-top">
                        {canEdit ? (
                          <Select
                            className="!py-1 !text-xs !min-w-[5.5rem] register-sheet-cell--select"
                            value={c.result || "Pending"}
                            onChange={(e) => void patchCube(c.id, { result: e.target.value })}
                          >
                            {["Pending", "PASS", "FAIL"].map((r) => (
                              <option key={r}>{r}</option>
                            ))}
                          </Select>
                        ) : (
                          <Badge tone={/pass/i.test(c.result || "") ? "ok" : /fail/i.test(c.result || "") ? "danger" : "warn"}>
                            {c.result || "Pending"}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={14} className="empty text-left p-4">
                      No cube rows — Load SPDC template or add specimens with + Add row.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
