import { Button } from "./ui";

export type SheetAddKind = { key: string; label: string; primary?: boolean };

/** In-editor row-type actions — section / subsection / measured line, etc. */
export function SheetAddKindBar({
  kinds,
  disabled,
  onAdd,
  hint,
}: {
  kinds: SheetAddKind[];
  disabled?: boolean;
  onAdd: (key: string) => void;
  hint?: string;
}) {
  if (!kinds.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      {kinds.map((k) => (
        <Button
          key={k.key}
          type="button"
          variant={k.primary ? "primary" : "secondary"}
          className="!text-xs"
          disabled={disabled}
          onClick={() => onAdd(k.key)}
        >
          {k.label}
        </Button>
      ))}
      {hint ? <span className="text-[11px] text-steel-muted">{hint}</span> : null}
    </div>
  );
}
