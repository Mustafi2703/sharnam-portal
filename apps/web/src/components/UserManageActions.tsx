import { useState } from "react";
import { api } from "../api";
import { Button, Card, Input } from "./ui";
import type { UserAccountRow } from "./UserAccountEditModal";

type Props = {
  user: UserAccountRow;
  token: string | null;
  onEdit: () => void;
  onChanged: () => void | Promise<void>;
  /** When parent already has a primary Setup/Edit button, hide the duplicate. */
  showEdit?: boolean;
};

/** Visible Edit + Delete on user lists. Office/admin only — parent hides when not allowed. */
export function UserManageActions({ user, token, onEdit, onChanged, showEdit = true }: Props) {
  const [del, setDel] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <>
      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {showEdit ? (
          <Button type="button" variant="secondary" className="!text-xs !py-1.5 !px-3" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        <Button
          type="button"
          className="!text-xs !py-1.5 !px-3 !bg-danger !border-danger"
          onClick={() => {
            setDel(true);
            setConfirmEmail("");
            setErr("");
          }}
        >
          Delete
        </Button>
      </div>

      {del && token && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={() => setDel(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="space-y-3">
              <h3 className="font-display text-xl">Delete {user.fullName}?</h3>
              <p className="text-sm text-steel-muted">
                They lose portal login and project assignments. Live SPDC / Twinoxis accounts cannot be removed. Type{" "}
                <strong>{user.email}</strong> to confirm.
              </p>
              <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder={user.email} />
              {err ? <p className="text-sm text-danger">{err}</p> : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={confirmEmail.trim().toLowerCase() !== user.email.toLowerCase() || busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr("");
                    try {
                      await api(`/api/hrm/employees/${user.id}`, { method: "DELETE", token });
                      setDel(false);
                      await onChanged();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Delete failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete user
                </Button>
                <Button type="button" variant="secondary" onClick={() => setDel(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
