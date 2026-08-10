/**
 * EvidencePanel — mobile-first photo · PDF · signature block.
 * Used in DPR maker, WPR maker, and site check-in flows.
 */
import { type ChangeEvent, useState } from "react";
import { Button, Input } from "./ui";
import { PhotoCapture } from "./PhotoCapture";
import { SignaturePad } from "./SignaturePad";
import PdfMarkup from "./PdfMarkup";

export type EvidenceItem = {
  path: string;
  caption?: string;
  takenAt?: string | null;
  kind?: "photo" | "signature" | "pdf";
};

type Props = {
  title?: string;
  folderHint?: string;
  photos: EvidenceItem[];
  attachments: EvidenceItem[];
  signatures: EvidenceItem[];
  busy?: boolean;
  onUploadPhotos: (files: File[], caption: string) => Promise<void>;
  onUploadAttachment: (file: File) => Promise<void>;
  onUploadSignature: (file: File, role: string) => Promise<void>;
  onRemovePhoto: (index: number) => void;
  onRemoveAttachment: (index: number) => void;
  onRemoveSignature: (index: number) => void;
};

export function EvidencePanel({
  title = "Evidence & sign-off",
  folderHint,
  photos,
  attachments,
  signatures,
  busy,
  onUploadPhotos,
  onUploadAttachment,
  onUploadSignature,
  onRemovePhoto,
  onRemoveAttachment,
  onRemoveSignature,
}: Props) {
  const [caption, setCaption] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [pdfDraft, setPdfDraft] = useState<File | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  async function commitPhotos() {
    if (!pendingPhotos.length) return;
    setUploadingPhotos(true);
    try {
      await onUploadPhotos(pendingPhotos, caption);
      setPendingPhotos([]);
      setCaption("");
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function onPickAttachment(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setPdfDraft(file);
      e.target.value = "";
      return;
    }
    await onUploadAttachment(file);
    e.target.value = "";
  }

  return (
    <div className="evidence-panel space-y-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-steel-muted">{title}</h3>
        {folderHint && (
          <p className="text-xs text-steel-muted mt-0.5 font-mono break-all">{folderHint}</p>
        )}
      </div>

      {/* Photos */}
      <section className="evidence-panel__block">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
            Site photos ({photos.length})
          </h4>
        </div>
        <PhotoCapture
          onChange={setPendingPhotos}
          multiple
          hint="Camera opens rear lens on phone. Mark up before upload if needed."
          buttonSize="md"
        />
        {pendingPhotos.length > 0 && (
          <div className="mt-3 space-y-2">
            <Input
              placeholder="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <Button
              type="button"
              disabled={busy || uploadingPhotos}
              onClick={() => void commitPhotos()}
              className="w-full sm:w-auto"
            >
              {uploadingPhotos ? "Uploading…" : `Upload ${pendingPhotos.length} photo(s)`}
            </Button>
          </div>
        )}
        {photos.length > 0 && (
          <ul className="mt-3 text-xs divide-y max-h-48 overflow-y-auto overscroll-y-contain">
            {photos.map((p, i) => (
              <li key={i} className="py-2 flex justify-between gap-2 items-start">
                <div className="min-w-0">
                  <div className="font-mono truncate">{p.path}</div>
                  {p.caption && <div className="text-steel-muted">{p.caption}</div>}
                </div>
                <button type="button" className="text-danger shrink-0" onClick={() => onRemovePhoto(i)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PDF */}
      <section className="evidence-panel__block">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-2">
          PDF / documents ({attachments.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex">
            <span className="btn-secondary-like cursor-pointer text-xs font-semibold px-3 py-2 rounded-lg border border-line bg-white">
              Upload file
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => void onPickAttachment(e)}
            />
          </label>
          <label className="inline-flex">
            <span className="btn-secondary-like cursor-pointer text-xs font-semibold px-3 py-2 rounded-lg border border-line bg-white">
              PDF + markup
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPdfDraft(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {pdfDraft && (
          <div className="mt-3 rounded-lg border border-line overflow-hidden">
            <PdfMarkup
              src={pdfDraft}
              saveLabel="Save marked PDF & upload"
              onCancel={() => setPdfDraft(null)}
              onSave={async (files) => {
                for (const file of files) {
                  await onUploadAttachment(file);
                }
                setPdfDraft(null);
              }}
            />
          </div>
        )}
        {attachments.length > 0 && (
          <ul className="mt-3 text-xs divide-y max-h-40 overflow-y-auto">
            {attachments.map((p, i) => (
              <li key={i} className="py-2 flex justify-between gap-2">
                <span className="font-mono truncate">{p.path}</span>
                <button type="button" className="text-danger shrink-0" onClick={() => onRemoveAttachment(i)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Signatures */}
      <section className="evidence-panel__block">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-2">
          Sign-off ({signatures.length})
        </h4>
        <div className="grid md:grid-cols-3 gap-3">
          <SignaturePad label="Site engineer" personName="Site engineer" height={130} onCapture={(f) => f && onUploadSignature(f, "site_engineer")} />
          <SignaturePad label="PMC" personName="PMC" height={130} onCapture={(f) => f && onUploadSignature(f, "pmc")} />
          <SignaturePad label="Contractor" personName="Contractor" height={130} onCapture={(f) => f && onUploadSignature(f, "contractor")} />
        </div>
        {signatures.length > 0 && (
          <ul className="mt-3 text-xs divide-y max-h-32 overflow-y-auto">
            {signatures.map((p, i) => (
              <li key={i} className="py-2 flex justify-between gap-2">
                <span className="font-mono truncate">{p.path}</span>
                <button type="button" className="text-danger shrink-0" onClick={() => onRemoveSignature(i)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
