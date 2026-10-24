import { formatUiText } from "../lib/formatUiText";

export type ChecklistAttachOption = { id: string; name: string; hint?: string };

/** Tick one or more project checklists, including a custom template that is already assigned. */
export function ChecklistAttachPicker({
  options,
  selected,
  onChange,
  label = "Also attach checklists",
}: {
  options: ChecklistAttachOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((row) => row !== id) : [...selected, id]);
  }

  return (
    <fieldset className="space-y-1">
      <legend className="ui-field__label">{formatUiText(label)}</legend>
      <p className="text-xs text-steel-muted">
        {formatUiText("Pick any filled checklist on this project, including a custom one. More than one can sit on the same drawing or RFI.")}
      </p>
      <div className="max-h-36 overflow-y-auto rounded-lg border border-line bg-paper p-2 space-y-1">
        {!options.length && (
          <p className="text-xs text-steel-muted">{formatUiText("No checklists are assigned on this project yet.")}</p>
        )}
        {options.map((row) => (
          <label key={row.id} className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} />
            <span>
              {row.name}
              {row.hint ? <span className="text-steel-muted"> · {formatUiText(row.hint)}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
