import { useState } from "react";
import { api } from "../api";
import { Button, Card, Input, Select } from "./ui";

export type ManageableBid = {
  id: string;
  title: string;
  status: string;
  revisionLabel: string;
  notes?: string | null;
  dueDate?: string | null;
  projectId?: string | null;
  leadId?: string | null;
  awardedVendorId?: string | null;
};

type Props = {
  bid: ManageableBid;
  token: string | null;
  onChanged: () => void | Promise<void>;
  onDeleted?: () => void;
  projects?: { id: string; code: string; name: string }[];
  leads?: { id: string; title: string }[];
};

function dateInputValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Office/admin Edit + Delete on a comparative bid package. */
export function BidManageActions({ bid, token, onChanged, onDeleted, projects = [], leads = [] }: Props) {
  const [edit, setEdit] = useState<ManageableBid | null>(null);
  const [del, setDel] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <>
      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="secondary"
          className="!text-xs !py-1.5 !px-3"
          onClick={() => {
            setEdit({ ...bid });
            setErr("");
          }}
        >
          Edit
        </Button>
        <Button
          type="button"
          className="!text-xs !py-1.5 !px-3 !bg-danger !border-danger"
          onClick={() => {
            setDel(true);
            setConfirmTitle("");
            setErr("");
          }}
        >
          Delete
        </Button>
      </div>

      {edit && token && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <Card className="space-y-3">
              <h3 className="font-display text-xl">Edit bid package</h3>
              <p className="text-xs text-amber-800 font-semibold">
                Title, due date, notes, and project link. Bidders and disciplines stay on Add bidder / Add discipline.
              </p>
              <form
                className="grid gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setErr("");
                  try {
                    await api(`/api/crm/bid-packages/${edit.id}`, {
                      method: "PATCH",
                      token,
                      body: JSON.stringify({
                        title: edit.title,
                        revisionLabel: edit.revisionLabel,
                        notes: edit.notes || null,
                        dueDate: edit.dueDate || null,
                        projectId: edit.projectId || null,
                        leadId: edit.leadId || null,
                      }),
                    });
                    setEdit(null);
                    await onChanged();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Save failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Input
                  required
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  placeholder="Package title"
                />
                <Input
                  value={edit.revisionLabel}
                  onChange={(e) => setEdit({ ...edit, revisionLabel: e.target.value })}
                  placeholder="Revision (R2)"
                />
                <Input
                  type="date"
                  value={dateInputValue(edit.dueDate)}
                  onChange={(e) => setEdit({ ...edit, dueDate: e.target.value || null })}
                />
                <Input
                  value={edit.notes || ""}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                  placeholder="Notes"
                />
                {projects.length > 0 && (
                  <Select
                    value={edit.projectId || ""}
                    onChange={(e) => setEdit({ ...edit, projectId: e.target.value || null })}
                  >
                    <option value="">Project (optional)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} · {p.name}
                      </option>
                    ))}
                  </Select>
                )}
                {leads.length > 0 && (
                  <Select value={edit.leadId || ""} onChange={(e) => setEdit({ ...edit, leadId: e.target.value || null })}>
                    <option value="">Lead (optional)</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </Select>
                )}
                {err ? <p className="text-sm text-danger">{err}</p> : null}
                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={busy || !edit.title.trim()}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEdit(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {del && token && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={() => setDel(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="space-y-3">
              <h3 className="font-display text-xl">Delete bid package?</h3>
              <p className="text-sm text-steel-muted">
                Type <strong>{bid.title}</strong> to confirm. Vendor BOQs and comparative sheets go with it.
                {bid.status === "Awarded"
                  ? " Awarded vendor stays on the project desk — this only removes the bid package."
                  : ""}
              </p>
              <Input value={confirmTitle} onChange={(e) => setConfirmTitle(e.target.value)} placeholder={bid.title} />
              {err ? <p className="text-sm text-danger">{err}</p> : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={confirmTitle.trim().toLowerCase() !== bid.title.trim().toLowerCase() || busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr("");
                    try {
                      await api(`/api/crm/bid-packages/${bid.id}`, {
                        method: "DELETE",
                        token,
                        body: JSON.stringify({ confirmTitle: confirmTitle.trim() }),
                      });
                      setDel(false);
                      await onChanged();
                      onDeleted?.();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Delete failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete bid
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
