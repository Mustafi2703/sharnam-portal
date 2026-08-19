import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Input, Select, TextArea } from "./ui";
import { RegisterEntryModal } from "./RegisterEntryModal";

export type QualitySiteRecord = {
  id: string;
  recordType: string;
  title: string;
  description?: string | null;
  location?: string | null;
  severity?: string | null;
  status: string;
  issuedTo?: string | null;
  correctiveAction?: string | null;
  occurredAt: string;
  reportedBy?: { fullName: string };
};

const SEVERITIES = ["Low", "Medium", "High", "Critical"];

type Props = {
  projectId: string;
  token?: string | null;
  recordType: "Site Observation" | "Site Instruction";
  canEdit: boolean;
  onChanged?: () => void | Promise<void>;
};

const emptyForm = (recordType: string) => ({
  recordType,
  title: "",
  description: "",
  location: "",
  severity: "Medium",
  status: "Open",
  issuedTo: "",
  correctiveAction: "",
});

export function QualitySiteRegister({ projectId, token, recordType, canEdit, onChanged }: Props) {
  const [rows, setRows] = useState<QualitySiteRecord[]>([]);
  const [form, setForm] = useState(emptyForm(recordType));
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm(recordType));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const list = await api<QualitySiteRecord[]>(
      `/api/checklist/project/${projectId}/quality-site-records?type=${encodeURIComponent(recordType)}`,
      { token }
    );
    setRows(Array.isArray(list) ? list : []);
  };

  useEffect(() => {
    void load();
  }, [projectId, token, recordType]);

  const filtered = useMemo(() => rows.filter((r) => r.recordType === recordType), [rows, recordType]);

  async function createRecord(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/checklist/project/${projectId}/quality-site-records`, {
        method: "POST",
        token,
        body: JSON.stringify({
          ...form,
          title: form.title || `${recordType} — ${form.location || "Site"}`,
        }),
      });
      setForm(emptyForm(recordType));
      setMsg(`${recordType} logged — SOR Log totals updated.`);
      await load();
      await onChanged?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveModal() {
    if (!editId) return;
    setBusy(true);
    try {
      await api(`/api/checklist/project/${projectId}/quality-site-records/${editId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(editForm),
      });
      setModalOpen(false);
      setEditId(null);
      await load();
      await onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  function openEdit(r: QualitySiteRecord) {
    setEditId(r.id);
    setEditForm({
      recordType: r.recordType,
      title: r.title,
      description: r.description || "",
      location: r.location || "",
      severity: r.severity || "Medium",
      status: r.status,
      issuedTo: r.issuedTo || "",
      correctiveAction: r.correctiveAction || "",
    });
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2">{msg}</p>}

      {canEdit && (
        <Card>
          <h3 className="font-semibold mb-1">Log {recordType.toLowerCase()}</h3>
          <p className="text-xs text-steel-muted mb-3">Inline form — or use Edit on a row to open the popup editor.</p>
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={createRecord}>
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input placeholder="Issued to" value={form.issuedTo} onChange={(e) => setForm({ ...form, issuedTo: e.target.value })} />
            <TextArea
              className="sm:col-span-2 lg:col-span-3"
              rows={2}
              placeholder="Description / observation"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
            <TextArea
              className="sm:col-span-2"
              rows={2}
              placeholder="Corrective action"
              value={form.correctiveAction}
              onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
            />
            <Button type="submit" disabled={busy} className="sm:col-span-2 lg:col-span-3 sm:w-auto">
              Save {recordType.toLowerCase()}
            </Button>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40">
          <h3 className="font-semibold text-sm text-left">
            {recordType} register ({filtered.length})
          </h3>
        </div>
        <div className="sheet-register overflow-x-auto max-h-[28rem]">
          <table className="sheet-register__table min-w-[48rem] w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Title</th>
                <th className="text-left">Location</th>
                <th className="text-left">Severity</th>
                <th className="text-left">Description</th>
                <th className="text-left">Status</th>
                <th className="text-left">Date</th>
                {canEdit && <th className="text-left">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="text-left font-medium">{r.title}</td>
                  <td className="text-left">{r.location || "—"}</td>
                  <td className="text-left">{r.severity || "—"}</td>
                  <td className="text-left max-w-xs truncate">{r.description || "—"}</td>
                  <td className="text-left">
                    <Badge tone={r.status === "Open" ? "warn" : "ok"}>{r.status}</Badge>
                  </td>
                  <td className="text-left whitespace-nowrap text-xs">
                    {new Date(r.occurredAt).toLocaleDateString()}
                  </td>
                  {canEdit && (
                    <td className="text-left space-x-1">
                      <Button type="button" variant="secondary" className="!py-1 !px-2 !text-xs" onClick={() => openEdit(r)}>
                        Edit
                      </Button>
                      {r.status === "Open" && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="!py-1 !px-2 !text-xs"
                          onClick={async () => {
                            await api(`/api/checklist/project/${projectId}/quality-site-records/${r.id}`, {
                              method: "PATCH",
                              token,
                              body: JSON.stringify({ status: "Closed" }),
                            });
                            await load();
                            await onChanged?.();
                          }}
                        >
                          Close
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="empty text-left">
                    No rows — add one above or import from seed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <RegisterEntryModal
        open={modalOpen}
        title={`Edit ${recordType.toLowerCase()}`}
        onClose={() => setModalOpen(false)}
        onSave={saveModal}
        saving={busy}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" />
          <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="Location" />
          <Select value={editForm.severity} onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })}>
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
            <option>Open</option>
            <option>Closed</option>
          </Select>
          <Input value={editForm.issuedTo} onChange={(e) => setEditForm({ ...editForm, issuedTo: e.target.value })} placeholder="Issued to" />
          <TextArea
            className="sm:col-span-2"
            rows={3}
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            placeholder="Description"
          />
          <TextArea
            className="sm:col-span-2"
            rows={2}
            value={editForm.correctiveAction}
            onChange={(e) => setEditForm({ ...editForm, correctiveAction: e.target.value })}
            placeholder="Corrective action"
          />
        </div>
      </RegisterEntryModal>
    </div>
  );
}
