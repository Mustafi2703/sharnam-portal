import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input, PageHeader } from "../components/ui";

/** Client and vendor logins change their own password. Office admins are not required. */
export default function AccountPasswordPage() {
  const { token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (newPassword.length < 6) {
      setErr("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setErr("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setMsg("Password updated. Use it the next time you sign in.");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <PageHeader title="Password" subtitle="Change the password for this portal login." />
      <Card>
        <form className="space-y-3" onSubmit={(e) => void submit(e)}>
          <Input label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <Input label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {err ? <p className="text-sm text-danger break-words">{err}</p> : null}
          {msg ? <p className="text-sm text-brand break-words">{msg}</p> : null}
          <Button type="submit" disabled={busy || !currentPassword || !newPassword || !confirm}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
