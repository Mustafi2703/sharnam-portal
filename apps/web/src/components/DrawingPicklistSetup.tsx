import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card } from "./ui";
import { PICKLIST_META, type DrawingPicklists, type PicklistState } from "../lib/drawingPicklists";

/** Manage this project's drawing pick-lists (master register → set-up). One option per line. */
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
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    setText(Object.fromEntries(PICKLIST_META.map((m) => [m.key, state.lists[m.key].join("\n")])));
  }, [state.lists]);

  async function save() {
    setBusy(true);
    setNote("");
    try {
      const lists: Partial<Record<keyof DrawingPicklists, string[]>> = {};
      for (const m of PICKLIST_META) lists[m.key] = (text[m.key] || "").split("\n").map((x) => x.trim()).filter(Boolean);
      await api(`/api/drawings/project/${projectId}/picklists`, { method: "PUT", token, body: JSON.stringify({ lists }), headers: { "Content-Type": "application/json" } });
      setNote("Saved — the register, GFC upload, RFIs and design coordination now offer these.");
      await onSaved();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
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
    <Card className="space-y-3">
      <p className="text-xs text-steel-muted">
        One option per line. Changing a list only changes what can be picked — rows already using an older value keep it. The register, the GFC upload, RFIs and design coordination all read these lists.
        Latest revision stays Yes / No. Packages come from the register itself ({state.used.packages.length ? state.used.packages.join(", ") : "none yet"}).
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {PICKLIST_META.map((m) => (
          <label key={m.key} className="block">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink">
              {m.title}
              {state.custom.includes(m.key) ? <Badge tone="brand">customised</Badge> : null}
            </span>
            <span className="block text-[11px] text-steel-muted mb-1">{m.hint}</span>
            <textarea
              rows={Math.min(8, Math.max(4, (text[m.key] || "").split("\n").length + 1))}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              value={text[m.key] ?? ""}
              onChange={(e) => setText({ ...text, [m.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save pick-lists"}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void reset()}>Reset to standard</Button>
        {note ? <span className="text-sm">{note}</span> : null}
      </div>
    </Card>
  );
}
