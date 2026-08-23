import { useRef, useState, type DragEvent } from "react";
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

/** Procore-style upload modal — dropzone + browse for reference Excel packs */
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
    setFile(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-paper border border-line shadow-xl">
        <div className="sticky top-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-line bg-paper">
          <div>
            <h3 className="font-semibold text-ink">{title}</h3>
            <p className="text-xs text-steel-muted mt-0.5">{sheetLabel}</p>
          </div>
          <button type="button" className="text-steel-muted hover:text-ink text-2xl leading-none p-1" onClick={close} aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
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
        <div className="sticky bottom-0 flex flex-wrap gap-2 justify-end px-4 sm:px-5 py-4 border-t border-line bg-sand/40 safe-bottom">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!file || busy}>
            {busy ? "Uploading…" : "Upload & import rows"}
          </Button>
        </div>
      </div>
    </div>
  );
}
