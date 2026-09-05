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

  async function addToCatalog(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ packages: string[] }>("/api/projects/work-package-catalog", {
        method: "POST",
        token,
        body: JSON.stringify({ name: newName.trim() }),
      });
      setCatalog(r.packages);
      setNewName("");
      setMsg(`Added ${newName.trim()}.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProjectPackages() {
    if (!projectId) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/progress/${projectId}/modules`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ workPackages: projectPackages }),
      });
      setMsg("Saved.");
      onSaved?.(projectPackages);
      await loadCatalog();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(pkg: string) {
    setProjectPackages((prev) =>
      prev.includes(pkg) ? prev.filter((p) => p !== pkg) : [...prev, pkg].sort(),
    );
  }

  return (
    <Card className="!p-4 space-y-3">
      <h2 className="font-semibold text-base">{formatUiText("Work packages")}</h2>

      {msg && <p className="text-xs rounded px-2 py-1.5 bg-brand-soft text-brand-dark">{msg}</p>}

      <form className="flex flex-wrap gap-2 items-center" onSubmit={addToCatalog}>
        <Input
          className="min-w-[180px] flex-1"
          placeholder="New package name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={busy || !newName.trim()}>
          Add
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {catalog.map((p) => {
          const on = projectId ? projectPackages.includes(p) : false;
          return (
            <button
              key={p}
              type="button"
              disabled={!projectId}
              onClick={() => toggle(p)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                on ? "bg-brand text-white border-brand" : "bg-paper border-line text-steel-muted hover:border-brand"
              } ${!projectId ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {projectId && (
        <div className="flex flex-wrap gap-2 items-center border-t border-line pt-2">
          <Badge tone="brand">{projectPackages.length} selected</Badge>
          <Button type="button" disabled={busy} onClick={() => void saveProjectPackages()}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}
