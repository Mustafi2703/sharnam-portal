import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card } from "./ui";
import { PICKLIST_META, type DrawingPicklists, type PicklistState } from "../lib/drawingPicklists";

type Draft = Record<keyof DrawingPicklists, string[]>;

/** Manage this project's drawing pick-lists: add, remove, reorder and reset each list, then save once. */
export function DrawingPicklistSetup({
  projectId,
  token,
  state,
  onSaved,
}: {
  projectId: string;
  token: string | null;
  state: PicklistState;
  onSaved: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(state.lists);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setDraft(state.lists);
  }, [state.lists]);

  const changed = PICKLIST_META.some((m) => JSON.stringify(draft[m.key]) !== JSON.stringify(state.lists[m.key]));
  const set = (key: keyof DrawingPicklists, next: string[]) => setDraft({ ...draft, [key]: next });

  function add(key: keyof DrawingPicklists) {
    const v = (adding[key] || "").replace(/\s+/g, " ").trim();
    if (!v) return;
    if (draft[key].some((x) => x.toLowerCase() === v.toLowerCase())) {
      setNote(`"${v}" is already in that list.`);
      return;
    }
    set(key, [...draft[key], v]);
    setAdding({ ...adding, [key]: "" });
    setNote("");
  }
  function move(key: keyof DrawingPicklists, i: number, dir: -1 | 1) {
    const list = [...draft[key]];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set(key, list);
  }

  async function save() {
    setBusy(true);
    setNote("");
    try {
      const empty = PICKLIST_META.find((m) => !draft[m.key].length);
      if (empty) throw new Error(`"${empty.title}" needs at least one option.`);
      await api(`/api/drawings/project/${projectId}/picklists`, {
        method: "PUT",
        token,
        body: JSON.stringify({ lists: draft }),
        headers: { "Content-Type": "application/json" },
      });
      setNote("Saved. The master register, GFC upload, RFIs and design coordination now offer these.");
      await onSaved();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  async function resetAll() {
    if (!window.confirm("Reset every pick-list on this project to the standard lists?")) return;
    setBusy(true);
    try {
      await api(`/api/drawings/project/${projectId}/picklists`, { method: "DELETE", token });
      setNote("Back to the standard lists.");
      await onSaved();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not reset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-steel-muted">
        Add, remove or reorder the options. Changing a list only changes what can be picked — rows already using an older value keep it. Latest revision stays Yes / No; packages come from the register
        {state.used.packages.length ? ` (${state.used.packages.join(", ")})` : ""}.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {PICKLIST_META.map((m) => {
          const list = draft[m.key];
          const isDefault = JSON.stringify(list) === JSON.stringify(state.defaults[m.key]);
          return (
            <Card key={m.key} className="!p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{m.title}</span>
                {!isDefault ? <Badge tone="brand">customised</Badge> : <Badge tone="neutral">standard</Badge>}
                <span className="ml-auto text-[11px] text-steel-muted">{list.length} option{list.length === 1 ? "" : "s"}</span>
              </div>
              <p className="text-[11px] text-steel-muted">{m.hint}</p>
              <ul className="space-y-1">
                {list.map((v, i) => (
                  <li key={`${v}-${i}`} className="flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-sm">
                    <span className="flex-1 truncate">{v}</span>
                    <button type="button" className="px-1 text-steel-muted hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(m.key, i, -1)} aria-label="Move up">↑</button>
                    <button type="button" className="px-1 text-steel-muted hover:text-ink disabled:opacity-30" disabled={i === list.length - 1} onClick={() => move(m.key, i, 1)} aria-label="Move down">↓</button>
                    <button type="button" className="px-1 text-danger" onClick={() => set(m.key, list.filter((_, k) => k !== i))} aria-label={`Remove ${v}`}>×</button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
                  placeholder="Add an option"
                  value={adding[m.key] || ""}
                  onChange={(e) => setAdding({ ...adding, [m.key]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add(m.key);
                    }
                  }}
                />
                <Button type="button" variant="secondary" className="!py-1.5" onClick={() => add(m.key)}>Add</Button>
              </div>
              {!isDefault ? (
                <button type="button" className="text-xs font-semibold text-brand" onClick={() => set(m.key, [...state.defaults[m.key]])}>
                  Use the standard list
                </button>
              ) : null}
            </Card>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 sticky bottom-0 bg-paper/90 backdrop-blur py-2">
        <Button type="button" disabled={busy || !changed} onClick={() => void save()}>{busy ? "Saving…" : "Save pick-lists"}</Button>
        <Button type="button" variant="secondary" disabled={busy || !changed} onClick={() => setDraft(state.lists)}>Discard changes</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void resetAll()}>Reset all to standard</Button>
        {changed ? <span className="text-xs text-amber-700">Unsaved changes</span> : null}
        {note ? <span className="text-sm">{note}</span> : null}
      </div>
    </div>
  );
}
