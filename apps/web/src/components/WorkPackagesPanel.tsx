import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Button, Card, Input } from "./ui";
import { formatUiText } from "../lib/formatUiText";
import { parseWorkPackagesField, sanitizeProjectWorkPackages } from "../lib/workPackages";

const FALLBACK_PACKAGES = ["Civil", "PEB", "MEP", "Fire Fighting", "Electrical", "Plumbing", "HVAC", "Landscape"];

/** R2 bid sheet labels — not shown in work-package catalogue (bid desk uses these separately). */
const HIDDEN_BID_LABELS = new Set([
  "civil & structural (ccv)",
  "electrical lab",
  "admin building",
  "security",
  "cooling tower",
  "weigh bridge",
  "u.g tank + pump room",
  "entrance gate",
]);

function catalogNames(names: string[]) {
  return sanitizeProjectWorkPackages(names).filter((p) => !HIDDEN_BID_LABELS.has(p.trim().toLowerCase()));
}

type Props = {
  token?: string | null;
  projectId?: string;
  /** Controlled selection (project setup draft). */
  selected?: string[];
  onChange?: (packages: string[]) => void;
  onSaved?: (packages: string[]) => void;
  /** pick = tick packages on the job; manage = catalogue editor (Master). */
  mode?: "pick" | "manage";
};

export function WorkPackagesPanel({ token, projectId, selected, onChange, onSaved, mode = "manage" }: Props) {
  const [catalog, setCatalog] = useState<string[]>([...FALLBACK_PACKAGES]);
  const [internal, setInternal] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const projectPackages = selected ?? internal;
  const pick = mode === "pick";

  const setPackages = (next: string[]) => {
    const uniq = [...new Set(next.map((p) => p.trim()).filter(Boolean))].sort();
    if (selected === undefined) setInternal(uniq);
    onChange?.(uniq);
  };

  const loadCatalog = () =>
    api<{ packages: string[] }>("/api/projects/work-package-catalog", { token })
      .then((r) => {
        const fromApi = Array.isArray(r.packages) ? r.packages.map(String).filter(Boolean) : [];
        setCatalog(catalogNames(fromApi.length ? fromApi : [...FALLBACK_PACKAGES]));
      })
      .catch(() => setCatalog([...FALLBACK_PACKAGES]));

  useEffect(() => {
    void loadCatalog();
  }, [token]);

  useEffect(() => {
    if (selected) return;
    if (!projectId) {
      setInternal([]);
      return;
    }
    api<{ workPackages?: string | string[] }>(`/api/projects/${projectId}`, { token })
      .then((p) => {
        setInternal(sanitizeProjectWorkPackages(parseWorkPackagesField(p.workPackages)));
      })
      .catch(() => setInternal([]));
  }, [projectId, token, selected]);

  async function persist(next: string[]) {
    const cleaned = sanitizeProjectWorkPackages(next);
    setPackages(cleaned);
    if (!projectId) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/projects/${projectId}/work-packages`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ workPackages: cleaned }),
      });
      setMsg("Packages saved on this project.");
      onSaved?.(cleaned);
      await loadCatalog();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addPackage() {
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
      const nextCatalog = r.packages?.length ? r.packages : [...catalog, name];
      setCatalog(catalogNames(nextCatalog));
      setNewName("");
      const next = projectPackages.includes(name) ? projectPackages : [...projectPackages, name].sort();
      if (pick) {
        if (projectId) await persist(next);
        else setPackages(next);
      } else if (projectId) await persist(next);
      else {
        setPackages(next);
        setMsg(`Added ${name} to the catalogue.`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFromCatalog(name: string) {
    if (!window.confirm(`Remove "${name}" from the package catalogue?`)) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ packages: string[] }>(
        `/api/projects/work-package-catalog?name=${encodeURIComponent(name)}`,
        { method: "DELETE", token },
      );
      setCatalog(catalogNames(r.packages?.length ? r.packages : FALLBACK_PACKAGES.filter((p) => p !== name)));
      const nextProject = projectPackages.filter((p) => p !== name);
      if (projectPackages.includes(name)) {
        setPackages(nextProject);
        if (projectId) {
          await api(`/api/projects/${projectId}/work-packages`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ workPackages: nextProject }),
          });
        }
      }
      setMsg(`Removed ${name} from the catalogue.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function toggle(pkg: string) {
    const next = projectPackages.includes(pkg)
      ? projectPackages.filter((p) => p !== pkg)
      : [...projectPackages, pkg].sort();
    if (projectId) void persist(next);
    else setPackages(next);
  }

  return (
    <Card className="!p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-base">{formatUiText(pick ? "Work packages" : "Package catalogue")}</h2>
        <p className="text-xs text-steel-muted mt-0.5">
          {pick
            ? "Tick the packages for this job (Civil, Electrical, Plumbing…). They save with the project card."
            : "Add or delete work packages here, then pin them on a project."}
        </p>
      </div>

      {msg && <p className="text-xs rounded px-2 py-1.5 bg-brand-soft text-brand-dark">{msg}</p>}

      {pick ? (
        <div className="flex flex-wrap gap-2">
          {catalog.map((p) => {
            const on = projectPackages.includes(p);
            return (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => toggle(p)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  on ? "text-white border-transparent" : "bg-paper border-line text-ink hover:border-brand"
                }`}
                style={on ? { background: "#0B6A78" } : undefined}
              >
                {p}
              </button>
            );
          })}
          {!catalog.length && <p className="text-xs text-steel-muted">No packages in the catalogue yet.</p>}
        </div>
      ) : (
        <>
          {projectId && (
            <div className="border border-line rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-sand/50 text-xs font-semibold uppercase tracking-wide text-steel-muted">
                On this project · {projectPackages.length}
              </div>
              <ul className="divide-y divide-line">
                {projectPackages.map((p) => (
                  <li key={p} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{p}</span>
                    <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => toggle(p)}>
                      Remove
                    </Button>
                  </li>
                ))}
                {!projectPackages.length && (
                  <li className="px-3 py-6 text-sm text-steel-muted text-center">Tick a package from the catalogue.</li>
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
                      onClick={() => toggle(p)}
                      className={`text-xs font-semibold ${on ? "text-brand" : "text-ink hover:text-brand"}`}
                    >
                      {p}
                      {on ? " · on project" : projectId ? " · add" : ""}
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
        </>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <Input
          className="min-w-[180px] flex-1"
          placeholder="New package (Interior, PEB…)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addPackage();
            }
          }}
        />
        <Button type="button" variant="secondary" className="!text-xs" disabled={busy || !newName.trim()} onClick={() => void addPackage()}>
          Add package
        </Button>
        {pick ? (
          <Link to="/crm/packages" className="text-[11px] font-semibold text-brand">
            Package management →
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
