/**
 * Compact Safety SI / Observation register — same store as SafetyPage sheets.
 * Used from Safety checklist master so managers can add rows without leaving the master.
 */
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Badge, Button, Input, Select, TextArea } from "./ui";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { RegisterFilterBar } from "./RegisterFilterBar";
import { ReferenceSheetToolbar } from "./ReferenceSheetToolbar";
import { StatusNote } from "./StatusNote";

type Row = {
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

type Props = {
  projectId: string;
  token?: string | null;
  recordType: "Site Instruction" | "Observation";
  canEdit: boolean;
  onChanged?: () => void | Promise<void>;
};

const SEVERITIES = ["Low", "Medium", "High", "Critical"];

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

export function SafetySiteRegister({ projectId, token, recordType, canEdit, onChanged }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState(emptyForm(recordType));
  const [addOpen, setAddOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({ status: "All", from: "", to: "", q: "" });

  const load = async () => {
    const data = await api<{ records: Row[] }>(`/api/safety/project/${projectId}`, { token });
    setRows((data.records || []).filter((r) => r.recordType === recordType));
  };

  useEffect(() => {
    void load();
  }, [projectId, token, recordType]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filters.status !== "All" && r.status !== filters.status) return false;
      const day = String(r.occurredAt || "").slice(0, 10);
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;
      if (filters.q) {
        const hay = `${r.title} ${r.description || ""} ${r.location || ""}`.toLowerCase();
        if (!hay.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, filters]);

  async function createRecord(e: FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) {
      setMsg("Description is required.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const title = form.title.trim() || `${recordType} — ${form.location || "Site"}`;
      await api(`/api/safety/project/${projectId}`, {
        method: "POST",
        token,
        body: JSON.stringify({ ...form, title, recordType, source: "ChecklistMaster" }),
      });
      setForm(emptyForm(recordType));
      setAddOpen(false);
      setMsg(`${recordType} logged on the Safety register.`);
      await load();
      await onChanged?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function closeRow(id: string) {
    setBusy(true);
    try {
      await api(`/api/safety/${id}`, { method: "PATCH", token, body: JSON.stringify({ status: "Closed" }) });
      await load();
      await onChanged?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not close");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden space-y-2">
      <ReferenceSheetToolbar
        sheetLabel={`Safety · ${recordType}`}
        rowCount={filtered.length}
        canEdit={canEdit}
        busy={busy}
        onAddRow={canEdit ? () => setAddOpen(true) : undefined}
        addRowLabel={`+ Add ${recordType}`}
      />
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
      <StatusNote msg={msg} />
      <div className="flex-1 min-h-0 overflow-auto border border-line rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-sand/80 text-[10px] uppercase tracking-wide text-steel-muted">
            <tr>
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Location</th>
              <th className="text-left px-3 py-2">Severity</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Reported</th>
              <th className="text-right px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-3 py-2 font-medium">{r.title}</td>
                <td className="px-3 py-2 text-steel-muted">{r.location || "—"}</td>
                <td className="px-3 py-2">{r.severity || "—"}</td>
                <td className="px-3 py-2">
                  <Badge tone={r.status === "Open" ? "warn" : "ok"}>{r.status}</Badge>
                </td>
                <td className="px-3 py-2 text-xs text-steel-muted">
                  {r.reportedBy?.fullName || "—"} · {String(r.occurredAt).slice(0, 10)}
                </td>
                <td className="px-3 py-2 text-right">
                  {canEdit && r.status === "Open" ? (
                    <Button type="button" variant="ghost" className="!text-xs" disabled={busy} onClick={() => void closeRow(r.id)}>
                      Close
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-steel-muted text-sm">
                  No {recordType.toLowerCase()} rows yet — add from here or the Safety sheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RegisterEntryModal
        open={addOpen && canEdit}
        title={`Log ${recordType}`}
        onClose={() => setAddOpen(false)}
        onSave={() => (document.getElementById("safety-site-reg-form") as HTMLFormElement | null)?.requestSubmit()}
        saving={busy}
        size="lg"
        saveLabel="Save"
      >
        <form id="safety-site-reg-form" className="grid sm:grid-cols-2 gap-3" onSubmit={createRecord}>
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={`${recordType} — area`} />
          <Input label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Select label="Severity" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Input label="Issued to" value={form.issuedTo} onChange={(e) => setForm({ ...form, issuedTo: e.target.value })} />
          <div className="sm:col-span-2">
            <TextArea
              label="Description *"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <TextArea
              label="Corrective / action"
              rows={2}
              value={form.correctiveAction}
              onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
            />
          </div>
        </form>
      </RegisterEntryModal>
    </div>
  );
}
