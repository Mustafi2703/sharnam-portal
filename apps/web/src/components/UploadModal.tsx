import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { Button, FileField, Input, Select } from "./ui";

type Field =
  | { kind: "text"; name: string; label: string; required?: boolean; placeholder?: string; value: string; onChange: (v: string) => void }
  | { kind: "select"; name: string; label: string; value: string; onChange: (v: string) => void; options: string[] }
  | { kind: "checkbox"; name: string; label: string; checked: boolean; onChange: (v: boolean) => void }
  | { kind: "custom"; node: ReactNode };

export function UploadModal({
  open,
  title,
  context,
  file,
  onFile,
  accept,
  fields,
  primaryLabel,
  busy,
  error,
  success,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  context?: string;
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
  fields: Field[];
  primaryLabel: string;
  busy?: boolean;
  error?: string;
  success?: string;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("input,button,select")?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-ink/45 flex items-end sm:items-center justify-center p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl border border-line bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b border-line bg-white">
          <div>
            <h2 id={titleId} className="font-display text-xl text-ink">
              {title}
            </h2>
            {context && <p className="text-xs text-steel-muted mt-1">{context}</p>}
          </div>
          <Button type="button" variant="ghost" className="!px-2 !py-1 !text-xs" onClick={onClose}>
            Close
          </Button>
        </div>

        <form className="p-5 space-y-4" onSubmit={onSubmit}>
          <FileField
            file={file}
            onChange={onFile}
            label="Browse file"
            accept={accept || ".pdf,.png,.jpg,.jpeg,.webp,.dwg"}
            hint="Dropzone · PDF or image preferred for in-app viewer"
          />

          {fields.map((f, i) => {
            if (f.kind === "custom") return <div key={i}>{f.node}</div>;
            if (f.kind === "checkbox") {
              return (
                <label key={f.name} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.checked} onChange={(e) => f.onChange(e.target.checked)} />
                  {f.label}
                </label>
              );
            }
            if (f.kind === "select") {
              return (
                <label key={f.name} className="block text-sm">
                  <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">{f.label}</span>
                  <Select className="mt-1.5" value={f.value} onChange={(e) => f.onChange(e.target.value)}>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                </label>
              );
            }
            return (
              <label key={f.name} className="block text-sm">
                <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">{f.label}</span>
                <Input
                  className="mt-1.5"
                  required={f.required}
                  placeholder={f.placeholder}
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                />
              </label>
            );
          })}

          {error && <p className="text-sm text-danger bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-sm text-ok bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">{success}</p>}

          <Button type="submit" disabled={busy || !file} className="w-full !py-3">
            {busy ? "Uploading…" : primaryLabel}
          </Button>
        </form>
      </div>
    </div>
  );
}
