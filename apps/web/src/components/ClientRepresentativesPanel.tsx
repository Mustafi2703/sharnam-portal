import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Button, Input } from "./ui";

type ContactRow = { id: string; email: string; fullName?: string | null; role?: string | null };

/** Additional site representatives for a client company (CRM directory). */
export function ClientRepresentativesPanel({
  vendorId,
  token,
  canEdit,
}: {
  vendorId: string;
  token: string | null;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", role: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const list = await api<ContactRow[]>(`/api/vendors/${vendorId}/contacts`, { token });
    setRows(list);
  }, [vendorId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMsg("");
    try {
      await api(`/api/vendors/${vendorId}/contacts`, {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setForm({ fullName: "", email: "", role: "" });
      setMsg("Representative added.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not add");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this representative?")) return;
    await api(`/api/vendors/${vendorId}/contacts/${id}`, { method: "DELETE", token });
    await load();
  }

  return (
    <div className="mt-4 pt-4 border-t border-line space-y-3">
      <div>
        <h4 className="font-semibold text-sm">Site client representatives</h4>
        <p className="text-[11px] text-steel-muted mt-0.5">
          Multiple contacts per client — used on project cards and communication matrix. Primary login stays on the main email above.
        </p>
      </div>
      <ul className="space-y-2 text-xs">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 bg-sand/30">
            <span>
              <strong className="text-ink">{r.fullName || r.email}</strong>
              {r.role ? ` · ${r.role}` : ""}
              <span className="text-steel-muted block">{r.email}</span>
            </span>
            {canEdit ? (
              <button type="button" className="text-danger text-[11px] font-semibold" onClick={() => void remove(r.id)}>
                Remove
              </button>
            ) : null}
          </li>
        ))}
        {!rows.length ? <li className="text-steel-muted">No extra representatives yet.</li> : null}
      </ul>
      {canEdit ? (
        <form className="grid sm:grid-cols-3 gap-2" onSubmit={add}>
          <Input placeholder="Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input type="email" required placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Role (e.g. Project lead)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary" className="!text-xs">
              + Add representative
            </Button>
          </div>
        </form>
      ) : null}
      {msg ? <p className="text-[11px] text-brand">{msg}</p> : null}
    </div>
  );
}
