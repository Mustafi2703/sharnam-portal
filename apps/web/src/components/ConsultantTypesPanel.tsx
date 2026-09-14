import { FormEvent, useState } from "react";
import { useConsultantTypes } from "../lib/consultantTypes";
import { Button, Input } from "./ui";

/** CRM master — add / rename / remove consultant types used on setup and stakeholder logins. */
export function ConsultantTypesPanel({ token }: { token: string | null }) {
  const { types, busy, msg, addType, renameType, removeType } = useConsultantTypes(token);
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

  return (
    <div className="rounded-xl border border-line bg-sand/30 p-3 space-y-2">
      <div>
        <h4 className="font-semibold text-sm">Consultant types</h4>
        <p className="text-[11px] text-steel-muted">
          Master list for project setup and stakeholder logins — add or edit types here. Phone stays on the contact, not on the type.
        </p>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <li key={t} className="flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-0.5 text-xs">
            {editing === t ? (
              <>
                <input
                  className="w-40 bg-transparent outline-none"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="font-semibold text-brand"
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
                </button>
                <button type="button" className="text-steel-muted" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span>{t}</span>
                <button
                  type="button"
                  className="text-brand font-semibold"
                  onClick={() => {
                    setEditing(t);
                    setDraft(t);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Remove “${t}” from the master list?`)) void removeType(t);
                  }}
                >
                  ×
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="flex flex-wrap gap-2" onSubmit={add}>
        <Input
          className="!w-56"
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
  );
}

export function ConsultantTypeSelect({
  value,
  onChange,
  types,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  types: string[];
  className?: string;
}) {
  const extra = value && !types.includes(value) ? [value] : [];
  return (
    <select
      className={`w-full rounded border border-line bg-paper text-ink px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 ${className || ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Consultant type…</option>
      {[...types, ...extra].map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
