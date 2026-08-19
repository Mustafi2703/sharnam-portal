import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { groupCubeRows, fmtCubeDate, type CubeRow } from "../lib/cubeRegister";
import { Badge, Button, Card, Input, Select } from "./ui";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { RegisterFilterBar } from "./RegisterFilterBar";

export type { CubeRow };

const emptyCube = () => ({
  srNo: "",
  castDate: "",
  description: "",
  grade: "",
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

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

type Props = {
  projectId: string;
  token?: string | null;
  rows: CubeRow[];
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
};

/** SPDC CUBE REGISTER — grouped by Sr. No. / footing description with filters. */
export function CubeRegisterPanel({ projectId, token, rows, canEdit, onChanged }: Props) {
  const [form, setForm] = useState(emptyCube());
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyCube());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({
    grade: "All",
    result: "All",
    from: "",
    to: "",
    q: "",
  });

  useEffect(() => {
    if (!modalOpen) setEditForm(emptyCube());
  }, [modalOpen]);

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
        const hay = `${c.srNo} ${c.description} ${c.grade}`.toLowerCase();
        if (!hay.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const grouped = useMemo(() => groupCubeRows(filtered), [filtered]);

  async function syncTemplate() {
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ imported: number; groups: number }>(
        `/api/checklist/project/${projectId}/cubes/sync-template`,
        { method: "POST", token }
      );
      setMsg(`Loaded ${out.imported} cube specimens in ${out.groups} footing groups from SPDC register.`);
      await onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
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
          strength7: form.load7 && form.strength7 ? Number(form.strength7) : null,
          strength28: form.load28 && form.strength28 ? Number(form.strength28) : null,
          avgStrength: form.avgStrength ? Number(form.avgStrength) : null,
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

  function openEdit(c: CubeRow) {
    setEditId(c.id);
    setEditForm({
      srNo: c.srNo || "",
      castDate: c.castDate ? c.castDate.slice(0, 10) : "",
      description: c.description,
      grade: c.grade || "",
      cubeWeight: c.cubeWeight != null ? String(c.cubeWeight) : "",
      testDate7: c.testDate7 ? c.testDate7.slice(0, 10) : "",
      testDate28: c.testDate28 ? c.testDate28.slice(0, 10) : "",
      load7: c.load7 != null ? String(c.load7) : "",
      load28: c.load28 != null ? String(c.load28) : "",
      strength7: c.strength7 != null ? String(c.strength7) : c.strength != null ? String(c.strength) : "",
      strength28: c.strength28 != null ? String(c.strength28) : "",
      avgStrength: c.avgStrength != null ? String(c.avgStrength) : "",
      result: c.result || "Pending",
    });
    setModalOpen(true);
  }

  async function saveModal() {
    if (!editId) return;
    setBusy(true);
    try {
      await submitCube(
        {
          ...editForm,
          cubeWeight: editForm.cubeWeight ? Number(editForm.cubeWeight) : null,
          load7: editForm.load7 ? Number(editForm.load7) : null,
          load28: editForm.load28 ? Number(editForm.load28) : null,
          strength7: editForm.strength7 ? Number(editForm.strength7) : null,
          strength28: editForm.strength28 ? Number(editForm.strength28) : null,
          avgStrength: editForm.avgStrength ? Number(editForm.avgStrength) : null,
        },
        "PATCH",
        editId
      );
      setModalOpen(false);
      setEditId(null);
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
      <Input placeholder="Weight of cube (kg)" value={form.cubeWeight} onChange={(e) => setForm({ ...form, cubeWeight: e.target.value })} />
      <Input type="date" value={form.testDate7} onChange={(e) => setForm({ ...form, testDate7: e.target.value })} title="7-day testing date" />
      <Input type="date" value={form.testDate28} onChange={(e) => setForm({ ...form, testDate28: e.target.value })} title="28-day testing date" />
      <Input placeholder="7-day load (kN)" value={form.load7} onChange={(e) => setForm({ ...form, load7: e.target.value })} />
      <Input placeholder="28-day load (kN)" value={form.load28} onChange={(e) => setForm({ ...form, load28: e.target.value })} />
      <Input placeholder="7-day cube strength" value={form.strength7} onChange={(e) => setForm({ ...form, strength7: e.target.value })} />
      <Input placeholder="28-day cube strength" value={form.strength28} onChange={(e) => setForm({ ...form, strength28: e.target.value })} />
      <Input placeholder="Average strength" value={form.avgStrength} onChange={(e) => setForm({ ...form, avgStrength: e.target.value })} />
      <Select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
        {["Pending", "PASS", "FAIL"].map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
    </>
  );

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2">{msg}</p>}

      {canEdit && (
        <Card>
          <h3 className="font-semibold mb-1">Add cube test entry</h3>
          <p className="text-xs text-steel-muted mb-3">SPDC CUBE REGISTER — group by Sr. No. / footing; multiple test rows per group.</p>
          <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={onCreate}>
            {formFields}
            <Button type="submit" disabled={busy} className="sm:col-span-2 lg:col-span-4 sm:w-auto">
              Add cube row
            </Button>
          </form>
        </Card>
      )}

      <Card padding={false} className="flex flex-col max-h-[calc(100vh-10rem)] min-h-[24rem]">
        <div className="px-4 py-3 border-b border-line bg-sand/40 shrink-0 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-sm text-left">
            Cube register — SPDC format ({filtered.length} specimens · {grouped.length} groups)
          </h3>
          {canEdit && (
            <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => void syncTemplate()}>
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
            { key: "q", label: "Search", type: "text", placeholder: "Sr, footing, grade…" },
          ]}
          values={filters}
          onChange={(k, v) => setFilters({ ...filters, [k]: v })}
          onClear={() => setFilters({ grade: "All", result: "All", from: "", to: "", q: "" })}
        />

        <div className="sheet-register overflow-auto flex-1 min-h-0">
          <table className="sheet-register__table min-w-[80rem] w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-sm">
              <tr className="bg-brand text-white text-[10px]">
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                  Sr. No.
                </th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                  Date of Casting
                </th>
                <th rowSpan={2} className="text-left min-w-[10rem] border border-brand-dark/30 px-1 py-1">
                  Description
                </th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                  Concrete Grade
                </th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                  Weight of Cube
                </th>
                <th colSpan={2} className="text-center border border-brand-dark/30 px-1 py-0.5">
                  Testing Date
                </th>
                <th colSpan={2} className="text-center border border-brand-dark/30 px-1 py-0.5">
                  Load
                </th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                  Cube Strength
                </th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                  Average Strength
                </th>
                <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                  Result
                </th>
                {canEdit && (
                  <th rowSpan={2} className="text-left border border-brand-dark/30 px-1 py-1">
                    Action
                  </th>
                )}
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
                    const strength = c.strength28 ?? c.strength7 ?? c.strength;
                    const showAvg = c.avgStrength != null;
                    const showResult = c.result && /pass|fail|pending/i.test(c.result);
                    return (
                      <tr key={c.id} className={idx % 2 === 0 ? "bg-white" : "bg-sand/15"}>
                        <td className="text-left font-mono border border-line px-1 py-0.5 align-top">
                          {idx === 0 ? group.srNo : ""}
                        </td>
                        <td className="text-left whitespace-nowrap border border-line px-1 py-0.5 align-top">
                          {idx === 0 ? fmtCubeDate(group.castDate) : ""}
                        </td>
                        <td className="text-left border border-line px-1 py-0.5 align-top max-w-[12rem]">
                          {idx === 0 ? group.description : ""}
                        </td>
                        <td className="text-left border border-line px-1 py-0.5 align-top">
                          {idx === 0 ? group.grade || "—" : ""}
                        </td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top">
                          {c.cubeWeight ?? "—"}
                        </td>
                        <td className="text-left whitespace-nowrap border border-line px-1 py-0.5 align-top text-[10px]">
                          {idx === 0 ? fmtCubeDate(group.testDate7) : ""}
                        </td>
                        <td className="text-left whitespace-nowrap border border-line px-1 py-0.5 align-top text-[10px]">
                          {idx === 0 ? fmtCubeDate(group.testDate28) : ""}
                        </td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top">
                          {c.load7 ?? "—"}
                        </td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top">
                          {c.load28 ?? "—"}
                        </td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top font-medium">
                          {strength ?? "—"}
                        </td>
                        <td className="text-left tabular-nums border border-line px-1 py-0.5 align-top">
                          {showAvg ? c.avgStrength : "—"}
                        </td>
                        <td className="text-left border border-line px-1 py-0.5 align-top">
                          {showResult ? (
                            <Badge tone={/pass/i.test(c.result || "") ? "ok" : /fail/i.test(c.result || "") ? "danger" : "warn"}>
                              {c.result}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        {canEdit && (
                          <td className="text-left border border-line px-1 py-0.5 align-top">
                            <Button type="button" variant="secondary" className="!py-0.5 !px-1.5 !text-[9px]" onClick={() => openEdit(c)}>
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
                  <td colSpan={canEdit ? 13 : 12} className="empty text-left p-4">
                    No cube rows — Load SPDC template or add specimens above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <RegisterEntryModal open={modalOpen} title="Edit cube entry" onClose={() => setModalOpen(false)} onSave={saveModal} saving={busy}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input value={editForm.srNo} onChange={(e) => setEditForm({ ...editForm, srNo: e.target.value })} placeholder="Sr. No." />
          <Input type="date" value={editForm.castDate} onChange={(e) => setEditForm({ ...editForm, castDate: e.target.value })} />
          <Input className="sm:col-span-2" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description" />
          <Input value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} placeholder="Grade" />
          <Input value={editForm.cubeWeight} onChange={(e) => setEditForm({ ...editForm, cubeWeight: e.target.value })} placeholder="Weight" />
          <Input type="date" value={editForm.testDate7} onChange={(e) => setEditForm({ ...editForm, testDate7: e.target.value })} />
          <Input type="date" value={editForm.testDate28} onChange={(e) => setEditForm({ ...editForm, testDate28: e.target.value })} />
          <Input value={editForm.load7} onChange={(e) => setEditForm({ ...editForm, load7: e.target.value })} placeholder="7-day load" />
          <Input value={editForm.load28} onChange={(e) => setEditForm({ ...editForm, load28: e.target.value })} placeholder="28-day load" />
          <Input value={editForm.strength7} onChange={(e) => setEditForm({ ...editForm, strength7: e.target.value })} placeholder="7-day strength" />
          <Input value={editForm.strength28} onChange={(e) => setEditForm({ ...editForm, strength28: e.target.value })} placeholder="28-day strength" />
          <Input value={editForm.avgStrength} onChange={(e) => setEditForm({ ...editForm, avgStrength: e.target.value })} placeholder="Average" />
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
