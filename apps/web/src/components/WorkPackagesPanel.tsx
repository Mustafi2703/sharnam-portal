import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Input } from "./ui";
import { formatUiText } from "../lib/formatUiText";

type Props = {
  token?: string | null;
  projectId?: string;
  onSaved?: (packages: string[]) => void;
};

export function WorkPackagesPanel({ token, projectId, onSaved }: Props) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [projectPackages, setProjectPackages] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const loadCatalog = () =>
    api<{ packages: string[] }>("/api/projects/work-package-catalog", { token })
      .then((r) => setCatalog(r.packages || []))
      .catch(() => setCatalog(["Civil", "PEB"]));

  useEffect(() => {
    void loadCatalog();
  }, [token]);

  useEffect(() => {
    if (!projectId) {
      setProjectPackages([]);
      return;
    }
    api<{ workPackages?: string }>(`/api/projects/${projectId}`, { token })
      .then((p) => {
        try {
          const parsed = p.workPackages ? JSON.parse(p.workPackages) : [];
          setProjectPackages(Array.isArray(parsed) ? parsed : ["Civil", "PEB"]);
        } catch {
          setProjectPackages(["Civil", "PEB"]);
        }
      })
      .catch(() => setProjectPackages(["Civil", "PEB"]));
  }, [projectId, token]);

  async function persist(next: string[]) {
    if (!projectId) {
      setProjectPackages(next);
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/progress/${projectId}/modules`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ workPackages: next }),
      });
      setProjectPackages(next);
      setMsg("Packages saved on this project.");
      onSaved?.(next);
      await loadCatalog();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addPackage(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ packages: string[] }>("/api/projects/work-package-catalog", {
        method: "POST",
        token,
        body: JSON.stringify({ name }),
      });
      setCatalog(r.packages);
      setNewName("");
      const next = projectPackages.includes(name) ? projectPackages : [...projectPackages, name].sort();
      if (projectId) await persist(next);
      else {
        setProjectPackages(next);
        setMsg(`Added ${name} to the catalogue.`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFromCatalog(name: string) {
    if (!window.confirm(`Remove "${name}" from the package catalogue? Projects that still use it keep their copy until you remove it there.`)) {
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ packages: string[] }>("/api/projects/work-package-catalog", {
        method: "DELETE",
        token,
        body: JSON.stringify({ name }),
      });
      setCatalog(r.packages);
      setMsg(`Removed ${name} from the catalogue.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function addToProject(pkg: string) {
    if (projectPackages.includes(pkg)) return;
    void persist([...projectPackages, pkg].sort());
  }

  function removeFromProject(pkg: string) {
    void persist(projectPackages.filter((p) => p !== pkg));
  }

  return (
    <Card className="!p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-base">{formatUiText("Package manager")}</h2>
        <p className="text-xs text-steel-muted mt-0.5">
          Add or delete work packages here, then pin them on vendors, consultants, and the client below.
        </p>
      </div>

      {msg && <p className="text-xs rounded px-2 py-1.5 bg-brand-soft text-brand-dark">{msg}</p>}

      <form className="flex flex-wrap gap-2 items-center" onSubmit={addPackage}>
        <Input
          className="min-w-[180px] flex-1"
          placeholder="New package (Civil, MEP, PEB…)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" disabled={busy || !newName.trim()}>
          Add package
        </Button>
      </form>

      {projectId && (
        <div className="border border-line rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-sand/50 text-xs font-semibold uppercase tracking-wide text-steel-muted">
            On this project · {projectPackages.length}
          </div>
          <ul className="divide-y divide-line">
            {projectPackages.map((p) => (
              <li key={p} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{p}</span>
                <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => removeFromProject(p)}>
                  Delete
                </Button>
              </li>
            ))}
            {!projectPackages.length && (
              <li className="px-3 py-6 text-sm text-steel-muted text-center">No packages yet — add one above or pick from the catalogue.</li>
            )}
          </ul>
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-steel-muted mb-2">Catalogue</p>
        <div className="flex flex-wrap gap-2">
          {catalog.map((p) => {
            const on = projectId ? projectPackages.includes(p) : false;
            return (
              <span key={p} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper pl-3 pr-1 py-0.5">
                <button
                  type="button"
                  disabled={!projectId || busy || on}
                  onClick={() => addToProject(p)}
                  className={`text-xs font-semibold ${on ? "text-brand" : "text-ink hover:text-brand"}`}
                >
                  {p}
                  {on ? " · on project" : " · add"}
                </button>
                <button
                  type="button"
                  className="text-[10px] text-steel-muted hover:text-danger px-1"
                  disabled={busy}
                  onClick={() => void deleteFromCatalog(p)}
                  title="Remove from catalogue"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {!projectId && <Badge tone="neutral">Open a project to pin packages on that job</Badge>}
    </Card>
  );
}
