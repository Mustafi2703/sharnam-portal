import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { ReferenceSheetToolbar } from "./ReferenceSheetToolbar";
import { RegisterEmptyRow } from "./RegisterSheetFrame";
import { Button, Card, Input, TextArea } from "./ui";
import { formatUiText } from "../lib/formatUiText";

export type LessonRow = {
  id: string;
  srNo?: number | null;
  category?: string | null;
  description?: string | null;
  wentWell?: string | null;
  notMetExpectation?: string | null;
  lessonsLearnt?: string | null;
  valueDifferentiator?: string | null;
  source?: string | null;
  updatedAt?: string;
};

const EMPTY_FORM = {
  description: "",
  wentWell: "",
  notMetExpectation: "",
  lessonsLearnt: "",
  valueDifferentiator: "",
};

type Props = {
  projectId: string;
  token: string | null;
  canEdit: boolean;
  /** When true, show read-only banner (legacy — lessons live in Closure). */
  readOnly?: boolean;
  canResyncExcel?: boolean;
  onResyncTemplate?: () => void | Promise<void>;
  registerSyncBusy?: boolean;
  refreshKey?: number;
};

export function LessonsLearntRegister({
  projectId,
  token,
  canEdit,
  readOnly = false,
  canResyncExcel = false,
  onResyncTemplate,
  registerSyncBusy = false,
  refreshKey = 0,
}: Props) {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<LessonRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    const out = await api<{ lessons: LessonRow[] }>(`/api/closure/project/${projectId}/lessons`, { token });
    setLessons(out.lessons || []);
  }, [projectId, token]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function openAdd() {
    setEditRow(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(row: LessonRow) {
    setEditRow(row);
    setForm({
      description: row.description || "",
      wentWell: row.wentWell || "",
      notMetExpectation: row.notMetExpectation || "",
      lessonsLearnt: row.lessonsLearnt || "",
      valueDifferentiator: row.valueDifferentiator || "",
    });
    setModalOpen(true);
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!token || !canEdit || readOnly) return;
    setBusy(true);
    setMsg("");
    try {
      if (editRow) {
        await api(`/api/closure/lessons/${editRow.id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(form),
        });
        setMsg("Lesson updated — logged in audit trail.");
      } else {
        await api(`/api/closure/project/${projectId}/lessons`, {
          method: "POST",
          token,
          body: JSON.stringify(form),
        });
        setMsg("Lesson added — logged in audit trail.");
      }
      setModalOpen(false);
      setEditRow(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: LessonRow) {
    if (!token || !canEdit || readOnly) return;
    if (!window.confirm(`Remove lesson #${row.srNo ?? "—"}?`)) return;
    setBusy(true);
    try {
      await api(`/api/closure/lessons/${row.id}`, { method: "DELETE", token });
      setMsg("Lesson removed — logged in audit trail.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="progress-sheet-block space-y-3">
      <ReferenceSheetToolbar
        sheetLabel="Lessons Learnt — Sharnam PMC"
        rowCount={lessons.length}
        canEdit={canEdit && !readOnly}
        onAddRow={canEdit && !readOnly ? openAdd : undefined}
        onGenerate={canResyncExcel && onResyncTemplate ? () => void onResyncTemplate() : undefined}
        generateLabel="Load SPDC template"
        busy={registerSyncBusy || busy}
        message={msg || undefined}
        uploadHint="Rows from Lessons Learnt - Sharnam PMC.xls — add site notes; portal edits are audit-logged."
      />

      <Card padding={false} className="sheet-register register-table-panel spdc-register-panel flex-1 min-h-0 flex flex-col overflow-hidden !p-0">
        <div className="sheet-register__head shrink-0">{formatUiText("Lessons learnt register")}</div>
        <div className="sheet-register__scroll register-sheet-viewport scrollbars-visible flex-1 min-h-0">
          <table className="sheet-register__table w-full text-sm min-w-[56rem]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line bg-white">
                <th className="py-2.5 px-3">S.No</th>
                <th className="py-2.5 pr-3">Description</th>
                <th className="py-2.5 pr-3">What went well</th>
                <th className="py-2.5 pr-3">What did not meet expectations</th>
                <th className="py-2.5 pr-3">How it could have been done better</th>
                <th className="py-2.5 px-3">Value differentiator</th>
                {canEdit && !readOnly ? <th className="py-2.5 px-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id} className="border-b border-line/70 align-top hover:bg-sand/20">
                  <td className="py-2 px-3 font-mono text-xs">{l.srNo ?? "—"}</td>
                  <td className="py-2 pr-3 font-medium">{l.description || "—"}</td>
                  <td className="py-2 pr-3 text-sm">{l.wentWell || "—"}</td>
                  <td className="py-2 pr-3 text-sm">{l.notMetExpectation || "—"}</td>
                  <td className="py-2 pr-3 text-sm">{l.lessonsLearnt || "—"}</td>
                  <td className="py-2 px-3 text-sm">{l.valueDifferentiator || "—"}</td>
                  {canEdit && !readOnly ? (
                    <td className="py-2 px-3 whitespace-nowrap">
                      <button type="button" className="text-xs font-semibold text-brand underline mr-2" onClick={() => openEdit(l)}>
                        Edit
                      </button>
                      <button type="button" className="text-xs font-semibold text-danger underline" disabled={busy} onClick={() => void remove(l)}>
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!lessons.length && <RegisterEmptyRow colSpan={canEdit && !readOnly ? 7 : 6} />}
            </tbody>
          </table>
        </div>
      </Card>

      {!readOnly ? (
        <RegisterEntryModal
          open={modalOpen}
          title={editRow ? `Edit lesson #${editRow.srNo ?? "—"}` : "Add lesson learnt"}
          onClose={() => {
            setModalOpen(false);
            setEditRow(null);
          }}
          onSave={() => void save()}
          saving={busy}
          saveLabel={editRow ? "Save changes" : "Add lesson"}
          size="xl"
        >
          <div className="grid gap-3">
            <Input
              required
              placeholder="Description / stage / category"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TextArea rows={2} placeholder="What went well" value={form.wentWell} onChange={(e) => setForm({ ...form, wentWell: e.target.value })} />
            <TextArea rows={2} placeholder="What did not meet expectations" value={form.notMetExpectation} onChange={(e) => setForm({ ...form, notMetExpectation: e.target.value })} />
            <TextArea rows={2} placeholder="How it could have been done better" value={form.lessonsLearnt} onChange={(e) => setForm({ ...form, lessonsLearnt: e.target.value })} />
            <Input placeholder="Value differentiator (optional)" value={form.valueDifferentiator} onChange={(e) => setForm({ ...form, valueDifferentiator: e.target.value })} />
          </div>
        </RegisterEntryModal>
      ) : null}
    </div>
  );
}
