import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Button, Card, Input } from "./ui";

export type ManageableProject = {
  id: string;
  code: string;
  name: string;
  clientName?: string | null;
  location?: string | null;
  designConsultant?: string | null;
  contractorName?: string | null;
  pmcName?: string | null;
};

type Props = {
  project: ManageableProject;
  token: string | null;
  onChanged: () => void | Promise<void>;
  showEdit?: boolean;
  onEdit?: () => void;
};

/** Office/admin Edit + Delete on any project list. */
export function ProjectManageActions({ project, token, onChanged, showEdit = true, onEdit }: Props) {
  const navigate = useNavigate();
  const [edit, setEdit] = useState<ManageableProject | null>(null);
  const [del, setDel] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <>
      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {showEdit ? (
          <Button
            type="button"
            variant="secondary"
            className="!text-xs !py-1.5 !px-3"
            onClick={() => (onEdit ? onEdit() : setEdit({ ...project }))}
          >
            Edit
          </Button>
        ) : null}
        <Button
          type="button"
          className="!text-xs !py-1.5 !px-3 !bg-danger !border-danger"
          onClick={() => {
            setDel(true);
            setCode("");
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
            <h3 className="font-display text-xl">Edit {edit.code}</h3>
            <p className="text-xs text-amber-800 font-semibold">Only office and admin can change a project card.</p>
            <form
              className="grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setErr("");
                try {
                  await api(`/api/projects/${edit.id}/settings`, {
                    method: "PATCH",
                    token,
                    body: JSON.stringify(edit),
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
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Project name" />
              <Input value={edit.clientName || ""} onChange={(e) => setEdit({ ...edit, clientName: e.target.value })} placeholder="Client" />
              <Input value={edit.location || ""} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder="Location" />
              <Input
                value={edit.designConsultant || ""}
                onChange={(e) => setEdit({ ...edit, designConsultant: e.target.value })}
                placeholder="Design consultant"
              />
              <Input value={edit.pmcName || ""} onChange={(e) => setEdit({ ...edit, pmcName: e.target.value })} placeholder="PMC / SPDC" />
              <Input
                value={edit.contractorName || ""}
                onChange={(e) => setEdit({ ...edit, contractorName: e.target.value })}
                placeholder="Contractor"
              />
              {err ? <p className="text-sm text-danger">{err}</p> : null}
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={busy}>
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
            <h3 className="font-display text-xl">Delete {project.code}?</h3>
            <p className="text-sm text-steel-muted">
              Only office and admin can delete. Type <strong>{project.code}</strong> to confirm. QAP, cube, drawings, and fills go with it.
            </p>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={project.code} />
            {err ? <p className="text-sm text-danger">{err}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={code.trim().toUpperCase() !== project.code.toUpperCase() || busy}
                onClick={async () => {
                  setBusy(true);
                  setErr("");
                  try {
                    await api(`/api/projects/${project.id}`, {
                      method: "DELETE",
                      token,
                      body: JSON.stringify({ confirmCode: code.trim() }),
                    });
                    setDel(false);
                    await onChanged();
                    if (
                      window.location.pathname.includes(`/projects/${project.id}`) ||
                      window.location.search.includes(project.id)
                    ) {
                      navigate("/projects");
                    }
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Delete failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete project
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
