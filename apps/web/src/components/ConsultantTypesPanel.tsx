import { FormEvent, useState } from "react";
import { useConsultantTypes } from "../lib/consultantTypes";
import { SearchableSelect } from "./SearchableSelect";
import { Button, Input } from "./ui";

/** Office/admin — add, rename, or remove consultant type labels. */
export function ConsultantTypesPanel({ token, canEdit = false }: { token: string | null; canEdit?: boolean }) {
  const { types, busy, msg, addType, renameType, removeType } = useConsultantTypes(token);
  const [open, setOpen] = useState(canEdit);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await addType(name);
      setName("");
    } catch {
      /* message shown by hook */
    }
  }

  if (!canEdit) return null;

  return (
    <div className="rounded-xl border border-line bg-paper">
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-ink">Consultant types</span>
        <span className="text-[11px] text-steel-muted">{open ? "Hide" : `Manage ${types.length} types`}</span>
      </button>
      {open ? (
        <div className="px-3 pb-3 space-y-2 border-t border-line pt-2">
          <p className="text-[11px] text-steel-muted">
            Used on the consultant directory and project setup. Phone stays on the contact, not on the type.
          </p>
          <ul className="divide-y border border-line rounded-lg overflow-hidden">
            {types.map((t) => (
              <li key={t} className="flex items-center gap-2 px-3 py-2 bg-paper text-sm">
                {editing === t ? (
                  <>
                    <Input className="!py-1" value={draft} onChange={(e) => setDraft(e.target.value)} />
                    <Button
                      type="button"
                      variant="secondary"
                      className="!text-xs"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          await renameType(t, draft);
                          setEditing(null);
                        } catch {
                          /* keep editor open */
                        }
                      }}
                    >
                      Save
                    </Button>
                    <button type="button" className="text-xs text-steel-muted" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 truncate">{t}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand"
                      onClick={() => {
                        setEditing(t);
                        setDraft(t);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="text-xs text-danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Remove “${t}” from the master list?`)) void removeType(t);
                      }}
                    >
                      Remove
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form className="flex flex-wrap gap-2" onSubmit={add}>
            <Input
              className="!w-64"
              placeholder="New type — e.g. Lighting consultant"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" variant="secondary" className="!text-xs" disabled={busy || !name.trim()}>
              Add type
            </Button>
          </form>
          {msg ? <p className="text-[11px] text-steel-muted">{msg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ConsultantTypeSelect({
  value,
  onChange,
  types,
  className,
  placeholder = "Consultant type…",
}: {
  value: string;
  onChange: (next: string) => void;
  types: string[];
  className?: string;
  placeholder?: string;
}) {
  const extra = value && !types.includes(value) ? [{ value, label: value }] : [];
  return (
    <div className={className}>
      <SearchableSelect
        options={[{ value: "", label: placeholder }, ...types.map((t) => ({ value: t, label: t })), ...extra]}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder="Search type…"
      />
    </div>
  );
}
