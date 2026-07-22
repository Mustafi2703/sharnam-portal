import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, TextArea } from "../components/ui";

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
    outlookMailbox: "",
    outlookConnected: false,
  });
  const [outbox, setOutbox] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [outlookMsg, setOutlookMsg] = useState("");
  const [sendForm, setSendForm] = useState({ subject: "", body: "", toEmails: "" });
  const [sendMsg, setSendMsg] = useState("");
  const canEdit = ["admin", "office", "employee"].includes(user?.role || "");
  const canSend = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");

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
      outlookMailbox: p.outlookMailbox || "",
      outlookConnected: !!p.outlookConnected,
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
        eyebrow="Comms · Email"
        title="Email / Outlook"
        subtitle="Connect an Outlook mailbox for this project, set notification recipients, and send from one place. Outbox logs every message."
      />

      <Card className="border-brand/30 bg-brand-soft/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Microsoft Outlook</h3>
            <p className="text-sm text-steel-muted mt-1 max-w-xl leading-relaxed">
              Link the project mailbox (e.g. project@yourcompany.com). When Microsoft Graph credentials are set on the
              server, mail sends through Outlook; until then messages are queued in the outbox.
            </p>
            {form.outlookConnected && (
              <p className="text-sm text-ok mt-2 font-medium">
                Connected · {form.outlookMailbox || "mailbox saved"}
              </p>
            )}
          </div>
          <Badge tone={form.outlookConnected ? "ok" : "neutral"}>
            {form.outlookConnected ? "Connected" : "Not connected"}
          </Badge>
        </div>
        {canEdit && (
          <form
            className="mt-4 flex flex-wrap gap-2 items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              setOutlookMsg("");
              try {
                await api(`/api/projects/${id}/settings`, {
                  method: "PATCH",
                  token,
                  body: JSON.stringify({
                    outlookMailbox: form.outlookMailbox,
                    outlookConnected: true,
                  }),
                });
                setOutlookMsg("Outlook mailbox linked for this project.");
                await load();
              } catch (err) {
                setOutlookMsg(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <label className="text-sm flex-1 min-w-[220px]">
              Outlook mailbox
              <Input
                className="mt-1"
                type="email"
                required
                placeholder="pm@client.com"
                value={form.outlookMailbox}
                onChange={(e) => setForm({ ...form, outlookMailbox: e.target.value })}
              />
            </label>
            <Button type="submit">Connect Outlook</Button>
            {form.outlookConnected && (
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await api(`/api/projects/${id}/settings`, {
                    method: "PATCH",
                    token,
                    body: JSON.stringify({ outlookConnected: false }),
                  });
                  await load();
                }}
              >
                Disconnect
              </Button>
            )}
            {outlookMsg && <p className="w-full text-sm text-steel-muted">{outlookMsg}</p>}
          </form>
        )}
      </Card>

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

      {canSend && (
        <Card>
          <h3 className="font-semibold mb-3">Send email</h3>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSendMsg("");
              try {
                await api(`/api/projects/${id}/emails/send`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    subject: sendForm.subject,
                    body: sendForm.body,
                    toEmails: sendForm.toEmails || undefined,
                    context: "manual",
                  }),
                });
                setSendMsg("Sent to outbox.");
                setSendForm({ subject: "", body: "", toEmails: "" });
                await load();
              } catch (err) {
                setSendMsg(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <Input
              placeholder="To (optional override, comma-separated)"
              value={sendForm.toEmails}
              onChange={(e) => setSendForm({ ...sendForm, toEmails: e.target.value })}
            />
            <Input
              placeholder="Subject"
              value={sendForm.subject}
              onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
              required
            />
            <TextArea
              rows={4}
              placeholder="Message"
              value={sendForm.body}
              onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
              required
            />
            <Button type="submit">Send email</Button>
            {sendMsg && <p className="text-sm text-steel-muted">{sendMsg}</p>}
          </form>
        </Card>
      )}

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
