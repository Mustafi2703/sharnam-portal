import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useConsultantTypes } from "../lib/consultantTypes";
import { Button, Card, Input } from "./ui";
import { StatusNote } from "./StatusNote";

function ChoiceModal({
  title,
  hint,
  open,
  onClose,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <Card className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm">{title}</h3>
              {hint ? <p className="text-xs text-steel-muted mt-1">{hint}</p> : null}
            </div>
            <button type="button" className="text-xs font-semibold text-steel-muted" onClick={onClose}>
              Close
            </button>
          </div>
          {children}
        </Card>
      </div>
    </div>,
    document.body,
  );
}

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
          <StatusNote msg={msg} compact />
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
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  types: string[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const list = value && !types.includes(value) ? [value, ...types] : types;
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((t) => t.toLowerCase().includes(needle)) : list;
  }, [types, value, q]);

  return (
    <div className={className}>
      <span className="text-xs text-steel-muted">Consultant type</span>
      <button
        type="button"
        className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-left text-sm disabled:opacity-60"
        disabled={disabled}
        onClick={() => {
          setQ("");
          setOpen(true);
        }}
      >
        <span data-preserve-case className={value ? "text-ink" : "text-steel-muted"}>
          {value || "Choose consultant type"}
        </span>
      </button>
      <ChoiceModal
        title="Consultant type"
        hint="Same list for a consultant and for a PMC. Pick one, or clear it."
        open={open}
        onClose={() => setOpen(false)}
      >
        <Input placeholder="Search type" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="max-h-64 overflow-y-auto divide-y border border-line rounded-lg">
          <li>
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-steel-muted hover:bg-sand"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              No type
            </button>
          </li>
          {options.map((t) => (
            <li key={t}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-sand ${t === value ? "bg-brand-soft font-semibold" : ""}`}
                data-preserve-case
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
              >
                {t}
              </button>
            </li>
          ))}
          {!options.length ? <li className="px-3 py-3 text-sm text-steel-muted">No matching type.</li> : null}
        </ul>
      </ChoiceModal>
    </div>
  );
}

export function ConsultantRoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: "Consultant" | "PMC") => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const role = value === "PMC" ? "PMC" : "Consultant";
  return (
    <div>
      <span className="text-xs text-steel-muted">Role</span>
      <button
        type="button"
        className="mt-1 w-full rounded border border-line bg-paper px-3 py-2 text-left text-sm disabled:opacity-60"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {role === "PMC" ? "Project management consultant" : "Consultant"}
      </button>
      <ChoiceModal
        title="Consultant or project management consultant"
        hint="Choose the role here. The consultant type is the list below, including when this company is a project management consultant."
        open={open}
        onClose={() => setOpen(false)}
      >
        {(["Consultant", "PMC"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`w-full text-left rounded-lg border px-3 py-3 text-sm ${
              role === option ? "border-brand bg-brand-soft font-semibold" : "border-line hover:bg-sand"
            }`}
            onClick={() => {
              onChange(option);
              setOpen(false);
            }}
          >
            {option === "PMC" ? "Project management consultant" : "Consultant"}
            <span className="block text-xs font-normal text-steel-muted mt-0.5">
              {option === "PMC"
                ? "Shows on the project card under Project management consultant."
                : "Shows on the project card under Consultants."}
            </span>
          </button>
        ))}
      </ChoiceModal>
    </div>
  );
}
