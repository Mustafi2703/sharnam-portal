import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { groupCubeRows, fmtCubeDate, type CubeGroup, type CubeRow } from "../lib/cubeRegister";
import { cubeResultRowClass, fmtRegisterNum } from "../lib/inspectionRequestForms";
import { useLocalRegisterRows } from "../hooks/useLocalRegisterRows";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { RegisterSheetCell } from "./RegisterSheetCell";
import { Badge, Button, Card, Input, Select } from "./ui";
import { RegisterFilterBar } from "./RegisterFilterBar";
import type { QapProjectMeta } from "./QapDetailRegister";

export type { CubeRow };

const emptyCube = () => ({
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
  project?: QapProjectMeta | null;
};

/** SPDC CUBE REGISTER — grouped specimens, popup editor, stable inline cells. */
export function CubeRegisterPanel({ projectId, token, rows, canEdit, onChanged, project }: Props) {
  const { localRows, mergeRow, mergeMany } = useLocalRegisterRows(rows);
  const [form, setForm] = useState(emptyCube());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [patchErr, setPatchErr] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editSpecimen, setEditSpecimen] = useState<CubeRow | null>(null);
  const [editGroup, setEditGroup] = useState<CubeGroup | null>(null);
  const [editForm, setEditForm] = useState(emptyCube());
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

  async function patchGroupField(group: CubeGroup, body: Record<string, unknown>) {
    const ids = group.specimens.map((s) => s.id);
    const prev = localRows.filter((r) => ids.includes(r.id));
    mergeMany(ids, body as Partial<CubeRow>);
    setPatchErr("");
    try {
      for (const s of group.specimens) {
        await api(`/api/checklist/project/${projectId}/cubes/${s.id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(body),
        });
      }
    } catch (err) {
      for (const p of prev) mergeRow(p.id, p);
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
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(group: CubeGroup, specimen: CubeRow) {
    setEditGroup(group);
    setEditSpecimen(specimen);
    setEditForm({
      srNo: group.srNo || "",
      castDate: group.castDate ? group.castDate.slice(0, 10) : "",
      description: group.description || "",
      grade: group.grade || "",
      testAgency: group.testAgency || specimen.testAgency || "",
      cubeWeight: specimen.cubeWeight != null ? String(specimen.cubeWeight) : "",
      testDate7: (specimen.testDate7 || group.testDate7 || "").slice(0, 10),
      testDate28: (specimen.testDate28 || group.testDate28 || "").slice(0, 10),
      load7: specimen.load7 != null ? String(specimen.load7) : "",
      load28: specimen.load28 != null ? String(specimen.load28) : "",
      strength7: specimen.strength7 != null ? String(specimen.strength7) : "",
      strength28: specimen.strength28 != null ? String(specimen.strength28) : "",
      avgStrength: group.avgStrength != null ? String(group.avgStrength) : specimen.avgStrength != null ? String(specimen.avgStrength) : "",
      result: specimen.result || "Pending",
    });
    setModalOpen(true);
  }

  async function saveModal() {
    if (!editSpecimen || !editGroup) return;
    setBusy(true);
    try {
      await patchGroupField(editGroup, {
        srNo: editForm.srNo || null,
        castDate: editForm.castDate || null,
        description: editForm.description,
        grade: editForm.grade || null,
        testAgency: editForm.testAgency || null,
        avgStrength: editForm.avgStrength ? Number(editForm.avgStrength) : null,
      });
      const phase = specimenPhase(editSpecimen);
      await patchCube(
        editSpecimen.id,
        {
          cubeWeight: editForm.cubeWeight ? Number(editForm.cubeWeight) : null,
          testDate7: editForm.testDate7 || null,
          testDate28: editForm.testDate28 || null,
          load7: editForm.load7 ? Number(editForm.load7) : null,
          load28: editForm.load28 ? Number(editForm.load28) : null,
          strength7: editForm.strength7 ? Number(editForm.strength7) : null,
          strength28: editForm.strength28 ? Number(editForm.strength28) : null,
          strength:
            phase === "7D" && editForm.strength7
              ? Number(editForm.strength7)
              : phase === "28D" && editForm.strength28
                ? Number(editForm.strength28)
                : null,
          result: editForm.result,
        },
        true
      );
      setModalOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const formFields = (
    <>
      <Input placeholder="Sr. No." value={form.srNo} onChange={(e) => setForm({ ...form, srNo: e.target.value })} />
      <Input type="date" value={form.castDate} onChange={(e) => setForm({ ...form, castDate: e.target.value })} />
      <Input className="sm:col-span-2" placeholder="Description / footing" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
      <Input placeholder="Concrete grade (e.g. M:25)" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
      <Input placeholder="Testing agency (NABL / site lab)" value={form.testAgency} onChange={(e) => setForm({ ...form, testAgency: e.target.value })} />
      <Input placeholder="Weight of cube (kg)" value={form.cubeWeight} onChange={(e) => setForm({ ...form, cubeWeight: e.target.value })} />
      <Input type="date" value={form.testDate7} onChange={(e) => setForm({ ...form, testDate7: e.target.value })} title="7-day testing date" />
      <Input type="date" value={form.testDate28} onChange={(e) => setForm({ ...form, testDate28: e.target.value })} title="28-day testing date" />
      <Input placeholder="7-day load (kN)" value={form.load7} onChange={(e) => setForm({ ...form, load7: e.target.value })} />
      <Input placeholder="28-day load (kN)" value={form.load28} onChange={(e) => setForm({ ...form, load28: e.target.value })} />
      <Input placeholder="7-day cube strength (MPa)" value={form.strength7} onChange={(e) => setForm({ ...form, strength7: e.target.value })} />
      <Input placeholder="28-day cube strength (MPa)" value={form.strength28} onChange={(e) => setForm({ ...form, strength28: e.target.value })} />
      <Input placeholder="Average strength" value={form.avgStrength} onChange={(e) => setForm({ ...form, avgStrength: e.target.value })} />
      <Select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
        {["Pending", "PASS", "FAIL"].map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
    </>
  );

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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-2">
      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2 shrink-0">{msg}</p>}
      {patchErr && <p className="text-sm text-danger bg-red-50 rounded-lg px-3 py-2 shrink-0">{patchErr}</p>}

      {canEdit && (
        <details className="shrink-0 rounded border border-line bg-white">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-brand-dark">
            Add cube test entry (SPDC format)
          </summary>
          <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 pt-0 border-t border-line" onSubmit={onCreate}>
            {formFields}
            <Button type="submit" disabled={busy} className="sm:col-span-2 lg:col-span-4 sm:w-auto">
              Add cube row
            </Button>
          </form>
        </details>
      )}

      {localRows.length === 0 && !busy && !syncing && (
        <Card className="!p-3 border-amber-200 bg-amber-50 text-sm text-amber-900 shrink-0">
          Cube register is empty — loading SPDC template automatically, or click <strong>Load SPDC cube template</strong> in the register header.
        </Card>
      )}

      <Card padding={false} className="spdc-register-panel relative flex flex-col min-h-0 flex-1 overflow-hidden">
        {(syncing || busy) && localRows.length === 0 && (
          <div className="spdc-register-loading">Loading cube register…</div>
        )}

        <div className="border-b border-line bg-white shrink-0">
          <div className="grid lg:grid-cols-[8rem_1fr_14rem] gap-0 border-b border-line">
            <div className="p-3 border-r border-line bg-sand/50 flex items-center justify-center text-[10px] font-semibold text-steel-muted uppercase tracking-wide">
              Client LOGO
            </div>
            <div className="p-4 flex items-center justify-center border-r border-line">
              <h2 className="font-display text-lg sm:text-xl font-bold text-brand-dark tracking-tight">
                SPDC Cube Register
              </h2>
            </div>
            <div className="p-3 bg-brand-soft/30 text-[10px] text-steel-muted leading-snug">
              <span className="font-bold text-brand-dark uppercase block mb-1">Legend</span>
              <span className="inline-block mr-2"><span className="cube-phase-7d px-1 rounded">7D</span> 7-day</span>
              <span className="inline-block mr-2"><span className="cube-phase-28d px-1 rounded">28D</span> 28-day</span>
              <span className="inline-block text-ok">Pass</span> · <span className="text-danger">Fail</span> · Pending
            </div>
          </div>
          <div className="spdc-register-meta">
            {(
              [
                ["Project", project?.name || "—", false],
                ["Client", project?.clientName || "—", true],
                ["Design Consultant", project?.designConsultant || "—", false],
                ["PM Consultant", "Sharnam Project Management Consultants", false],
                ["Contractor", project?.contractorName || "—", false],
              ] as const
            ).map(([label, value, highlightClient]) => (
              <div
                key={label}
                className={`spdc-register-meta__cell${highlightClient ? " spdc-register-meta__cell--client" : ""}`}
              >
                <span className="spdc-register-meta__label">{label}</span>
                <span className="spdc-register-meta__value" title={String(value)}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

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

        <div className="sheet-register flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="sheet-register__scroll flex-1 min-h-0">
            <table className="cube-register__table min-w-[92rem]">
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
                  {canEdit && <th rowSpan={2} className="text-left">Edit</th>}
                </tr>
                <tr>
                  <th className="spdc-th-sub text-center">7-day</th>
                  <th className="spdc-th-sub text-center">28-day</th>
                  <th className="spdc-th-sub text-center">7-day</th>
                  <th className="spdc-th-sub text-center">28-day</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <Fragment key={group.key}>
                    {group.specimens.map((c, idx) => {
                      const phase = specimenPhase(c);
                      const strength = rowStrength(c);
                      const isFirst = idx === 0;
                      const rowClass = `${cubeResultRowClass(c.result)}${isFirst ? " cube-group-start" : ""}`;
                      return (
                        <tr key={c.id} className={rowClass}>
                          <td className="text-left font-mono align-top">
                            {isFirst
                              ? cellInput(group.srNo, (v) => void patchGroupField(group, { srNo: v }))
                              : ""}
                          </td>
                          <td className="text-left border border-line px-1 py-0.5 align-top">
                            {isFirst
                              ? cellInput(
                                  group.castDate ? group.castDate.slice(0, 10) : "",
                                  (v) => void patchGroupField(group, { castDate: v || null }),
                                  { type: "date" }
                                )
                              : ""}
                          </td>
                          <td className="text-left border border-line px-1 py-0.5 align-top max-w-[14rem]">
                            {isFirst
                              ? cellInput(group.description, (v) => void patchGroupField(group, { description: v }), {
                                  className: "min-w-[10rem]",
                                })
                              : ""}
                          </td>
                          <td className="text-left border border-line px-1 py-0.5 align-top">
                            {isFirst ? cellInput(group.grade || "", (v) => void patchGroupField(group, { grade: v })) : ""}
                          </td>
                          <td className="text-left border border-line px-1 py-0.5 align-top">
                            {isFirst
                              ? cellInput(group.testAgency || c.testAgency || "", (v) =>
                                  void patchGroupField(group, { testAgency: v || null })
                                )
                              : ""}
                          </td>
                          <td className={`text-left font-mono align-top ${phase === "7D" ? "cube-phase-7d" : phase === "28D" ? "cube-phase-28d" : ""}`}>
                            {phase}
                          </td>
                          <td className="text-left align-top">
                            {cellInput(c.cubeWeight != null ? String(c.cubeWeight) : "", (v) =>
                              void patchCube(c.id, { cubeWeight: v ? Number(v) : null }), { numeric: true })}
                          </td>
                          <td className="text-left border border-line px-1 py-0.5 align-top">
                            {phase === "7D" || isFirst
                              ? cellInput(
                                  (c.testDate7 || group.testDate7 || "").slice(0, 10),
                                  (v) => void patchCube(c.id, { testDate7: v || null }),
                                  { type: "date" }
                                )
                              : "—"}
                          </td>
                          <td className="text-left border border-line px-1 py-0.5 align-top">
                            {phase === "28D" || isFirst
                              ? cellInput(
                                  (c.testDate28 || group.testDate28 || "").slice(0, 10),
                                  (v) => void patchCube(c.id, { testDate28: v || null }),
                                  { type: "date" }
                                )
                              : "—"}
                          </td>
                          <td className="text-left align-top">
                            {phase !== "28D"
                              ? cellInput(c.load7 != null ? String(c.load7) : "", (v) =>
                                  void patchCube(c.id, { load7: v ? Number(v) : null }), { numeric: true })
                              : "—"}
                          </td>
                          <td className="text-left align-top">
                            {phase !== "7D"
                              ? cellInput(c.load28 != null ? String(c.load28) : "", (v) =>
                                  void patchCube(c.id, { load28: v ? Number(v) : null }), { numeric: true })
                              : "—"}
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
                            {isFirst && group.avgStrength != null
                              ? cellInput(String(group.avgStrength), (v) =>
                                  void patchGroupField(group, { avgStrength: v ? Number(v) : null }), { numeric: true })
                              : isFirst
                                ? cellInput(c.avgStrength != null ? String(c.avgStrength) : "", (v) =>
                                    void patchGroupField(group, { avgStrength: v ? Number(v) : null }), { numeric: true })
                                : "—"}
                          </td>
                          <td className="text-left border border-line px-1 py-0.5 align-top">
                            {canEdit ? (
                              <Select
                                className="!py-0.5 !text-[10px] !min-w-[5rem]"
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
                          {canEdit && (
                            <td className="text-left align-top border border-line px-1 py-0.5">
                              <Button
                                type="button"
                                variant="secondary"
                                className="!py-0.5 !px-1.5 !text-[10px]"
                                onClick={() => openEdit(group, c)}
                              >
                                Edit
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
                {!grouped.length && (
                  <tr>
                    <td colSpan={canEdit ? 15 : 14} className="empty text-left p-4">
                      No cube rows — Load SPDC template or add specimens above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <RegisterEntryModal
        open={modalOpen}
        title="Edit cube test row"
        size="lg"
        onClose={() => setModalOpen(false)}
        onSave={saveModal}
        saving={busy}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input placeholder="Sr. No." value={editForm.srNo} onChange={(e) => setEditForm({ ...editForm, srNo: e.target.value })} />
          <Input type="date" value={editForm.castDate} onChange={(e) => setEditForm({ ...editForm, castDate: e.target.value })} />
          <Input placeholder="Grade" value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} />
          <Input className="sm:col-span-2 lg:col-span-3" placeholder="Description / footing" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          <Input placeholder="Test agency" value={editForm.testAgency} onChange={(e) => setEditForm({ ...editForm, testAgency: e.target.value })} />
          <Input placeholder="Weight (kg)" value={editForm.cubeWeight} onChange={(e) => setEditForm({ ...editForm, cubeWeight: e.target.value })} />
          <Input type="date" value={editForm.testDate7} onChange={(e) => setEditForm({ ...editForm, testDate7: e.target.value })} />
          <Input type="date" value={editForm.testDate28} onChange={(e) => setEditForm({ ...editForm, testDate28: e.target.value })} />
          <Input placeholder="7-day load (kN)" value={editForm.load7} onChange={(e) => setEditForm({ ...editForm, load7: e.target.value })} />
          <Input placeholder="28-day load (kN)" value={editForm.load28} onChange={(e) => setEditForm({ ...editForm, load28: e.target.value })} />
          <Input placeholder="7-day strength (MPa)" value={editForm.strength7} onChange={(e) => setEditForm({ ...editForm, strength7: e.target.value })} />
          <Input placeholder="28-day strength (MPa)" value={editForm.strength28} onChange={(e) => setEditForm({ ...editForm, strength28: e.target.value })} />
          <Input placeholder="Average strength" value={editForm.avgStrength} onChange={(e) => setEditForm({ ...editForm, avgStrength: e.target.value })} />
          <Select value={editForm.result} onChange={(e) => setEditForm({ ...editForm, result: e.target.value })}>
            {["Pending", "PASS", "FAIL"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </div>
      </RegisterEntryModal>
    </div>
  );
}
