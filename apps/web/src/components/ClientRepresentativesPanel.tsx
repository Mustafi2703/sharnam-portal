import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Button, Input } from "./ui";
import { formatUiText } from "../lib/formatUiText";

type ContactRow = {
  id: string;
  email: string;
  fullName?: string | null;
  role?: string | null;
  portalActive?: boolean;
};

const DEFAULT_PASSWORD = "Demo@1234";

/**
 * Step 2 for client directory — add multiple site representatives and activate /login/client for each.
 */
export function ClientRepresentativesPanel({
  vendorId,
  clientName,
  token,
  canEdit,
}: {
  vendorId: string;
  clientName: string;
  token: string | null;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", role: "" });
  const [msg, setMsg] = useState("");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [portalPassword, setPortalPassword] = useState(DEFAULT_PASSWORD);

  const load = useCallback(async () => {
    const list = await api<ContactRow[]>(`/api/vendors/${vendorId}/contacts`, { token });
    setRows(list);
  }, [vendorId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPerson(e: FormEvent) {
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
      setMsg("Person added — click Activate portal when their email is correct.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not add person");
    }
  }

  async function activatePortal(contact: ContactRow) {
    if (!canEdit) return;
    setActivatingId(contact.id);
    setMsg("");
    try {
      const r = await api<{
        login?: { created?: boolean; tempPassword?: string; email?: string };
        loginPath?: string;
      }>(`/api/vendors/${vendorId}/contacts/${contact.id}/activate-portal`, {
        method: "POST",
        token,
        body: JSON.stringify({ password: portalPassword.trim() || DEFAULT_PASSWORD }),
      });
      const pwd = r.login?.tempPassword || portalPassword || DEFAULT_PASSWORD;
      setMsg(
        `Portal ready for ${contact.fullName || contact.email} — sign in at /login/client with ${r.login?.email || contact.email} · Password: ${pwd}`,
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not activate portal");
    } finally {
      setActivatingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this person from the client list?")) return;
    await api(`/api/vendors/${vendorId}/contacts/${id}`, { method: "DELETE", token });
    await load();
  }

  return (
    <div className="mt-5 pt-5 border-t-2 border-brand/20 space-y-4">
      <div className="rounded-xl bg-brand-soft/30 border border-brand/15 p-4 space-y-2">
        <p className="text-xs font-mono uppercase tracking-wide text-brand font-semibold">
          {formatUiText("Step 2 · Client representatives")}
        </p>
        <p className="text-sm text-ink leading-relaxed">
          {formatUiText("Add everyone from")} <strong data-preserve-case>{clientName}</strong>{" "}
          {formatUiText("who needs the client portal. Each person gets their own login — you activate portal separately for each email.")}
        </p>
        <ol className="text-xs text-steel-muted list-decimal list-inside space-y-1">
          <li>Add name + email (+ role optional) — you can add more people anytime while editing this client</li>
          <li>Click <strong className="text-ink">Activate portal</strong> for that person</li>
          <li>Share <code className="text-[11px]">/login/client</code> and the password below</li>
        </ol>
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-line bg-paper p-3 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm" data-preserve-case>
                  {r.fullName || formatUiText("Unnamed contact")}
                </div>
                <div className="text-xs text-steel-muted">
                  <span data-preserve-case>{r.email}</span>
                  {r.role ? (
                    <>
                      {" · "}
                      <span data-preserve-case>{r.role}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <Badge tone={r.portalActive ? "ok" : "neutral"}>{r.portalActive ? "Portal active" : "No portal yet"}</Badge>
            </div>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                {!r.portalActive ? (
                  <Button
                    type="button"
                    className="!text-xs"
                    disabled={activatingId === r.id}
                    onClick={() => void activatePortal(r)}
                  >
                    {activatingId === r.id ? "Activating…" : "Activate portal"}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="!text-xs" onClick={() => void activatePortal(r)}>
                    Reset password
                  </Button>
                )}
                <Button type="button" variant="ghost" className="!text-xs text-danger" onClick={() => void remove(r.id)}>
                  Remove
                </Button>
              </div>
            ) : null}
          </li>
        ))}
        {!rows.length ? (
          <li className="text-sm text-steel-muted border border-dashed border-line rounded-xl p-4 text-center">
            No representatives yet — use the form below to add the first person.
          </li>
        ) : null}
      </ul>

      {canEdit ? (
        <form className="rounded-xl border border-line bg-sand/40 p-4 space-y-3" onSubmit={addPerson}>
          <p className="text-sm font-semibold">Add another person</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input required type="email" placeholder="Email (their login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input className="sm:col-span-2" placeholder="Role (e.g. Project manager, Director)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs space-y-1 flex-1 min-w-[200px]">
              <span className="text-steel-muted">Portal password for new activations</span>
              <Input type="password" value={portalPassword} onChange={(e) => setPortalPassword(e.target.value)} autoComplete="new-password" />
            </label>
            <Button type="submit" variant="secondary">
              + Add person
            </Button>
          </div>
        </form>
      ) : null}

      {msg ? <p className="text-xs text-brand font-medium leading-relaxed">{msg}</p> : null}
    </div>
  );
}
