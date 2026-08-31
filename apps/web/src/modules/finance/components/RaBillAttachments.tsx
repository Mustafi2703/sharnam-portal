import { useEffect, useRef, useState } from "react";
import { api } from "../../../api";
import { DocumentPreviewModal } from "../../../components/DocumentPreviewModal";

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string | null;
  sharePointUrl: string | null;
  kind: string;
  uploadedAt: string;
};

/**
 * Contractor document folder per RA bill — multiple uploads, preview in app.
 */
export function RaBillAttachments({
  raBillId,
  raNumber,
  token,
  canWrite,
  initialAttachments = [],
  onChange,
}: {
  raBillId: string;
  raNumber: string;
  token: string | null;
  canWrite: boolean;
  initialAttachments?: Attachment[];
  onChange?: () => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<{ url: string; title: string; fileName: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments]);

  async function reload() {
    const rows = await api<Attachment[]>(`/api/finance/ra/${raBillId}/attachments`, { token });
    setAttachments(rows);
  }

  async function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("files", f);
      await api(`/api/finance/ra/${raBillId}/attachments`, { method: "POST", token, body: fd });
      setMsg(`${files.length} file(s) filed under RA-${raNumber}`);
      await reload();
      onChange?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function openDoc(a: Attachment) {
    const url = a.sharePointUrl || a.fileUrl;
    if (!url) return;
    setPreview({ url, title: `${raNumber} · ${a.fileName}`, fileName: a.fileName });
  }

  const count = attachments.length;

  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex flex-wrap gap-1 items-center">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open && !attachments.length) void reload();
          }}
          className="px-2 py-0.5 rounded border border-line text-[10px] text-steel-muted hover:bg-sand"
        >
          {open ? "Hide docs" : `Docs (${count})`}
        </button>
        {canWrite && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="px-2 py-0.5 rounded border border-brand/40 text-[10px] text-brand hover:bg-brand/5 disabled:opacity-60"
            >
              {busy ? "…" : "+ Upload"}
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.xlsm,.pdf,.doc,.docx,image/*"
              hidden
              onChange={onFilesChosen}
            />
          </>
        )}
      </div>
      {msg && <span className="text-[10px] text-steel-muted">{msg}</span>}
      {open && (
        <div className="mt-1 border border-line rounded bg-white shadow-sm w-80 max-h-52 overflow-auto text-[11px] p-2">
          <div className="font-semibold mb-1">
            {raNumber} · {count} document{count === 1 ? "" : "s"}
          </div>
          {count === 0 && (
            <div className="text-steel-muted">
              No files yet — contractors can upload RA workbooks, invoices, and supporting scans here.
            </div>
          )}
          <ul className="space-y-1">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-start gap-2 border-t border-line pt-1">
                <button
                  type="button"
                  onClick={() => openDoc(a)}
                  className="text-brand underline truncate flex-1 text-left"
                  title={a.fileName}
                >
                  {a.fileName}
                </button>
                <span className="text-[9px] text-steel-muted shrink-0">
                  {new Date(a.uploadedAt).toLocaleDateString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {preview && (
        <DocumentPreviewModal
          title={preview.title}
          url={preview.url}
          fileName={preview.fileName}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
