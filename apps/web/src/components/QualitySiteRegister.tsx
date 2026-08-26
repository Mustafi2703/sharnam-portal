import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Input, Select, TextArea } from "./ui";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { RegisterFilterBar } from "./RegisterFilterBar";
import { ReferenceSheetToolbar } from "./ReferenceSheetToolbar";

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
  const [addOpen, setAddOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm(recordType));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({ status: "All", from: "", to: "", q: "" });

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

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (r.recordType !== recordType) return false;
      if (filters.status !== "All" && r.status !== filters.status) return false;
      const day = r.occurredAt.slice(0, 10);
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      if (filters.q) {
        const hay = `${r.title} ${r.description || ""} ${r.location || ""}`.toLowerCase();
        if (!hay.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, recordType, filters]);

  async function createRecord(e?: FormEvent) {
    e?.preventDefault();
    if (!form.description.trim()) {
      setMsg("Description is required");
      return;
    }
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
      setAddOpen(false);
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
    <div className="flex flex-col flex-1 min-h-0 gap-2 overflow-hidden">
      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2 shrink-0">{msg}</p>}

      <ReferenceSheetToolbar
        sheetLabel={`${recordType} register`}
        rowCount={filtered.length}
        canEdit={canEdit}
        onAddRow={canEdit ? () => setAddOpen(true) : undefined}
        message={msg || undefined}
      />

      <RegisterEntryModal
        open={addOpen && canEdit}
        title={`Log ${recordType.toLowerCase()}`}
        onClose={() => setAddOpen(false)}
        onSave={() => void createRecord()}
        saving={busy}
        saveLabel={`Save ${recordType.toLowerCase()}`}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Input placeholder="Issued to" value={form.issuedTo} onChange={(e) => setForm({ ...form, issuedTo: e.target.value })} />
          <TextArea
            className="sm:col-span-2"
            rows={3}
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
        </div>
      </RegisterEntryModal>

      <Card padding={false} className="sheet-register flex flex-col flex-1 min-h-0 overflow-hidden register-panel-fill">
        <div className="px-4 py-3 border-b border-line bg-sand/40 shrink-0">
          <h3 className="font-semibold text-sm text-left">
            {recordType} register ({filtered.length})
          </h3>
        </div>
        <div className="shrink-0">
        <RegisterFilterBar
          fields={[
            { key: "status", label: "Status", type: "select", options: ["Open", "Closed"] },
            { key: "from", label: "From", type: "date" },
            { key: "to", label: "To", type: "date" },
            { key: "q", label: "Search", type: "text", placeholder: "Title, location…" },
          ]}
          values={filters}
          onChange={(k, v) => setFilters({ ...filters, [k]: v })}
          onClear={() => setFilters({ status: "All", from: "", to: "", q: "" })}
        />
        </div>
        <div className="sheet-register__scroll register-sheet-viewport flex-1 min-h-0 overflow-auto">
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
                    No rows — use + Add row to log a {recordType.toLowerCase()}.
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
