import { useState } from "react";
import { api } from "../api";
import { Button, Card, Input } from "./ui";

export type ManageableVendor = {
  id: string;
  name: string;
};

type Props = {
  vendor: ManageableVendor;
  token: string | null;
  onEdit?: () => void;
  onChanged: () => void | Promise<void>;
  showEdit?: boolean;
  /** When set, also offer remove-from-this-project (does not delete the company). */
  projectId?: string;
};

/** Visible Edit + Delete on vendor / client / stakeholder directories. */
export function VendorManageActions({
  vendor,
  token,
  onEdit,
  onChanged,
  showEdit = true,
  projectId,
}: Props) {
  const [del, setDel] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <>
      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {showEdit && onEdit ? (
          <Button type="button" variant="secondary" className="!text-xs !py-1.5 !px-3" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {projectId ? (
          <Button
            type="button"
            variant="secondary"
            className="!text-xs !py-1.5 !px-3"
            disabled={busy}
            onClick={async () => {
              if (!token) return;
              setBusy(true);
              setErr("");
              try {
                await api(`/api/vendors/project/${projectId}/assign`, {
                  method: "DELETE",
                  token,
                  body: JSON.stringify({ vendorId: vendor.id }),
                });
                await onChanged();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Remove failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Remove
          </Button>
        ) : null}
        <Button
          type="button"
          className="!text-xs !py-1.5 !px-3 !bg-danger !border-danger"
          onClick={() => {
            setDel(true);
            setConfirmName("");
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
              <h3 className="font-display text-xl">Delete {vendor.name}?</h3>
              <p className="text-sm text-steel-muted">
                Removes this company from every directory and project. Bills and RFIs stay. Type{" "}
                <strong>{vendor.name}</strong> to confirm.
              </p>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={vendor.name} />
              {err ? <p className="text-sm text-danger">{err}</p> : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={confirmName.trim().toLowerCase() !== vendor.name.toLowerCase() || busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr("");
                    try {
                      await api(`/api/vendors/${vendor.id}`, {
                        method: "DELETE",
                        token,
                        body: JSON.stringify({ confirmName: confirmName.trim() }),
                      });
                      setDel(false);
                      await onChanged();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Delete failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete company
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
