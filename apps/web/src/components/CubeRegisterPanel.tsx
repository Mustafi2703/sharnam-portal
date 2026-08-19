import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Input, Select } from "./ui";
import { RegisterEntryModal } from "./RegisterEntryModal";

export type CubeRow = {
  id: string;
  srNo?: string | null;
  castDate?: string | null;
  description: string;
  grade?: string | null;
  cubeWeight?: number | null;
  testDate7?: string | null;
  testDate28?: string | null;
  load7?: number | null;
  load28?: number | null;
  strength7?: number | null;
  strength28?: number | null;
  strength?: number | null;
  avgStrength?: number | null;
  result?: string | null;
};

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

/** SPDC CUBE REGISTER layout — cast, 7-day / 28-day load & strength, result. */
export function CubeRegisterPanel({ projectId, token, rows, canEdit, onChanged }: Props) {
  const [form, setForm] = useState(emptyCube());
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyCube());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!modalOpen) setEditForm(emptyCube());
  }, [modalOpen]);

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
      <Input className="sm:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
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
          <p className="text-xs text-steel-muted mb-3">Matches SPDC CUBE REGISTER — inline form below; Edit opens popup.</p>
          <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={onCreate}>
            {formFields}
            <Button type="submit" disabled={busy} className="sm:col-span-2 lg:col-span-4 sm:w-auto">
              Add cube row
            </Button>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40">
          <h3 className="font-semibold text-sm text-left">Cube register — SPDC format ({rows.length} rows)</h3>
        </div>
        <div className="sheet-register overflow-x-auto max-h-[32rem]">
          <table className="sheet-register__table min-w-[72rem] w-full text-xs">
            <thead>
              <tr>
                <th className="text-left">Sr</th>
                <th className="text-left">Cast date</th>
                <th className="text-left">Description</th>
                <th className="text-left">Grade</th>
                <th className="text-left">Weight</th>
                <th className="text-left">7-day test</th>
                <th className="text-left">28-day test</th>
                <th className="text-left">7-day load</th>
                <th className="text-left">28-day load</th>
                <th className="text-left">7-day str.</th>
                <th className="text-left">Avg str.</th>
                <th className="text-left">Result</th>
                {canEdit && <th className="text-left">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="text-left font-mono">{c.srNo || "—"}</td>
                  <td className="text-left whitespace-nowrap">{fmtDate(c.castDate)}</td>
                  <td className="text-left max-w-[12rem] truncate">{c.description}</td>
                  <td className="text-left">{c.grade || "—"}</td>
                  <td className="text-left tabular-nums">{c.cubeWeight ?? "—"}</td>
                  <td className="text-left whitespace-nowrap">{fmtDate(c.testDate7)}</td>
                  <td className="text-left whitespace-nowrap">{fmtDate(c.testDate28)}</td>
                  <td className="text-left tabular-nums">{c.load7 ?? "—"}</td>
                  <td className="text-left tabular-nums">{c.load28 ?? "—"}</td>
                  <td className="text-left tabular-nums">{c.strength7 ?? "—"}</td>
                  <td className="text-left tabular-nums">{c.avgStrength ?? "—"}</td>
                  <td className="text-left">
                    <Badge tone={/pass/i.test(c.result || "") ? "ok" : /fail/i.test(c.result || "") ? "danger" : "warn"}>
                      {c.result || "—"}
                    </Badge>
                  </td>
                  {canEdit && (
                    <td className="text-left">
                      <Button type="button" variant="secondary" className="!py-1 !px-2 !text-[10px]" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={canEdit ? 13 : 12} className="empty text-left">
                    No cube rows — add above or re-seed from SPDC CUBE REGISTER.
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
