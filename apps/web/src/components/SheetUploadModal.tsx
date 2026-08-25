import { useEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui";

type SheetUploadModalProps = {
  open: boolean;
  title: string;
  sheetLabel: string;
  accept?: string;
  hint?: string;
  busy?: boolean;
  onClose: () => void;
  onUpload: (file: File) => void | Promise<void>;
};

/** Procore-style upload modal — portaled so it never sticks inside scroll containers. */
export function SheetUploadModal({
  open,
  title,
  sheetLabel,
  accept = ".xlsx,.xls,.csv",
  hint,
  busy,
  onClose,
  onUpload,
}: SheetUploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setDrag(false);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  function pick(f: File | null) {
    setFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pick(f);
  }

  async function submit() {
    if (!file) return;
    await onUpload(file);
    setFile(null);
  }

  function close() {
    if (busy) return;
    setFile(null);
    onClose();
  }

  return createPortal(
    <div
      className="register-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={close}
    >
      <div className="register-modal__panel register-modal__panel--md" onClick={(e) => e.stopPropagation()}>
        <div className="register-modal__head">
          <div className="min-w-0">
            <h3 className="font-semibold text-ink">{title}</h3>
            <p className="text-xs text-steel-muted mt-0.5 truncate">{sheetLabel}</p>
          </div>
          <button type="button" className="text-steel-muted hover:text-ink text-2xl leading-none px-2" onClick={close} aria-label="Close">
            ×
          </button>
        </div>
        <div className="register-modal__body space-y-4">
          <div
            className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              drag ? "border-brand bg-brand-soft/40" : "border-line bg-sand/30"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
          >
            <p className="text-sm font-medium text-ink">Drop your reference sheet here</p>
            <p className="text-xs text-steel-muted mt-1">Column layout must match the client template</p>
            <Button type="button" variant="secondary" className="mt-4" onClick={() => inputRef.current?.click()} disabled={busy}>
              Browse file
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={accept}
              onChange={(e) => pick(e.target.files?.[0] || null)}
            />
            {file && (
              <p className="text-xs text-brand font-medium mt-3 truncate" data-preserve-case>
                {file.name}
              </p>
            )}
          </div>
          {hint && <p className="text-xs text-steel-muted leading-relaxed">{hint}</p>}
        </div>
        <div className="register-modal__foot safe-bottom">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!file || busy}>
            {busy ? "Uploading…" : "Upload & import rows"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
