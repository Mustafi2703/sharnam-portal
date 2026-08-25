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
    notificationWhatsApp: "",
    whatsAppEnabled: true,
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
  const [waForm, setWaForm] = useState({ message: "", toNumbers: "" });
  const [waMsg, setWaMsg] = useState("");
  const [waStatus, setWaStatus] = useState<{ ready: boolean; provider: string | null } | null>(null);
  const [waLinks, setWaLinks] = useState<{ mobile: string; url: string }[]>([]);
  const canEdit = ["admin", "office", "employee"].includes(user?.role || "");
  const canSend = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");

  const load = async () => {
    const [p, e, wa] = await Promise.all([
      api<any>(`/api/projects/${id}`, { token }),
      api<any[]>(`/api/projects/${id}/emails`, { token }).catch(() => []),
      api<any>(`/api/projects/${id}/whatsapp/status`, { token }).catch(() => null),
    ]);
    setForm({
      notificationEmails: p.notificationEmails || "",
      notificationWhatsApp: p.notificationWhatsApp || "",
      whatsAppEnabled: p.whatsAppEnabled !== false,
      emailFromName: p.emailFromName || "शरणम् Portal",
      emailEnabled: p.emailEnabled !== false,
      notifyOnDrawingPublish: p.notifyOnDrawingPublish !== false,
      notifyOnChecklistSubmit: p.notifyOnChecklistSubmit !== false,
      outlookMailbox: p.outlookMailbox || "",
      outlookConnected: !!p.outlookConnected,
    });
    setOutbox(e);
    if (wa) setWaStatus({ ready: !!wa.ready, provider: wa.provider || null });
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
        eyebrow="Comms"
        title="Email & WhatsApp"
        subtitle="Outlook mailbox, email distribution, and WhatsApp numbers for meeting invites, RFI, NCR, and CAR updates."
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

      <Card className="border-emerald-600/20 bg-emerald-50/40">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold">WhatsApp updates</h3>
            <p className="text-sm text-steel-muted mt-1 max-w-xl leading-relaxed">
              Portal sends WhatsApp when meetings are scheduled, RFIs are raised/closed, and NCR/CAR records change.
              Default SPDC numbers: Nirav (8160757201), Operations (9106945294).
            </p>
          </div>
          <Badge tone={waStatus?.ready ? "ok" : "neutral"}>
            {waStatus?.ready ? `API · ${waStatus.provider}` : "Manual / wa.me"}
          </Badge>
        </div>
        <form className="space-y-3" onSubmit={save}>
          <label className="text-sm block">
            WhatsApp numbers (comma-separated, 10-digit Indian mobile)
            <Input
              className="mt-1"
              value={form.notificationWhatsApp}
              onChange={(e) => setForm({ ...form, notificationWhatsApp: e.target.value })}
              placeholder="8160757201,9106945294"
              disabled={!canEdit}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.whatsAppEnabled}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, whatsAppEnabled: e.target.checked })}
            />
            WhatsApp enabled for this project
          </label>
          {canEdit && <Button type="submit">Save WhatsApp settings</Button>}
        </form>
        {canSend && (
          <form
            className="mt-4 pt-4 border-t border-line space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setWaMsg("");
              setWaLinks([]);
              try {
                const result = await api<any>(`/api/projects/${id}/whatsapp/test`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    message: waForm.message || undefined,
                    toNumbers: waForm.toNumbers || undefined,
                  }),
                });
                if (result.mode === "manual" && Array.isArray(result.links)) {
                  setWaLinks(result.links);
                  setWaMsg("API not configured — tap links below to send via WhatsApp.");
                } else {
                  setWaMsg(`Sent to ${result.sent}/${result.total} number(s).`);
                }
                await load();
              } catch (err) {
                setWaMsg(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <Input
              placeholder="To override (optional)"
              value={waForm.toNumbers}
              onChange={(e) => setWaForm({ ...waForm, toNumbers: e.target.value })}
            />
            <TextArea
              rows={3}
              placeholder="Test message (optional)"
              value={waForm.message}
              onChange={(e) => setWaForm({ ...waForm, message: e.target.value })}
            />
            <Button type="submit" variant="secondary">
              Send test WhatsApp
            </Button>
            {waMsg && <p className="text-sm text-steel-muted">{waMsg}</p>}
            {waLinks.length > 0 && (
              <ul className="text-sm space-y-1">
                {waLinks.map((link) => (
                  <li key={link.mobile}>
                    <a className="text-brand underline" href={link.url} target="_blank" rel="noreferrer">
                      Open WhatsApp → {link.mobile}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </form>
        )}
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
