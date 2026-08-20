import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { groupCubeRows, fmtCubeDate, type CubeGroup, type CubeRow } from "../lib/cubeRegister";
import { Badge, Button, Card, Input, Select } from "./ui";
import { RegisterFilterBar } from "./RegisterFilterBar";

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
};

/** SPDC CUBE REGISTER — grouped specimens with inline edit + DPR summary stats. */
export function CubeRegisterPanel({ projectId, token, rows, canEdit, onChanged }: Props) {
  const [form, setForm] = useState(emptyCube());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
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
  }, [canEdit, rows, projectId]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.grade && set.add(r.grade));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((c) => {
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
  }, [rows, filters]);

  const grouped = useMemo(() => groupCubeRows(filtered), [filtered]);

  const stats = useMemo(() => {
    const pass = rows.filter((r) => /pass/i.test(r.result || "")).length;
    const fail = rows.filter((r) => /fail/i.test(r.result || "")).length;
    const pending = rows.length - pass - fail;
    const groups = groupCubeRows(rows).length;
    const agencies = new Set(rows.map((r) => r.testAgency).filter(Boolean));
    return { pass, fail, pending, groups, agencies: agencies.size };
  }, [rows]);

  async function syncTemplate(silent = false) {
    if (!silent) {
      setBusy(true);
      setMsg("");
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
    }
  }

  async function patchCube(id: string, body: Record<string, unknown>) {
    await api(`/api/checklist/project/${projectId}/cubes/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
  }

  async function patchGroupField(group: CubeGroup, body: Record<string, unknown>) {
    for (const s of group.specimens) {
      await patchCube(s.id, body);
    }
    await onChanged();
  }

  async function patchRow(id: string, body: Record<string, unknown>) {
    await patchCube(id, body);
    await onChanged();
  }

  async function submitCube(body: Record<string, unknown>, method: "POST" | "PATCH", id?: string) {
    const url =
      method === "POST"
        ? `/api/checklist/project/${projectId}/cubes`
        : `/api/checklist/project/${projectId}/cubes/${id}`;
    await api(url, { method, token, body: JSON.stringify(body) });
    await onChanged();
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await submitCube(
        {
          ...form,
          cubeWeight: form.cubeWeight ? Number(form.cubeWeight) : null,
          load7: form.load7 ? Number(form.load7) : null,
          load28: form.load28 ? Number(form.load28) : null,
          strength7: form.strength7 ? Number(form.strength7) : null,
          strength28: form.strength28 ? Number(form.strength28) : null,
          avgStrength: form.avgStrength ? Number(form.avgStrength) : null,
          testAgency: form.testAgency || null,
        },
        "POST"
      );
      setForm(emptyCube());
      setMsg("Cube entry added.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
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
    defaultValue: string,
    onSave: (v: string) => void,
    opts?: { type?: string; className?: string; placeholder?: string }
  ) {
    if (!canEdit) return defaultValue || "—";
    return (
      <Input
        type={opts?.type || "text"}
        className={`!py-0.5 !text-[11px] min-w-[4rem] ${opts?.className || ""}`}
        defaultValue={defaultValue}
        placeholder={opts?.placeholder}
        onBlur={(e) => {
          const v = e.target.value;
          if (v === defaultValue) return;
          onSave(v);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2">{msg}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Specimens</div>
          <div className="text-xl font-display">{filtered.length}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Footing groups</div>
          <div className="text-xl font-display">{grouped.length}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Pass</div>
          <div className="text-xl font-display text-ok">{stats.pass}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Fail</div>
          <div className="text-xl font-display text-danger">{stats.fail}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Pending</div>
          <div className="text-xl font-display">{stats.pending}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-[10px] uppercase text-steel-muted">Test agencies logged</div>
          <div className="text-xl font-display">{stats.agencies}</div>
        </Card>
      </div>

      {canEdit && (
        <Card>
          <h3 className="font-semibold mb-1">Add cube test entry</h3>
          <p className="text-xs text-steel-muted mb-3">
            SPDC format — each footing group has multiple specimens (typically 7-day + 28-day rows). Feeds DPR quality block.
          </p>
          <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={onCreate}>
            {formFields}
            <Button type="submit" disabled={busy} className="sm:col-span-2 lg:col-span-4 sm:w-auto">
              Add cube row
            </Button>
          </form>
        </Card>
      )}

      {rows.length === 0 && !busy && (
        <Card className="!p-3 border-amber-200 bg-amber-50 text-sm text-amber-900">
          Cube register is empty — loading SPDC template automatically, or click <strong>Load SPDC cube template</strong>.
        </Card>
      )}

      <Card padding={false} className="flex flex-col max-h-[calc(100vh-10rem)] min-h-[24rem]">
        <div className="px-4 py-3 border-b border-line bg-sand/40 shrink-0 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-sm text-left">
            Cube register — SPDC format ({filtered.length} specimens · {grouped.length} groups)
          </h3>
          {canEdit && (
            <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => void syncTemplate(false)}>
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

        <div className="sheet-register overflow-auto flex-1 min-h-0 overscroll-contain">
          <table className="sheet-register__table min-w-[92rem] w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <tr className="bg-brand text-white text-[10px]">
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">Sr. No.</th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">Date of Casting</th>
                <th rowSpan={2} className="text-left min-w-[10rem] border border-brand-dark/30 px-1 py-1">Description</th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">Grade</th>
                <th rowSpan={2} className="text-left min-w-[7rem] border border-brand-dark/30 px-1 py-1">Test agency</th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">Phase</th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">Weight</th>
                <th colSpan={2} className="text-center border border-brand-dark/30 px-1 py-0.5">Testing Date</th>
                <th colSpan={2} className="text-center border border-brand-dark/30 px-1 py-0.5">Load (kN)</th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">Strength MPa</th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">Avg</th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">Result</th>
              </tr>
              <tr className="bg-brand text-white text-[10px]">
                <th className="border border-brand-dark/30 px-1 py-0.5">7-day</th>
                <th className="border border-brand-dark/30 px-1 py-0.5">28-day</th>
                <th className="border border-brand-dark/30 px-1 py-0.5">7-day</th>
                <th className="border border-brand-dark/30 px-1 py-0.5">28-day</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <Fragment key={group.key}>
                  {group.specimens.map((c, idx) => {
                    const phase = specimenPhase(c);
                    const strength = rowStrength(c);
                    const isFirst = idx === 0;
                    return (
                      <tr key={c.id} className={idx % 2 === 0 ? "bg-white" : "bg-sand/15"}>
                        <td className="text-left font-mono border border-line px-1 py-0.5 align-top">
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
                          {isFirst
                            ? cellInput(group.grade || "", (v) => void patchGroupField(group, { grade: v }))
                            : ""}
                        </td>
                        <td className="text-left border border-line px-1 py-0.5 align-top">
                          {isFirst
                            ? cellInput(group.testAgency || c.testAgency || "", (v) =>
                                void patchGroupField(group, { testAgency: v || null })
                              )
                            : ""}
                        </td>
                        <td className="text-left font-mono border border-line px-1 py-0.5 align-top">{phase}</td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top">
                          {cellInput(c.cubeWeight != null ? String(c.cubeWeight) : "", (v) =>
                            void patchRow(c.id, { cubeWeight: v ? Number(v) : null })
                          )}
                        </td>
                        <td className="text-left border border-line px-1 py-0.5 align-top">
                          {phase === "7D" || isFirst
                            ? cellInput(
                                (c.testDate7 || group.testDate7 || "").slice(0, 10),
                                (v) => void patchRow(c.id, { testDate7: v || null }),
                                { type: "date" }
                              )
                            : "—"}
                        </td>
                        <td className="text-left border border-line px-1 py-0.5 align-top">
                          {phase === "28D" || isFirst
                            ? cellInput(
                                (c.testDate28 || group.testDate28 || "").slice(0, 10),
                                (v) => void patchRow(c.id, { testDate28: v || null }),
                                { type: "date" }
                              )
                            : "—"}
                        </td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top">
                          {phase !== "28D"
                            ? cellInput(c.load7 != null ? String(c.load7) : "", (v) =>
                                void patchRow(c.id, { load7: v ? Number(v) : null })
                              )
                            : "—"}
                        </td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top">
                          {phase !== "7D"
                            ? cellInput(c.load28 != null ? String(c.load28) : "", (v) =>
                                void patchRow(c.id, { load28: v ? Number(v) : null })
                              )
                            : "—"}
                        </td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top font-medium">
                          {cellInput(strength != null ? String(strength) : "", (v) => {
                            const n = v ? Number(v) : null;
                            if (phase === "7D") void patchRow(c.id, { strength7: n, strength: n });
                            else if (phase === "28D") void patchRow(c.id, { strength28: n, strength: n });
                            else void patchRow(c.id, { strength: n });
                          })}
                        </td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top">
                          {isFirst && group.avgStrength != null
                            ? cellInput(String(group.avgStrength), (v) =>
                                void patchGroupField(group, { avgStrength: v ? Number(v) : null })
                              )
                            : isFirst
                              ? cellInput(c.avgStrength != null ? String(c.avgStrength) : "", (v) =>
                                  void patchGroupField(group, { avgStrength: v ? Number(v) : null })
                                )
                              : "—"}
                        </td>
                        <td className="text-left border border-line px-1 py-0.5 align-top">
                          {canEdit ? (
                            <Select
                              className="!py-0.5 !text-[10px] !min-w-[5rem]"
                              value={c.result || "Pending"}
                              onChange={(e) => void patchRow(c.id, { result: e.target.value })}
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
                </Fragment>
              ))}
              {!grouped.length && (
                <tr>
                  <td colSpan={14} className="empty text-left p-4">
                    No cube rows — Load SPDC template or add specimens above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
