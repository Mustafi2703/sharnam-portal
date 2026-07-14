import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input, PageHeader } from "../components/ui";

/** Per-project email distribution (used on drawing publish & checklist submit) */
export default function ProjectEmailSettingsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [form, setForm] = useState({
    notificationEmails: "",
    emailFromName: "शरणम् Portal",
    emailEnabled: true,
    notifyOnDrawingPublish: true,
    notifyOnChecklistSubmit: true,
  });
  const [outbox, setOutbox] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const canEdit = ["admin", "office", "employee"].includes(user?.role || "");

  const load = async () => {
    const [p, e] = await Promise.all([
      api<any>(`/api/projects/${id}`, { token }),
      api<any[]>(`/api/projects/${id}/emails`, { token }).catch(() => []),
    ]);
    setForm({
      notificationEmails: p.notificationEmails || "",
      emailFromName: p.emailFromName || "शरणम् Portal",
      emailEnabled: p.emailEnabled !== false,
      notifyOnDrawingPublish: p.notifyOnDrawingPublish !== false,
      notifyOnChecklistSubmit: p.notifyOnChecklistSubmit !== false,
    });
    setOutbox(e);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api(`/api/projects/${id}/settings`, {
        method: "PATCH",
        token,
        body: JSON.stringify(form),
      });
      setMsg("Saved.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="Project"
        title="Email settings"
        subtitle="Configure who receives notices when drawings are published and checklists are submitted. Delivery is logged in the outbox (SMTP/Graph can replace the mock later)."
      />

      <Card>
        <form className="space-y-3" onSubmit={save}>
          <label className="text-sm block">
            Notification emails (comma-separated)
            <Input
              className="mt-1"
              value={form.notificationEmails}
              onChange={(e) => setForm({ ...form, notificationEmails: e.target.value })}
              placeholder="office@client.com, pm@sharnam.in"
              disabled={!canEdit}
            />
          </label>
          <label className="text-sm block">
            From name
            <Input
              className="mt-1"
              value={form.emailFromName}
              onChange={(e) => setForm({ ...form, emailFromName: e.target.value })}
              disabled={!canEdit}
            />
          </label>
          {(
            [
              ["emailEnabled", "Email enabled for this project"],
              ["notifyOnDrawingPublish", "Notify on drawing publish"],
              ["notifyOnChecklistSubmit", "Notify on checklist submit"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form[key]}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          {canEdit && <Button type="submit">Save settings</Button>}
          {msg && <p className="text-sm text-steel-muted">{msg}</p>}
        </form>
      </Card>

      <Card padding={false}>
        <div className="px-4 py-3 border-b font-semibold text-sm">Recent outbox</div>
        <ul className="divide-y divide-line max-h-80 overflow-y-auto text-sm">
          {outbox.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <div className="font-medium">{row.subject}</div>
              <div className="text-[11px] text-steel-muted font-mono mt-1">
                {row.status} · {row.toEmails} · {new Date(row.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
          {!outbox.length && <li className="px-4 py-6 text-steel-muted text-sm">No emails yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
